"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Loader2,
  ShieldCheck,
  Check,
  Circle,
  MessageSquare,
  Smartphone,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import dynamic from "next/dynamic";

const DevOtpInbox = dynamic(
  () => import("@/components/dev/dev-otp-inbox").then((mod) => mod.DevOtpInbox),
  { ssr: false }
);

interface OnboardingFormProps {
  tenantSlug: string;
  isPhonePrefilled: boolean;
  maskedPhone?: string | null;
  initialPhone?: string;
}

type OnboardingStep = "PHONE" | "OTP" | "PASSWORD";

export default function OnboardingForm({
  tenantSlug,
  isPhonePrefilled,
  maskedPhone,
  initialPhone = "",
}: OnboardingFormProps) {
  const router = useRouter();
  const { data: session, update } = useSession();

  const [step, setStep] = useState<OnboardingStep>("PHONE");
  const [phone, setPhone] = useState(initialPhone);
  const [birthDate, setBirthDate] = useState("");
  const [channel, setChannel] = useState<"WHATSAPP" | "SMS">("WHATSAPP");

  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [maskedDestination, setMaskedDestination] = useState<string | null>(null);

  // 6 separate OTP digits
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [verificationToken, setVerificationToken] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Calculate full OTP code
  const fullOtpCode = otpDigits.join("");

  useEffect(() => {
    let timer: any;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Handle digit change with auto-advance and paste
  const handleDigitChange = (index: number, value: string) => {
    setError(null);
    const cleaned = value.replace(/\D/g, "");

    // If pasted multi-digit string (e.g., from Playwright or copy-paste)
    if (cleaned.length > 1) {
      const newDigits = [...otpDigits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = cleaned[i] || "";
      }
      setOtpDigits(newDigits);
      const nextIndex = Math.min(cleaned.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = cleaned;
    setOtpDigits(newDigits);

    if (cleaned && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      const newDigits = ["", "", "", "", "", ""];
      for (let i = 0; i < pasted.length; i++) {
        newDigits[i] = pasted[i];
      }
      setOtpDigits(newDigits);
      const focusIdx = Math.min(pasted.length, 5);
      otpInputRefs.current[focusIdx]?.focus();
    }
  };

  // 1. KIRIM OTP
  const handleSendOtp = async (channelOverride?: "WHATSAPP" | "SMS") => {
    setLoading(true);
    setError(null);

    const activeChannel = channelOverride || channel;

    try {
      const bodyPayload: any = {
        channel: activeChannel,
      };

      if (!isPhonePrefilled) {
        bodyPayload.phone = phone.trim();
        bodyPayload.birthDate = birthDate;
      }

      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.retryAfter) {
          setCooldown(data.retryAfter);
        }
        throw new Error(data.error || "Gagal mengirimkan kode OTP");
      }

      setChallengeId(data.challengeId);
      setMaskedDestination(data.maskedDestination);
      setCooldown(data.cooldownSeconds || 60);
      setStep("OTP");
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setError(err.message || "Gagal mengirimkan OTP");
    } finally {
      setLoading(false);
    }
  };

  // 2. VERIFIKASI OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullOtpCode.length !== 6) {
      setError("Masukkan 6 digit kode verifikasi");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId,
          code: fullOtpCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Kode OTP tidak valid atau kedaluwarsa");
      }

      setVerificationToken(data.verificationToken);
      setStep("PASSWORD");
    } catch (err: any) {
      setError(err.message || "Verifikasi OTP gagal");
    } finally {
      setLoading(false);
    }
  };

  // 3. SET PASSWORD BARU & AKTIVASI
  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError("Kata sandi minimal 8 karakter");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak cocok");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationToken,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal mengaktifkan akun");
      }

      try {
        await update({
          status: "ACTIVE",
          mustChangePassword: false,
          sessionVersion: data.sessionVersion,
        });
      } catch (e) {
        console.warn("Session update warning:", e);
      }

      window.location.href = `/${tenantSlug}/dashboard`;
    } catch (err: any) {
      setError(err.message || "Gagal menyelesaikan onboarding");
      setLoading(false);
    }
  };

  // Password Checklist criteria
  const hasMinLength = newPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumberOrSymbol = /[\d\W_]/.test(newPassword);
  const passwordScore = [hasMinLength, hasUpperCase, hasLowerCase, hasNumberOrSymbol].filter(Boolean).length;

  return (
    <div className="w-full">
      {/* 3-Step Visual Stepper */}
      <div className="mb-6">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-full bg-[#E2E8F0] -z-0" />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-[#1E40AF] transition-all duration-300 -z-0"
            style={{
              width: step === "PHONE" ? "0%" : step === "OTP" ? "50%" : "100%",
            }}
          />

          {/* Step 1 Circle */}
          <div className="relative z-10 flex flex-col items-center">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                step === "PHONE"
                  ? "bg-[#1E40AF] text-white ring-4 ring-[#DBEAFE]"
                  : "bg-[#1E40AF] text-white"
              }`}
            >
              {step !== "PHONE" ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : "1"}
            </div>
            <span className="text-[10px] font-semibold text-[#475569] mt-1.5 whitespace-nowrap">
              1. Identitas
            </span>
          </div>

          {/* Step 2 Circle */}
          <div className="relative z-10 flex flex-col items-center">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                step === "OTP"
                  ? "bg-[#1E40AF] text-white ring-4 ring-[#DBEAFE]"
                  : step === "PASSWORD"
                  ? "bg-[#1E40AF] text-white"
                  : "bg-white border-2 border-[#CBD5E1] text-[#64748B]"
              }`}
            >
              {step === "PASSWORD" ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : "2"}
            </div>
            <span className="text-[10px] font-semibold text-[#475569] mt-1.5 whitespace-nowrap">
              2. Kode OTP
            </span>
          </div>

          {/* Step 3 Circle */}
          <div className="relative z-10 flex flex-col items-center">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                step === "PASSWORD"
                  ? "bg-[#1E40AF] text-white ring-4 ring-[#DBEAFE]"
                  : "bg-white border-2 border-[#CBD5E1] text-[#64748B]"
              }`}
            >
              3
            </div>
            <span className="text-[10px] font-semibold text-[#475569] mt-1.5 whitespace-nowrap">
              3. Sandi Baru
            </span>
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div
          role="alert"
          className="mb-4 p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-[8px] flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* LANGKAH 1: IDENTITAS & KANAL OTP */}
      {step === "PHONE" && (
        <div className="space-y-4">
          <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] text-xs text-[#475569]">
            {isPhonePrefilled ? (
              <div>
                Nomor ponsel terdaftar institusi:{" "}
                <strong className="text-[#0F172A] font-mono">{maskedPhone}</strong>
              </div>
            ) : (
              <div>
                Silakan lengkapi nomor telepon seluler aktif Anda dan verifikasi tanggal lahir sesuai data registrasi akademik.
              </div>
            )}
          </div>

          {!isPhonePrefilled && (
            <div className="space-y-3">
              <div>
                <label htmlFor="phoneNumber" className="block text-xs font-semibold text-[#334155] mb-1">
                  Nomor Ponsel (WhatsApp / SMS)
                </label>
                <input
                  id="phoneNumber"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full h-10 px-3 text-xs bg-white text-[#0F172A] border border-[#CBD5E1] rounded-[8px] transition focus:outline-none focus:ring-2 focus:ring-[#1E40AF] placeholder:text-[#94A3B8]"
                />
                <p className="text-[11px] text-[#64748B] mt-1">
                  Format nomor Indonesia (+62). Kode verifikasi akan dikirimkan ke nomor ini.
                </p>
              </div>

              <div>
                <label htmlFor="birthDate" className="block text-xs font-semibold text-[#334155] mb-1">
                  Tanggal Lahir (Faktor Verifikasi Keamanan)
                </label>
                <input
                  id="birthDate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-white text-[#0F172A] border border-[#CBD5E1] rounded-[8px] transition focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                />
              </div>
            </div>
          )}

          {/* Interactive Radio Cards untuk Kanal Pengiriman */}
          <div>
            <label className="block text-xs font-semibold text-[#334155] mb-2">
              Pilih Kanal Pengiriman Kode OTP
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setChannel("WHATSAPP")}
                className={`p-3 rounded-[8px] border text-left transition flex items-start gap-2.5 ${
                  channel === "WHATSAPP"
                    ? "border-[#1E40AF] bg-[#EFF6FF] ring-1 ring-[#1E40AF]"
                    : "border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]"
                }`}
              >
                <MessageSquare className={`w-4 h-4 mt-0.5 shrink-0 ${channel === "WHATSAPP" ? "text-[#1E40AF]" : "text-[#64748B]"}`} />
                <div>
                  <div className={`text-xs font-bold ${channel === "WHATSAPP" ? "text-[#1E40AF]" : "text-[#0F172A]"}`}>
                    WhatsApp
                  </div>
                  <div className="text-[10px] text-[#64748B] mt-0.5">Pengiriman cepat & instan</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setChannel("SMS")}
                className={`p-3 rounded-[8px] border text-left transition flex items-start gap-2.5 ${
                  channel === "SMS"
                    ? "border-[#1E40AF] bg-[#EFF6FF] ring-1 ring-[#1E40AF]"
                    : "border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]"
                }`}
              >
                <Smartphone className={`w-4 h-4 mt-0.5 shrink-0 ${channel === "SMS" ? "text-[#1E40AF]" : "text-[#64748B]"}`} />
                <div>
                  <div className={`text-xs font-bold ${channel === "SMS" ? "text-[#1E40AF]" : "text-[#0F172A]"}`}>
                    SMS Seluler
                  </div>
                  <div className="text-[10px] text-[#64748B] mt-0.5">Pesan teks standar</div>
                </div>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleSendOtp()}
            disabled={loading || (!isPhonePrefilled && !phone)}
            className="w-full h-10 mt-2 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-[8px] transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:ring-offset-2 disabled:opacity-50 shadow-sm"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />}
            <span>Kirim Kode Verifikasi OTP</span>
          </button>
        </div>
      )}

      {/* LANGKAH 2: INPUT KODE OTP 6 KOTAK TERPISAH */}
      {step === "OTP" && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] text-xs text-[#475569]">
            Kode verifikasi 6 digit telah dikirimkan ke{" "}
            <strong className="text-[#0F172A] font-mono">{maskedDestination || phone}</strong>.
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#334155] mb-2 text-center">
              Masukkan 6 Digit Kode OTP
            </label>

            {/* 6 Separate Digit Boxes */}
            <div className="flex items-center justify-center gap-2 sm:gap-2.5">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  id={idx === 0 ? "otpCode" : undefined}
                  ref={(el) => {
                    otpInputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={idx === 0 ? "one-time-code" : "off"}
                  maxLength={idx === 0 ? 6 : 1}
                  placeholder={idx === 0 && fullOtpCode.length === 0 ? "123456" : ""}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                  onPaste={handleDigitPaste}
                  className="w-10 sm:w-12 h-12 text-center text-lg font-mono font-bold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-[8px] transition focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-[#1E40AF] shadow-xs"
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || fullOtpCode.length !== 6}
            className="w-full h-10 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-[8px] transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:ring-offset-2 disabled:opacity-50 shadow-sm"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />}
            <span>Verifikasi Kode</span>
          </button>

          <div className="flex items-center justify-between text-xs text-[#475569] pt-1">
            <button
              type="button"
              onClick={() => setStep("PHONE")}
              className="hover:underline text-[#64748B]"
            >
              Ubah nomor ponsel
            </button>
            <button
              type="button"
              disabled={cooldown > 0 || loading}
              onClick={() => handleSendOtp(channel === "WHATSAPP" ? "SMS" : "WHATSAPP")}
              className="hover:underline text-[#1E40AF] font-medium disabled:opacity-50"
            >
              {cooldown > 0 ? `Kirim ulang (${cooldown}d)` : "Kirim ulang"}
            </button>
          </div>

          {/* Dev Only OTP Inbox Panel - only visible on step 2 */}
          {process.env.NODE_ENV !== "production" && (
            <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
              <DevOtpInbox
                activePhone={phone}
                onSelectCode={(code) => {
                  const digits = code.slice(0, 6).split("");
                  setOtpDigits(digits);
                }}
              />
            </div>
          )}
        </form>
      )}

      {/* LANGKAH 3: GANTI PASSWORD BARU DENGAN CHECKLIST SYARAT REAL-TIME */}
      {step === "PASSWORD" && (
        <form onSubmit={handleCompleteOnboarding} className="space-y-4">
          <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-[8px] text-xs text-[#15803D] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-[#15803D]" />
            <span>Nomor ponsel berhasil diverifikasi! Buat kata sandi baru untuk menyelesaikan aktivasi akun.</span>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="newPassword" className="block text-xs font-semibold text-[#334155]">
              Kata Sandi Baru
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 8 karakter campuran"
                className="w-full h-10 px-3 pr-10 text-xs bg-white text-[#0F172A] border border-[#CBD5E1] rounded-[8px] transition focus:outline-none focus:ring-2 focus:ring-[#1E40AF] placeholder:text-[#94A3B8]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] transition"
                aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                ) : (
                  <Eye className="w-4 h-4" strokeWidth={1.75} />
                )}
              </button>
            </div>

            {/* Password Strength Bar */}
            <div className="mt-2">
              <div className="flex items-center justify-between text-[11px] text-[#64748B] mb-1">
                <span>Kekuatan Kata Sandi:</span>
                <span className="font-semibold">
                  {passwordScore === 0 && "Belum Terisi"}
                  {passwordScore === 1 && "Sangat Lemah"}
                  {passwordScore === 2 && "Cukup"}
                  {passwordScore === 3 && "Baik"}
                  {passwordScore === 4 && "Sangat Kuat"}
                </span>
              </div>
              <div className="h-1.5 w-full bg-[#E2E8F0] rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    passwordScore <= 1
                      ? "bg-red-500 w-1/4"
                      : passwordScore === 2
                      ? "bg-amber-500 w-2/4"
                      : passwordScore === 3
                      ? "bg-blue-500 w-3/4"
                      : "bg-emerald-500 w-full"
                  }`}
                />
              </div>
            </div>

            {/* Real-Time Security Checklist */}
            <div className="mt-3 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] space-y-1.5 text-xs">
              <div className="text-[11px] font-semibold text-[#475569] mb-1">
                Syarat Keamanan Kata Sandi:
              </div>

              <div className="flex items-center gap-2">
                {hasMinLength ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-[#94A3B8]" />
                )}
                <span className={hasMinLength ? "text-emerald-700 font-medium" : "text-[#64748B]"}>
                  Minimal 8 karakter
                </span>
              </div>

              <div className="flex items-center gap-2">
                {hasUpperCase ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-[#94A3B8]" />
                )}
                <span className={hasUpperCase ? "text-emerald-700 font-medium" : "text-[#64748B]"}>
                  Mengandung minimal satu huruf besar (A-Z)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {hasLowerCase ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-[#94A3B8]" />
                )}
                <span className={hasLowerCase ? "text-emerald-700 font-medium" : "text-[#64748B]"}>
                  Mengandung minimal satu huruf kecil (a-z)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {hasNumberOrSymbol ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-[#94A3B8]" />
                )}
                <span className={hasNumberOrSymbol ? "text-emerald-700 font-medium" : "text-[#64748B]"}>
                  Mengandung angka atau simbol khusus
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="block text-xs font-semibold text-[#334155]">
              Konfirmasi Kata Sandi Baru
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Konfirmasi password baru"
              className="w-full h-10 px-3 text-xs bg-white text-[#0F172A] border border-[#CBD5E1] rounded-[8px] transition focus:outline-none focus:ring-2 focus:ring-[#1E40AF] placeholder:text-[#94A3B8]"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-[11px] text-red-600 mt-1">
                Kata sandi konfirmasi belum cocok
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !hasMinLength || newPassword !== confirmPassword}
            className="w-full h-10 mt-2 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-[8px] transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:ring-offset-2 disabled:opacity-50 shadow-sm"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />}
            <span>Aktifkan Akun & Masuk ke Portal</span>
          </button>
        </form>
      )}
    </div>
  );
}
