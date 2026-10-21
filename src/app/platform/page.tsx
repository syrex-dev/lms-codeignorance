"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface TenantData {
  id: string;
  slug: string;
  name: string;
  type: "SCHOOL" | "UNIVERSITY";
  status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELED";
  emailDomain: string;
  plan?: { name: string; code: string };
  trialEndsAt?: string;
  createdAt: string;
  _count: {
    users: number;
    applicants: number;
    classCourses: number;
  };
  usageRecords: Array<{
    otpSent: number;
    otpCostEstimate: number;
  }>;
}

interface PlatformMetrics {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  totalOtpSent: number;
  totalOtpCost: number;
}

export default function PlatformDashboardPage() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [tenants, setTenants] = useState<TenantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/platform/tenants");
      const data = await res.json();
      if (data.tenants) {
        setTenants(data.tenants);
        setMetrics(data.metrics);
      }
    } catch (e) {
      console.error("Failed to load platform data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateStatus = async (institutionId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/platform/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_STATUS",
          institutionId,
          newStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(data.message);
        fetchData();
        setTimeout(() => setActionMsg(null), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExtendTrial = async (institutionId: string) => {
    try {
      const res = await fetch("/api/platform/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "EXTEND_TRIAL",
          institutionId,
          extendDays: 14,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(data.message);
        fetchData();
        setTimeout(() => setActionMsg(null), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 sm:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-400 font-mono text-xs font-bold border border-indigo-500/30">
                PLATFORM OPS
              </span>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Konsol Manajemen SaaS & Multi-Tenant
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Pusat kendali operasional platform LMS: metrik global, provisioning tenant, kuota OTP, dan status langganan.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/signup"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-lg shadow-indigo-600/30"
            >
              + Provisioning Tenant Baru
            </Link>
            <Link
              href="/"
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-4 py-2 rounded-xl border border-slate-700 transition"
            >
              Portal Beranda ↗
            </Link>
          </div>
        </div>

        {actionMsg && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-xl text-xs">
            {actionMsg}
          </div>
        )}

        {/* METRICS CARDS */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Institusi
              </span>
              <div className="text-2xl font-black text-white mt-1">
                {metrics.totalTenants}
              </div>
              <span className="text-[11px] text-emerald-400 font-medium">
                {metrics.activeTenants} aktif / trial
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Pengguna Aktif
              </span>
              <div className="text-2xl font-black text-white mt-1">
                {metrics.totalUsers}
              </div>
              <span className="text-[11px] text-slate-500">
                Siswa, Guru, Dosen, Mahasiswa
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Penggunaan OTP
              </span>
              <div className="text-2xl font-black text-white mt-1">
                {metrics.totalOtpSent} <span className="text-sm font-normal text-slate-500">pesan</span>
              </div>
              <span className="text-[11px] text-indigo-400">
                WhatsApp & SMS Terkirim
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Estimasi Biaya Provider
              </span>
              <div className="text-2xl font-black text-amber-400 mt-1">
                ${metrics.totalOtpCost.toFixed(2)}
              </div>
              <span className="text-[11px] text-slate-500">
                Biaya WhatsApp API & SMS
              </span>
            </div>
          </div>
        )}

        {/* DAFTAR TENANT */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Daftar Institusi Terdaftar</h2>
              <p className="text-xs text-slate-400">
                Setiap institusi berjalan dalam isolasi data berbasis tenantId.
              </p>
            </div>
            <button
              onClick={fetchData}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Nama Institusi</th>
                  <th className="py-3 px-4">Slug / Domain</th>
                  <th className="py-3 px-4">Tipe</th>
                  <th className="py-3 px-4">Paket & Status</th>
                  <th className="py-3 px-4">Pengguna</th>
                  <th className="py-3 px-4">OTP Bulan Ini</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500">
                      Memuat data institusi...
                    </td>
                  </tr>
                ) : tenants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500">
                      Belum ada institusi terdaftar.
                    </td>
                  </tr>
                ) : (
                  tenants.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">{t.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">ID: {t.id}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <Link
                          href={`/${t.slug}/login`}
                          target="_blank"
                          className="text-indigo-400 hover:underline"
                        >
                          /{t.slug}
                        </Link>
                        <div className="text-[10px] text-slate-500">{t.emailDomain}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.type === "UNIVERSITY"
                              ? "bg-purple-950 text-purple-300 border border-purple-800"
                              : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          }`}
                        >
                          {t.type === "UNIVERSITY" ? "🎓 Kampus" : "🏫 Sekolah"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.status === "ACTIVE"
                                ? "bg-emerald-950 text-emerald-400"
                                : t.status === "TRIAL"
                                ? "bg-amber-950 text-amber-400"
                                : "bg-red-950 text-red-400"
                            }`}
                          >
                            {t.status}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {t.plan?.name || "STARTER"}
                          </span>
                        </div>
                        {t.trialEndsAt && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Trial s.d {new Date(t.trialEndsAt).toLocaleDateString("id-ID")}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-200">
                          {t._count.users} Akun
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {t._count.applicants} pendaftar • {t._count.classCourses} kelas
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-slate-300">
                          {t.usageRecords[0]?.otpSent || 0} SMS/WA
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          ${Number(t.usageRecords[0]?.otpCostEstimate || 0).toFixed(2)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {t.status === "SUSPENDED" ? (
                            <button
                              onClick={() => handleUpdateStatus(t.id, "ACTIVE")}
                              className="text-[11px] bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 px-2.5 py-1 rounded-lg transition"
                            >
                              Aktifkan
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateStatus(t.id, "SUSPENDED")}
                              className="text-[11px] bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 px-2.5 py-1 rounded-lg transition"
                            >
                              Suspend
                            </button>
                          )}
                          <button
                            onClick={() => handleExtendTrial(t.id)}
                            className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 transition"
                          >
                            +14 Hari
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
