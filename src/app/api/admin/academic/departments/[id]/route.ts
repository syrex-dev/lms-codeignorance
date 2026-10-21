import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { AcademicService } from "@/modules/academic/academic-service";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const role = (session.user as any).activeRole || (session.user as any).role;
    if (role !== "INSTITUTION_ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Akses ditolak: Hanya Admin Institusi yang dapat menghapus data akademik." },
        { status: 403 }
      );
    }

    const institutionId = session.user.activeInstitutionId;
    if (!institutionId) {
      return NextResponse.json({ error: "Institusi aktif tidak ditemukan." }, { status: 400 });
    }

    const resolvedParams = await params;
    const departmentId = resolvedParams.id;

    await AcademicService.safeDeleteDepartment(institutionId, departmentId);

    return NextResponse.json({ success: true, message: "Jurusan/Prodi berhasil dihapus." });
  } catch (error: any) {
    console.error("DELETE /api/admin/academic/departments/[id] error:", error);
    return NextResponse.json({ error: error.message || "Gagal menghapus jurusan/prodi." }, { status: 400 });
  }
}
