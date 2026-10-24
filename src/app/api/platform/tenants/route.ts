import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/auth/guard";
import { UserRole } from "@prisma/client";

export async function GET(req: Request) {
  const guard = await requireSession(req, {
    requiredRoles: [UserRole.SUPER_ADMIN],
  });
  if (!guard.success) {
    return guard.response;
  }

  const tenants = await prisma.institution.findMany({
    include: {
      plan: true,
      subscription: true,
      usageRecords: {
        orderBy: { periodMonth: "desc" },
        take: 1,
      },
      _count: {
        select: {
          users: true,
          applicants: true,
          classCourses: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Hitung metrik platform
  const totalTenants = tenants.length;
  const activeTenants = tenants.filter((t) => t.status === "ACTIVE").length;
  const trialTenants = tenants.filter((t) => t.status === "TRIAL").length;
  const suspendedTenants = tenants.filter((t) => t.status === "SUSPENDED").length;

  return NextResponse.json({
    tenants,
    metrics: {
      totalTenants,
      activeTenants,
      trialTenants,
      suspendedTenants,
    },
  });
}
