"use client";

import React, { useState, useEffect } from "react";
import {
  FileQuestion,
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Award,
  Loader2,
  Trash2,
  Check,
} from "lucide-react";

interface QuizQuestion {
  id: string;
  questionText: string;
  options: string[];
  points: number;
  orderIndex: number;
  correctOptionIndex?: number;
}

interface QuizAttempt {
  id: string;
  studentUserId: string;
  score: number;
  submittedAt: string;
  student?: {
    id: string;
    fullName: string;
  };
}

interface Quiz {
  id: string;
  title: string;
  description?: string | null;
  durationMinutes: number;
  passingScore: number;
  status: "DRAFT" | "PUBLISHED";
  dueDate?: string | null;
  questions: QuizQuestion[];
  myAttempt?: QuizAttempt | null;
  attempts?: QuizAttempt[];
}

interface QuizzesSectionProps {
  classCourseId: string;
  isInstructor: boolean;
  currentUserId: string;
}

export function QuizzesSection({
  classCourseId,
  isInstructor,
  currentUserId,
}: QuizzesSectionProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal Create Quiz (Teacher)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [passingScore, setPassingScore] = useState(60);
  const [questions, setQuestions] = useState([
    {
      questionText: "",
      options: ["", "", "", ""],
      correctOptionIndex: 0,
      points: 50,
    },
  ]);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);

  // Active Quiz Modal (Student Runner)
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [studentAnswers, setStudentAnswers] = useState<Record<string, number>>({});
  const [submittingAttempt, setSubmittingAttempt] = useState(false);
  const [attemptResult, setAttemptResult] = useState<{ score: number; isPassed: boolean } | null>(null);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/classroom/classes/${classCourseId}/quizzes`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal memuat kuis.");
      }
      const data = await res.json();
      setQuizzes(data.quizzes || []);
    } catch (err: any) {
      setError(err.message || "Gagal memuat kuis.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, [classCourseId]);

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        questionText: "",
        options: ["", "", "", ""],
        correctOptionIndex: 0,
        points: 50,
      },
    ]);
  };

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return alert("Judul kuis wajib diisi.");

    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].questionText.trim()) {
        return alert(`Pertanyaan nomor ${i + 1} belum diisi.`);
      }
      for (let j = 0; j < 4; j++) {
        if (!questions[i].options[j]?.trim()) {
          return alert(`Pilihan ${j + 1} pada nomor ${i + 1} belum diisi.`);
        }
      }
    }

    try {
      setSubmittingQuiz(true);
      const res = await fetch(`/api/classroom/classes/${classCourseId}/quizzes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          durationMinutes,
          passingScore,
          status: "PUBLISHED",
          questions,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal membuat kuis.");
      }

      setShowCreateModal(false);
      setTitle("");
      setDescription("");
      setQuestions([
        {
          questionText: "",
          options: ["", "", "", ""],
          correctOptionIndex: 0,
          points: 50,
        },
      ]);
      await fetchQuizzes();
    } catch (err: any) {
      alert(err.message || "Gagal membuat kuis.");
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const handleSubmitAttempt = async () => {
    if (!activeQuiz) return;
    try {
      setSubmittingAttempt(true);
      const res = await fetch(`/api/classroom/quizzes/${activeQuiz.id}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: studentAnswers }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal mengumpulkan kuis.");
      }

      const data = await res.json();
      setAttemptResult({ score: data.score, isPassed: data.isPassed });
      await fetchQuizzes();
    } catch (err: any) {
      alert(err.message || "Gagal mengumpulkan jawaban.");
    } finally {
      setSubmittingAttempt(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-[var(--tenant-accent,#1E40AF)] flex items-center justify-center">
            <FileQuestion className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-xs text-[#0F172A] uppercase tracking-wide">
              Kuis & Evaluasi Online
            </h3>
            <p className="text-xs text-slate-500">Ujian berbasis komputer dengan penilaian otomatis</p>
          </div>
        </div>

        {isInstructor && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="h-8 px-3.5 bg-[var(--tenant-accent,#1E40AF)] hover:opacity-95 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Buat Kuis Pilihan Ganda</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--tenant-accent,#1E40AF)]" />
          <span>Memuat daftar kuis...</span>
        </div>
      ) : quizzes.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 text-center text-slate-500 text-xs">
          Belum ada kuis online untuk kelas ini.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quizzes.map((quiz) => {
            const hasAttempt = Boolean(quiz.myAttempt);
            return (
              <div
                key={quiz.id}
                className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[#0F172A]">{quiz.title}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[var(--tenant-accent,#1E40AF)] border border-blue-200">
                      {quiz.questions.length} Soal
                    </span>
                  </div>

                  {quiz.description && (
                    <p className="text-xs text-slate-600 line-clamp-2">{quiz.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{quiz.durationMinutes} Menit</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-slate-400" />
                      <span>KKM: {quiz.passingScore}</span>
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  {!isInstructor ? (
                    hasAttempt ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs text-slate-500">Skor Anda:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-[#0F172A]">
                            {quiz.myAttempt?.score} / 100
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              (quiz.myAttempt?.score || 0) >= quiz.passingScore
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                            }`}
                          >
                            {(quiz.myAttempt?.score || 0) >= quiz.passingScore ? "LULUS" : "REMEDIAL"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveQuiz(quiz);
                          setStudentAnswers({});
                          setAttemptResult(null);
                        }}
                        className="w-full h-8 px-4 bg-[var(--tenant-accent,#1E40AF)] hover:opacity-95 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Mulai Kerjakan Kuis</span>
                      </button>
                    )
                  ) : (
                    <div className="text-xs text-slate-500 flex items-center justify-between w-full">
                      <span>Sudah Dikerjakan:</span>
                      <span className="font-bold text-[#0F172A]">{quiz.attempts?.length || 0} Mahasiswa</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL STUDENT QUIZ RUNNER */}
      {activeQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-[#0F172A]">{activeQuiz.title}</h3>
                <p className="text-xs text-slate-500">Pilihlah satu jawaban yang paling tepat</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveQuiz(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {attemptResult ? (
              <div className="p-6 text-center space-y-4">
                <div
                  className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center text-2xl font-bold ${
                    attemptResult.isPassed
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {attemptResult.score}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#0F172A]">
                    {attemptResult.isPassed ? "Selamat! Anda Lulus Kuis" : "Hasil Kuis Anda"}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Skor akhir: {attemptResult.score} / 100 (Batas kelulusan: {activeQuiz.passingScore})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveQuiz(null)}
                  className="px-5 py-2 bg-[var(--tenant-accent,#1E40AF)] text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  Selesai
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {activeQuiz.questions.map((q, idx) => (
                  <div key={q.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-xs text-[var(--tenant-accent,#1E40AF)]">
                        Soal {idx + 1}.
                      </span>
                      <p className="text-xs font-medium text-[#0F172A]">{q.questionText}</p>
                    </div>

                    <div className="space-y-2 pl-4">
                      {q.options.map((opt, optIdx) => (
                        <label
                          key={optIdx}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                            studentAnswers[q.id] === optIdx
                              ? "bg-blue-50 border-[var(--tenant-accent,#1E40AF)] font-semibold text-[var(--tenant-accent,#1E40AF)]"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question-${q.id}`}
                            checked={studentAnswers[q.id] === optIdx}
                            onChange={() => setStudentAnswers({ ...studentAnswers, [q.id]: optIdx })}
                            className="text-[var(--tenant-accent,#1E40AF)]"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    Terjawab: {Object.keys(studentAnswers).length} dari {activeQuiz.questions.length} soal
                  </span>
                  <button
                    type="button"
                    onClick={handleSubmitAttempt}
                    disabled={submittingAttempt || Object.keys(studentAnswers).length === 0}
                    className="h-9 px-5 bg-[var(--tenant-accent,#1E40AF)] hover:opacity-95 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {submittingAttempt && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Kirim Jawaban Kuis</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL TEACHER CREATE QUIZ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-[#0F172A]">Buat Kuis Pilihan Ganda Baru</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuiz} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Judul Kuis</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Mis. Kuis 2: Pengujian Perangkat Lunak"
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-[#0F172A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Durasi (Menit)</label>
                  <input
                    type="number"
                    min={5}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 15)}
                    className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Batas Kelulusan (KKM)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={passingScore}
                    onChange={(e) => setPassingScore(parseFloat(e.target.value) || 60)}
                    className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="font-bold text-xs text-[#0F172A]">Daftar Soal ({questions.length})</h4>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="text-xs font-semibold text-[var(--tenant-accent,#1E40AF)] hover:underline"
                  >
                    + Tambah Soal
                  </button>
                </div>

                {questions.map((q, qIndex) => (
                  <div key={qIndex} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-700">Nomor {qIndex + 1}</span>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setQuestions(questions.filter((_, i) => i !== qIndex))}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          Hapus
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      required
                      value={q.questionText}
                      onChange={(e) => {
                        const copy = [...questions];
                        copy[qIndex].questionText = e.target.value;
                        setQuestions(copy);
                      }}
                      placeholder="Tuliskan pertanyaan soal..."
                      className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded text-xs"
                    />

                    <div className="space-y-1.5 pl-2">
                      <span className="text-[11px] text-slate-500 block font-medium">Pilihan Jawaban (Tandai Kunci Jawaban):</span>
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${qIndex}`}
                            checked={q.correctOptionIndex === optIdx}
                            onChange={() => {
                              const copy = [...questions];
                              copy[qIndex].correctOptionIndex = optIdx;
                              setQuestions(copy);
                            }}
                            title="Tandai sebagai kunci jawaban"
                          />
                          <input
                            type="text"
                            required
                            value={opt}
                            onChange={(e) => {
                              const copy = [...questions];
                              copy[qIndex].options[optIdx] = e.target.value;
                              setQuestions(copy);
                            }}
                            placeholder={`Pilihan ${String.fromCharCode(65 + optIdx)}`}
                            className="flex-1 h-7 px-2.5 bg-white border border-slate-300 rounded text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="h-8 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingQuiz}
                  className="h-8 px-4 bg-[var(--tenant-accent,#1E40AF)] hover:opacity-95 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  {submittingQuiz && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                  <span>Simpan & Publikasikan Kuis</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
