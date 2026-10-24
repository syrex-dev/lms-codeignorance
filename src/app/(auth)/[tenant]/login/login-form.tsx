"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import dynamic from "next/dynamic";

const DemoAccountsPanel = dynamic(
  () => import("@/components/dev/demo-accounts-panel").then((mod) => mod.DemoAccountsPanel),
  { ssr: false }
);

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
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isUniversity = institutionType === "UNIVERSITY";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setIsCapsLockOn(e.getModifierState("CapsLock"));
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setIsCapsLockOn(e.getModifierState("CapsLock"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setErrorMessage("Silakan isi nomor identitas dan kata sandi");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await signIn("credentials", {
        redirect: false,
        tenantSlug,
        identifier: identifier.trim(),
        password,
      });

      if (result?.error) {
        setErrorMessage(result.error);
        setIsLoading(false);
      } else {
        router.push(`/${tenantSlug}/dashboard`);
        router.refresh();
      }
    } catch {
      setErrorMessage("Terjadi kesalahan sistem. Silakan coba beberapa saat lagi.");
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div
            role="alert"
            className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-[8px] flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="identifier"
            className="block text-xs font-semibold text-[#334155]"
          >
            {isUniversity ? "NIM / NIDN atau Email Institusi" : "NISN / NIP atau Email"}
          </label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            required
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={isUniversity ? "Contoh: 2301010011" : "Contoh: 202310001"}
            className="w-full h-10 px-3 text-xs bg-white border border-[#CBD5E1] rounded-[8px] text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-[#1E40AF] transition"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-[#334155]"
            >
              Kata Sandi
            </label>
            <Link
              href={`/${tenantSlug}/forgot-password`}
              className="text-[11px] font-medium text-[#1E40AF] hover:underline"
            >
              Lupa kata sandi?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              placeholder="••••••••"
              className="w-full h-10 px-3 pr-10 text-xs bg-white border border-[#CBD5E1] rounded-[8px] text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:border-[#1E40AF] transition"
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

          {/* Indikator Caps Lock */}
          {isCapsLockOn && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#B45309] bg-[#FEF3C7] border border-[#FDE68A] px-2.5 py-1 rounded-[6px] mt-1.5 animate-in fade-in duration-150">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
              <span>Caps Lock aktif. Periksa huruf besar/kecil kata sandi.</span>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-10 mt-3 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-[8px] transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] focus:ring-offset-2 disabled:opacity-50 select-none shadow-sm"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />}
          <span>Masuk ke Akun</span>
        </button>
      </form>

      {/* Dev Only Demo Accounts Accordion with 1-Click Auto-Fill */}
      {process.env.NODE_ENV !== "production" && (
        <DemoAccountsPanel
          tenantSlug={tenantSlug}
          isUniversity={isUniversity}
          onSelectAccount={(selectedId, selectedPass) => {
            setIdentifier(selectedId);
            setPassword(selectedPass);
          }}
        />
      )}
    </div>
  );
}
