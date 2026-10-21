import { prisma } from "@/lib/db/prisma";
import { InstitutionType, TenantStatus, UserRole, UserStatus, IdentifierType, InitialPasswordMode, PhoneBindingPolicy } from "@prisma/client";
import { normalizePhoneE164 } from "@/lib/security/phone";
import bcrypt from "bcryptjs";

export const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "platform", "mail", "dev", "auth",
  "login", "signup", "dashboard", "public", "system", "superadmin",
  "root", "billing", "help", "support", "status"
]);

export function validateTenantSlug(slug: string): { isValid: boolean; error?: string } {
  if (!slug) return { isValid: false, error: "Slug institusi wajib diisi." };

  const normalized = slug.trim().toLowerCase();

  if (normalized.length < 3 || normalized.length > 30) {
    return { isValid: false, error: "Slug harus terdiri dari 3 hingga 30 karakter." };
  }

  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slugRegex.test(normalized)) {
    return { isValid: false, error: "Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung (-)." };
  }

  if (RESERVED_SLUGS.has(normalized)) {
    return { isValid: false, error: `Slug "${normalized}" merupakan nama sistem yang diproteksi.` };
  }

  return { isValid: true };
}

export interface CreateTenantTrialParams {
  name: string;
  slug: string;
  type: InstitutionType;
  adminFullName: string;
  adminPhone: string;
  adminPassword: string;
  adminContactEmail?: string;
}

export async function createTenantTrial(params: CreateTenantTrialParams) {
  const slugValidation = validateTenantSlug(params.slug);
  if (!slugValidation.isValid) {
    throw new Error(slugValidation.error);
  }

  const normalizedSlug = params.slug.trim().toLowerCase();
  const normalizedPhone = normalizePhoneE164(params.adminPhone);

  // Cek apakah slug sudah digunakan
  const existing = await prisma.institution.findUnique({
    where: { slug: normalizedSlug },
  });
  if (existing) {
    throw new Error(`Institusi dengan slug "${normalizedSlug}" sudah terdaftar.`);
  }

  // Cari plan STARTER sebagai default trial
  let starterPlan = await prisma.plan.findUnique({
    where: { code: "STARTER" },
  });
  if (!starterPlan) {
    starterPlan = await prisma.plan.findFirst();
  }

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 hari masa trial
  const rootDomain = process.env.ROOT_DOMAIN || "lms.platform";
  const emailDomain = `${normalizedSlug}.${rootDomain}`;

  // Hash password admin
  const passwordHash = await bcrypt.hash(params.adminPassword, 10);
  const adminId = "ADM001";
  const adminEmail = `${adminId}@${emailDomain}`.toLowerCase();

  return await prisma.$transaction(async (tx) => {
    // 1. Buat Institusi Baru
    const institution = await tx.institution.create({
      data: {
        slug: normalizedSlug,
        name: params.name,
        type: params.type,
        status: TenantStatus.TRIAL,
        planId: starterPlan?.id || null,
        trialEndsAt,
        emailDomain,
        initialPasswordMode: InitialPasswordMode.SAME_AS_ID,
        phoneBindingPolicy: PhoneBindingPolicy.SELF_WITH_DOB,
        allowIdLogin: true,
        keepPersonalEmailLogin: true,
      },
    });

    // 2. Buat Subscription Trial
    if (starterPlan) {
      await tx.subscription.create({
        data: {
          institutionId: institution.id,
          planId: starterPlan.id,
          status: "TRIALING",
          currentPeriodStart: now,
          currentPeriodEnd: trialEndsAt,
        },
      });
    }

    // 3. Buat User Admin Pertama (langsung ACTIVE karena nomor HP sudah OTP-verified dan password dibuat sendiri)
    const adminUser = await tx.user.create({
      data: {
        institutionId: institution.id,
        fullName: params.adminFullName,
        passwordHash,
        status: UserStatus.ACTIVE,
        mustChangePassword: false, // Tidak dipaksa ganti password
        phoneE164: normalizedPhone,
        phoneVerifiedAt: now,
        contactEmail: params.adminContactEmail || null,
      },
    });

    // 4. Buat UserIdentifier untuk Admin (ID & Virtual Email)
    await tx.userIdentifier.createMany({
      data: [
        {
          userId: adminUser.id,
          institutionId: institution.id,
          type: IdentifierType.INSTITUTION_ID,
          value: adminId,
          isLoginEnabled: true,
          isPrimary: true,
        },
        {
          userId: adminUser.id,
          institutionId: institution.id,
          type: IdentifierType.INSTITUTION_EMAIL,
          value: adminEmail,
          isLoginEnabled: true,
        },
      ],
    });

    // 5. Buat Membership Admin
    await tx.membership.create({
      data: {
        userId: adminUser.id,
        institutionId: institution.id,
        role: UserRole.INSTITUTION_ADMIN,
        status: "ACTIVE",
      },
    });

    // 6. Buat Profil Staf Admin
    await tx.staffProfile.create({
      data: {
        userId: adminUser.id,
        institutionId: institution.id,
        employeeNumber: adminId,
        title: "Administrator Utama Institusi",
      },
    });

    // 7. Catat Audit Log
    await tx.auditLog.create({
      data: {
        institutionId: institution.id,
        userId: adminUser.id,
        action: "TENANT_SIGNUP_TRIAL",
        entityType: "Institution",
        entityId: institution.id,
        newValue: { slug: normalizedSlug, type: params.type, adminId },
      },
    });

    return {
      institution,
      adminUser,
      adminId,
      adminEmail,
    };
  });
}
