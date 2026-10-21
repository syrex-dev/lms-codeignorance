import { prisma } from "@/lib/db/prisma";
import {
  ApplicantStatus,
  IdentifierType,
  MembershipStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";

interface ConvertApplicantParams {
  applicantId: string;
  classCourseId?: string;
  convertedByUserId?: string;
  institutionId?: string;
  dbClient?: any;
}

export interface ConvertApplicantResult {
  success: boolean;
  isAlreadyConverted: boolean;
  studentIdNumber: string;
  institutionEmail: string;
  studentProfileId: string;
}

/**
 * Pipeline konversi pendaftar menjadi Siswa / Mahasiswa dalam SATU transaksi database.
 * Sifat: IDEMPOTEN (menjamin eksekusi ulang tidak menduplikasi NIM, profil, atau akun).
 */
export async function convertApplicantToStudent({
  applicantId,
  classCourseId,
  convertedByUserId,
  institutionId,
  dbClient = prisma,
}: ConvertApplicantParams): Promise<ConvertApplicantResult> {
  const client = dbClient || prisma;

  const applicant = await client.applicant.findUnique({
    where: { id: applicantId },
    include: {
      institution: true,
      user: {
        include: {
          identifiers: true,
          memberships: true,
          studentProfiles: true,
        },
      },
      choices: {
        orderBy: { priorityOrder: "asc" },
        take: 1,
      },
    },
  });

  if (!applicant) {
    throw new Error(`Pendaftar dengan ID ${applicantId} tidak ditemukan.`);
  }

  const institution = applicant.institution;
  const user = applicant.user;
  const targetProdiId = applicant.choices[0]?.programDepartmentId || null;

  // 1. CEK IDEMPOTENSI: Jika pendaftar sudah berstatus CONVERTED
  if (applicant.status === ApplicantStatus.CONVERTED) {
    const existingProfile = await client.studentProfile.findFirst({
      where: {
        institutionId: institution.id,
        originApplicationId: applicant.id,
      },
    });

    const existingId = user.identifiers.find(
      (id: any) =>
        id.institutionId === institution.id &&
        id.type === IdentifierType.INSTITUTION_ID
    );

    const existingEmail = user.identifiers.find(
      (id: any) =>
        id.institutionId === institution.id &&
        id.type === IdentifierType.INSTITUTION_EMAIL
    );

    if (existingProfile && existingId && existingEmail) {
      return {
        success: true,
        isAlreadyConverted: true,
        studentIdNumber: existingId.value,
        institutionEmail: existingEmail.value,
        studentProfileId: existingProfile.id,
      };
    }
  }

  // 2. Jalankan konversi dalam satu transaksi database atomik dengan penegakan RLS
  const result = await prisma.$transaction(async (tx) => {
    // Set PostgreSQL session variable untuk penegakan RLS
    const safeTenantId = institution.id.replace(/'/g, "''");
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant = '${safeTenantId}';`);

    // A. Generate ID/NIM/NIS sesuai template institusi
    const currentStudentCount = await tx.studentProfile.count({
      where: { institutionId: institution.id },
    });

    const nextSeq = (currentStudentCount + 1).toString().padStart(4, "0");
    const year2 = new Date().getFullYear().toString().slice(-2);

    let prodiCode = "GEN";
    if (targetProdiId) {
      const prodi = await tx.programDepartment.findUnique({
        where: { id: targetProdiId },
      });
      if (prodi) prodiCode = prodi.code;
    }

    const generatedId = `${year2}${prodiCode}${nextSeq}`;
    const generatedEmail = `${generatedId}@${institution.emailDomain}`.toLowerCase();

    // B. Tambahkan UserIdentifier: INSTITUTION_ID dan INSTITUTION_EMAIL
    await tx.userIdentifier.upsert({
      where: {
        institutionId_type_value: {
          institutionId: institution.id,
          type: IdentifierType.INSTITUTION_ID,
          value: generatedId,
        },
      },
      update: {
        isLoginEnabled: true,
        deactivatedAt: null,
      },
      create: {
        userId: user.id,
        institutionId: institution.id,
        type: IdentifierType.INSTITUTION_ID,
        value: generatedId,
        isLoginEnabled: true,
        isPrimary: true,
        verifiedAt: new Date(),
      },
    });

    await tx.userIdentifier.upsert({
      where: {
        institutionId_type_value: {
          institutionId: institution.id,
          type: IdentifierType.INSTITUTION_EMAIL,
          value: generatedEmail,
        },
      },
      update: {
        isLoginEnabled: true,
        deactivatedAt: null,
      },
      create: {
        userId: user.id,
        institutionId: institution.id,
        type: IdentifierType.INSTITUTION_EMAIL,
        value: generatedEmail,
        isLoginEnabled: true,
        isPrimary: false,
        verifiedAt: new Date(),
      },
    });

    // C. Buat StudentProfile baru dari Applicant
    const studentProfile = await tx.studentProfile.create({
      data: {
        userId: user.id,
        institutionId: institution.id,
        studentIdNumber: generatedId,
        programDepartmentId: targetProdiId,
        originApplicationId: applicant.id,
        cohortYear: new Date().getFullYear(),
      },
    });

    // D. Update Membership: Jadikan Membership APPLICANT INACTIVE, Tambahkan Membership STUDENT ACTIVE
    await tx.membership.updateMany({
      where: {
        userId: user.id,
        institutionId: institution.id,
        role: UserRole.APPLICANT,
      },
      data: {
        status: MembershipStatus.INACTIVE,
      },
    });

    await tx.membership.upsert({
      where: {
        userId_institutionId_role: {
          userId: user.id,
          institutionId: institution.id,
          role: UserRole.STUDENT,
        },
      },
      update: {
        status: MembershipStatus.ACTIVE,
      },
      create: {
        userId: user.id,
        institutionId: institution.id,
        role: UserRole.STUDENT,
        status: MembershipStatus.ACTIVE,
      },
    });

    // E. Pastikan status User tetap ACTIVE dan tidak dipaksa ganti password
    await tx.user.update({
      where: { id: user.id },
      data: {
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
      },
    });

    // F. Update status Applicant menjadi CONVERTED
    await tx.applicant.update({
      where: { id: applicant.id },
      data: {
        status: ApplicantStatus.CONVERTED,
      },
    });

    // G. Enrollment kelas otomatis jika classCourseId disediakan
    if (classCourseId) {
      await tx.classEnrollment.upsert({
        where: {
          classCourseId_studentUserId: {
            classCourseId,
            studentUserId: user.id,
          },
        },
        update: {
          status: "ACTIVE",
        },
        create: {
          classCourseId,
          studentUserId: user.id,
          status: "ACTIVE",
        },
      });
    }

    // H. Catat ke AuditLog
    await tx.auditLog.create({
      data: {
        institutionId: institution.id,
        userId: convertedByUserId || user.id,
        action: "APPLICANT_CONVERTED_TO_STUDENT",
        entityType: "Applicant",
        entityId: applicant.id,
        newValue: {
          generatedId,
          generatedEmail,
          studentProfileId: studentProfile.id,
        },
      },
    });

    return {
      success: true,
      isAlreadyConverted: false,
      studentIdNumber: generatedId,
      institutionEmail: generatedEmail,
      studentProfileId: studentProfile.id,
    };
  });

  return result;
}
