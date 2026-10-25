"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getRoleBadgeLabel } from "@/lib/i18n/terminology";
import {
  User as UserIcon,
  Smartphone,
  ShieldCheck,
  KeyRound,
  Mail,
  Building2,
  GraduationCap,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  RefreshCw,
  PhoneCall,
} from "lucide-react";
import dynamic from "next/dynamic";

const DevOtpInbox = dynamic(
  () => import("@/components/dev/dev-otp-inbox").then((mod) => mod.DevOtpInbox),
  { ssr: false }
);

interface UserProfileData {
  id: string;
  fullName: string;
  loginEmail: string;
  contactEmail: string;
  phone: string;
  phoneVerifiedAt?: string | null;
  status: string;
  createdAt: string;
  primaryIdentifier: string;
  institutionName: string;
  institutionSlug: string;
  departmentName: string;
  role: string;
  identifiers: Array<{
    type: string;
    value: string;
    isPrimary: boolean;
    isLoginEnabled: boolean;
  }>;
}

async function safeJsonParse(res: Response, fallback = "Terjadi kesalahan pada sistem. Silakan coba kembali.") {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text && text.length < 200 && !text.startsWith("<") ? text : fallback };
  }
}

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params.tenant as string;
  const { data: session, update } = useSession();

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Change Phone State
  const [newPhone, setNewPhone] = useState("");
  const [phoneStep, setPhoneStep] = useState<"INPUT" | "OTP">("INPUT");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSuccess, setPhoneSuccess] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setLoadingProfile(true);
      setProfileError(null);
      const res = await fetch("/api/auth/profile");
      const data = await safeJsonParse(res, "Gagal memuat profil pengguna.");
      if (!res.ok) {
        throw new Error(data.error || "Gagal memuat profil pengguna.");
      }
      setProfile(data.profile || data);
    } catch (err: any) {
      setProfileError(err.message || "Gagal memuat data profil.");
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const isSchool =
    tenantSlug.toLowerCase().includes("sman") ||
    tenantSlug.toLowerCase().includes("sekolah");

  const effectiveRole = profile?.role || session?.user?.activeRole || "STUDENT";
  const roleLabel = getRoleBadgeLabel(effectiveRole, isSchool);
  const displayName = profile?.fullName || session?.user?.fullName || "Pengguna";
  const primaryId = profile?.primaryIdentifier || session?.user?.identifier || "-";

  // 1. Kirim OTP ganti nomor HP
  async function handleSendPhoneOtp(e: React.FormEvent) {
    e.preventDefault();
    const clean = newPhone.trim();
    if (!clean || clean.length < 10) {
      setPhoneError("Silakan masukkan nomor telepon yang valid (min. 10 digit).");
      return;
    }

    setPhoneLoading(true);
    setPhoneError(null);
    setPhoneSuccess(null);

    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationPhone: clean,
          channel: "WHATSAPP",
          purpose: "CHANGE_PHONE",
          tenantSlug,
        }),
      });

      const data = await safeJsonParse(res, "Gagal mengirimkan kode OTP.");
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengirimkan kode OTP.");
      }

      setChallengeId(data.challengeId || null);
      setPhoneStep("OTP");
    } catch (err: any) {
      setPhoneError(err.message || "Gagal mengirimkan OTP ke nomor baru.");
    } finally {
      setPhoneLoading(false);
    }
  }

  // 2. Verifikasi OTP & Simpan nomor HP baru
  async function handleVerifyPhoneChange(e: React.FormEvent) {
    e.preventDefault();
    if (otpCode.trim().length !== 6) {
      setPhoneError("Kode OTP harus terdiri dari 6 digit.");
      return;
    }

    setPhoneLoading(true);
    setPhoneError(null);
    setPhoneSuccess(null);

    try {
      const res = await fetch("/api/auth/change-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPhone: newPhone.trim(),
          otpCode: otpCode.trim(),
          challengeId,
        }),
      });

      const data = await safeJsonParse(res, "Gagal memverifikasi penggantian nomor telepon.");
      if (!res.ok) {
        throw new Error(data.error || "Gagal memverifikasi penggantian nomor telepon.");
      }

      setPhoneSuccess("Nomor WhatsApp / telepon berhasil diperbarui dan diverifikasi!");
      setPhoneStep("INPUT");
      setNewPhone("");
      setOtpCode("");
      setChallengeId(null);
      await fetchProfile();
      if (update) update();
    } catch (err: any) {
      setPhoneError(err.message || "Gagal memverifikasi OTP penggantian nomor.");
    } finally {
      setPhoneLoading(false);
    }
  }

  return (
    <div className="space-y-6 w-full max-w-full pb-10">
      <PageHeader
        title="Profil & Akun Saya"
        description="Informasi identitas resmi institusi, data kontak sivitas akademika, dan pengaturan nomor verifikasi."
      />

      {profileError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-[8px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{profileError}</span>
          </div>
          <button
            type="button"
            onClick={fetchProfile}
            className="underline text-red-700 font-semibold hover:text-red-900 cursor-pointer"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Profile Hero Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-[10px] shadow-xs overflow-hidden">
        {/* Banner with subtle tenant accent */}
        <div
          className="h-24 sm:h-28 w-full bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 relative opacity-90"
          style={{
            background: "var(--tenant-accent, linear-gradient(135deg, #1E3A8A 0%, #1E40AF 50%, #0F172A 100%))",
          }}
        >
          <div className="absolute inset-0 bg-black/15" />
        </div>

        {/* Hero Body */}
        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-10 sm:-mt-12 mb-4">
            {/* Avatar & Basic Info */}
            <div className="flex items-end gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#1E40AF] text-white flex items-center justify-center text-2xl sm:text-3xl font-bold shadow-md border-4 border-white shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-bold text-[#0F172A]">
                    {displayName}
                  </h1>
                  <span className="font-mono text-xs text-[#475569] bg-[#F1F5F9] px-2.5 py-0.5 rounded-[6px] border border-[#E2E8F0] font-medium">
                    {primaryId}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-0.5 bg-[#EFF6FF] text-[#1E40AF] font-semibold rounded-[6px] border border-[#DBEAFE]">
                    {roleLabel}
                  </span>
                  <span className="px-2 py-0.5 bg-[#F0FDF4] text-[#15803D] font-medium rounded-[6px] border border-[#DCFCE7] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
                    <span>Aktif</span>
                  </span>
                  {profile?.departmentName && (
                    <span className="text-[#64748B] hidden md:inline">
                      • {profile.departmentName}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Shortcut Button to Change Password */}
            <div className="flex items-center gap-2 pt-2 sm:pt-0 shrink-0">
              <button
                type="button"
                onClick={() => router.push(`/${tenantSlug}/change-password`)}
                className="h-9 px-3.5 bg-white hover:bg-[#F8FAFC] text-[#0F172A] border border-[#CBD5E1] hover:border-[#94A3B8] text-xs font-semibold rounded-[8px] transition flex items-center gap-2 shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1E40AF]">
                <KeyRound className="w-4 h-4 text-[#1E40AF]" strokeWidth={1.75} />
                <span>Ganti Kata Sandi</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#64748B]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid 2 Kolom Proporsional */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kolom Kiri: Kartu Identitas Akademik & Kontak Resmi */}
        <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-[6px] bg-[#EFF6FF] text-[#1E40AF] flex items-center justify-center">
                <GraduationCap className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <h2 className="text-sm font-semibold text-[#0F172A]">
                Identitas Akademik & Kontak Resmi
              </h2>
            </div>
            <span className="text-[11px] text-[#64748B] bg-[#F8FAFC] px-2 py-0.5 rounded border border-[#E2E8F0]">
              Terverifikasi Institusi
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px]">
              <span className="text-[11px] text-[#64748B] block mb-1">Nama Lengkap</span>
              <div className="font-semibold text-[#0F172A]">{displayName}</div>
            </div>

            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px]">
              <span className="text-[11px] text-[#64748B] block mb-1">Nomor Identitas (NIM / NIDN)</span>
              <div className="font-mono font-semibold text-[#0F172A]">{primaryId}</div>
            </div>

            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-[#64748B]">Email Resmi Institusi</span>
                <span className="text-[9px] bg-[#DBEAFE] text-[#1E40AF] font-bold px-1.5 py-0.2 rounded">LOGIN</span>
              </div>
              <div className="font-mono font-medium text-[#0F172A] truncate" title={profile?.loginEmail || "-"}>
                {profile?.loginEmail || "-"}
              </div>
            </div>

            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-[#64748B]">Email Pribadi (Kontak)</span>
                <span className="text-[9px] bg-[#F1F5F9] text-[#64748B] font-bold px-1.5 py-0.2 rounded">PRIBADI</span>
              </div>
              <div className="font-mono text-[#0F172A] truncate" title={profile?.contactEmail || "-"}>
                {profile?.contactEmail || "-"}
              </div>
            </div>

            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px]">
              <span className="text-[11px] text-[#64748B] block mb-1">Institusi</span>
              <div className="font-semibold text-[#0F172A]">
                {profile?.institutionName || tenantSlug.toUpperCase()}
              </div>
            </div>

            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px]">
              <span className="text-[11px] text-[#64748B] block mb-1">Peran Akademik</span>
              <div className="font-semibold text-[#1E40AF]">{roleLabel}</div>
            </div>

            {profile?.departmentName && (
              <div className="sm:col-span-2 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px]">
                <span className="text-[11px] text-[#64748B] block mb-1">Program Studi / Departemen</span>
                <div className="font-semibold text-[#0F172A]">{profile.departmentName}</div>
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Kartu Pembaruan Nomor WhatsApp / Telepon */}
        <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-6 shadow-xs space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[6px] bg-[#EFF6FF] text-[#1E40AF] flex items-center justify-center">
                  <Smartphone className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <h2 className="text-sm font-semibold text-[#0F172A]">
                  Nomor WhatsApp & Telepon Terverifikasi
                </h2>
              </div>
            </div>

            {/* Current Phone Status Box */}
            <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] flex items-center justify-between text-xs">
              <div>
                <span className="text-[11px] text-[#64748B] block">Nomor Aktif Saat Ini:</span>
                <div className="font-mono font-bold text-sm text-[#0F172A] mt-0.5">
                  {profile?.phone || "Belum ditautkan"}
                </div>
              </div>
              {profile?.phone ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F0FDF4] border border-[#BBF7D0] rounded-[6px] text-xs font-semibold text-[#15803D]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Terverifikasi</span>
                </div>
              ) : (
                <span className="text-[11px] text-[#B45309] bg-[#FEF3C7] px-2 py-0.5 rounded">
                  Belum Ada Nomor
                </span>
              )}
            </div>

            {phoneError && (
              <div className="p-3 bg-red-50 border border-red-200 text-xs text-[#B91C1C] rounded-[8px] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{phoneError}</span>
              </div>
            )}

            {phoneSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-[#15803D] rounded-[8px] flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
                <span>{phoneSuccess}</span>
              </div>
            )}

            {phoneStep === "INPUT" ? (
              <form onSubmit={handleSendPhoneOtp} className="space-y-3.5 pt-1">
                <p className="text-xs text-[#64748B] leading-relaxed">
                  Ganti nomor kontak WhatsApp/telepon untuk menerima OTP masuk portal dan pemulihan akun.
                </p>

                <div>
                  <label htmlFor="newPhone" className="block text-xs font-semibold text-[#334155] mb-1.5">
                    Nomor WhatsApp / HP Baru
                  </label>
                  <input
                    id="newPhone"
                    type="tel"
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="08123456789 atau +628123456789"
                    className="w-full h-9 px-3 text-xs bg-white text-[#0F172A] border border-[#CBD5E1] rounded-[8px] transition focus:outline-none focus:ring-2 focus:ring-[#1E40AF] placeholder:text-[#94A3B8]"
                  />
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={phoneLoading || !newPhone.trim()}
                    className="w-full h-9 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-[8px] transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs cursor-pointer">
                    {phoneLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Kirim OTP Verifikasi</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyPhoneChange} className="space-y-3.5 pt-1">
                <p className="text-xs text-[#64748B]">
                  Masukkan 6 digit kode OTP yang telah dikirimkan ke <strong className="text-[#0F172A] font-mono">{newPhone}</strong>:
                </p>

                <div>
                  <label htmlFor="otpCode" className="block text-xs font-semibold text-[#334155] mb-1.5">
                    Kode OTP 6 Digit
                  </label>
                  <input
                    id="otpCode"
                    type="text"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="w-full h-10 text-center font-mono text-base font-bold tracking-widest bg-white text-[#0F172A] border border-[#CBD5E1] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneStep("INPUT");
                      setOtpCode("");
                    }}
                    className="flex-1 h-9 border border-[#CBD5E1] text-[#334155] text-xs font-medium rounded-[8px] hover:bg-[#F8FAFC] transition cursor-pointer"
                  >
                    Ubah Nomor
                  </button>
                  <button
                    type="submit"
                    disabled={phoneLoading || otpCode.length !== 6}
                    className="flex-1 h-9 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-[8px] transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs cursor-pointer"
                  >
                    {phoneLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Verifikasi & Simpan</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Dev Only OTP Inbox Panel */}
          {process.env.NODE_ENV !== "production" && (
            <div className="mt-4 pt-4 border-t border-[#F1F5F9]">
              <DevOtpInbox
                activePhone={newPhone || profile?.phone}
                onSelectCode={(code) => setOtpCode(code)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
