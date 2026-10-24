import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { getClassroomDetail } from "@/modules/classroom/classroom-service";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) {
      return guard.response;
    }
    const { institutionId, role, user } = guard;
    const session = { user };
    const { searchParams } = new URL(req.url);
    const isPreview = searchParams.get("preview") === "true";
    const { id: classCourseId } = await params;

    const detail = await getClassroomDetail({
      institutionId,
      classCourseId,
      userId: session.user.id,
      role,
      isPreviewAsStudent: isPreview,
    });

    if (!detail) {
      // 404 agar penyerang tidak dapat menebak keberadaan ID kelas
      return NextResponse.json(
        { error: "Kelas tidak ditemukan atau Anda tidak memiliki akses ke kelas ini." },
        { status: 404 }
      );
    }

    return NextResponse.json({ classDetail: detail });
  } catch (error: any) {
    console.error("GET /api/classroom/classes/[id] error:", error);
    const status = error.message?.includes("tidak aktif") || error.message?.includes("Fitur") ? 403 : 500;
    return NextResponse.json({ error: error.message || "Gagal memuat detail kelas." }, { status });
  }
}
