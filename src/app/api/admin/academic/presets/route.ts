import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { AcademicService } from "@/modules/academic/academic-service";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const role = (session.user as any).activeRole || (session.user as any).role;
    if (role !== "INSTITUTION_ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Akses ditolak: Hanya Admin Institusi yang dapat mengelola data akademik." },
        { status: 403 }
      );
    }

    const institutionId = session.user.activeInstitutionId;
    if (!institutionId) {
      return NextResponse.json({ error: "Institusi aktif tidak ditemukan." }, { status: 400 });
    }

    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      select: { type: true },
    });

    if (!institution) {
      return NextResponse.json({ error: "Institusi tidak ditemukan." }, { status: 404 });
    }

    const result = await AcademicService.loadPresets(institutionId, institution.type);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("POST /api/admin/academic/presets error:", error);
    return NextResponse.json({ error: error.message || "Gagal memuat preset akademik." }, { status: 500 });
  }
}
