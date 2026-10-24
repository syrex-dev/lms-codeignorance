import { withTenantTransaction } from "@/lib/db/tenant-prisma";
import { requireFeature } from "@/modules/saas/entitlement";
import { sanitizeRichText } from "./sanitizer";
import { UserRole, PublishStatus, SubmissionStatus } from "@prisma/client";

/**
 * 1. GET DAFTAR TUGAS DI SUATU KELAS
 */
export async function getAssignmentsForClass(params: {
  institutionId: string;
  classCourseId: string;
  userId: string;
  role: string;
}) {
  const { institutionId, classCourseId, userId, role } = params;
  await requireFeature(institutionId, "classroom");

  return withTenantTransaction(institutionId, async (tenantDb) => {
    const isStudent = role === UserRole.STUDENT;

    const where: any = {
      institutionId,
      classCourseId,
      deletedAt: null,
    };

    if (isStudent) {
      where.status = PublishStatus.PUBLISHED;
    }

    const assignments = await tenantDb.assignment.findMany({
      where,
      orderBy: { dueDate: "asc" },
      include: {
        submissions: {
          where: isStudent ? { studentUserId: userId } : undefined,
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
                identifiers: {
                  select: { value: true, type: true, isPrimary: true },
                },
              },
            },
          },
        },
        _count: {
          select: { submissions: true },
        },
      },
    });

    return assignments.map((a: any) => {
      const mySubmission = isStudent ? a.submissions?.[0] || null : null;
      return {
        ...a,
        mySubmission,
        submissionCount: a._count?.submissions || 0,
      };
    });
  });
}

/**
 * 2. BUAT TUGAS BARU (Hanya Pengajar / Admin)
 */
export async function createAssignment(params: {
  institutionId: string;
  classCourseId: string;
  userId: string;
  role: string;
  input: {
    title: string;
    instructions: string;
    dueDate: string;
    maxScore?: number;
    allowLateSubmission?: boolean;
    status?: PublishStatus;
    topicId?: string;
  };
}) {
  const { institutionId, classCourseId, userId, role, input } = params;
  await requireFeature(institutionId, "classroom");

  return withTenantTransaction(institutionId, async (tenantDb) => {
    // Verifikasi wewenang pengajar atau admin
    if (role === UserRole.STUDENT) {
      throw new Error("Akses ditolak: Siswa tidak diizinkan membuat tugas.");
    }

    const cleanInstructions = sanitizeRichText(input.instructions || "");

    const assignment = await tenantDb.assignment.create({
      data: {
        institutionId,
        classCourseId,
        topicId: input.topicId || null,
        title: input.title.trim(),
        instructions: cleanInstructions,
        dueDate: new Date(input.dueDate),
        maxScore: input.maxScore ?? 100,
        status: input.status || PublishStatus.PUBLISHED,
        allowLateSubmission: input.allowLateSubmission ?? false,
      },
    });

    await tenantDb.auditLog.create({
      data: {
        institutionId,
        userId,
        action: "CREATE_ASSIGNMENT",
        entityType: "Assignment",
        entityId: assignment.id,
        newValue: { classCourseId, title: assignment.title },
      },
    });

    return assignment;
  });
}

/**
 * 3. SISWA MENGUMPULKAN JAWABAN TUGAS
 */
export async function submitAssignment(params: {
  institutionId: string;
  assignmentId: string;
  studentUserId: string;
  input: {
    textContent?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
  };
}) {
  const { institutionId, assignmentId, studentUserId, input } = params;
  await requireFeature(institutionId, "classroom");

  return withTenantTransaction(institutionId, async (tenantDb) => {
    const assignment = await tenantDb.assignment.findFirst({
      where: { id: assignmentId, institutionId, deletedAt: null },
    });
    if (!assignment) throw new Error("Tugas tidak ditemukan.");

    // Validasi apakah siswa ter-enroll aktif di kelas
    const enrollment = await tenantDb.classEnrollment.findFirst({
      where: {
        classCourseId: assignment.classCourseId,
        studentUserId,
        status: "ACTIVE",
      },
    });
    if (!enrollment) throw new Error("Anda tidak terdaftar dalam kelas ini.");

    // Cek deadline
    const now = new Date();
    if (now > new Date(assignment.dueDate) && !assignment.allowLateSubmission) {
      throw new Error("Batas waktu pengumpulan tugas telah berakhir.");
    }

    const cleanText = input.textContent ? sanitizeRichText(input.textContent) : null;

    const submission = await tenantDb.submission.upsert({
      where: {
        assignmentId_studentUserId: {
          assignmentId,
          studentUserId,
        },
      },
      update: {
        textContent: cleanText,
        fileUrl: input.fileUrl || null,
        fileName: input.fileName || null,
        fileSize: input.fileSize || null,
        submittedAt: now,
        status: SubmissionStatus.SUBMITTED,
      },
      create: {
        institutionId,
        assignmentId,
        studentUserId,
        textContent: cleanText,
        fileUrl: input.fileUrl || null,
        fileName: input.fileName || null,
        fileSize: input.fileSize || null,
        submittedAt: now,
        status: SubmissionStatus.SUBMITTED,
      },
    });

    return submission;
  });
}

