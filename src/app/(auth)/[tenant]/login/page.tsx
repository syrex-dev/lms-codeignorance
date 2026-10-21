import { prisma } from "@/lib/db/prisma";
import { LoginForm } from "./login-form";
import { notFound } from "next/navigation";
import Link from "next/link";
import { GraduationCap, School, ShieldCheck } from "lucide-react";

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

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950">
      {/* Left Banner */}
      <div
        className={`md:w-1/2 p-8 md:p-16 flex flex-col justify-between text-white relative overflow-hidden ${
          isUniversity
            ? "bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900"
            : "bg-gradient-to-br from-emerald-700 via-teal-800 to-slate-900"
        }`}
      >
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
              {isUniversity ? (
                <GraduationCap className="w-8 h-8 text-blue-200" />
              ) : (
                <School className="w-8 h-8 text-emerald-200" />
              )}
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full bg-white/15 text-white">
                {isUniversity ? "Perguruan Tinggi" : "Sekolah"}
              </span>
              <h1 className="text-2xl font-bold mt-1 tracking-tight">
                {institution.name}
              </h1>
            </div>
          </div>

          <div className="mt-12 max-w-md">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
              Sistem Pembelajaran Terpadu & Penerimaan Terintegrasi
            </h2>
            <p className="mt-4 text-slate-200 text-sm md:text-base leading-relaxed">
              Akses materi, tugas, kuis online, jadwal perkuliahan, dan layanan
              akademik resmi menggunakan ID institusional Anda.
            </p>
          </div>
        </div>

        {/* Security badge footer */}
        <div className="mt-12 pt-8 border-t border-white/10 flex items-center space-x-3 text-xs text-slate-300 relative z-10">
          <ShieldCheck className="w-5 h-5 text-emerald-300" />
          <span>
            Domain Resmi: <strong>{institution.emailDomain}</strong> • Multi-Tenant RBAC Security
          </span>
        </div>

        {/* Subtle background glow */}
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Right Login Form Container */}
      <div className="md:w-1/2 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Masuk ke Akun Anda
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Gunakan ID resmi ({isUniversity ? "NIM / NIDN" : "NIS / NUPTK"}) atau email institusi
            </p>
          </div>

          <LoginForm
            tenantSlug={institution.slug}
            institutionType={institution.type}
            institutionDomain={institution.emailDomain}
          />

          {/* Quick Tenant Switcher */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
            <span>Beralih institusi demo: </span>
            <Link
              href="/poltekmi/login"
              className={`font-semibold hover:underline mr-3 ${
                tenant === "poltekmi" ? "text-blue-600 dark:text-blue-400" : ""
              }`}
            >
              Politeknik (Kampus)
            </Link>
            •
            <Link
              href="/sman1/login"
              className={`font-semibold hover:underline ml-3 ${
                tenant === "sman1" ? "text-emerald-600 dark:text-emerald-400" : ""
              }`}
            >
              SMAN 1 (Sekolah)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
