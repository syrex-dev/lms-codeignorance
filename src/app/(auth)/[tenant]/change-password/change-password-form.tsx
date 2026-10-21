"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
  Lock,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

interface ChangePasswordFormProps {
  tenantSlug: string;
  userIdentifier: string;
}

export function ChangePasswordForm({
  tenantSlug,
  userIdentifier,
}: ChangePasswordFormProps) {
  const router = useRouter();
  const { update } = useSession();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Validasi real-time
  const isMinLength = newPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const isNotSameAsId =
    newPassword.length > 0 &&
    newPassword.toLowerCase() !== userIdentifier.toLowerCase();
  const isMatching =
    confirmPassword.length > 0 && newPassword === confirmPassword;

  const isFormValid =
    isMinLength &&
    hasLetter &&
    hasNumber &&
    isNotSameAsId &&
    isMatching;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      setErrorMessage("Harap lengkapi semua kriteria password yang ditentukan.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Gagal memperbarui password.");
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);

      // Perbarui status session NextAuth di sisi client
      await update({ mustChangePassword: false });

      // Beri jeda 1 detik lalu arahkan ke dashboard
      setTimeout(() => {
        router.push(`/${tenantSlug}/dashboard`);
        router.refresh();
      }, 1000);
    } catch {
      setErrorMessage("Terjadi kesalahan jaringan. Silakan coba kembali.");
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="text-center py-6 space-y-4">
        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h4 className="text-lg font-bold text-slate-900 dark:text-white">
          Password Berhasil Diperbarui!
        </h4>
        <p className="text-xs text-slate-500">
          Mengalihkan Anda secara otomatis ke halaman dashboard utama...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start space-x-2.5 text-red-700 dark:text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Input Password Baru */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
          Password Baru
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Lock className="w-4 h-4" />
          </div>
          <input
            type={showPassword ? "text" : "password"}
            id="new-password-input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimal 8 karakter (huruf & angka)"
            className="w-full pl-10 pr-11 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 dark:text-white"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Input Konfirmasi Password */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
          Konfirmasi Password Baru
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Lock className="w-4 h-4" />
          </div>
          <input
            type={showPassword ? "text" : "password"}
            id="confirm-password-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Ketik ulang password baru..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 dark:text-white"
            required
          />
        </div>
      </div>

      {/* Checklist Kriteria Keamanan */}
      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
        <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Kriteria Keamanan Password:
        </div>

        <div className="flex items-center space-x-2">
          {isMinLength ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
          )}
          <span className={isMinLength ? "text-emerald-700 dark:text-emerald-400 font-medium" : "text-slate-500"}>
            Panjang minimal 8 karakter
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {hasLetter && hasNumber ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
          )}
          <span className={hasLetter && hasNumber ? "text-emerald-700 dark:text-emerald-400 font-medium" : "text-slate-500"}>
            Kombinasi huruf dan angka
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {isNotSameAsId ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
          )}
          <span className={isNotSameAsId ? "text-emerald-700 dark:text-emerald-400 font-medium" : "text-slate-500"}>
            Tidak boleh sama dengan ID pengguna ({userIdentifier})
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {isMatching ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
          )}
          <span className={isMatching ? "text-emerald-700 dark:text-emerald-400 font-medium" : "text-slate-500"}>
            Konfirmasi password cocok
          </span>
        </div>
      </div>

      <button
        type="submit"
        id="change-password-submit-btn"
        disabled={!isFormValid || isLoading}
        className={`w-full py-3 px-4 rounded-xl font-semibold text-sm text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 flex items-center justify-center space-x-2 transition-all transform active:scale-[0.98] bg-blue-600 hover:bg-blue-700 ${
          !isFormValid || isLoading ? "opacity-60 cursor-not-allowed" : ""
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Menyimpan Password...</span>
          </>
        ) : (
          <>
            <span>Simpan Password & Masuk Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}
