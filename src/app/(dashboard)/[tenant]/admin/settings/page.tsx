"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getContrastRatioAgainstWhite } from "@/app/api/admin/settings/route";
import {
  Building2,
  Palette,
  Phone,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Save,
  Image as ImageIcon,
} from "lucide-react";

export default function AdminSettingsPage() {
  const params = useParams();
  const tenantSlug = params.tenant as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [emailDomain, setEmailDomain] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [themeColor, setThemeColor] = useState("#1E40AF");
  const [logoUrl, setLogoUrl] = useState("");

  const contrastRatio = getContrastRatioAgainstWhite(themeColor);
  const isContrastValid = contrastRatio >= 4.5;

  async function loadSettings() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat data pengaturan.");

      const s = data.settings;
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

  useEffect(() => {
    loadSettings();
  }, [tenantSlug]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isContrastValid) {
      setError(`Warna aksen tidak memenuhi standar kontras WCAG AA (minimal 4.5:1 terhadap putih). Nilai saat ini: ${contrastRatio.toFixed(2)}:1.`);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
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
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan perubahan.");

      setSuccess("Pengaturan identitas dan branding institusi berhasil disimpan!");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-xs text-[#64748B] gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#1E40AF]" strokeWidth={2} />
        <span>Memuat pengaturan institusi...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Pengaturan Institusi"
        description="Kelola nama resmi, identitas visual, logo, dan palet warna institusi Anda."
      />

      {error && (
        <div role="alert" className="p-4 bg-red-50 border border-red-200 text-xs text-[#B91C1C] rounded-[8px] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div role="alert" className="p-4 bg-emerald-50 border border-emerald-200 text-xs text-[#15803D] rounded-[8px] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Seksi 1: Identitas Institusi */}
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#F1F5F9]">
            <Building2 className="w-4 h-4 text-[#1E40AF]" strokeWidth={1.75} />
            <h3 className="text-sm font-semibold text-[#0F172A]">Informasi Resmi Institusi</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <label className="block text-xs font-medium text-[#334155]">Nama Resmi Institusi</label>
              <input
                type="text"
                required
                aria-label="Nama Resmi Institusi"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Politeknik Mitra Indonesia"
                className="w-full h-9 px-3 text-xs bg-white border border-[#CBD5E1] rounded-[6px] focus:ring-1 focus:ring-[#1E40AF]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-[#334155]">Domain Email Institusi (Sistem)</label>
              <input
                type="text"
                disabled
                aria-label="Domain Email Institusi"
                value={emailDomain}
                className="w-full h-9 px-3 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] text-[#64748B] font-mono cursor-not-allowed"
              />
              <span className="text-[10px] text-[#94A3B8]">Dikelola otomatis berdasarkan konfigurasi tenant.</span>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-[#334155]">Nomor Telepon Kontak</label>
              <input
                type="text"
                aria-label="Nomor Telepon Kontak"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+62 21 889900"
                className="w-full h-9 px-3 text-xs bg-white border border-[#CBD5E1] rounded-[6px] focus:ring-1 focus:ring-[#1E40AF]"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="block text-xs font-medium text-[#334155]">Alamat Kampus / Sekolah</label>
              <textarea
                rows={2}
                aria-label="Alamat Kampus atau Sekolah"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Alamat lengkap institusi..."
                className="w-full p-2.5 text-xs bg-white border border-[#CBD5E1] rounded-[6px] focus:ring-1 focus:ring-[#1E40AF]"
              />
            </div>
          </div>
        </div>

        {/* Seksi 2: Branding Visual (Logo & Warna Aksen WCAG AA) */}
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#F1F5F9]">
            <Palette className="w-4 h-4 text-[#1E40AF]" strokeWidth={1.75} />
            <h3 className="text-sm font-semibold text-[#0F172A]">Identitas Visual & Branding</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Pratinjau Logo & Monogram */}
            <div className="space-y-3">
              <label className="block text-xs font-medium text-[#334155]">Logo / Monogram Institusi</label>
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={name}
                    className="w-16 h-16 rounded-[8px] object-cover border border-[#E2E8F0]"
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-[8px] text-white flex items-center justify-center text-xl font-bold shadow-xs"
                    style={{ backgroundColor: themeColor }}
                  >
                    {name.charAt(0).toUpperCase() || "I"}
                  </div>
                )}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#0F172A]">Monogram Persegi 8px</span>
                  <p className="text-[11px] text-[#64748B]">
                    Digunakan pada login, header, sidebar, dan cetak PDF.
                  </p>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <label className="block text-[11px] text-[#475569]">URL Berkas Logo (PNG/SVG/JPG, maks 2MB)</label>
                <input
                  type="url"
                  aria-label="URL Berkas Logo Institusi"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://.../logo.png"
                  className="w-full h-8 px-2.5 text-xs bg-white border border-[#CBD5E1] rounded-[6px]"
                />
              </div>
            </div>

            {/* Pemilih Warna Aksen & Rasio Kontras WCAG AA */}
            <div className="space-y-3">
              <label className="block text-xs font-medium text-[#334155]">Warna Aksen Institusi</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  aria-label="Pemilih Warna Aksen Institusi"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="w-10 h-10 rounded-[6px] border border-[#CBD5E1] cursor-pointer p-0.5 bg-white"
                />
                <input
                  type="text"
                  aria-label="Kode Hex Warna Aksen Institusi"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="w-28 h-9 px-2 text-xs font-mono border border-[#CBD5E1] rounded-[6px]"
                />
              </div>

              {/* Status Kontras WCAG AA */}
              <div className="p-3 rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748B]">Kontras thd Teks Putih:</span>
                  <strong className="font-mono font-semibold">{contrastRatio.toFixed(2)}:1</strong>
                </div>
                <div>
                  {isContrastValid ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#15803D]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Lulus Standar WCAG AA (≥ 4.5:1)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B91C1C]">
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
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-[6px] transition shadow-xs disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Simpan Perubahan Pengaturan</span>
          </button>
        </div>
      </form>
    </div>
  );
}
