import {
  PrismaClient,
  UserRole,
  UserStatus,
  TenantStatus,
  InstitutionType,
  IdentifierType,
  MembershipStatus,
  AcademicTermType,
  RoomType,
  DayOfWeek,
  FeeComponentType,
  InvoiceStatus,
  ScholarshipCoverageType,
  SponsorInvoiceStatus,
  ApplicantStatus,
  InitialPasswordMode,
  PhoneBindingPolicy,
  PhoneOwner,
  OtpChannel,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function main() {
  // Guard keamanan: dilarang menjalankan seed pada lingkungan produksi
  if (process.env.NODE_ENV === "production") {
    throw new Error("❌ Dilarang menjalankan seeding database pada environment production!");
  }

  console.log("🌱 Memulai seeding database demo SaaS LMS (Fase 1C & 1D)...");

  // 1. Bersihkan seluruh tabel database
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Institution" CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Plan" CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "PlatformUser" CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "DevOutbox" CASCADE;`);

  const hash = async (pwd: string) => bcrypt.hash(pwd, 10);

  // ========================================================
  // 2. PAKET SAAS (PLANS & FEATURES)
  // ========================================================
  const planStarter = await prisma.plan.create({
    data: {
      code: "STARTER",
      name: "Paket Starter",
      description: "Untuk sekolah & kampus perintis (hingga 100 pengguna aktif).",
      priceMonthly: 0,
      priceYearly: 0,
      maxActiveUsers: 100,
      maxStorageMb: 1024,
      maxApplicantsPerYear: 500,
      maxAdmins: 5,
      maxOtpPerMonth: 1000,
      features: {
        create: [
          { featureKey: "classroom", isEnabled: true },
          { featureKey: "assignment", isEnabled: true },
          { featureKey: "quiz", isEnabled: true },
          { featureKey: "attendance", isEnabled: true },
          { featureKey: "schedule", isEnabled: true },
          { featureKey: "admission", isEnabled: true },
          { featureKey: "whatsapp_otp", isEnabled: true },
          { featureKey: "sms_otp", isEnabled: true },
        ],
      },
    },
  });

  const planPro = await prisma.plan.create({
    data: {
      code: "PRO",
      name: "Paket Pro",
      description: "Fitur lengkap untuk institusi berkembang (hingga 500 pengguna aktif).",
      priceMonthly: 750000,
      priceYearly: 7500000,
      maxActiveUsers: 500,
      maxStorageMb: 5120,
      maxApplicantsPerYear: 2000,
      maxAdmins: 15,
      maxOtpPerMonth: 5000,
      features: {
        create: [
          { featureKey: "classroom", isEnabled: true },
          { featureKey: "assignment", isEnabled: true },
          { featureKey: "quiz", isEnabled: true },
          { featureKey: "attendance", isEnabled: true },
          { featureKey: "gradebook", isEnabled: true },
          { featureKey: "schedule", isEnabled: true },
          { featureKey: "communication", isEnabled: true },
          { featureKey: "admission", isEnabled: true },
          { featureKey: "finance", isEnabled: true },
          { featureKey: "scholarship", isEnabled: true },
          { featureKey: "parent_portal", isEnabled: true },
          { featureKey: "custom_branding", isEnabled: true },
          { featureKey: "whatsapp_otp", isEnabled: true },
          { featureKey: "sms_otp", isEnabled: true },
        ],
      },
    },
  });

  console.log("✅ Paket SaaS berhasil dibuat (Starter, Pro)");

  // ========================================================
  // 3. PLATFORM USER (Pemilik Platform Terpisah)
  // ========================================================
  const platformAdminPass = await hash(process.env.PLATFORM_ADMIN_PASSWORD || "PlatformAdminPass123!");
  const platformUser = await prisma.platformUser.create({
    data: {
      email: "superadmin@platform.system",
      fullName: "Platform Super Administrator",
      passwordHash: platformAdminPass,
      phoneE164: "+6281234567890",
      role: "SUPER_ADMIN",
      status: UserStatus.ACTIVE,
    },
  });
  console.log("✅ Platform User dibuat:", platformUser.email);

  // ========================================================
  // 4. TENANT 1 (KAMPUS): Politeknik Mitra Indonesia (poltekmi)
  // ========================================================
  const kampus = await prisma.institution.create({
    data: {
      slug: "poltekmi",
      name: "Politeknik Mitra Indonesia",
      type: InstitutionType.UNIVERSITY,
      status: TenantStatus.ACTIVE,
      planId: planPro.id,
      emailDomain: "poltekmi.ac.id",
      logoUrl: "/campus-logo.png",
      themeColor: "#2563eb",
      idFormatTemplate: "{YEAR2}{PRODI_CODE}{SEQ4}",
      initialPasswordMode: InitialPasswordMode.SAME_AS_ID,
      phoneBindingPolicy: PhoneBindingPolicy.SELF_WITH_DOB,
      allowIdLogin: true,
      keepPersonalEmailLogin: true,
      address: "Jl. Pendidikan Luhur No. 45, Kampus Terpadu",
      contactPhone: "021-7890123",
    },
  });

  // Subscription Kampus
  await prisma.subscription.create({
    data: {
      institutionId: kampus.id,
      planId: planPro.id,
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  // Master Data Akademik Kampus
  const termKampus = await prisma.academicTerm.create({
    data: {
      institutionId: kampus.id,
      name: "Tahun Akademik 2024/2025 Ganjil",
      code: "20241",
      type: AcademicTermType.SEMESTER_ODD,
      startDate: new Date("2024-09-01"),
      endDate: new Date("2025-01-31"),
      isActive: true,
    },
  });

  const prodiTI = await prisma.programDepartment.create({
    data: {
      institutionId: kampus.id,
      code: "TI",
      name: "D4 Teknik Informatika",
      facultyName: "Fakultas Teknologi Informasi",
      degreeLevel: "D4",
    },
  });

  const roomLab = await prisma.room.create({
    data: {
      institutionId: kampus.id,
      code: "LAB-KOMP-1",
      name: "Lab Komputer Rekayasa Perangkat Lunak",
      capacity: 35,
      type: RoomType.LABORATORY,
      building: "Gedung Cyber Lt. 3",
    },
  });

  const timeSlotBlok1 = await prisma.timeSlot.create({
    data: {
      institutionId: kampus.id,
      name: "Sesi Pagi (08.00 - 09.40)",
      startTime: "08:00",
      endTime: "09:40",
      orderIndex: 1,
    },
  });

  // Komponen Biaya & Beasiswa Kampus
  const feeUKTTI = await prisma.feeComponent.create({
    data: {
      institutionId: kampus.id,
      programDepartmentId: prodiTI.id,
      code: "UKT_TI",
      name: "UKT / SPP Semester 1",
      type: FeeComponentType.TUITION_SEMESTER,
      defaultAmount: 5000000,
    },
  });

  const feeRegPMB = await prisma.feeComponent.create({
    data: {
      institutionId: kampus.id,
      code: "REG_PMB",
      name: "Biaya Pendaftaran PMB",
      type: FeeComponentType.REGISTRATION,
      defaultAmount: 250000,
    },
  });

  const sponsorYayasan = await prisma.scholarshipSponsor.create({
    data: {
      institutionId: kampus.id,
      name: "Yayasan Mitra Pendidikan Mandiri",
      type: "FOUNDATION",
      contactPerson: "Drs. H. Mulyadi",
      email: "info@mitramandiri.org",
      billingAddress: "Jl. Sudirman Kav 21, Jakarta",
    },
  });

  const skemaYayasan50 = await prisma.scholarshipScheme.create({
    data: {
      institutionId: kampus.id,
      sponsorId: sponsorYayasan.id,
      name: "Beasiswa Prestasi Akademik Yayasan (50% UKT)",
      code: "YAYASAN_50",
      type: "MERIT",
      coverageType: ScholarshipCoverageType.PERCENTAGE,
      coverageValue: 50,
      quota: 25,
      requiresReviewEachSemester: true,
      minGpa: 3.5,
    },
  });

  // --- AKUN PENGGUNA KAMPUS ---

  // A. Admin Kampus (ADM001) - PENDING_ACTIVATION
  const adminKampusPass = await hash("ADM001");
  const adminKampus = await prisma.user.create({
    data: {
      institutionId: kampus.id,
      fullName: "Bambang Sudirjo, M.M",
      passwordHash: adminKampusPass,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
      phoneE164: "+6281234567001",
      contactEmail: "admin.poltekmi@gmail.com",
    },
  });
  await prisma.userIdentifier.createMany({
    data: [
      {
        userId: adminKampus.id,
        institutionId: kampus.id,
        type: IdentifierType.INSTITUTION_ID,
        value: "adm001",
        isLoginEnabled: true,
        isPrimary: true,
      },
      {
        userId: adminKampus.id,
        institutionId: kampus.id,
        type: IdentifierType.INSTITUTION_EMAIL,
        value: "adm001@poltekmi.ac.id",
        isLoginEnabled: true,
      },
    ],
  });
  await prisma.membership.create({
    data: {
      userId: adminKampus.id,
      institutionId: kampus.id,
      role: UserRole.INSTITUTION_ADMIN,
      status: MembershipStatus.ACTIVE,
    },
  });
  await prisma.staffProfile.create({
    data: {
      userId: adminKampus.id,
      institutionId: kampus.id,
      employeeNumber: "ADM001",
      title: "Kepala Administrasi Akademik",
    },
  });

  // B. Staf Keuangan (KEU001) - PENDING_ACTIVATION
  const stafKeuPass = await hash("KEU001");
  const stafKeuangan = await prisma.user.create({
    data: {
      institutionId: kampus.id,
      fullName: "Dewi Lestari, S.E",
      passwordHash: stafKeuPass,
      status: UserStatus.PENDING_ACTIVATION,
      mustChangePassword: true,
      phoneE164: "+6281234567002",
      contactEmail: "dewi.keuangan@gmail.com",
    },
  });
  await prisma.userIdentifier.createMany({
    data: [
      {
        userId: stafKeuangan.id,
        institutionId: kampus.id,
        type: IdentifierType.INSTITUTION_ID,
        value: "keu001",
        isLoginEnabled: true,
        isPrimary: true,
      },
      {
        userId: stafKeuangan.id,
        institutionId: kampus.id,
        type: IdentifierType.INSTITUTION_EMAIL,
        value: "keu001@poltekmi.ac.id",
        isLoginEnabled: true,
      },
    ],
  });
  await prisma.membership.create({
    data: {
      userId: stafKeuangan.id,
      institutionId: kampus.id,
      role: UserRole.FINANCIAL_STAFF,
      status: MembershipStatus.ACTIVE,
    },
  });
  await prisma.staffProfile.create({
    data: {
      userId: stafKeuangan.id,
      institutionId: kampus.id,
      employeeNumber: "KEU001",
      title: "Bendahara & Administrasi Keuangan",
    },
  });

  // C. Panitia Beasiswa (BEA001) - PENDING_ACTIVATION
  const beaPass = await hash("BEA001");
  const panitiaBeasiswa = await prisma.user.create({
    data: {
      institutionId: kampus.id,
      fullName: "Arief Hidayat, S.Kom",
      passwordHash: beaPass,
      status: UserStatus.PENDING_ACTIVATION,
      mustChangePassword: true,
      phoneE164: "+6281234567003",
    },
  });
  await prisma.userIdentifier.createMany({
    data: [
      {
        userId: panitiaBeasiswa.id,
        institutionId: kampus.id,
        type: IdentifierType.INSTITUTION_ID,
        value: "bea001",
        isLoginEnabled: true,
        isPrimary: true,
      },
      {
        userId: panitiaBeasiswa.id,
        institutionId: kampus.id,
        type: IdentifierType.INSTITUTION_EMAIL,
        value: "bea001@poltekmi.ac.id",
        isLoginEnabled: true,
      },
    ],
  });
  await prisma.membership.create({
    data: {
      userId: panitiaBeasiswa.id,
      institutionId: kampus.id,
      role: UserRole.SCHOLARSHIP_COMMITTEE,
      status: MembershipStatus.ACTIVE,
    },
  });

  // D. Dosen (DSN001) - PENDING_ACTIVATION
  const dosenPass = await hash("DSN001");
  const dosen = await prisma.user.create({
    data: {
      institutionId: kampus.id,
      fullName: "Dr. Hendra Wijaya, M.Kom",
      passwordHash: dosenPass,
      status: UserStatus.PENDING_ACTIVATION,
      mustChangePassword: true,
      phoneE164: "+6281234567004",
      contactEmail: "hendra.dosen@gmail.com",
    },
  });
  await prisma.userIdentifier.createMany({
    data: [
      {
        userId: dosen.id,
        institutionId: kampus.id,
        type: IdentifierType.INSTITUTION_ID,
        value: "dsn001",
        isLoginEnabled: true,
        isPrimary: true,
      },
      {
        userId: dosen.id,
        institutionId: kampus.id,
        type: IdentifierType.INSTITUTION_EMAIL,
        value: "dsn001@poltekmi.ac.id",
        isLoginEnabled: true,
      },
    ],
  });
  await prisma.membership.create({
    data: {
      userId: dosen.id,
      institutionId: kampus.id,
      role: UserRole.TEACHER,
      status: MembershipStatus.ACTIVE,
    },
  });
  await prisma.staffProfile.create({
    data: {
      userId: dosen.id,
      institutionId: kampus.id,
      employeeNumber: "DSN001",
      title: "Dosen Tetap Teknik Informatika",
    },
  });

  // E. Mahasiswa 1: Budi Santoso (NIM Numerik: 2301010011) - Import / Akun Baru (PENDING_ACTIVATION)
  // Password awal = NIM ("2301010011"), mustChangePassword = true, DOB = 2004-05-15
  const mhs1Pass = await hash("2301010011");
  const mhs1 = await prisma.user.create({
    data: {
      institutionId: kampus.id,
      fullName: "Budi Santoso",
      passwordHash: mhs1Pass,
      status: UserStatus.PENDING_ACTIVATION,
      mustChangePassword: true,
      birthDate: new Date("2004-05-15"),
      phoneE164: "+6281234567005",
      contactEmail: "budi.santoso@gmail.com",
    },
  });
  await prisma.userIdentifier.createMany({
    data: [
      {
        userId: mhs1.id,
        institutionId: kampus.id,
        type: IdentifierType.INSTITUTION_ID,
        value: "2301010011",
        isLoginEnabled: true,
        isPrimary: true,
      },
      {
        userId: mhs1.id,
        institutionId: kampus.id,
        type: IdentifierType.INSTITUTION_EMAIL,
        value: "2301010011@poltekmi.ac.id",
        isLoginEnabled: true,
      },
    ],
  });
  await prisma.membership.create({
    data: {
      userId: mhs1.id,
      institutionId: kampus.id,
      role: UserRole.STUDENT,
      status: MembershipStatus.ACTIVE,
    },
  });
  const mhs1Profile = await prisma.studentProfile.create({
    data: {
      userId: mhs1.id,
      institutionId: kampus.id,
      studentIdNumber: "2301010011",
      programDepartmentId: prodiTI.id,
      cohortYear: 2023,
    },
  });

  // Invoice Mhs 1 dengan Beasiswa Yayasan 50%
  const invoiceMhs1 = await prisma.invoice.create({
    data: {
      institutionId: kampus.id,
      invoiceNumber: "INV-2024-001",
      userId: mhs1.id,
      studentProfileId: mhs1Profile.id,
      status: InvoiceStatus.UNPAID,
      totalAmount: 5000000,
      discountAmount: 2500000,
      paidAmount: 0,
      dueAt: new Date("2024-10-31"),
    },
  });
  await prisma.invoiceItem.create({
    data: {
      invoiceId: invoiceMhs1.id,
      feeComponentId: feeUKTTI.id,
      description: "UKT Semester 1 (Diskon Beasiswa Yayasan 50%)",
      amount: 5000000,
      discountAmount: 2500000,
      netAmount: 2500000,
    },
  });
  await prisma.sponsorInvoice.create({
    data: {
      institutionId: kampus.id,
      sponsorId: sponsorYayasan.id,
      invoiceNumber: "SPON-YAYASAN-2024-001",
      totalAmount: 2500000,
      status: SponsorInvoiceStatus.BILLED,
      dueDate: new Date("2024-11-15"),
      notes: "Klaim potongan beasiswa 50% UKT atas nama Budi Santoso (2301010011)",
    },
  });

  // F. Mahasiswa 2: Cindy Permata (Eks Pendaftar Terkonversi)
  // Status: ACTIVE langsung (karena HP sudah diverifikasi saat daftar), password tetap buatan sendiri: "PasswordPendaftar123!"
  const cindyPass = await hash("PasswordPendaftar123!");
  const cindyUser = await prisma.user.create({
    data: {
      institutionId: kampus.id,
      fullName: "Cindy Permata",
      passwordHash: cindyPass,
      status: UserStatus.ACTIVE,
      mustChangePassword: false, // Tidak dipaksa ganti password!
      phoneE164: "+6281299887766",
      phoneVerifiedAt: new Date(),
      contactEmail: "cindy.permata@gmail.com",
    },
  });

  const pmbPeriod = await prisma.admissionPeriod.create({
    data: {
      institutionId: kampus.id,
      name: "PMB Jalur Mandiri & Prestasi 2025/2026",
      type: "PMB",
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-06-30"),
      announcementDate: new Date("2025-07-05"),
      reRegistrationDeadline: new Date("2025-07-20"),
    },
  });

  const trackMandiri = await prisma.admissionTrack.create({
    data: {
      admissionPeriodId: pmbPeriod.id,
      code: "MANDIRI",
      name: "Jalur Tes Mandiri",
      registrationFee: 250000,
    },
  });

  const cindyApplicant = await prisma.applicant.create({
    data: {
      institutionId: kampus.id,
      admissionPeriodId: pmbPeriod.id,
      admissionTrackId: trackMandiri.id,
      registrationNumber: "PMB-2025-001",
      userId: cindyUser.id,
      fullName: "Cindy Permata",
      phone: "+6281299887766",
      email: "cindy.permata@gmail.com",
      status: ApplicantStatus.CONVERTED,
      finalScore: 92.5,
    },
  });

  // Identifiers Cindy: (1) NIM Numerik 2301010012, (2) Virtual email, (3) Email pribadi, (4) No Registrasi
  await prisma.userIdentifier.createMany({
    data: [
      {
        userId: cindyUser.id,
        institutionId: kampus.id,
        type: IdentifierType.INSTITUTION_ID,
        value: "2301010012",
        isLoginEnabled: true,
        isPrimary: true,
      },
      {
        userId: cindyUser.id,
        institutionId: kampus.id,
        type: IdentifierType.INSTITUTION_EMAIL,
        value: "2301010012@poltekmi.ac.id",
        isLoginEnabled: true,
      },
      {
        userId: cindyUser.id,
        institutionId: kampus.id,
        type: IdentifierType.PERSONAL_EMAIL,
        value: "cindy.permata@gmail.com",
        isLoginEnabled: true,
      },
      {
        userId: cindyUser.id,
        institutionId: kampus.id,
        type: IdentifierType.APPLICANT_NO,
        value: "pmb-2025-001",
        isLoginEnabled: true,
      },
    ],
  });

  await prisma.membership.createMany({
    data: [
      {
        userId: cindyUser.id,
        institutionId: kampus.id,
        role: UserRole.STUDENT,
        status: MembershipStatus.ACTIVE,
      },
      {
        userId: cindyUser.id,
        institutionId: kampus.id,
        role: UserRole.APPLICANT,
        status: MembershipStatus.INACTIVE,
      },
    ],
  });

  await prisma.studentProfile.create({
    data: {
      userId: cindyUser.id,
      institutionId: kampus.id,
      studentIdNumber: "2301010012",
      programDepartmentId: prodiTI.id,
      cohortYear: 2024,
      originApplicationId: cindyApplicant.id,
    },
  });

  // G. Pendaftar PMB dengan Fee Waiver KIP: Doni Prasetyo
  const doniPass = await hash("DoniPass123!");
  const doniUser = await prisma.user.create({
    data: {
      institutionId: kampus.id,
      fullName: "Doni Prasetyo",
      passwordHash: doniPass,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
      phoneE164: "+6281234567007",
      phoneVerifiedAt: new Date(),
      contactEmail: "doni.kip@gmail.com",
    },
  });
  await prisma.userIdentifier.createMany({
    data: [
      {
        userId: doniUser.id,
        institutionId: kampus.id,
        type: IdentifierType.PERSONAL_EMAIL,
        value: "doni.kip@gmail.com",
        isLoginEnabled: true,
      },
      {
        userId: doniUser.id,
        institutionId: kampus.id,
        type: IdentifierType.APPLICANT_NO,
        value: "pmb-2025-002",
        isLoginEnabled: true,
      },
    ],
  });
  await prisma.membership.create({
    data: {
      userId: doniUser.id,
      institutionId: kampus.id,
      role: UserRole.APPLICANT,
      status: MembershipStatus.APPLICANT,
    },
  });
  const doniApplicant = await prisma.applicant.create({
    data: {
      institutionId: kampus.id,
      admissionPeriodId: pmbPeriod.id,
      admissionTrackId: trackMandiri.id,
      registrationNumber: "PMB-2025-002",
      userId: doniUser.id,
      fullName: "Doni Prasetyo",
      phone: "+6281234567007",
      email: "doni.kip@gmail.com",
      status: ApplicantStatus.VERIFYING,
    },
  });
  const invoiceDoni = await prisma.invoice.create({
    data: {
      institutionId: kampus.id,
      invoiceNumber: "INV-REG-2025-002",
      userId: doniUser.id,
      applicantId: doniApplicant.id,
      status: InvoiceStatus.PENDING_WAIVER,
      totalAmount: 250000,
      dueAt: new Date("2025-02-28"),
    },
  });
  await prisma.feeWaiverRequest.create({
    data: {
      applicantId: doniApplicant.id,
      invoiceId: invoiceDoni.id,
      feeComponentId: feeRegPMB.id,
      waiverType: "KIP_KULIAH",
      documentNumber: "KIP-778899-2024",
      documentFileUrl: "/uploads/waiver/kip_doni.pdf",
      status: "PENDING",
    },
  });

  // Kelas & Jadwal Kuliah Kampus
  const mkWeb = await prisma.classCourse.create({
    data: {
      institutionId: kampus.id,
      academicTermId: termKampus.id,
      programDepartmentId: prodiTI.id,
      code: "TI302",
      name: "Pemrograman Web Modern",
      credits: 3,
      description: "Mata kuliah pengembangan web modern berbasis React, Next.js, dan arsitektur modular.",
      roomName: "LAB-KOMP-1",
    },
  });
  await prisma.classInstructor.create({
    data: {
      classCourseId: mkWeb.id,
      instructorUserId: dosen.id,
      isPrimary: true,
    },
  });
  await prisma.classEnrollment.createMany({
    data: [
      { classCourseId: mkWeb.id, studentUserId: mhs1.id },
      { classCourseId: mkWeb.id, studentUserId: cindyUser.id },
    ],
  });
  await prisma.scheduleEntry.create({
    data: {
      institutionId: kampus.id,
      academicTermId: termKampus.id,
      classCourseId: mkWeb.id,
      instructorUserId: dosen.id,
      roomId: roomLab.id,
      timeSlotId: timeSlotBlok1.id,
      dayOfWeek: DayOfWeek.MONDAY,
      startTime: "08:00",
      endTime: "09:40",
    },
  });

  console.log("✅ Data Demo Kampus (Politeknik Mitra Indonesia) berhasil di-seed!");

  // ========================================================
  // 5. TENANT 2 (SEKOLAH): SMA Negeri 1 Prestasi (sman1)
  // ========================================================
  const sekolah = await prisma.institution.create({
    data: {
      slug: "sman1",
      name: "SMA Negeri 1 Prestasi",
      type: InstitutionType.SCHOOL,
      status: TenantStatus.ACTIVE,
      planId: planStarter.id,
      emailDomain: "sman1jakarta.sch.id",
      logoUrl: "/school-logo.png",
      themeColor: "#059669",
      idFormatTemplate: "{YEAR2}{ROMBEL_CODE}{SEQ4}",
      initialPasswordMode: InitialPasswordMode.SAME_AS_ID,
      phoneBindingPolicy: PhoneBindingPolicy.ADMIN_PREFILLED_LOCKED,
      allowIdLogin: true,
      address: "Jl. Ki Hajar Dewantara No. 10, Jakarta",
      contactPhone: "021-5551234",
    },
  });

  await prisma.subscription.create({
    data: {
      institutionId: sekolah.id,
      planId: planStarter.id,
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  const termSekolah = await prisma.academicTerm.create({
    data: {
      institutionId: sekolah.id,
      name: "Tahun Ajaran 2024/2025 Semester Ganjil",
      code: "20241",
      type: AcademicTermType.SEMESTER_ODD,
      startDate: new Date("2024-07-15"),
      endDate: new Date("2024-12-20"),
      isActive: true,
    },
  });

  const jurusanMIPA = await prisma.programDepartment.create({
    data: {
      institutionId: sekolah.id,
      code: "MIPA",
      name: "Matematika dan Ilmu Pengetahuan Alam",
      degreeLevel: "SMA",
    },
  });

  const roomX1 = await prisma.room.create({
    data: {
      institutionId: sekolah.id,
      code: "R101",
      name: "Ruang Kelas X-MIPA 1",
      capacity: 36,
      type: RoomType.CLASSROOM,
      building: "Gedung Utama Lt. 1",
    },
  });

  const timeSlotSekolah1 = await prisma.timeSlot.create({
    data: {
      institutionId: sekolah.id,
      name: "Jam ke-1 & 2 (07.30 - 09.00)",
      startTime: "07:30",
      endTime: "09:00",
      orderIndex: 1,
    },
  });

  // Admin Sekolah: STF001 - PENDING_ACTIVATION
  const adminSekolahPass = await hash("STF001");
  const adminSekolah = await prisma.user.create({
    data: {
      institutionId: sekolah.id,
      fullName: "Wahyu Hidayat, S.Sos",
      passwordHash: adminSekolahPass,
      status: UserStatus.PENDING_ACTIVATION,
      mustChangePassword: true,
      phoneE164: "+6281234567010",
      contactEmail: "tu.sman1@gmail.com",
    },
  });
  await prisma.userIdentifier.createMany({
    data: [
      {
        userId: adminSekolah.id,
        institutionId: sekolah.id,
        type: IdentifierType.INSTITUTION_ID,
        value: "stf001",
        isLoginEnabled: true,
        isPrimary: true,
      },
      {
        userId: adminSekolah.id,
        institutionId: sekolah.id,
        type: IdentifierType.INSTITUTION_EMAIL,
        value: "stf001@sman1jakarta.sch.id",
        isLoginEnabled: true,
      },
    ],
  });
  await prisma.membership.create({
    data: {
      userId: adminSekolah.id,
      institutionId: sekolah.id,
      role: UserRole.INSTITUTION_ADMIN,
      status: MembershipStatus.ACTIVE,
    },
  });

  // Guru: GRU001 - PENDING_ACTIVATION
  const guruPass = await hash("GRU001");
  const guru = await prisma.user.create({
    data: {
      institutionId: sekolah.id,
      fullName: "Siti Rahma, S.Pd",
      passwordHash: guruPass,
      status: UserStatus.PENDING_ACTIVATION,
      mustChangePassword: true,
      phoneE164: "+6281234567011",
      contactEmail: "siti.rahma.guru@gmail.com",
    },
  });
  await prisma.userIdentifier.createMany({
    data: [
      {
        userId: guru.id,
        institutionId: sekolah.id,
        type: IdentifierType.INSTITUTION_ID,
        value: "gru001",
        isLoginEnabled: true,
        isPrimary: true,
      },
      {
        userId: guru.id,
        institutionId: sekolah.id,
        type: IdentifierType.INSTITUTION_EMAIL,
        value: "gru001@sman1jakarta.sch.id",
        isLoginEnabled: true,
      },
    ],
  });
  await prisma.membership.create({
    data: {
      userId: guru.id,
      institutionId: sekolah.id,
      role: UserRole.TEACHER,
      status: MembershipStatus.ACTIVE,
    },
  });

  // Siswa: Ahmad Fauzan (NIS: 2401010001) - PENDING_ACTIVATION
  const siswaPass = await hash("2401010001");
  const siswa = await prisma.user.create({
    data: {
      institutionId: sekolah.id,
      fullName: "Ahmad Fauzan",
      passwordHash: siswaPass,
      status: UserStatus.PENDING_ACTIVATION,
      mustChangePassword: true,
      birthDate: new Date("2008-08-20"),
      phoneE164: "+6281234567006",
      phoneOwner: PhoneOwner.GUARDIAN,
      contactEmail: "ahmad.fauzan@gmail.com",
    },
  });
  await prisma.userIdentifier.createMany({
    data: [
      {
        userId: siswa.id,
        institutionId: sekolah.id,
        type: IdentifierType.INSTITUTION_ID,
        value: "2401010001",
        isLoginEnabled: true,
        isPrimary: true,
      },
      {
        userId: siswa.id,
        institutionId: sekolah.id,
        type: IdentifierType.INSTITUTION_EMAIL,
        value: "2401010001@sman1jakarta.sch.id",
        isLoginEnabled: true,
      },
    ],
  });
  await prisma.membership.create({
    data: {
      userId: siswa.id,
      institutionId: sekolah.id,
      role: UserRole.STUDENT,
      status: MembershipStatus.ACTIVE,
    },
  });
  await prisma.studentProfile.create({
    data: {
      userId: siswa.id,
      institutionId: sekolah.id,
      studentIdNumber: "2401010001",
      programDepartmentId: jurusanMIPA.id,
      cohortYear: 2024,
    },
  });

  const mapelMatematika = await prisma.classCourse.create({
    data: {
      institutionId: sekolah.id,
      academicTermId: termSekolah.id,
      programDepartmentId: jurusanMIPA.id,
      code: "MAT-X",
      name: "Matematika Wajib Kelas X",
      description: "Pembelajaran Matematika Wajib semester ganjil kurikulum merdeka.",
      roomName: "X-MIPA-1",
    },
  });
  await prisma.classInstructor.create({
    data: {
      classCourseId: mapelMatematika.id,
      instructorUserId: guru.id,
      isPrimary: true,
    },
  });
  await prisma.classEnrollment.create({
    data: {
      classCourseId: mapelMatematika.id,
      studentUserId: siswa.id,
    },
  });
  await prisma.scheduleEntry.create({
    data: {
      institutionId: sekolah.id,
      academicTermId: termSekolah.id,
      classCourseId: mapelMatematika.id,
      instructorUserId: guru.id,
      roomId: roomX1.id,
      timeSlotId: timeSlotSekolah1.id,
      dayOfWeek: DayOfWeek.TUESDAY,
      startTime: "07:30",
      endTime: "09:00",
    },
  });

  console.log("✅ Data Demo Sekolah (SMA Negeri 1 Prestasi) berhasil di-seed!");

  // ========================================================
  // 6. TENANT 3: Institusi Kosong Demo (kampus-digital)
  // Digunakan untuk uji onboarding mandiri, setup wizard, dan isolasi tenant
  // ========================================================
  const tenantKosong = await prisma.institution.create({
    data: {
      slug: "kampus-digital",
      name: "Institut Teknologi Digital Nusantara",
      type: InstitutionType.UNIVERSITY,
      status: TenantStatus.TRIAL,
      planId: planStarter.id,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      emailDomain: "itdn.ac.id",
      idFormatTemplate: "{YEAR2}{PRODI_CODE}{SEQ4}",
      initialPasswordMode: InitialPasswordMode.SAME_AS_ID,
      phoneBindingPolicy: PhoneBindingPolicy.SELF_WITH_DOB,
      allowIdLogin: true,
      address: "Kawasan Sains Terpadu Nusantara",
    },
  });
  console.log("✅ Tenant 3 Kosong dibuat:", tenantKosong.slug);

  console.log("✨ Seeding Fase 1C & 1D selesai dengan sempurna!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding gagal:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
