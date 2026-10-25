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
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  PhoneCall,
  Copy,
  Check,
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(label);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // 1. Kirim OTP ganti nomor HP
  async function handleSendPhoneOtp(e: React.FormEvent) {
    e.preventDefault();
    const clean = newPhone.trim();
    if (!clean) {
      setPhoneError("Silakan masukkan nomor telepon atau WhatsApp Anda terlebih dahulu.");
      return;
    }
    if (clean.length < 10) {
      setPhoneError("Nomor telepon minimal 10 digit (contoh: 08123456789).");
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
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center justify-between shadow-xs">
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

      {/* Unified Executive Profile Header */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden border-t-4 border-[var(--tenant-accent,#1E40AF)]">
        <div className="p-4 sm:p-6 lg:p-8 bg-gradient-to-r from-blue-50/50 via-white to-slate-50/40 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          {/* Left: Avatar & Basic Details */}
          <div className="flex items-center gap-5">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl text-white flex items-center justify-center text-2xl sm:text-3xl font-bold shadow-sm ring-4 ring-blue-50 shrink-0"
              style={{ backgroundColor: "var(--tenant-accent, #1E40AF)" }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A]">
                  {displayName}
                </h1>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100/90 text-slate-700 rounded-lg border border-slate-200/80 font-mono text-xs font-semibold">
                  <span>{primaryId}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(primaryId, "primaryId")}
                    className="text-slate-400 hover:text-slate-700 transition cursor-pointer p-0.5"
                    title="Salin ID"
                  >
                    {copiedId === "primaryId" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-0.5 bg-blue-50 text-[var(--tenant-accent,#1E40AF)] font-semibold rounded-full border border-blue-200/60">
                  {roleLabel}
                </span>
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-medium rounded-full border border-emerald-200/60 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Aktif</span>
                </span>
                {profile?.departmentName && (
                  <span className="text-slate-500 font-medium">
                    • {profile.departmentName}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Secondary Action (Ganti Kata Sandi) */}
          <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0">
            <button
              type="button"
              onClick={() => router.push(`/${tenantSlug}/change-password`)}
              className="h-10 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--tenant-accent,#1E40AF)]"
            >
              <KeyRound className="w-4 h-4 text-slate-500" strokeWidth={1.75} />
              <span>Ganti Kata Sandi</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid 2 Kolom Proporsional */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kolom Kiri: Kartu Identitas Akademik & Kontak Resmi */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[var(--tenant-accent,#1E40AF)] flex items-center justify-center">
                <GraduationCap className="w-4 h-4" strokeWidth={2} />
              </div>
              <h2 className="text-sm font-semibold text-[#0F172A]">
                Identitas Akademik & Kontak Resmi
              </h2>
            </div>
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
              Terverifikasi Institusi
            </span>
          </div>

          {/* Clean Description List / Property Grid */}
          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
              <div className="flex items-center gap-2 text-slate-500 font-medium">
                <UserIcon className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Nama Lengkap</span>
              </div>
              <div className="font-semibold text-[#0F172A] text-left sm:text-right">{displayName}</div>
            </div>

            <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
              <div className="flex items-center gap-2 text-slate-500 font-medium">
                <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Nomor Identitas (NIM / NIDN)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-[#0F172A]">{primaryId}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(primaryId, "primaryId_list")}
                  className="text-slate-400 hover:text-slate-600 transition p-1 rounded-md hover:bg-slate-100 cursor-pointer"
                  title="Salin"
                >
                  {copiedId === "primaryId_list" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
              <div className="flex items-center gap-2 text-slate-500 font-medium">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Email Resmi Institusi</span>
              </div>
              <div className="flex items-center gap-2 text-left sm:text-right min-w-0 max-w-full">
                <span className="text-[10px] bg-blue-50 text-[var(--tenant-accent,#1E40AF)] font-bold px-1.5 py-0.5 rounded border border-blue-200/60 shrink-0">
                  LOGIN
                </span>
                <span className="font-mono font-medium text-[#0F172A] max-w-[140px] sm:max-w-[200px] truncate" title={profile?.loginEmail || "-"}>
                  {profile?.loginEmail || "-"}
                </span>
                {profile?.loginEmail && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(profile.loginEmail, "loginEmail")}
                    className="text-slate-400 hover:text-slate-600 transition p-1 rounded-md hover:bg-slate-100 cursor-pointer shrink-0"
                    title="Salin Email"
                  >
                    {copiedId === "loginEmail" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
              <div className="flex items-center gap-2 text-slate-500 font-medium">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Email Kontak Pribadi</span>
              </div>
              <div className="font-mono text-slate-700 text-left sm:text-right max-w-[180px] sm:max-w-[220px] truncate" title={profile?.contactEmail || "-"}>
                {profile?.contactEmail || "-"}
              </div>
            </div>

            <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
              <div className="flex items-center gap-2 text-slate-500 font-medium">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Institusi</span>
              </div>
              <div className="font-semibold text-[#0F172A] text-left sm:text-right">
                {profile?.institutionName || tenantSlug.toUpperCase()}
              </div>
            </div>

            <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
              <div className="flex items-center gap-2 text-slate-500 font-medium">
                <GraduationCap className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Peran Akademik</span>
              </div>
              <div className="font-semibold text-[var(--tenant-accent,#1E40AF)] text-left sm:text-right">
                {roleLabel}
              </div>
            </div>

            {profile?.departmentName && (
              <div className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-slate-500 font-medium">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Program Studi</span>
                </div>
                <div className="font-semibold text-[#0F172A] text-right">
                  {profile.departmentName}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Kartu Pembaruan Nomor WhatsApp / Telepon */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[var(--tenant-accent,#1E40AF)] flex items-center justify-center">
                  <Smartphone className="w-4 h-4" strokeWidth={2} />
                </div>
                <h2 className="text-sm font-semibold text-[#0F172A]">
                  Nomor WhatsApp & Telepon Terverifikasi
                </h2>
              </div>
            </div>

            {/* Current Phone Status Box */}
            <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="text-[11px] text-slate-500 block font-medium">Nomor Aktif Saat Ini:</span>
                <div className="font-mono font-bold text-sm text-[#0F172A] mt-0.5">
                  {profile?.phone || "Belum ditautkan"}
                </div>
              </div>
              {profile?.phone ? (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200/60 rounded-full text-xs font-semibold text-emerald-700">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Terverifikasi</span>
                </div>
              ) : (
                <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200/60 px-2.5 py-0.5 rounded-full font-medium">
                  Belum Ada Nomor
                </span>
              )}
            </div>

            {phoneError && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-start gap-2 shadow-xs">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{phoneError}</span>
              </div>
            )}

            {phoneSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 rounded-xl flex items-start gap-2 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{phoneSuccess}</span>
              </div>
            )}

            {phoneStep === "INPUT" ? (
              <form onSubmit={handleSendPhoneOtp} className="space-y-4 pt-1">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Ganti nomor kontak WhatsApp/telepon untuk menerima OTP masuk portal dan pemulihan akun.
                </p>

                <div>
                  <label htmlFor="newPhone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nomor WhatsApp / HP Baru
                  </label>
                  <input
                    id="newPhone"
                    type="tel"
                    value={newPhone}
                    onChange={(e) => {
                      setNewPhone(e.target.value);
                      if (phoneError) setPhoneError(null);
                    }}
                    placeholder="08123456789 atau +628123456789"
                    className="w-full h-10 px-3.5 text-xs bg-white text-[#0F172A] border border-slate-300 rounded-xl transition focus:outline-none focus:ring-2 focus:ring-[var(--tenant-accent,#1E40AF)] placeholder:text-slate-400"
                  />
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={phoneLoading}
                    className="w-full h-10 bg-[var(--tenant-accent,#1E40AF)] hover:opacity-95 text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--tenant-accent,#1E40AF)] focus:ring-offset-2"
                  >
                    {phoneLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Kirim OTP Verifikasi</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyPhoneChange} className="space-y-4 pt-1">
                <div className="p-3.5 bg-blue-50/70 border border-blue-200/60 rounded-xl text-xs text-blue-900 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-blue-700 block">Kode OTP dikirimkan ke:</span>
                    <span className="font-mono font-bold text-sm text-blue-950">{newPhone}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneStep("INPUT");
                      setOtpCode("");
                      setPhoneError(null);
                    }}
                    className="text-xs text-[var(--tenant-accent,#1E40AF)] font-semibold hover:underline cursor-pointer"
                  >
                    Ubah Nomor
                  </button>
                </div>

                <div>
                  <label htmlFor="otpCode" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Masukkan 6 Digit Kode OTP
                  </label>
                  <input
                    id="otpCode"
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="w-full h-11 px-3.5 font-mono text-center tracking-widest text-lg font-bold bg-white text-[#0F172A] border border-slate-300 rounded-xl transition focus:outline-none focus:ring-2 focus:ring-[var(--tenant-accent,#1E40AF)]"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneStep("INPUT");
                      setOtpCode("");
                    }}
                    className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={phoneLoading || otpCode.length !== 6}
                    className="flex-1 h-10 bg-[var(--tenant-accent,#1E40AF)] hover:opacity-95 text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--tenant-accent,#1E40AF)]"
                  >
                    {phoneLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verifikasi & Simpan Nomor</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Dev OTP Helper */}
          <div className="pt-4 border-t border-slate-100">
            <DevOtpInbox
              activePhone={newPhone.trim() || undefined}
              onSelectCode={(code: string) => setOtpCode(code)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
