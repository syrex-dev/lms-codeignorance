"use client";

import React, { useState, useEffect, use } from "react";
import {
  GraduationCap,
  Calendar,
  BookOpen,
  UserCheck,
  UserPlus,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Archive,
  Layers,
  ChevronRight,
  BookMarked,
  Clock,
  Trash2,
  Users,
} from "lucide-react";

interface AcademicTerm {
  id: string;
  name: string;
  code: string;
  type: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  _count?: { classCourses: number };
}

interface ClassCourse {
  id: string;
  code: string;
  name: string;
  credits?: number;
  roomName?: string;
  isArchived: boolean;
  academicTerm: { id: string; name: string };
  programDepartment?: { id: string; name: string };
  instructors: Array<{
    isPrimary: boolean;
    instructor: { id: string; fullName: string };
  }>;
  _count?: { enrollments: number };
}

export default function AcademicManagementPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const resolvedParams = use(params);
  const tenantSlug = resolvedParams.tenant;

  const [activeTab, setActiveTab] = useState<"terms" | "courses" | "assignments" | "enrollment">("terms");
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [courses, setCourses] = useState<ClassCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Term Modal
  const [showTermModal, setShowTermModal] = useState(false);
  const [termForm, setTermForm] = useState({
    name: "",
    code: "",
    type: "SEMESTER_1",
    startDate: "",
    endDate: "",
    isActive: true,
  });

  // Course Modal
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseForm, setCourseForm] = useState({
    name: "",
    code: "",
    academicTermId: "",
    credits: 3,
    roomName: "",
    description: "",
  });

  // Enrollment Modal
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [studentIdsInput, setStudentIdsInput] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [termRes, courseRes] = await Promise.all([
        fetch("/api/admin/academic/terms"),
        fetch("/api/admin/academic/classes"),
      ]);
      const termData = await termRes.json();
      const courseData = await courseRes.json();

      if (termData.terms) setTerms(termData.terms);
      if (courseData.classes) setCourses(courseData.classes);
    } catch (err: any) {
      setError(err.message || "Gagal memuat data akademik.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/academic/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(termForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambah tahun akademik.");

      setSuccess("Tahun akademik / semester berhasil dibuat!");
      setShowTermModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/academic/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(courseForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambah kelas/mata kuliah.");

      setSuccess("Mata kuliah / rombel kelas berhasil dibuat!");
      setShowCourseModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEnrollStudents = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) return;

    try {
      const ids = studentIdsInput
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch(`/api/admin/academic/classes/${selectedCourseId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentUserIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mendaftarkan peserta.");

      setSuccess(`Berhasil mendaftarkan ${data.enrolledCount} siswa ke kelas!`);
      setShowEnrollModal(false);
      setStudentIdsInput("");
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 min-w-0 max-w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0 max-w-full">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-indigo-600" />
            Manajemen Akademik Terpadu
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Kelola tahun ajaran/semester, mata pelajaran/mata kuliah, penugasan pengajar & wali kelas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === "terms" && (
            <button
              onClick={() => setShowTermModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm flex items-center gap-2 shadow-sm transition"
            >
              <Plus className="h-4 w-4" />
              Tambah Tahun/Semester
            </button>
          )}
          {activeTab === "courses" && (
            <button
              onClick={() => setShowCourseModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm flex items-center gap-2 shadow-sm transition"
            >
              <Plus className="h-4 w-4" />
              Tambah Mata Pelajaran/Kelas
            </button>
          )}
          {activeTab === "enrollment" && (
            <button
              onClick={() => setShowEnrollModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm flex items-center gap-2 shadow-sm transition"
            >
              <UserPlus className="h-4 w-4" />
              Enroll Peserta Massal
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between text-red-700 dark:text-red-300">
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-xs font-semibold hover:underline">Tutup</button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-between text-emerald-700 dark:text-emerald-300">
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-xs font-semibold hover:underline">Tutup</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 overflow-x-auto scrollbar-none max-w-full min-w-0 pb-1">
        <button
          onClick={() => setActiveTab("terms")}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
            activeTab === "terms"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Calendar className="h-4 w-4" />
          Tahun Ajaran / Semester ({terms.length})
        </button>
        <button
          onClick={() => setActiveTab("courses")}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
            activeTab === "courses"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Mata Pelajaran & Kelas ({courses.length})
        </button>
        <button
          onClick={() => setActiveTab("assignments")}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
            activeTab === "assignments"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Penugasan Pengajar & Wali Kelas
        </button>
        <button
          onClick={() => setActiveTab("enrollment")}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
            activeTab === "enrollment"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Users className="h-4 w-4" />
          Enrollment Peserta Kelas
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-12 flex justify-center items-center text-slate-400 gap-2">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Memuat data akademik...</span>
        </div>
      ) : (
        <div>
          {/* TAB 1: TERMS */}
          {activeTab === "terms" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {terms.map((t) => (
                <div key={t.id} className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {t.code}
                    </span>
                    {t.isActive ? (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Aktif
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center gap-1">
                        <Archive className="h-3 w-3" /> Arsip
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{t.name}</h3>
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(t.startDate).toLocaleDateString()} s/d {new Date(t.endDate).toLocaleDateString()}
                  </div>
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs text-slate-600 dark:text-slate-400">
                    <span>{t._count?.classCourses || 0} Mata Kuliah/Kelas Terdaftar</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: COURSES */}
          {activeTab === "courses" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-x-auto max-w-full min-w-0">
              <table className="w-full text-left text-sm min-w-[600px]">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-medium border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Kode</th>
                    <th className="px-4 py-3">Nama Mata Pelajaran/Kuliah</th>
                    <th className="px-4 py-3">SKS/Bobot</th>
                    <th className="px-4 py-3">Tahun/Semester</th>
                    <th className="px-4 py-3">Pengajar</th>
                    <th className="px-4 py-3">Peserta</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {courses.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono font-medium text-slate-900 dark:text-white">{c.code}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{c.name}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{c.credits || 3} SKS</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{c.academicTerm?.name}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {c.instructors.length > 0
                          ? c.instructors.map((i) => i.instructor.fullName).join(", ")
                          : <span className="text-amber-500 italic">Belum ditugaskan</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {c._count?.enrollments || 0} siswa
                      </td>
                      <td className="px-4 py-3">
                        {c.isArchived ? (
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Diarsip</span>
                        ) : (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Aktif</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: ASSIGNMENTS */}
          {activeTab === "assignments" && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 rounded-lg text-sm text-indigo-700 dark:text-indigo-300">
                Pilih kelas untuk mengatur penugasan pengajar utama, guru pendamping, atau Wali Kelas / Dosen Wali.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {courses.map((c) => (
                  <div key={c.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{c.code}</span>
                        <h4 className="font-semibold text-slate-900 dark:text-white mt-1">{c.name}</h4>
                      </div>
                      <span className="text-xs text-slate-500">{c.academicTerm?.name}</span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      <strong>Pengajar Terdaftar:</strong>{" "}
                      {c.instructors.length > 0 ? (
                        c.instructors.map((i) => i.instructor.fullName + (i.isPrimary ? " (Utama/Wali)" : "")).join("; ")
                      ) : (
                        <span className="text-amber-500">Belum ada penugasan</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: ENROLLMENT */}
          {activeTab === "enrollment" && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 rounded-lg text-sm text-emerald-700 dark:text-emerald-300">
                Enrollment siswa/mahasiswa dilindungi dari bentrok data lintas tenant. Hanya peserta terdaftar pada institusi aktif yang dapat dimasukkan ke rombel kelas.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {courses.map((c) => (
                  <div key={c.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-xs text-slate-500">{c.code}</span>
                      <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                        {c._count?.enrollments || 0} Terdaftar
                      </span>
                    </div>
                    <h4 className="font-semibold text-slate-900 dark:text-white">{c.name}</h4>
                    <button
                      onClick={() => {
                        setSelectedCourseId(c.id);
                        setShowEnrollModal(true);
                      }}
                      className="w-full py-1.5 px-3 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-800 text-xs font-medium rounded-lg transition"
                    >
                      + Tambah Peserta Siswa
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Tambah Term */}
      {showTermModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Tambah Tahun Ajaran / Semester</h3>
            <form onSubmit={handleCreateTerm} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Nama Tahun/Semester</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 2024/2025 Ganjil"
                  value={termForm.name}
                  onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Kode Unik</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 2024-GANJIL"
                  value={termForm.code}
                  onChange={(e) => setTermForm({ ...termForm, code: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Tanggal Mulai</label>
                  <input
                    type="date"
                    required
                    value={termForm.startDate}
                    onChange={(e) => setTermForm({ ...termForm, startDate: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Tanggal Selesai</label>
                  <input
                    type="date"
                    required
                    value={termForm.endDate}
                    onChange={(e) => setTermForm({ ...termForm, endDate: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowTermModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Course */}
      {showCourseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Tambah Mata Pelajaran / Rombel</h3>
            <form onSubmit={handleCreateCourse} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Tahun/Semester</label>
                <select
                  required
                  value={courseForm.academicTermId}
                  onChange={(e) => setCourseForm({ ...courseForm, academicTermId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                >
                  <option value="">Pilih Tahun Ajaran...</option>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Kode Mata Pelajaran/Kuliah</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: MAT-101 atau IF-202"
                  value={courseForm.code}
                  onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Nama Kelas / Mata Kuliah</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Matematika Diskrit - Kelas A"
                  value={courseForm.name}
                  onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Bobot SKS</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={courseForm.credits}
                    onChange={(e) => setCourseForm({ ...courseForm, credits: parseInt(e.target.value, 10) })}
                    className="w-full mt-1 px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Ruangan</label>
                  <input
                    type="text"
                    placeholder="Contoh: Lab Komputer 1"
                    value={courseForm.roomName}
                    onChange={(e) => setCourseForm({ ...courseForm, roomName: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Enrollment Siswa */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Enrollment Peserta Kelas</h3>
            <p className="text-xs text-slate-500">
              Masukkan ID pengguna siswa/mahasiswa (pisahkan dengan koma atau baris baru).
            </p>
            <form onSubmit={handleEnrollStudents} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">User ID Siswa</label>
                <textarea
                  rows={4}
                  required
                  placeholder="ID1, ID2 atau salin daftar ID pengguna..."
                  value={studentIdsInput}
                  onChange={(e) => setStudentIdsInput(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm font-mono border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEnrollModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
                >
                  Daftarkan Peserta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
