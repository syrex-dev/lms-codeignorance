import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { updateTopic, deleteTopic } from "@/modules/classroom/classroom-service";

export async function PATCH(req: Request, { params }: { params: Promise<{ topicId: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) {
      return guard.response;
    }
    const session = { user: guard.user };
    const institutionId = guard.institutionId;
    const role = guard.role;

    const { topicId } = await params;
    

    
    const body = await req.json();

    const updated = await updateTopic({
      institutionId,
      topicId,
      userId: session.user.id,
      role,
      input: body,
    });

    return NextResponse.json({ success: true, topic: updated });
  } catch (error: any) {
    console.error("PATCH /api/classroom/topics/[topicId] error:", error);
    const status = error.message?.includes("Akses ditolak") ? 403 : 500;
    return NextResponse.json({ error: error.message || "Gagal memperbarui topik." }, { status });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ topicId: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) {
      return guard.response;
    }
    const session = { user: guard.user };
    const institutionId = guard.institutionId;
    const role = guard.role;

    const { topicId } = await params;
    

    

    await deleteTopic({
      institutionId,
      topicId,
      userId: session.user.id,
      role,
    });

    return NextResponse.json({ success: true, message: "Topik berhasil dihapus." });
  } catch (error: any) {
    console.error("DELETE /api/classroom/topics/[topicId] error:", error);
    const status = error.message?.includes("Akses ditolak") ? 403 : 500;
    return NextResponse.json({ error: error.message || "Gagal menghapus topik." }, { status });
  }
}
