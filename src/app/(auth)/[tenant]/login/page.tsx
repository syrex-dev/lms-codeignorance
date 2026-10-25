import { prisma } from "@/lib/db/prisma";
import { LoginForm } from "./login-form";
import { notFound } from "next/navigation";
import { GraduationCap, School, ShieldCheck, BookOpen, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

interface LoginPageProps {
  params: Promise<{
    tenant: string;
  }>;
}

export default async function LoginPage({ params }: LoginPageProps) {
  const { tenant } = await params;

  const institution = await prisma.institution.findUnique({
    where: { slug: tenant },
  });

  if (!institution) {
    notFound();
  }

  const isUniversity = institution.type === "UNIVERSITY";
  const primaryColor = institution.themeColor || "#1E40AF";

  const rootStyles = {
    "--tenant-accent": primaryColor,
    "--tenant-accent-subtle": `${primaryColor}18`,
  } as React.CSSProperties;

  return (
    <div style={rootStyles} className="min-h-screen bg-[var(--bg-canvas)] grid grid-cols-1 lg:grid-cols-12">
      {/* Kolom Kiri: Panel Identitas Institusi (Desktop Split-Screen) */}
      <div className="lg:col-span-5 bg-[#0F172A] bg-gradient-to-br from-[#0F172A] via-[#1E3A8A] to-[#172554] text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden">
        {/* Subtle decorative background blur circles */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header Identitas Institusi */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            {institution.logoUrl ? (
              <img
                src={institution.logoUrl}
                alt={institution.name}
                className="w-12 h-12 rounded-[8px] object-cover bg-white p-1 shadow-md border border-white/20 shrink-0"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-[8px] flex items-center justify-center font-bold text-lg text-white shadow-md border border-white/20 shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                {isUniversity ? (
                  <GraduationCap className="w-6 h-6" strokeWidth={2} />
                ) : (
                  <School className="w-6 h-6" strokeWidth={2} />
                )}
              </div>
            )}
            <div>
              <span className="inline-block text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-[4px] bg-white/10 text-blue-200 border border-white/10">
                {isUniversity ? "Portal Akademik Kampus" : "Portal Akademik Sekolah"}
              </span>
              <h2 className="text-xl font-bold tracking-tight text-white mt-0.5">
                {institution.name}
              </h2>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
              Sistem Informasi & Manajemen Pembelajaran Terpadu
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed max-w-md">
              Akses materi perkuliahan, interaksi kelas, pemantauan kurikulum, dan administrasi akademik dalam satu lingkungan digital yang aman dan modern.
            </p>
          </div>

          {/* Highlights Institusional */}
          <div className="mt-8 space-y-3 hidden sm:block">
            <div className="flex items-start gap-3 p-3 rounded-[8px] bg-white/5 border border-white/10">
              <BookOpen className="w-5 h-5 text-blue-300 shrink-0 mt-0.5" strokeWidth={1.75} />
              <div className="text-xs">
                <span className="font-semibold text-white block">Ruang Belajar Mandiri</span>
                <span className="text-slate-300">Modul kaya materi, dokumen silabus, dan materi terstruktur per topik.</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-[8px] bg-white/5 border border-white/10">
              <Sparkles className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" strokeWidth={1.75} />
              <div className="text-xs">
                <span className="font-semibold text-white block">Pelacakan Capaian Nyata</span>
                <span className="text-slate-300">Progres belajar transparan dan terverifikasi di setiap mata kuliah.</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-[8px] bg-white/5 border border-white/10">
              <ShieldCheck className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" strokeWidth={1.75} />
              <div className="text-xs">
                <span className="font-semibold text-white block">Keamanan Multi-Tenant Terisolasi</span>
                <span className="text-slate-300">Data institusi terproteksi penuh dengan Row-Level Security tingkat basis data.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Kolom Kiri */}
        <div className="relative z-10 pt-8 border-t border-white/10 mt-8 text-xs text-slate-400">
          <div>
            Domain resmi institusi:{" "}
            <strong className="text-white font-mono">{institution.emailDomain}</strong>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            &copy; 2026 {institution.name}. Hak cipta dilindungi undang-undang.
          </div>
        </div>
      </div>

      {/* Kolom Kanan: Panel Form Autentikasi */}
      <div className="lg:col-span-7 flex flex-col justify-center items-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md">
          {/* Card Form */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[12px] p-6 sm:p-8 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-[var(--text-main)] tracking-tight">
                Masuk ke Akun Anda
              </h2>
              <p className="text-xs text-[var(--text-subtle)] mt-1">
                Gunakan kredensial akademik resmi yang diterbitkan oleh institusi.
              </p>
            </div>

            <LoginForm
              tenantSlug={institution.slug}
              institutionType={institution.type}
              institutionDomain={institution.emailDomain}
            />
          </div>

          <div className="mt-6 text-center text-xs text-[var(--text-subtle)]">
            Butuh bantuan akses? Hubungi Unit Layanan TI Kampus atau Administrator Akademik.
          </div>
        </div>
      </div>
    </div>
  );
}
