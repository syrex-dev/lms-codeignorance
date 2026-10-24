import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { redirect } from "next/navigation";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";
import { maskPhoneNumber } from "@/lib/security/phone";
import OnboardingForm from "./onboarding-form";

interface OnboardingPageProps {
  params: Promise<{ tenant: string }>;
}

export default async function OnboardingPage({ params }: OnboardingPageProps) {
  const { tenant } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/${tenant}/login`);
  }

  // Jika user sudah ACTIVE dan tidak mustChangePassword, langsung ke dashboard
  if (session.user.status === "ACTIVE" && !session.user.mustChangePassword) {
    redirect(`/${tenant}/dashboard`);
  }

  // Ambil data user & institusi dari database menggunakan transaksi RLS
  const tenantId = session.user.activeInstitutionId;
  if (!tenantId) {
    redirect(`/${tenant}/login`);
  }
  const user: any = await withTenantTransaction(tenantId, async (tenantDb: any) => {
    return tenantDb.user.findUnique({
      where: { id: session.user.id },
      include: {
        institution: true,
        identifiers: true,
      },
    });
  });

  if (!user) {
    redirect(`/${tenant}/login`);
  }

  const institution = user.institution;
  const isPhonePrefilled = Boolean(user.phoneE164);
  const maskedPhone = user.phoneE164 ? maskPhoneNumber(user.phoneE164) : null;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-3">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping"></span>
            Aktivasi Akun Pertama
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Selamat Datang, {user.fullName}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {institution.name} ({user.identifiers.find((i: any) => i.isPrimary)?.value || session.user.identifier})
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Verifikasi nomor handphone Anda dan tetapkan password baru untuk mengamankan akun sebelum mulai menggunakan portal.
          </p>
        </div>

        <OnboardingForm
          tenantSlug={tenant}
          isPhonePrefilled={isPhonePrefilled}
          maskedPhone={maskedPhone}
          initialPhone={user.phoneE164 || ""}
        />
      </div>
    </div>
  );
}
