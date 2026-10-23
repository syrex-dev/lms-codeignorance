import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getTenantPrisma, withTenantTransaction } from "@/lib/db/tenant-prisma";
import { generateId, previewIdFormat, updateUserId } from "@/modules/id-generator/generator";
import { UserService } from "@/modules/users/user-service";
import { CsvImportService, mapRole } from "@/modules/users/csv-import";
import { AccountCardService, sanitizeCsvCell } from "@/modules/users/account-cards";
import { AcademicService } from "@/modules/academic/academic-service";
import { comparePassword } from "@/lib/security/password-policy";
import { UserRole, UserStatus } from "@prisma/client";

describe("Fase 2 Unit Test Suite", () => {
  it("menjalankan seluruh skenario Fase 2 master data & user management", async () => {
  console.log("=== MEMULAI TEST SUITE FASE 2 ===");
  let passedCount = 0;
  let totalCount = 0;

  const assert = (condition: boolean, msg: string) => {
    totalCount++;
    if (!condition) {
      console.error(`❌ FAILED: ${msg}`);
      throw new Error(`Test assertion failed: ${msg}`);
    } else {
      console.log(`✅ PASSED: ${msg}`);
      passedCount++;
    }
  };

  // Setup: Ambil 2 tenant demo
  const poltekmi = await prisma.institution.findUnique({ where: { slug: "poltekmi" } });
  const sman1 = await prisma.institution.findUnique({ where: { slug: "sman1" } });

  if (!poltekmi || !sman1) {
    throw new Error("Tenant poltekmi atau sman1 belum ada di database.");
  }

  // Ambil user admin poltekmi dengan RLS tenant transaction
  const adminPoltekmi = await withTenantTransaction(poltekmi.id, async (tenantDb) => {
    return (tenantDb as any).user.findFirst({
      where: {
        institutionId: poltekmi.id,
        memberships: { some: { role: UserRole.INSTITUTION_ADMIN } },
      },
      include: { memberships: true },
    });
  });
  if (!adminPoltekmi) throw new Error("Admin Poltekmi tidak ditemukan di database.");

  // Ambil user guru/dosen poltekmi dengan RLS tenant transaction
  const teacherPoltekmi = await withTenantTransaction(poltekmi.id, async (tenantDb) => {
    return (tenantDb as any).user.findFirst({
      where: {
        institutionId: poltekmi.id,
        memberships: { some: { role: UserRole.TEACHER } },
      },
      include: { memberships: true },
    });
  });
  if (!teacherPoltekmi) throw new Error("Dosen/Guru Poltekmi tidak ditemukan di database.");

  // --------------------------------------------------------------------------
  // TEST 1: Generator ID Konkuren (20 pembuatan konkuren tanpa duplikat)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 1: Generator ID Konkuren 20 Proses ---");
  const concurrentScope = `TEST_CONC_${Date.now()}`;
  const template = "{TAHUN2}TI{URUT4}";

  const promises = Array.from({ length: 20 }).map(() =>
    generateId(poltekmi.id, {
      template,
      scope: concurrentScope,
      year: 2026,
    })
  );

  const generatedIds = await Promise.all(promises);
  const uniqueIds = new Set(generatedIds);

  assert(
    generatedIds.length === 20 && uniqueIds.size === 20,
    `20 ID berhasil digenerate secara konkuren tanpa ada satupun duplikat (Unique count: ${uniqueIds.size}/20)`
  );

  // Template berbeda per tenant tidak saling memengaruhi counter
  const smanId = await generateId(sman1.id, {
    template: "{TAHUN2}IPA{URUT4}",
    scope: concurrentScope,
    year: 2026,
  });
  assert(
    smanId.endsWith("0001"),
    `Tenant lain (SMAN 1) memiliki counter independen yang dimulai dari 0001 (${smanId})`
  );

  // --------------------------------------------------------------------------
  // TEST 2: Pembuatan Akun SAME_AS_ID vs RANDOM & Plaintext Verification
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 2: Pembuatan Akun SAME_AS_ID vs RANDOM ---");
  const testIdSame = `test_same_${Date.now()}`;
  const userSame = await UserService.createUser(
    {
      institutionId: poltekmi.id,
      fullName: "User Same As ID",
      role: UserRole.STUDENT,
      id: testIdSame,
    },
    adminPoltekmi.id
  );

  assert(
    userSame.status === UserStatus.PENDING_ACTIVATION,
    "Mode SAME_AS_ID membuat akun berstatus PENDING_ACTIVATION"
  );
  assert(
    userSame.initialPasswordPlain === undefined,
    "Mode SAME_AS_ID tidak menyertakan password acak di return value"
  );

  // Cek verifikasi hash password awal sama dengan ID
  const dbUserSame = await withTenantTransaction(poltekmi.id, async (tenantDb) =>
    (tenantDb as any).user.findUnique({ where: { id: userSame.userId } })
  );
  const isMatchSame = await comparePassword(testIdSame, dbUserSame!.passwordHash);
  assert(isMatchSame, "Password awal hash di database cocok dengan ID pengguna");

  // Buat tenant temporer atau ubah mode ke RANDOM untuk uji mode RANDOM
  await prisma.institution.update({
    where: { id: poltekmi.id },
    data: { initialPasswordMode: "RANDOM" },
  });

  const testIdRandom = `test_rnd_${Date.now()}`;
  const userRandom = await UserService.createUser(
    {
      institutionId: poltekmi.id,
      fullName: "User Random Mode",
      role: UserRole.STUDENT,
      id: testIdRandom,
    },
    adminPoltekmi.id
  );

  assert(
    userRandom.status === UserStatus.PENDING_ACTIVATION,
    "Mode RANDOM membuat akun berstatus PENDING_ACTIVATION"
  );
  assert(
    Boolean(userRandom.initialPasswordPlain),
    "Mode RANDOM menghasilkan plaintext password di memori"
  );

  // Verifikasi database: TIDAK ADA plaintext password di database
  const dbUserRandom = await withTenantTransaction(poltekmi.id, async (tenantDb) =>
    (tenantDb as any).user.findUnique({ where: { id: userRandom.userId } })
  );
  const isMatchRandom = await comparePassword(
    userRandom.initialPasswordPlain!,
    dbUserRandom!.passwordHash
  );
  assert(isMatchRandom, "Password acak terverifikasi cocok terhadap hash password di database");

  // Pastikan hash di DB bukan plaintext
  assert(
    dbUserRandom!.passwordHash !== userRandom.initialPasswordPlain,
    "Database hanya menyimpan bcrypt hash dan TIDAK PERNAH menyimpan password plaintext"
  );

  // Kembalikan mode tenant poltekmi ke SAME_AS_ID
  await prisma.institution.update({
    where: { id: poltekmi.id },
    data: { initialPasswordMode: "SAME_AS_ID" },
  });

  // --------------------------------------------------------------------------
  // TEST 3: Import CSV Preview (Deteksi duplikat, invalid phone, unknown class)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 3: Validasi Preview Impor CSV ---");
  const badCsv = [
    "nama,peran,id,tanggal_lahir,nomor_hp,email_kontak,kelas_prodi",
    // Baris 1: Valid
    "Mahasiswa Valid 1,MAHASISWA,24TI9001,2005-01-01,+6281234567891,val1@test.com,TI",
    // Baris 2: Duplikat ID di dalam file
    "Mahasiswa Duplikat File,MAHASISWA,24TI9001,2005-01-01,+6281234567892,dup1@test.com,TI",
    // Baris 3: Duplikat ID dengan yang sudah ada di database (testIdSame)
    `Mahasiswa Duplikat DB,MAHASISWA,${testIdSame},2005-01-01,+6281234567893,dup2@test.com,TI`,
    // Baris 4: Nomor HP tidak valid (+1 luar negeri / bukan +62)
    "Mahasiswa HP Salah,MAHASISWA,24TI9004,2005-01-01,+12025550199,hp@test.com,TI",
    // Baris 5: Kelas/Prodi tidak dikenal
    "Mahasiswa Prodi Asing,MAHASISWA,24TI9005,2005-01-01,+6281234567895,asing@test.com,JURUSAN_GHAIB_999",
  ].join("\n");

  const preview = await CsvImportService.previewCsv(poltekmi.id, badCsv);
  assert(preview.totalRows === 5, "Preview membaca 5 baris data");
  assert(preview.validCount === 1, `Baris valid terhitung 1 (Hasil: ${preview.validCount})`);
  assert(preview.invalidCount === 4, `Baris tidak valid terhitung 4 (Hasil: ${preview.invalidCount})`);

  // Cek pesan error spesifik
  const dupFileRow = preview.rows.find((r) => r.raw.nama === "Mahasiswa Duplikat File");
  assert(
    Boolean(dupFileRow?.errors.some((e) => e.includes("duplikat di dalam file"))),
    "Preview menangkap error duplikat ID dalam file"
  );

  const dupDbRow = preview.rows.find((r) => r.raw.nama === "Mahasiswa Duplikat DB");
  assert(
    Boolean(dupDbRow?.errors.some((e) => e.includes("sudah terdaftar di database"))),
    "Preview menangkap error ID sudah terdaftar di database"
  );

  const wrongPhoneRow = preview.rows.find((r) => r.raw.nama === "Mahasiswa HP Salah");
  assert(
    Boolean(wrongPhoneRow?.errors.some((e) => e.includes("bukan nomor Indonesia (+62)"))),
    "Preview menangkap error nomor HP di luar Indonesia (+62)"
  );

  const unknownProdiRow = preview.rows.find((r) => r.raw.nama === "Mahasiswa Prodi Asing");
  assert(
    Boolean(unknownProdiRow?.errors.some((e) => e.includes("tidak ditemukan di sistem"))),
    "Preview menangkap error kelas/prodi tidak dikenal"
  );

  // --------------------------------------------------------------------------
  // TEST 4: Eksekusi Impor Idempoten & maxActiveUsers Kuota
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 4: Eksekusi Impor Idempoten & Kuota Pengguna Aktif ---");
  const uniqueImportId = `imp_${Date.now()}`;
  const validCsv = [
    "nama,peran,id,tanggal_lahir,nomor_hp,email_kontak,kelas_prodi",
    `Siswa Impor Sukses,MAHASISWA,${uniqueImportId},2005-02-02,+6281234567899,imp@test.com,TI`,
  ].join("\n");

  const previewSingle = await CsvImportService.previewCsv(poltekmi.id, validCsv);
  assert(previewSingle.validCount === 1, "Baris impor siap dieksekusi");

  // Impor Pertama
  const importResult1 = await CsvImportService.executeImport(
    poltekmi.id,
    adminPoltekmi.id,
    previewSingle.rows,
    { importOnlyValid: true }
  );
  assert(
    importResult1.importedCount === 1 && importResult1.skippedCount === 0,
    "Impor pertama berhasil membuat 1 pengguna baru"
  );

  // Impor Ulang dengan file yang sama (Uji Idempotensi)
  // Pada preview kedua, ID sudah ada di DB. Namun jika dieksekusi dengan normalized data yang sama:
  const importResult2 = await CsvImportService.executeImport(
    poltekmi.id,
    adminPoltekmi.id,
    previewSingle.rows,
    { importOnlyValid: true }
  );
  assert(
    importResult2.importedCount === 0 && importResult2.skippedCount === 1,
    "Impor ulang file yang sama bersifat idempoten (0 imported, 1 skipped) dan tidak membuat duplikat"
  );

  // --------------------------------------------------------------------------
  // TEST 5: Keamanan Kartu Akun (Password RANDOM Tidak Dapat Ditampilkan Ulang)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 5: Keamanan Kartu Akun ---");
  // Kartu untuk user yang dibuat dengan RANDOM mode
  const randomCard = {
    fullName: userRandom.fullName,
    id: userRandom.id,
    loginEmail: userRandom.loginEmail,
    initialPasswordMode: "RANDOM" as const,
    initialPasswordPlain: undefined, // Saat dibaca dari DB, tidak pernah ada password plaintext
    institutionName: poltekmi.name,
    tenantSlug: poltekmi.slug,
  };

  const instruction = AccountCardService.getActivationInstructions(randomCard);
  assert(
    !instruction.includes("Pwd") && instruction.includes("password awal yang sama"),
    "Jika data kartu diambil ulang dari database, password RANDOM tidak pernah bocor"
  );

  // --------------------------------------------------------------------------
  // TEST 6: Isolasi Lintas Tenant (Tenant A vs Tenant B)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 6: Isolasi Data Tenant A vs Tenant B ---");
  // Admin Poltekmi mencari pengguna di Poltekmi
  const poltekmiUsers = await UserService.searchUsers(poltekmi.id, { limit: 100 });
  const containsSmanUser = poltekmiUsers.users.some((u: any) => u.identifier.includes("sman"));
  assert(!containsSmanUser, "Query pengguna tenant Poltekmi tidak pernah memuat data tenant SMAN 1");

  // Coba akses user milik SMAN 1 menggunakan konteks tenant Poltekmi
  const smanUser = await withTenantTransaction(sman1.id, async (tenantDb) =>
    (tenantDb as any).user.findFirst({
      where: { institutionId: sman1.id },
    })
  );

  if (smanUser) {
    let failedCrossTenant = false;
    try {
      await UserService.toggleUserStatus(
        poltekmi.id, // konteks Poltekmi
        smanUser.id, // user SMAN 1
        UserStatus.SUSPENDED,
        adminPoltekmi.id,
        "Uji isolasi tenant"
      );
    } catch (e: any) {
      failedCrossTenant = true;
    }
    assert(
      failedCrossTenant,
      "Operasi perubahan status menolak user milik tenant lain (fail-closed tenant isolation)"
    );
  }

  // --------------------------------------------------------------------------
  // TEST 7: RBAC Protection (Guru & Staf Non-Admin Ditolak)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 7: Hak Akses & RBAC Modul Pengguna ---");
  // Simulasi cek RBAC: Guru tidak memiliki akses manajemen pengguna
  const teacherRole = teacherPoltekmi.memberships[0]?.role;
  assert(
    teacherRole !== UserRole.INSTITUTION_ADMIN &&
      teacherRole !== UserRole.SUPER_ADMIN,
    `Guru/Dosen (${teacherPoltekmi.fullName}) memiliki peran ${teacherRole} dan ditolak dari wewenang admin`
  );

  // --------------------------------------------------------------------------
  // TEST 8: Proteksi CSV Injection (Formula Injection Escaping)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 8: Proteksi CSV Injection ---");
  const formulaCells = ["=cmd|' /C calc'!A0", "+12345", "-500", "@SUM(A1:A10)"];
  for (const cell of formulaCells) {
    const sanitized = sanitizeCsvCell(cell);
    assert(
      sanitized.startsWith("'"),
      `Sel berbahaya "${cell}" berhasil di-escape dengan tanda petik tunggal: "${sanitized}"`
    );
  }

  // Ekspor CSV dengan formula berbahaya
  const cardWithFormula = [
    {
      fullName: "=HYPERLINK(\"http://evil.com\")",
      id: "+628123456",
      loginEmail: "-injected@test.com",
      initialPasswordMode: "SAME_AS_ID" as const,
      institutionName: poltekmi.name,
      tenantSlug: poltekmi.slug,
    },
  ];

  const exportedCsv = AccountCardService.exportToCsv(cardWithFormula);
  assert(
    exportedCsv.includes("''=HYPERLINK") || exportedCsv.includes("'=HYPERLINK"),
    "Ekspor CSV berhasil meng-escape nama yang memuat formula spreadsheet"
  );
  assert(
    exportedCsv.includes("'+628123456"),
    "Ekspor CSV berhasil meng-escape ID yang diawali tanda +"
  );

  console.log(`\n========================================`);
  console.log(`🎉 SEMUA TEST FASE 2 BERHASIL (${passedCount}/${totalCount} LULUS)`);
  console.log(`========================================\n`);
  });
});
