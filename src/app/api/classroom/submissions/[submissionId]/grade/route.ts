import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { gradeSubmission } from "@/modules/classroom/assignment-service";

export async function POST(req: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) return guard.response;
    const { institutionId, role, user } = guard;
    const { submissionId } = await params;
    const body = await req.json();

    if (body.score === undefined || body.score === null) {
      return NextResponse.json({ error: "Nilai (score) wajib diisi." }, { status: 400 });
    }

    const updated = await gradeSubmission({
      institutionId,
      submissionId,
      graderUserId: user.id,
      role,
      score: parseFloat(body.score),
      feedback: body.feedback,
    });

    return NextResponse.json({ success: true, submission: updated });
  } catch (error: any) {
    console.error("POST grade submission error:", error);
    const status = error.message?.includes("Akses ditolak") ? 403 : 500;
    return NextResponse.json({ error: error.message || "Gagal memberi nilai tugas." }, { status });
  }
}
