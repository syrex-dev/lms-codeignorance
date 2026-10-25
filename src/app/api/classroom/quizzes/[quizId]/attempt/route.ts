import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { submitQuizAttempt } from "@/modules/classroom/quiz-service";

export async function POST(req: Request, { params }: { params: Promise<{ quizId: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) return guard.response;
    const { institutionId, user } = guard;
    const { quizId } = await params;
    const body = await req.json();

    const result = await submitQuizAttempt({
      institutionId,
      quizId,
      studentUserId: user.id,
      answers: body.answers || {},
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("POST quiz attempt error:", error);
    return NextResponse.json({ error: error.message || "Gagal mengumpulkan jawaban kuis." }, { status: 400 });
  }
}
