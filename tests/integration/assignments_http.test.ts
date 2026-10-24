import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { GET as getAssignments, POST as postAssignment } from "@/app/api/classroom/classes/[id]/assignments/route";
import { POST as submitAssignment } from "@/app/api/classroom/assignments/[assignmentId]/submit/route";
import { POST as gradeSubmission } from "@/app/api/classroom/submissions/[submissionId]/grade/route";
import { GET as getAggregatedAssignments } from "@/app/api/classroom/assignments/route";
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

describe("INTEGRASI HTTP: Modul Tugas & Penilaian (Assignment Lifecycle & RBAC)", () => {
  let poltekmi: any;
  let teacherUser: any;
  let studentUser: any;
  let testClass: any;
  let createdAssignment: any;
  let createdSubmission: any;

  beforeAll(async () => {
    poltekmi = await prisma.institution.findUniqueOrThrow({ where: { slug: "poltekmi" } });

    teacherUser = await withTenantTransaction(poltekmi.id, async (tx) =>
      tx.user.findFirstOrThrow({
        where: {
          institutionId: poltekmi.id,
          fullName: "Dr. Hendra Wijaya, M.Kom",
        },
      })
    );

    studentUser = await withTenantTransaction(poltekmi.id, async (tx) =>
      tx.user.findFirstOrThrow({
        where: {
          institutionId: poltekmi.id,
          fullName: "Cindy Permata",
        },
      })
    );

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

  it("1. POST /api/classroom/classes/[id]/assignments - Mahasiswa ditolak 403 Forbidden", async () => {
    const cookie = await makeCookie(studentUser, UserRole.STUDENT);
    const req = new NextRequest(`http://localhost:3000/api/classroom/classes/${testClass.id}/assignments`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        title: "Tugas Ilegal Mahasiswa",
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      }),
    });

    const res = await dispatchHttpRequest(req, postAssignment, { params: Promise.resolve({ id: testClass.id }) });
    expect(res.status).toBe(403);
  });

  it("2. POST /api/classroom/classes/[id]/assignments - Dosen berhasil membuat tugas baru & AuditLog tercatat", async () => {
    const cookie = await makeCookie(teacherUser, UserRole.TEACHER);
    const dueDate = new Date(Date.now() + 7 * 86400000).toISOString();

    const req = new NextRequest(`http://localhost:3000/api/classroom/classes/${testClass.id}/assignments`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        title: "Tugas 1: Analisis Kebutuhan Sistem LMS",
        instructions: "<p>Buat dokumen SRS sesuai format standar.</p>",
        dueDate,
        maxScore: 100,
        allowLateSubmission: false,
      }),
    });

    const res = await dispatchHttpRequest(req, postAssignment, { params: Promise.resolve({ id: testClass.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.assignment).toBeDefined();
    expect(body.assignment.title).toBe("Tugas 1: Analisis Kebutuhan Sistem LMS");
    createdAssignment = body.assignment;

    // Verifikasi AuditLog
    const log = await withTenantTransaction(poltekmi.id, async (tx) =>
      tx.auditLog.findFirst({
        where: { institutionId: poltekmi.id, action: "CREATE_ASSIGNMENT", entityId: createdAssignment.id },
      })
    );
    expect(log).toBeDefined();
  });

  it("3. GET /api/classroom/classes/[id]/assignments - Mengembalikan daftar tugas kelas", async () => {
    const cookie = await makeCookie(studentUser, UserRole.STUDENT);
    const req = new NextRequest(`http://localhost:3000/api/classroom/classes/${testClass.id}/assignments`, {
      method: "GET",
      headers: { cookie },
    });

    const res = await dispatchHttpRequest(req, getAssignments, { params: Promise.resolve({ id: testClass.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.assignments)).toBe(true);
    expect(body.assignments.some((a: any) => a.id === createdAssignment.id)).toBe(true);
  });

  it("4. POST /api/classroom/assignments/[id]/submit - Mahasiswa mengumpulkan jawaban tugas", async () => {
    const cookie = await makeCookie(studentUser, UserRole.STUDENT);
    const req = new NextRequest(`http://localhost:3000/api/classroom/assignments/${createdAssignment.id}/submit`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        textContent: "Jawaban analisis kebutuhan sistem kelompok 1.",
        fileUrl: "https://example.com/docs/srs-lms.pdf",
        fileName: "srs-lms.pdf",
        fileSize: 102450,
      }),
    });

    const res = await dispatchHttpRequest(req, submitAssignment, { params: Promise.resolve({ assignmentId: createdAssignment.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.submission).toBeDefined();
    expect(body.submission.status).toBe("SUBMITTED");
    expect(body.submission.studentUserId).toBe(studentUser.id);
    createdSubmission = body.submission;
  });

  it("5. POST /api/classroom/submissions/[id]/grade - Mahasiswa DITOLAK menilai tugas sendiri 403", async () => {
    const cookie = await makeCookie(studentUser, UserRole.STUDENT);
    const req = new NextRequest(`http://localhost:3000/api/classroom/submissions/${createdSubmission.id}/grade`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ score: 100, feedback: "Nilai sendiri sempurna" }),
    });

    const res = await dispatchHttpRequest(req, gradeSubmission, { params: Promise.resolve({ submissionId: createdSubmission.id }) });
    expect(res.status).toBe(403);
  });

  it("6. POST /api/classroom/submissions/[id]/grade - Dosen berhasil memberi nilai 95 dan umpan balik", async () => {
    const cookie = await makeCookie(teacherUser, UserRole.TEACHER);
    const req = new NextRequest(`http://localhost:3000/api/classroom/submissions/${createdSubmission.id}/grade`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        score: 95,
        feedback: "Analisis sangat komprehensif, diagram use case lengkap.",
      }),
    });

    const res = await dispatchHttpRequest(req, gradeSubmission, { params: Promise.resolve({ submissionId: createdSubmission.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.submission.score).toBe(95);
    expect(body.submission.status).toBe("GRADED");
    expect(body.submission.feedback).toContain("Analisis sangat komprehensif");

    // Verifikasi AuditLog
    const log = await withTenantTransaction(poltekmi.id, async (tx) =>
      tx.auditLog.findFirst({
        where: { institutionId: poltekmi.id, action: "GRADE_SUBMISSION", entityId: createdSubmission.id },
      })
    );
    expect(log).toBeDefined();
  });

  it("7. GET /api/classroom/assignments - Mahasiswa melihat rekap tugas lintas kelas beserta nilainya", async () => {
    const cookie = await makeCookie(studentUser, UserRole.STUDENT);
    const req = new NextRequest("http://localhost:3000/api/classroom/assignments", {
      method: "GET",
      headers: { cookie },
    });

    const res = await dispatchHttpRequest(req, getAggregatedAssignments);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.assignments)).toBe(true);
    const found = body.assignments.find((a: any) => a.id === createdAssignment.id);
    expect(found).toBeDefined();
    expect(found.mySubmission?.score).toBe(95);
    expect(found.mySubmission?.status).toBe("GRADED");
  });
});
