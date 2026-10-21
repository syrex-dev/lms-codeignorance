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
}: ConvertApplicantParams): Promise<ConvertApplicantResult> {
  const applicant = await prisma.applicant.findUnique({
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
    const existingProfile = await prisma.studentProfile.findFirst({
      where: {
        institutionId: institution.id,
        originApplicationId: applicant.id,
      },
    });

    const existingId = user.identifiers.find(
      (id) =>
        id.institutionId === institution.id &&
        id.type === IdentifierType.INSTITUTION_ID
    );

    const existingEmail = user.identifiers.find(
      (id) =>
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

  // 2. Jalankan konversi dalam satu transaksi database atomik
  const result = await prisma.$transaction(async (tx) => {
    // A. Generate ID/NIM/NIS sesuai template institusi
    // Hitung sequence yang sudah ada di institusi
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

    // Terapkan template (contoh: {YEAR2}{PRODI_CODE}{SEQ4})
    const generatedId = `${year2}${prodiCode}${nextSeq}`;
    const generatedEmail = `${generatedId}@${institution.emailDomain}`.toLowerCase();

    // B. Tambahkan UserIdentifier: INSTITUTION_ID dan INSTITUTION_EMAIL
    // Menggunakan upsert untuk memastikan idempoten
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

    // C. Buat atau perbarui StudentProfile
    const studentProfile = await tx.studentProfile.upsert({
      where: {
        institutionId_studentIdNumber: {
          institutionId: institution.id,
          studentIdNumber: generatedId,
        },
      },
      update: {
        programDepartmentId: targetProdiId,
        originApplicationId: applicant.id,
      },
      create: {
        userId: user.id,
        institutionId: institution.id,
        studentIdNumber: generatedId,
        programDepartmentId: targetProdiId,
        cohortYear: new Date().getFullYear(),
        originApplicationId: applicant.id,
        academicStatus: "ACTIVE",
      },
    });

    // D. Kelola Membership:
    // Ubah status Membership APPLICANT menjadi INACTIVE
    await tx.membership.updateMany({
      where: {
        userId: user.id,
        institutionId: institution.id,
        role: UserRole.APPLICANT,
      },
      data: {
        status: MembershipStatus.INACTIVE,
        endedAt: new Date(),
      },
    });

    // Buat atau aktifkan Membership STUDENT
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
        startedAt: new Date(),
      },
    });

    // E. Penempatan Kelas & Jadwal Otomatis (jika classCourseId ditentukan)
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

    // F. Perbarui status Applicant menjadi CONVERTED dan pastikan akun User ACTIVE tanpa mustChangePassword
    await tx.applicant.update({
      where: { id: applicant.id },
      data: {
        status: ApplicantStatus.CONVERTED,
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: {
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
      },
    });

    // G. Catat Riwayat ke AuditLog
    await tx.auditLog.create({
      data: {
        institutionId: institution.id,
        userId: convertedByUserId || user.id,
        action: "APPLICANT_CONVERTED_TO_STUDENT",
        entityType: "Applicant",
        entityId: applicant.id,
        newValue: {
          studentIdNumber: generatedId,
          institutionEmail: generatedEmail,
          studentProfileId: studentProfile.id,
          convertedAt: new Date(),
        },
      },
    });

    // H. Kirim Notifikasi in-app
    await tx.notification.create({
      data: {
        institutionId: institution.id,
        userId: user.id,
        title: "Selamat! Akun Mahasiswa/Siswa Telah Aktif",
        message: `Pendaftaran Anda telah resmi dikonversi. ID Institusi Anda: ${generatedId}, Email: ${generatedEmail}. Anda tetap dapat masuk menggunakan email dan password pendaftaran Anda.`,
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
