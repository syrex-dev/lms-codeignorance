"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import dynamic from "next/dynamic";

const DevOtpInbox = dynamic(
  () => import("@/components/dev/dev-otp-inbox").then((mod) => mod.DevOtpInbox),
  { ssr: false }
);

interface ForgotPasswordFormProps {
  tenantSlug: string;
}

export function ForgotPasswordForm({ tenantSlug }: ForgotPasswordFormProps) {
  const [step, setStep] = useState<"REQUEST" | "RESET" | "SUCCESS">("REQUEST");
  const [identifier, setIdentifier] = useState("");
  const [channel, setChannel] = useState<"WHATSAPP" | "SMS">("WHATSAPP");
  const [challengeId, setChallengeId] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) {
      setErrorMessage("Nomor identitas atau email wajib diisi.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/forgot-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          institutionSlug: tenantSlug,
          channel,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal meminta kode verifikasi.");
      }

      setChallengeId(data.challengeId);
      setMaskedPhone(data.destinationMasked || "");
      setStep("RESET");
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || !newPassword || !confirmPassword) {
      setErrorMessage("Semua isian formulir wajib dilengkapi.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Verifikasi OTP terlebih dahulu
      const verifyRes = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId,
          code: otpCode.trim(),
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "Kode verifikasi tidak valid.");
      }

      const verificationToken = verifyData.verificationToken;

      // 2. Reset kata sandi
      const resetRes = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationToken,
          newPassword,
          confirmPassword,
        }),
      });

      const resetData = await resetRes.json();
      if (!resetRes.ok) {
        throw new Error(resetData.error || "Gagal mengatur ulang kata sandi.");
      }

      setStep("SUCCESS");
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "SUCCESS") {
    return (
      <div className="text-center py-4 space-y-4">
        <div className="w-10 h-10 rounded-full bg-[#F0FDF4] text-[#15803D] flex items-center justify-center mx-auto border border-[#BBF7D0]">
          <CheckCircle2 className="w-5 h-5" strokeWidth={1.75} />
        </div>
        <h2 className="text-base font-semibold text-[#111827]">
          Kata sandi berhasil diperbarui
        </h2>
        <p className="text-xs text-[#4B5563] leading-relaxed">
          Akun Anda telah diamankan dengan kata sandi baru. Silakan masuk kembali menggunakan kredensial baru.
        </p>
        <div className="pt-2">
          <Link
            href={`/${tenantSlug}/login`}
            className="w-full inline-flex items-center justify-center h-9 bg-[#1F4E8C] hover:bg-[#183E6F] text-white text-xs font-semibold rounded-[6px] transition"
          >
            Menuju halaman masuk
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {errorMessage && (
        <div
          role="alert"
          className="mb-4 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-[6px] text-xs text-[#B91C1C]"
        >
          {errorMessage}
        </div>
      )}

      {step === "REQUEST" ? (
        <form onSubmit={handleRequestOtp} className="space-y-4">
          <div>
            <label
              htmlFor="identifier"
              className="block text-xs font-medium text-[#111827] mb-1"
            >
              Nomor Induk atau email terdaftar
            </label>
            <input
              id="identifier"
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Contoh: 2301010011 atau nama@institusi.ac.id"
              className="w-full h-9 px-3 text-sm bg-white text-[#111827] border border-[#E3E6EB] rounded-[6px] transition focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1 placeholder:text-[#9CA3AF]"
            />
            <p className="text-[11px] text-[#6B7280] mt-1">
              Kode verifikasi satu kali (OTP) akan dikirimkan ke nomor ponsel resmi yang tertaut.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#111827] mb-1">
              Kanal pengiriman
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setChannel("WHATSAPP")}
                className={`h-9 px-3 text-xs font-medium rounded-[6px] border transition ${
                  channel === "WHATSAPP"
                    ? "border-[#1F4E8C] bg-[#EBF2FA] text-[#1F4E8C]"
                    : "border-[#E3E6EB] bg-white text-[#4B5563] hover:bg-[#F6F7F9]"
                }`}
              >
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setChannel("SMS")}
                className={`h-9 px-3 text-xs font-medium rounded-[6px] border transition ${
                  channel === "SMS"
                    ? "border-[#1F4E8C] bg-[#EBF2FA] text-[#1F4E8C]"
                    : "border-[#E3E6EB] bg-white text-[#4B5563] hover:bg-[#F6F7F9]"
                }`}
              >
                SMS
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-9 mt-2 bg-[#1F4E8C] hover:bg-[#183E6F] text-white text-xs font-semibold rounded-[6px] transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1 disabled:opacity-50"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />}
            <span>Kirim kode verifikasi</span>
          </button>

          <div className="text-center pt-2">
            <Link
              href={`/${tenantSlug}/login`}
              className="text-xs text-[#4B5563] hover:text-[#111827] inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Kembali ke halaman login</span>
            </Link>
          </div>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="p-3 bg-[#F6F7F9] border border-[#E3E6EB] rounded-[6px] text-xs text-[#4B5563]">
            Kode verifikasi telah dikirim ke <strong className="text-[#111827]">{maskedPhone}</strong>.
          </div>

          <div>
            <label
              htmlFor="otpCode"
              className="block text-xs font-medium text-[#111827] mb-1"
            >
              Kode OTP (6 digit)
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

          <div>
            <label
              htmlFor="newPassword"
              className="block text-xs font-medium text-[#111827] mb-1"
            >
              Kata sandi baru
            </label>
            <input
              id="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 8 karakter campuran"
              className="w-full h-9 px-3 text-sm bg-white text-[#111827] border border-[#E3E6EB] rounded-[6px] transition focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-xs font-medium text-[#111827] mb-1"
            >
              Konfirmasi kata sandi baru
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi kata sandi baru"
              className="w-full h-9 px-3 text-sm bg-white text-[#111827] border border-[#E3E6EB] rounded-[6px] transition focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-9 mt-2 bg-[#1F4E8C] hover:bg-[#183E6F] text-white text-xs font-semibold rounded-[6px] transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1 disabled:opacity-50"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />}
            <span>Simpan kata sandi baru</span>
          </button>
        </form>
      )}

      {/* Dev Only OTP Inbox Panel */}
      {process.env.NODE_ENV !== "production" && (
        <DevOtpInbox
          onSelectCode={(code) => setOtpCode(code)}
        />
      )}
    </div>
  );
}
