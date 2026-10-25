import { requireSession } from "@/lib/auth/guard";
import { NextResponse } from "next/server";
import { getQuizzesForClass, createQuiz } from "@/modules/classroom/quiz-service";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) return guard.response;
    const { institutionId, role, user } = guard;
    const { id: classCourseId } = await params;

    const quizzes = await getQuizzesForClass({
      institutionId,
      classCourseId,
      userId: user.id,
      role,
    });

    return NextResponse.json({ quizzes });
  } catch (error: any) {
    console.error("GET quizzes error:", error);
    return NextResponse.json({ error: error.message || "Gagal memuat kuis kelas." }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireSession(req, { requiredFeature: "classroom" });
    if (!guard.success) return guard.response;
    const { institutionId, role } = guard;
    const { id: classCourseId } = await params;
    const body = await req.json();

    const quiz = await createQuiz({
      institutionId,
      classCourseId,
      role,
      input: {
        title: body.title,
        description: body.description,
        durationMinutes: body.durationMinutes ? parseInt(body.durationMinutes) : 30,
        passingScore: body.passingScore ? parseFloat(body.passingScore) : 60,
        status: body.status,
        dueDate: body.dueDate,
        questions: body.questions || [],
      },
    });

    return NextResponse.json({ success: true, quiz });
  } catch (error: any) {
    console.error("POST quiz error:", error);
    const status = error.message?.includes("Akses ditolak") ? 403 : 400;
    return NextResponse.json({ error: error.message || "Gagal membuat kuis." }, { status });
  }
}
