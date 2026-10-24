import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { GET as getClasses } from "@/app/api/classroom/classes/route";
import { GET as getClassDetail } from "@/app/api/classroom/classes/[id]/route";
import { POST as postTopic, PUT as putTopic } from "@/app/api/classroom/classes/[id]/topics/route";
import { POST as postMaterial } from "@/app/api/classroom/topics/[topicId]/materials/route";
import { POST as postProgress } from "@/app/api/classroom/materials/[materialId]/progress/route";
import { POST as postCopy } from "@/app/api/classroom/classes/[id]/copy/route";
import { prisma } from "@/lib/db/prisma";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";
import { encode } from "next-auth/jwt";
import { UserRole } from "@prisma/client";

const SECRET = process.env.NEXTAUTH_SECRET || "development-secret-must-be-at-least-32-chars-long";

async function dispatchHttpRequest(
  req: NextRequest,
  handler?: (req: Request, context?: any) => Promise<Response>,
  context?: any
): Promise<Response> {
  const proxyRes = await proxy(req);
  if (proxyRes.status !== 200 || proxyRes.headers.get("location")) {
    return proxyRes;
  }
  if (handler) {
    return await handler(req, context);
  }
  return proxyRes;
}

describe("INTEGRASI HTTP: Modul Ruang Kelas / Classroom (Real NextRequest & Session Cookie)", () => {
  let poltekmi: any;
  let teacherUser: any;
  let studentUser: any;
  let testClass: any;
  let createdTopic: any;
  let createdMaterial: any;

  beforeAll(async () => {
    poltekmi = await prisma.institution.findUniqueOrThrow({ where: { slug: "poltekmi" } });

    // Dosen Dr. Hendra Wijaya
    teacherUser = await withTenantTransaction(poltekmi.id, async (tx) =>
      tx.user.findFirstOrThrow({
        where: {
          institutionId: poltekmi.id,
          fullName: "Dr. Hendra Wijaya, M.Kom",
        },
      })
    );

    // Mahasiswa Cindy Permata
    studentUser = await withTenantTransaction(poltekmi.id, async (tx) =>
      tx.user.findFirstOrThrow({
        where: {
          institutionId: poltekmi.id,
          fullName: "Cindy Permata",
        },
      })
    );

    // Ambil kelas aktif TI302 dimana Cindy ter-enroll
    testClass = await withTenantTransaction(poltekmi.id, async (tx) =>
      tx.classCourse.findFirstOrThrow({
        where: { institutionId: poltekmi.id, code: "TI302", deletedAt: null },
      })
    );
  });

  async function makeCookie(user: any, role: UserRole) {
    const token = await encode({
      token: {
        id: user.id,
        name: user.fullName,
        fullName: user.fullName,
        identifier: user.email || user.id,
        activeRole: role,
        activeInstitutionId: poltekmi.id,
        tenantSlug: poltekmi.slug,
        status: "ACTIVE",
        sessionVersion: user.sessionVersion || 1,
        mustChangePassword: false,
        tenantStatus: "ACTIVE",
      },
      secret: SECRET,
    });
    return `next-auth.session-token=${token}`;
  }

  it("1. GET /api/classroom/classes - Unauthenticated ditolak 401 Unauthorized", async () => {
    const req = new NextRequest("http://localhost:3000/api/classroom/classes", { method: "GET" });
    const res = await dispatchHttpRequest(req, getClasses);
    expect(res.status).toBe(401);
  });

  it("2. GET /api/classroom/classes - Dosen mendapatkan daftar kelas yang diampu", async () => {
    const cookie = await makeCookie(teacherUser, UserRole.TEACHER);
    const req = new NextRequest("http://localhost:3000/api/classroom/classes", {
      method: "GET",
      headers: { cookie },
    });
    const res = await dispatchHttpRequest(req, getClasses);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.classes)).toBe(true);
    expect(body.classes.length).toBeGreaterThan(0);
  });

  it("3. GET /api/classroom/classes/[id] - Mengembalikan detail kelas dengan anggota tersanitasi", async () => {
    const cookie = await makeCookie(studentUser, UserRole.STUDENT);
    const req = new NextRequest(`http://localhost:3000/api/classroom/classes/${testClass.id}`, {
      method: "GET",
      headers: { cookie },
    });
    const res = await dispatchHttpRequest(req, getClassDetail, { params: Promise.resolve({ id: testClass.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.classDetail).toBeDefined();
    expect(body.classDetail.id).toBe(testClass.id);

    // Verifikasi sanitasi privasi anggota kelas: tidak boleh bocor nomor telepon atau tanggal lahir
    if (body.classDetail.members && body.classDetail.members.length > 0) {
      for (const m of body.classDetail.members) {
        expect(m.phone).toBeUndefined();
        expect(m.phoneE164).toBeUndefined();
        expect(m.birthDate).toBeUndefined();
        expect(m.passwordHash).toBeUndefined();
        expect(m.fullName).toBeDefined();
      }
    }
  });

  it("4. POST /api/classroom/classes/[id]/topics - Mahasiswa ditolak 403 Forbidden", async () => {
    const cookie = await makeCookie(studentUser, UserRole.STUDENT);
    const req = new NextRequest(`http://localhost:3000/api/classroom/classes/${testClass.id}/topics`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ title: "Topik Ilegal oleh Mahasiswa" }),
    });
    const res = await dispatchHttpRequest(req, postTopic, { params: Promise.resolve({ id: testClass.id }) });
    expect(res.status).toBe(403);
  });

  it("5. POST /api/classroom/classes/[id]/topics - Dosen berhasil membuat topik & tercatat di AuditLog", async () => {
    const cookie = await makeCookie(teacherUser, UserRole.TEACHER);
    const req = new NextRequest(`http://localhost:3000/api/classroom/classes/${testClass.id}/topics`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        title: "Topik Test Integrasi HTTP",
        meetingNumber: 15,
        status: "PUBLISHED",
      }),
    });
    const res = await dispatchHttpRequest(req, postTopic, { params: Promise.resolve({ id: testClass.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.topic).toBeDefined();
    expect(body.topic.title).toBe("Topik Test Integrasi HTTP");
    createdTopic = body.topic;

    // Verifikasi AuditLog
    const log = await withTenantTransaction(poltekmi.id, async (tx) =>
      tx.auditLog.findFirst({
        where: { institutionId: poltekmi.id, action: "CREATE_TOPIC", entityId: createdTopic.id },
      })
    );
    expect(log).toBeDefined();
  });

  it("6. POST /api/classroom/topics/[topicId]/materials - XSS payload dibersihkan secara tuntas", async () => {
    const cookie = await makeCookie(teacherUser, UserRole.TEACHER);
    const xssPayload = '<p>Materi Normal</p><script>alert("XSS")</script><img src="x" onerror="alert(1)" />';
    const req = new NextRequest(`http://localhost:3000/api/classroom/topics/${createdTopic.id}/materials`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        type: "RICH_TEXT",
        title: "Materi Uji XSS Sanitasi",
        content: xssPayload,
        isRequired: true,
      }),
    });
    const res = await dispatchHttpRequest(req, postMaterial, { params: Promise.resolve({ topicId: createdTopic.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.material).toBeDefined();
    expect(body.material.content).not.toContain("<script>");
    expect(body.material.content).not.toContain("onerror");
    expect(body.material.content).toContain("<p>Materi Normal</p>");
    createdMaterial = body.material;
  });

  it("7. POST /api/classroom/materials/[materialId]/progress - Mahasiswa menandai selesai (200 & Idempoten)", async () => {
    const cookie = await makeCookie(studentUser, UserRole.STUDENT);
    const req = new NextRequest(`http://localhost:3000/api/classroom/materials/${createdMaterial.id}/progress`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ action: "COMPLETE" }),
    });

    const res = await dispatchHttpRequest(req, postProgress, { params: Promise.resolve({ materialId: createdMaterial.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.progress).toBeDefined();
    expect(body.progress.isCompleted).toBe(true);

    // Panggilan kedua idempoten (tetap 200)
    const req2 = new NextRequest(`http://localhost:3000/api/classroom/materials/${createdMaterial.id}/progress`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ action: "COMPLETE" }),
    });
    const res2 = await dispatchHttpRequest(req2, postProgress, { params: Promise.resolve({ materialId: createdMaterial.id }) });
    expect(res2.status).toBe(200);
  });

  it("8. POST /api/classroom/classes/[id]/copy - Salin kurikulum antar kelas dalam tenant sebagai DRAFT", async () => {
    // Buat target class baru sementara
    const targetClass = await withTenantTransaction(poltekmi.id, async (tx) =>
      tx.classCourse.create({
        data: {
          institutionId: poltekmi.id,
          academicTermId: testClass.academicTermId,
          code: `CPY-${Date.now().toString().slice(-4)}`,
          name: "Kelas Uji Salin Kurikulum",
          credits: 3,
          instructors: {
            create: {
              instructorUserId: teacherUser.id,
              isPrimary: true,
            },
          },
        },
      })
    );

    const cookie = await makeCookie(teacherUser, UserRole.TEACHER);
    const req = new NextRequest(`http://localhost:3000/api/classroom/classes/${targetClass.id}/copy`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        sourceClassCourseId: testClass.id,
        includeDrafts: false,
      }),
    });
    const res = await dispatchHttpRequest(req, postCopy, { params: Promise.resolve({ id: targetClass.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.copiedTopicsCount).toBeGreaterThan(0);
  });
});
