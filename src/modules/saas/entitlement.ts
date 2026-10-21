import { prisma } from "@/lib/db/prisma";

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
  maxAllowed: number;
  current: number;
  message?: string;
}

/**
 * Service Entitlement Terpusat: Memeriksa apakah fitur diizinkan untuk tenant ini
 */
export async function hasFeature(institutionId: string, featureKey: FeatureKey): Promise<boolean> {
  if (!institutionId) return false;

  // 1. Cek TenantFeatureOverride spesifik
  const override = await prisma.tenantFeatureOverride.findUnique({
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
  const institution = await prisma.institution.findUnique({
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

  // Jika belum ada paket, default izinkan fitur dasar modul
  if (!institution.plan) {
    return true;
  }

  const feature = institution.plan.features.find((f) => f.featureKey === featureKey);
  return feature ? feature.isEnabled : true;
}

/**
 * Service Limit Terpusat: Memeriksa kuota batas penggunaan tenant
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
    return { isAllowed: false, maxAllowed: 0, current: 0, message: "Institusi tidak ditemukan." };
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
      const usage = await prisma.usageRecord.findUnique({
        where: { institutionId_periodMonth: { institutionId, periodMonth } },
      });
      current = usage?.otpSent ?? 0;
    }
  }

  if (current >= maxAllowed) {
    // Pengecualian khusus kuota OTP: aktivasi & forgot password tetap diizinkan dengan toleransi kewajaran
    if (limitKey === "maxOtpPerMonth" && current < maxAllowed * 1.2) {
      return {
        isAllowed: true,
        maxAllowed,
        current,
        message: "Peringatan: Kuota OTP bulanan telah melampaui batas paket. Harap upgrade paket.",
      };
    }

    return {
      isAllowed: false,
      maxAllowed,
      current,
      message: `Batas kuota ${limitKey} (${maxAllowed}) telah tercapai. Harap upgrade paket untuk menambah kapasitas.`,
    };
  }

  return { isAllowed: true, maxAllowed, current };
}