/**
 * 4. PENGAJAR MENILAI PENGUMPULAN SISWA
 */
export async function gradeSubmission(params: {
  institutionId: string;
  submissionId: string;
  graderUserId: string;
  role: string;
  score: number;
  feedback?: string;
}) {
  const { institutionId, submissionId, graderUserId, role, score, feedback } = params;
  await requireFeature(institutionId, "classroom");

  return withTenantTransaction(institutionId, async (tenantDb) => {
    if (role === UserRole.STUDENT) {
      throw new Error("Akses ditolak: Siswa tidak diizinkan memberi nilai.");
    }

    const submission = await tenantDb.submission.findFirst({
      where: { id: submissionId, institutionId },
      include: { assignment: true },
    });
    if (!submission) throw new Error("Pengumpulan tugas tidak ditemukan.");

    if (score < 0 || score > submission.assignment.maxScore) {
      throw new Error(`Nilai harus di antara 0 dan ${submission.assignment.maxScore}.`);
    }

    const updated = await tenantDb.submission.update({
      where: { id: submissionId },
      data: {
        score,
        feedback: feedback ? feedback.trim() : null,
        gradedByUserId: graderUserId,
        gradedAt: new Date(),
        status: SubmissionStatus.GRADED,
      },
    });

    await tenantDb.auditLog.create({
      data: {
        institutionId,
        userId: graderUserId,
        action: "GRADE_SUBMISSION",
        entityType: "Submission",
        entityId: submissionId,
        newValue: { score, feedback },
      },
    });

    return updated;
  });
}

/**
 * 5. AGREGAT TUGAS LINTAS KELAS (Dashboard / Menu Tugas)
 */
export async function getAggregatedAssignments(params: {
  institutionId: string;
  userId: string;
  role: string;
}) {
  const { institutionId, userId, role } = params;
  await requireFeature(institutionId, "classroom");

  return withTenantTransaction(institutionId, async (tenantDb) => {
    const isStudent = role === UserRole.STUDENT;

    if (isStudent) {
      // Ambil tugas dari semua kelas yang diikuti siswa
      const enrollments = await tenantDb.classEnrollment.findMany({
        where: { studentUserId: userId, status: "ACTIVE" },
        select: { classCourseId: true },
      });
      const classIds = enrollments.map((e: any) => e.classCourseId);

      const assignments = await tenantDb.assignment.findMany({
        where: {
          institutionId,
          classCourseId: { in: classIds },
          status: PublishStatus.PUBLISHED,
          deletedAt: null,
        },
        include: {
          classCourse: {
            select: { id: true, name: true, code: true },
          },
          submissions: {
            where: { studentUserId: userId },
          },
        },
        orderBy: { dueDate: "asc" },
      });

      return assignments.map((a: any) => ({
        ...a,
        mySubmission: a.submissions?.[0] || null,
      }));
    } else {
      // Pengajar / Admin: daftar tugas aktif beserta jumlah pengumpulan
      const assignments = await tenantDb.assignment.findMany({
        where: {
          institutionId,
          deletedAt: null,
        },
        include: {
          classCourse: {
            select: { id: true, name: true, code: true },
          },
          submissions: {
            where: { status: SubmissionStatus.SUBMITTED },
            select: { id: true },
          },
          _count: {
            select: { submissions: true },
          },
        },
        orderBy: { dueDate: "desc" },
      });

      return assignments.map((a: any) => ({
        ...a,
        pendingGradingCount: a.submissions?.length || 0,
        totalSubmissionCount: a._count?.submissions || 0,
      }));
    }
  });
}
