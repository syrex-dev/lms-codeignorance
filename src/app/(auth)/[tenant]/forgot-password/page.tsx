import { prisma } from "@/lib/db/prisma";
import { ForgotPasswordForm } from "./forgot-password-form";
import { notFound } from "next/navigation";
import { KeyRound } from "lucide-react";

export const dynamic = "force-dynamic";

interface ForgotPasswordPageProps {
  params: Promise<{
    tenant: string;
  }>;
}

export default async function ForgotPasswordPage({ params }: ForgotPasswordPageProps) {
  const { tenant } = await params;

  const institution = await prisma.institution.findUnique({
    where: { slug: tenant },
  });

  if (!institution) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="w-12 h-12 rounded-[6px] bg-[#1F4E8C] text-white flex items-center justify-center mx-auto mb-3">
            <KeyRound className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-semibold text-[#111827] tracking-tight">
            Pemulihan kata sandi
          </h1>
          <p className="text-xs text-[#4B5563] mt-1">
            {institution.name}
          </p>
        </div>

        <div className="mt-6 bg-white py-8 px-6 sm:px-8 border border-[#E3E6EB] rounded-[6px] shadow-none">
          <ForgotPasswordForm tenantSlug={institution.slug} />
        </div>
      </div>
    </div>
  );
}
