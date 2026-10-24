import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { proxy } from "@/proxy";
import { GET as adminUsersGet } from "@/app/api/admin/users/route";
import { POST as academicTermsPost } from "@/app/api/admin/academic/terms/route";
import { GET as devOutboxGet } from "@/app/api/dev/outbox/route";
import { prisma } from "@/lib/db/prisma";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";
import { encode } from "next-auth/jwt";
import { UserRole } from "@prisma/client";

const SECRET = process.env.NEXTAUTH_SECRET || "development-secret-must-be-at-least-32-chars-long";

/**
 * Pipeline HTTP Terpadu:
 * Request melewati gerbang proxy.ts terlebih dahulu. Jika lolos (next), dilanjutkan ke route handler sungguhan.
 */
async function dispatchHttpRequest(
  req: NextRequest,
  handler?: (req: Request) => Promise<Response>
): Promise<Response> {
  const proxyRes = await proxy(req);

  // Jika proxy memblokir (status >= 400), me-redirect (3xx), atau tidak melanjutkan:
  // kembalikan respons proxy asli
  if (proxyRes.status !== 200 || proxyRes.headers.get("location")) {
    return proxyRes;
  }

  // Jika lolos dan ada handler rute:
  if (handler) {
    return await handler(req);
  }

  return proxyRes;
}

