import { withTenantTransaction } from "@/lib/db/tenant-prisma";

export interface CreateQuizInput {
  title: string;
  description?: string;
  durationMinutes?: number;
  passingScore?: number;
  dueDate?: string | Date;
  status?: "DRAFT" | "PUBLISHED";
  questions: Array<{
    questionText: string;
    options: string[];
    correctOptionIndex: number;
    points?: number;
  }>;
}

export async function getQuizzesForClass({
  institutionId,
  classCourseId,
  userId,
  role,
}: {
  institutionId: string;
  classCourseId: string;
  userId: string;
  role: string;
}) {
  const isInstructorOrAdmin =
    ["INSTRUCTOR", "LECTURER", "TEACHER", "ADMIN", "SUPERADMIN", "PLATFORM_ADMIN"].includes(role.toUpperCase());

  return withTenantTransaction(institutionId, async (tx) => {
    const quizzes = await tx.quiz.findMany({
      where: {
        classCourseId,
        ...(isInstructorOrAdmin ? {} : { status: "PUBLISHED" }),
      },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
        },
        attempts: {
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
          orderBy: { submittedAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (isInstructorOrAdmin) {
      return quizzes;
    }

    // Untuk mahasiswa: Sembunyikan correctOptionIndex jika mahasiswa belum mengerjakan kuis
    return quizzes.map((q: any) => {
      const myAttempt = q.attempts.find((a: any) => a.studentUserId === userId);
      const isCompleted = Boolean(myAttempt);

      return {
        ...q,
        myAttempt: myAttempt || null,
        questions: q.questions.map((ques: any) => ({
          id: ques.id,
          questionText: ques.questionText,
          options: ques.options,
          points: ques.points,
          orderIndex: ques.orderIndex,
          // Sembunyikan correctOptionIndex jika belum selesai!
          correctOptionIndex: isCompleted ? ques.correctOptionIndex : undefined,
        })),
        // Mahasiswa hanya boleh melihat attempt milik sendiri
        attempts: myAttempt ? [myAttempt] : [],
      };
    });
  });
}

export async function createQuiz({
  institutionId,
  classCourseId,
  role,
  input,
}: {
  institutionId: string;
  classCourseId: string;
  role: string;
  input: CreateQuizInput;
}) {
  const isInstructorOrAdmin =
    ["INSTRUCTOR", "LECTURER", "TEACHER", "ADMIN", "SUPERADMIN", "PLATFORM_ADMIN"].includes(role.toUpperCase());

  if (!isInstructorOrAdmin) {
    throw new Error("Akses ditolak: Hanya pengajar atau admin yang dapat membuat kuis.");
  }

  const cleanTitle = (input.title || "").trim();
  if (!cleanTitle) {
    throw new Error("Judul kuis wajib diisi.");
  }

  if (!input.questions || input.questions.length === 0) {
    throw new Error("Kuis harus memiliki minimal satu pertanyaan.");
  }

  return withTenantTransaction(institutionId, async (tx) => {
    const quiz = await tx.quiz.create({
      data: {
        institutionId,
        classCourseId,
        title: cleanTitle,
        description: input.description || "",
        durationMinutes: input.durationMinutes || 30,
        passingScore: input.passingScore ?? 60.0,
        status: input.status || "PUBLISHED",
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
      },
    });

    for (let i = 0; i < input.questions.length; i++) {
      const q = input.questions[i];
      await tx.quizQuestion.create({
        data: {
          institutionId,
          quizId: quiz.id,
          questionText: q.questionText,
          options: q.options,
          correctOptionIndex: q.correctOptionIndex,
          points: q.points || 10.0,
          orderIndex: i,
        },
      });
    }

    return tx.quiz.findUnique({
      where: { id: quiz.id },
      include: { questions: { orderBy: { orderIndex: "asc" } } },
    });
  });
}

export async function submitQuizAttempt({
  institutionId,
  quizId,
  studentUserId,
  answers,
}: {
  institutionId: string;
  quizId: string;
  studentUserId: string;
  answers: Record<string, number>; // { [questionId]: selectedIndex }
}) {
  return withTenantTransaction(institutionId, async (tx) => {
    const quiz = await tx.quiz.findUnique({
      where: { id: quizId },
      include: { questions: true },
    });

    if (!quiz) {
      throw new Error("Kuis tidak ditemukan.");
    }

    // Hitung skor otomatis
    let totalPoints = 0;
    let earnedPoints = 0;

    for (const q of quiz.questions) {
      totalPoints += q.points;
      const selectedIndex = answers[q.id];
      if (selectedIndex !== undefined && Number(selectedIndex) === q.correctOptionIndex) {
        earnedPoints += q.points;
      }
    }

    const calculatedScore = totalPoints > 0
      ? Math.round((earnedPoints / totalPoints) * 100 * 10) / 10
      : 0;

    const attempt = await tx.quizAttempt.create({
      data: {
        institutionId,
        quizId,
        studentUserId,
        answers: answers || {},
        score: calculatedScore,
        submittedAt: new Date(),
      },
    });

    return {
      attempt,
      score: calculatedScore,
      passingScore: quiz.passingScore,
      isPassed: calculatedScore >= quiz.passingScore,
    };
  });
}
