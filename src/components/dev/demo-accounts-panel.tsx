"use client";

import { Key, ArrowRight } from "lucide-react";

interface DemoAccount {
  id: string;
  name: string;
  role: string;
  passwordInitial: string;
  note?: string;
}

interface DemoAccountsPanelProps {
  tenantSlug: string;
  isUniversity?: boolean;
  onSelectAccount?: (identifier: string, password: string) => void;
}

export function DemoAccountsPanel({
  tenantSlug,
  isUniversity = true,
  onSelectAccount,
}: DemoAccountsPanelProps) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const campusAccounts: DemoAccount[] = [
    {
      id: "adm001",
      name: "Bambang Sudirjo, M.M",
      role: "Admin Institusi",
      passwordInitial: "ADM001",
      note: "Akses penuh manajemen institusi & pengguna",
    },
    {
      id: "dsn001",
      name: "Dr. Hendra Wijaya, M.Kom",
      role: "Dosen",
      passwordInitial: "DSN001",
      note: "Pengampu kelas Pemrograman Web Modern",
    },
    {
      id: "2301010011",
      name: "Budi Santoso",
      role: "Mahasiswa (Aktivasi)",
      passwordInitial: "2301010011",
      note: "Status PENDING_ACTIVATION (alur onboarding & OTP)",
    },
    {
      id: "2301010012",
      name: "Cindy Permata",
      role: "Mahasiswa (Aktif)",
      passwordInitial: "PasswordPendaftar123!",
      note: "Status ACTIVE (akses kelas & materi langsung)",
    },
  ];

  const schoolAccounts: DemoAccount[] = [
    {
      id: "admin.sman1",
      name: "Ahmad Dahlan, M.Pd",
      role: "Admin Sekolah",
      passwordInitial: "ADM001",
      note: "Akses penuh sekolah",
    },
    {
      id: "guru001",
      name: "Siti Maryam, S.Pd",
      role: "Guru",
      passwordInitial: "PasswordGuru123!",
      note: "Guru Matematika & Wali Kelas",
    },
    {
      id: "202310001",
      name: "Ahmad Fauzan",
      role: "Siswa",
      passwordInitial: "PasswordSiswa123!",
      note: "Siswa aktif",
    },
  ];

  const accounts = isUniversity ? campusAccounts : schoolAccounts;

  return (
    <details
      data-testid="demo-accounts-panel"
      className="mt-6 border border-slate-200 bg-white rounded-md text-xs text-slate-700 shadow-none"
    >
      <summary className="p-3 font-semibold cursor-pointer select-none flex items-center justify-between text-slate-800 hover:bg-slate-50 transition">
        <div className="flex items-center gap-1.5">
          <Key className="w-3.5 h-3.5 text-slate-500" />
          <span>Akun demo (pengembangan)</span>
        </div>
        <span className="text-[11px] text-slate-500 font-normal">Klik untuk membuka</span>
      </summary>

      <div className="p-3 pt-1 border-t border-slate-100 space-y-2">
        <p className="text-[11px] text-slate-500 mb-2">
          Gunakan salah satu akun seed berikut untuk pengujian autentikasi dan otorisasi:
        </p>

        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="p-2.5 rounded border border-slate-200 bg-slate-50 flex items-center justify-between hover:bg-white transition"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{acc.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-white border border-slate-200 rounded text-slate-700">
                  {acc.role}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                <span>ID: <strong className="text-slate-800">{acc.id}</strong></span>
                <span>Password: <strong className="text-slate-800">{acc.passwordInitial}</strong></span>
              </div>
              {acc.note && (
                <div className="text-[10px] text-slate-400 mt-0.5">{acc.note}</div>
              )}
            </div>

            {onSelectAccount && (
              <button
                type="button"
                onClick={() => onSelectAccount(acc.id, acc.passwordInitial)}
                className="shrink-0 px-2 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded text-xs font-medium flex items-center gap-1 transition"
              >
                <span>Gunakan</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
              </button>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
