import { UserRole } from "@prisma/client";
import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireSession(req, {
      requiredRoles: [UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN],
    });
    if (!guard.success) {
      return guard.response;
    }
    const { institutionId } = guard;
    const session = { user: guard.user };
    const { id: classCourseId } = await params;

    const classCourse = await prisma.classCourse.findFirst({
      where: { id: classCourseId, institutionId, deletedAt: null },
    });
    if (!classCourse) {
      return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
    }

    const enrollments = await prisma.classEnrollment.findMany({
      where: { classCourseId },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            status: true,
            identifiers: {
              where: { institutionId },
              select: { value: true, type: true },
            },
          },
        },
      },
      orderBy: { student: { fullName: "asc" } },
    });

    return NextResponse.json({ enrollments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal memuat peserta kelas." }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireSession(req, {
      requiredRoles: [UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN],
    });
    if (!guard.success) {
      return guard.response;
    }
    const { institutionId } = guard;
    const session = { user: guard.user };
    const { id: classCourseId } = await params;
    const body = await req.json();

    // Validasi kepemilikan kelas di tenant ini
    const classCourse = await prisma.classCourse.findFirst({
      where: { id: classCourseId, institutionId, deletedAt: null },
    });
    if (!classCourse) {
      return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
    }

    // Mendukung single enrollment (studentUserId) maupun massal (studentUserIds[])
    const targetUserIds: string[] = Array.isArray(body.studentUserIds)
      ? body.studentUserIds
      : body.studentUserId
      ? [body.studentUserId]
      : [];

    if (targetUserIds.length === 0) {
      return NextResponse.json({ error: "studentUserId atau studentUserIds wajib diisi." }, { status: 400 });
    }

    // ISOLASI DATA MULTI-TENANT KETAT:
    // Pastikan SEMUA studentUserIds yang didaftarkan benar-benar terdaftar di tenant aktif yang sama!
    const validStudentsInTenant = await prisma.user.findMany({
      where: {
        id: { in: targetUserIds },
        institutionId,
        deletedAt: null,
      },
      select: { id: true },
    });

    const validIds = new Set(validStudentsInTenant.map((s) => s.id));
    const rejectedIds = targetUserIds.filter((id) => !validIds.has(id));

    if (validStudentsInTenant.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada siswa yang valid di institusi ini untuk didaftarkan (mencegah bentrok lintas-tenant)." },
        { status: 400 }
      );
    }

    // Daftarkan siswa yang valid
    const enrolledResults = [];
    for (const studentId of Array.from(validIds)) {
      const enrollment = await prisma.classEnrollment.upsert({
        where: {
          classCourseId_studentUserId: {
            classCourseId,
            studentUserId: studentId,
          },
        },
        update: { status: "ACTIVE" },
        create: {
          classCourseId,
          studentUserId: studentId,
          status: "ACTIVE",
        },
      });
      enrolledResults.push(enrollment);
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil mendaftarkan ${enrolledResults.length} peserta ke kelas.`,
      enrolledCount: enrolledResults.length,
      rejectedCount: rejectedIds.length,
      rejectedIds: rejectedIds.length > 0 ? rejectedIds : undefined,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal mendaftarkan peserta kelas." }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireSession(req, {
      requiredRoles: [UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN],
    });
    if (!guard.success) {
      return guard.response;
    }
    const { institutionId } = guard;
    const session = { user: guard.user };
    const { id: classCourseId } = await params;
    const { searchParams } = new URL(req.url);
    const studentUserId = searchParams.get("studentUserId");

    if (!studentUserId) {
      return NextResponse.json({ error: "studentUserId wajib disertakan." }, { status: 400 });
    }

    // Validasi kelas di tenant ini
    const classCourse = await prisma.classCourse.findFirst({
      where: { id: classCourseId, institutionId, deletedAt: null },
    });
    if (!classCourse) {
      return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
    }

    await prisma.classEnrollment.deleteMany({
      where: {
        classCourseId,
        studentUserId,
      },
    });

    return NextResponse.json({ success: true, message: "Peserta berhasil dikeluarkan dari kelas." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal membatalkan pendaftaran siswa." }, { status: 500 });
  }
}
