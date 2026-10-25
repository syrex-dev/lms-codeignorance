import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { GET as getSettings, PUT as putSettings } from "@/app/api/admin/settings/route";
import { GET as getTerms } from "@/app/api/admin/academic/terms/route";
import { GET as getDepartments } from "@/app/api/admin/academic/departments/route";
import { GET as getClasses } from "@/app/api/admin/academic/classes/route";
import { prisma } from "@/lib/db/prisma";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";
import { encode } from "next-auth/jwt";
import { UserRole } from "@prisma/client";

const SECRET = process.env.NEXTAUTH_SECRET || "development-secret-must-be-at-least-32-chars-long";

async function dispatchHttpRequest(
  req: NextRequest,
  handler?: (req: Request) => Promise<Response>
): Promise<Response> {
  const proxyRes = await proxy(req);
  if (proxyRes.status !== 200 || proxyRes.headers.get("location")) {
    return proxyRes;
  }
  if (handler) {
    return await handler(req);
  }
  return proxyRes;
}

describe("INTEGRASI HTTP: Admin Settings & Manajemen Akademik (Real Auth Token)", () => {
  let poltekmi: any;
  let adminPoltekmi: any;

  beforeAll(async () => {
    poltekmi = await prisma.institution.findUniqueOrThrow({
      where: { slug: "poltekmi" },
    });

    adminPoltekmi = await withTenantTransaction(poltekmi.id, async (tx) =>
      tx.user.findFirstOrThrow({
        where: {
          institutionId: poltekmi.id,
          memberships: { some: { role: UserRole.INSTITUTION_ADMIN } },
        },
      })
    );

    if (adminPoltekmi.status !== "ACTIVE") {
      await withTenantTransaction(poltekmi.id, async (tx) =>
        tx.user.update({
          where: { id: adminPoltekmi.id },
          data: { status: "ACTIVE", mustChangePassword: false },
        })
      );
      adminPoltekmi.status = "ACTIVE";
      adminPoltekmi.mustChangePassword = false;
    }
  });

  async function makeAdminCookie() {
    const token = await encode({
      token: {
        id: adminPoltekmi.id,
        name: adminPoltekmi.fullName,
        fullName: adminPoltekmi.fullName,
        identifier: "ADM001",
        activeRole: UserRole.INSTITUTION_ADMIN,
        activeInstitutionId: poltekmi.id,
        tenantSlug: poltekmi.slug,
        status: "ACTIVE",
        sessionVersion: adminPoltekmi.sessionVersion || 1,
        mustChangePassword: false,
        tenantStatus: "ACTIVE",
      },
      secret: SECRET,
    });
    return `next-auth.session-token=${token}`;
  }

  it("1. GET /api/admin/settings - unauthenticated ditolak 401 Unauthorized", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/settings", { method: "GET" });
    const res = await dispatchHttpRequest(req, getSettings);
    expect(res.status).toBe(401);
  });

  it("2. GET /api/admin/settings - sukses 200 mengembalikan data pengaturan institusi", async () => {
    const cookie = await makeAdminCookie();
    const req = new NextRequest("http://localhost:3000/api/admin/settings", {
      method: "GET",
      headers: { cookie },
    });

    const res = await dispatchHttpRequest(req, getSettings);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settings).toBeDefined();
    expect(body.settings.name).toBe(poltekmi.name);
    expect(body.settings.emailDomain).toBe(poltekmi.emailDomain);
  });

  it("3. PUT /api/admin/settings - ditolak 400 jika kontras warna di bawah 4.5:1 (WCAG AA)", async () => {
    const cookie = await makeAdminCookie();
    const req = new NextRequest("http://localhost:3000/api/admin/settings", {
      method: "PUT",
      headers: {
        cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: poltekmi.name,
        themeColor: "#FFFF00", // Kuning terang pada putih rasio kontras sangat rendah (< 1.5:1)
      }),
    });

    const res = await dispatchHttpRequest(req, putSettings);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("WCAG AA");
  });

  it("4. PUT /api/admin/settings - sukses 200 dengan warna kontras tinggi dan tercatat di AuditLog", async () => {
    const cookie = await makeAdminCookie();
    const req = new NextRequest("http://localhost:3000/api/admin/settings", {
      method: "PUT",
      headers: {
        cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: poltekmi.name,
        themeColor: "#1E40AF",
        contactPhone: "+6281299998888",
        address: "Jl. Pendidikan No. 45, Bandung",
      }),
    });

    const res = await dispatchHttpRequest(req, putSettings);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settings).toBeDefined();
    expect(body.settings.themeColor).toBe("#1E40AF");

    // Verifikasi AuditLog tercatat
    const latestLog = await withTenantTransaction(poltekmi.id, async (tx) =>
      tx.auditLog.findFirst({
        where: {
          institutionId: poltekmi.id,
          action: "UPDATE_INSTITUTION_SETTINGS",
        },
        orderBy: { createdAt: "desc" },
      })
    );
    expect(latestLog).toBeDefined();
    expect(latestLog?.userId).toBe(adminPoltekmi.id);
  });

  it("5. GET /api/admin/academic/terms - sukses 200 mengembalikan daftar semester", async () => {
    const cookie = await makeAdminCookie();
    const req = new NextRequest("http://localhost:3000/api/admin/academic/terms", {
      method: "GET",
      headers: { cookie },
    });

    const res = await dispatchHttpRequest(req, getTerms);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.terms)).toBe(true);
    expect(body.terms.length).toBeGreaterThan(0);
  });

  it("6. GET /api/admin/academic/departments - sukses 200 mengembalikan departemen/prodi", async () => {
    const cookie = await makeAdminCookie();
    const req = new NextRequest("http://localhost:3000/api/admin/academic/departments", {
      method: "GET",
      headers: { cookie },
    });

    const res = await dispatchHttpRequest(req, getDepartments);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.departments)).toBe(true);
  });

  it("7. GET /api/admin/academic/classes - sukses 200 mengembalikan daftar kelas perkuliahan", async () => {
    const cookie = await makeAdminCookie();
    const req = new NextRequest("http://localhost:3000/api/admin/academic/classes", {
      method: "GET",
      headers: { cookie },
    });

    const res = await dispatchHttpRequest(req, getClasses);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.classes)).toBe(true);
    expect(body.classes.length).toBeGreaterThan(0);
  });

  afterAll(async () => {
    await prisma.institution.update({
      where: { slug: "poltekmi" },
      data: {
        name: "Politeknik Mitra Indonesia",
        themeColor: "#1E40AF",
      },
    });
  });
});
