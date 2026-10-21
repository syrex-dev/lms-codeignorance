import { prisma } from "@/lib/db/prisma";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";
import { hashPassword } from "@/lib/security/password-policy";
import { normalizePhoneE164, isValidIndonesianPhone } from "@/lib/security/phone";
import { checkLimit } from "@/modules/saas/entitlement";
import { generateId } from "@/modules/id-generator/generator";
import {
  UserRole,
  UserStatus,
  IdentifierType,
  MembershipStatus,
  PhoneOwner,
} from "@prisma/client";
import crypto from "crypto";

export interface CreateUserInput {
  institutionId: string;
  fullName: string;
  role: UserRole;
  id?: string;
  birthDate?: string | Date;
  phoneE164?: string;
  phoneOwner?: PhoneOwner;
  contactEmail?: string;
  programDepartmentId?: string;
  classCourseId?: string;
}

export interface CreateUserResult {
  userId: string;
  id: string;
  loginEmail: string;
  fullName: string;
  status: UserStatus;
  initialPasswordPlain?: string; // HANYA diisi jika mode RANDOM
}

export class UserService {
  /**
   * Pembuatan pengguna baru secara manual dengan tenant scoping & kuota limit check
   */
  static async createUser(
    input: CreateUserInput,
    operatorUserId: string
  ): Promise<CreateUserResult> {
    const { institutionId, fullName, role } = input;

    // 1. Cek Kuota maxActiveUsers
    const limitCheck = await checkLimit(institutionId, "maxActiveUsers");
    if (!limitCheck.allowed) {
      throw new Error(limitCheck.message || "Batas kuota pengguna aktif institusi telah tercapai.");
    }

    return withTenantTransaction(institutionId, async (tenantDb) => {
      const institution = await prisma.institution.findUnique({
        where: { id: institutionId },
        select: {
          emailDomain: true,
          initialPasswordMode: true,
          idFormatTemplate: true,
        },
      });

      if (!institution) throw new Error("Institusi tidak ditemukan.");

      // 2. Tentukan ID Pengguna (input manual atau digenerate dari template)
      let finalId = input.id ? input.id.trim().toLowerCase() : "";
      if (!finalId) {
        finalId = await generateId(
          institutionId,
          {
            scope: role,
            template: institution.idFormatTemplate,
          },
          tenantDb
        );
      }

      // Cek duplikasi ID di tenant ini
      const duplicate = await (tenantDb as any).userIdentifier.findFirst({
        where: {
          institutionId,
          value: finalId,
        },
      });

      if (duplicate) {
        throw new Error(`ID/NIM/NIS "${finalId}" sudah terdaftar di institusi ini.`);
      }

      // 3. Tentukan Password Awal
      let initialPasswordPlain: string | undefined;
      let passwordToHash: string;

      if (institution.initialPasswordMode === "RANDOM") {
        // Mode RANDOM: Buat password acak 8 karakter
        const randomHex = crypto.randomBytes(4).toString("hex");
        initialPasswordPlain = `Pwd${randomHex}!1`;
        passwordToHash = initialPasswordPlain;
      } else {
        // Mode SAME_AS_ID (default)
        passwordToHash = finalId;
      }

      const passwordHash = await hashPassword(passwordToHash);

      // Normalisasi nomor HP jika ada
      let normalizedPhone: string | null = null;
      if (input.phoneE164) {
        normalizedPhone = normalizePhoneE164(input.phoneE164);
        if (!isValidIndonesianPhone(normalizedPhone)) {
          throw new Error("Nomor handphone tidak valid atau di luar kode negara Indonesia (+62).");
        }
      }

      const birthDate = input.birthDate ? new Date(input.birthDate) : null;
      const loginEmail = `${finalId}@${institution.emailDomain}`.toLowerCase();

      // 4. Buat entitas User dengan status PENDING_ACTIVATION
      const user = await (tenantDb as any).user.create({
        data: {
          institutionId,
          fullName,
          passwordHash,
          status: UserStatus.PENDING_ACTIVATION,
          mustChangePassword: true,
          phoneE164: normalizedPhone,
          phoneOwner: input.phoneOwner || "SELF",
          birthDate,
          contactEmail: input.contactEmail ? input.contactEmail.toLowerCase().trim() : null,
          passwordHistories: {
            create: {
              passwordHash,
            },
          },
        },
      });

      // 5. Buat UserIdentifier (INSTITUTION_ID dan INSTITUTION_EMAIL)
      await (tenantDb as any).userIdentifier.createMany({
        data: [
          {
            userId: user.id,
            institutionId,
            type: IdentifierType.INSTITUTION_ID,
            value: finalId,
            isLoginEnabled: true,
            isPrimary: true,
          },
          {
            userId: user.id,
            institutionId,
            type: IdentifierType.INSTITUTION_EMAIL,
            value: loginEmail,
            isLoginEnabled: true,
            isPrimary: false,
          },
        ],
      });

      // 6. Buat Membership
      await (tenantDb as any).membership.create({
        data: {
          userId: user.id,
          institutionId,
          role,
          status: MembershipStatus.ACTIVE,
        },
      });

      // 7. Buat Profil spesifik (StudentProfile / StaffProfile)
      if (role === UserRole.STUDENT) {
        await (tenantDb as any).studentProfile.create({
          data: {
            userId: user.id,
            institutionId,
            studentIdNumber: finalId,
            programDepartmentId: input.programDepartmentId || null,
            cohortYear: new Date().getFullYear(),
          },
        });
      } else if (role === UserRole.TEACHER || role === UserRole.INSTITUTION_ADMIN || role === UserRole.FINANCIAL_STAFF) {
        await (tenantDb as any).staffProfile.create({
          data: {
            userId: user.id,
            institutionId,
            employeeNumber: finalId,
            title: role === UserRole.TEACHER ? "Pengajar" : "Staf Administrasi",
          },
        });
      }

      // 8. Catat AuditLog
      await (tenantDb as any).auditLog.create({
        data: {
          institutionId,
          userId: operatorUserId,
          action: "USER_CREATED_MANUAL",
          entityType: "User",
          entityId: user.id,
          newValue: {
            id: finalId,
            fullName,
            role,
            loginEmail,
            initialPasswordMode: institution.initialPasswordMode,
          },
        },
      });

      return {
        userId: user.id,
        id: finalId,
        loginEmail,
        fullName: user.fullName,
        status: user.status,
        initialPasswordPlain: institution.initialPasswordMode === "RANDOM" ? initialPasswordPlain : undefined,
      };
    });
  }

