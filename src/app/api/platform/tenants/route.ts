import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
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
  const activeTenants = tenants.filter((t) => t.status === "ACTIVE" || t.status === "TRIAL").length;
  const totalUsers = tenants.reduce((acc, t) => acc + t._count.users, 0);

  const usageRecords = await prisma.usageRecord.findMany();
  const totalOtpSent = usageRecords.reduce((acc, u) => acc + u.otpSent, 0);
  const totalOtpCost = usageRecords.reduce((acc, u) => acc + Number(u.otpCostEstimate), 0);

  return NextResponse.json({
    metrics: {
      totalTenants,
      activeTenants,
      totalUsers,
      totalOtpSent,
      totalOtpCost,
    },
    tenants,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, institutionId, newStatus, featureKey, isEnabled, extendDays } = body;

    if (!institutionId) {
      return NextResponse.json({ error: "Institution ID wajib diisi." }, { status: 400 });
    }

    // 1. Ubah status (SUSPEND / ACTIVATE)
    if (action === "UPDATE_STATUS") {
      const updated = await prisma.institution.update({
        where: { id: institutionId },
        data: { status: newStatus },
      });
      return NextResponse.json({ success: true, message: `Status institusi diubah ke ${newStatus}.`, tenant: updated });
    }

    // 2. Override fitur tenant
    if (action === "OVERRIDE_FEATURE") {
      const override = await prisma.tenantFeatureOverride.upsert({
        where: {
          institutionId_featureKey: {
            institutionId,
            featureKey,
          },
        },
        update: { isEnabled },
        create: {
          institutionId,
          featureKey,
          isEnabled,
        },
      });
      return NextResponse.json({ success: true, message: `Fitur ${featureKey} di-override: ${isEnabled}`, override });
    }

    // 3. Perpanjang masa trial
    if (action === "EXTEND_TRIAL") {
      const current = await prisma.institution.findUnique({ where: { id: institutionId } });
      const currentEnd = current?.trialEndsAt || new Date();
      const newTrialEndsAt = new Date(currentEnd.getTime() + (extendDays || 14) * 24 * 60 * 60 * 1000);

      const updated = await prisma.institution.update({
        where: { id: institutionId },
        data: { trialEndsAt: newTrialEndsAt, status: "TRIAL" },
      });

      return NextResponse.json({ success: true, message: `Trial diperpanjang ${extendDays} hari.`, tenant: updated });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (error: any) {
    console.error("Platform tenant management error:", error);
    return NextResponse.json({ error: error.message || "Gagal memproses manajemen tenant." }, { status: 500 });
  }
}
