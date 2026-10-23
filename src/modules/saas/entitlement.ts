import { prisma, platformPrisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

export type FeatureKey =
  | "classroom"
  | "assignment"
  | "quiz"
  | "attendance"
  | "gradebook"
  | "schedule"
  | "communication"
  | "admission"
  | "finance"
  | "scholarship"
  | "parent_portal"
  | "custom_branding"
  | "custom_domain"
  | "api_access"
  | "whatsapp_otp"
  | "sms_otp";

export type LimitKey =
  | "maxActiveUsers"
  | "maxStorageMb"
  | "maxApplicantsPerYear"
  | "maxAdmins"
  | "maxOtpPerMonth";

export interface LimitCheckResult {
  isAllowed: boolean;
  allowed: boolean;
  maxAllowed: number;
  current: number;
  message?: string;
  isNearQuota?: boolean;
}

export class EntitlementError extends Error {
  constructor(message: string, public readonly featureKey: FeatureKey) {
    super(message);
    this.name = "EntitlementError";
  }
}

/**
 * Service Entitlement Terpusat: Memeriksa apakah fitur diizinkan untuk tenant ini
 */
export async function hasFeature(institutionId: string, featureKey: FeatureKey): Promise<boolean> {
  if (!institutionId) return false;

  // 1. Cek TenantFeatureOverride spesifik
  const override = await platformPrisma.tenantFeatureOverride.findUnique({
    where: {
      institutionId_featureKey: {
        institutionId,
        featureKey,
      },
    },
  });

  if (override !== null) {
    return override.isEnabled;
  }

  // 2. Cek fitur dari paket (Plan) institusi
  const institution = await platformPrisma.institution.findUnique({
    where: { id: institutionId },
    include: {
      plan: {
        include: {
          features: true,
        },
      },
    },
  });

  if (!institution) return false;

  // Jika institusi belum memiliki paket terikat, fitur dasar diizinkan
  if (!institution.plan) {
    return true;
  }

  const feature = institution.plan.features.find((f) => f.featureKey === featureKey);
  return feature ? feature.isEnabled : true;
}

/**
 * 2.d: Pola reusable requireFeature('<key>') untuk route handler dan halaman server.
 * Menolak akses langsung jika fitur di luar paket.
 */
export async function requireFeature(institutionId: string, featureKey: FeatureKey): Promise<void> {
  const allowed = await hasFeature(institutionId, featureKey);
  if (!allowed) {
    throw new EntitlementError(
      `Fitur '${featureKey}' tidak aktif untuk institusi ini. Silakan hubungi admin atau upgrade paket berlangganan.`,
      featureKey
    );
  }
}

/**
 * Route handler helper: mengembalikan respons HTTP 403 JSON jika fitur tidak aktif
 */
export async function assertRouteFeature(institutionId: string, featureKey: FeatureKey) {
  const allowed = await hasFeature(institutionId, featureKey);
  if (!allowed) {
    return NextResponse.json(
      {
        error: `Fitur '${featureKey}' tidak aktif untuk institusi ini. Akses API ditolak.`,
        code: "FEATURE_DISABLED",
        feature: featureKey,
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Service Limit Terpusat: Memeriksa kuota batas penggunaan tenant & peringatan mendekati kuota
 */
export async function checkLimit(
  institutionId: string,
  limitKey: LimitKey,
  currentCount?: number
): Promise<LimitCheckResult> {
  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    include: { plan: true },
  });

  if (!institution) {
    return { isAllowed: false, allowed: false, maxAllowed: 0, current: 0, message: "Institusi tidak ditemukan." };
  }

  const plan = institution.plan;
  const maxAllowed = plan ? plan[limitKey] : 1000;

  // Hitung jumlah terkini jika tidak disertakan
  let current = currentCount ?? 0;
  if (currentCount === undefined) {
    if (limitKey === "maxActiveUsers") {
      current = await prisma.user.count({
        where: { institutionId, status: "ACTIVE" },
      });
    } else if (limitKey === "maxAdmins") {
      current = await prisma.membership.count({
        where: { institutionId, role: "INSTITUTION_ADMIN", status: "ACTIVE" },
      });
    } else if (limitKey === "maxApplicantsPerYear") {
      current = await prisma.applicant.count({
        where: { institutionId },
      });
    } else if (limitKey === "maxOtpPerMonth") {
      const now = new Date();
      const periodMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
      const usage = await platformPrisma.usageRecord.findUnique({
        where: { institutionId_periodMonth: { institutionId, periodMonth } },
      });
      current = usage?.otpSent ?? 0;
    }
  }

  const isNearQuota = current >= maxAllowed * 0.8 && current < maxAllowed;

  if (current >= maxAllowed) {
    // Toleransi khusus OTP 120% untuk emergency aktivasi & forgot password
    if (limitKey === "maxOtpPerMonth" && current < maxAllowed * 1.2) {
      return {
        isAllowed: true,
        allowed: true,
        maxAllowed,
        current,
        isNearQuota: true,
        message: "Peringatan: Kuota OTP bulanan telah melampaui batas paket. Harap segera upgrade paket.",
      };
    }

    return {
      isAllowed: false,
      allowed: false,
      maxAllowed,
      current,
      isNearQuota: false,
      message: `Batas kuota ${limitKey} (${maxAllowed}) telah tercapai. Harap upgrade paket untuk menambah kapasitas.`,
    };
  }

  return {
    isAllowed: true,
    allowed: true,
    maxAllowed,
    current,
    isNearQuota,
    message: isNearQuota ? `Peringatan: Pemakaian ${limitKey} telah mencapai ${Math.round((current / maxAllowed) * 100)}% dari kuota.` : undefined,
  };
}
