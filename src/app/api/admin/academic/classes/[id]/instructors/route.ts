import { UserRole } from "@prisma/client";
import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

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
    const { instructorUserId, isPrimary = true } = body;

    if (!instructorUserId) {
      return NextResponse.json({ error: "instructorUserId wajib diisi." }, { status: 400 });
    }

    // Pastikan kelas ada di tenant ini
    const classCourse = await prisma.classCourse.findFirst({
      where: { id: classCourseId, institutionId, deletedAt: null },
    });
    if (!classCourse) {
      return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
    }

    // Pastikan user pengajar ada di tenant yang sama
    const instructorUser = await prisma.user.findFirst({
      where: { id: instructorUserId, institutionId, deletedAt: null },
    });
    if (!instructorUser) {
      return NextResponse.json({ error: "Pengajar tidak ditemukan di institusi ini." }, { status: 404 });
    }

    // Upsert penugasan
    const assignment = await prisma.classInstructor.upsert({
      where: {
        classCourseId_instructorUserId: {
          classCourseId,
          instructorUserId,
        },
      },
      update: {
        isPrimary: Boolean(isPrimary),
      },
      create: {
        classCourseId,
        instructorUserId,
        isPrimary: Boolean(isPrimary),
      },
      include: {
        instructor: { select: { id: true, fullName: true } },
      },
    });

    return NextResponse.json({ success: true, assignment });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal menugaskan pengajar." }, { status: 500 });
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
    const instructorUserId = searchParams.get("instructorUserId");

    if (!instructorUserId) {
      return NextResponse.json({ error: "instructorUserId wajib disertakan." }, { status: 400 });
    }

    // Validasi kelas di tenant ini
    const classCourse = await prisma.classCourse.findFirst({
      where: { id: classCourseId, institutionId, deletedAt: null },
    });
    if (!classCourse) {
      return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
    }

    await prisma.classInstructor.deleteMany({
      where: {
        classCourseId,
        instructorUserId,
      },
    });

    return NextResponse.json({ success: true, message: "Penugasan pengajar berhasil dihapus." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal menghapus penugasan pengajar." }, { status: 500 });
  }
}
