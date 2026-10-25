"use client";

import React, { useState, useEffect } from "react";
import {
  Award,
  Download,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";

interface StudentGrade {
  studentId: string;
  studentName: string;
  studentIdNumber: string;
  assignmentAverage: number;
  quizAverage: number;
  attendancePercentage: number;
  materialProgressPercentage: number;
  finalScore: number;
  letterGrade: string;
}

interface GradebookData {
  classCourseId: string;
  className: string;
  classCode: string;
  totalStudents: number;
  studentGrades: StudentGrade[];
}

interface GradebookTabProps {
  classCourseId: string;
  isInstructor: boolean;
  currentUserId: string;
}

export function GradebookTab({
  classCourseId,
  isInstructor,
  currentUserId,
}: GradebookTabProps) {
  const [data, setData] = useState<GradebookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGradebook() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/classroom/classes/${classCourseId}/gradebook`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Gagal memuat buku nilai kelas.");
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || "Gagal memuat buku nilai.");
      } finally {
        setLoading(false);
      }
    }
    fetchGradebook();
  }, [classCourseId]);

  const downloadCSV = () => {
    if (!data) return;
    const headers = ["No", "NIM", "Nama Mahasiswa", "Presensi (%)", "Tugas (Rata-rata)", "Kuis (Rata-rata)", "Materi (%)", "Nilai Akhir", "Grade"];
    const rows = data.studentGrades.map((g, idx) => [
      idx + 1,
      `"${g.studentIdNumber}"`,
      `"${g.studentName}"`,
      g.attendancePercentage,
      g.assignmentAverage,
      g.quizAverage,
      g.materialProgressPercentage,
      g.finalScore,
      g.letterGrade,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekap_Nilai_${data.classCode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const myGrade = data?.studentGrades.find((g) => g.studentId === currentUserId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-[var(--tenant-accent,#1E40AF)] flex items-center justify-center">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#0F172A]">Buku Nilai & Rekapitulasi Akademik</h2>
            <p className="text-xs text-slate-500">Agregasi nilai tugas, kuis online, presensi, dan progres materi</p>
          </div>
        </div>

        {isInstructor && data && (
          <button
            type="button"
            onClick={downloadCSV}
            className="h-8 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh Rekap Nilai (CSV)</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--tenant-accent,#1E40AF)]" />
          <span>Memuat buku nilai...</span>
        </div>
      ) : !data ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-slate-500 text-xs">
          Belum ada data nilai untuk kelas ini.
        </div>
      ) : !isInstructor ? (
        /* STUDENT TRANSPARENT VIEW */
        <div className="space-y-4">
          <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-[#0F172A]">Rincian Komponen Nilai Anda</h3>
              <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-[var(--tenant-accent,#1E40AF)] border border-blue-200 rounded-full">
                Predikat: {myGrade?.letterGrade || "-"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] text-slate-500 font-medium block">Tugas Terstruktur</span>
                <div className="text-xl font-bold text-[#0F172A] mt-1">{myGrade?.assignmentAverage || 0}</div>
                <span className="text-[10px] text-slate-400">Bobot 35%</span>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] text-slate-500 font-medium block">Kuis Online</span>
                <div className="text-xl font-bold text-[#0F172A] mt-1">{myGrade?.quizAverage || 0}</div>
                <span className="text-[10px] text-slate-400">Bobot 35%</span>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] text-slate-500 font-medium block">Kehadiran (Presensi)</span>
                <div className="text-xl font-bold text-emerald-700 mt-1">{myGrade?.attendancePercentage || 0}%</div>
                <span className="text-[10px] text-slate-400">Bobot 15%</span>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] text-slate-500 font-medium block">Penyelesaian Materi</span>
                <div className="text-xl font-bold text-blue-700 mt-1">{myGrade?.materialProgressPercentage || 0}%</div>
                <span className="text-[10px] text-slate-400">Bobot 15%</span>
              </div>
            </div>

            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-blue-950 block">Nilai Akhir Kumulatif:</span>
                <span className="text-blue-700">Dihitung otomatis secara transparan</span>
              </div>
              <div className="font-mono font-bold text-xl text-[var(--tenant-accent,#1E40AF)]">
                {myGrade?.finalScore || 0} / 100
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* TEACHER GRADE MATRIX */
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="px-4 py-3">Nama Mahasiswa</th>
                  <th className="px-3 py-3 text-center">NIM</th>
                  <th className="px-3 py-3 text-center">Presensi (%)</th>
                  <th className="px-3 py-3 text-center">Tugas</th>
                  <th className="px-3 py-3 text-center">Kuis</th>
                  <th className="px-3 py-3 text-center">Materi (%)</th>
                  <th className="px-4 py-3 text-center">Nilai Akhir</th>
                  <th className="px-4 py-3 text-center">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.studentGrades.map((g) => (
                  <tr key={g.studentId} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-semibold text-[#0F172A]">{g.studentName}</td>
                    <td className="px-3 py-3 text-center font-mono text-slate-500">{g.studentIdNumber}</td>
                    <td className="px-3 py-3 text-center text-slate-700 font-medium">{g.attendancePercentage}%</td>
                    <td className="px-3 py-3 text-center font-mono text-slate-700">{g.assignmentAverage}</td>
                    <td className="px-3 py-3 text-center font-mono text-slate-700">{g.quizAverage}</td>
                    <td className="px-3 py-3 text-center text-slate-700">{g.materialProgressPercentage}%</td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-[#0F172A]">{g.finalScore}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2.5 py-0.5 font-bold rounded-lg bg-blue-50 text-[var(--tenant-accent,#1E40AF)] border border-blue-200 text-xs">
                        {g.letterGrade}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
