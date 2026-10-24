import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { createTopic, reorderTopics } from "@/modules/classroom/classroom-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) {
      return guard.response;
    }
    const { institutionId, role, user } = guard;
    const session = { user };
    const { id: classCourseId } = await params;
    const body = await req.json();

    // Reorder mode
    if (body.topicIds && Array.isArray(body.topicIds)) {
      await reorderTopics({
        institutionId,
        classCourseId,
        topicIds: body.topicIds,
        userId: session.user.id,
        role,
      });
      return NextResponse.json({ success: true, message: "Urutan topik berhasil diperbarui." });
    }

    // Create topic mode
    if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "Judul topik wajib diisi." }, { status: 400 });
    }

    const topic = await createTopic({
      institutionId,
      classCourseId,
      userId: session.user.id,
      role,
      input: {
        title: body.title,
        description: body.description,
        meetingNumber: body.meetingNumber ? parseInt(body.meetingNumber, 10) : undefined,
        status: body.status,
        publishAt: body.publishAt,
      },
    });

    return NextResponse.json({ success: true, topic });
  } catch (error: any) {
    console.error("POST /api/classroom/classes/[id]/topics error:", error);
    const status = error.message?.includes("Akses ditolak") ? 403 : 500;
    return NextResponse.json({ error: error.message || "Gagal membuat topik." }, { status });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) return guard.response;
    const { institutionId, role, user } = guard;
    const { id: classCourseId } = await params;
    const body = await req.json();

    if (body.topicIds && Array.isArray(body.topicIds)) {
      await reorderTopics({
        institutionId,
        classCourseId,
        topicIds: body.topicIds,
        userId: user.id,
        role,
      });
      return NextResponse.json({ success: true, message: "Urutan topik berhasil diperbarui." });
    }

    return NextResponse.json({ error: "topicIds array wajib disediakan." }, { status: 400 });
  } catch (error: any) {
    const status = error.message?.includes("Akses ditolak") ? 403 : 500;
    return NextResponse.json({ error: error.message || "Gagal mengubah urutan topik." }, { status });
  }
}
