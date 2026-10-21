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

    const terms = await prisma.academicTerm.findMany({
      where: { institutionId, deletedAt: null },
      orderBy: { startDate: "desc" },
      include: {
        _count: {
          select: { classCourses: true },
        },
      },
    });

    return NextResponse.json({ terms });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal memuat tahun akademik." }, { status: 500 });
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
        { error: "Akses ditolak: Hanya Admin Institusi yang dapat menambah tahun akademik." },
        { status: 403 }
      );
    }

    const institutionId = session.user.activeInstitutionId;
    if (!institutionId) {
      return NextResponse.json({ error: "Institusi aktif tidak ditemukan." }, { status: 400 });
    }

    const body = await req.json();
    const { name, code, type, startDate, endDate, isActive } = body;

    if (!name || !code || !startDate || !endDate) {
      return NextResponse.json({ error: "Semua kolom wajib diisi." }, { status: 400 });
    }

    // Jika isActive true, nonaktifkan term lain
    if (isActive) {
      await prisma.academicTerm.updateMany({
        where: { institutionId, isActive: true },
        data: { isActive: false },
      });
    }

    const term = await prisma.academicTerm.create({
      data: {
        institutionId,
        name: name.trim(),
        code: code.trim(),
        type: type || "SEMESTER_ODD",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: Boolean(isActive),
      },
    });

    return NextResponse.json({ success: true, term });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal membuat tahun akademik." }, { status: 500 });
  }
}
