"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/page-header";
import {
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  Check,
  Circle,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Lock,
  Smartphone,
  ShieldAlert,
} from "lucide-react";

async function safeJsonParse(res: Response, fallback = "Terjadi kesalahan pada sistem. Silakan coba kembali.") {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text && text.length < 200 && !text.startsWith("<") ? text : fallback };
  }
}

export default function ChangePasswordPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params.tenant as string;
  const { data: session, update } = useSession();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleKeyModifier = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setIsCapsLockOn(e.getModifierState("CapsLock"));
    }
  };

  // Real-time security criteria
  const hasMinLength = newPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumberOrSymbol = /[\d\W_]/.test(newPassword);
  const isMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  const criteriaCount = [hasMinLength, hasUpperCase, hasLowerCase, hasNumberOrSymbol].filter(Boolean).length;
  const isStrong = hasMinLength && hasUpperCase && hasLowerCase && hasNumberOrSymbol;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setErrorMessage("Kata sandi saat ini wajib diisi.");
      return;
    }
    if (!isStrong) {
      setErrorMessage("Kata sandi baru belum memenuhi seluruh kriteria keamanan institusi.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Konfirmasi kata sandi baru tidak cocok.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await safeJsonParse(res, "Gagal memperbarui kata sandi.");

      if (!res.ok) {
        throw new Error(data.error || "Gagal memperbarui kata sandi.");
      }

      setSuccessMessage(
        "Kata sandi berhasil diperbarui! Seluruh sesi aktif di perangkat lain telah dinonaktifkan demi keamanan akun Anda."
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      if (update) {
        try {
          await update();
        } catch {
          // ignore session update errors
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan saat menyimpan kata sandi baru.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full pb-10">
      <PageHeader
        title="Ganti Kata Sandi"
        description="Perbarui kredensial kata sandi akun Anda untuk melindungi akses data dan portal institusi."
      />

      {/* Grid 2 Kolom Modern */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri: Kartu Form Ganti Kata Sandi (7 Kolom) */}
        <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-[10px] p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-[#F1F5F9]">
            <div className="w-7 h-7 rounded-[6px] bg-[#EFF6FF] text-[#1E40AF] flex items-center justify-center">
              <KeyRound className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <h2 className="text-sm font-semibold text-[#0F172A]">
              Formulir Pembaruan Kata Sandi
            </h2>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="p-3.5 bg-red-50 border border-red-200 text-xs text-[#B91C1C] rounded-[8px] flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              className="p-3.5 bg-emerald-50 border border-emerald-200 text-xs text-[#15803D] rounded-[8px] flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {isCapsLockOn && (
            <div className="flex items-center gap-2 text-xs text-[#B45309] bg-[#FEF3C7] border border-[#FDE68A] px-3 py-2 rounded-[8px]">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#B45309]" />
              <span>Caps Lock sedang aktif. Periksa huruf besar/kecil sandi Anda.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input 1: Kata Sandi Saat Ini */}
            <div className="space-y-1.5">
              <label
                htmlFor="currentPassword"
                className="block text-xs font-semibold text-[#334155]"
              >
                Kata Sandi Saat Ini
              </label>
              <div className="relative">
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type={showCurrent ? "text" : "password"}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  onKeyDown={handleKeyModifier}
                  onKeyUp={handleKeyModifier}
                  placeholder="Masukkan kata sandi saat ini"
                  className="w-full h-10 px-3 pr-10 text-xs bg-white text-[#0F172A] border border-[#CBD5E1] rounded-[8px] transition focus:outline-none focus:ring-2 focus:ring-[#1E40AF] placeholder:text-[#94A3B8]"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] transition cursor-pointer p-1"
                  aria-label={showCurrent ? "Sembunyikan kata sandi saat ini" : "Tampilkan kata sandi saat ini"}
                >
                  {showCurrent ? (
                    <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                  ) : (
                    <Eye className="w-4 h-4" strokeWidth={1.75} />
                  )}
                </button>
              </div>
            </div>

            {/* Input 2: Kata Sandi Baru */}
            <div className="space-y-1.5">
              <label
                htmlFor="newPassword"
                className="block text-xs font-semibold text-[#334155]"
              >
                Kata Sandi Baru
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  name="newPassword"
                  type={showNew ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onKeyDown={handleKeyModifier}
                  onKeyUp={handleKeyModifier}
                  placeholder="Minimal 8 karakter kombinasi"
                  className="w-full h-10 px-3 pr-10 text-xs bg-white text-[#0F172A] border border-[#CBD5E1] rounded-[8px] transition focus:outline-none focus:ring-2 focus:ring-[#1E40AF] placeholder:text-[#94A3B8]"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] transition cursor-pointer p-1"
                  aria-label={showNew ? "Sembunyikan kata sandi baru" : "Tampilkan kata sandi baru"}
                >
                  {showNew ? (
                    <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                  ) : (
                    <Eye className="w-4 h-4" strokeWidth={1.75} />
                  )}
                </button>
              </div>

              {/* Password Strength Meter Bar */}
              <div className="pt-1.5 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                  <span>Tingkat Kekuatan Sandi:</span>
                  <span className="font-semibold">
                    {criteriaCount === 0 && "Belum diisi"}
                    {criteriaCount === 1 && "Sangat Lemah"}
                    {criteriaCount === 2 && "Sedang"}
                    {criteriaCount === 3 && "Kuat"}
                    {criteriaCount === 4 && "Sangat Kuat"}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-[#E2E8F0] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      criteriaCount <= 1
                        ? "bg-red-500 w-1/4"
                        : criteriaCount === 2
                        ? "bg-amber-500 w-2/4"
                        : criteriaCount === 3
                        ? "bg-blue-500 w-3/4"
                        : "bg-emerald-500 w-full"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Input 3: Konfirmasi Kata Sandi Baru */}
            <div className="space-y-1.5">
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold text-[#334155]"
              >
                Konfirmasi Kata Sandi Baru
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={handleKeyModifier}
                  onKeyUp={handleKeyModifier}
                  placeholder="Ulangi kata sandi baru persis sama"
                  className="w-full h-10 px-3 pr-10 text-xs bg-white text-[#0F172A] border border-[#CBD5E1] rounded-[8px] transition focus:outline-none focus:ring-2 focus:ring-[#1E40AF] placeholder:text-[#94A3B8]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] transition cursor-pointer p-1"
                  aria-label={showConfirm ? "Sembunyikan konfirmasi kata sandi" : "Tampilkan konfirmasi kata sandi"}
                >
                  {showConfirm ? (
                    <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                  ) : (
                    <Eye className="w-4 h-4" strokeWidth={1.75} />
                  )}
                </button>
              </div>
              {confirmPassword.length > 0 && !isMatch && (
                <p className="text-[11px] text-red-600 mt-1">
                  Konfirmasi kata sandi belum sama persis dengan kata sandi baru.
                </p>
              )}
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={isLoading || !isStrong || !isMatch || !currentPassword}
                className="w-full h-10 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-[8px] transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1E40AF]">
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Simpan Kata Sandi Baru</span>
              </button>
            </div>
          </form>
        </div>

        {/* Kolom Kanan: Standar Keamanan & Proteksi Sesi (5 Kolom) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Kartu Standar Keamanan */}
          <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#F1F5F9]">
              <div className="w-7 h-7 rounded-[6px] bg-[#F0FDF4] text-[#15803D] flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <h2 className="text-sm font-semibold text-[#0F172A]">
                Standar Keamanan Kata Sandi
              </h2>
            </div>

            <p className="text-xs text-[#64748B] leading-relaxed">
              Sandi harus memenuhi kriteria berikut. Indikator berubah menjadi hijau secara otomatis saat Anda mengetik:
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center gap-2.5">
                {hasMinLength ? (
                  <Check className="w-4 h-4 text-emerald-600 stroke-[2.5] shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-[#94A3B8] shrink-0" />
                )}
                <span className={hasMinLength ? "text-emerald-700 font-medium" : "text-[#64748B]"}>
                  Minimal 8 karakter
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                {hasUpperCase ? (
                  <Check className="w-4 h-4 text-emerald-600 stroke-[2.5] shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-[#94A3B8] shrink-0" />
                )}
                <span className={hasUpperCase ? "text-emerald-700 font-medium" : "text-[#64748B]"}>
                  Mengandung huruf besar (A-Z)
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                {hasLowerCase ? (
                  <Check className="w-4 h-4 text-emerald-600 stroke-[2.5] shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-[#94A3B8] shrink-0" />
                )}
                <span className={hasLowerCase ? "text-emerald-700 font-medium" : "text-[#64748B]"}>
                  Mengandung huruf kecil (a-z)
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                {hasNumberOrSymbol ? (
                  <Check className="w-4 h-4 text-emerald-600 stroke-[2.5] shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-[#94A3B8] shrink-0" />
                )}
                <span className={hasNumberOrSymbol ? "text-emerald-700 font-medium" : "text-[#64748B]"}>
                  Mengandung angka atau simbol khusus
                </span>
              </div>
            </div>
          </div>

          {/* Kartu Proteksi Sesi & Keamanan Multi-Perangkat */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] p-6 text-xs text-[#475569] space-y-3">
            <div className="flex items-center gap-2 text-[#0F172A] font-semibold text-sm">
              <Lock className="w-4 h-4 text-[#1E40AF]" strokeWidth={1.75} />
              <span>Proteksi Sesi Aktif</span>
            </div>
            <p className="leading-relaxed">
              Untuk melindungi integritas akun Anda, setiap kali kata sandi berhasil diperbarui:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-[11px] text-[#475569]">
              <li>
                Versi sesi (<code className="bg-white px-1.5 py-0.5 rounded border border-[#CBD5E1] font-mono text-[10px]">sessionVersion</code>) dinaikkan secara otomatis.
              </li>
              <li>
                Semua sesi login lama di peramban dan perangkat lain langsung dibatalkan (fail-closed).
              </li>
              <li>
                Notifikasi keamanan akan dikirimkan ke nomor WhatsApp terdaftar.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
