import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma, platformPrisma } from "@/lib/db/prisma";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";
import { verifyPassword } from "@/lib/security/hash";
import { UserRole, MembershipStatus } from "@prisma/client";

const ROLE_PRIORITY: Record<UserRole, number> = {
  SUPER_ADMIN: 100,
  INSTITUTION_ADMIN: 90,
  FINANCIAL_STAFF: 80,
  SCHOLARSHIP_COMMITTEE: 75,
  SELECTION_COMMITTEE: 70,
  TEACHER: 60,
  STUDENT: 50,
  PARENT: 40,
  APPLICANT: 10,
};

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 hari
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    // 1. Tenant User Credentials Provider
    CredentialsProvider({
      id: "credentials",
      name: "Tenant Credentials",
      credentials: {
        identifier: { label: "ID atau Email", type: "text" },
        password: { label: "Password", type: "password" },
        tenantSlug: { label: "Tenant Slug", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          throw new Error("ID/Email dan Password wajib diisi.");
        }

        const rawIdentifier = credentials.identifier.trim().toLowerCase();
        const rawPassword = credentials.password;
        const tenantSlug = credentials.tenantSlug?.trim() || "";

        // 1. Tentukan institusi dari tenantSlug atau domain email
        let institution = null;
        if (tenantSlug) {
          institution = await prisma.institution.findUnique({
            where: { slug: tenantSlug },
          });
        }

        if (!institution && rawIdentifier.includes("@")) {
          const emailDomain = rawIdentifier.split("@")[1]?.toLowerCase();
          if (emailDomain) {
            institution = await prisma.institution.findFirst({
              where: { emailDomain },
            });
          }
        }

        if (!institution) {
          throw new Error("Institusi tidak ditemukan. Pastikan Anda mengakses URL portal yang benar.");
        }

        // Cek status institusi
        if (institution.status === "SUSPENDED" || institution.status === "CANCELED") {
          throw new Error(`Layanan institusi ini sedang ${institution.status.toLowerCase()}. Hubungi administrator.`);
        }

        return await withTenantTransaction(institution.id, async (tenantDb) => {
          // 2. Cari kecocokan di UserIdentifier yang terikat dengan institution.id ini
          let matchingIdentifier = null;

          if (rawIdentifier.includes("@")) {
            matchingIdentifier = await tenantDb.userIdentifier.findFirst({
              where: {
                institutionId: institution.id,
                value: rawIdentifier,
                isLoginEnabled: true,
                deactivatedAt: null,
              },
              include: {
                user: {
                  include: {
                    memberships: {
                      include: { institution: true },
                    },
                    identifiers: true,
                  },
                },
                institution: true,
              },
            });
          } else {
            if (!institution.allowIdLogin) {
              throw new Error("Institusi mewajibkan login menggunakan alamat email resmi lengkap.");
            }

            matchingIdentifier = await tenantDb.userIdentifier.findFirst({
              where: {
                institutionId: institution.id,
                value: rawIdentifier,
                isLoginEnabled: true,
                deactivatedAt: null,
              },
              include: {
                user: {
                  include: {
                    memberships: {
                      include: { institution: true },
                    },
                    identifiers: true,
                  },
                },
                institution: true,
              },
            });
          }

          if (!matchingIdentifier || !matchingIdentifier.user) {
            await tenantDb.loginAttempt.create({
              data: {
                institutionId: institution.id,
                identifierEntered: rawIdentifier,
                isSuccess: false,
                failureReason: "Identifier not found in tenant",
              },
            });
            throw new Error("ID atau password salah.");
          }

          const user = matchingIdentifier.user;

          // 3. Cek Lockout Akun
          const now = new Date();
          if (user.lockedUntil && user.lockedUntil > now) {
            const remainingMinutes = Math.ceil(
              (user.lockedUntil.getTime() - now.getTime()) / (60 * 1000)
            );
            throw new Error(
              `Akun Anda terkunci sementara karena beberapa kali gagal login. Silakan coba lagi dalam ${remainingMinutes} menit.`
            );
          }

          // 4. Cek Status Akun
          if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
            throw new Error("Akun Anda telah dinonaktifkan atau ditangguhkan. Silakan hubungi admin.");
          }

          // 5. Verifikasi Password Hash
          const isPasswordValid = await verifyPassword(rawPassword, user.passwordHash);

          if (!isPasswordValid) {
            const newFailedAttempts = user.failedLoginAttempts + 1;
            const lockTime =
              newFailedAttempts >= 5
                ? new Date(now.getTime() + 15 * 60 * 1000)
                : null;

            await tenantDb.user.update({
              where: { id: user.id },
              data: {
                failedLoginAttempts: newFailedAttempts,
                lockedUntil: lockTime,
              },
            });

            await tenantDb.loginAttempt.create({
              data: {
                institutionId: institution.id,
                identifierEntered: rawIdentifier,
                isSuccess: false,
                failureReason: "Invalid password",
              },
            });

            if (lockTime) {
              throw new Error(
                "Terlalu banyak percobaan gagal. Akun Anda telah dikunci selama 15 menit."
              );
            }

            throw new Error("ID atau password salah.");
          }

          // 6. Login Berhasil: Reset failed attempts & perbarui lastLoginAt
          await tenantDb.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: 0,
              lockedUntil: null,
              lastLoginAt: now,
            },
          });

          await tenantDb.loginAttempt.create({
            data: {
              institutionId: institution.id,
              identifierEntered: rawIdentifier,
              isSuccess: true,
            },
          });

          // 7. Resolusi Active Membership & Role
          const activeMemberships = user.memberships.filter(
            (m: any) => m.status === MembershipStatus.ACTIVE || m.status === MembershipStatus.APPLICANT
          );

          const tenantMatches = activeMemberships.filter(
            (m: any) => m.institutionId === institution.id
          );
          const relevantMemberships = tenantMatches.length > 0 ? tenantMatches : activeMemberships;

          relevantMemberships.sort(
            (a: any, b: any) => (ROLE_PRIORITY[b.role as UserRole] || 0) - (ROLE_PRIORITY[a.role as UserRole] || 0)
          );

          const primaryMembership = relevantMemberships[0];
          const activeRole = primaryMembership ? primaryMembership.role : UserRole.APPLICANT;
          const activeInst = primaryMembership?.institution || institution;

          const displayIdentifier =
            user.identifiers.find(
              (id: any) =>
                id.institutionId === activeInst.id &&
                id.type === "INSTITUTION_ID" &&
                id.isLoginEnabled
            )?.value ||
            user.identifiers.find((id: any) => id.isPrimary)?.value ||
            rawIdentifier;

          const membershipSessions = activeMemberships.map((m: any) => ({
            institutionId: m.institutionId,
            role: m.role,
            status: m.status,
            institutionSlug: m.institution.slug,
            institutionName: m.institution.name,
            institutionType: m.institution.type,
          }));

          return {
            id: user.id,
            fullName: user.fullName,
            email: user.contactEmail || `${displayIdentifier}@${activeInst.emailDomain}`,
            activeRole,
            activeInstitutionId: activeInst.id,
            tenantSlug: activeInst.slug,
            institutionType: activeInst.type,
            institutionName: activeInst.name,
            identifier: displayIdentifier,
            status: user.status,
            sessionVersion: user.sessionVersion,
            phoneE164: user.phoneE164,
            phoneVerifiedAt: user.phoneVerifiedAt,
            mustChangePassword: user.mustChangePassword,
            memberships: membershipSessions,
          };
        });
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.fullName = user.fullName;
        token.activeRole = user.activeRole;
        token.activeInstitutionId = user.activeInstitutionId;
        token.tenantSlug = user.tenantSlug;
        token.institutionType = user.institutionType;
        token.institutionName = user.institutionName;
        token.identifier = user.identifier;
        token.status = user.status;
        token.sessionVersion = user.sessionVersion;
        token.phoneE164 = user.phoneE164;
        token.phoneVerifiedAt = user.phoneVerifiedAt;
        token.mustChangePassword = user.mustChangePassword;
        token.memberships = user.memberships;
      }

      // 2.a: Verifikasi sessionVersion & status ke database saat token dievaluasi ulang (setelah password change/reset)
      if (!user && token?.id) {
        try {
          const tenantId = token.activeInstitutionId as string;
          const dbUser = tenantId
            ? await withTenantTransaction(tenantId, async (tenantDb) =>
                tenantDb.user.findUnique({
                  where: { id: token.id as string },
                  select: { sessionVersion: true, status: true },
                })
              )
            : await platformPrisma.user.findUnique({
                where: { id: token.id as string },
                select: { sessionVersion: true, status: true },
              });

          if (!dbUser || dbUser.sessionVersion !== token.sessionVersion || dbUser.status === "SUSPENDED" || dbUser.status === "DEACTIVATED") {
            // Sesi dibatalkan secara instan karena sessionVersion usang atau akun nonaktif
            return {};
          }
        } catch (err) {
          console.error("JWT sessionVersion check error:", err);
          return {};
        }
      }

      // Handle session updates (e.g., after onboarding activation or role switcher)
      if (trigger === "update" && session) {
        if (typeof session.mustChangePassword === "boolean") {
          token.mustChangePassword = session.mustChangePassword;
        }
        if (session.status) {
          token.status = session.status;
        }
        if (session.sessionVersion) {
          token.sessionVersion = session.sessionVersion;
        }
        if (session.activeRole) {
          token.activeRole = session.activeRole;
        }
        if (session.tenantSlug) {
          token.tenantSlug = session.tenantSlug;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (!token || !token.id) {
        return null as any;
      }
      if (session?.user) {
        session.user.id = token.id;
        session.user.fullName = token.fullName;
        session.user.activeRole = token.activeRole;
        session.user.activeInstitutionId = token.activeInstitutionId;
        session.user.tenantSlug = token.tenantSlug;
        session.user.institutionType = token.institutionType;
        session.user.institutionName = token.institutionName;
        session.user.identifier = token.identifier;
        session.user.status = token.status;
        session.user.sessionVersion = token.sessionVersion;
        session.user.phoneE164 = token.phoneE164;
        session.user.phoneVerifiedAt = token.phoneVerifiedAt;
        session.user.mustChangePassword = token.mustChangePassword;
        session.user.memberships = token.memberships;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
