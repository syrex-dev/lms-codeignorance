"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { DemoAccountsPanel } from "@/components/dev/demo-accounts-panel";

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
      setErrorMessage("Nomor identitas dan kata sandi wajib diisi.");
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
        window.location.href = `/${tenantSlug}/dashboard`;
      }
    } catch {
      setErrorMessage("Terjadi gangguan koneksi ke server. Silakan coba kembali.");
      setIsLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div
            role="alert"
            className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-[6px] text-xs text-[#B91C1C]"
          >
            {errorMessage}
          </div>
        )}

        <div>
          <label
            htmlFor="identifier"
            className="block text-xs font-medium text-[#111827] mb-1"
          >
            {isUniversity ? "Nomor Induk (NIM / NIDN) atau email" : "Nomor Induk (NIS / NUPTK) atau email"}
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
            className="w-full h-9 px-3 text-sm bg-white text-[#111827] border border-[#E3E6EB] rounded-[6px] transition focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1 placeholder:text-[#9CA3AF]"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-[#111827]"
            >
              Kata sandi
            </label>
            <Link
              href={`/${tenantSlug}/forgot-password`}
              className="text-xs text-[#1F4E8C] hover:underline"
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
              placeholder="Masukkan kata sandi"
              className="w-full h-9 pl-3 pr-10 text-sm bg-white text-[#111827] border border-[#E3E6EB] rounded-[6px] transition focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1 placeholder:text-[#9CA3AF]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111827] p-1"
              aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" strokeWidth={1.5} />
              ) : (
                <Eye className="w-4 h-4" strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-9 mt-2 bg-[#1F4E8C] hover:bg-[#183E6F] text-white text-xs font-semibold rounded-[6px] transition flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1 disabled:opacity-50 select-none"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />}
          <span>Masuk</span>
        </button>
      </form>

      {/* Dev Only Demo Accounts Accordion */}
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
