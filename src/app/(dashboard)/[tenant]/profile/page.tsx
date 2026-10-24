"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getRoleBadgeLabel } from "@/lib/i18n/terminology";
import {
  User,
  KeyRound,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Check,
  Circle,
} from "lucide-react";

export default function UserProfilePage() {
  const params = useParams();
  const tenantSlug = params.tenant as string;
  const { data: session, update } = useSession();

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Change Phone State
  const [newPhone, setNewPhone] = useState("");
  const [phoneStep, setPhoneStep] = useState<"INPUT" | "OTP">("INPUT");
  const [otpCode, setOtpCode] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSuccess, setPhoneSuccess] = useState<string | null>(null);

  const user = session?.user;
  const isSchool = tenantSlug.toLowerCase().includes("sman") || tenantSlug.toLowerCase().includes("sekolah");
  const roleLabel = getRoleBadgeLabel(user?.activeRole || "STUDENT", isSchool);

  // Real-time password checklist
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && (hasNumber || hasSpecial);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!isPasswordValid) {
      setPasswordError("Kata sandi baru belum memenuhi standar keamanan institusi.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Konfirmasi kata sandi baru tidak cocok.");
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah kata sandi.");

      setPasswordSuccess("Kata sandi berhasil diubah! Gunakan kata sandi baru untuk login berikutnya.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleSendPhoneOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!newPhone.trim() || newPhone.trim().length < 10) {
      setPhoneError("Silakan masukkan nomor telepon yang valid (min. 10 digit).");
      return;
    }

    setPhoneLoading(true);
    setPhoneError(null);

    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationPhone: newPhone.trim(),
          channel: "WHATSAPP",
          purpose: "PHONE_CHANGE",
          tenantSlug,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirimkan kode OTP.");

      setPhoneStep("OTP");
    } catch (err: any) {
      setPhoneError(err.message);
    } finally {
      setPhoneLoading(false);
    }
  }

  async function handleVerifyPhoneChange(e: React.FormEvent) {
    e.preventDefault();
    if (otpCode.trim().length !== 6) {
      setPhoneError("Kode OTP harus terdiri dari 6 digit.");
      return;
    }

    setPhoneLoading(true);
    setPhoneError(null);

    try {
      const res = await fetch("/api/auth/change-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPhone: newPhone.trim(),
          otpCode: otpCode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memverifikasi penggantian nomor telepon.");

      setPhoneSuccess("Nomor telepon berhasil diperbarui dan diverifikasi!");
      setPhoneStep("INPUT");
      setNewPhone("");
      setOtpCode("");
      if (update) update();
    } catch (err: any) {
      setPhoneError(err.message);
    } finally {
      setPhoneLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Profil & Keamanan Akun"
        description="Kelola informasi identitas akun civitas, keamanan kata sandi, dan nomor telepon verifikasi."
      />

      {/* 1. Ringkasan Profil Civitas */}
      <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[#F1F5F9]">
          <User className="w-4 h-4 text-[#1E40AF]" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-[#0F172A]">Informasi Akun Institusi</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px]">
            <span className="text-[11px] text-[#64748B]">Nama Lengkap</span>
            <div className="font-semibold text-[#0F172A] mt-0.5">{user?.fullName || (user as any)?.name || '-'}</div>
          </div>

          <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px]">
            <span className="text-[11px] text-[#64748B]">Nomor Identitas (NIM / NIDN)</span>
            <div className="font-mono font-semibold text-[#0F172A] mt-0.5">{user?.identifier || "-"}</div>
          </div>

          <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px]">
            <span className="text-[11px] text-[#64748B]">Peran di Portal</span>
            <div className="font-semibold text-[#1E40AF] mt-0.5">{roleLabel}</div>
          </div>

          <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px]">
            <span className="text-[11px] text-[#64748B]">Email Institusi</span>
            <div className="font-mono text-[#0F172A] mt-0.5 truncate">{user?.email || "-"}</div>
          </div>

          <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px]">
            <span className="text-[11px] text-[#64748B]">Status Akun</span>
            <div className="font-semibold text-[#15803D] mt-0.5 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#15803D]" />
              <span>Aktif</span>
            </div>
          </div>

          <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px]">
            <span className="text-[11px] text-[#64748B]">Institusi</span>
            <div className="font-semibold text-[#0F172A] mt-0.5 capitalize">{tenantSlug}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 2. Form Ganti Kata Sandi */}
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#F1F5F9]">
            <KeyRound className="w-4 h-4 text-[#1E40AF]" strokeWidth={1.75} />
            <h3 className="text-sm font-semibold text-[#0F172A]">Ganti Kata Sandi</h3>
          </div>

          {passwordError && (
            <div className="p-3 bg-red-50 border border-red-200 text-xs text-[#B91C1C] rounded-[6px]">
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-[#15803D] rounded-[6px]">
              {passwordSuccess}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label htmlFor="currentPassword" className="block text-xs font-medium text-[#334155] mb-1">Kata Sandi Saat Ini</label>
              <input
                id="currentPassword"
                type="password"
                required
                aria-label="Kata Sandi Saat Ini"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full h-8 px-2.5 text-xs border border-[#CBD5E1] rounded-[6px]"
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-xs font-medium text-[#334155] mb-1">Kata Sandi Baru</label>
              <input
                id="newPassword"
                type="password"
                required
                aria-label="Kata Sandi Baru"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-8 px-2.5 text-xs border border-[#CBD5E1] rounded-[6px]"
              />
            </div>

            {/* Checklist Syarat Password */}
            <div className="p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] space-y-1 text-[11px]">
              <span className="font-semibold text-[#475569] block mb-1">Standar Keamanan:</span>
              <div className={`flex items-center gap-1.5 ${hasMinLength ? "text-[#15803D] font-medium" : "text-[#64748B]"}`}>
                {hasMinLength ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3 h-3" />}
                <span>Minimal 8 karakter</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasUppercase && hasLowercase ? "text-[#15803D] font-medium" : "text-[#64748B]"}`}>
                {hasUppercase && hasLowercase ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3 h-3" />}
                <span>Kombinasi huruf besar dan kecil</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasNumber || hasSpecial ? "text-[#15803D] font-medium" : "text-[#64748B]"}`}>
                {hasNumber || hasSpecial ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3 h-3" />}
                <span>Memuat angka atau simbol</span>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-medium text-[#334155] mb-1">Ulangi Kata Sandi Baru</label>
              <input
                id="confirmPassword"
                type="password"
                required
                aria-label="Ulangi Kata Sandi Baru"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full h-8 px-2.5 text-xs border border-[#CBD5E1] rounded-[6px]"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={passwordLoading || !isPasswordValid}
                className="w-full h-9 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-[6px] transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {passwordLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Perbarui Kata Sandi</span>
              </button>
            </div>
          </form>
        </div>

        {/* 3. Form Ubah Nomor Telepon / WhatsApp */}
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#F1F5F9]">
            <Smartphone className="w-4 h-4 text-[#1E40AF]" strokeWidth={1.75} />
            <h3 className="text-sm font-semibold text-[#0F172A]">Nomor WhatsApp / HP</h3>
          </div>

          {phoneError && (
            <div className="p-3 bg-red-50 border border-red-200 text-xs text-[#B91C1C] rounded-[6px]">
              {phoneError}
            </div>
          )}

          {phoneSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-[#15803D] rounded-[6px]">
              {phoneSuccess}
            </div>
          )}

          {phoneStep === "INPUT" ? (
            <form onSubmit={handleSendPhoneOtp} className="space-y-3">
              <p className="text-xs text-[#64748B]">
                Nomor ini digunakan untuk verifikasi OTP saat masuk atau pemulihan kata sandi.
              </p>

              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Nomor WhatsApp / Telepon Baru</label>
                <input
                  type="tel"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="08123456789 atau +628123456789"
                  className="w-full h-8 px-2.5 text-xs border border-[#CBD5E1] rounded-[6px]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={phoneLoading}
                  className="w-full h-9 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-[6px] transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {phoneLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Kirim OTP Verifikasi</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyPhoneChange} className="space-y-3">
              <p className="text-xs text-[#64748B]">
                Masukkan 6 digit kode OTP yang telah dikirimkan ke <strong>{newPhone}</strong>:
              </p>

              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Kode OTP 6 Digit</label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456"
                  className="w-full h-9 text-center font-mono text-base font-bold tracking-widest border border-[#CBD5E1] rounded-[6px]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPhoneStep("INPUT")}
                  className="flex-1 h-9 border border-[#E2E8F0] text-xs font-medium rounded-[6px] hover:bg-[#F8FAFC]"
                >
                  Ubah Nomor
                </button>
                <button
                  type="submit"
                  disabled={phoneLoading || otpCode.length !== 6}
                  className="flex-1 h-9 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-[6px] transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {phoneLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Verifikasi & Simpan</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
