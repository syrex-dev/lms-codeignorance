import { prisma } from "../../src/lib/db/prisma";
import { verifyPassword, validateNewPassword } from "../../src/lib/security/hash";
import { getTerminology } from "../../src/lib/i18n/terminology";
import { convertApplicantToStudent } from "../../src/lib/services/conversion";
import { calculateScholarshipDiscount } from "../../src/lib/services/scholarship";

async function runPhase1BTests() {
  console.log("==================================================================");
  console.log("🧪 MENJALANKAN TEST SUITE FASE 1B: REFAKTOR IDENTITAS & FINANSIAL");
  console.log("==================================================================");

  // -------------------------------------------------------------------------
  // TEST 1: User yang mendaftar dengan email pribadi, setelah konversi,
  // dapat login dengan (1) email pribadi, (2) NIM, dan (3) email institusi,
  // memakai password yang sama, tanpa akun baru dan tanpa dipaksa ganti password.
  // -------------------------------------------------------------------------
  console.log("\n[TEST 1] Verifikasi Multi-Identifier Login Akun Terkonversi (Cindy Permata)...");

  // Identifiers: (1) personal email, (2) NIM, (3) institution email
  const cindyPersonalId = await prisma.userIdentifier.findFirst({
    where: { value: { equals: "cindy.permata@gmail.com", mode: "insensitive" }, isLoginEnabled: true },
    include: { user: true },
  });
  const cindyNimId = await prisma.userIdentifier.findFirst({
    where: { value: "24TI0003", isLoginEnabled: true },
    include: { user: true },
  });
  const cindyInstEmailId = await prisma.userIdentifier.findFirst({
    where: { value: { equals: "24ti0003@poltekmi.ac.id", mode: "insensitive" }, isLoginEnabled: true },
    include: { user: true },
  });

  if (!cindyPersonalId || !cindyNimId || !cindyInstEmailId) {
    throw new Error("❌ Identifiers Cindy Permata tidak lengkap!");
  }

  // Ketiganya HARUS merujuk ke SATU ID user akun yang sama!
  if (
    cindyPersonalId.userId !== cindyNimId.userId ||
    cindyNimId.userId !== cindyInstEmailId.userId
  ) {
    throw new Error("❌ Identifiers tidak merujuk ke akun User yang sama!");
  }

  const cindyUser = cindyPersonalId.user;

  // Verifikasi password pendaftar yang sama berlaku untuk akun ini
  const isPassValid = await verifyPassword("PasswordPendaftar123!", cindyUser.passwordHash);
  if (!isPassValid) {
    throw new Error("❌ Password pendaftar tidak cocok!");
  }

  // Verifikasi TIDAK dipaksa ganti password (mustChangePassword == false)
  if (cindyUser.mustChangePassword !== false) {
    throw new Error("❌ mustChangePassword pendaftar terkonversi harus false!");
  }

  console.log("✅ TEST 1 PASSED: Akun Cindy Permata berhasil dikenali via (1) email pribadi, (2) NIM 24TI0003, dan (3) email 24TI0003@poltekmi.ac.id menggunakan password pendaftar asli tanpa dipaksa ganti password!");

  // -------------------------------------------------------------------------
  // TEST 2: Konversi dijalankan dua kali tidak menghasilkan NIM/akun ganda (Idempotent)
  // -------------------------------------------------------------------------
  console.log("\n[TEST 2] Verifikasi Idempotensi Pipeline Konversi Pendaftar...");

  const cindyApplicant = await prisma.applicant.findFirst({
    where: { registrationNumber: "PMB-2025-001" },
  });

  if (!cindyApplicant) throw new Error("❌ Pendaftar PMB-2025-001 tidak ditemukan!");

  const countBeforeSecondRun = await prisma.studentProfile.count({
    where: { studentIdNumber: "24TI0003" },
  });

  // Eksekusi kedua kali
  const secondRunResult = await convertApplicantToStudent({
    applicantId: cindyApplicant.id,
  });

  const countAfterSecondRun = await prisma.studentProfile.count({
    where: { studentIdNumber: "24TI0003" },
  });

  if (secondRunResult.isAlreadyConverted !== true) {
    throw new Error("❌ Konversi ulang harus mendeteksi status isAlreadyConverted = true!");
  }

  if (countBeforeSecondRun !== countAfterSecondRun || countAfterSecondRun !== 1) {
    throw new Error("❌ Konversi ulang menduplikasi StudentProfile atau NIM!");
  }

  console.log("✅ TEST 2 PASSED: Pipeline konversi terbukti idempoten (menghasilkan NIM & profil tunggal saat dijalankan berulang).");

  // -------------------------------------------------------------------------
  // TEST 3: Akun hasil import manual/CSV login dengan password awal = ID
  // lalu dipaksa ganti password (mustChangePassword = true)
  // -------------------------------------------------------------------------
  console.log("\n[TEST 3] Verifikasi Akun Import Manual (Budi Santoso - 24TI0001)...");

  const budiNim = await prisma.userIdentifier.findFirst({
    where: { value: "24TI0001" },
    include: { user: true },
  });

  if (!budiNim || !budiNim.user) throw new Error("❌ Akun 24TI0001 tidak ditemukan!");

  const isBudiPassValid = await verifyPassword("24TI0001", budiNim.user.passwordHash);
  if (!isBudiPassValid) throw new Error("❌ Password awal 24TI0001 tidak cocok!");

  if (budiNim.user.mustChangePassword !== true) {
    throw new Error("❌ mustChangePassword akun import harus true!");
  }

  console.log("✅ TEST 3 PASSED: Akun import manual login dengan ID, password awal = ID, dan berstatus mustChangePassword = true.");

  // -------------------------------------------------------------------------
  // TEST 4: Invoice dengan beasiswa 50% menghasilkan tagihan pendaftar dan
  // SponsorInvoice yang sesuai; beasiswa penuh menghasilkan tagihan Rp0
  // -------------------------------------------------------------------------
  console.log("\n[TEST 4] Verifikasi Perhitungan Beasiswa & SponsorInvoice...");

  const feeAmount = 5000000; // UKT Rp 5.000.000

  // Kasus 1: Beasiswa 50% Yayasan
  const disc50 = calculateScholarshipDiscount(feeAmount, [
    {
      schemeName: "Beasiswa Yayasan 50%",
      sponsorName: "Yayasan Mitra",
      coverageType: "PERCENTAGE",
      coverageValue: 50,
    },
  ]);

  if (disc50.totalDiscount !== 2500000 || disc50.studentDueAmount !== 2500000 || disc50.sponsorCoverage !== 2500000) {
    throw new Error(`❌ Perhitungan beasiswa 50% salah: diskon=${disc50.totalDiscount}, tagihan=${disc50.studentDueAmount}`);
  }

  // Kasus 2: Beasiswa Penuh (FULL 100%)
  const discFull = calculateScholarshipDiscount(feeAmount, [
    {
      schemeName: "KIP-Kuliah Full",
      sponsorName: "Kemdikbud",
      coverageType: "FULL",
      coverageValue: 100,
    },
  ]);

  if (discFull.studentDueAmount !== 0 || discFull.sponsorCoverage !== 5000000) {
    throw new Error(`❌ Beasiswa penuh harus menghasilkan tagihan Rp0! (Dihasilkan: ${discFull.studentDueAmount})`);
  }

  // Periksa data SponsorInvoice di database
  const sponsorInv = await prisma.sponsorInvoice.findFirst({
    where: { invoiceNumber: "SPON-YAYASAN-2024-001" },
  });
  if (!sponsorInv || Number(sponsorInv.totalAmount) !== 2500000) {
    throw new Error("❌ SponsorInvoice untuk beasiswa 50% tidak sesuai di database!");
  }

  console.log("✅ TEST 4 PASSED: Beasiswa 50% membagi tagihan siswa (Rp 2.500.000) dan SponsorInvoice (Rp 2.500.000); Beasiswa penuh menghasilkan tagihan Rp0!");

  // -------------------------------------------------------------------------
  // TEST 5: Penumpukan beasiswa tidak melebihi 100% per komponen biaya (Stacking Cap)
  // -------------------------------------------------------------------------
  console.log("\n[TEST 5] Verifikasi Aturan Penumpukan Beasiswa (Stacking Cap <= 100%)...");

  // Penumpukan 2 beasiswa: 70% + 50% = 120% nominal -> harus dicap maksimal 100% (Rp 5.000.000), siswa bayar Rp0
  const stackedDiscount = calculateScholarshipDiscount(feeAmount, [
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

  if (stackedDiscount.totalDiscount !== feeAmount || stackedDiscount.studentDueAmount !== 0) {
    throw new Error(`❌ Stacking cap gagal! Total diskon ${stackedDiscount.totalDiscount} melebihi atau tidak sesuai biaya ${feeAmount}`);
  }

  console.log("✅ TEST 5 PASSED: Penumpukan beasiswa (70% + 50%) terbukti dicap tepat pada batas maksimal 100% (Rp 5.000.000) dan tagihan siswa tetap Rp0 (tidak negatif).");

  // -------------------------------------------------------------------------
  // TEST 6: Regresi Test Fase 1 (Kamus Istilah & Password Policy)
  // -------------------------------------------------------------------------
  console.log("\n[TEST 6] Verifikasi Regresi Fitur Fase 1 (i18n & Password Policy)...");

  const univTerms = getTerminology("UNIVERSITY");
  const schoolTerms = getTerminology("SCHOOL");

  if (univTerms.teacher !== "Dosen" || univTerms.studentId !== "NIM" || univTerms.credits !== "Satuan Kredit Semester (SKS)") {
    throw new Error("❌ Terminologi Kampus regresi gagal!");
  }
  if (schoolTerms.teacher !== "Guru" || schoolTerms.studentId !== "NIS / NISN" || schoolTerms.credits !== "Jam Pelajaran (JP)") {
    throw new Error("❌ Terminologi Sekolah regresi gagal!");
  }

  const passVal = validateNewPassword("CindyKeren2025!", "24TI0003");
  if (!passVal.isValid) throw new Error("❌ Validasi password baru gagal!");

  const passValSame = validateNewPassword("24TI0003", "24TI0003");
  if (passValSame.isValid) throw new Error("❌ Validasi password tidak boleh mengizinkan password sama dengan ID!");

  console.log("✅ TEST 6 PASSED: Seluruh pengujian regresi fitur Fase 1 tetap lulus 100%!");

  console.log("\n==================================================================");
  console.log("🎉 SEMUA TEST FASE 1B BERHASIL 100% DENGAN SUKSES!");
  console.log("==================================================================");
}

runPhase1BTests()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
