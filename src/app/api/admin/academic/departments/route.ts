import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const institutionId = session.user.activeInstitutionId;
    if (!institutionId) {
      return NextResponse.json({ error: "Institusi aktif tidak ditemukan." }, { status: 400 });
    }

    const departments = await prisma.programDepartment.findMany({
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const role = (session.user as any).activeRole || (session.user as any).role;
    if (role !== "INSTITUTION_ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Akses ditolak: Hanya Admin Institusi yang dapat menambah prodi/jurusan." },
        { status: 403 }
      );
    }

    const institutionId = session.user.activeInstitutionId;
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
