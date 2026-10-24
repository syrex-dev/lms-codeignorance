import { UserRole } from "@prisma/client";
import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { AcademicService } from "@/modules/academic/academic-service";

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
        { error: "Akses ditolak: Hanya Admin Institusi yang dapat mengelola data akademik." },
        { status: 403 }
      );
    }

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
