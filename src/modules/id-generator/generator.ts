import { prisma } from "@/lib/db/prisma";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";
import { IdentifierType } from "@prisma/client";

export interface IdTokenContext {
  year?: number;
  facultyCode?: string;
  prodiCode?: string;
  classCode?: string;
  sequence?: number;
}

/**
 * Preview template ID format dengan data simulasi
 */
export function previewIdFormat(template: string, sample: IdTokenContext = {}): string {
  const year = sample.year || new Date().getFullYear();
  const year4 = year.toString();
  const year2 = year4.slice(-2);
  const facultyCode = (sample.facultyCode || "FT").toUpperCase();
  const prodiCode = (sample.prodiCode || "TI").toUpperCase();
  const classCode = (sample.classCode || "X1").toUpperCase();
  const seq = sample.sequence || 1;

  let result = template
    .replace(/\{TAHUN4\}|\{YEAR4\}/g, year4)
    .replace(/\{TAHUN2\}|\{YEAR2\}/g, year2)
    .replace(/\{KODE_FAKULTAS\}|\{FACULTY_CODE\}/g, facultyCode)
    .replace(/\{KODE_PRODI\}|\{PRODI_CODE\}/g, prodiCode)
    .replace(/\{KODE_KELAS\}|\{CLASS_CODE\}/g, classCode)
    .replace(/\{URUT3\}|\{SEQ3\}/g, seq.toString().padStart(3, "0"))
    .replace(/\{URUT4\}|\{SEQ4\}/g, seq.toString().padStart(4, "0"))
    .replace(/\{URUT5\}|\{SEQ5\}/g, seq.toString().padStart(5, "0"));

  return result;
}

/**
 * Dapatkan nomor urut atomik berikutnya menggunakan IdCounter dalam transaksi
 */
export async function getNextAtomicSequence(
  institutionId: string,
  scope: string,
  year: number,
  client: any = prisma
): Promise<number> {
  const counter = await client.idCounter.upsert({
    where: {
      institutionId_scope_year: {
        institutionId,
        scope,
        year,
      },
    },
    update: {
      lastSequence: { increment: 1 },
    },
    create: {
      institutionId,
      scope,
      year,
      lastSequence: 1,
    },
    select: {
      lastSequence: true,
    },
  });

  return counter.lastSequence;
}

/**
 * Generate ID unik per institusi berdasarkan template dan nomor urut atomik
 */
export async function generateId(
  institutionId: string,
  options: {
    template?: string;
    scope?: string;
    year?: number;
    facultyCode?: string;
    prodiCode?: string;
    classCode?: string;
  } = {},
  client?: any
): Promise<string> {
  const year = options.year || new Date().getFullYear();
  const scope = options.scope || "DEFAULT";

  const runWithDb = async (db: any) => {
    let template = options.template;
    if (!template) {
      const institution = await prisma.institution.findUnique({
        where: { id: institutionId },
        select: { idFormatTemplate: true },
      });
      template = institution?.idFormatTemplate || "{YEAR2}{PRODI_CODE}{SEQ4}";
    }

    const seq = await getNextAtomicSequence(institutionId, scope, year, db);

    return previewIdFormat(template, {
      year,
      facultyCode: options.facultyCode,
      prodiCode: options.prodiCode,
      classCode: options.classCode,
      sequence: seq,
    });
  };

  if (client && client !== prisma) {
    return runWithDb(client);
  } else {
    return withTenantTransaction(institutionId, runWithDb);
  }
}

/**
 * Ubah ID pengguna secara aman (memperbarui INSTITUTION_EMAIL dan alias login dengan audit log)
 */
export async function updateUserId(
  institutionId: string,
  userId: string,
  newId: string,
  operatorUserId: string,
  reason: string
): Promise<{ newId: string; newEmail: string }> {
  if (!reason || reason.trim().length < 5) {
    throw new Error("Alasan tertulis wajib diisi saat mengubah ID pengguna.");
  }

  const cleanNewId = newId.trim().toLowerCase();

  return withTenantTransaction(institutionId, async (tenantDb) => {
    // 1. Cek apakah newId sudah dipakai di institusi ini
    const existing = await (tenantDb as any).userIdentifier.findFirst({
      where: {
        institutionId,
        value: cleanNewId,
      },
    });

    if (existing && existing.userId !== userId) {
      throw new Error(`ID "${newId}" sudah digunakan oleh pengguna lain di institusi ini.`);
    }

    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      select: { emailDomain: true },
    });
    const emailDomain = institution?.emailDomain || "lms.local";
    const newEmail = `${cleanNewId}@${emailDomain}`.toLowerCase();

    // 2. Ambil data ID lama untuk audit log
    const oldIdent = await (tenantDb as any).userIdentifier.findFirst({
      where: {
        userId,
        type: IdentifierType.INSTITUTION_ID,
      },
    });

    // 3. Update UserIdentifier INSTITUTION_ID
    if (oldIdent) {
      await (tenantDb as any).userIdentifier.update({
        where: { id: oldIdent.id },
        data: { value: cleanNewId },
      });
    } else {
      await (tenantDb as any).userIdentifier.create({
        data: {
          userId,
          institutionId,
          type: IdentifierType.INSTITUTION_ID,
          value: cleanNewId,
          isLoginEnabled: true,
          isPrimary: true,
        },
      });
    }

    // 4. Update atau create UserIdentifier INSTITUTION_EMAIL ({ID}@{domain})
    const oldEmailIdent = await (tenantDb as any).userIdentifier.findFirst({
      where: {
        userId,
        type: IdentifierType.INSTITUTION_EMAIL,
      },
    });

    if (oldEmailIdent) {
      await (tenantDb as any).userIdentifier.update({
        where: { id: oldEmailIdent.id },
        data: { value: newEmail },
      });
    } else {
      await (tenantDb as any).userIdentifier.create({
        data: {
          userId,
          institutionId,
          type: IdentifierType.INSTITUTION_EMAIL,
          value: newEmail,
          isLoginEnabled: true,
        },
      });
    }

    // 5. Update di profil siswa/staf jika ada
    await (tenantDb as any).studentProfile.updateMany({
      where: { userId },
      data: { studentIdNumber: cleanNewId },
    });

    await (tenantDb as any).staffProfile.updateMany({
      where: { userId },
      data: { employeeNumber: cleanNewId },
    });

    // 6. Catat ke AuditLog
    await (tenantDb as any).auditLog.create({
      data: {
        institutionId,
        userId: operatorUserId,
        action: "USER_ID_UPDATED",
        entityType: "UserIdentifier",
        entityId: userId,
        oldValue: { id: oldIdent?.value },
        newValue: {
          newId: cleanNewId,
          newEmail,
          reason,
        },
      },
    });

    return { newId: cleanNewId, newEmail };
  });
}
