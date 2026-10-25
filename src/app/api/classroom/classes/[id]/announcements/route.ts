import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { getAnnouncementsForClass, createAnnouncement } from "@/modules/classroom/announcement-service";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) return guard.response;
    const { institutionId } = guard;
    const { id: classCourseId } = await params;

    const announcements = await getAnnouncementsForClass({
      institutionId,
      classCourseId,
    });

    return NextResponse.json({ announcements });
  } catch (error: any) {
    console.error("GET announcements error:", error);
    return NextResponse.json({ error: error.message || "Gagal memuat pengumuman kelas." }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) return guard.response;
    const { institutionId, role, user } = guard;
    const { id: classCourseId } = await params;
    const body = await req.json();

    const announcement = await createAnnouncement({
      institutionId,
      classCourseId,
      authorUserId: user.id,
      role,
      input: {
        title: body.title,
        content: body.content,
        isPinned: body.isPinned,
      },
    });

    return NextResponse.json({ success: true, announcement });
  } catch (error: any) {
    console.error("POST announcement error:", error);
    const status = error.message?.includes("Akses ditolak") ? 403 : 400;
    return NextResponse.json({ error: error.message || "Gagal membuat pengumuman." }, { status });
  }
}
