import React from "react";
import Link from "next/link";
import { AlertTriangle, ShieldAlert, ArrowLeft, Mail } from "lucide-react";

export default async function TenantStatusPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-800 border border-amber-500/30 rounded-2xl p-8 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/30">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Layanan Institusi Ditangguhkan
          </h1>
          <p className="text-sm text-slate-400">
            Akses sistem untuk institusi <span className="text-indigo-400 font-semibold">{tenant}</span> sedang dalam status penangguhan (Suspended) atau masa berlaku paket telah berakhir.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 text-left text-xs text-slate-300 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-medium">
            <AlertTriangle className="w-4 h-4" />
            <span>Mode Hanya-Baca (Read-Only)</span>
          </div>
          <p>
            Seluruh data akademik tetap aman dan tersimpan. Namun, operasi penambahan, perubahan, atau penghapusan data dibatasi sampai status langganan diperbarui.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-3">
          <a
            href="mailto:support@platform.system"
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition"
          >
            <Mail className="w-4 h-4" />
            Hubungi Platform Support
          </a>

          <Link
            href={`/${tenant}/login`}
            className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 text-slate-400 hover:text-white text-xs transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Kembali ke Halaman Login
          </Link>
        </div>
      </div>
    </div>
  );
}
