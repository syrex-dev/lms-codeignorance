"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

interface OnboardingFormProps {
  tenantSlug: string;
  isPhonePrefilled: boolean;
  maskedPhone: string | null;
  initialPhone: string;
}

export default function OnboardingForm({
  tenantSlug,
  isPhonePrefilled,
  maskedPhone,
  initialPhone,
}: OnboardingFormProps) {
  const router = useRouter();
  const { update } = useSession();

  const [step, setStep] = useState<"PHONE" | "OTP" | "PASSWORD">("PHONE");
  const [phone, setPhone] = useState(initialPhone);
  const [birthDate, setBirthDate] = useState("");
  const [channel, setChannel] = useState<"WHATSAPP" | "SMS">("WHATSAPP");

  // OTP state
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [maskedDestination, setMaskedDestination] = useState<string | null>(maskedPhone);
  const [cooldown, setCooldown] = useState(0);

  // Password state
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Kirim OTP
  const handleSendOtp = async (targetChannel?: "WHATSAPP" | "SMS") => {
    setLoading(true);
    setError(null);
    const chosenChannel = targetChannel || channel;

    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: chosenChannel,
          purpose: "FIRST_ACTIVATION",
          destinationPhone: phone,
          birthDate: !isPhonePrefilled ? birthDate : undefined,
          tenantSlug,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengirim kode verifikasi.");
      }

      setChallengeId(data.challengeId);
      setMaskedDestination(data.destinationMasked);
      setCooldown(data.cooldownSeconds || 60);
      setStep("OTP");
      setSuccessMsg(`Kode verifikasi dikirim ke ${data.destinationMasked} via ${chosenChannel}.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Verifikasi Kode OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeId || !otpCode) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId,
          code: otpCode,
          purpose: "FIRST_ACTIVATION",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Kode verifikasi tidak valid.");
      }

      setVerificationToken(data.verificationToken);
      setStep("PASSWORD");
      setSuccessMsg("Nomor handphone berhasil diverifikasi! Sekarang buat password baru Anda.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Simpan Password Baru dan Selesaikan Aktivasi
  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationToken) {
      setError("Token verifikasi tidak ditemukan. Silakan verifikasi ulang.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password tidak cocok dengan password baru.");
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
        throw new Error(data.error || "Gagal memperbarui password.");
      }

      setSuccessMsg(data.message || "Aktivasi selesai! Mengalihkan ke dashboard...");

      // Update session NextAuth agar status menjadi ACTIVE dan mustChangePassword = false
      await update({
        status: "ACTIVE",
        mustChangePassword: false,
        sessionVersion: data.sessionVersion,
      });

      setTimeout(() => {
        router.push(`/${tenantSlug}/dashboard`);
        router.refresh();
      }, 1200);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Alert Error / Success */}
      {error && (
        <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-xl text-xs text-red-300 animate-fadeIn">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-950/50 border border-emerald-800/80 rounded-xl text-xs text-emerald-300 animate-fadeIn">
          {successMsg}
        </div>
      )}

      {/* Tautan Dev Outbox (Hanya saat dev) */}
      <div className="p-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl flex items-center justify-between text-xs text-slate-300">
        <span>Mode Dev: Butuh melihat simulasi kode OTP?</span>
        <a
          href="/dev/outbox"
          target="_blank"
          rel="noreferrer"
          className="text-amber-400 hover:text-amber-300 underline font-semibold ml-2"
        >
          Buka Dev Outbox ↗
        </a>
      </div>

      {/* LANGKAH 1: KONFIRMASI IDENTITAS & PILIH SALURAN */}
      {step === "PHONE" && (
        <div className="space-y-4">
          {isPhonePrefilled ? (
            <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl">
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Nomor Handphone Terdaftar (Terkunci oleh Admin):
              </label>
              <div className="text-sm font-mono font-bold text-slate-200">{maskedPhone}</div>
              <p className="text-[11px] text-slate-500 mt-1">
                Kode OTP verifikasi akan dikirimkan ke nomor ini.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Nomor Handphone Anda (WhatsApp / SMS)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Tanggal Lahir (Faktor Verifikasi Kedua)
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Masukkan tanggal lahir yang cocok dengan data pendaftaran Anda.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Pilih Saluran Pengiriman Kode OTP:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setChannel("WHATSAPP")}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  channel === "WHATSAPP"
                    ? "bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-sm"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <span>💬</span> WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setChannel("SMS")}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  channel === "SMS"
                    ? "bg-blue-950/60 border-blue-500 text-blue-300 shadow-sm"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <span>✉️</span> SMS
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleSendOtp()}
            disabled={loading || (!isPhonePrefilled && (!phone || !birthDate))}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition shadow-lg shadow-indigo-600/30"
          >
            {loading ? "Mengirim Kode..." : "Kirim Kode Verifikasi OTP"}
          </button>
        </div>
      )}

      {/* LANGKAH 2: INPUT KODE OTP */}
      {step === "OTP" && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl text-center">
            <span className="text-[11px] text-slate-400">Kode verifikasi 6-digit dikirim ke:</span>
            <div className="font-mono text-sm font-bold text-white mt-0.5">{maskedDestination}</div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Masukkan 6 Digit Kode OTP
            </label>
            <input
              type="text"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-3 text-center text-2xl font-mono tracking-widest text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || otpCode.length !== 6}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition shadow-lg shadow-indigo-600/30"
          >
            {loading ? "Memverifikasi..." : "Verifikasi Kode"}
          </button>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
            {cooldown > 0 ? (
              <span>Kirim ulang dalam {cooldown}s</span>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSendOtp("WHATSAPP")}
                  disabled={loading}
                  className="text-emerald-400 hover:underline font-semibold"
                >
                  Kirim via WhatsApp
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => handleSendOtp("SMS")}
                  disabled={loading}
                  className="text-blue-400 hover:underline font-semibold"
                >
                  Kirim via SMS
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setStep("PHONE")}
              className="text-slate-400 hover:text-white underline"
            >
              Ubah Data
            </button>
          </div>
        </form>
      )}

      {/* LANGKAH 3: MEMBUAT PASSWORD BARU */}
      {step === "PASSWORD" && (
        <form onSubmit={handleCompleteOnboarding} className="space-y-4">
          <div className="p-3 bg-indigo-950/40 border border-indigo-800/50 rounded-xl text-xs text-indigo-300">
            ✓ Nomor HP terverifikasi. Tetapkan password baru yang aman untuk akun Anda.
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Password Baru
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 8 karakter (huruf & angka)"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Ulangi Password Baru
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Konfirmasi password baru"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl text-[11px] text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">Ketentuan Keamanan Password:</p>
            <p className={newPassword.length >= 8 ? "text-emerald-400" : ""}>
              • Minimal 8 karakter
            </p>
            <p className={/[a-zA-Z]/.test(newPassword) && /\d/.test(newPassword) ? "text-emerald-400" : ""}>
              • Kombinasi huruf dan angka
            </p>
            <p>• Dilarang sama dengan ID, nama, nomor HP, atau tanggal lahir</p>
          </div>

          <button
            type="submit"
            disabled={loading || !newPassword || newPassword !== confirmPassword}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition shadow-lg shadow-emerald-600/30"
          >
            {loading ? "Menyimpan..." : "Aktifkan Akun & Masuk ke Portal"}
          </button>
        </form>
      )}

      {/* Tombol Logout jika ingin ganti akun */}
      <div className="pt-3 text-center border-t border-slate-800">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: `/${tenantSlug}/login` })}
          className="text-xs text-slate-500 hover:text-slate-300 transition"
        >
          Keluar dan login dengan akun lain
        </button>
      </div>
    </div>
  );
}
