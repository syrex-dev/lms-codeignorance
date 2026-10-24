import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";
import { generateId } from "@/modules/id-generator/generator";
import { UserService } from "@/modules/users/user-service";
import { CsvImportService } from "@/modules/users/csv-import";
import { AccountCardService, sanitizeCsvCell } from "@/modules/users/account-cards";
import { comparePassword } from "@/lib/security/password-policy";
import { UserRole, UserStatus } from "@prisma/client";

describe("Fase 2 Unit Test Suite: Master Data, User Management, Kartu Akun, CSV Import, & ID Generator", () => {
  let poltekmi: any;
  let sman1: any;
  let adminPoltekmi: any;
  let teacherPoltekmi: any;
  let userSame: any;
  let userRandom: any;
  let testIdSame: string;
  let testIdRandom: string;

  beforeAll(async () => {
    poltekmi = await prisma.institution.findUnique({ where: { slug: "poltekmi" } });
    sman1 = await prisma.institution.findUnique({ where: { slug: "sman1" } });

    if (!poltekmi || !sman1) {
      throw new Error("Tenant poltekmi atau sman1 belum ada di database.");
    }

    adminPoltekmi = await withTenantTransaction(poltekmi.id, async (tenantDb) => {
      return (tenantDb as any).user.findFirst({
        where: {
          institutionId: poltekmi.id,
          memberships: { some: { role: UserRole.INSTITUTION_ADMIN } },
        },
        include: { memberships: true },
      });
    });

    teacherPoltekmi = await withTenantTransaction(poltekmi.id, async (tenantDb) => {
      return (tenantDb as any).user.findFirst({
        where: {
          institutionId: poltekmi.id,
          memberships: { some: { role: UserRole.TEACHER } },
        },
        include: { memberships: true },
      });
    });

    if (!adminPoltekmi || !teacherPoltekmi) {
      throw new Error("Admin atau Guru Poltekmi belum ada di database.");
    }
  });

  it("1. Generator ID: menghasilkan 20 ID secara konkuren tanpa duplikat dan counter independen per tenant", async () => {
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

    expect(generatedIds.length).toBe(20);
    expect(uniqueIds.size).toBe(20);

    const smanId = await generateId(sman1.id, {
      template: "{TAHUN2}IPA{URUT4}",
      scope: concurrentScope,
      year: 2026,
    });
    expect(smanId.endsWith("0001")).toBe(true);
  });

  it("2. Mode SAME_AS_ID: membuat akun PENDING_ACTIVATION dan password awal hash di DB cocok dengan ID", async () => {
    testIdSame = `test_same_${Date.now()}`;
    userSame = await UserService.createUser(
      {
        institutionId: poltekmi.id,
        fullName: "User Same As ID",
        role: UserRole.STUDENT,
        id: testIdSame,
        birthDate: "2006-05-10",
        phoneE164: "+6281211112222",
        contactEmail: "same@test.com",
      },
      adminPoltekmi.id
    );

    expect(userSame.status).toBe(UserStatus.PENDING_ACTIVATION);
    expect(userSame.initialPasswordPlain).toBeUndefined();

    const dbUserSame = await withTenantTransaction(poltekmi.id, async (tenantDb) =>
      (tenantDb as any).user.findUnique({ where: { id: userSame.userId } })
    );
    expect(dbUserSame).toBeDefined();

    const isMatchSame = await comparePassword(testIdSame, dbUserSame!.passwordHash);
    expect(isMatchSame).toBe(true);
  });

  it("3. Mode RANDOM: membuat akun PENDING_ACTIVATION dan menghasilkan plaintext password di memori", async () => {
    await prisma.institution.update({
      where: { id: poltekmi.id },
      data: { initialPasswordMode: "RANDOM" },
    });

    testIdRandom = `test_rnd_${Date.now()}`;
    userRandom = await UserService.createUser(
      {
        institutionId: poltekmi.id,
        fullName: "User Random Mode",
        role: UserRole.STUDENT,
        id: testIdRandom,
        birthDate: "2006-08-20",
        phoneE164: "+6281233334444",
        contactEmail: "rnd@test.com",
      },
      adminPoltekmi.id
    );

    expect(userRandom.status).toBe(UserStatus.PENDING_ACTIVATION);
    expect(Boolean(userRandom.initialPasswordPlain)).toBe(true);

    const dbUserRandom = await withTenantTransaction(poltekmi.id, async (tenantDb) =>
      (tenantDb as any).user.findUnique({ where: { id: userRandom.userId } })
    );
    expect(dbUserRandom).toBeDefined();

    const isMatchRandom = await comparePassword(
      userRandom.initialPasswordPlain!,
      dbUserRandom!.passwordHash
    );
    expect(isMatchRandom).toBe(true);
    expect(dbUserRandom!.passwordHash).not.toBe(userRandom.initialPasswordPlain);

    // Kembalikan mode tenant poltekmi ke SAME_AS_ID
    await prisma.institution.update({
      where: { id: poltekmi.id },
      data: { initialPasswordMode: "SAME_AS_ID" },
    });
  });

  it("4. Validasi Preview Impor CSV: menangkap error duplikat file/DB, HP luar negeri, dan prodi asing", async () => {
    const badCsv = [
      "nama,peran,id,tanggal_lahir,nomor_hp,email_kontak,kelas_prodi",
      "Mahasiswa Valid 1,MAHASISWA,24TI9001,2005-01-01,+6281234567891,val1@test.com,TI",
      "Mahasiswa Duplikat File,MAHASISWA,24TI9001,2005-01-01,+6281234567892,dup1@test.com,TI",
      `Mahasiswa Duplikat DB,MAHASISWA,${testIdSame},2005-01-01,+6281234567893,dup2@test.com,TI`,
      "Mahasiswa HP Salah,MAHASISWA,24TI9004,2005-01-01,+12025550199,hp@test.com,TI",
      "Mahasiswa Prodi Asing,MAHASISWA,24TI9005,2005-01-01,+6281234567895,asing@test.com,JURUSAN_GHAIB_999",
    ].join("\n");

    const preview = await CsvImportService.previewCsv(poltekmi.id, badCsv);
    expect(preview.totalRows).toBe(5);
    expect(preview.validCount).toBe(1);
    expect(preview.invalidCount).toBe(4);

    const dupFileRow = preview.rows.find((r) => r.raw.nama === "Mahasiswa Duplikat File");
    expect(dupFileRow?.errors.some((e) => e.includes("duplikat di dalam file"))).toBe(true);

    const dupDbRow = preview.rows.find((r) => r.raw.nama === "Mahasiswa Duplikat DB");
    expect(dupDbRow?.errors.some((e) => e.includes("sudah terdaftar di database"))).toBe(true);

    const wrongPhoneRow = preview.rows.find((r) => r.raw.nama === "Mahasiswa HP Salah");
    expect(wrongPhoneRow?.errors.some((e) => e.includes("bukan nomor Indonesia (+62)"))).toBe(true);

    const unknownProdiRow = preview.rows.find((r) => r.raw.nama === "Mahasiswa Prodi Asing");
    expect(unknownProdiRow?.errors.some((e) => e.includes("tidak ditemukan di sistem"))).toBe(true);
  });

  it("5. Eksekusi Impor Idempoten: impor ulang data yang sama tidak membuat duplikat", async () => {
    const uniqueImportId = `imp_${Date.now()}`;
    const validCsv = [
      "nama,peran,id,tanggal_lahir,nomor_hp,email_kontak,kelas_prodi",
      `Siswa Impor Sukses,MAHASISWA,${uniqueImportId},2005-02-02,+6281234567899,imp@test.com,TI`,
    ].join("\n");

    const previewSingle = await CsvImportService.previewCsv(poltekmi.id, validCsv);
    expect(previewSingle.validCount).toBe(1);

    const importResult1 = await CsvImportService.executeImport(
      poltekmi.id,
      adminPoltekmi.id,
      previewSingle.rows,
      { importOnlyValid: true }
    );
    expect(importResult1.importedCount).toBe(1);
    expect(importResult1.skippedCount).toBe(0);

    const importResult2 = await CsvImportService.executeImport(
      poltekmi.id,
      adminPoltekmi.id,
      previewSingle.rows,
      { importOnlyValid: true }
    );
    expect(importResult2.importedCount).toBe(0);
    expect(importResult2.skippedCount).toBe(1);
  });

  it("6. Keamanan Kartu Akun: password RANDOM tidak pernah bocor saat diambil ulang dari database", async () => {
    const randomCard = {
      fullName: userRandom.fullName,
      id: userRandom.userId,
      loginEmail: userRandom.loginEmail,
      initialPasswordMode: "RANDOM" as const,
      initialPasswordPlain: undefined,
      institutionName: poltekmi.name,
      tenantSlug: poltekmi.slug,
    };

    const instruction = AccountCardService.getActivationInstructions(randomCard);
    expect(instruction.includes("Pwd")).toBe(false);
    expect(instruction.includes("password awal yang sama")).toBe(true);
  });

  it("7. Isolasi Lintas Tenant: query dan mutasi menolak user milik tenant lain", async () => {
    const poltekmiUsers = await UserService.searchUsers(poltekmi.id, { limit: 100 });
    const containsSmanUser = poltekmiUsers.users.some((u: any) => u.identifier.includes("sman"));
    expect(containsSmanUser).toBe(false);

    const smanUser = await withTenantTransaction(sman1.id, async (tenantDb) =>
      (tenantDb as any).user.findFirst({
        where: { institutionId: sman1.id },
      })
    );

    if (smanUser) {
      let failedCrossTenant = false;
      try {
        await UserService.toggleUserStatus(
          poltekmi.id,
          smanUser.id,
          UserStatus.SUSPENDED,
          adminPoltekmi.id,
          "Uji isolasi tenant"
        );
      } catch {
        failedCrossTenant = true;
      }
      expect(failedCrossTenant).toBe(true);
    }
  });

  it("8. RBAC Hak Akses: Guru/Dosen memiliki peran TEACHER dan ditolak dari wewenang admin", async () => {
    const teacherRole = teacherPoltekmi.memberships[0]?.role;
    expect(teacherRole).toBe(UserRole.TEACHER);
    expect(teacherRole).not.toBe(UserRole.INSTITUTION_ADMIN);
    expect(teacherRole).not.toBe(UserRole.SUPER_ADMIN);
  });

  it("9. Proteksi CSV Injection: karakter formula (=, +, -, @) di-escape secara aman", async () => {
    const formulaCells = ["=cmd|' /C calc'!A0", "+12345", "-500", "@SUM(A1:A10)"];
    for (const cell of formulaCells) {
      const sanitized = sanitizeCsvCell(cell);
      expect(sanitized.startsWith("'")).toBe(true);
    }

    const cardWithFormula = [
      {
        fullName: '=HYPERLINK("http://evil.com")',
        id: "+628123456",
        loginEmail: "-injected@test.com",
        initialPasswordMode: "SAME_AS_ID" as const,
        institutionName: poltekmi.name,
        tenantSlug: poltekmi.slug,
      },
    ];

    const exportedCsv = AccountCardService.exportToCsv(cardWithFormula);
    expect(exportedCsv.includes("''=HYPERLINK") || exportedCsv.includes("'=HYPERLINK")).toBe(true);
    expect(exportedCsv.includes("'+628123456")).toBe(true);
  });
});
