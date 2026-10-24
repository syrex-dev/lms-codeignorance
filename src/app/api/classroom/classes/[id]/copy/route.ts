import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { copyClassroomContent } from "@/modules/classroom/classroom-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) {
      return guard.response;
    }
    const { institutionId, role, user } = guard;
    const session = { user };
    const { id: targetClassCourseId } = await params;
    const body = await req.json();

    if (!body.sourceClassCourseId) {
      return NextResponse.json({ error: "ID kelas sumber (sourceClassCourseId) wajib disediakan." }, { status: 400 });
    }

    const result = await copyClassroomContent({
      institutionId,
      sourceClassCourseId: body.sourceClassCourseId,
      targetClassCourseId,
      userId: session.user.id,
      role,
      includeDrafts: body.includeDrafts,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("POST /api/classroom/classes/[id]/copy error:", error);
    const status = error.message?.includes("Akses ditolak") ? 403 : 500;
    return NextResponse.json({ error: error.message || "Gagal menyalin konten kelas." }, { status });
  }
}
