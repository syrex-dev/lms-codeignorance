import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { createTopic, reorderTopics } from "@/modules/classroom/classroom-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
    }

    const { id: classCourseId } = await params;
    const institutionId = session.user.activeInstitutionId || (session.user as any).tenantId;
    if (!institutionId) {
      return NextResponse.json({ error: "Tenant context required." }, { status: 400 });
    }

    const role = (session.user as any).activeRole || (session.user as any).role;
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
