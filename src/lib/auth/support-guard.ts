import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export interface SupportSessionInfo {
  isValid: boolean;
  isReadOnly: boolean;
  platformUserId?: string;
  tenantId?: string;
  reason?: string;
  expiresAt?: Date;
  error?: string;
}

/**
 * 2.c: Memeriksa token sesi support platform.
 * Read-only dipaksa di server (semua mutasi POST/PUT/PATCH/DELETE ditolak).
 */
export async function verifySupportSession(
  token: string | null | undefined,
  method: string,
  targetTenantId?: string
): Promise<SupportSessionInfo> {
  if (!token || !token.startsWith("support_")) {
    return { isValid: false, isReadOnly: false, error: "Token support tidak valid" };
  }

  // Cari audit log pembentukan sesi support di PlatformAuditLog
  const sessionLog = await prisma.platformAuditLog.findFirst({
    where: {
      action: "TENANT_SUPPORT_ACCESS_INITIATED",
      details: {
        path: ["sessionToken"],
        equals: token,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!sessionLog || !sessionLog.details) {
    return { isValid: false, isReadOnly: false, error: "Sesi support tidak ditemukan" };
  }

  const details = sessionLog.details as any;
  const expiresAt = new Date(details.expiresAt);

  if (Date.now() > expiresAt.getTime()) {
    return { isValid: false, isReadOnly: true, error: "Sesi support telah kedaluwarsa" };
  }

  if (targetTenantId && details.tenantId !== targetTenantId) {
    return { isValid: false, isReadOnly: true, error: "Sesi support tidak sesuai dengan institusi target" };
  }

  // 2.c: PENEGAKAN SERVER-SIDE READ-ONLY:
  // Semua mutasi HTTP ditolak keras untuk sesi support
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) {
    return {
      isValid: false,
      isReadOnly: true,
      error: "Akses support dibatasi read-only. Operasi mutasi data ditolak di tingkat server.",
    };
  }

  return {
    isValid: true,
    isReadOnly: true,
    platformUserId: sessionLog.platformUserId,
    tenantId: details.tenantId,
    reason: details.reason,
    expiresAt,
  };
}

/**
 * Guard middleware helper untuk route handler yang memeriksa header x-support-token
 */
export async function assertReadOnlySupport(req: Request, targetTenantId?: string) {
  const supportToken = req.headers.get("x-support-token");
  if (supportToken) {
    const check = await verifySupportSession(supportToken, req.method, targetTenantId);
    if (!check.isValid) {
      return NextResponse.json(
        { error: check.error || "Operasi mutasi ditolak dalam mode support read-only." },
        { status: 403 }
      );
    }
  }
  return null;
}
