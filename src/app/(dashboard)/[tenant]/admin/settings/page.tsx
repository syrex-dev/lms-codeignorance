"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import {
  Building2,
  Palette,
  Save,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Upload,
  ShieldAlert,
  Hash,
  Eye,
  Search,
} from "lucide-react";
import { getContrastRatioAgainstWhite } from "@/app/api/admin/settings/route";

interface InstitutionSettings {
  id: string;
  name: string;
  slug: string;
  emailDomain: string;
  contactPhone?: string | null;
  address?: string | null;
  themeColor?: string | null;
  logoUrl?: string | null;
}

interface AuditLogItem {
  id: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  userId?: string | null;
  newValue?: any;
  createdAt: string;
}

export default function AdminSettingsPage() {
  const params = useParams();
  const tenantSlug = params?.tenant as string;

  const [activeTab, setActiveTab] = useState<"GENERAL" | "ID_GENERATOR" | "AUDIT_LOGS">("GENERAL");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [emailDomain, setEmailDomain] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [themeColor, setThemeColor] = useState("#1E40AF");
  const [logoUrl, setLogoUrl] = useState("");

  // ID Generator Tab State
  const [idTemplate, setIdTemplate] = useState("{YEAR}{DEPT_CODE}{SEQ:4}");
  const [idPreview, setIdPreview] = useState("");
  const [idGeneratorLoading, setIdGeneratorLoading] = useState(false);
  const [idGeneratorMsg, setIdGeneratorMsg] = useState<string | null>(null);

  // Audit Logs Tab State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");

  // Hitung rasio kontras warna terhadap teks putih (#FFFFFF)
  const contrastRatio = getContrastRatioAgainstWhite(themeColor);
  const isContrastValid = contrastRatio >= 4.5;

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/settings");
        if (!res.ok) throw new Error("Gagal memuat pengaturan.");
        const data = await res.json();
        const s: InstitutionSettings = data.settings;
        setName(s.name || "");
        setEmailDomain(s.emailDomain || "");
        setContactPhone(s.contactPhone || "");
        setAddress(s.address || "");
        setThemeColor(s.themeColor || "#1E40AF");
        setLogoUrl(s.logoUrl || "");
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [tenantSlug]);

  // Load audit logs when tab selected
  useEffect(() => {
    if (activeTab === "AUDIT_LOGS") {
      loadAuditLogs();
    }
  }, [activeTab]);

  async function loadAuditLogs() {
    try {
      setAuditLoading(true);
      const res = await fetch("/api/admin/security/audit-logs");
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch {
      // ignore
    } finally {
      setAuditLoading(false);
    }
  }

  // Handle Logo File Upload (PNG/JPG/SVG <= 2MB)
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("Ukuran logo maksimal 2MB.");
      return;
    }

    try {
      setUploadingLogo(true);
      setError(null);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/settings/logo", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengunggah logo.");

      setLogoUrl(data.url);
      setSuccess("Logo institusi berhasil diunggah.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSaveGeneral(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isContrastValid) {
      setError("Warna aksen tidak memenuhi standar kontras WCAG AA (minimal 4.5:1 terhadap putih).");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          contactPhone,
          address,
          themeColor,
          logoUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan pengaturan.");

      setSuccess("Pengaturan institusi berhasil disimpan.");
      setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ID Generator: Preview
  async function handlePreviewIdTemplate() {
    try {
      setIdGeneratorLoading(true);
      setIdGeneratorMsg(null);
      const res = await fetch("/api/admin/id-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          template: idTemplate,
          sampleData: {
            year: new Date().getFullYear(),
            deptCode: "TI",
            role: "STUDENT",
            sequence: 14,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.preview) {
        setIdPreview(data.preview);
      } else {
        setIdGeneratorMsg(data.error || "Gagal melakukan pratinjau format ID.");
      }
    } catch (err: any) {
      setIdGeneratorMsg(err.message);
    } finally {
      setIdGeneratorLoading(false);
    }
  }

  // ID Generator: Save Template
  async function handleSaveIdTemplate() {
    try {
      setIdGeneratorLoading(true);
      setIdGeneratorMsg(null);
      const res = await fetch("/api/admin/id-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_template",
          template: idTemplate,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setIdGeneratorMsg("Template format nomor induk berhasil disimpan.");
      } else {
        setIdGeneratorMsg(data.error || "Gagal menyimpan template format ID.");
      }
    } catch (err: any) {
      setIdGeneratorMsg(err.message);
    } finally {
      setIdGeneratorLoading(false);
    }
  }

  const filteredLogs = auditLogs.filter((log) => {
    if (!auditSearch.trim()) return true;
    const q = auditSearch.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      (log.entityType && log.entityType.toLowerCase().includes(q)) ||
      (log.userId && log.userId.toLowerCase().includes(q))
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-xs text-[var(--text-subtle)]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span>Memuat pengaturan institusi...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan Institusi"
        description="Kelola identitas resmi, warna aksen, logo, pola nomor induk, dan riwayat audit keamanan institusi."
      />

      {/* Tabs Navigation */}
      <div className="border-b border-[var(--border-subtle)] flex gap-6 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("GENERAL")}
          className={`pb-3 transition relative ${
            activeTab === "GENERAL"
              ? "text-[var(--tenant-accent,#1E40AF)] border-b-2 border-[var(--tenant-accent,#1E40AF)]"
              : "text-[var(--text-subtle)] hover:text-[var(--text-main)]"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4" strokeWidth={1.75} />
            Identitas & Branding
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("ID_GENERATOR");
            if (!idPreview) handlePreviewIdTemplate();
          }}
          className={`pb-3 transition relative ${
            activeTab === "ID_GENERATOR"
              ? "text-[var(--tenant-accent,#1E40AF)] border-b-2 border-[var(--tenant-accent,#1E40AF)]"
              : "text-[var(--text-subtle)] hover:text-[var(--text-main)]"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Hash className="w-4 h-4" strokeWidth={1.75} />
            Format Nomor Induk (ID)
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("AUDIT_LOGS")}
          className={`pb-3 transition relative ${
            activeTab === "AUDIT_LOGS"
              ? "text-[var(--tenant-accent,#1E40AF)] border-b-2 border-[var(--tenant-accent,#1E40AF)]"
              : "text-[var(--text-subtle)] hover:text-[var(--text-main)]"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" strokeWidth={1.75} />
            Log Audit Keamanan
          </span>
        </button>
      </div>

      {/* Alert Notifikasi */}
      {error && (
        <div className="p-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger)] rounded-[6px] text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3 bg-[var(--status-success-bg)] border border-[var(--status-success-border)] text-[var(--status-success)] rounded-[6px] text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* TAB 1: IDENTITAS & BRANDING */}
      {activeTab === "GENERAL" && (
        <form onSubmit={handleSaveGeneral} className="space-y-6">
          {/* Seksi 1: Informasi Resmi */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[8px] p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-subtle)]">
              <Building2 className="w-4 h-4 text-[var(--tenant-accent,#1E40AF)]" strokeWidth={1.75} />
              <h3 className="text-sm font-semibold text-[var(--text-main)]">Informasi Resmi Institusi</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1 sm:col-span-2">
                <label className="block text-xs font-medium text-[var(--text-muted)]">Nama Resmi Institusi</label>
                <input
                  type="text"
                  required
                  aria-label="Nama Resmi Institusi"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Politeknik Mitra Indonesia"
                  className="w-full h-9 px-3 text-xs bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--border-strong)] rounded-[6px] focus:ring-1 focus:ring-[var(--tenant-accent,#1E40AF)]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-[var(--text-muted)]">Domain Email Institusi</label>
                <input
                  type="text"
                  disabled
                  aria-label="Domain Email Institusi"
                  value={emailDomain}
                  className="w-full h-9 px-3 text-xs bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-[6px] text-[var(--text-subtle)] font-mono cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-[var(--text-muted)]">Nomor Telepon Kontak</label>
                <input
                  type="text"
                  aria-label="Nomor Telepon Kontak"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+62 21 889900"
                  className="w-full h-9 px-3 text-xs bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--border-strong)] rounded-[6px] focus:ring-1 focus:ring-[var(--tenant-accent,#1E40AF)]"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="block text-xs font-medium text-[var(--text-muted)]">Alamat Kampus / Sekolah</label>
                <textarea
                  rows={2}
                  aria-label="Alamat Kampus atau Sekolah"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Alamat lengkap institusi..."
                  className="w-full p-2.5 text-xs bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--border-strong)] rounded-[6px] focus:ring-1 focus:ring-[var(--tenant-accent,#1E40AF)]"
                />
              </div>
            </div>
          </div>

          {/* Seksi 2: Identitas Visual & Branding */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[8px] p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-subtle)]">
              <Palette className="w-4 h-4 text-[var(--tenant-accent,#1E40AF)]" strokeWidth={1.75} />
              <h3 className="text-sm font-semibold text-[var(--text-main)]">Identitas Visual & Branding</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Logo Upload Section */}
              <div className="space-y-3">
                <label className="block text-xs font-medium text-[var(--text-muted)]">Logo Institusi</label>
                <div className="flex items-center gap-4">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={name}
                      className="w-16 h-16 rounded-[8px] object-cover border border-[var(--border-subtle)] shadow-xs"
                    />
                  ) : (
                    <div
                      className="w-16 h-16 rounded-[8px] text-white flex items-center justify-center text-xl font-bold shadow-xs"
                      style={{ backgroundColor: themeColor }}
                    >
                      {name.charAt(0).toUpperCase() || "I"}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-[var(--text-main)] block">Unggah Berkas Logo Resmi</span>
                    <p className="text-[11px] text-[var(--text-subtle)]">
                      PNG, JPG, atau SVG (maks. 2MB).
                    </p>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[6px] text-xs font-medium text-[var(--text-main)] hover:bg-[var(--bg-subtle)] cursor-pointer transition shadow-xs">
                      {uploadingLogo ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
                      )}
                      <span>{uploadingLogo ? "Mengunggah..." : "Pilih Berkas Logo"}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml"
                        disabled={uploadingLogo}
                        onChange={handleLogoUpload}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Theme Color Picker + WCAG AA */}
              <div className="space-y-3">
                <label className="block text-xs font-medium text-[var(--text-muted)]">Warna Aksen Institusi</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label="Pemilih Warna Aksen Institusi"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="w-10 h-10 rounded-[6px] border border-[var(--border-strong)] cursor-pointer p-0.5 bg-[var(--bg-surface)]"
                  />
                  <input
                    type="text"
                    aria-label="Kode Hex Warna Aksen Institusi"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="w-28 h-9 px-2 text-xs font-mono border border-[var(--border-strong)] rounded-[6px] bg-[var(--bg-surface)] text-[var(--text-main)]"
                  />
                </div>

                {/* Status Kontras WCAG AA */}
                <div className="p-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-canvas)] space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-subtle)]">Kontras thd Teks Putih:</span>
                    <strong className="font-mono font-semibold">{contrastRatio.toFixed(2)}:1</strong>
                  </div>
                  <div>
                    {isContrastValid ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--status-success)]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Lulus Standar WCAG AA (≥ 4.5:1)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--status-danger)]">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Gagal WCAG AA (&lt; 4.5:1) — Terlalu terang</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving || !isContrastValid}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--tenant-accent,#1E40AF)] hover:opacity-90 text-white text-xs font-semibold rounded-[6px] transition shadow-xs disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Simpan Perubahan Pengaturan</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: FORMAT NOMOR INDUK (ID GENERATOR) */}
      {activeTab === "ID_GENERATOR" && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[8px] p-6 shadow-xs space-y-6">
          <div className="border-b border-[var(--border-subtle)] pb-3">
            <h3 className="text-sm font-semibold text-[var(--text-main)]">Format Nomor Induk Otomatis</h3>
            <p className="text-xs text-[var(--text-subtle)] mt-0.5">
              Tentukan pola penomoran NIM, NISN, atau NIDN yang otomatis dihasilkan saat pembuatan akun baru atau impor.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[var(--text-muted)]">Pola Template ID</label>
                <input
                  type="text"
                  aria-label="Pola Template ID"
                  value={idTemplate}
                  onChange={(e) => setIdTemplate(e.target.value)}
                  className="w-full h-9 px-3 text-xs font-mono bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--border-strong)] rounded-[6px]"
                />
              </div>

              <div className="p-3.5 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-[6px] space-y-2 text-xs">
                <div className="font-semibold text-[var(--text-main)]">Variabel yang Tersedia:</div>
                <ul className="space-y-1 text-[var(--text-subtle)] font-mono text-[11px]">
                  <li><strong className="text-[var(--text-main)]">{"{YEAR}"}</strong>: Tahun 4 digit (2026)</li>
                  <li><strong className="text-[var(--text-main)]">{"{YEAR2}"}</strong>: Tahun 2 digit (26)</li>
                  <li><strong className="text-[var(--text-main)]">{"{DEPT_CODE}"}</strong>: Kode Departemen/Prodi (TI)</li>
                  <li><strong className="text-[var(--text-main)]">{"{ROLE}"}</strong>: Inisial Peran (MHS/DSN)</li>
                  <li><strong className="text-[var(--text-main)]">{"{SEQ:n}"}</strong>: Nomor urut berjarak n digit (contoh {"{SEQ:4}"} &rarr; 0014)</li>
                </ul>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={idGeneratorLoading}
                  onClick={handlePreviewIdTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[6px] text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-subtle)] transition"
                >
                  <Eye className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
                  Pratinjau Format
                </button>
                <button
                  type="button"
                  disabled={idGeneratorLoading}
                  onClick={handleSaveIdTemplate}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--tenant-accent,#1E40AF)] text-white rounded-[6px] text-xs font-semibold hover:opacity-90 transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  Simpan Pola
                </button>
              </div>

              {idGeneratorMsg && (
                <p className="text-xs font-medium text-[var(--tenant-accent,#1E40AF)]">{idGeneratorMsg}</p>
              )}
            </div>

            {/* Live Preview Card */}
            <div className="flex flex-col justify-center items-center p-6 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-[8px] text-center space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-disabled)]">
                Hasil Pratinjau ID Baru
              </span>
              <div className="font-mono text-2xl font-bold tracking-wider text-[var(--tenant-accent,#1E40AF)] bg-[var(--bg-surface)] px-5 py-3 rounded-[8px] border border-[var(--border-subtle)] shadow-xs">
                {idPreview || idTemplate}
              </div>
              <p className="text-[11px] text-[var(--text-subtle)] max-w-xs">
                Format di atas akan diaplikasikan otomatis pada mahasiswa dan staf akademik baru.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LOG AUDIT KEAMANAN */}
      {activeTab === "AUDIT_LOGS" && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[8px] p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-main)]">Log Audit Keamanan Institusi</h3>
              <p className="text-xs text-[var(--text-subtle)] mt-0.5">
                Riwayat mutasi data sensitif, reset kredensial, perubahan pengaturan, dan akses dukungan.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--text-disabled)]" />
              <input
                type="text"
                placeholder="Cari aksi audit..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-2.5 text-xs bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--border-strong)] rounded-[6px]"
              />
            </div>
          </div>

          {auditLoading ? (
            <div className="py-10 text-center text-xs text-[var(--text-subtle)]">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              <span>Memuat catatan audit...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--text-subtle)]">
              Belum ada riwayat audit keamanan yang tercatat.
            </div>
          ) : (
            <div className="overflow-x-auto border border-[var(--border-subtle)] rounded-[6px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] text-[var(--text-muted)] font-semibold">
                  <tr>
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Aksi Keamanan</th>
                    <th className="p-3">Aktor (Pengguna)</th>
                    <th className="p-3">Entitas</th>
                    <th className="p-3">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-main)]">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[var(--bg-canvas)] transition">
                      <td className="p-3 font-mono text-[11px] text-[var(--text-subtle)] whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("id-ID")}
                      </td>
                      <td className="p-3">
                        <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-[var(--tenant-accent-subtle,#EFF6FF)] text-[var(--tenant-accent,#1E40AF)] border border-[var(--border-subtle)]">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-[var(--text-subtle)]">
                        {log.userId ? log.userId.substring(0, 12) + "..." : "SISTEM"}
                      </td>
                      <td className="p-3 text-[var(--text-muted)]">
                        {log.entityType || "-"}
                      </td>
                      <td className="p-3 text-[11px] font-mono text-[var(--text-subtle)] max-w-xs truncate">
                        {log.newValue ? JSON.stringify(log.newValue) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
