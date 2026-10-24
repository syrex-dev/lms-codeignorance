import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { updateMaterial, deleteMaterial } from "@/modules/classroom/classroom-service";

export async function PATCH(req: Request, { params }: { params: Promise<{ materialId: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) {
      return guard.response;
    }
    const session = { user: guard.user };
    const institutionId = guard.institutionId;
    const role = guard.role;

    const { materialId } = await params;
    

    
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
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) {
      return guard.response;
    }
    const session = { user: guard.user };
    const institutionId = guard.institutionId;
    const role = guard.role;

    const { materialId } = await params;
    

    

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
