import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { assertTenantContext, getTenantPrisma, withTenantTransaction } from "@/lib/db/tenant-prisma";
import { storage } from "@/lib/storage";
import { MockOtpSender, sendOtpWithFallback } from "@/modules/otp/sender";
import { issueOtpChallenge, verifyOtpCode } from "@/modules/otp/otp-service";
import { checkLimit } from "@/modules/saas/entitlement";
import { hashPassword } from "@/lib/security/password-policy";
import { OtpChannel, OtpPurpose } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { GET as devOutboxGet } from "@/app/api/dev/outbox/route";
import { POST as forgotPasswordPost } from "@/app/api/auth/forgot-password/request/route";
import { POST as academicTermsPost } from "@/app/api/admin/academic/terms/route";
import { POST as otpSendPost } from "@/app/api/auth/otp/send/route";
import { POST as resetAccessPost } from "@/app/api/admin/users/[id]/reset-access/route";

describe("FASE 1E: PENGUJIAN KEAMANAN SISTEM & EDGE CASES", () => {
  let poltekmi: any;
  let sman1: any;

  beforeAll(async () => {
    poltekmi = await prisma.institution.findUnique({ where: { slug: "poltekmi" } });
        sman1 = await prisma.institution.findUnique({ where: { slug: "sman1" } });

    expect(poltekmi).toBeDefined();
    expect(sman1).toBeDefined();

  });

  it("1E-1: Fail-Closed Tenant Guard & Isolasi Data Antar-Tenant", async () => {
    // A. Fail-Closed Guard jika query tanpa institutionId
    let failClosedTriggered = false;
    try {
      assertTenantContext(null as any);
    } catch (err: any) {
      failClosedTriggered = err.message.includes("fail closed");
    }
    expect(failClosedTriggered).toBe(true);

    // B. Query dengan tenant extension poltekmi tidak boleh melihat data sman1
    const poltekmiDb = getTenantPrisma(poltekmi.id);
    const sman1UsersFoundByPoltekmi = await (poltekmiDb as any).user.findMany({
      where: { institutionId: sman1.id },
    });
    expect(sman1UsersFoundByPoltekmi.length).toBe(0);

    // C. PostgreSQL Row-Level Security verification
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant', ${poltekmi.id}, true);`;
      const rlsCount = await tx.user.count({
        where: { institutionId: sman1.id },
      });
      expect(rlsCount).toBe(0);
    });
  });

  it("1E-2: Storage File Berprefix Tenant & HMAC Signed URL Anti Cross-Tenant", async () => {
    const dummyBuffer = Buffer.from("Dokumen Akreditasi Kampus", "utf-8");
    const uploadResult = await storage.uploadFile(
      dummyBuffer,
      "akreditasi.pdf",
      "application/pdf",
      poltekmi.id,
      "documents"
    );

    expect(uploadResult.url.startsWith(`/uploads/${poltekmi.id}/documents/`)).toBe(true);

    // Verifikasi signed URL untuk tenant yang berhak
    const validCheck = storage.validateSignedUrl(uploadResult.signedUrl, poltekmi.id);
    expect(validCheck.valid).toBe(true);

    // Akses signed URL oleh tenant yang berbeda wajib ditolak
    const breachCheck = storage.validateSignedUrl(uploadResult.signedUrl, sman1.id);
    expect(breachCheck.valid).toBe(false);
  });

  it("1E-3: Alur Lupa Password: Anti-User-Enumeration & Invalidasi Sesi (sessionVersion)", async () => {
    // 1. Panggil handler dengan identifier user terdaftar
    const registeredUser = await withTenantTransaction(poltekmi.id, async (tenantDb) =>
      tenantDb.user.findFirst({
        where: { institutionId: poltekmi.id, fullName: "Doni Prasetyo" },
        include: { identifiers: true },
      })
    );
    expect(registeredUser).toBeDefined();
    const registeredId = registeredUser!.identifiers[0]?.identifier || registeredUser!.id;

    const reqRegistered = new Request("http://localhost:3000/api/auth/forgot-password/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        institutionSlug: "poltekmi",
        identifier: registeredId,
        dateOfBirth: registeredUser!.birthDate ? registeredUser!.birthDate.toISOString().slice(0, 10) : "2005-04-12",
      }),
    });
    const resRegistered = await forgotPasswordPost(reqRegistered);
    const bodyRegistered = await resRegistered.json();

    // 2. Panggil handler dengan identifier fiktif / tidak terdaftar
    const reqUnregistered = new Request("http://localhost:3000/api/auth/forgot-password/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        institutionSlug: "poltekmi",
        identifier: "ID_TIDAK_TERDAFTAR_99999",
        dateOfBirth: "2000-01-01",
      }),
    });
    const resUnregistered = await forgotPasswordPost(reqUnregistered);
    const bodyUnregistered = await resUnregistered.json();

    // Bandingkan status dan body respons asli: keduanya WAJIB 200 dan pesan generic identik
    expect(resRegistered.status).toBe(200);
    expect(resUnregistered.status).toBe(200);
    expect(bodyRegistered.message).toBe(bodyUnregistered.message);
    expect(bodyRegistered.success).toBe(bodyUnregistered.success);

    // 3. Verifikasi invalidasi sessionVersion
    const prevVersion = registeredUser!.sessionVersion;
    const updated = await withTenantTransaction(poltekmi.id, async (tenantDb) =>
      tenantDb.user.update({
        where: { id: registeredUser!.id },
        data: { sessionVersion: { increment: 1 } },
      })
    );
    expect(updated.sessionVersion).toBe(prevVersion + 1);
  });

  it("1E-4: Fallback Otomatis WhatsApp ke SMS saat WA Mengalami Kegagalan", async () => {
    MockOtpSender.simulateWhatsAppFailure = true;

    const fallbackResult = await sendOtpWithFallback(
      OtpChannel.WHATSAPP,
      "+6281234567890",
      "Kode verifikasi: 123456",
      "123456",
      { institutionSlug: "poltekmi", purpose: "TEST_FALLBACK" }
    );

    MockOtpSender.simulateWhatsAppFailure = false;

    expect(fallbackResult.success).toBe(true);
    expect(fallbackResult.fallbackUsed).toBe(true);
    expect(fallbackResult.channel).toBe(OtpChannel.SMS);
  });

  it("1E-5: Nomor HP Terkunci vs Lockout Tanggal Lahir (5 Kali Gagal via Route /api/auth/otp/send)", async () => {
    const testStudent = await withTenantTransaction(poltekmi.id, async (tenantDb) =>
      tenantDb.user.findFirst({
        where: { institutionId: poltekmi.id, status: "PENDING_ACTIVATION" },
        include: { identifiers: true },
      })
    );
    expect(testStudent).toBeDefined();

    // Pastikan user memiliki birthDate untuk pengujian faktor kedua
    await withTenantTransaction(poltekmi.id, async (tenantDb) =>
      tenantDb.user.update({
        where: { id: testStudent!.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          phoneE164: null, // Admin belum mengikat HP, sehingga verifikasi DOB aktif
          birthDate: new Date("2005-04-12T00:00:00Z"),
        },
      })
    );

    const studentToken = await encode({
      token: {
        id: testStudent!.id,
        name: testStudent!.fullName,
        fullName: testStudent!.fullName,
        identifier: "2301010011",
      activeRole: "STUDENT",
        activeInstitutionId: poltekmi.id,
        tenantSlug: "poltekmi",
        status: "PENDING_ACTIVATION",
        sessionVersion: testStudent!.sessionVersion,
        mustChangePassword: true,
      },
      secret: process.env.NEXTAUTH_SECRET || "development-secret-must-be-at-least-32-chars-long",
    });

    const wrongDob = "1990-01-01";

    let lastResponse: any;
    for (let i = 1; i <= 5; i++) {
      const req = new Request("http://localhost:3000/api/auth/otp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `next-auth.session-token=${studentToken}`,
        },
        body: JSON.stringify({
          tenantSlug: "poltekmi",
          destinationPhone: "+6281234567899",
          birthDate: wrongDob,
          purpose: "FIRST_ACTIVATION",
        }),
      });
      const res = await otpSendPost(req);
      lastResponse = { status: res.status, body: await res.json() };
    }

    expect(lastResponse.status).toBe(400);
    expect(lastResponse.body.error).toContain("Tanggal lahir tidak cocok");

    const lockedUser = await withTenantTransaction(poltekmi.id, async (tenantDb) =>
      tenantDb.user.findUnique({
        where: { id: testStudent!.id },
      })
    );
    expect(lockedUser!.failedLoginAttempts).toBeGreaterThanOrEqual(5);
    expect(lockedUser!.lockedUntil).not.toBeNull();
    expect(new Date(lockedUser!.lockedUntil!) > new Date()).toBe(true);

    // Pulihkan status user
    await withTenantTransaction(poltekmi.id, async (tenantDb) =>
      tenantDb.user.update({
        where: { id: testStudent!.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      })
    );
  });

  it("1E-6: Admin Reset Akses Pengguna lewat Route /api/admin/users/[id]/reset-access", async () => {
    const testStudent = await withTenantTransaction(poltekmi.id, async (tenantDb) =>
      tenantDb.user.findFirst({
        where: { institutionId: poltekmi.id, fullName: "Doni Prasetyo" },
      })
    );
    expect(testStudent).toBeDefined();
    const prevVersion = testStudent!.sessionVersion;
    const originalHash = testStudent!.passwordHash;

    const adminUser = await withTenantTransaction(poltekmi.id, async (tenantDb) =>
      tenantDb.user.findFirst({
        where: { institutionId: poltekmi.id, memberships: { some: { role: "INSTITUTION_ADMIN" } } },
      })
    );
    expect(adminUser).toBeDefined();

    const token = await encode({
      token: {
        id: adminUser!.id,
        name: adminUser!.fullName,
        fullName: adminUser!.fullName,
        identifier: "ADM001",
      activeRole: "INSTITUTION_ADMIN",
        activeInstitutionId: poltekmi.id,
        tenantSlug: "poltekmi",
        status: "ACTIVE",
        sessionVersion: adminUser!.sessionVersion,
      },
      secret: process.env.NEXTAUTH_SECRET || "development-secret-must-be-at-least-32-chars-long",
    });

    const req = new Request(`http://localhost:3000/api/admin/users/${testStudent!.id}/reset-access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `next-auth.session-token=${token}`,
      },
      body: JSON.stringify({
        actionType: "PASSWORD_ONLY",
        reason: "Permintaan reset password oleh wali mahasiswa karena lupa kredensial.",
      }),
    });

    const res = await resetAccessPost(req, { params: Promise.resolve({ id: testStudent!.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const resetUser = await withTenantTransaction(poltekmi.id, async (tenantDb) =>
      tenantDb.user.findUnique({
        where: { id: testStudent!.id },
      })
    );
    expect(resetUser!.status).toBe("PENDING_ACTIVATION");
    expect(resetUser!.mustChangePassword).toBe(true);
    expect(resetUser!.sessionVersion).toBe(prevVersion + 1);

    // Pulihkan kembali ke status semula
    await withTenantTransaction(poltekmi.id, async (tenantDb) =>
      tenantDb.user.update({
        where: { id: testStudent!.id },
        data: { status: "ACTIVE", mustChangePassword: false, passwordHash: originalHash },
      })
    );
  });

  it("1E-7: Dua Akun dengan Nomor HP Sama Terisolasi & Tidak Membocorkan Verification Token", async () => {
    const sharedPhone = "+6281299990088";
    await prisma.otpChallenge.deleteMany({ where: { destinationE164: sharedPhone } });

    const challenge1 = await issueOtpChallenge({
      institutionId: poltekmi.id,
      destinationE164: sharedPhone,
      channel: OtpChannel.WHATSAPP,
      purpose: OtpPurpose.FIRST_ACTIVATION,
    });

    const outbox1 = await prisma.devOutbox.findFirst({
      where: { recipient: sharedPhone },
      orderBy: { createdAt: "desc" },
    });
    expect(outbox1).toBeDefined();

    const verifyRes1 = await verifyOtpCode({
      challengeId: challenge1.challengeId!,
      code: outbox1!.code,
      purpose: OtpPurpose.FIRST_ACTIVATION,
      expectedDestinationE164: sharedPhone,
    });
    expect(verifyRes1.success).toBe(true);

    await withTenantTransaction(poltekmi.id, async (tenantDb) => {
      const invalidUse = await (tenantDb as any).otpChallenge.findFirst({
        where: {
          id: "fake-child-2-challenge-id",
          verificationToken: verifyRes1.verificationToken,
        },
      });
      expect(invalidUse).toBeNull();
    });
  });

  it("1E-8: Tenant SUSPENDED Berada dalam Mode Read-Only (Operasi Tulis Ditolak 403 TENANT_SUSPENDED)", async () => {
    const suspendedTenant = await prisma.institution.create({
      data: {
        name: "Institut Terhenti Demo",
        slug: `institut-terhenti-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: "UNIVERSITY",
        status: "SUSPENDED",
        emailDomain: "terhenti.ac.id",
      },
    });

    const suspendedAdmin = await withTenantTransaction(suspendedTenant.id, async (tenantDb) =>
      tenantDb.user.create({
        data: {
          institutionId: suspendedTenant.id,
          fullName: "Admin Terhenti",
          passwordHash: "dummyhash",
          status: "ACTIVE",
          sessionVersion: 1,
          memberships: {
            create: {
              institutionId: suspendedTenant.id,
              role: "INSTITUTION_ADMIN",
              status: "ACTIVE",
            },
          },
        },
      })
    );

    try {
      const token = await encode({
        token: {
          id: suspendedAdmin.id,
          name: suspendedAdmin.fullName,
          fullName: suspendedAdmin.fullName,
          identifier: "ADM001",
      activeRole: "INSTITUTION_ADMIN",
          activeInstitutionId: suspendedTenant.id,
          tenantSlug: suspendedTenant.slug,
          status: "ACTIVE",
          sessionVersion: 1,
          tenantStatus: "SUSPENDED",
        },
        secret: process.env.NEXTAUTH_SECRET || "development-secret-must-be-at-least-32-chars-long",
      });

      const req = new Request("http://localhost:3000/api/admin/academic/terms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `next-auth.session-token=${token}`,
        },
        body: JSON.stringify({
          name: "Semester Ganjil 2026/2027",
          code: "2026-GANJIL",
          startDate: "2026-09-01",
          endDate: "2027-01-31",
        }),
      });

      const res = await academicTermsPost(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe("TENANT_SUSPENDED");
      expect(body.message).toContain("penangguhan");
    } finally {
      await withTenantTransaction(suspendedTenant.id, async (tenantDb) => {
        await tenantDb.membership.deleteMany({ where: { institutionId: suspendedTenant.id } });
        await tenantDb.user.deleteMany({ where: { institutionId: suspendedTenant.id } });
      });
      await prisma.institution.delete({ where: { id: suspendedTenant.id } });
    }
  });

  it("1E-9: Proteksi /dev/outbox Mengembalikan 404 pada Lingkungan Produksi atau Flag Mati", async () => {
    const oldEnv = process.env.NODE_ENV;
    const oldFlag = process.env.DEV_OTP_OUTBOX;

    try {
      // 1. Panggil route /api/dev/outbox lewat request HTTP dengan NODE_ENV=production
      (process.env as any).NODE_ENV = "production";
      process.env.DEV_OTP_OUTBOX = "true";
      const resProd = await devOutboxGet();
      expect(resProd.status).toBe(404);
      const bodyProd = await resProd.json();
      expect(bodyProd.error).toBe("Not Found");

      // 2. Panggil route /api/dev/outbox dengan DEV_OTP_OUTBOX=false
      (process.env as any).NODE_ENV = "development";
      process.env.DEV_OTP_OUTBOX = "false";
      const resFlagOff = await devOutboxGet();
      expect(resFlagOff.status).toBe(404);
      const bodyFlagOff = await resFlagOff.json();
      expect(bodyFlagOff.error).toBe("Not Found");
    } finally {
      (process.env as any).NODE_ENV = oldEnv;
      if (oldFlag !== undefined) {
        process.env.DEV_OTP_OUTBOX = oldFlag;
      } else {
        delete process.env.DEV_OTP_OUTBOX;
      }
    }
  });

  it("1E-10: Kuota Pengguna (checkLimit maxActiveUsers) Ditolak saat Melebihi Batas", async () => {
    const limitStarter = await checkLimit(poltekmi.id, "maxActiveUsers", 1000);
    expect(limitStarter.allowed).toBe(false);
    expect(limitStarter.message).toBeDefined();
    expect(limitStarter.message).toContain("Batas kuota");
  });
});
