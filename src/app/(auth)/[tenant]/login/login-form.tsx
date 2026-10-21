"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, KeyRound, User, AlertCircle, Sparkles } from "lucide-react";

interface LoginFormProps {
  tenantSlug: string;
  institutionType: "SCHOOL" | "UNIVERSITY";
  institutionDomain: string;
}

export function LoginForm({
  tenantSlug,
  institutionType,
  institutionDomain,
}: LoginFormProps) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isUniversity = institutionType === "UNIVERSITY";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setErrorMessage("ID/Email dan Password wajib diisi.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await signIn("credentials", {
        redirect: false,
        identifier: identifier.trim(),
        password,
        tenantSlug,
      });

      if (result?.error) {
        setErrorMessage(result.error);
        setIsLoading(false);
      } else {
        // Berhasil login: router refresh dan arahkan ke dashboard
        // Jika mustChangePassword == true, middleware akan otomatis mengarahkan ke change-password
        router.push(`/${tenantSlug}/dashboard`);
        router.refresh();
      }
    } catch {
      setErrorMessage("Terjadi kesalahan koneksi. Silakan coba beberapa saat lagi.");
      setIsLoading(false);
    }
  };

  // Helper cepat autofill demo
  const fillDemoAccount = (demoId: string, demoPass: string) => {
    setIdentifier(demoId);
    setPassword(demoPass);
    setErrorMessage(null);
  };

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start space-x-3 text-red-700 dark:text-red-300 text-sm animate-shake">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <p className="leading-snug">{errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
            {isUniversity ? "NIM / NIDN / ID Staf atau Email" : "NIS / NUPTK / ID Staf atau Email"}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              id="identifier-input"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={`Contoh: ${isUniversity ? "24TI0001" : "24MIPA0001"} atau @${institutionDomain}`}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 dark:text-white"
              autoComplete="username"
              required
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Password
            </label>
            <span className="text-xs text-slate-400">
              Default password = ID Anda
            </span>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              id="password-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password..."
              className="w-full pl-10 pr-11 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 dark:text-white"
              autoComplete="current-password"
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

        <button
          type="submit"
          id="login-submit-btn"
          disabled={isLoading}
          className={`w-full py-3 px-4 rounded-xl font-semibold text-sm text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 flex items-center justify-center space-x-2 transition-all transform active:scale-[0.98] ${
            isUniversity
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-emerald-600 hover:bg-emerald-700"
          } ${isLoading ? "opacity-75 cursor-not-allowed" : ""}`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Memverifikasi Akun...</span>
            </>
          ) : (
            <span>Masuk ke Platform</span>
          )}
        </button>
      </form>

      {/* Demo Account Quick-Pick Section */}
      <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Akun Demo Siap Pakai (Klik untuk Mengisi):</span>
        </div>

        {isUniversity ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                id="demo-student-converted-btn"
                onClick={() => fillDemoAccount("cindy.permata@gmail.com", "PasswordPendaftar123!")}
                className="p-2 text-left bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700/60 border border-emerald-300 dark:border-emerald-700/80 rounded-lg transition-all"
              >
                <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                  Mhs Konversi
                </div>
                <div className="text-[11px] font-semibold text-slate-800 dark:text-white truncate">
                  cindy.permata@...
                </div>
              </button>

              <button
                type="button"
                id="demo-student-btn"
                onClick={() => fillDemoAccount("24TI0001", "24TI0001")}
                className="p-2 text-left bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 rounded-lg transition-all"
              >
                <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                  Mhs Reguler
                </div>
                <div className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                  24TI0001
                </div>
              </button>

              <button
                type="button"
                id="demo-teacher-btn"
                onClick={() => fillDemoAccount("DSN001", "DSN001")}
                className="p-2 text-left bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 rounded-lg transition-all"
              >
                <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                  Dosen
                </div>
                <div className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                  DSN001
                </div>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="demo-admin-btn"
                onClick={() => fillDemoAccount("ADM001", "ADM001")}
                className="p-2 text-left bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 rounded-lg transition-all"
              >
                <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                  Admin Kampus
                </div>
                <div className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                  ADM001
                </div>
              </button>

              <button
                type="button"
                id="demo-finance-btn"
                onClick={() => fillDemoAccount("KEU001", "KEU001")}
                className="p-2 text-left bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700/60 border border-amber-200 dark:border-amber-800 rounded-lg transition-all"
              >
                <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                  Staf Keuangan
                </div>
                <div className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                  KEU001
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              id="demo-student-btn"
              onClick={() => fillDemoAccount("24MIPA0001", "24MIPA0001")}
              className="p-2 text-left bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 rounded-lg transition-all"
            >
              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                Siswa
              </div>
              <div className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                24MIPA0001
              </div>
            </button>

            <button
              type="button"
              id="demo-teacher-btn"
              onClick={() => fillDemoAccount("GRU001", "GRU001")}
              className="p-2 text-left bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 rounded-lg transition-all"
            >
              <div className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase">
                Guru
              </div>
              <div className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                GRU001
              </div>
            </button>

            <button
              type="button"
              id="demo-admin-btn"
              onClick={() => fillDemoAccount("STF001", "STF001")}
              className="p-2 text-left bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 rounded-lg transition-all"
            >
              <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                Admin TU
              </div>
              <div className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                STF001
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
