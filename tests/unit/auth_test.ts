import { prisma } from "../../src/lib/db/prisma";
import { verifyPassword, validateNewPassword } from "../../src/lib/security/hash";
import { getTerminology } from "../../src/lib/i18n/terminology";

async function runTests() {
  console.log("🧪 Menjalankan Unit & Integration Test Fase 1 (Auth, Multi-Tenant, i18n)...");

  // 1. Uji Terminologi i18n
  const univTerms = getTerminology("UNIVERSITY");
  const schoolTerms = getTerminology("SCHOOL");

  if (univTerms.teacher !== "Dosen" || univTerms.studentId !== "NIM" || univTerms.credits !== "Satuan Kredit Semester (SKS)") {
    throw new Error("❌ Terminologi Kampus tidak sesuai!");
  }
  if (schoolTerms.teacher !== "Guru" || schoolTerms.studentId !== "NIS / NISN" || schoolTerms.credits !== "Jam Pelajaran (JP)") {
    throw new Error("❌ Terminologi Sekolah tidak sesuai!");
  }
  console.log("✅ Test 1 Passed: Kamus istilah dinamis Sekolah vs Kampus terverifikasi akurat.");

  // 2. Uji Akun Mahasiswa Poltekmi
  const mhsId = await prisma.userIdentifier.findFirst({
    where: { value: "24TI0001" },
    include: { user: true, institution: true },
  });

  if (!mhsId || !mhsId.user) throw new Error("❌ Akun mahasiswa 24TI0001 tidak ditemukan di database!");
  if (mhsId.institution?.slug !== "poltekmi") throw new Error("❌ Tenant institusi mahasiswa bukan poltekmi!");
  if (!mhsId.user.mustChangePassword) throw new Error("❌ mustChangePassword mahasiswa harus bernilai true!");

  const isMhsPassValid = await verifyPassword("24TI0001", mhsId.user.passwordHash);
  if (!isMhsPassValid) throw new Error("❌ Password awal mahasiswa tidak cocok!");
  console.log("✅ Test 2 Passed: Akun Mahasiswa Poltekmi (24TI0001) terverifikasi dengan default password = ID dan mustChangePassword = true.");

  // 3. Uji Kebijakan Password Baru
  const valSameId = validateNewPassword("24TI0001", "24TI0001");
  if (valSameId.isValid) throw new Error("❌ Validasi harus menolak password baru yang sama dengan ID!");

  const valTooShort = validateNewPassword("Pass1", "24TI0001");
  if (valTooShort.isValid) throw new Error("❌ Validasi harus menolak password kurang dari 8 karakter!");

  const valNoNumber = validateNewPassword("PasswordLama", "24TI0001");
  if (valNoNumber.isValid) throw new Error("❌ Validasi harus menolak password tanpa angka!");

  const valValid = validateNewPassword("MahasiswaBaru2024!", "24TI0001");
  if (!valValid.isValid) throw new Error("❌ Validasi harus menerima password yang memenuhi syarat!");
  console.log("✅ Test 3 Passed: Kebijakan keamanan password baru teruji ketat (panjang, kombinasi, proteksi ID).");

  // 4. Uji Akun Siswa SMAN 1
  const siswaId = await prisma.userIdentifier.findFirst({
    where: { value: "24MIPA0001" },
    include: { user: true, institution: true },
  });

  if (!siswaId || !siswaId.user) throw new Error("❌ Akun siswa 24MIPA0001 tidak ditemukan!");
  if (siswaId.institution?.slug !== "sman1") throw new Error("❌ Tenant institusi siswa bukan sman1!");
  if (!siswaId.user.mustChangePassword) throw new Error("❌ mustChangePassword siswa harus bernilai true!");

  const isSiswaPassValid = await verifyPassword("24MIPA0001", siswaId.user.passwordHash);
  if (!isSiswaPassValid) throw new Error("❌ Password awal siswa tidak cocok!");
  console.log("✅ Test 4 Passed: Akun Siswa Sekolah (24MIPA0001) terverifikasi dengan default password = ID.");

  console.log("🎉 SEMUA TEST FASE 1 BERHASIL 100%!");
}

runTests()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
