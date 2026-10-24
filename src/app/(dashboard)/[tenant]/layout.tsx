import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { BreadcrumbProvider } from "@/components/ui/breadcrumb-context";
import { DashboardShell } from "@/components/ui/dashboard-shell";

export const dynamic = "force-dynamic";

interface DashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    tenant: string;
  }>;
}

export default async function DashboardLayout({
  children,
  params,
}: DashboardLayoutProps) {
  const { tenant } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/${tenant}/login`);
  }

  // Jika akun PENDING_ACTIVATION atau mustChangePassword, paksa redirect ke onboarding
  if (session.user.status === "PENDING_ACTIVATION" || session.user.mustChangePassword) {
    redirect(`/${tenant}/onboarding`);
  }

  const institution = await prisma.institution.findUnique({
    where: { slug: tenant },
    include: {
      academicTerms: {
        where: { isActive: true },
        take: 1,
      },
    },
  });

  if (!institution) {
    redirect("/poltekmi/login");
  }

  const activeTerm = institution.academicTerms[0];

  return (
    <BreadcrumbProvider>
      <DashboardShell
        tenantSlug={tenant}
        institutionName={institution.name}
        institutionType={institution.type}
        themeColor={institution.themeColor}
        logoUrl={institution.logoUrl}
        user={session.user}
        academicTermName={activeTerm?.name || "Semester Aktif"}
      >
        {children}
      </DashboardShell>
    </BreadcrumbProvider>
  );
}
