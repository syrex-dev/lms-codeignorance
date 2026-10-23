"use client";

import React, { useState, useEffect, use } from "react";
import {
  KeyRound,
  Eye,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Save,
  HelpCircle,
} from "lucide-react";

export default function IdFormatSettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const resolvedParams = use(params);
  const tenantSlug = resolvedParams.tenant;

  const [template, setTemplate] = useState("{YEAR}{PROG}{SEQ:4}");
  const [initialPasswordMode, setInitialPasswordMode] = useState<"RANDOM" | "DEFAULT_PATTERN">("RANDOM");
  const [allowIdLogin, setAllowIdLogin] = useState(true);
  const [previewId, setPreviewId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live preview calculator
  useEffect(() => {
    const year = new Date().getFullYear().toString().slice(-2);
    const prog = "01";
    let preview = template
      .replace(/\{YEAR\}/g, year)
      .replace(/\{PROG\}/g, prog)
      .replace(/\{SEQ:(\d+)\}/g, (_, len) => "1".padStart(parseInt(len, 10), "0"))
      .replace(/\{NIS:(\d+)\}/g, (_, len) => "12345".slice(-parseInt(len, 10)))
      .replace(/\{NIM:(\d+)\}/g, (_, len) => "230101".slice(-parseInt(len, 10)));
    setPreviewId(preview);
  }, [template]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/admin/id-generator", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idFormatTemplate: template,
          initialPasswordMode,
          allowIdLogin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan pengaturan format ID.");

      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <KeyRound className="h-7 w-7 text-indigo-600" />
          Pengaturan Format ID Pengguna & Password
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Atur pola penomoran otomatis NIM/NIS/NIP dan kebijakan password awal dengan pratinjau langsung.
        </p>
      </div>

      {saved && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5" />
          <span>Pengaturan format ID dan keamanan berhasil disimpan!</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300">
          <AlertTriangle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
        {/* Template Input */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 dark:text-white">
            Pola Template Format ID
          </label>
          <p className="text-xs text-slate-500 mb-2">
            Gunakan variabel placeholder: <code>&#123;YEAR&#125;</code> (tahun 2 digit), <code>&#123;PROG&#125;</code> (kode prodi), <code>&#123;SEQ:4&#125;</code> (nomor urut).
          </p>
          <input
            type="text"
            required
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="w-full px-4 py-2.5 text-sm font-mono border rounded-lg dark:bg-slate-800 dark:border-slate-700"
          />
        </div>

        {/* Live Preview Box */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <Eye className="h-4 w-4 text-indigo-500" />
              PRATINJAU LANGSUNG HASIL GENERASI ID
            </div>
            <div className="text-xl font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              {previewId || "(Format kosong)"}
            </div>
          </div>
          <span className="text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 px-3 py-1 rounded-full flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" /> Live CSPRNG
          </span>
        </div>

        {/* Password Mode */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
            Mode Password Awal
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className={`p-4 border rounded-xl flex items-start gap-3 cursor-pointer transition ${
              initialPasswordMode === "RANDOM" ? "border-indigo-600 bg-indigo-50/30" : "border-slate-200"
            }`}>
              <input
                type="radio"
                name="initialPasswordMode"
                value="RANDOM"
                checked={initialPasswordMode === "RANDOM"}
                onChange={() => setInitialPasswordMode("RANDOM")}
                className="mt-1"
              />
              <div>
                <span className="font-semibold text-sm block">RANDOM (CSPRNG 12+ Karakter)</span>
                <span className="text-xs text-slate-500">
                  Password acak kuat tanpa karakter ambigu (0/O/1/l). Paling aman dan direkomendasikan.
                </span>
              </div>
            </label>

            <label className={`p-4 border rounded-xl flex items-start gap-3 cursor-pointer transition ${
              initialPasswordMode === "DEFAULT_PATTERN" ? "border-indigo-600 bg-indigo-50/30" : "border-slate-200"
            }`}>
              <input
                type="radio"
                name="initialPasswordMode"
                value="DEFAULT_PATTERN"
                checked={initialPasswordMode === "DEFAULT_PATTERN"}
                onChange={() => setInitialPasswordMode("DEFAULT_PATTERN")}
                className="mt-1"
              />
              <div>
                <span className="font-semibold text-sm block">DEFAULT PATTERN (Tanggal Lahir)</span>
                <span className="text-xs text-slate-500">
                  Format tanggal lahir ddmmyyyy pengguna dengan verifikasi ketat saat onboarding.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Allow ID Login Toggle */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <label className="text-sm font-semibold text-slate-900 dark:text-white">
              Izinkan Login Langsung Menggunakan ID (NIM/NIS/NIP)
            </label>
            <p className="text-xs text-slate-500">
              Jika dinonaktifkan, seluruh pengguna wajib login menggunakan email resmi lengkap (&#123;ID&#125;@&#123;domain&#125;).
            </p>
          </div>
          <input
            type="checkbox"
            checked={allowIdLogin}
            onChange={(e) => setAllowIdLogin(e.target.checked)}
            className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg flex items-center gap-2 shadow-sm transition disabled:opacity-50"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan Pengaturan Format
          </button>
        </div>
      </form>
    </div>
  );
}
