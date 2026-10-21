import Link from "next/link";
import { GraduationCap, School, ShieldCheck, ArrowRight, Layers, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Navigation Bar */}
      <header className="border-b border-slate-800/80 px-6 py-5 max-w-7xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20 text-white">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-extrabold tracking-tight">LMS TERPADU</div>
            <div className="text-[10px] text-slate-400 tracking-wider uppercase">Sekolah & Kampus Multi-Tenant</div>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <Link
            href="/poltekmi/login"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-md shadow-blue-600/30"
          >
            Masuk Portal Kampus
          </Link>
          <Link
            href="/sman1/login"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all shadow-md shadow-emerald-600/30"
          >
            Masuk Portal Sekolah
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl w-full mx-auto px-6 py-12 md:py-20 flex-1 flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs font-semibold text-blue-400 mb-6">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Satu Platform untuk Semua Jenjang Pendidikan & Admisi</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
            Satu Sistem LMS untuk <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">Sekolah dan Kampus</span>
          </h1>

          <p className="mt-6 text-base md:text-lg text-slate-400 leading-relaxed">
            Arsitektur Modular Monolith terintegrasi dengan login berbasis ID resmi institusional, pemetaan istilah dinamis (i18n), modul penerimaan (PPDB/PMB), dan jadwal perkuliahan bebas bentrok.
          </p>
        </div>

        {/* Dual Institution Portal Selector Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full">
          {/* Card 1: Kampus / University */}
          <div className="p-8 rounded-3xl bg-gradient-to-b from-slate-800/90 to-slate-900 border border-slate-700 hover:border-blue-500/50 transition-all hover:shadow-2xl hover:shadow-blue-500/10 flex flex-col justify-between group">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform border border-blue-500/30">
                <GraduationCap className="w-7 h-7" />
              </div>

              <span className="text-xs font-bold uppercase tracking-widest text-blue-400">
                Mode Perguruan Tinggi
              </span>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-white">
                Politeknik Mitra Indonesia
              </h2>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                Terminologi Dosen, Mahasiswa (NIM), SKS, Kartu Rencana Studi (KRS), Ruang Lab/Teori, dan Penerimaan Mahasiswa Baru (PMB).
              </p>

              <div className="mt-6 p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1.5 font-mono text-slate-300">
                <div className="text-[11px] font-bold text-slate-500 uppercase font-sans mb-1">
                  Akun Demo Siap Login:
                </div>
                <div>Mahasiswa: <span className="text-blue-400 font-bold">24TI0001</span> (Pass: 24TI0001)</div>
                <div>Dosen: <span className="text-blue-400 font-bold">DSN001</span> (Pass: DSN001)</div>
                <div>Admin: <span className="text-blue-400 font-bold">ADM001</span> (Pass: ADM001)</div>
              </div>
            </div>

            <Link
              href="/poltekmi/login"
              className="mt-8 py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-lg shadow-blue-600/30 group-hover:shadow-blue-500/40"
            >
              <span>Buka Portal Kampus Poltekmi</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Card 2: Sekolah / School */}
          <div className="p-8 rounded-3xl bg-gradient-to-b from-slate-800/90 to-slate-900 border border-slate-700 hover:border-emerald-500/50 transition-all hover:shadow-2xl hover:shadow-emerald-500/10 flex flex-col justify-between group">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform border border-emerald-500/30">
                <School className="w-7 h-7" />
              </div>

              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                Mode Sekolah (SD/SMP/SMA/SMK)
              </span>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-white">
                SMA Negeri 1 Prestasi
              </h2>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                Terminologi Guru, Siswa (NIS/NISN), Jam Pelajaran (JP), Rombongan Belajar (Rombel), Nilai Rapor, dan PPDB Online.
              </p>

              <div className="mt-6 p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1.5 font-mono text-slate-300">
                <div className="text-[11px] font-bold text-slate-500 uppercase font-sans mb-1">
                  Akun Demo Siap Login:
                </div>
                <div>Siswa: <span className="text-emerald-400 font-bold">24MIPA0001</span> (Pass: 24MIPA0001)</div>
                <div>Guru: <span className="text-emerald-400 font-bold">GRU001</span> (Pass: GRU001)</div>
                <div>Admin TU: <span className="text-emerald-400 font-bold">STF001</span> (Pass: STF001)</div>
              </div>
            </div>

            <Link
              href="/sman1/login"
              className="mt-8 py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-lg shadow-emerald-600/30 group-hover:shadow-emerald-500/40"
            >
              <span>Buka Portal Sekolah SMAN 1</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Keamanan Identitas RBAC • Hash Bcrypt • Wajib Ganti Password Awal</span>
          </div>
          <div>© 2025 LMS Terpadu. Dibangun dengan Next.js App Router, Prisma ORM, & PostgreSQL.</div>
        </div>
      </footer>
    </div>
  );
}
