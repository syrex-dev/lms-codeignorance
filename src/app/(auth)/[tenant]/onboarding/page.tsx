import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { redirect } from "next/navigation";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";
import { maskPhoneNumber } from "@/lib/security/phone";
import OnboardingForm from "./onboarding-form";
import { ShieldCheck } from "lucide-react";

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
  const primaryId = user.identifiers.find((i: any) => i.isPrimary)?.value || session.user.identifier || "";

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Institutional Header */}
        <div className="text-center">
          <div className="w-10 h-10 rounded-[6px] bg-[#1F4E8C] text-white flex items-center justify-center mx-auto mb-2.5">
            <ShieldCheck className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <span className="text-xs font-semibold text-[#1F4E8C] bg-[#EBF2FA] px-2.5 py-0.5 rounded-[4px]">
            Aktivasi akun pengguna baru
          </span>
          <h1 className="text-xl font-semibold text-[#111827] mt-2 tracking-tight">
            Selamat datang, {user.fullName}
          </h1>
          <p className="text-xs text-[#4B5563] mt-1 font-mono">
            {institution.name} • {primaryId}
          </p>
        </div>

        {/* Form Box */}
        <div className="mt-5 bg-white py-6 px-6 sm:px-8 border border-[#E3E6EB] rounded-[6px] shadow-none">
          <OnboardingForm
            tenantSlug={tenant}
            isPhonePrefilled={isPhonePrefilled}
            maskedPhone={maskedPhone}
            initialPhone={user.phoneE164 || ""}
          />
        </div>
      </div>
    </div>
  );
}
