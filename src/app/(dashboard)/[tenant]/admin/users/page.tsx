"use client";

import React, { useState, useEffect, use } from "react";
import {
  Users,
  UserPlus,
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  KeyRound,
  Download,
  Upload,
  MoreVertical,
  ShieldAlert,
  ArrowRight,
  Eye,
} from "lucide-react";

interface UserItem {
  id: string;
  identifier: string;
  loginEmail: string;
  fullName: string;
  role: string;
  status: string;
  isPendingActivation: boolean;
  phoneE164?: string;
  contactEmail?: string;
  programOrDepartment?: string;
  createdAt: string;
}

export default function UserManagementPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const resolvedParams = use(params);
  const tenantSlug = resolvedParams.tenant;

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pendingActivationOnly, setPendingActivationOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

  // Manual Add Form State
  const [addForm, setAddForm] = useState({
    fullName: "",
    role: "STUDENT",
    id: "",
    birthDate: "",
    phoneE164: "",
    phoneOwner: "SELF",
    contactEmail: "",
  });
  const [addLoading, setAddLoading] = useState(false);
  const [createdCardData, setCreatedCardData] = useState<any | null>(null);

  // Reset Access Form State
  const [resetActionType, setResetActionType] = useState<"PASSWORD_ONLY" | "PASSWORD_AND_PHONE">("PASSWORD_ONLY");
  const [resetReason, setResetReason] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState<any | null>(null);

  // CSV Import State
  const [importStep, setImportStep] = useState<"UPLOAD" | "PREVIEW" | "RESULT">("UPLOAD");
  const [csvContent, setCsvContent] = useState("");
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [importOnlyValid, setImportOnlyValid] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const queryParams = new URLSearchParams();
      if (search) queryParams.append("search", search);
      if (roleFilter) queryParams.append("role", roleFilter);
      if (statusFilter) queryParams.append("status", statusFilter);
      if (pendingActivationOnly) queryParams.append("isPendingActivation", "true");
      queryParams.append("page", page.toString());
      queryParams.append("limit", "15");

      const res = await fetch(`/api/admin/users?${queryParams.toString()}`);
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("Akses ditolak: Anda tidak memiliki wewenang untuk mengelola pengguna.");
        }
        const data = await res.json();
        throw new Error(data.error || "Gagal memuat pengguna.");
      }

      const data = await res.json();
      setUsers(data.users || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalUsers(data.pagination?.total || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter, statusFilter, pendingActivationOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  // Create User Handler
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAddLoading(true);
      setError(null);

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat pengguna.");

      setCreatedCardData(data.user);
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  // Reset Access Handler
  const handleResetAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      setResetLoading(true);
      const res = await fetch(`/api/admin/users/${selectedUser.id}/reset-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: resetActionType,
          reason: resetReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mereset akses.");

      setResetResult(data);
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  // CSV Preview Handler
  const handlePreviewCsv = async (text: string) => {
    try {
      setImportLoading(true);
      const res = await fetch("/api/admin/users/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", csvText: text }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menganalisis file CSV.");

      setPreviewData(data);
      setImportStep("PREVIEW");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setImportLoading(false);
    }
  };

  // CSV Execute Handler
  const handleExecuteImport = async () => {
    if (!previewData) return;
    try {
      setImportLoading(true);
      const res = await fetch("/api/admin/users/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "execute",
          rows: previewData.rows,
          importOnlyValid,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengeksekusi impor.");

      setImportResult(data);
      setImportStep("RESULT");
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600" />
            Manajemen Pengguna
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola data akun siswa/mahasiswa, guru/dosen, serta staf institusi secara terpusat.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setCreatedCardData(null);
              setAddForm({
                fullName: "",
                role: "STUDENT",
                id: "",
                birthDate: "",
                phoneE164: "",
                phoneOwner: "SELF",
                contactEmail: "",
              });
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
          >
            <UserPlus className="w-4 h-4" />
            Tambah Pengguna
          </button>

          <button
            onClick={() => {
              setImportStep("UPLOAD");
              setCsvContent("");
              setPreviewData(null);
              setImportResult(null);
              setShowImportModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Impor CSV
          </button>

          <a
            href="/api/admin/users/template"
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm transition"
            title="Unduh Template CSV"
          >
            <Download className="w-4 h-4" />
            Template
          </a>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama, NIM/NIS, email, atau no handphone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none"
          >
            <option value="">Semua Peran</option>
            <option value="STUDENT">Siswa / Mahasiswa</option>
            <option value="TEACHER">Guru / Dosen</option>
            <option value="INSTITUTION_ADMIN">Admin Institusi</option>
            <option value="FINANCIAL_STAFF">Staf Keuangan</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none"
          >
            <option value="">Semua Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="PENDING_ACTIVATION">Menunggu Aktivasi</option>
            <option value="SUSPENDED">Ditangguhkan</option>
          </select>

          <button
            onClick={() => {
              setPendingActivationOnly(!pendingActivationOnly);
              setPage(1);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
              pendingActivationOnly
                ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Belum Aktivasi
          </button>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-500" />
            Memuat data pengguna...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500">
            <ShieldAlert className="w-10 h-10 mx-auto mb-2 text-rose-500" />
            <p className="font-semibold">{error}</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
              Tidak ada pengguna ditemukan
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Sesuaikan kata kunci pencarian atau filter yang Anda pilih.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Nama Lengkap</th>
                  <th className="py-3.5 px-4">ID / NIM / NIS</th>
                  <th className="py-3.5 px-4">Peran</th>
                  <th className="py-3.5 px-4">Status & Aktivasi</th>
                  <th className="py-3.5 px-4">Kontak Handphone</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {u.fullName}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {u.loginEmail}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                      {u.identifier}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          u.role === "STUDENT"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : u.role === "TEACHER"
                            ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                            : u.role === "INSTITUTION_ADMIN"
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {u.role === "STUDENT"
                          ? "Siswa/Mhs"
                          : u.role === "TEACHER"
                          ? "Guru/Dosen"
                          : u.role === "INSTITUTION_ADMIN"
                          ? "Admin"
                          : "Keuangan"}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {u.isPendingActivation ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Belum Aktivasi
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Aktif
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-mono text-xs">
                      {u.phoneE164 || "-"}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setResetActionType("PASSWORD_ONLY");
                            setResetReason("");
                            setResetResult(null);
                            setShowResetModal(true);
                          }}
                          className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-1 transition"
                          title="Reset Akses Pengguna"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-indigo-500" />
                          Reset
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div>Total: {totalUsers} pengguna</div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <span>
              Halaman {page} dari {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1: TAMBAH PENGGUNA MANUAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-600" />
              Tambah Pengguna Baru
            </h2>

            {createdCardData ? (
              <div className="mt-4 space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold mb-1">
                    <CheckCircle2 className="w-5 h-5" />
                    Akun Berhasil Dibuat!
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Status akun adalah <b>PENDING_ACTIVATION</b>. Pengguna wajib melakukan aktivasi pertama saat login awal.
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl space-y-2 text-xs font-mono">
                  <div><b>Nama:</b> {createdCardData.fullName}</div>
                  <div><b>ID / NIM / NIS:</b> {createdCardData.id}</div>
                  <div><b>Email Login:</b> {createdCardData.loginEmail}</div>
                  {createdCardData.initialPasswordPlain ? (
                    <div className="p-2 bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-700 dark:text-amber-300 font-bold">
                      ⚠️ Password Sementara (Tampil Sekali): {createdCardData.initialPasswordPlain}
                    </div>
                  ) : (
                    <div><b>Password Awal:</b> Sama dengan ID/NIM/NIS</div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setCreatedCardData(null);
                  }}
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition"
                >
                  Tutup & Selesai
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    required
                    value={addForm.fullName}
                    onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                    placeholder="Contoh: Muhammad Budiarto"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Peran *
                    </label>
                    <select
                      value={addForm.role}
                      onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                    >
                      <option value="STUDENT">Siswa / Mahasiswa</option>
                      <option value="TEACHER">Guru / Dosen</option>
                      <option value="INSTITUTION_ADMIN">Admin Institusi</option>
                      <option value="FINANCIAL_STAFF">Staf Keuangan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      ID / NIM / NIS (Opsional)
                    </label>
                    <input
                      type="text"
                      value={addForm.id}
                      onChange={(e) => setAddForm({ ...addForm, id: e.target.value })}
                      placeholder="Kosongkan untuk auto-generate"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nomor Handphone (E.164)
                    </label>
                    <input
                      type="text"
                      value={addForm.phoneE164}
                      onChange={(e) => setAddForm({ ...addForm, phoneE164: e.target.value })}
                      placeholder="Contoh: +628123456789"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Pemilik Nomor
                    </label>
                    <select
                      value={addForm.phoneOwner}
                      onChange={(e) => setAddForm({ ...addForm, phoneOwner: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                    >
                      <option value="SELF">Sendiri</option>
                      <option value="GUARDIAN">Orang Tua / Wali</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tanggal Lahir
                  </label>
                  <input
                    type="date"
                    value={addForm.birthDate}
                    onChange={(e) => setAddForm({ ...addForm, birthDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={addLoading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-50"
                  >
                    {addLoading ? "Membuat Akun..." : "Simpan Pengguna"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: RESET AKSES (Alur 1E.3d) */}
      {showResetModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-600" />
              Reset Akses Pengguna
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Reset akses untuk: <b>{selectedUser.fullName}</b> ({selectedUser.identifier})
            </p>

            {resetResult ? (
              <div className="mt-4 space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs space-y-2">
                  <div className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Reset Berhasil Dilakukan
                  </div>
                  <div>Status: <b>PENDING_ACTIVATION</b> (wajib aktivasi ulang)</div>
                  {resetResult.newPasswordPlain && (
                    <div className="p-2 bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-700 dark:text-amber-300 font-mono font-bold">
                      Password Baru Sementara: {resetResult.newPasswordPlain}
                    </div>
                  )}
                  <p className="text-slate-500">Semua sesi login lama pengguna telah dibatalkan.</p>
                </div>
                <button
                  onClick={() => {
                    setShowResetModal(false);
                    setSelectedUser(null);
                  }}
                  className="w-full py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold"
                >
                  Tutup
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetAccess} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Pilihan Reset *
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="actionType"
                        value="PASSWORD_ONLY"
                        checked={resetActionType === "PASSWORD_ONLY"}
                        onChange={() => setResetActionType("PASSWORD_ONLY")}
                      />
                      Reset password saja (kembali ke password awal)
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="actionType"
                        value="PASSWORD_AND_PHONE"
                        checked={resetActionType === "PASSWORD_AND_PHONE"}
                        onChange={() => setResetActionType("PASSWORD_AND_PHONE")}
                      />
                      Reset password + Hapus nomor HP (re-binding HP baru)
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Alasan Tertulis (Wajib diisi untuk audit log keamanan) *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={resetReason}
                    onChange={(e) => setResetReason(e.target.value)}
                    placeholder="Contoh: Siswa lupa password dan nomor HP lama hilang..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                  <span className="text-[10px] text-slate-400">Minimal 10 karakter</span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading || resetReason.trim().length < 10}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
                  >
                    {resetLoading ? "Memproses..." : "Konfirmasi Reset"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: IMPOR CSV */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              Impor Pengguna dari File CSV
            </h2>

            {importStep === "UPLOAD" && (
              <div className="mt-4 space-y-4">
                <p className="text-xs text-slate-500">
                  Unggah file CSV dengan format kolom: <code>nama,peran,id,tanggal_lahir,nomor_hp,email_kontak,kelas_prodi</code>.
                </p>

                <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                  <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const text = event.target?.result as string;
                          setCsvContent(text);
                          handlePreviewCsv(text);
                        };
                        reader.readAsText(file);
                      }
                    }}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}

            {importStep === "PREVIEW" && previewData && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                    <div className="text-lg font-bold">{previewData.totalRows}</div>
                    <div className="text-[11px] text-slate-500">Total Baris</div>
                  </div>
                  <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl text-center">
                    <div className="text-lg font-bold">{previewData.validCount}</div>
                    <div className="text-[11px]">Valid</div>
                  </div>
                  <div className="p-3 bg-rose-500/10 text-rose-600 rounded-xl text-center">
                    <div className="text-lg font-bold">{previewData.invalidCount}</div>
                    <div className="text-[11px]">Error</div>
                  </div>
                </div>

                {previewData.invalidCount > 0 && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-600 space-y-1">
                    <div className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      Ditemukan {previewData.invalidCount} baris bermasalah!
                    </div>
                    {previewData.errorReportCsv && (
                      <button
                        onClick={() => {
                          const blob = new Blob([previewData.errorReportCsv], { type: "text/csv" });
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "laporan_error_impor.csv";
                          a.click();
                        }}
                        className="text-xs font-bold underline mt-1 block"
                      >
                        Unduh Laporan Error CSV
                      </button>
                    )}
                  </div>
                )}

                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importOnlyValid}
                    onChange={(e) => setImportOnlyValid(e.target.checked)}
                  />
                  Hanya impor baris yang valid (lewati baris error)
                </label>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setImportStep("UPLOAD")}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                  >
                    Kembali
                  </button>
                  <button
                    disabled={importLoading || (previewData.invalidCount > 0 && !importOnlyValid)}
                    onClick={handleExecuteImport}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                  >
                    {importLoading ? "Memproses Impor..." : "Jalankan Impor"}
                  </button>
                </div>
              </div>
            )}

            {importStep === "RESULT" && importResult && (
              <div className="mt-4 space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                    Impor Berhasil Diselesaikan!
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    {importResult.importedCount} akun berhasil dibuat. {importResult.skippedCount} akun dilewati (idempoten / duplikat).
                  </div>
                </div>

                {importResult.cards && importResult.cards.length > 0 && (
                  <div className="text-center">
                    <button
                      onClick={() => {
                        const csv = [
                          "Nama,ID,Email,Password_Awal",
                          ...importResult.cards.map(
                            (c: any) => `"${c.fullName}","${c.id}","${c.loginEmail}","${c.initialPasswordPlain || "Sama dengan ID"}"`
                          ),
                        ].join("\n");
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "kartu_akun_impor.csv";
                        a.click();
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      Unduh Kartu Akun Hasil Impor (CSV)
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setShowImportModal(false)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl text-xs font-semibold"
                >
                  Selesai
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
