"use client";

import React, { useState, useEffect, use } from "react";
import {
  Building2,
  Calendar,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  FolderPlus,
  BookOpen,
} from "lucide-react";

export default function MasterDataPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const resolvedParams = use(params);
  const tenantSlug = resolvedParams.tenant;

  const [departments, setDepartments] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Department Form
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptForm, setDeptForm] = useState({
    code: "",
    name: "",
    facultyName: "",
    degreeLevel: "S1",
  });

  // New Term Form
  const [showTermModal, setShowTermModal] = useState(false);
  const [termForm, setTermForm] = useState({
    name: "",
    code: "",
    type: "SEMESTER_ODD",
    startDate: "",
    endDate: "",
    isActive: true,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [deptRes, termRes] = await Promise.all([
        fetch("/api/admin/academic/departments"),
        fetch("/api/admin/academic/terms"),
      ]);

      if (!deptRes.ok || !termRes.ok) {
        throw new Error("Gagal memuat data master akademik.");
      }

      const deptData = await deptRes.json();
      const termData = await termRes.json();

      setDepartments(deptData.departments || []);
      setTerms(termData.terms || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLoadPresets = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/academic/presets", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat preset.");

      alert("Preset akademik awal berhasil dimuat!");
      fetchData();
    } catch (err: any) {
      alert(err.message);
      setLoading(false);
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/academic/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deptForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat departemen.");

      setShowDeptModal(false);
      setDeptForm({ code: "", name: "", facultyName: "", degreeLevel: "S1" });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/academic/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(termForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat tahun akademik.");

      setShowTermModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteDept = async (id: string, name: string) => {
    if (!confirm(`Hapus program studi / jurusan "${name}"? Tindakan ini dilindungi validasi data terikat.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/academic/departments/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus.");

      alert(data.message || "Berhasil dihapus.");
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteTerm = async (id: string, name: string) => {
    if (!confirm(`Hapus tahun akademik "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/academic/terms/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus.");

      alert(data.message || "Berhasil dihapus.");
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-7 h-7 text-indigo-600" />
            Data Master Akademik
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola struktur akademik, program studi/jurusan, dan tahun ajaran aktif.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {departments.length === 0 && (
            <button
              onClick={handleLoadPresets}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
            >
              Muat Preset Awal
            </button>
          )}

          <button
            onClick={() => setShowDeptModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition"
          >
            <Plus className="w-4 h-4" />
            Tambah Jurusan/Prodi
          </button>

          <button
            onClick={() => setShowTermModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition"
          >
            <Calendar className="w-4 h-4 text-indigo-500" />
            Tambah Tahun Ajaran
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-500" />
          Memuat data master...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Kolom 1: Program Studi / Jurusan */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-indigo-600" />
              Program Studi / Jurusan
            </h2>

            {departments.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">
                Belum ada data program studi/jurusan. Klik "Muat Preset Awal" di atas.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {departments.map((d) => (
                  <div key={d.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-indigo-600">
                          {d.code}
                        </span>
                        {d.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {d.facultyName || "Fakultas Umum"} • {d.degreeLevel || "S1"} • {d._count?.studentProfiles || 0} Siswa/Mahasiswa
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteDept(d.id, d.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                      title="Hapus Jurusan (Safe Delete)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Kolom 2: Tahun Akademik */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Tahun Ajaran / Semester
            </h2>

            {terms.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">
                Belum ada tahun ajaran yang dibuat.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {terms.map((t) => (
                  <div key={t.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        {t.name}
                        {t.isActive && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-600 rounded-full border border-emerald-500/30">
                            Aktif
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Kode: {t.code} • {t._count?.classCourses || 0} Kelas Terdaftar
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteTerm(t.id, t.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                      title="Hapus Tahun Akademik"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Tambah Prodi */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              Tambah Program Studi / Jurusan
            </h3>
            <form onSubmit={handleCreateDept} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Kode *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: TI / IPA"
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Nama *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Teknik Informatika"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Fakultas / Peminatan</label>
                <input
                  type="text"
                  placeholder="Contoh: Fakultas Ilmu Komputer"
                  value={deptForm.facultyName}
                  onChange={(e) => setDeptForm({ ...deptForm, facultyName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  className="px-3 py-2 border rounded-xl text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Term */}
      {showTermModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              Tambah Tahun Ajaran / Semester
            </h3>
            <form onSubmit={handleCreateTerm} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Nama Tahun Ajaran *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 2024/2025 Ganjil"
                  value={termForm.name}
                  onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Kode *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 20241"
                  value={termForm.code}
                  onChange={(e) => setTermForm({ ...termForm, code: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">Tanggal Mulai *</label>
                  <input
                    type="date"
                    required
                    value={termForm.startDate}
                    onChange={(e) => setTermForm({ ...termForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Tanggal Selesai *</label>
                  <input
                    type="date"
                    required
                    value={termForm.endDate}
                    onChange={(e) => setTermForm({ ...termForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTermModal(false)}
                  className="px-3 py-2 border rounded-xl text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
