import { ScholarshipCoverageType } from "@prisma/client";

export interface ScholarshipSchemeInput {
  schemeName: string;
  sponsorName: string;
  coverageType: ScholarshipCoverageType;
  coverageValue: number; // 100 untuk Full, 50 untuk 50%, atau nominal Rp
}

export interface DiscountCalculationResult {
  originalAmount: number;
  totalDiscount: number;
  studentDueAmount: number;
  sponsorCoverage: number;
  effectivePercentage: number;
}

/**
 * Menghitung diskon beasiswa dengan aturan anti-penumpukan (Stacking Limit: Max 100%).
 * Menjamin tagihan siswa tidak pernah bernilai negatif (minimal Rp 0).
 */
export function calculateScholarshipDiscount(
  originalAmount: number,
  schemes: ScholarshipSchemeInput[]
): DiscountCalculationResult {
  if (originalAmount <= 0) {
    return {
      originalAmount: 0,
      totalDiscount: 0,
      studentDueAmount: 0,
      sponsorCoverage: 0,
      effectivePercentage: 0,
    };
  }

  let totalDiscount = 0;

  for (const scheme of schemes) {
    let discountFromThisScheme = 0;

    if (scheme.coverageType === "FULL") {
      discountFromThisScheme = originalAmount;
    } else if (scheme.coverageType === "PERCENTAGE") {
      const percentage = Math.min(scheme.coverageValue, 100);
      discountFromThisScheme = (originalAmount * percentage) / 100;
    } else if (scheme.coverageType === "FIXED_AMOUNT") {
      discountFromThisScheme = Math.min(scheme.coverageValue, originalAmount);
    }

    totalDiscount += discountFromThisScheme;
  }

  // ATURAN PENUMPUKAN (STACKING LIMIT): Maksimal 100% dari biaya asli
  if (totalDiscount > originalAmount) {
    totalDiscount = originalAmount;
  }

  const studentDueAmount = Math.max(0, originalAmount - totalDiscount);
  const effectivePercentage = (totalDiscount / originalAmount) * 100;

  return {
    originalAmount,
    totalDiscount,
    studentDueAmount,
    sponsorCoverage: totalDiscount,
    effectivePercentage,
  };
}
