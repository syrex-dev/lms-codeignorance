import { prisma } from "@/lib/db/prisma";
import { LoginForm } from "./login-form";
import { notFound } from "next/navigation";
import { GraduationCap, School } from "lucide-react";

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
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Institutional Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-[6px] bg-[#1F4E8C] text-white flex items-center justify-center mx-auto mb-3">
            {isUniversity ? (
              <GraduationCap className="w-6 h-6" strokeWidth={1.75} />
            ) : (
              <School className="w-6 h-6" strokeWidth={1.75} />
            )}
          </div>
          <span className="text-xs font-medium text-[#4B5563] bg-[#E3E6EB] px-2.5 py-0.5 rounded-[4px]">
            {isUniversity ? "Portal Akademik Kampus" : "Portal Akademik Sekolah"}
          </span>
          <h1 className="text-2xl font-semibold text-[#111827] mt-2 tracking-tight">
            {institution.name}
          </h1>
          <p className="text-xs text-[#4B5563] mt-1">
            Silakan masuk dengan akun institusional Anda
          </p>
        </div>

        {/* Login Form Box */}
        <div className="mt-6 bg-white py-8 px-6 sm:px-8 border border-[#E3E6EB] rounded-[6px] shadow-none">
          <LoginForm
            tenantSlug={institution.slug}
            institutionType={institution.type}
            institutionDomain={institution.emailDomain}
          />
        </div>

        {/* Domain footer note */}
        <div className="mt-4 text-center text-xs text-[#6B7280]">
          Domain resmi institusi: <strong className="font-mono text-[#4B5563]">{institution.emailDomain}</strong>
        </div>
      </div>
    </div>
  );
}
