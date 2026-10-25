"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import {
  Award,
  BookOpen,
  CheckCircle2,
  TrendingUp,
  GraduationCap,
  AlertCircle,
  Loader2,
  Calendar,
  FileSpreadsheet,
} from "lucide-react";

interface CourseGrade {
  id: string;
  code: string;
  name: string;
  credits: number;
  assignmentAverage: number;
  quizAverage: number;
  attendancePercentage: number;
  finalScore: number;
  letterGrade: string;
}

export default function StudentGradesPage() {
  const params = useParams();
  const tenantSlug = params.tenant as string;
  const { data: session } = useSession();

  const [courses, setCourses] = useState<CourseGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGrades() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/classroom/grades");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Gagal memuat rekap nilai.");
        }
        const data = await res.json();
        setCourses(data.courses || []);
      } catch (err: any) {
        setError(err.message || "Gagal memuat rekap nilai.");
      } finally {
        setLoading(false);
      }
    }
    fetchGrades();
  }, []);

  const totalCredits = courses.reduce((sum, c) => sum + (c.credits || 3), 0);
  const weightedScoreSum = courses.reduce((sum, c) => sum + c.finalScore * (c.credits || 3), 0);
  const gpaScore = totalCredits > 0 ? Math.round((weightedScoreSum / totalCredits) * 10) / 10 : 0;

  const getBadgeStyle = (grade: string) => {
    switch (grade) {
      case "A":
        return "bg-emerald-50 text-emerald-700 border-emerald-200/80";
      case "AB":
        return "bg-teal-50 text-teal-700 border-teal-200/80";
      case "B":
        return "bg-blue-50 text-blue-700 border-blue-200/80";
      case "BC":
        return "bg-indigo-50 text-indigo-700 border-indigo-200/80";
      case "C":
        return "bg-amber-50 text-amber-700 border-amber-200/80";
      case "D":
        return "bg-orange-50 text-orange-700 border-orange-200/80";
      default:
        return "bg-red-50 text-red-700 border-red-200/80";
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full pb-10">
      <PageHeader
        title="Transkrip & Buku Nilai"
        description="Ringkasan capaian akademik, evaluasi tugas, kuis online, dan persentase kehadiran seluruh mata kuliah."
      />

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Rata-Rata Nilai Kumulatif</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-[#0F172A]">{gpaScore} / 100</div>
          <p className="text-[11px] text-slate-500">Bobot gabungan tugas, kuis & presensi</p>
        </div>

        <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Beban Studi (SKS)</span>
            <BookOpen className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-[#0F172A]">{totalCredits} SKS</div>
          <p className="text-[11px] text-slate-500">{courses.length} Mata Kuliah Terdaftar</p>
        </div>

        <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Status Kelulusan Kelas</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {courses.filter((c) => c.finalScore >= 60).length} / {courses.length} Lulus
          </div>
          <p className="text-[11px] text-slate-500">Batas kelulusan minimum: Nilai C (50)</p>
        </div>
      </div>

      {/* Grades Table Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[var(--tenant-accent,#1E40AF)] flex items-center justify-center">
              <Award className="w-4 h-4" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A]">Daftar Nilai Mata Kuliah</h2>
              <p className="text-xs text-slate-500">Rekapitulasi otomatis berdasarkan riwayat pengerjaan tugas & evaluasi</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--tenant-accent,#1E40AF)]" />
            <span>Memuat data transkrip nilai...</span>
          </div>
        ) : courses.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            Belum ada data mata kuliah atau penilaian untuk akun ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="px-5 py-3.5">Kode & Mata Kuliah</th>
                  <th className="px-4 py-3.5 text-center">SKS</th>
                  <th className="px-4 py-3.5 text-center">Presensi (%)</th>
                  <th className="px-4 py-3.5 text-center">Rata-Rata Tugas</th>
                  <th className="px-4 py-3.5 text-center">Rata-Rata Kuis</th>
                  <th className="px-4 py-3.5 text-center">Nilai Akhir</th>
                  <th className="px-5 py-3.5 text-center">Predikat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {courses.map((course) => (
                  <tr key={course.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-[#0F172A]">{course.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">{course.code}</div>
                    </td>
                    <td className="px-4 py-4 text-center font-medium text-slate-700">{course.credits}</td>
                    <td className="px-4 py-4 text-center font-medium text-slate-700">
                      <span className={course.attendancePercentage >= 75 ? "text-emerald-700" : "text-amber-700 font-bold"}>
                        {course.attendancePercentage}%
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center font-mono font-medium text-slate-700">{course.assignmentAverage}</td>
                    <td className="px-4 py-4 text-center font-mono font-medium text-slate-700">{course.quizAverage}</td>
                    <td className="px-4 py-4 text-center font-mono font-bold text-sm text-[#0F172A]">
                      {course.finalScore}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`inline-block px-3 py-1 text-xs font-bold rounded-lg border ${getBadgeStyle(
                          course.letterGrade
                        )}`}
                      >
                        {course.letterGrade}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
