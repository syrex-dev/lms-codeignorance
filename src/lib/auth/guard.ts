import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "./auth-options";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";
import { hasFeature, type FeatureKey } from "@/modules/saas/entitlement";

export interface RequireSessionOptions {
  allowOnboarding?: boolean; // default: false (blocks PENDING_ACTIVATION / mustChangePassword)
  requiredRoles?: UserRole[]; // RBAC roles (e.g. [UserRole.INSTITUTION_ADMIN])
  requiredFeature?: FeatureKey; // SaaS entitlement feature (e.g. "classroom")
  allowSuspendedTenantWrite?: boolean; // default: false
}

export interface AuthenticatedUser {
  id: string;
  identifier?: string;
  fullName: string;
  activeRole: UserRole;
  activeInstitutionId: string;
  tenantSlug: string;
  status: string;
  sessionVersion: number;
  phoneE164?: string;
  mustChangePassword?: boolean;
  tenantStatus?: string;
}

export type GuardResult =
  | { success: true; user: AuthenticatedUser; institutionId: string; tenantSlug: string; role: UserRole }
  | { success: false; response: NextResponse };

/**
 * Helper terpusat untuk proteksi route handler dan server action (Defense in Depth).
 * Memverifikasi sessionVersion dan tenantStatus langsung dari database.
 */
export async function requireSession(
  req?: Request,
  options: RequireSessionOptions = {}
): Promise<GuardResult> {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch {
    // Di luar Next.js request store (mis. Vitest / integration test)
  }

  // Jika getServerSession tidak menemukan sesi (mis. pengujian HTTP atau sub-request),
  // baca token JWT langsung dari req via next-auth/jwt getToken
  if (!session?.user && req) {
    try {
      const { NextRequest } = await import("next/server");
      const reqToUse = (req as any).cookies ? req : new NextRequest(req.url, req);
      const token = await getToken({
        req: reqToUse as any,
        secret: process.env.NEXTAUTH_SECRET,
      });
      if (token && token.id) {
        session = {
          user: {
            id: token.id as string,
            name: token.name as string,
            fullName: (token.fullName as string) || (token.name as string),
            identifier: token.identifier as string | undefined,
            activeRole: token.activeRole as UserRole,
            activeInstitutionId: token.activeInstitutionId as string,
            tenantSlug: token.tenantSlug as string,
            status: token.status as string,
            sessionVersion: Number(token.sessionVersion ?? 1),
            phoneE164: token.phoneE164 as string | undefined,
            mustChangePassword: Boolean(token.mustChangePassword),
            tenantStatus: token.tenantStatus as string | undefined,
          },
          expires: new Date(Date.now() + 86400000).toISOString(),
        };
      }
    } catch {
      // Abaikan jika token gagal dibaca
    }
  }

  if (!session || !session.user || !session.user.id) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sesi autentikasi tidak ditemukan atau telah kedaluwarsa." },
        { status: 401 }
      ),
    };
  }

  const user = session.user as AuthenticatedUser;
  const institutionId = user.activeInstitutionId;
  const tenantSlug = user.tenantSlug;

  // 1. Isolasi Tenant di URL: jika URL memuat tenant slug yang berbeda dari sesi user, tolak (404)
  if (req && user.tenantSlug) {
    try {
      const url = new URL(req.url);
      const segments = url.pathname.split("/").filter(Boolean);
      const firstSegment = segments[0];
      const nonTenantRoots = ["api", "platform", "dev", "signup", "_next", "uploads", "favicon.ico"];
      if (firstSegment && !nonTenantRoots.includes(firstSegment)) {
        if (firstSegment !== user.tenantSlug) {
          return {
            success: false,
            response: NextResponse.json(
              { error: "TENANT_MISMATCH", message: "Akses lintas tenant ditolak." },
              { status: 404 }
            ),
          };
        }
      }
    } catch {
      // URL parsing fallback
    }
  }

  // 2. Validasi sessionVersion dan status user TERBARU langsung dari DATABASE (melewati RLS konteks tenant)
  let dbUser: { sessionVersion: number; status: string } | null = null;
  try {
    if (institutionId) {
      dbUser = await withTenantTransaction(institutionId, async (tenantDb) =>
        tenantDb.user.findUnique({
          where: { id: user.id },
          select: { sessionVersion: true, status: true },
        })
      );
    }
  } catch (err) {
    // Abaikan jika transaksi gagal
  }

  if (!dbUser) {
    try {
      dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { sessionVersion: true, status: true },
      });
    } catch (err) {
      // Abaikan jika prisma unmocked
    }
  }

  if (!dbUser || dbUser.sessionVersion !== user.sessionVersion) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "SESSION_EXPIRED", message: "Sesi login Anda telah kedaluwarsa karena perubahan keamanan. Silakan login kembali." },
        { status: 401 }
      ),
    };
  }

  // 3. Tolak akun SUSPENDED atau DEACTIVATED dari database
  if (dbUser.status === "SUSPENDED" || dbUser.status === "DEACTIVATED") {
    return {
      success: false,
      response: NextResponse.json(
        { error: "ACCOUNT_INACTIVE", message: "Akun Anda dinonaktifkan atau ditangguhkan." },
        { status: 403 }
      ),
    };
  }

  // 4. Gerbang Onboarding: Akun PENDING_ACTIVATION atau mustChangePassword
  if (
    (dbUser.status === "PENDING_ACTIVATION" || user.mustChangePassword) &&
    !options.allowOnboarding
  ) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: "ONBOARDING_REQUIRED",
          message: "Akun Anda belum aktif. Selesaikan alur onboarding dan aktivasi terlebih dahulu.",
        },
        { status: 403 }
      ),
    };
  }

  // 5. Periksa Status Institusi/Tenant LANGSUNG DARI DATABASE (bukan dari klaim JWT saja)
  if (institutionId) {
    let institutionStatus: string | undefined;
    try {
      const institution = await prisma.institution.findUnique({
        where: { id: institutionId },
        select: { status: true },
      });
      institutionStatus = institution?.status;
    } catch {
      // Fallback
    }

    if (institutionStatus === "SUSPENDED" || institutionStatus === "CANCELED") {
      const isWriteMethod = req && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method.toUpperCase());
      if (isWriteMethod && !options.allowSuspendedTenantWrite) {
        return {
          success: false,
          response: NextResponse.json(
            {
              error: "TENANT_SUSPENDED",
              message: "Institusi Anda sedang dalam status penangguhan (SUSPENDED). Operasi tulis ditolak.",
            },
            { status: 403 }
          ),
        };
      }
    }
  }

  // 6. Penegakan RBAC (Peran Pengguna)
  if (options.requiredRoles && options.requiredRoles.length > 0) {
    if (!options.requiredRoles.includes(user.activeRole)) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: "FORBIDDEN",
            message: "Akses ditolak: Anda tidak memiliki wewenang untuk tindakan ini.",
          },
          { status: 403 }
        ),
      };
    }
  }

  // 7. Penegakan SaaS Feature Entitlement
  if (options.requiredFeature && institutionId) {
    const entitled = await hasFeature(institutionId, options.requiredFeature);
    if (!entitled) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: "FEATURE_NOT_ENTITLED",
            message: `Fitur '${options.requiredFeature}' tidak aktif pada paket langganan institusi Anda.`,
          },
          { status: 403 }
        ),
      };
    }
  }

  return {
    success: true,
    user,
    institutionId,
    tenantSlug,
    role: user.activeRole,
  };
}
