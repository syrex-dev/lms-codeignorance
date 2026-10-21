import { prisma } from "@/lib/db/prisma";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";
import { normalizePhoneE164, isValidIndonesianPhone } from "@/lib/security/phone";
import { checkLimit } from "@/modules/saas/entitlement";
import { UserService, CreateUserInput } from "./user-service";
import { sanitizeCsvCell, AccountCardData } from "./account-cards";
import { UserRole } from "@prisma/client";

export interface CsvRowInput {
  nama: string;
  peran: string;
  id?: string;
  tanggal_lahir?: string;
  nomor_hp?: string;
  email_kontak?: string;
  kelas_prodi?: string;
}

export interface ValidatedRow {
  rowIndex: number;
  raw: CsvRowInput;
  isValid: boolean;
  errors: string[];
  normalized?: {
    fullName: string;
    role: UserRole;
    id?: string;
    birthDate?: string;
    phoneE164?: string;
    contactEmail?: string;
    programDepartmentId?: string;
    classCourseId?: string;
    classOrProdiName?: string;
  };
}

export interface CsvPreviewResult {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  rows: ValidatedRow[];
  errorReportCsv?: string;
}

export interface CsvImportResult {
  success: boolean;
  totalProcessed: number;
  importedCount: number;
  skippedCount: number;
  cards: AccountCardData[];
}

/**
 * Standard role mapping supporting English & Indonesian keywords
 */
export function mapRole(rawRole: string): UserRole | null {
  const normalized = (rawRole || "").trim().toUpperCase();
  switch (normalized) {
    case "STUDENT":
    case "SISWA":
    case "MAHASISWA":
    case "MURID":
      return UserRole.STUDENT;
    case "TEACHER":
    case "GURU":
    case "DOSEN":
    case "PENGAJAR":
      return UserRole.TEACHER;
    case "INSTITUTION_ADMIN":
    case "ADMIN":
    case "ADMIN_INSTITUSI":
      return UserRole.INSTITUTION_ADMIN;
    case "FINANCIAL_STAFF":
    case "STAF_KEUANGAN":
    case "KEUANGAN":
      return UserRole.FINANCIAL_STAFF;
    default:
      return null;
  }
}

/**
 * Parse CSV text into array of object rows
 */
