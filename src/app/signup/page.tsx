"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, CheckCircle2, Building2 } from "lucide-react";
import dynamic from "next/dynamic";

const DevOtpInbox = dynamic(
  () => import("@/components/dev/dev-otp-inbox").then((mod) => mod.DevOtpInbox),
  { ssr: false }
);

export default function TenantSignupPage() {
  const router = useRouter();

  const [step, setStep] = useState<"FORM" | "OTP" | "SUCCESS">("FORM");
  const [type, setType] = useState<"SCHOOL" | "UNIVERSITY">("SCHOOL");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [challengeId, setChallengeId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [destinationMasked, setDestinationMasked] = useState("");

  const [createdInfo, setCreatedInfo] = useState<{
    tenantSlug: string;
    adminId: string;
    adminEmail: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSlugChange = (val: string) => {
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/saas/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SEND_OTP",
          name,
          slug,
          type,
          adminFullName,
          adminPhone,
          adminPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setChallengeId(data.challengeId);
      setDestinationMasked(data.destinationMasked);
      setStep("OTP");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/saas/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "VERIFY_AND_CREATE",
          name,
          slug,
          type,
          adminFullName,
          adminPhone,
          adminPassword,
          challengeId,
          otpCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCreatedInfo({
        tenantSlug: data.tenantSlug,
        adminId: data.adminId,
        adminEmail: data.adminEmail,
      });
      setStep("SUCCESS");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
        {/* Header */}
        <div className="text-center">
          <div className="w-10 h-10 rounded-[6px] bg-[#1F4E8C] text-white flex items-center justify-center mx-auto mb-2.5">
            <Building2 className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <span className="text-xs font-semibold text-[#1F4E8C] bg-[#EBF2FA] px-2.5 py-0.5 rounded-[4px]">
            Pendaftaran Institusi Baru
          </span>
          <h1 className="text-xl font-semibold text-[#111827] mt-2 tracking-tight">
            Pendaftaran Mandiri Institusi
          </h1>
          <p className="text-xs text-[#4B5563] mt-1">
            Mulai evaluasi sistem akademik terpadu untuk sekolah atau perguruan tinggi
          </p>
        </div>

        {/* Form Card */}
        <div className="mt-5 bg-white py-6 px-6 sm:px-8 border border-[#E3E6EB] rounded-[6px] shadow-none">
          {error && (
            <div
              role="alert"
              className="mb-4 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-[6px] text-xs text-[#B91C1C]"
            >
              {error}
            </div>
          )}

          {step === "FORM" && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#111827] mb-1">
                  Jenis institusi
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType("SCHOOL")}
                    className={`h-9 px-3 text-xs font-medium rounded-[6px] border transition ${
                      type === "SCHOOL"
                        ? "border-[#1F4E8C] bg-[#EBF2FA] text-[#1F4E8C]"
                        : "border-[#E3E6EB] bg-white text-[#4B5563] hover:bg-[#F6F7F9]"
                    }`}
                  >
                    Sekolah (SMA/SMK/SMP)
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("UNIVERSITY")}
                    className={`h-9 px-3 text-xs font-medium rounded-[6px] border transition ${
                      type === "UNIVERSITY"
                        ? "border-[#1F4E8C] bg-[#EBF2FA] text-[#1F4E8C]"
                        : "border-[#E3E6EB] bg-white text-[#4B5563] hover:bg-[#F6F7F9]"
                    }`}
                  >
                    Perguruan Tinggi
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="instName" className="block text-xs font-medium text-[#111827] mb-1">
                  Nama resmi institusi
                </label>
                <input
                  id="instName"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug || slug === "") {
                      handleSlugChange(e.target.value);
                    }
                  }}
                  placeholder="Contoh: SMA Negeri 2 Jakarta"
                  className="w-full h-9 px-3 text-sm bg-white text-[#111827] border border-[#E3E6EB] rounded-[6px] transition focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1 placeholder:text-[#9CA3AF]"
                />
              </div>

              <div>
                <label htmlFor="instSlug" className="block text-xs font-medium text-[#111827] mb-1">
                  Subdomain / URL portal
                </label>
                <div className="flex items-center">
                  <span className="h-9 px-3 bg-[#F6F7F9] border border-r-0 border-[#E3E6EB] rounded-l-[6px] text-xs text-[#6B7280] flex items-center font-mono">
                    domain.id/
                  </span>
                  <input
                    id="instSlug"
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="sman2-jkt"
                    className="w-full h-9 px-3 text-sm font-mono bg-white text-[#111827] border border-[#E3E6EB] rounded-r-[6px] transition focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1 placeholder:text-[#9CA3AF]"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-[#E3E6EB]">
                <h3 className="text-xs font-semibold text-[#111827] mb-3">
                  Informasi administrator pertama
                </h3>

                <div className="space-y-3">
                  <div>
                    <label htmlFor="adminName" className="block text-xs font-medium text-[#111827] mb-1">
                      Nama lengkap admin
                    </label>
                    <input
                      id="adminName"
                      type="text"
                      required
                      value={adminFullName}
                      onChange={(e) => setAdminFullName(e.target.value)}
                      placeholder="Contoh: Budi Hartono, M.Kom"
                      className="w-full h-9 px-3 text-sm bg-white text-[#111827] border border-[#E3E6EB] rounded-[6px] transition focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1 placeholder:text-[#9CA3AF]"
                    />
                  </div>

                  <div>
                    <label htmlFor="adminPhone" className="block text-xs font-medium text-[#111827] mb-1">
                      Nomor ponsel WhatsApp aktif
                    </label>
                    <input
                      id="adminPhone"
                      type="tel"
                      required
                      value={adminPhone}
                      onChange={(e) => setAdminPhone(e.target.value)}
                      placeholder="081234567890"
                      className="w-full h-9 px-3 text-sm bg-white text-[#111827] border border-[#E3E6EB] rounded-[6px] transition focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1 placeholder:text-[#9CA3AF]"
                    />
                  </div>

                  <div>
                    <label htmlFor="adminPass" className="block text-xs font-medium text-[#111827] mb-1">
                      Kata sandi admin
                    </label>
                    <input
                      id="adminPass"
                      type="password"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Minimal 8 karakter campuran"
                      className="w-full h-9 px-3 text-sm bg-white text-[#111827] border border-[#E3E6EB] rounded-[6px] transition focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1 placeholder:text-[#9CA3AF]"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-9 mt-4 bg-[#1F4E8C] hover:bg-[#183E6F] text-white text-xs font-semibold rounded-[6px] transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1 disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />}
                <span>Lanjutkan verifikasi OTP</span>
              </button>
            </form>
          )}

          {step === "OTP" && (
            <form onSubmit={handleVerifyAndCreate} className="space-y-4">
              <div className="p-3 bg-[#F6F7F9] border border-[#E3E6EB] rounded-[6px] text-xs text-[#4B5563]">
                Kode verifikasi telah dikirim ke nomor WhatsApp <strong className="text-[#111827]">{destinationMasked || adminPhone}</strong>.
              </div>

              <div>
                <label htmlFor="otpCode" className="block text-xs font-medium text-[#111827] mb-1">
                  Masukkan 6 digit kode OTP
                </label>
                <input
                  id="otpCode"
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full h-9 px-3 text-sm font-mono tracking-widest text-center bg-white text-[#111827] border border-[#E3E6EB] rounded-[6px] transition focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className="w-full h-9 bg-[#1F4E8C] hover:bg-[#183E6F] text-white text-xs font-semibold rounded-[6px] transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1 disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />}
                <span>Verifikasi dan aktifkan institusi</span>
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setStep("FORM")}
                  className="text-xs text-[#4B5563] hover:text-[#111827] inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Ubah data pendaftaran</span>
                </button>
              </div>
            </form>
          )}

          {step === "SUCCESS" && createdInfo && (
            <div className="text-center py-4 space-y-4">
              <div className="w-10 h-10 rounded-full bg-[#F0FDF4] text-[#15803D] flex items-center justify-center mx-auto border border-[#BBF7D0]">
                <CheckCircle2 className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <h2 className="text-base font-semibold text-[#111827]">
                Pendaftaran institusi berhasil
              </h2>
              <div className="p-3 bg-[#F6F7F9] border border-[#E3E6EB] rounded-[6px] text-xs text-left space-y-1 font-mono">
                <div>URL Portal: <strong>/{createdInfo.tenantSlug}/login</strong></div>
                <div>ID Admin: <strong>{createdInfo.adminId}</strong></div>
                <div>Email Admin: <strong>{createdInfo.adminEmail}</strong></div>
              </div>
              <div className="pt-2">
                <Link
                  href={`/${createdInfo.tenantSlug}/login`}
                  className="w-full inline-flex items-center justify-center h-9 bg-[#1F4E8C] hover:bg-[#183E6F] text-white text-xs font-semibold rounded-[6px] transition"
                >
                  Menuju halaman login institusi
                </Link>
              </div>
            </div>
          )}

          {/* Dev Only OTP Inbox Panel */}
          {process.env.NODE_ENV !== "production" && (
            <DevOtpInbox
              activePhone={adminPhone}
              onSelectCode={(code) => setOtpCode(code)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
