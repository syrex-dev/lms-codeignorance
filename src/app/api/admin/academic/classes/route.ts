import { UserRole } from "@prisma/client";
import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";

export async function GET(req: Request) {
  try {
    const guard = await requireSession(req, {
      requiredRoles: [UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN],
    });
    if (!guard.success) {
      return guard.response;
    }
    const { institutionId } = guard;
    const session = { user: guard.user };const { searchParams } = new URL(req.url);
    const academicTermId = searchParams.get("academicTermId") || undefined;
    const programDepartmentId = searchParams.get("programDepartmentId") || undefined;

    const where: any = {
      institutionId,
      deletedAt: null,
    };
    if (academicTermId) where.academicTermId = academicTermId;
    if (programDepartmentId) where.programDepartmentId = programDepartmentId;

    // RBAC: Jika pengguna adalah TEACHER/DOSEN, filter hanya kelas yang diampu!
    const userRole = (session.user as any).activeRole || (session.user as any).role;
    if (userRole === "TEACHER") {
      where.instructors = {
        some: {
          instructorUserId: session.user.id,
        },
      };
    }

    const classes = await withTenantTransaction(institutionId, async (tenantDb) => tenantDb.classCourse.findMany({
      where,
      orderBy: { code: "asc" },
      include: {
        academicTerm: { select: { id: true, name: true, code: true } },
        programDepartment: { select: { id: true, name: true, code: true } },
        instructors: {
          include: {
            instructor: { select: { id: true, fullName: true } },
          },
        },
        _count: {
          select: { enrollments: true },
        },
      },
    }));

    return NextResponse.json({ classes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal memuat daftar kelas." }, { status: 500 });
  }
}

export async function POST(req: Request) {
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
        { error: "Akses ditolak: Hanya Admin Institusi yang dapat membuat kelas/mata kuliah." },
        { status: 403 }
      );
    }

        if (!institutionId) {
      return NextResponse.json({ error: "Institusi aktif tidak ditemukan." }, { status: 400 });
    }

    const body = await req.json();
    const {
      academicTermId,
      programDepartmentId,
      code,
      name,
      credits,
      roomName,
      instructorUserId,
    } = body;

    if (!academicTermId || !code || !name) {
      return NextResponse.json(
        { error: "Tahun akademik, kode kelas, dan nama wajib diisi." },
        { status: 400 }
      );
    }

    const classCourse = await prisma.classCourse.create({
      data: {
        institutionId,
        academicTermId,
        programDepartmentId: programDepartmentId || null,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        credits: credits ? parseInt(credits, 10) : 3,
        roomName: roomName?.trim() || null,
        instructors: instructorUserId
          ? {
              create: {
                instructorUserId,
                isPrimary: true,
              },
            }
          : undefined,
      },
      include: {
        instructors: {
          include: { instructor: { select: { fullName: true } } },
        },
      },
    });

    return NextResponse.json({ success: true, classCourse });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal membuat kelas." }, { status: 500 });
  }
}