export function parseCsvText(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  // Parse header
  const headers = lines[0]
    .split(",")
    .map((h) => h.replace(/^["']|["']$/g, "").trim().toLowerCase());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    // Regex to handle quoted CSV fields
    const line = lines[i];
    const values: string[] = [];
    let insideQuote = false;
    let currentValue = "";

    for (let charIndex = 0; charIndex < line.length; charIndex++) {
      const char = line[charIndex];
      if (char === '"') {
        if (insideQuote && line[charIndex + 1] === '"') {
          currentValue += '"';
          charIndex++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === "," && !insideQuote) {
        values.push(currentValue.trim());
        currentValue = "";
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());

    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] !== undefined ? values[idx] : "";
    });
    rows.push(rowObj);
  }

  return rows;
}

export class CsvImportService {
  /**
   * Template CSV download
   */
  static generateTemplateCsv(institutionType: "SCHOOL" | "UNIVERSITY" = "UNIVERSITY"): string {
    const headers = [
      "nama",
      "peran",
      "id",
      "tanggal_lahir",
      "nomor_hp",
      "email_kontak",
      "kelas_prodi",
    ];

    const sampleRows =
      institutionType === "SCHOOL"
        ? [
            [
              "Ahmad Rizki",
              "SISWA",
              "2401001",
              "2008-05-15",
              "+6281234567890",
              "ahmad.rizki@gmail.com",
              "KLS-X-MIPA-1",
            ],
            [
              "Budi Santoso",
              "GURU",
              "19850101",
              "1985-01-01",
              "+6281298765432",
              "budi.santoso@gmail.com",
              "MIPA",
            ],
          ]
        : [
            [
              "Dewi Lestari",
              "MAHASISWA",
              "2401010001",
              "2005-08-20",
              "+6281234567890",
              "dewi.lestari@gmail.com",
              "TI",
            ],
            [
              "Dr. Hendra Wijaya",
              "DOSEN",
              "19780512",
              "1978-05-12",
              "+6281345678901",
              "hendra.wijaya@gmail.com",
              "TI",
            ],
          ];

    const lines = [
      headers.join(","),
      ...sampleRows.map((r) =>
        r.map((cell) => `"${sanitizeCsvCell(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ];

    return lines.join("\n");
  }

  /**
   * Tahap Preview: Validasi per baris sebelum impor
   */
  static async previewCsv(
    institutionId: string,
    csvContent: string,
    client: any = prisma
  ): Promise<CsvPreviewResult> {
    const parsedRows = parseCsvText(csvContent);
    if (parsedRows.length === 0) {
      return {
        totalRows: 0,
        validCount: 0,
        invalidCount: 0,
        rows: [],
      };
    }

    if (parsedRows.length > 1000) {
      throw new Error("Maksimal 1.000 baris per file CSV untuk menjaga performa.");
    }

    return withTenantTransaction(institutionId, async (tenantDb) => {
      // Ambil data referensi ProgramDepartment dan ClassCourse di institusi ini
      const [departments, classes, existingIdentifiers] = await Promise.all([
        (tenantDb as any).programDepartment.findMany({
          where: { institutionId, deletedAt: null },
          select: { id: true, code: true, name: true },
        }),
        (tenantDb as any).classCourse.findMany({
          where: { institutionId, deletedAt: null },
          select: { id: true, code: true, name: true, programDepartmentId: true },
        }),
        (tenantDb as any).userIdentifier.findMany({
          where: { institutionId },
          select: { value: true },
        }),
      ]);

      const existingIdSet = new Set<string>(
      existingIdentifiers.map((i: { value: string }) => i.value.toLowerCase())
    );
    const seenIdsInFile = new Set<string>();

    const validatedRows: ValidatedRow[] = [];

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      const errors: string[] = [];

      const rawInput: CsvRowInput = {
        nama: row["nama"] || "",
        peran: row["peran"] || "",
        id: row["id"] || undefined,
        tanggal_lahir: row["tanggal_lahir"] || undefined,
        nomor_hp: row["nomor_hp"] || undefined,
        email_kontak: row["email_kontak"] || undefined,
        kelas_prodi: row["kelas_prodi"] || undefined,
      };

      // 1. Validasi Nama
      if (!rawInput.nama || rawInput.nama.trim().length < 2) {
        errors.push("Nama lengkap wajib diisi (minimal 2 karakter).");
      }

      // 2. Validasi Peran
      const role = mapRole(rawInput.peran);
      if (!role) {
        errors.push(
          `Peran "${rawInput.peran}" tidak valid. Gunakan: SISWA/MAHASISWA, GURU/DOSEN, ADMIN, atau KEUANGAN.`
        );
      }

      // 3. Validasi ID (jika ada)
      let cleanId = rawInput.id ? rawInput.id.trim().toLowerCase() : undefined;
      if (cleanId) {
        if (seenIdsInFile.has(cleanId)) {
          errors.push(`ID "${cleanId}" duplikat di dalam file CSV ini.`);
        } else {
          seenIdsInFile.add(cleanId);
        }

        if (existingIdSet.has(cleanId)) {
          errors.push(`ID "${cleanId}" sudah terdaftar di database institusi.`);
        }
      }

      // 4. Validasi Tanggal Lahir (YYYY-MM-DD)
      let birthDate: string | undefined = undefined;
      if (rawInput.tanggal_lahir) {
        const d = new Date(rawInput.tanggal_lahir);
        if (isNaN(d.getTime())) {
          errors.push(`Format tanggal lahir "${rawInput.tanggal_lahir}" tidak valid (gunakan YYYY-MM-DD).`);
        } else {
          birthDate = rawInput.tanggal_lahir;
        }
      }

      // 5. Validasi Nomor HP
      let phoneE164: string | undefined = undefined;
      if (rawInput.nomor_hp) {
        try {
          phoneE164 = normalizePhoneE164(rawInput.nomor_hp);
          if (!isValidIndonesianPhone(phoneE164)) {
            errors.push(`Nomor HP "${rawInput.nomor_hp}" tidak valid atau bukan nomor Indonesia (+62).`);
          }
        } catch {
          errors.push(`Nomor HP "${rawInput.nomor_hp}" tidak valid.`);
        }
      }

      // 6. Validasi Email Kontak
      let contactEmail: string | undefined = undefined;
      if (rawInput.email_kontak) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(rawInput.email_kontak)) {
          errors.push(`Email kontak "${rawInput.email_kontak}" tidak valid.`);
        } else {
          contactEmail = rawInput.email_kontak.toLowerCase();
        }
      }

      // 7. Validasi Kelas / Prodi (jika diisi)
      let programDepartmentId: string | undefined = undefined;
      let classCourseId: string | undefined = undefined;
      let classOrProdiName: string | undefined = undefined;

      if (rawInput.kelas_prodi) {
        const query = rawInput.kelas_prodi.trim().toLowerCase();
        // Cek apakah match code/name prodi
        const matchedDept = departments.find(
          (d: any) => d.code.toLowerCase() === query || d.name.toLowerCase() === query
        );
        // Cek apakah match code/name kelas
        const matchedClass = classes.find(
          (c: any) => c.code.toLowerCase() === query || c.name.toLowerCase() === query
        );

        if (matchedDept) {
          programDepartmentId = matchedDept.id;
          classOrProdiName = matchedDept.name;
        } else if (matchedClass) {
          classCourseId = matchedClass.id;
          programDepartmentId = matchedClass.programDepartmentId || undefined;
          classOrProdiName = matchedClass.name;
        } else {
          errors.push(`Kelas/Program Studi "${rawInput.kelas_prodi}" tidak ditemukan di sistem.`);
        }
      }

      const isValid = errors.length === 0;

      validatedRows.push({
        rowIndex: i + 1,
        raw: rawInput,
        isValid,
        errors,
        normalized: isValid
          ? {
              fullName: rawInput.nama.trim(),
              role: role!,
              id: cleanId,
              birthDate,
              phoneE164,
              contactEmail,
              programDepartmentId,
              classCourseId,
              classOrProdiName,
            }
          : undefined,
      });
    }

    const validCount = validatedRows.filter((r) => r.isValid).length;
    const invalidCount = validatedRows.length - validCount;

    // Buat laporan error CSV jika ada baris error
    let errorReportCsv: string | undefined = undefined;
    if (invalidCount > 0) {
      const errHeaders = [
        "baris",
        "nama",
        "peran",
        "id",
        "tanggal_lahir",
        "nomor_hp",
        "email_kontak",
        "kelas_prodi",
        "alasan_error",
      ];
      const errRows = validatedRows
        .filter((r) => !r.isValid)
        .map((r) => [
          r.rowIndex.toString(),
          sanitizeCsvCell(r.raw.nama),
          sanitizeCsvCell(r.raw.peran),
          sanitizeCsvCell(r.raw.id || ""),
          sanitizeCsvCell(r.raw.tanggal_lahir || ""),
          sanitizeCsvCell(r.raw.nomor_hp || ""),
          sanitizeCsvCell(r.raw.email_kontak || ""),
          sanitizeCsvCell(r.raw.kelas_prodi || ""),
          sanitizeCsvCell(r.errors.join("; ")),
        ]);

      errorReportCsv = [
        errHeaders.join(","),
        ...errRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")),
      ].join("\n");
    }

    return {
      totalRows: validatedRows.length,
      validCount,
      invalidCount,
      rows: validatedRows,
      errorReportCsv,
    };
    });
  }

  /**
   * Eksekusi Impor Batch dalam transaksi dengan Idempotensi & Entitlement Kuota
   */
  static async executeImport(
    institutionId: string,
    operatorUserId: string,
    validatedRows: ValidatedRow[],
    options: { importOnlyValid?: boolean } = {}
  ): Promise<CsvImportResult> {
    const rowsToProcess = options.importOnlyValid
      ? validatedRows.filter((r) => r.isValid)
      : validatedRows;

    if (rowsToProcess.length === 0) {
      return {
        success: true,
        totalProcessed: 0,
        importedCount: 0,
        skippedCount: 0,
        cards: [],
      };
    }

    // Jika ada baris tidak valid dan importOnlyValid false, tolak
    const hasInvalid = rowsToProcess.some((r) => !r.isValid);
    if (hasInvalid && !options.importOnlyValid) {
      throw new Error(
        "Terdapat data tidak valid dalam file. Pilih opsi 'Impor hanya baris valid' atau perbaiki file CSV Anda."
      );
    }

    // 1. Cek Kuota maxActiveUsers
    const limitCheck = await checkLimit(institutionId, "maxActiveUsers");
    if (!limitCheck.allowed) {
      throw new Error(
        limitCheck.message || "Batas kuota pengguna aktif institusi telah tercapai."
      );
    }

    // Cek apakah jumlah yang akan diimpor melebihi sisa kuota
    if (limitCheck.maxAllowed && limitCheck.current !== undefined) {
      const remainingQuota = limitCheck.maxAllowed - limitCheck.current;
      if (rowsToProcess.length > remainingQuota) {
        throw new Error(
          `Jumlah akun yang akan diimpor (${rowsToProcess.length}) melampaui sisa kuota institusi (${remainingQuota} akun).`
        );
      }
    }

    // Ambil detail institusi
    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      select: {
        name: true,
        slug: true,
        initialPasswordMode: true,
      },
    });

    if (!institution) throw new Error("Institusi tidak ditemukan.");

    const cards: AccountCardData[] = [];
    let importedCount = 0;
    let skippedCount = 0;

    // Eksekusi per batch 50 baris
    const BATCH_SIZE = 50;
    for (let i = 0; i < rowsToProcess.length; i += BATCH_SIZE) {
      const batch = rowsToProcess.slice(i, i + BATCH_SIZE);

      await withTenantTransaction(institutionId, async (tenantDb) => {
        for (const item of batch) {
          if (!item.normalized) continue;
          const {
            fullName,
            role,
            id: customId,
            birthDate,
            phoneE164,
            contactEmail,
            programDepartmentId,
            classCourseId,
            classOrProdiName,
          } = item.normalized;

          // Cek Idempotensi: jika user dengan ID atau phone sudah ada, lewati
          if (customId) {
            const existing = await (tenantDb as any).userIdentifier.findFirst({
              where: {
                institutionId,
                value: customId.toLowerCase(),
              },
            });
            if (existing) {
              skippedCount++;
              continue;
            }
          }

          // Buat akun baru via UserService
          const createInput: CreateUserInput = {
            institutionId,
            fullName,
            role,
            id: customId,
            birthDate,
            phoneE164,
            contactEmail,
            programDepartmentId,
            classCourseId,
          };

          const userResult = await UserService.createUser(createInput, operatorUserId);

          // Jika ada classCourseId dan peran STUDENT, enroll otomatis
          if (classCourseId && role === UserRole.STUDENT) {
            await (tenantDb as any).classEnrollment.upsert({
              where: {
                classCourseId_studentUserId: {
                  classCourseId,
                  studentUserId: userResult.userId,
                },
              },
              update: {},
              create: {
                classCourseId,
                studentUserId: userResult.userId,
                status: "ACTIVE",
              },
            });
          }

          importedCount++;

          cards.push({
            fullName: userResult.fullName,
            id: userResult.id,
            loginEmail: userResult.loginEmail,
            initialPasswordMode: institution.initialPasswordMode as "SAME_AS_ID" | "RANDOM",
            initialPasswordPlain: userResult.initialPasswordPlain,
            classNameOrProdi: classOrProdiName,
            institutionName: institution.name,
            tenantSlug: institution.slug,
          });
        }
      });
    }

    return {
      success: true,
      totalProcessed: rowsToProcess.length,
      importedCount,
      skippedCount,
      cards,
    };
  }
}
