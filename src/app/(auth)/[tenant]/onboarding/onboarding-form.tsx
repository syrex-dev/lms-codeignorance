"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Loader2, ArrowRight, ShieldCheck } from "lucide-react";
import { DevOtpInbox } from "@/components/dev/dev-otp-inbox";

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
  const [otpCode, setOtpCode] = useState("");
  const [verificationToken, setVerificationToken] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Kirim OTP
  const handleSendOtp = async (overrideChannel?: "WHATSAPP" | "SMS") => {
    const chosenChannel = overrideChannel || channel;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "FIRST_ACTIVATION",
          channel: chosenChannel,
          destinationPhone: phone,
          birthDate: !isPhonePrefilled ? birthDate : undefined,
          tenantSlug,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengirimkan kode verifikasi.");
      }

      setChallengeId(data.challengeId);
      if (data.destinationMasked) {
        setMaskedDestination(data.destinationMasked);
      }
      setCooldown(data.cooldownSeconds || 60);
      setSuccessMsg(`Kode verifikasi dikirim melalui ${chosenChannel}.`);
      setStep("OTP");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Verifikasi OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeId || !otpCode) {
      setError("Masukkan 6 digit kode verifikasi.");
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
          code: otpCode.trim(),
          purpose: "FIRST_ACTIVATION",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Kode verifikasi tidak cocok.");
      }

      setVerificationToken(data.verificationToken);
      setSuccessMsg("Verifikasi nomor berhasil. Silakan tetapkan kata sandi baru.");
      setStep("PASSWORD");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Simpan Password Baru dan Selesaikan Onboarding
  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationToken) {
      setError("Sesi verifikasi telah kedaluwarsa. Silakan ulangi.");
      setStep("PHONE");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak cocok.");
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
        throw new Error(data.error || "Gagal mengaktifkan akun.");
      }

      setSuccessMsg(data.message || "Aktivasi berhasil! Mengalihkan ke dashboard...");

      // Update session NextAuth di sisi client dengan sessionVersion baru dari server
      await update({
        status: "ACTIVE",
        mustChangePassword: false,
        sessionVersion: data.sessionVersion,
      });

      // Beri waktu cookie ter-update sebelum navigasi ke dashboard
      setTimeout(() => {
        router.push(`/${tenantSlug}/dashboard`);
        router.refresh();
      }, 300);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* 3-Step Wizard Indicator */}
      <div className="flex items-center justify-between border-b border-[#E3E6EB] pb-3 mb-5 text-[11px]">
        <div className={`flex items-center gap-1.5 ${step === "PHONE" ? "text-[#1F4E8C] font-semibold" : "text-[#4B5563]"}`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${step === "PHONE" ? "bg-[#1F4E8C] text-white" : "bg-[#F3F4F6] text-[#4B5563]"}`}>
            1
          </span>
          <span>Verifikasi nomor</span>
        </div>
        <ArrowRight className="w-3 h-3 text-[#9CA3AF]" strokeWidth={1.5} />
        <div className={`flex items-center gap-1.5 ${step === "OTP" ? "text-[#1F4E8C] font-semibold" : "text-[#4B5563]"}`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${step === "OTP" ? "bg-[#1F4E8C] text-white" : "bg-[#F3F4F6] text-[#4B5563]"}`}>
            2
          </span>
          <span>Kode OTP</span>
        </div>
        <ArrowRight className="w-3 h-3 text-[#9CA3AF]" strokeWidth={1.5} />
        <div className={`flex items-center gap-1.5 ${step === "PASSWORD" ? "text-[#1F4E8C] font-semibold" : "text-[#4B5563]"}`}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${step === "PASSWORD" ? "bg-[#1F4E8C] text-white" : "bg-[#F3F4F6] text-[#4B5563]"}`}>
            3
          </span>
          <span>Kata sandi baru</span>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div
          role="alert"
          className="mb-4 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-[6px] text-xs text-[#B91C1C]"
        >
          {error}
        </div>
      )}
      {successMsg && !error && (
        <div
          role="status"
          className="mb-4 p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-[6px] text-xs text-[#15803D]"
        >
          {successMsg}
        </div>
      )}

      {/* LANGKAH 1: VERIFIKASI IDENTITAS & NOMOR HANDPHONE */}
      {step === "PHONE" && (
        <div className="space-y-4">
          {isPhonePrefilled ? (
            <div className="p-3 bg-[#F6F7F9] border border-[#E3E6EB] rounded-[6px] space-y-1">
              <span className="text-[11px] font-medium text-[#4B5563] block">Nomor ponsel terdaftar:</span>
              <span className="text-sm font-semibold text-[#111827] font-mono">
                {maskedPhone || phone}
              </span>
              <p className="text-[11px] text-[#6B7280]">
                Kode OTP verifikasi akun akan dikirimkan ke nomor ini.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="phoneNumber" className="block text-xs font-medium text-[#111827] mb-1">
                  Nomor WhatsApp / Seluler aktif
                </label>
                <input
                  id="phoneNumber"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full h-9 px-3 text-sm bg-white text-[#111827] border border-[#E3E6EB] rounded-[6px] transition focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1 placeholder:text-[#9CA3AF]"
                />
                <p className="text-[11px] text-[#6B7280] mt-1">
                  Gunakan nomor Indonesia aktif (+62). Kode verifikasi akan dikirimkan ke nomor ini.
                </p>
              </div>

              <div>
                <label htmlFor="birthDate" className="block text-xs font-medium text-[#111827] mb-1">
                  Tanggal lahir (faktor verifikasi)
                </label>
                <input
                  id="birthDate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-white text-[#111827] border border-[#E3E6EB] rounded-[6px] transition focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#111827] mb-1">
              Kanal pengiriman OTP
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
            type="button"
            onClick={() => handleSendOtp()}
            disabled={loading || (!isPhonePrefilled && !phone)}
            className="w-full h-9 mt-2 bg-[#1F4E8C] hover:bg-[#183E6F] text-white text-xs font-semibold rounded-[6px] transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1 disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />}
            <span>Kirim Kode Verifikasi OTP</span>
          </button>
        </div>
      )}

      {/* LANGKAH 2: INPUT KODE OTP */}
      {step === "OTP" && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="p-3 bg-[#F6F7F9] border border-[#E3E6EB] rounded-[6px] text-xs text-[#4B5563]">
            Kode 6 digit telah dikirimkan ke <strong className="text-[#111827]">{maskedDestination || phone}</strong>.
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
              placeholder="123456"
              className="w-full h-9 px-3 text-sm font-mono tracking-widest text-center bg-white text-[#111827] border border-[#E3E6EB] rounded-[6px] transition focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1"
            />
          </div>

          <button
            type="submit"
            disabled={loading || otpCode.length !== 6}
            className="w-full h-9 bg-[#1F4E8C] hover:bg-[#183E6F] text-white text-xs font-semibold rounded-[6px] transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1 disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />}
            <span>Verifikasi Kode</span>
          </button>

          <div className="flex items-center justify-between text-xs text-[#4B5563] pt-2">
            <button
              type="button"
              onClick={() => setStep("PHONE")}
              className="hover:underline text-[#4B5563]"
            >
              Ubah nomor ponsel
            </button>
            <button
              type="button"
              disabled={cooldown > 0 || loading}
              onClick={() => handleSendOtp(channel === "WHATSAPP" ? "SMS" : "WHATSAPP")}
              className="hover:underline text-[#1F4E8C] disabled:opacity-50"
            >
              {cooldown > 0 ? `Kirim ulang (${cooldown}d)` : "Kirim ulang"}
            </button>
          </div>
        </form>
      )}

      {/* LANGKAH 3: GANTI PASSWORD BARU */}
      {step === "PASSWORD" && (
        <form onSubmit={handleCompleteOnboarding} className="space-y-4">
          <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-[6px] text-xs text-[#15803D]">
            Nomor ponsel terverifikasi. Tetapkan kata sandi baru untuk menyelesaikan aktivasi akun.
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-xs font-medium text-[#111827] mb-1">
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
            <p className="text-[11px] text-[#6B7280] mt-1">
              Gunakan minimal 8 karakter dengan kombinasi huruf besar, huruf kecil, dan angka/simbol.
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-medium text-[#111827] mb-1">
              Ulangi kata sandi baru
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Konfirmasi password baru"
              className="w-full h-9 px-3 text-sm bg-white text-[#111827] border border-[#E3E6EB] rounded-[6px] transition focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !newPassword || !confirmPassword}
            className="w-full h-9 mt-2 bg-[#1F4E8C] hover:bg-[#183E6F] text-white text-xs font-semibold rounded-[6px] transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1 disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />}
            <span>Aktifkan Akun & Masuk ke Portal</span>
          </button>
        </form>
      )}

      {/* Dev Only OTP Inbox Panel */}
      {process.env.NODE_ENV !== "production" && (
        <DevOtpInbox
          activePhone={phone}
          onSelectCode={(code) => setOtpCode(code)}
        />
      )}
    </div>
  );
}
