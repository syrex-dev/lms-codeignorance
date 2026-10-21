import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getTerminology } from "@/lib/i18n/terminology";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardHeader } from "./dashboard-header";

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

  // Jika mustChangePassword == true, paksa redirect ke change-password
  if (session.user.mustChangePassword) {
    redirect(`/${tenant}/change-password`);
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

  const terminology = getTerminology(institution.type);
  const activeTerm = institution.academicTerms[0];

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Sidebar Navigation */}
      <DashboardSidebar
        tenantSlug={tenant}
        institution={institution}
        terminology={terminology}
        user={session.user}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          tenantSlug={tenant}
          institution={institution}
          activeTerm={activeTerm}
          user={session.user}
          terminology={terminology}
        />

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
