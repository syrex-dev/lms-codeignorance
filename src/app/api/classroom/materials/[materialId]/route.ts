import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { updateMaterial, deleteMaterial } from "@/modules/classroom/classroom-service";

export async function PATCH(req: Request, { params }: { params: Promise<{ materialId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const { materialId } = await params;
    const institutionId = session.user.activeInstitutionId || (session.user as any).tenantId;
    if (!institutionId) {
      return NextResponse.json({ error: "Tenant context required." }, { status: 400 });
    }

    const role = (session.user as any).activeRole || (session.user as any).role;
    const body = await req.json();

    const updated = await updateMaterial({
      institutionId,
      materialId,
      userId: session.user.id,
      role,
      input: body,
    });

    return NextResponse.json({ success: true, material: updated });
  } catch (error: any) {
    console.error("PATCH /api/classroom/materials/[materialId] error:", error);
    const status = error.message?.includes("Akses ditolak") ? 403 : 500;
    return NextResponse.json({ error: error.message || "Gagal memperbarui materi." }, { status });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ materialId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const { materialId } = await params;
    const institutionId = session.user.activeInstitutionId || (session.user as any).tenantId;
    if (!institutionId) {
      return NextResponse.json({ error: "Tenant context required." }, { status: 400 });
    }

    const role = (session.user as any).activeRole || (session.user as any).role;

    await deleteMaterial({
      institutionId,
      materialId,
      userId: session.user.id,
      role,
    });

    return NextResponse.json({ success: true, message: "Materi berhasil dihapus." });
  } catch (error: any) {
    console.error("DELETE /api/classroom/materials/[materialId] error:", error);
    const status = error.message?.includes("Akses ditolak") ? 403 : 500;
    return NextResponse.json({ error: error.message || "Gagal menghapus materi." }, { status });
  }
}
