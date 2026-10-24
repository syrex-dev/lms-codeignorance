"use client";

import * as Dialog from "@radix-ui/react-dialog";

import React, { useState, useEffect, use } from "react";
import {
  Users,
  UserPlus,
  FileSpreadsheet,
  Search,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  KeyRound,
  Download,
  Upload,
  ShieldAlert,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

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

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "STUDENT":
        return <Badge variant="accent">Mahasiswa</Badge>;
      case "TEACHER":
        return <Badge variant="accent">Dosen</Badge>;
      case "INSTITUTION_ADMIN":
        return <Badge variant="neutral">Admin</Badge>;
      case "FINANCIAL_STAFF":
        return <Badge variant="neutral">Keuangan</Badge>;
      default:
        return <Badge variant="neutral">{role}</Badge>;
    }
  };

  
  // Ekspor Kartu Akun CSV untuk pengguna
  async function handleExportAccountCards() {
    try {
      const userIds = users.map((u) => u.id);
      if (userIds.length === 0) {
        alert("Tidak ada pengguna untuk dicetak.");
        return;
      }
      const res = await fetch("/api/admin/account-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds, exportCsv: true }),
      });
      if (!res.ok) throw new Error("Gagal mengunduh kartu akun.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kartu_akun_${tenantSlug}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert(err.message || "Gagal mengunduh kartu akun.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen pengguna"
        description="Kelola akun pengguna, status aktivasi, dan kredensial institusi."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
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
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              Tambah Pengguna
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setImportStep("UPLOAD");
                setCsvContent("");
                setPreviewData(null);
                setImportResult(null);
                setShowImportModal(true);
              }}
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5" />
              Impor CSV
            </Button>
            <Button
              variant="outline"
              onClick={handleExportAccountCards}
              title="Cetak & Ekspor Kartu Akun CSV"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Kartu Akun
            </Button>
            <a
              href="/api/admin/users/template"
              className="inline-flex items-center h-9 px-3 border border-[#E3E6EB] bg-white text-[#4B5563] text-sm font-medium rounded-md hover:bg-[#F6F7F9] transition"
              title="Unduh template CSV"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Template
            </a>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-[#E3E6EB] flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#9CA3AF]" />
          <input
            type="text"
            aria-label="Cari pengguna" placeholder="Cari berdasarkan nama, NIM/NIS, email, atau no handphone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 bg-white border border-[#E3E6EB] rounded-md text-sm text-[#111827] focus:outline-none focus:ring-1 focus:ring-[var(--tenant-primary)] focus:border-[var(--tenant-primary)]"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Select
            aria-label="Filter peran pengguna"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="w-auto h-9 text-xs"
          >
            <option value="">Semua peran</option>
            <option value="STUDENT">Mahasiswa</option>
            <option value="TEACHER">Dosen</option>
            <option value="INSTITUTION_ADMIN">Admin institusi</option>
            <option value="FINANCIAL_STAFF">Staf keuangan</option>
          </Select>

          <Select
            aria-label="Filter status pengguna"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-auto h-9 text-xs"
          >
            <option value="">Semua status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="PENDING_ACTIVATION">Menunggu aktivasi</option>
            <option value="SUSPENDED">Ditangguhkan</option>
          </Select>

          <Button
            type="button"
            variant={pendingActivationOnly ? "primary" : "outline"}
            size="sm"
            onClick={() => {
              setPendingActivationOnly(!pendingActivationOnly);
              setPage(1);
            }}
            className="h-9 text-xs"
          >
            Belum aktivasi
          </Button>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white rounded-lg border border-[#E3E6EB] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[#6B7280]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#9CA3AF]" />
            <p className="text-sm">Memuat data pengguna...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-[#DC2626]">
            <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-[#DC2626]" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            title="Tidak ada pengguna ditemukan"
            description="Sesuaikan kata kunci pencarian atau filter yang Anda pilih."
          />
        ) : (
          <div className="w-full max-w-full min-w-0 overflow-x-auto">
            {/* Desktop Table View (sm:block) */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama lengkap</TableHead>
                    <TableHead>ID / NIM / NIS</TableHead>
                    <TableHead>Peran</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Kontak handphone</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium text-[#111827]">
                          {u.fullName}
                        </div>
                        <div className="text-xs text-[#6B7280] font-mono mt-0.5">
                          {u.loginEmail}
                        </div>
                      </TableCell>

                      <TableCell className="font-mono text-xs text-[#374151]">
                        {u.identifier}
                      </TableCell>

                      <TableCell>
                        {getRoleBadge(u.role)}
                      </TableCell>

                      <TableCell>
                        {u.isPendingActivation ? (
                          <Badge variant="warning">Belum aktivasi</Badge>
                        ) : (
                          <Badge variant="success">Aktif</Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-[#4B5563] font-mono text-xs">
                        {u.phoneE164 || "-"}
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(u);
                            setResetReason("");
                            setResetResult(null);
                            setShowResetModal(true);
                          }}
                          className="text-xs text-[#1F4E8C] hover:bg-[#F6F7F9]"
                        >
                          <KeyRound className="w-3.5 h-3.5 mr-1" />
                          Reset akses
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View (sm:hidden) */}
            <div className="sm:hidden divide-y divide-[#E3E6EB] p-2 space-y-3">
              {users.map((u) => (
                <div key={u.id} className="p-3 bg-white border border-[#E3E6EB] rounded-[8px] space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm text-[#111827]">{u.fullName}</div>
                      <div className="text-xs text-[#6B7280] font-mono">{u.loginEmail}</div>
                    </div>
                    {getRoleBadge(u.role)}
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#4B5563]">
                    <span className="font-mono">{u.identifier}</span>
                    {u.isPendingActivation ? (
                      <Badge variant="warning">Belum aktivasi</Badge>
                    ) : (
                      <Badge variant="success">Aktif</Badge>
                    )}
                  </div>
                  <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between">
                    <span className="text-xs text-[#6B7280] font-mono">{u.phoneE164 || "-"}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(u);
                        setResetReason("");
                        setResetResult(null);
                        setShowResetModal(true);
                      }}
                      className="text-xs text-[#1F4E8C] hover:bg-[#F6F7F9]"
                    >
                      <KeyRound className="w-3.5 h-3.5 mr-1" />
                      Reset akses
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-3 bg-[#F6F7F9] border-t border-[#E3E6EB] flex items-center justify-between text-xs text-[#6B7280]">
          <div>
            Total <span className="font-medium text-[#111827]">{totalUsers}</span> pengguna
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="h-8 text-xs"
            >
              Sebelumnya
            </Button>
            <span>
              Halaman {page} dari {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="h-8 text-xs"
            >
              Berikutnya
            </Button>
          </div>
        </div>
      </div>

      {/* MODAL 1: TAMBAH PENGGUNA MANUAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E3E6EB] rounded-lg max-w-lg w-full p-6 shadow-md relative">
            <h2 className="text-base font-semibold text-[#111827] flex items-center gap-2 mb-4">
              <UserPlus className="w-5 h-5 text-[var(--tenant-primary)]" />
              Tambah Pengguna Baru
            </h2>

            {createdCardData ? (
              <div className="space-y-4">
                <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-md">
                  <div className="flex items-center gap-2 text-[#15803D] font-semibold text-sm mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Akun Berhasil Dibuat!
                  </div>
                  <p className="text-xs text-[#4B5563]">
                    Status akun adalah PENDING_ACTIVATION. Pengguna wajib melakukan aktivasi pertama saat login awal.
                  </p>
                </div>

                <div className="bg-[#F6F7F9] border border-[#E3E6EB] p-3 rounded-md space-y-1.5 text-xs font-mono text-[#374151]">
                  <div><span className="font-sans font-medium text-[#111827]">Nama:</span> {createdCardData.fullName}</div>
                  <div><span className="font-sans font-medium text-[#111827]">ID / NIM / NIS:</span> {createdCardData.id}</div>
                  <div><span className="font-sans font-medium text-[#111827]">Email login:</span> {createdCardData.loginEmail}</div>
                  {createdCardData.initialPasswordPlain ? (
                    <div className="p-2 bg-[#FFFBEB] border border-[#FDE68A] rounded text-[#92400E] font-medium">
                      Password sementara (hanya tampil sekali): {createdCardData.initialPasswordPlain}
                    </div>
                  ) : (
                    <div><span className="font-sans font-medium text-[#111827]">Password awal:</span> Sama dengan ID/NIM/NIS</div>
                  )}
                </div>

                <Button
                  onClick={() => {
                    setShowAddModal(false);
                    setCreatedCardData(null);
                  }}
                  className="w-full"
                >
                  Tutup & Selesai
                </Button>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">
                    Nama Lengkap *
                  </label>
                  <Input
                    type="text"
                    required
                    value={addForm.fullName}
                    onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                    placeholder="Contoh: Muhammad Budiarto"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1">
                      Peran *
                    </label>
                    <Select
                      aria-label="Pilih peran pengguna"
                      value={addForm.role}
                      onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                    >
                      <option value="STUDENT">Mahasiswa</option>
                      <option value="TEACHER">Dosen</option>
                      <option value="INSTITUTION_ADMIN">Admin institusi</option>
                      <option value="FINANCIAL_STAFF">Staf keuangan</option>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1">
                      ID / NIM / NIS (Opsional)
                    </label>
                    <Input
                      type="text"
                      value={addForm.id}
                      onChange={(e) => setAddForm({ ...addForm, id: e.target.value })}
                      placeholder="Kosongkan untuk auto-generate"
                      className="font-mono"
                    />
                  </div>
                </div>

                {/* Live Preview Box */}
                <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] space-y-1.5 text-xs">
                  <div className="text-[11px] font-semibold text-[#64748B]">Pratinjau Langsung Kredensial:</div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#475569]">Nomor Induk:</span>
                    <strong className="font-mono text-[#0F172A]">{addForm.id || "(Auto-generate)"}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#475569]">Email Login:</span>
                    <strong className="font-mono text-[#0F172A]">{addForm.id ? `${addForm.id}@${tenantSlug}.ac.id` : `[id]@${tenantSlug}.ac.id`}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1">
                      Nomor Handphone (E.164)
                    </label>
                    <Input
                      type="text"
                      value={addForm.phoneE164}
                      onChange={(e) => setAddForm({ ...addForm, phoneE164: e.target.value })}
                      placeholder="Contoh: +628123456789"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1">
                      Pemilik Nomor
                    </label>
                    <Select
                      aria-label="Pilih pemilik nomor handphone"
                      value={addForm.phoneOwner}
                      onChange={(e) => setAddForm({ ...addForm, phoneOwner: e.target.value })}
                    >
                      <option value="SELF">Sendiri</option>
                      <option value="GUARDIAN">Orang tua / wali</option>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1">
                    Tanggal Lahir
                  </label>
                  <Input
                    type="date"
                    value={addForm.birthDate}
                    onChange={(e) => setAddForm({ ...addForm, birthDate: e.target.value })}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddModal(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    disabled={addLoading}
                  >
                    {addLoading ? "Membuat akun..." : "Simpan Pengguna"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: RESET AKSES PENGGUNA (Radix UI Dialog dengan Focus Trap & Tombol Spesifik) */}
      <Dialog.Root open={showResetModal} onOpenChange={setShowResetModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs animate-in fade-in" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white border border-[#E2E8F0] rounded-[12px] max-w-md w-full p-6 shadow-xl focus:outline-none">
            {selectedUser && (
              <>
                <Dialog.Title className="text-base font-bold text-[#0F172A] flex items-center gap-2 mb-1">
                  <KeyRound className="w-5 h-5 text-[#1E40AF]" />
                  Reset Akses Pengguna
                </Dialog.Title>
                <Dialog.Description className="text-xs text-[#64748B] mb-4">
                  Pengguna: <strong className="text-[#0F172A]">{selectedUser.fullName}</strong> ({selectedUser.identifier})
                </Dialog.Description>

                {resetResult ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-[8px] text-xs text-[#15803D]">
                      <div className="font-semibold mb-1">Akses berhasil direset!</div>
                      <p className="text-[#475569]">
                        {resetResult.message || "Pengguna kini dapat melakukan login dan aktivasi kembali."}
                      </p>
                    </div>

                    {resetResult.newInitialPasswordPlain && (
                      <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-[8px] text-xs">
                        <div className="font-medium text-[#92400E]">Password sementara baru:</div>
                        <div className="text-sm font-mono font-bold text-[#0F172A] mt-1">
                          {resetResult.newInitialPasswordPlain}
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={() => setShowResetModal(false)}
                      className="w-full"
                    >
                      Tutup
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleResetAccess} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-[#334155] mb-1">
                        Tindakan reset
                      </label>
                      <Select
                        aria-label="Pilih jenis tindakan reset"
                        value={resetActionType}
                        onChange={(e: any) => setResetActionType(e.target.value)}
                      >
                        <option value="PASSWORD_ONLY">Reset password ke awal</option>
                        <option value="PASSWORD_AND_PHONE">Reset password dan nomor handphone</option>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#334155] mb-1">
                        Alasan reset *
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={resetReason}
                        onChange={(e) => setResetReason(e.target.value)}
                        placeholder="Contoh: Mahasiswa lupa password dan nomor HP ganti"
                        className="w-full p-2.5 bg-white border border-[#CBD5E1] rounded-[8px] text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowResetModal(false)}
                      >
                        Batal
                      </Button>
                      <Button
                        type="submit"
                        disabled={resetLoading}
                      >
                        {resetLoading ? "Memproses..." : `Reset akses ${selectedUser.fullName}`}
                      </Button>
                    </div>
                  </form>
                )}
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

            {/* MODAL 3: IMPOR CSV */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#E3E6EB] rounded-lg max-w-2xl w-full p-6 shadow-md relative">
            <h2 className="text-base font-semibold text-[#111827] flex items-center gap-2 mb-2">
              <FileSpreadsheet className="w-5 h-5 text-[var(--tenant-primary)]" />
              Impor Pengguna dari File CSV
            </h2>

            {importStep === "UPLOAD" && (
              <div className="mt-4 space-y-4">
                <p className="text-xs text-[#6B7280]">
                  Unggah file CSV dengan format kolom: <code className="font-mono bg-[#F6F7F9] px-1 py-0.5 rounded border border-[#E3E6EB]">nama,peran,id,tanggal_lahir,nomor_hp,email_kontak,kelas_prodi</code>.
                </p>

                <div className="border border-dashed border-[#CBD5E1] rounded-lg p-6 text-center hover:bg-[#F6F7F9] transition">
                  <Upload className="w-8 h-8 text-[#9CA3AF] mx-auto mb-2" />
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
                    className="block w-full text-xs text-[#6B7280] file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-[#EFF6FF] file:text-[#1E40AF] hover:file:bg-[#DBEAFE] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowImportModal(false)}
                  >
                    Batal
                  </Button>
                </div>
              </div>
            )}

            {importStep === "PREVIEW" && previewData && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-[#F6F7F9] border border-[#E3E6EB] rounded-md text-center">
                    <div className="text-lg font-semibold text-[#111827]">{previewData.totalRows}</div>
                    <div className="text-xs text-[#6B7280]">Total baris</div>
                  </div>
                  <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] rounded-md text-center">
                    <div className="text-lg font-semibold">{previewData.validCount}</div>
                    <div className="text-xs">Valid</div>
                  </div>
                  <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] rounded-md text-center">
                    <div className="text-lg font-semibold">{previewData.invalidCount}</div>
                    <div className="text-xs">Error</div>
                  </div>
                </div>

                {previewData.invalidCount > 0 && (
                  <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-md text-xs text-[#DC2626] space-y-1">
                    <div className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      Ditemukan {previewData.invalidCount} baris bermasalah.
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
                        className="text-xs font-semibold underline mt-1 block"
                      >
                        Unduh laporan error CSV
                      </button>
                    )}
                  </div>
                )}

                <label className="flex items-center gap-2 text-xs font-normal text-[#374151] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importOnlyValid}
                    onChange={(e) => setImportOnlyValid(e.target.checked)}
                    className="rounded border-[#CBD5E1] text-[var(--tenant-primary)] focus:ring-[var(--tenant-primary)]"
                  />
                  Hanya impor baris yang valid (lewati baris error)
                </label>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setImportStep("UPLOAD")}
                  >
                    Kembali
                  </Button>
                  <Button
                    disabled={importLoading || (previewData.invalidCount > 0 && !importOnlyValid)}
                    onClick={handleExecuteImport}
                  >
                    {importLoading ? "Memproses impor..." : "Jalankan Impor"}
                  </Button>
                </div>
              </div>
            )}

            {importStep === "RESULT" && importResult && (
              <div className="mt-4 space-y-4">
                <div className="p-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-md text-center">
                  <CheckCircle2 className="w-8 h-8 text-[#15803D] mx-auto mb-2" />
                  <div className="text-sm font-semibold text-[#15803D]">
                    Impor berhasil diselesaikan
                  </div>
                  <div className="text-xs text-[#4B5563] mt-1">
                    {importResult.importedCount} akun berhasil dibuat. {importResult.skippedCount} akun dilewati (idempoten / duplikat).
                  </div>
                </div>

                {importResult.cards && importResult.cards.length > 0 && (
                  <div className="text-center">
                    <Button
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
                      variant="outline"
                      size="sm"
                    >
                      <Download className="w-4 h-4 mr-1.5" />
                      Unduh kartu akun hasil impor (CSV)
                    </Button>
                  </div>
                )}

                <Button
                  onClick={() => setShowImportModal(false)}
                  className="w-full"
                >
                  Selesai
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
