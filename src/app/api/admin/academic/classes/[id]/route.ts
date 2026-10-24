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
    if (!institutionId) {
      return NextResponse.json({ error: "Institusi aktif tidak ditemukan." }, { status: 400 });
    }

    const { id } = await params;
    const classCourse = await prisma.classCourse.findFirst({
      where: { id, institutionId, deletedAt: null },
      include: {
        academicTerm: true,
        programDepartment: true,
        instructors: {
          include: {
            instructor: { select: { id: true, fullName: true, contactEmail: true } },
          },
        },
        enrollments: {
          include: {
            student: { select: { id: true, fullName: true, identifiers: true } },
          },
        },
      },
    });

    if (!classCourse) {
      return NextResponse.json({ error: "Kelas atau mata pelajaran tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ classCourse });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal memuat detail kelas." }, { status: 500 });
  }
}

export async function PATCH(
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
    const session = { user: guard.user };const role = (session.user as any).activeRole || (session.user as any).role;
    if (role !== "INSTITUTION_ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Akses ditolak: Hanya Admin Institusi yang dapat memperbarui kelas." },
        { status: 403 }
      );
    }

        const { id } = await params;
    const body = await req.json();

    const existing = await prisma.classCourse.findFirst({
      where: { id, institutionId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
    }

    const updated = await prisma.classCourse.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        code: body.code ?? existing.code,
        credits: body.credits !== undefined ? (body.credits ? parseInt(body.credits, 10) : null) : existing.credits,
        roomName: body.roomName !== undefined ? body.roomName : existing.roomName,
        isArchived: body.isArchived !== undefined ? Boolean(body.isArchived) : existing.isArchived,
        description: body.description !== undefined ? body.description : existing.description,
      },
    });

    return NextResponse.json({ success: true, classCourse: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal memperbarui kelas." }, { status: 500 });
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
    const session = { user: guard.user };const role = (session.user as any).activeRole || (session.user as any).role;
    if (role !== "INSTITUTION_ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Akses ditolak: Hanya Admin Institusi yang dapat menghapus kelas." },
        { status: 403 }
      );
    }

        const { id } = await params;

    const existing = await prisma.classCourse.findFirst({
      where: { id, institutionId, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
    }

    await prisma.classCourse.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: "Kelas berhasil dihapus (soft delete)." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal menghapus kelas." }, { status: 500 });
  }
}
