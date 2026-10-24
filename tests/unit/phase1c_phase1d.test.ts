import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";
import { comparePassword, hashPassword } from "@/lib/security/password-policy";
import { convertApplicantToStudent } from "@/lib/services/conversion";
import { calculateScholarshipDiscount } from "@/lib/services/scholarship";
import { getTerminology } from "@/lib/i18n/terminology";
import { validateTenantSlug, createTenantTrial } from "@/modules/saas/tenant-service";
import { hasFeature, checkLimit } from "@/modules/saas/entitlement";
import { createOtpChallenge } from "@/modules/otp/otp-service";
import { normalizePhoneE164 } from "@/lib/security/phone";
import { OtpChannel, OtpPurpose } from "@/modules/otp/types";
import { UserStatus, IdentifierType } from "@prisma/client";

describe("Fase 1C & 1D Unit Test Suite: Fondasi SaaS, Identitas Multi-Tenant, & Beasiswa", () => {
  let poltekmiInst: any;
  let sman1Inst: any;

  beforeAll(async () => {
    poltekmiInst = await prisma.institution.findUnique({ where: { slug: "poltekmi" } });
    sman1Inst = await prisma.institution.findUnique({ where: { slug: "sman1" } });

    if (!poltekmiInst || !sman1Inst) {
      throw new Error("Tenant poltekmi atau sman1 belum ada di database.");
    }
  });

  it("1C-1: Identifikasi Multikanal (Email pribadi, NIM, Email institusi) merujuk ke satu akun User", async () => {
    await withTenantTransaction(poltekmiInst.id, async (tenantDb) => {
      const cindyPersonalId = await (tenantDb as any).userIdentifier.findFirst({
        where: { value: "cindy.permata@gmail.com" },
        include: { user: true },
      });
      const cindyNimId = await (tenantDb as any).userIdentifier.findFirst({
        where: { value: "2301010012" },
      });
      const cindyInstEmailId = await (tenantDb as any).userIdentifier.findFirst({
        where: { value: "2301010012@poltekmi.ac.id" },
      });

      expect(cindyPersonalId?.user).toBeDefined();
      expect(cindyNimId).toBeDefined();
      expect(cindyInstEmailId).toBeDefined();

      expect(cindyPersonalId.userId).toBe(cindyNimId.userId);
      expect(cindyNimId.userId).toBe(cindyInstEmailId.userId);

      const isPassValid = await comparePassword("PasswordPendaftar123!", cindyPersonalId.user.passwordHash);
      expect(isPassValid).toBe(true);
      expect(cindyPersonalId.user.mustChangePassword).toBe(false);
    });
  });

  it("1C-2: Konversi Pendaftar ke Mahasiswa bersifat idempoten", async () => {
    await withTenantTransaction(poltekmiInst.id, async (tenantDb) => {
      const cindyApplicant = await (tenantDb as any).applicant.findFirst({
        where: { registrationNumber: "PMB-2025-001" },
      });
      expect(cindyApplicant).toBeDefined();

      const convRes = await convertApplicantToStudent({
        applicantId: cindyApplicant.id,
        dbClient: tenantDb,
      });
      expect(convRes.isAlreadyConverted).toBe(true);
    });
  });

  it("1C-3: Isolasi Akun Terikat Tenant: ID sama di tenant berbeda adalah entitas terpisah", async () => {
    await withTenantTransaction(poltekmiInst.id, async (polDb) => {
      const existing = await (polDb as any).userIdentifier.findFirst({ where: { value: "stf001" } });
      if (existing) {
        await (polDb as any).user.delete({ where: { id: existing.userId } });
      }

      const passHash = await hashPassword("STF001");
      const userPol = await (polDb as any).user.create({
        data: {
          fullName: "Staf Khusus Poltekmi",
          passwordHash: passHash,
          status: UserStatus.ACTIVE,
        },
      });

      await (polDb as any).userIdentifier.create({
        data: {
          userId: userPol.id,
          type: IdentifierType.INSTITUTION_ID,
          value: "stf001",
        },
      });
    });

    let stfInPoltekmi: any;
    let stfInSman1: any;

    await withTenantTransaction(poltekmiInst.id, async (polDb) => {
      stfInPoltekmi = await (polDb as any).userIdentifier.findFirst({ where: { value: "stf001" } });
    });

    await withTenantTransaction(sman1Inst.id, async (smanDb) => {
      stfInSman1 = await (smanDb as any).userIdentifier.findFirst({ where: { value: "stf001" } });
    });

    expect(stfInPoltekmi).toBeDefined();
    expect(stfInSman1).toBeDefined();
    expect(stfInPoltekmi.userId).not.toBe(stfInSman1.userId);
  });

  it("1C-4: Proteksi Kode Negara (+62 Allowlist) & Normalisasi E.164", async () => {
    const foreignOtp = await createOtpChallenge({
      purpose: OtpPurpose.FIRST_ACTIVATION,
      channel: OtpChannel.WHATSAPP,
      destinationE164: "+14155552671",
    });
    expect(foreignOtp.success).toBe(false);

    const normalized = normalizePhoneE164("081234567890");
    expect(normalized).toBe("+6281234567890");
  });

  it("1C-5: Perhitungan Diskon Beasiswa 50% dan Beasiswa Penuh 100% (Kasus Eks-identity_refactor_test)", () => {
    const feeAmount = 5000000;

    // Kasus 1: Beasiswa 50%
    const disc50 = calculateScholarshipDiscount(feeAmount, [
      {
        schemeName: "Beasiswa Yayasan 50%",
        sponsorName: "Yayasan Mitra",
        coverageType: "PERCENTAGE",
        coverageValue: 50,
      },
    ]);
    expect(disc50.totalDiscount).toBe(2500000);
    expect(disc50.studentDueAmount).toBe(2500000);
    expect(disc50.sponsorCoverage).toBe(2500000);

    // Kasus 2: Beasiswa 100% Penuh
    const discFull = calculateScholarshipDiscount(feeAmount, [
      {
        schemeName: "KIP-Kuliah Full",
        sponsorName: "Kemdikbud",
        coverageType: "FULL",
        coverageValue: 100,
      },
    ]);
    expect(discFull.studentDueAmount).toBe(0);
    expect(discFull.sponsorCoverage).toBe(5000000);
  });

  it("1C-6: Aturan Penumpukan Beasiswa: Stacking Cap maksimal 100% per tagihan", () => {
    const feeAmount = 5000000;
    // Penumpukan 70% + 50% = 120% nominal -> harus dicap tepat 100%
    const stacked = calculateScholarshipDiscount(feeAmount, [
      {
        schemeName: "Beasiswa Pemda",
        sponsorName: "Pemda",
        coverageType: "PERCENTAGE",
        coverageValue: 70,
      },
      {
        schemeName: "Beasiswa Korporat",
        sponsorName: "PT Maju",
        coverageType: "PERCENTAGE",
        coverageValue: 50,
      },
    ]);

    expect(stacked.totalDiscount).toBe(feeAmount);
    expect(stacked.studentDueAmount).toBe(0);
  });

  it("1D-1: Validasi Slug Institusi & Pencegahan Reserved Slugs", () => {
    const reservedSlugs = ["admin", "api", "app", "platform", "mail", "portal"];
    for (const slug of reservedSlugs) {
      const val = validateTenantSlug(slug);
      expect(val.isValid).toBe(false);
    }

    const validSlug = validateTenantSlug("universitas-kreatif");
    expect(validSlug.isValid).toBe(true);
  });

  it("1D-2: Pendaftaran Mandiri Tenant Baru (/signup): status TRIAL 14 hari & admin pertama langsung ACTIVE", async () => {
    const testTrialSlug = "kampus-merdeka-test";
    const existingTrial = await prisma.institution.findUnique({ where: { slug: testTrialSlug } });
    if (existingTrial) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_tenant', ${existingTrial.id}, true);`;
        await tx.membership.deleteMany({ where: { institutionId: existingTrial.id } });
        await tx.userIdentifier.deleteMany({ where: { institutionId: existingTrial.id } });
        await tx.staffProfile.deleteMany({ where: { institutionId: existingTrial.id } });
        await tx.user.deleteMany({ where: { institutionId: existingTrial.id } });
        await tx.subscription.deleteMany({ where: { institutionId: existingTrial.id } });
        await tx.institution.delete({ where: { id: existingTrial.id } });
      });
    }

    const trialRes = await createTenantTrial({
      name: "Universitas Kampus Merdeka",
      slug: testTrialSlug,
      type: "UNIVERSITY",
      adminFullName: "Dr. Rahmat Hidayat",
      adminPhone: "+6281299990002",
      adminPassword: "PasswordTrial123!",
    });

    expect(trialRes.institution?.status).toBe("TRIAL");
    expect(trialRes.adminUser?.status).toBe("ACTIVE");
    expect(trialRes.adminUser?.mustChangePassword).toBe(false);
  });

  it("1D-3: SaaS Entitlement & Quota Limit (hasFeature & checkLimit)", async () => {
    const hasFinance = await hasFeature(poltekmiInst.id, "finance");
    expect(hasFinance).toBe(true);

    const limitCheck = await checkLimit(poltekmiInst.id, "maxActiveUsers", 5);
    expect(limitCheck.allowed).toBe(true);
  });

  it("1D-4: Terminologi Dinamis Kampus vs Sekolah", () => {
    const termsCampus = getTerminology("UNIVERSITY");
    const termsSchool = getTerminology("SCHOOL");

    expect(termsCampus.student).toBe("Mahasiswa");
    expect(termsSchool.student).toBe("Siswa");
    expect(termsCampus.teacher).toBe("Dosen");
    expect(termsSchool.teacher).toBe("Guru");
    expect(termsCampus.class).toBe("Mata Kuliah / Kelas");
    expect(termsSchool.class).toBe("Rombel / Kelas");
  });

  it("1D-5: Pemilik Platform (PlatformUser) terisolasi di tabel terpisah dari User tenant", async () => {
    const platformAdmin = await prisma.platformUser.findUnique({
      where: { email: "superadmin@platform.system" },
    });
    expect(platformAdmin).toBeDefined();
    expect(platformAdmin?.email).toBe("superadmin@platform.system");
    expect(platformAdmin?.role).toBe("SUPER_ADMIN");
  });
});
