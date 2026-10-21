import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "./change-password-form";
import { ShieldAlert, LockKeyhole } from "lucide-react";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

interface ChangePasswordPageProps {
  params: Promise<{
    tenant: string;
  }>;
}

export default async function ChangePasswordPage({
  params,
}: ChangePasswordPageProps) {
  const { tenant } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/${tenant}/login`);
  }

  // Jika user sudah mengganti password, arahkan ke dashboard
  if (!session.user.mustChangePassword) {
    redirect(`/${tenant}/dashboard`);
  }

  const institution = await prisma.institution.findUnique({
    where: { slug: tenant },
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8 bg-slate-100 dark:bg-slate-950">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800 p-6 md:p-10 relative overflow-hidden">
        {/* Header Icon */}
        <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mb-6 border border-amber-200 dark:border-amber-900/40">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Wajib Ganti Password Pertama Kali
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Akun Anda saat ini masih menggunakan password bawaan sistem (sama dengan ID Anda). Demi keamanan data pribadi, Anda <strong>wajib mengganti password baru</strong> sebelum dapat mengakses modul platform.
        </p>

        {/* User identification badge */}
        <div className="mt-5 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400">Pengguna:</span>{" "}
            <strong className="text-slate-900 dark:text-white">
              {session.user.fullName}
            </strong>
          </div>
          <div className="px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-mono font-bold">
            ID: {session.user.identifier}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <ChangePasswordForm
            tenantSlug={tenant}
            userIdentifier={session.user.identifier}
          />
        </div>
      </div>
    </div>
  );
}
