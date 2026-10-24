import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { Sidebar } from "@/components/ui/sidebar";
import { Header } from "@/components/ui/header";

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
    <div className="min-h-screen flex bg-[#F6F7F9]">
      {/* 240px Fixed/Drawer Institutional Sidebar */}
      <Sidebar
        tenantSlug={tenant}
        institutionName={institution.name}
        institutionType={institution.type}
        role={session.user.activeRole}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 56px Institutional Header */}
        <Header
          tenantSlug={tenant}
          user={session.user}
          institutionType={institution.type}
          academicTermName={activeTerm?.name || "Semester Aktif"}
        />

        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
