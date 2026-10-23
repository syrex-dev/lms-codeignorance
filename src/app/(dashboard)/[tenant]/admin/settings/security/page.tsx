"use client";

import React, { useState, useEffect, use } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  Eye,
  AlertTriangle,
  RefreshCw,
  Lock,
  UserCheck,
  Calendar,
} from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  entityType?: string;
  createdAt: string;
  newValue?: any;
}

export default function SecuritySettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const resolvedParams = use(params);
  const tenantSlug = resolvedParams.tenant;

  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch recent security audit logs
    const fetchAudit = async () => {
      try {
        const res = await fetch("/api/admin/security/audit-logs");
        if (res.ok) {
          const data = await res.json();
          if (data.logs) setLogs(data.logs);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchAudit();
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-indigo-600" />
          Keamanan & Audit Akses Platform
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Transparansi penuh pengawasan sistem, masa berlaku sesi support read-only platform, dan jejak audit institusi.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
          <div className="text-xs font-semibold text-slate-500">Row-Level Security (RLS)</div>
          <div className="text-xl font-bold text-emerald-600 flex items-center gap-1.5">
            <ShieldCheck className="h-5 w-5" /> Aktif & Terisolasi
          </div>
          <p className="text-xs text-slate-500">PostgreSQL forced RLS pada 30 tabel bertenant.</p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
          <div className="text-xs font-semibold text-slate-500">Support Access Mode</div>
          <div className="text-xl font-bold text-indigo-600 flex items-center gap-1.5">
            <Lock className="h-5 w-5" /> Strict Read-Only
          </div>
          <p className="text-xs text-slate-500">Mutasi server ditolak untuk sesi bantuan teknis.</p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
          <div className="text-xs font-semibold text-slate-500">Audit Log Mutability</div>
          <div className="text-xl font-bold text-emerald-600 flex items-center gap-1.5">
            <UserCheck className="h-5 w-5" /> Append-Only
          </div>
          <p className="text-xs text-slate-500">UPDATE dan DELETE dicabut permanen dari aplikasi.</p>
        </div>
      </div>

      {/* Security Audit Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Clock className="h-5 w-5 text-indigo-500" />
          Aktivitas Keamanan & Sesi Support Terbaru
        </h3>

        {loading ? (
          <div className="py-8 text-center text-slate-400">Memuat log keamanan...</div>
        ) : logs.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            Belum ada aktivitas audit keamanan baru yang tercatat.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {logs.map((log) => (
              <div key={log.id} className="py-3 flex justify-between items-start text-sm">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">{log.action}</span>
                  {log.newValue?.reason && (
                    <p className="text-xs text-slate-500 mt-0.5">Alasan: {log.newValue.reason}</p>
                  )}
                  {log.newValue?.operatorEmail && (
                    <p className="text-xs text-indigo-600">Oleh: {log.newValue.operatorEmail} (Read-Only)</p>
                  )}
                </div>
                <span className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
