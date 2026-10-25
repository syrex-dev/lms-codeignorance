import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { deleteAnnouncement } from "@/modules/classroom/announcement-service";

export async function DELETE(req: Request, { params }: { params: Promise<{ announcementId: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) return guard.response;
    const { institutionId, role, user } = guard;
    const { announcementId } = await params;

    await deleteAnnouncement({
      institutionId,
      announcementId,
      userId: user.id,
      role,
    });

    return NextResponse.json({ success: true, message: "Pengumuman berhasil dihapus." });
  } catch (error: any) {
    console.error("DELETE announcement error:", error);
    const status = error.message?.includes("Akses ditolak") ? 403 : 500;
    return NextResponse.json({ error: error.message || "Gagal menghapus pengumuman." }, { status });
  }
}