  /**
   * Cari dan filter daftar pengguna dengan pagination & status aktivasi
   */
  static async searchUsers(
    institutionId: string,
    params: {
      search?: string;
      role?: UserRole;
      status?: UserStatus;
      isPendingActivation?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      institutionId,
      deletedAt: null,
    };

    if (params.status) {
      where.status = params.status;
    }

    if (params.isPendingActivation !== undefined) {
      if (params.isPendingActivation) {
        where.status = UserStatus.PENDING_ACTIVATION;
      } else {
        where.status = { not: UserStatus.PENDING_ACTIVATION };
      }
    }

    if (params.role) {
      where.memberships = {
        some: {
          institutionId,
          role: params.role,
        },
      };
    }

    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { fullName: { contains: q, mode: "insensitive" } },
        { contactEmail: { contains: q, mode: "insensitive" } },
        { phoneE164: { contains: q, mode: "insensitive" } },
        {
          identifiers: {
            some: {
              institutionId,
              value: { contains: q, mode: "insensitive" },
            },
          },
        },
      ];
    }

    return withTenantTransaction(institutionId, async (tenantDb) => {
      const [users, total] = await Promise.all([
        (tenantDb as any).user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            identifiers: {
              where: { institutionId },
              select: { type: true, value: true, isPrimary: true, isLoginEnabled: true },
            },
            memberships: {
              where: { institutionId },
              select: { role: true, status: true },
            },
            studentProfiles: {
              where: { institutionId },
              select: {
                studentIdNumber: true,
                cohortYear: true,
                programDepartment: { select: { id: true, name: true, code: true } },
              },
            },
            staffProfiles: {
              where: { institutionId },
              select: { employeeNumber: true, title: true, department: true },
            },
          },
        }),
        (tenantDb as any).user.count({ where }),
      ]);

      const formattedUsers = users.map((u: any) => {
        const idIdent = u.identifiers.find((i: any) => i.type === IdentifierType.INSTITUTION_ID);
        const emailIdent = u.identifiers.find((i: any) => i.type === IdentifierType.INSTITUTION_EMAIL);
        const primaryRole = u.memberships[0]?.role || UserRole.STUDENT;
        const studentProfile = u.studentProfiles?.[0];
        const staffProfile = u.staffProfiles?.[0];

        return {
          id: u.id,
          identifier: idIdent?.value || studentProfile?.studentIdNumber || staffProfile?.employeeNumber || "-",
          loginEmail: emailIdent?.value || "-",
          fullName: u.fullName,
          role: primaryRole,
          status: u.status,
          isPendingActivation: u.status === UserStatus.PENDING_ACTIVATION,
          phoneE164: u.phoneE164,
          contactEmail: u.contactEmail,
          birthDate: u.birthDate,
          createdAt: u.createdAt,
          programOrDepartment:
            studentProfile?.programDepartment?.name ||
            staffProfile?.department ||
            "-",
        };
      });

      return {
        users: formattedUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }

  /**
   * Aktifkan / Nonaktifkan pengguna dengan audit log
   */
  static async toggleUserStatus(
    institutionId: string,
    userId: string,
    targetStatus: UserStatus,
    operatorUserId: string,
    reason: string
  ) {
    if (!reason || reason.trim().length < 5) {
      throw new Error("Alasan perubahan status pengguna wajib diisi (minimal 5 karakter).");
    }

    return withTenantTransaction(institutionId, async (tenantDb) => {
      const user = await (tenantDb as any).user.findUnique({
        where: { id: userId },
      });

      if (!user || user.institutionId !== institutionId) {
        throw new Error("Pengguna tidak ditemukan di institusi ini.");
      }

      const updated = await (tenantDb as any).user.update({
        where: { id: userId },
        data: { status: targetStatus },
      });

      await (tenantDb as any).auditLog.create({
        data: {
          institutionId,
          userId: operatorUserId,
          action: "USER_STATUS_TOGGLED",
          entityType: "User",
          entityId: userId,
          oldValue: { status: user.status },
          newValue: { status: targetStatus, reason },
        },
      });

      return updated;
    });
  }

  /**
   * Ubah Peran Pengguna dengan audit log
   */
  static async changeUserRole(
    institutionId: string,
    userId: string,
    newRole: UserRole,
    operatorUserId: string,
    reason: string
  ) {
    if (!reason || reason.trim().length < 5) {
      throw new Error("Alasan perubahan peran wajib diisi (minimal 5 karakter).");
    }

    return withTenantTransaction(institutionId, async (tenantDb) => {
      const membership = await (tenantDb as any).membership.findFirst({
        where: { userId, institutionId },
      });

      if (!membership) {
        throw new Error("Keanggotaan pengguna di institusi ini tidak ditemukan.");
      }

      const oldRole = membership.role;
      const updated = await (tenantDb as any).membership.update({
        where: { id: membership.id },
        data: { role: newRole },
      });

      await (tenantDb as any).auditLog.create({
        data: {
          institutionId,
          userId: operatorUserId,
          action: "USER_ROLE_CHANGED",
          entityType: "Membership",
          entityId: membership.id,
          oldValue: { role: oldRole },
          newValue: { role: newRole, reason },
        },
      });

      return updated;
    });
  }
}
