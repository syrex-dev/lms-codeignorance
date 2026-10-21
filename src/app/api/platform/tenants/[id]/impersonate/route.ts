import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import crypto from "crypto";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const tenantId = resolvedParams.id;
    const body = await req.json();
    const { platformUserId, reason, durationMinutes = 30 } = body;

    if (!platformUserId || !reason || typeof reason !== "string" || reason.trim().length < 10) {
      return NextResponse.json(
        { error: "platformUserId dan alasan tertulis (minimal 10 karakter) wajib diisi untuk audit." },
        { status: 400 }
      );
    }

    const platformUser = await prisma.platformUser.findUnique({
      where: { id: platformUserId },
    });

    if (!platformUser) {
      return NextResponse.json({ error: "PlatformUser tidak valid." }, { status: 403 });
    }

    const tenant = await prisma.institution.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant tidak ditemukan." }, { status: 404 });
    }

    // Limit duration to max 60 minutes
    const effectiveMinutes = Math.min(60, Math.max(5, durationMinutes));
    const expiresAt = new Date(Date.now() + effectiveMinutes * 60 * 1000);
    const sessionToken = `support_${crypto.randomBytes(24).toString("hex")}`;

    // 1. Catat ke PlatformAuditLog
    await prisma.platformAuditLog.create({
      data: {
        platformUserId: platformUser.id,
        action: "TENANT_SUPPORT_ACCESS_INITIATED",
        details: {
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          reason,
          durationMinutes: effectiveMinutes,
          expiresAt,
          mode: "READ_ONLY",
        },
      },
    });

    // 2. Catat ke AuditLog tenant (agar terlihat oleh admin tenant secara transparan)
    await prisma.auditLog.create({
      data: {
        institutionId: tenant.id,
        action: "PLATFORM_SUPPORT_READONLY_ACCESS",
        entityType: "PlatformSupportSession",
        entityId: sessionToken,
        newValue: {
          operatorEmail: platformUser.email,
          operatorName: platformUser.fullName,
          reason,
          expiresAt,
          isReadOnly: true,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Akses support read-only dibuat untuk institusi ${tenant.name}. Sesi ini tercatat di audit log tenant.`,
      supportSession: {
        token: sessionToken,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        isReadOnly: true,
        expiresAt,
      },
    });
  } catch (error: any) {
    console.error("Support impersonation error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan sistem saat membuat sesi support platform." },
      { status: 500 }
    );
  }
}
