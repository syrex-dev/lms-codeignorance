import { UserRole } from "@prisma/client";
import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { AcademicService } from "@/modules/academic/academic-service";

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
        { error: "Akses ditolak: Hanya Admin Institusi yang dapat menghapus tahun akademik." },
        { status: 403 }
      );
    }

        if (!institutionId) {
      return NextResponse.json({ error: "Institusi aktif tidak ditemukan." }, { status: 400 });
    }

    const resolvedParams = await params;
    const termId = resolvedParams.id;

    await AcademicService.safeDeleteTerm(institutionId, termId);

    return NextResponse.json({ success: true, message: "Tahun akademik berhasil dihapus." });
  } catch (error: any) {
    console.error("DELETE /api/admin/academic/terms/[id] error:", error);
    return NextResponse.json({ error: error.message || "Gagal menghapus tahun akademik." }, { status: 400 });
  }
}
