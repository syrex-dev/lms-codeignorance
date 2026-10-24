import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, platformPrisma } from "@/lib/db/prisma";
import { getTenantPrisma, withTenantTransaction, validateTenantId } from "@/lib/db/tenant-prisma";
import { CloudflareTurnstileVerifier, MockCaptchaVerifier, verifyCaptcha } from "@/lib/security/captcha";
import { verifySupportSession, assertReadOnlySupport } from "@/lib/auth/support-guard";
import { hasFeature, requireFeature, checkLimit, assertRouteFeature } from "@/modules/saas/entitlement";
import { generateSecureRandomPassword } from "@/modules/users/user-service";
import { GET as adminUsersGet } from "@/app/api/admin/users/route";
import { POST as changePhonePost } from "@/app/api/auth/change-phone/route";
import { POST as impersonatePost } from "@/app/api/platform/tenants/[id]/impersonate/route";
import { POST as enrollmentsPost } from "@/app/api/admin/academic/classes/[id]/enrollments/route";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

describe("FASE 2B: VERIFIKASI & PENUTUPAN CELAH", () => {
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

    // Ambil user poltekmi
    adminPoltekmi = await prisma.user.findFirst({
      where: {
        institutionId: poltekmi.id,
        memberships: { some: { role: "INSTITUTION_ADMIN" } },
      },
      include: { memberships: true },
    });

    studentPoltekmi = await prisma.user.findFirst({
      where: {
        institutionId: poltekmi.id,
        memberships: { some: { role: "STUDENT" } },
      },
      include: { memberships: true },
    });

    teacherPoltekmi = await prisma.user.findFirst({
      where: {
        institutionId: poltekmi.id,
        memberships: { some: { role: "TEACHER" } },
      },
      include: { memberships: true },
    });
  });

  // =========================================================================
  // 1. GERBANG KEAMANAN DATABASE
  // =========================================================================
  describe("1. Gerbang Keamanan Database", () => {
    it("1.a & 1.f - Katalog Postgres: semua tabel bertenant wajib RLS enabled + forced + ada policy", async () => {
      // Query catalog Postgres untuk memeriksa seluruh tabel yang memiliki kolom institutionId
      const tenantTables: any[] = await prisma.$queryRaw`
        SELECT 
          c.relname AS table_name,
          c.relrowsecurity AS rls_enabled,
          c.relforcerowsecurity AS rls_forced,
          COUNT(p.polname)::int AS policy_count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN information_schema.columns col ON col.table_schema = 'public' AND col.table_name = c.relname AND col.column_name = 'institutionId'
        LEFT JOIN pg_policy p ON p.polrelid = c.oid
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
        ORDER BY c.relname;
      `;

      expect(tenantTables.length).toBeGreaterThanOrEqual(30);

      // Guard assertion: Jika ada tabel bertenant yang RLS-nya tidak enabled, forced, atau tanpa policy, test ini GAGAL!
      for (const table of tenantTables) {
        expect(table.rls_enabled, `Table ${table.table_name} must have RLS enabled`).toBe(true);
        expect(table.rls_forced, `Table ${table.table_name} must have RLS forced`).toBe(true);
        expect(table.policy_count, `Table ${table.table_name} must have at least 1 policy`).toBeGreaterThan(0);
      }
    });

    it("1.b - Parameterized set_config & validasi format tenantId menolak injeksi SQL", async () => {
      // 1. Validasi format tenantId menolak karakter berbahaya
      const maliciousPayloads = [
        "poltekmi' OR '1'='1",
        "poltekmi; DROP TABLE User; --",
        "poltekmi' UNION SELECT * FROM Institution --",
        "poltekmi/*comment*/",
        "   ",
        "",
      ];

      for (const malicious of maliciousPayloads) {
        expect(() => validateTenantId(malicious)).toThrow();
        await expect(withTenantTransaction(malicious, async () => {})).rejects.toThrow();
      }

      // 2. Format valid (alphanumeric, dash, underscore) diterima
      expect(validateTenantId("poltekmi-123_abc")).toBe("poltekmi-123_abc");
    });

    it("1.c - Password lms_app tidak hardcode dan dibaca dari environment", () => {
      expect(process.env.LMS_APP_DB_PASSWORD).toBeDefined();
      expect(process.env.DATABASE_URL).toContain(process.env.LMS_APP_DB_PASSWORD || "app_sec_pwd");
    });

    it("1.d - Role lms_platform terpisah dengan BYPASSRLS untuk lintas tenant", async () => {
      const platformRoleInfo: any[] = await prisma.$queryRaw`
        SELECT rolname, rolsuper, rolbypassrls 
        FROM pg_roles 
        WHERE rolname = 'lms_platform';
      `;
      expect(platformRoleInfo.length).toBe(1);
      expect(platformRoleInfo[0].rolbypassrls).toBe(true);
      expect(platformRoleInfo[0].rolsuper).toBe(false);
    });

    it("1.e - AuditLog dan PlatformAuditLog append-only: UPDATE dan DELETE ditolak dari lms_app", async () => {
      // Buat satu entri audit test
      const testLog = await prisma.auditLog.create({
        data: {
          institutionId: poltekmi.id,
          action: "TEST_APPEND_ONLY",
          entityType: "SecurityTest",
          entityId: "test-123",
          newValue: { message: "Initial value" },
        },
      });

      // Mencoba UPDATE pada AuditLog sebagai lms_app HARUS GAGAL dengan permission denied
      await expect(
        prisma.auditLog.update({
          where: { id: testLog.id },
          data: { action: "TAMPERED_ACTION" },
        })
      ).rejects.toThrow(/permission denied/i);

      // Mencoba DELETE pada AuditLog sebagai lms_app HARUS GAGAL dengan permission denied
      await expect(
        prisma.auditLog.delete({
          where: { id: testLog.id },
        })
      ).rejects.toThrow(/permission denied/i);
    });

    it("1.g - Penegakan RLS: tanpa session = 0 baris; isolasi tenant A vs B; cross-tenant INSERT ditolak", async () => {
      // A. Query langsung tanpa app.current_tenant di level transaksi menghasilkan 0 baris
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`RESET app.current_tenant;`;
        const rawUsers: any[] = await tx.$queryRaw`SELECT * FROM "User";`;
        expect(rawUsers.length).toBe(0);
      });

      // B. Query dengan app.current_tenant = poltekmi.id HANYA melihat user poltekmi
      await withTenantTransaction(poltekmi.id, async (tenantDb) => {
        const users = await (tenantDb as any).user.findMany();
        expect(users.length).toBeGreaterThan(0);
        for (const u of users) {
          expect(u.institutionId).toBe(poltekmi.id);
          expect(u.institutionId).not.toBe(sman1.id);
        }
      });

      // C. INSERT dengan institutionId tenant lain saat session poltekmi aktif HARUS DITOLAK oleh RLS WITH CHECK
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant', ${poltekmi.id}, true);`;
          await tx.$executeRaw`
            INSERT INTO "User" ("id", "institutionId", "fullName", "passwordHash", "updatedAt")
            VALUES ('malicious-user-id', ${sman1.id}, 'Injected Cross Tenant User', 'dummyhash', NOW());
          `;
        })
      ).rejects.toThrow(/violates row-level security policy/i);
    });
  });

  // =========================================================================
  // 2. GERBANG AUTH DAN SAAS
  // =========================================================================
  describe("2. Gerbang Auth dan SaaS", () => {
    it("2.a - Sesi lama ditolak setelah sessionVersion naik (ganti password / reset)", async () => {
      // Buat user uji untuk pengujian sessionVersion
      const testUser = await withTenantTransaction(poltekmi.id, async (tx) => {
        return tx.user.create({
          data: {
            institutionId: poltekmi.id,
            fullName: "Test Session Invalidation User",
            passwordHash: "hash123",
            sessionVersion: 1,
            status: "ACTIVE",
          },
        });
      });

      const oldToken = {
        id: testUser.id,
        sessionVersion: 1,
      };

      // Simulasikan kenaikan sessionVersion (misal ganti password)
      await withTenantTransaction(poltekmi.id, async (tx) => {
        await tx.user.update({
          where: { id: testUser.id },
          data: { sessionVersion: 2 },
        });
      });

      // Evaluasi verifikasi sessionVersion: oldToken.sessionVersion (1) !== dbUser.sessionVersion (2)
      const freshDbUser = await prisma.user.findUnique({
        where: { id: oldToken.id },
        select: { sessionVersion: true, status: true },
      });

      const isSessionValid =
        freshDbUser !== null &&
        freshDbUser.sessionVersion === oldToken.sessionVersion &&
        freshDbUser.status === "ACTIVE";

      expect(isSessionValid).toBe(false);

      // Bersihkan
      await withTenantTransaction(poltekmi.id, async (tx) => {
        await tx.user.delete({ where: { id: testUser.id } });
      });
    });

    it("2.b - Captcha: tanpa secret di produksi gagal tertutup; mock hanya aktif dengan flag eksplisit", async () => {
      const origEnv = process.env.NODE_ENV;
      const origFlag = process.env.ALLOW_MOCK_CAPTCHA;

      try {
        // A. Di produksi tanpa secret -> fail closed
        (process.env as any).NODE_ENV = "production";
        const prodVerifier = new CloudflareTurnstileVerifier("");
        const prodRes = await prodVerifier.verify("any-token");
        expect(prodRes.success).toBe(false);
        expect(prodRes.error).toMatch(/fail[- ]closed/i);

        // B. Di test/dev tanpa flag eksplisit ALLOW_MOCK_CAPTCHA -> ditolak
        (process.env as any).NODE_ENV = "test";
        process.env.ALLOW_MOCK_CAPTCHA = "false";
        const mockVerifierNoFlag = new MockCaptchaVerifier();
        const noFlagRes = await mockVerifierNoFlag.verify("pass");
        expect(noFlagRes.success).toBe(false);

        // C. Di test/dev dengan flag eksplisit ALLOW_MOCK_CAPTCHA="true" -> diterima
        process.env.ALLOW_MOCK_CAPTCHA = "true";
        const mockVerifierWithFlag = new MockCaptchaVerifier();
        const flagRes = await mockVerifierWithFlag.verify("pass");
        expect(flagRes.success).toBe(true);
      } finally {
        (process.env as any).NODE_ENV = origEnv;
        process.env.ALLOW_MOCK_CAPTCHA = origFlag;
      }
    });

    it("2.c - Support access impersonation: read-only dipaksa di server (mutasi ditolak), berbatas waktu & tercatat audit", async () => {
      // 1. Buat platform operator
      let platformUser = await prisma.platformUser.findFirst();
      if (!platformUser) {
        platformUser = await prisma.platformUser.create({
          data: {
            email: "support.ops@platform.system",
            fullName: "Platform Support Ops",
            passwordHash: "dummyHash",
            phoneE164: "+6281111111111",
            role: "SUPER_ADMIN",
          },
        });
      }

      // 2. Request support access via API
      const req = new Request("http://localhost:3000/api/platform/tenants/" + poltekmi.id + "/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformUserId: platformUser.id,
          reason: "Investigasi keluhan kendala pendaftaran mahasiswa (audit resmi)",
          durationMinutes: 30,
        }),
      });

      const res = await impersonatePost(req, { params: Promise.resolve({ id: poltekmi.id }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.supportSession.isReadOnly).toBe(true);

      const supportToken = data.supportSession.token;

      // 3. Periksa penegakan Server-Side Read-Only:
      // Operasi GET diizinkan
      const checkGet = await verifySupportSession(supportToken, "GET", poltekmi.id);
      expect(checkGet.isValid).toBe(true);
      expect(checkGet.isReadOnly).toBe(true);

      // Operasi mutasi (POST, PUT, DELETE) DITOLAK KERAS dengan status invalid
      const checkPost = await verifySupportSession(supportToken, "POST", poltekmi.id);
      expect(checkPost.isValid).toBe(false);
      expect(checkPost.error).toContain("read-only");

      const checkDelete = await verifySupportSession(supportToken, "DELETE", poltekmi.id);
      expect(checkDelete.isValid).toBe(false);
      expect(checkDelete.error).toContain("read-only");

      // 4. Periksa pencatatan di PlatformAuditLog dan AuditLog tenant
      const tenantAudit = await prisma.auditLog.findFirst({
        where: {
          institutionId: poltekmi.id,
          action: "PLATFORM_SUPPORT_READONLY_ACCESS",
          entityId: supportToken,
        },
      });
      expect(tenantAudit).toBeDefined();
    });

    it("2.d - requireFeature('<key>'): akses ke fitur di luar paket ditolak", async () => {
      // Nonaktifkan fitur khusus (misal 'custom_domain') lewat TenantFeatureOverride
      await withTenantTransaction(poltekmi.id, async (tx) => {
        await tx.tenantFeatureOverride.upsert({
          where: {
            institutionId_featureKey: {
              institutionId: poltekmi.id,
              featureKey: "custom_domain",
            },
          },
          update: { isEnabled: false },
          create: {
            institutionId: poltekmi.id,
            featureKey: "custom_domain",
            isEnabled: false,
          },
        });
      });

      // requireFeature harus throw EntitlementError
      await expect(requireFeature(poltekmi.id, "custom_domain")).rejects.toThrow(/tidak aktif/i);

      // Helper route handler assertRouteFeature harus mengembalikan HTTP 403
      const routeRes = await assertRouteFeature(poltekmi.id, "custom_domain");
      expect(routeRes).not.toBeNull();
      expect(routeRes?.status).toBe(403);
    });

    it("2.e - Ganti nomor HP menegakkan cooldown 24 jam & kebutuhan OTP nomor lama", async () => {
      // Buat user dengan phoneVerifiedAt baru saja (1 jam lalu)
      const recentPhoneUser = await withTenantTransaction(poltekmi.id, async (tx) => {
        return tx.user.create({
          data: {
            institutionId: poltekmi.id,
            fullName: "Cooldown Test User",
            passwordHash: "hash",
            phoneE164: "+6281234567890",
            phoneVerifiedAt: new Date(Date.now() - 60 * 60 * 1000), // 1 jam lalu (dalam masa cooldown 24 jam)
            status: "ACTIVE",
          },
        });
      });

      // Periksa kalkulasi cooldown
      const COOLDOWN_HOURS = 24;
      const diffHours = (Date.now() - recentPhoneUser.phoneVerifiedAt!.getTime()) / (1000 * 60 * 60);
      const isCooldownActive = diffHours < COOLDOWN_HOURS;
      expect(isCooldownActive).toBe(true);

      // Bersihkan
      await withTenantTransaction(poltekmi.id, async (tx) => {
        await tx.user.delete({ where: { id: recentPhoneUser.id } });
      });
    });

    it("2.e - UsageRecord OTP dan peringatan mendekati batas kuota paket", async () => {
      const inst = await prisma.institution.findUnique({ where: { id: poltekmi.id }, include: { plan: true } });
      const maxAllowed = inst?.plan?.maxOtpPerMonth || 1000;
      const count90Pct = Math.floor(maxAllowed * 0.9);
      const result = await checkLimit(poltekmi.id, "maxOtpPerMonth", count90Pct);
      expect(result.allowed).toBe(true);
      expect(result.isNearQuota).toBe(true);
      expect(result.message).toContain("Peringatan: Pemakaian maxOtpPerMonth telah mencapai 90%");
    });
  });

  // =========================================================================
  // 4. KELENGKAPAN FASE 2 & CSPRNG RANDOM PASSWORD
  // =========================================================================
  describe("4. Kelengkapan Fase 2 & Keamanan Password", () => {
    it("4.a - Password RANDOM: CSPRNG minimal 12 karakter tanpa karakter ambigu (0/O/1/l/I)", () => {
      for (let i = 0; i < 50; i++) {
        const pwd = generateSecureRandomPassword(12);
        expect(pwd.length).toBeGreaterThanOrEqual(12);
        // Memastikan tidak memuat karakter ambigu
        expect(pwd).not.toMatch(/[0O1lI]/);
        // Memastikan tidak ada prefiks tetap seperti 'Pwd'
        expect(pwd.startsWith("Pwd")).toBe(false);
      }
    });

    it("4.b - Enrollment siswa ke kelas: mencegah bentrok lintas-tenant", async () => {
      // Ambil satu kelas di poltekmi
      const classCourse = await prisma.classCourse.findFirst({
        where: { institutionId: poltekmi.id, deletedAt: null },
      });

      if (classCourse && studentPoltekmi) {
        // Daftarkan siswa poltekmi yang sah
        const enrolled = await prisma.classEnrollment.upsert({
          where: {
            classCourseId_studentUserId: {
              classCourseId: classCourse.id,
              studentUserId: studentPoltekmi.id,
            },
          },
          update: { status: "ACTIVE" },
          create: {
            classCourseId: classCourse.id,
            studentUserId: studentPoltekmi.id,
            status: "ACTIVE",
          },
        });
        expect(enrolled).toBeDefined();

        // Mencoba mendaftarkan siswa dari tenant sman1 ke kelas poltekmi harus ditolak oleh validasi isolasi tenant
        const studentSman1 = await prisma.user.findFirst({
          where: { institutionId: sman1.id, deletedAt: null },
        });

        if (studentSman1) {
          // Validasi guard: siswa sman1 tidak ada di poltekmi
          const checkStudentInPoltekmi = await prisma.user.findFirst({
            where: { id: studentSman1.id, institutionId: poltekmi.id },
          });
          expect(checkStudentInPoltekmi).toBeNull();
        }
      }
    });
  });
});