describe("Penegakan Gerbang Keamanan HTTP & RBAC Nyata (proxy.ts + route handler)", () => {
  let poltekmi: any;
  let sman1: any;
  let adminPoltekmi: any;
  let studentPoltekmi: any;
  let teacherPoltekmi: any;

  beforeAll(async () => {
    poltekmi = await prisma.institution.findUnique({ where: { slug: "poltekmi" } });
    sman1 = await prisma.institution.findUnique({ where: { slug: "sman1" } });

    expect(poltekmi).toBeDefined();
    expect(sman1).toBeDefined();

    adminPoltekmi = await withTenantTransaction(poltekmi.id, async (tx) =>
      tx.user.findFirst({
        where: { institutionId: poltekmi.id, memberships: { some: { role: UserRole.INSTITUTION_ADMIN } } },
      })
    );

    studentPoltekmi = await withTenantTransaction(poltekmi.id, async (tx) =>
      tx.user.findFirst({
        where: { institutionId: poltekmi.id, memberships: { some: { role: UserRole.STUDENT } } },
      })
    );
    // Pastikan student aktif untuk pengetesan otorisasi RBAC (bukan terhenti di gerbang onboarding)
    if (studentPoltekmi) {
      await withTenantTransaction(poltekmi.id, async (tx) =>
        tx.user.update({
          where: { id: studentPoltekmi.id },
          data: { status: "ACTIVE", mustChangePassword: false },
        })
      );
      studentPoltekmi.status = "ACTIVE";
      studentPoltekmi.mustChangePassword = false;
    }

    teacherPoltekmi = await withTenantTransaction(poltekmi.id, async (tx) =>
      tx.user.findFirst({
        where: { institutionId: poltekmi.id, memberships: { some: { role: UserRole.TEACHER } } },
      })
    );
    if (teacherPoltekmi && teacherPoltekmi.status !== "ACTIVE") {
      await withTenantTransaction(poltekmi.id, async (tx) =>
        tx.user.update({
          where: { id: teacherPoltekmi.id },
          data: { status: "ACTIVE", mustChangePassword: false },
        })
      );
      teacherPoltekmi.status = "ACTIVE";
      teacherPoltekmi.mustChangePassword = false;
    }
  });

  // Helper membuat cookie JWT NextAuth sungguhan dengan sessionVersion database terkini
  async function makeSessionCookie(user: any, role: UserRole, overrides: Partial<any> = {}) {
    let currentVersion = user.sessionVersion;
    if (overrides.sessionVersion !== undefined) {
      currentVersion = overrides.sessionVersion;
    } else {
      const liveUser = await withTenantTransaction(user.institutionId, async (tx) =>
        tx.user.findUnique({ where: { id: user.id }, select: { sessionVersion: true } })
      );
      if (liveUser) currentVersion = liveUser.sessionVersion;
    }

    const token = await encode({
      token: {
        id: user.id,
        name: user.fullName,
        fullName: user.fullName,
        identifier: (overrides.identifier as string) || "USER001",
        activeRole: role,
        activeInstitutionId: user.institutionId,
        tenantSlug: overrides.tenantSlug || "poltekmi",
        status: overrides.status || user.status,
        sessionVersion: currentVersion,
        mustChangePassword: overrides.mustChangePassword ?? user.mustChangePassword,
        tenantStatus: overrides.tenantStatus || "ACTIVE",
      },
      secret: SECRET,
    });
    return `next-auth.session-token=${token}`;
  }

  // 1. Tanpa sesi aktif -> 401 Unauthorized
  it("1. Panggilan tanpa sesi aktif (Unauthenticated) ke /api/admin/* HARUS 401 Unauthorized", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/users", { method: "GET" });
    const res = await dispatchHttpRequest(req, adminUsersGet);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("UNAUTHORIZED");
  });

  // 2. Koreksi dot-rule: /api/admin/users/abc.def tanpa sesi -> 401 (bukan bypass static)
  it("2. Koreksi dot-rule: GET /api/admin/users/abc.def tanpa sesi HARUS 401 (tidak membocorkan via dot)", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/users/abc.def", { method: "GET" });
    const res = await dispatchHttpRequest(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("UNAUTHORIZED");
  });

  // 3. Isolasi Tenant di URL: Sesi poltekmi membuka /sman1/... ditolak (redirect ke dashboard poltekmi atau 404)
  it("3. Isolasi Tenant URL: Sesi poltekmi membuka /sman1/... ditolak (redirect atau 404)", async () => {
    const cookie = await makeSessionCookie(adminPoltekmi, UserRole.INSTITUTION_ADMIN);

    // A. Pengguna poltekmi membuka halaman /sman1/dashboard
    const pageReq = new NextRequest("http://localhost:3000/sman1/dashboard", {
      headers: { cookie },
    });
    const pageRes = await dispatchHttpRequest(pageReq);
    expect(pageRes.status).toBe(307);
    expect(pageRes.headers.get("location")).toContain("/poltekmi/dashboard");

    // B. Pengguna poltekmi memanggil API lintas tenant /sman1/api/...
    const apiReq = new NextRequest("http://localhost:3000/sman1/api/admin/users", {
      headers: { cookie },
    });
    const apiRes = await dispatchHttpRequest(apiReq);
    expect(apiRes.status).toBe(404);
    const apiBody = await apiRes.json();
    expect(apiBody.error).toBe("TENANT_MISMATCH");
  });

  // 4. Sesi PENDING_ACTIVATION memanggil API non-onboarding -> 403 Forbidden
  it("4. Sesi berstatus PENDING_ACTIVATION memanggil API non-onboarding HARUS 403 ONBOARDING_REQUIRED", async () => {
    // Cari user PENDING_ACTIVATION nyata di database
    const pendingUser = await withTenantTransaction(poltekmi.id, async (tx) =>
      tx.user.findFirst({
        where: { institutionId: poltekmi.id, status: "PENDING_ACTIVATION" },
      })
    );
    expect(pendingUser).toBeDefined();

    const cookie = await makeSessionCookie(pendingUser, UserRole.STUDENT, {
      status: "PENDING_ACTIVATION",
      mustChangePassword: true,
    });

    const req = new NextRequest("http://localhost:3000/api/admin/users", {
      method: "GET",
      headers: { cookie },
    });
    const res = await dispatchHttpRequest(req, adminUsersGet);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("ONBOARDING_REQUIRED");
  });

  // 5. Tenant SUSPENDED melakukan operasi tulis -> 403 TENANT_SUSPENDED (dari DB)
  it("5. Tenant berstatus SUSPENDED melakukan POST ke /api/* HARUS 403 TENANT_SUSPENDED", async () => {
    const suspendedTenant = await prisma.institution.create({
      data: {
        name: "Institut Terhenti HTTP",
        slug: `terhenti-http-${Date.now()}`,
        type: "UNIVERSITY",
        status: "SUSPENDED",
        emailDomain: `terhenti-${Date.now()}.ac.id`,
      },
    });

    const suspendedAdmin = await withTenantTransaction(suspendedTenant.id, async (tx) =>
      tx.user.create({
        data: {
          institutionId: suspendedTenant.id,
          fullName: "Admin Terhenti HTTP",
          passwordHash: "dummyhash",
          status: "ACTIVE",
          sessionVersion: 1,
          memberships: {
            create: {
              institutionId: suspendedTenant.id,
              role: UserRole.INSTITUTION_ADMIN,
              status: "ACTIVE",
            },
          },
        },
      })
    );

    try {
      const cookie = await makeSessionCookie(suspendedAdmin, UserRole.INSTITUTION_ADMIN, {
        tenantSlug: suspendedTenant.slug,
        tenantStatus: "SUSPENDED",
      });

      const req = new NextRequest("http://localhost:3000/api/admin/academic/terms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie,
        },
        body: JSON.stringify({ name: "Semester Baru", code: "SEM-NEW", startDate: "2026-01-01", endDate: "2026-06-30" }),
      });
      const res = await dispatchHttpRequest(req, academicTermsPost);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe("TENANT_SUSPENDED");
    } finally {
      await withTenantTransaction(suspendedTenant.id, async (tx) => {
        await tx.membership.deleteMany({ where: { institutionId: suspendedTenant.id } });
        await tx.user.deleteMany({ where: { institutionId: suspendedTenant.id } });
      });
      await prisma.institution.delete({ where: { id: suspendedTenant.id } });
    }
  });

  // 6. Token lama dengan sessionVersion usang setelah reset password -> 401 SESSION_EXPIRED
  it("6. Token lama dengan sessionVersion usang setelah reset password HARUS ditolak (401 SESSION_EXPIRED)", async () => {
    // Sesi memakai sessionVersion = 9999 (tidak cocok dengan database yang versinya 1)
    const cookie = await makeSessionCookie(adminPoltekmi, UserRole.INSTITUTION_ADMIN, {
      sessionVersion: 9999,
    });

    const req = new NextRequest("http://localhost:3000/api/admin/users", {
      method: "GET",
      headers: { cookie },
    });
    const res = await dispatchHttpRequest(req, adminUsersGet);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("SESSION_EXPIRED");
  });

  // 7. /api/dev/outbox proteksi ketat (404 bila production atau flag DEV_OTP_OUTBOX != true)
  it("7. /api/dev/outbox dan /dev/outbox HARUS 404 pada production atau bila flag DEV_OTP_OUTBOX tidak aktif", async () => {
    const oldEnv = process.env.NODE_ENV;
    const oldFlag = process.env.DEV_OTP_OUTBOX;

    try {
      // Skenario A: Flag false pada development
      (process.env as any).NODE_ENV = "development";
      process.env.DEV_OTP_OUTBOX = "false";
      const reqFlagOff = new NextRequest("http://localhost:3000/api/dev/outbox");
      const resFlagOff = await dispatchHttpRequest(reqFlagOff, devOutboxGet);
      expect(resFlagOff.status).toBe(404);

      // Skenario B: Environment production meskipun flag diset true
      (process.env as any).NODE_ENV = "production";
      process.env.DEV_OTP_OUTBOX = "true";
      const reqProd = new NextRequest("http://localhost:3000/api/dev/outbox");
      const resProd = await dispatchHttpRequest(reqProd, devOutboxGet);
      expect(resProd.status).toBe(404);

      // Skenario C: Development dan flag true -> diizinkan 200
      (process.env as any).NODE_ENV = "development";
      process.env.DEV_OTP_OUTBOX = "true";
      const reqOk = new NextRequest("http://localhost:3000/api/dev/outbox");
      const resOk = await dispatchHttpRequest(reqOk, devOutboxGet);
      expect(resOk.status).toBe(200);
    } finally {
      (process.env as any).NODE_ENV = oldEnv;
      process.env.DEV_OTP_OUTBOX = oldFlag;
    }
  });

  // 8. RBAC HTTP: Sesi GURU memanggil /api/admin/* -> 403 FORBIDDEN
  it("8. Panggilan admin route handler dengan sesi GURU (TEACHER) HARUS 403 Ditolak", async () => {
    const cookie = await makeSessionCookie(teacherPoltekmi, UserRole.TEACHER);

    const req = new NextRequest("http://localhost:3000/api/admin/users", {
      method: "GET",
      headers: { cookie },
    });
    const res = await dispatchHttpRequest(req, adminUsersGet);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("FORBIDDEN");
  });

  // 9. RBAC HTTP: Sesi SISWA memanggil /api/admin/* -> 403 FORBIDDEN
  it("9. Panggilan admin route handler dengan sesi SISWA (STUDENT) HARUS 403 Ditolak", async () => {
    const cookie = await makeSessionCookie(studentPoltekmi, UserRole.STUDENT);

    const req = new NextRequest("http://localhost:3000/api/admin/users", {
      method: "GET",
      headers: { cookie },
    });
    const res = await dispatchHttpRequest(req, adminUsersGet);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("FORBIDDEN");
  });

  // 10. RBAC HTTP: Sesi ADMIN institusi berhak mengakses /api/admin/* -> 200 OK
  it("10. Panggilan admin route handler dengan sesi ADMIN INSTITUSI (INSTITUTION_ADMIN) HARUS 200 OK", async () => {
    const cookie = await makeSessionCookie(adminPoltekmi, UserRole.INSTITUTION_ADMIN);

    const req = new NextRequest("http://localhost:3000/api/admin/users", {
      method: "GET",
      headers: { cookie },
    });
    const res = await dispatchHttpRequest(req, adminUsersGet);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toBeDefined();
    expect(Array.isArray(body.users)).toBe(true);
  });
});
