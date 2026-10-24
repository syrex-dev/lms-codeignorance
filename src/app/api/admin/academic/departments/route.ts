import { UserRole } from "@prisma/client";
import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: Request) {
  try {
    const guard = await requireSession(req, {
      requiredRoles: [UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN],
    });
    if (!guard.success) {
      return guard.response;
    }
    const { institutionId } = guard;
    const session = { user: guard.user };const departments = await prisma.programDepartment.findMany({
      where: { institutionId, deletedAt: null },
      orderBy: { code: "asc" },
      include: {
        _count: {
          select: {
            studentProfiles: true,
            classCourses: true,
          },
        },
      },
    });

    return NextResponse.json({ departments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal memuat jurusan/prodi." }, { status: 500 });
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
        { error: "Akses ditolak: Hanya Admin Institusi yang dapat menambah prodi/jurusan." },
        { status: 403 }
      );
    }

        if (!institutionId) {
      return NextResponse.json({ error: "Institusi aktif tidak ditemukan." }, { status: 400 });
    }

    const body = await req.json();
    const { code, name, facultyName, degreeLevel } = body;

    if (!code || !name) {
      return NextResponse.json({ error: "Kode dan nama wajib diisi." }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();
    const existing = await prisma.programDepartment.findFirst({
      where: { institutionId, code: cleanCode, deletedAt: null },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Jurusan/Prodi dengan kode "${cleanCode}" sudah ada.` },
        { status: 400 }
      );
    }

    const department = await prisma.programDepartment.create({
      data: {
        institutionId,
        code: cleanCode,
        name: name.trim(),
        facultyName: facultyName?.trim() || null,
        degreeLevel: degreeLevel?.trim() || null,
      },
    });

    return NextResponse.json({ success: true, department });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal membuat prodi/jurusan." }, { status: 500 });
  }
}
