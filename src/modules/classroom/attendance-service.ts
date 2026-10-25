import { withTenantTransaction } from "@/lib/db/tenant-prisma";

export interface CreateAttendanceSessionInput {
  meetingNumber?: number;
  title: string;
  date?: string | Date;
  accessCode?: string;
}

export interface UpdateAttendanceSessionInput {
  status?: "OPEN" | "CLOSED";
  records?: Array<{
    studentUserId: string;
    status: "PRESENT" | "EXCUSED" | "SICK" | "ABSENT";
    note?: string;
  }>;
}

export async function getAttendanceForClass({
  institutionId,
  classCourseId,
  userId,
  role,
}: {
  institutionId: string;
  classCourseId: string;
  userId: string;
  role: string;
}) {
  return withTenantTransaction(institutionId, async (tx) => {
    const sessions = await tx.attendanceSession.findMany({
      where: { classCourseId },
      include: {
        records: {
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                identifiers: {
                  select: { value: true, isPrimary: true },
                },
              },
            },
          },
        },
      },
      orderBy: { meetingNumber: "asc" },
    });

    // Ambil daftar seluruh mahasiswa yang terdaftar di kelas
    const enrollments = await tx.classEnrollment.findMany({
      where: { classCourseId, status: "ACTIVE" },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            identifiers: {
              select: { value: true, isPrimary: true },
            },
          },
        },
      },
    });

    const students = enrollments.map((e: any) => ({
      id: e.student.id,
      fullName: e.student.fullName,
      identifier: e.student.identifiers.find((i: any) => i.isPrimary)?.value || e.student.identifiers[0]?.value || "-",
    }));

    // Hitung rekap kehadiran per mahasiswa
    const totalSessions = sessions.length;
    const studentRecap = students.map((std: any) => {
      let presentCount = 0;
      let excusedCount = 0;
      let sickCount = 0;
      let absentCount = 0;

      sessions.forEach((sess: any) => {
        const rec = sess.records.find((r: any) => r.studentUserId === std.id);
        if (!rec || rec.status === "ABSENT") absentCount++;
        else if (rec.status === "PRESENT") presentCount++;
        else if (rec.status === "EXCUSED") excusedCount++;
        else if (rec.status === "SICK") sickCount++;
      });

      const attendancePercentage = totalSessions > 0
        ? Math.round(((presentCount + (excusedCount * 0.5)) / totalSessions) * 100)
        : 100;

      return {
        ...std,
        presentCount,
        excusedCount,
        sickCount,
        absentCount,
        attendancePercentage,
      };
    });

    return {
      sessions,
      students,
      studentRecap,
      totalSessions,
    };
  });
}

export async function createAttendanceSession({
  institutionId,
  classCourseId,
  role,
  input,
}: {
  institutionId: string;
  classCourseId: string;
  role: string;
  input: CreateAttendanceSessionInput;
}) {
  const isInstructorOrAdmin =
    ["INSTRUCTOR", "LECTURER", "TEACHER", "ADMIN", "SUPERADMIN", "PLATFORM_ADMIN"].includes(role.toUpperCase());

  if (!isInstructorOrAdmin) {
    throw new Error("Akses ditolak: Hanya pengajar atau admin yang dapat membuat sesi presensi.");
  }

  return withTenantTransaction(institutionId, async (tx) => {
    // Tentukan nomor pertemuan otomatis jika tidak diisi
    let meetingNumber = input.meetingNumber;
    if (!meetingNumber) {
      const lastSession = await tx.attendanceSession.findFirst({
        where: { classCourseId },
        orderBy: { meetingNumber: "desc" },
      });
      meetingNumber = (lastSession?.meetingNumber || 0) + 1;
    }

    const session = await tx.attendanceSession.create({
      data: {
        institutionId,
        classCourseId,
        meetingNumber,
        title: input.title || `Pertemuan ke-${meetingNumber}`,
        date: input.date ? new Date(input.date) : new Date(),
        status: "OPEN",
        accessCode: input.accessCode ? input.accessCode.trim().toUpperCase() : null,
      },
    });

    return session;
  });
}

export async function updateAttendanceSession({
  institutionId,
  sessionId,
  role,
  input,
}: {
  institutionId: string;
  sessionId: string;
  role: string;
  input: UpdateAttendanceSessionInput;
}) {
  const isInstructorOrAdmin =
    ["INSTRUCTOR", "LECTURER", "TEACHER", "ADMIN", "SUPERADMIN", "PLATFORM_ADMIN"].includes(role.toUpperCase());

  if (!isInstructorOrAdmin) {
    throw new Error("Akses ditolak: Hanya pengajar atau admin yang dapat memperbarui sesi presensi.");
  }

  return withTenantTransaction(institutionId, async (tx) => {
    if (input.status) {
      await tx.attendanceSession.update({
        where: { id: sessionId },
        data: { status: input.status },
      });
    }

    if (input.records && Array.isArray(input.records)) {
      for (const rec of input.records) {
        await tx.attendanceRecord.upsert({
          where: {
            sessionId_studentUserId: {
              sessionId,
              studentUserId: rec.studentUserId,
            },
          },
          update: {
            status: rec.status,
            note: rec.note || null,
          },
          create: {
            institutionId,
            sessionId,
            studentUserId: rec.studentUserId,
            status: rec.status,
            note: rec.note || null,
          },
        });
      }
    }

    return tx.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        records: true,
      },
    });
  });
}

export async function checkInAttendance({
  institutionId,
  sessionId,
  studentUserId,
  accessCode,
}: {
  institutionId: string;
  sessionId: string;
  studentUserId: string;
  accessCode?: string;
}) {
  return withTenantTransaction(institutionId, async (tx) => {
    const session = await tx.attendanceSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error("Sesi presensi tidak ditemukan.");
    }

    if (session.status !== "OPEN") {
      throw new Error("Sesi presensi ini telah ditutup oleh pengajar.");
    }

    if (session.accessCode) {
      const cleanInput = (accessCode || "").trim().toUpperCase();
      if (cleanInput !== session.accessCode.toUpperCase()) {
        throw new Error("Kode akses presensi tidak valid.");
      }
    }

    return tx.attendanceRecord.upsert({
      where: {
        sessionId_studentUserId: {
          sessionId,
          studentUserId,
        },
      },
      update: {
        status: "PRESENT",
        recordedAt: new Date(),
      },
      create: {
        institutionId,
        sessionId,
        studentUserId,
        status: "PRESENT",
      },
    });
  });
}
