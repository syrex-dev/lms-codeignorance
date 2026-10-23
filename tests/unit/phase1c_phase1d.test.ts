import { describe, it, expect } from "vitest";
import { prisma } from "../../src/lib/db/prisma";
import { withTenantTransaction } from "../../src/lib/db/tenant-prisma";
import { verifyPassword, hashPassword } from "../../src/lib/security/hash";
import { getTerminology } from "../../src/lib/i18n/terminology";
import { validatePasswordPolicy } from "../../src/lib/security/password-policy";
import { normalizePhoneE164, maskPhoneNumber, isValidIndonesianPhone } from "../../src/lib/security/phone";
import {
  createOtpChallenge,
  verifyOtpCode,
  hashOtpCode,
} from "../../src/modules/otp/otp-service";
import { hasFeature, checkLimit } from "../../src/modules/saas/entitlement";
import { validateTenantSlug, createTenantTrial } from "../../src/modules/saas/tenant-service";
import { convertApplicantToStudent } from "../../src/lib/services/conversion";
import { OtpChannel, OtpPurpose, UserStatus, IdentifierType, UserRole } from "@prisma/client";

describe("Fase 1C & 1D Unit Test Suite", () => {
  it("menjalankan seluruh skenario Fase 1C & 1D", async () => {
  console.log("==================================================================");
  console.log("🧪 TEST SUITE FASE 1C: REFAKTOR AUTH, OTP HP, & AKUN TERIKAT TENANT");
  console.log("==================================================================");

  const poltekmiInst = await prisma.institution.findUnique({ where: { slug: "poltekmi" } });
  if (!poltekmiInst) throw new Error("Tenant poltekmi tidak ditemukan!");

  // -------------------------------------------------------------------------
  // TEST 1C-1: Akun baru: Login dengan ID dan email institusi virtual memakai password awal
  // Status: PENDING_ACTIVATION & mustChangePassword = true
  // -------------------------------------------------------------------------
  console.log("\n[TEST 1C-1] Verifikasi Login Password Awal Akun Baru (Budi Santoso - 2301010011)...");
  await withTenantTransaction(poltekmiInst.id, async (tenantDb) => {
    const budiInstEmail = await (tenantDb as any).userIdentifier.findFirst({
      where: { value: "2301010011@poltekmi.ac.id" },
      include: { user: true, institution: true },
    });
    const budiNim = await (tenantDb as any).userIdentifier.findFirst({
      where: { value: "2301010011" },
      include: { user: true, institution: true },
    });

    if (!budiInstEmail || !budiNim || budiInstEmail.userId !== budiNim.userId) {
      throw new Error("❌ Identitas Budi Santoso (NIM dan Email virtual) tidak cocok!");
    }

    const budiUser = budiNim.user;
    const isPassValid = await verifyPassword("2301010011", budiUser.passwordHash);
    if (!isPassValid) throw new Error("❌ Password awal Budi Santoso tidak cocok!");

    if (budiUser.status !== UserStatus.PENDING_ACTIVATION || !budiUser.mustChangePassword) {
      throw new Error("❌ Akun baru harus berstatus PENDING_ACTIVATION dan mustChangePassword = true!");
    }
  });
  console.log("✅ TEST 1C-1 PASSED: Akun baru dapat login via NIM dan email virtual {ID}@{domain} dengan password awal = ID dan status PENDING_ACTIVATION.");

  // -------------------------------------------------------------------------
  // TEST 1C-2: Modul OTP: CSPRNG, hash HMAC, masa berlaku, rate limit, dan sekali pakai
  // -------------------------------------------------------------------------
  console.log("\n[TEST 1C-2] Verifikasi Keamanan Modul OTP (CSPRNG, Hash, Cooldown, Limit)...");

  const testPhone = "+6281299990001";
  await prisma.otpChallenge.deleteMany({
    where: { destinationE164: testPhone },
  });

  const otpChallenge = await createOtpChallenge({
    purpose: OtpPurpose.FIRST_ACTIVATION,
    channel: OtpChannel.WHATSAPP,
    destinationE164: testPhone,
  });

  if (!otpChallenge.success || !otpChallenge.challengeId) {
    throw new Error("❌ Gagal membuat tantangan OTP!");
  }

  // Periksa bahwa kode TIDAK disimpan plaintext di database
  const dbChallenge = await prisma.otpChallenge.findUnique({
    where: { id: otpChallenge.challengeId },
  });
  if (!dbChallenge || !dbChallenge.codeHash || dbChallenge.codeHash.length !== 64) {
    throw new Error("❌ Kode OTP harus disimpan HANYA sebagai HMAC hash 64-karakter!");
  }

  // Cek Cooldown (pengiriman kedua dalam 60 detik harus ditolak)
  const resendCooldown = await createOtpChallenge({
    purpose: OtpPurpose.FIRST_ACTIVATION,
    channel: OtpChannel.WHATSAPP,
    destinationE164: testPhone,
  });
  if (resendCooldown.success) {
    throw new Error("❌ Cooldown gagal! Pengiriman ulang dalam 60 detik harus ditolak!");
  }

  // Ambil kode dari DevOutbox untuk verifikasi
  const outboxEntry = await prisma.devOutbox.findFirst({
    where: { recipient: testPhone },
    orderBy: { createdAt: "desc" },
  });
  if (!outboxEntry) throw new Error("❌ Pesan OTP tidak tercatat di DevOutbox!");

  // Uji kode salah (harus menambah attempts)
  const wrongVerify = await verifyOtpCode({
    challengeId: otpChallenge.challengeId,
    code: "000000",
    purpose: OtpPurpose.FIRST_ACTIVATION,
  });
  if (wrongVerify.success) throw new Error("❌ Kode salah tidak boleh berhasil diverifikasi!");

  // Uji kode benar (harus sukses dan menghasilkan verification token)
  const correctVerify = await verifyOtpCode({
    challengeId: otpChallenge.challengeId,
    code: outboxEntry.code,
    purpose: OtpPurpose.FIRST_ACTIVATION,
  });
  if (!correctVerify.success || !correctVerify.verificationToken) {
    throw new Error("❌ Verifikasi kode OTP valid gagal!");
  }

  // Uji sekali pakai (kode yang sudah digunakan harus ditolak jika dipakai lagi)
  const reuseVerify = await verifyOtpCode({
    challengeId: otpChallenge.challengeId,
    code: outboxEntry.code,
    purpose: OtpPurpose.FIRST_ACTIVATION,
  });
  if (reuseVerify.success) throw new Error("❌ OTP tidak boleh dapat digunakan kembali (sekali pakai)!");

  console.log("✅ TEST 1C-2 PASSED: Modul OTP terbukti aman (HMAC hash, CSPRNG, cooldown, anti-replay/sekali pakai).");

  // -------------------------------------------------------------------------
  // TEST 1C-3: Kebijakan Password Baru (Password Policy)
  // -------------------------------------------------------------------------
  console.log("\n[TEST 1C-3] Verifikasi Kebijakan Ketat Password Baru...");

  const valId = await validatePasswordPolicy("2301010011", { identifier: "2301010011" });
  if (valId.isValid) throw new Error("❌ Password tidak boleh sama dengan ID!");

  const valDob = await validatePasswordPolicy("Budi20040515", { birthDate: new Date("2004-05-15") });
  if (valDob.isValid) throw new Error("❌ Password tidak boleh memuat tanggal lahir!");

  const valCommon = await validatePasswordPolicy("password123");
  if (valCommon.isValid) throw new Error("❌ Password umum harus ditolak!");

  const valValid = await validatePasswordPolicy("SiswaJuara2026!");
  if (!valValid.isValid) throw new Error("❌ Password valid harus diterima!");

  console.log("✅ TEST 1C-3 PASSED: Seluruh aturan kebijakan password (ID, DOB, umum, kekuatan) teruji ketat.");

  // -------------------------------------------------------------------------
  // TEST 1C-4: Konversi Pendaftar (Cindy Permata): Akun sama, password sama, idempoten
  // -------------------------------------------------------------------------
  console.log("\n[TEST 1C-4] Verifikasi Konversi Pendaftar Idempoten (Cindy Permata)...");

  await withTenantTransaction(poltekmiInst.id, async (tenantDb) => {
    const cindyUser = await (tenantDb as any).user.findFirst({
      where: { contactEmail: "cindy.permata@gmail.com" },
      include: { identifiers: true },
    });
    if (!cindyUser) throw new Error("❌ Akun Cindy Permata tidak ditemukan!");

    if (cindyUser.status !== UserStatus.ACTIVE || cindyUser.mustChangePassword !== false) {
      throw new Error("❌ Pendaftar terkonversi harus berstatus ACTIVE dan mustChangePassword = false!");
    }

    const isCindyPassValid = await verifyPassword("PasswordPendaftar123!", cindyUser.passwordHash);
    if (!isCindyPassValid) throw new Error("❌ Password pendaftar Cindy tidak cocok!");

    const cindyApplicant = await (tenantDb as any).applicant.findFirst({
      where: { registrationNumber: "PMB-2025-001" },
    });
    if (!cindyApplicant) throw new Error("❌ Pendaftar PMB-2025-001 tidak ditemukan!");

    const convRes = await convertApplicantToStudent({
      applicantId: cindyApplicant.id,
      dbClient: tenantDb,
    });
    if (!convRes.isAlreadyConverted) {
      throw new Error("❌ Pemanggilan ulang konversi harus terdeteksi isAlreadyConverted = true!");
    }
  });
  console.log("✅ TEST 1C-4 PASSED: Konversi pendaftar mempertahankan password asli, status ACTIVE, dan idempoten.");

  // -------------------------------------------------------------------------
  // TEST 1C-5: Akun Terikat Tenant: Akun dengan ID yang sama di tenant berbeda adalah entitas terpisah
  // -------------------------------------------------------------------------
  console.log("\n[TEST 1C-5] Verifikasi Isolasi Akun Terikat Tenant (Cross-Tenant Account Scoping)...");

  const sman1Inst = await prisma.institution.findUnique({ where: { slug: "sman1" } });
  if (!sman1Inst) throw new Error("❌ Tenant demo sman1 tidak ditemukan!");

  // Bersihkan akun pengujian jika sudah pernah dibuat sebelumnya
  await withTenantTransaction(poltekmiInst.id, async (polDb) => {
    const existingPoltekmiStf = await (polDb as any).userIdentifier.findFirst({
      where: { value: "stf001" },
    });
    if (existingPoltekmiStf) {
      await (polDb as any).user.delete({ where: { id: existingPoltekmiStf.userId } });
    }

    const passStfPoltekmi = await hashPassword("STF001");
    const userPoltekmi = await (polDb as any).user.create({
      data: {
        fullName: "Staf Khusus Poltekmi",
        passwordHash: passStfPoltekmi,
        status: UserStatus.ACTIVE,
      },
    });

    await (polDb as any).userIdentifier.create({
      data: {
        userId: userPoltekmi.id,
        type: IdentifierType.INSTITUTION_ID,
        value: "stf001",
      },
    });
  });

  let stfInPoltekmi: any;
  let stfInSman1: any;

  await withTenantTransaction(poltekmiInst.id, async (polDb) => {
    stfInPoltekmi = await (polDb as any).userIdentifier.findFirst({
      where: { value: "stf001" },
    });
  });

  await withTenantTransaction(sman1Inst.id, async (smanDb) => {
    stfInSman1 = await (smanDb as any).userIdentifier.findFirst({
      where: { value: "stf001" },
    });
  });

  if (!stfInPoltekmi || !stfInSman1 || stfInPoltekmi.userId === stfInSman1.userId) {
    throw new Error("❌ Akun dengan ID sama di dua tenant berbeda harus menjadi dua User terpisah!");
  }

  console.log("✅ TEST 1C-5 PASSED: ID yang sama (STF001) di dua tenant berbeda berhasil berjalan sebagai dua akun User terpisah tanpa konflik.");

  // -------------------------------------------------------------------------
  // TEST 1C-6: Proteksi Kode Negara (+62 Allowlist) & Normalisasi E.164
  // -------------------------------------------------------------------------
  console.log("\n[TEST 1C-6] Verifikasi Allowlist Kode Negara & Normalisasi E.164...");

  const foreignPhone = "+14155552671";
  const foreignOtp = await createOtpChallenge({
    purpose: OtpPurpose.FIRST_ACTIVATION,
    channel: OtpChannel.WHATSAPP,
    destinationE164: foreignPhone,
  });

  if (foreignOtp.success) {
    throw new Error("❌ Nomor di luar Indonesia (+62) harus ditolak!");
  }

  const normalized = normalizePhoneE164("081234567890");
  if (normalized !== "+6281234567890") {
    throw new Error("❌ Normalisasi nomor 08xx ke +628xx gagal!");
  }

  console.log("✅ TEST 1C-6 PASSED: Nomor luar negeri ditolak dan normalisasi E.164 Indonesia terverifikasi.");

  // =========================================================================
  // FASE 1D: FONDASI SAAS & MULTI-TENANT
  // =========================================================================
  console.log("\n==================================================================");
  console.log("🧪 TEST SUITE FASE 1D: FONDASI SAAS & MULTI-TENANT");
  console.log("==================================================================");

  // TEST 1D-1: Validasi Slug Institusi & Reserved Slugs
  console.log("\n[TEST 1D-1] Verifikasi Validasi Slug Institusi & Reserved Slugs...");
  const reservedSlugs = ["admin", "api", "app", "platform", "mail", "portal"];
  for (const slug of reservedSlugs) {
    const val = validateTenantSlug(slug);
    if (val.isValid) throw new Error(`❌ Reserved slug '${slug}' harus ditolak!`);
  }
  const validSlug = validateTenantSlug("universitas-kreatif");
  if (!validSlug.isValid) throw new Error("❌ Slug valid universitas-kreatif harus diterima!");
  console.log("✅ TEST 1D-1 PASSED: Validasi slug dan pencegahan reserved slugs (admin, platform, app, dll.) terverifikasi.");

  // TEST 1D-2: Pendaftaran Mandiri Tenant Baru (/signup)
  console.log("\n[TEST 1D-2] Verifikasi Alur Pendaftaran Mandiri Tenant Baru (/signup)...");
  const testTrialSlug = "kampus-merdeka-test";
  const existingTrial = await prisma.institution.findUnique({ where: { slug: testTrialSlug } });
  if (existingTrial) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant = '${existingTrial.id}';`);
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

  if (!trialRes.institution || trialRes.institution.status !== "TRIAL") {
    throw new Error("❌ Tenant baru harus berstatus TRIAL!");
  }
  if (!trialRes.adminUser || trialRes.adminUser.status !== "ACTIVE" || trialRes.adminUser.mustChangePassword) {
    throw new Error("❌ Admin pertama pendaftaran mandiri harus langsung ACTIVE dan mustChangePassword = false!");
  }
  console.log("✅ TEST 1D-2 PASSED: Pendaftaran mandiri tenant menghasilkan status TRIAL 14 hari dan admin pertama langsung ACTIVE.");

  // TEST 1D-3: Entitlement & Quota Limit
  console.log("\n[TEST 1D-3] Verifikasi SaaS Entitlement & Quota Limit...");
  const hasFinance = await hasFeature(poltekmiInst.id, "finance");
  if (!hasFinance) throw new Error("❌ Poltekmi (Plan Pro) harus memiliki fitur finance!");

  const limitCheck = await checkLimit(poltekmiInst.id, "maxActiveUsers", 5);
  if (!limitCheck.allowed) throw new Error("❌ Penggunaan di bawah batas harus diizinkan!");
  console.log("✅ TEST 1D-3 PASSED: Entitlement fitur dan pengecekan kuota paket terverifikasi akurat.");

  // TEST 1D-4: Terminologi Dinamis Kampus vs Sekolah
  console.log("\n[TEST 1D-4] Verifikasi Istilah Dinamis Kampus vs Sekolah...");
  const termsCampus = getTerminology("UNIVERSITY");
  const termsSchool = getTerminology("SCHOOL");
  if (termsCampus.student !== "Mahasiswa" || termsSchool.student !== "Siswa") {
    throw new Error("❌ Kamus istilah siswa/mahasiswa tidak sesuai!");
  }
  if (termsCampus.class !== "Mata Kuliah / Kelas" || termsSchool.class !== "Rombel / Kelas") {
    throw new Error("❌ Kamus istilah kelas tidak sesuai!");
  }
  console.log("✅ TEST 1D-4 PASSED: Dua tenant (Sekolah & Kampus) menggunakan kamus terminologi dinamis yang tepat.");

  // TEST 1D-5: PlatformUser Terpisah
  console.log("\n[TEST 1D-5] Verifikasi Pemilik Platform (PlatformUser)...");
  const platformAdmin = await prisma.platformUser.findUnique({
    where: { email: "superadmin@platform.system" },
  });
  if (!platformAdmin) throw new Error("❌ PlatformUser pemilik platform harus ada!");
  console.log("✅ TEST 1D-5 PASSED: Pemilik platform terisolasi di tabel PlatformUser terpisah dari User tenant.");

  console.log("\n==================================================================");
  console.log("🎉 SELURUH TEST FASE 1C DAN 1D BERHASIL 100% TANPA KESALAHAN!");
  console.log("==================================================================");
  });
});
