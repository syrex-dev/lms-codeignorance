"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
    // Otomatis ubah nama menjadi slug
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden backdrop-blur-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-3">
            <span>🚀</span> Pendaftaran Mandiri Institusi (SaaS Multi-Tenant)
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Mulai Trial 14 Hari LMS Terpadu
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-md mx-auto">
            Satu sistem untuk Sekolah & Kampus. Fitur lengkap, modul PPDB/PMB, jadwal bebas bentrok, dan aktivasi OTP aman.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-950/50 border border-red-800/80 rounded-xl text-xs text-red-300">
            {error}
          </div>
        )}

        {/* LINK KE DEV OUTBOX */}
        <div className="mb-6 p-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl flex items-center justify-between text-xs text-slate-300">
          <span>Mode Dev: Butuh melihat simulasi kode OTP WhatsApp?</span>
          <a
            href="/dev/outbox"
            target="_blank"
            rel="noreferrer"
            className="text-amber-400 hover:text-amber-300 underline font-semibold ml-2"
          >
            Buka Dev Outbox ↗
          </a>
        </div>

        {step === "FORM" && (
          <form onSubmit={handleSendOtp} className="space-y-5">
            {/* TIPE INSTITUSI */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">
                Pilih Tipe Institusi
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType("SCHOOL")}
                  className={`p-3 rounded-xl border text-left transition ${
                    type === "SCHOOL"
                      ? "bg-indigo-950/60 border-indigo-500 text-indigo-300"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="text-sm font-bold flex items-center gap-1.5">
                    <span>🏫</span> Sekolah
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    SD / SMP / SMA / SMK (Guru, Siswa, NIS, JP, Rombel, PPDB)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setType("UNIVERSITY")}
                  className={`p-3 rounded-xl border text-left transition ${
                    type === "UNIVERSITY"
                      ? "bg-indigo-950/60 border-indigo-500 text-indigo-300"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="text-sm font-bold flex items-center gap-1.5">
                    <span>🎓</span> Perguruan Tinggi
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Universitas / Politeknik (Dosen, Mhs, NIM, SKS, KRS, PMB)
                  </div>
                </button>
              </div>
            </div>

            {/* NAMA & SLUG */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Nama Institusi
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug) handleSlugChange(e.target.value);
                  }}
                  placeholder="Contoh: SMA Negeri 2 Jakarta"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Slug URL Portal
                </label>
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 focus-within:ring-2 focus-within:ring-indigo-500">
                  <span className="text-xs text-slate-500 font-mono">/</span>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="sman2jkt"
                    className="w-full bg-transparent py-2.5 pl-1 text-sm text-white font-mono placeholder-slate-600 focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Portal login akan tersedia di /{slug || "nama-slug"}/login
                </p>
              </div>
            </div>

            {/* DATA ADMIN PERTAMA */}
            <div className="pt-2 border-t border-slate-800 space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Akun Administrator Pertama
              </h3>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Nama Lengkap Admin
                </label>
                <input
                  type="text"
                  required
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  placeholder="Contoh: Budi Gunawan, M.Kom"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Nomor WhatsApp Admin (Verifikasi OTP)
                  </label>
                  <input
                    type="tel"
                    required
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                    placeholder="081234567890"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Password Admin
                  </label>
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Minimal 8 karakter"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl text-sm transition shadow-lg shadow-indigo-600/30"
            >
              {loading ? "Mengirim Verifikasi..." : "Verifikasi Nomor & Buat Institusi"}
            </button>
          </form>
        )}

        {step === "OTP" && (
          <form onSubmit={handleVerifyAndCreate} className="space-y-4">
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
              <span className="text-xs text-slate-400">Kode verifikasi dikirimkan ke WhatsApp:</span>
              <div className="font-mono text-base font-bold text-emerald-400 mt-1">
                {destinationMasked}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Masukkan 6-Digit Kode Verifikasi OTP
              </label>
              <input
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl text-sm transition shadow-lg shadow-emerald-600/30"
            >
              {loading ? "Memproses Pembuatan Tenant..." : "Konfirmasi & Mulai Trial"}
            </button>

            <button
              type="button"
              onClick={() => setStep("FORM")}
              className="w-full text-xs text-slate-500 hover:text-slate-300 py-1"
            >
              ← Kembali dan ubah data pendaftaran
            </button>
          </form>
        )}

        {step === "SUCCESS" && createdInfo && (
          <div className="text-center space-y-6 animate-fadeIn">
            <div className="h-16 w-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-3xl mx-auto border border-emerald-500/30">
              ✓
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">Institusi Berhasil Didaftarkan!</h2>
              <p className="text-xs text-slate-400 mt-1">
                Trial 14 hari paket Starter telah aktif untuk institusi Anda.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-left space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Portal Login:</span>
                <span className="font-mono text-indigo-400 font-semibold">
                  /{createdInfo.tenantSlug}/login
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">ID Admin Resmi:</span>
                <span className="font-mono text-white font-bold">{createdInfo.adminId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Email Login Virtual:</span>
                <span className="font-mono text-emerald-400">{createdInfo.adminEmail}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Status Akun:</span>
                <span className="text-emerald-400 font-bold">ACTIVE (Siap Pakai)</span>
              </div>
            </div>

            <Link
              href={`/${createdInfo.tenantSlug}/login`}
              className="inline-block w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-4 rounded-xl text-sm transition shadow-lg shadow-indigo-600/30"
            >
              Masuk ke Portal Institusi Sekarang →
            </Link>
          </div>
        )}

        <div className="mt-8 text-center border-t border-slate-800/80 pt-4 text-xs text-slate-500">
          Sudah memiliki institusi terdaftar?{" "}
          <Link href="/" className="text-indigo-400 hover:text-indigo-300 font-semibold">
            Pilih Institusi Anda
          </Link>
        </div>
      </div>
    </div>
  );
}
