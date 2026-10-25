import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";

describe("RLS Guard: Fail-Closed Enforce (Koneksi lms_app tanpa tenant context WAJIB 0 baris)", () => {
  let poltekmi: any;

  beforeAll(async () => {
    poltekmi = await prisma.institution.findUniqueOrThrow({ where: { slug: "poltekmi" } });
  });

  it("1. Koneksi langsung lms_app (tanpa set app.current_tenant) mereturn 0 baris pada User", async () => {
    // Reset tenant setting di sesi aktif jika ada
    await prisma.$executeRawUnsafe("SET app.current_tenant = '';");

    const users = await prisma.user.findMany();
    expect(users.length).toBe(0);
  });

  it("2. Koneksi langsung lms_app tanpa context mereturn 0 baris pada ClassCourse", async () => {
    await prisma.$executeRawUnsafe("SET app.current_tenant = '';");
    const classes = await prisma.classCourse.findMany();
    expect(classes.length).toBe(0);
  });

  it("3. Koneksi langsung lms_app tanpa context mereturn 0 baris pada Topic dan Material", async () => {
    await prisma.$executeRawUnsafe("SET app.current_tenant = '';");
    const topics = await prisma.topic.findMany();
    const materials = await prisma.material.findMany();
    expect(topics.length).toBe(0);
    expect(materials.length).toBe(0);
  });

  it("4. Koneksi langsung lms_app tanpa context mereturn 0 baris pada Assignment dan Submission", async () => {
    await prisma.$executeRawUnsafe("SET app.current_tenant = '';");
    const assignments = await prisma.assignment.findMany();
    const submissions = await prisma.submission.findMany();
    expect(assignments.length).toBe(0);
    expect(submissions.length).toBe(0);
  });

  it("5. Koneksi langsung lms_app tanpa context mereturn 0 baris pada AuditLog", async () => {
    await prisma.$executeRawUnsafe("SET app.current_tenant = '';");
    const logs = await prisma.auditLog.findMany();
    expect(logs.length).toBe(0);
  });

  it("6. Percobaan UPDATE atau DELETE tanpa tenant context berefek 0 baris (fail-closed)", async () => {
    await prisma.$executeRawUnsafe("SET app.current_tenant = '';");
    const updated = await prisma.classCourse.updateMany({
      where: { code: "TI302" },
      data: { name: "HACKED NAME" },
    });
    expect(updated.count).toBe(0);

    const deleted = await prisma.material.deleteMany({
      where: { title: "HACKED" },
    });
    expect(deleted.count).toBe(0);
  });

  it("7. Isolasi Lintas Tenant: Tenant A TIDAK BISA membaca atau mengubah data Tenant B", async () => {
    const fakeTenantId = "00000000-0000-0000-0000-000000000000";

    const foreignClasses = await withTenantTransaction(fakeTenantId, async (tx) => {
      return tx.classCourse.findMany({
        where: { institutionId: poltekmi.id },
      });
    });

    expect(foreignClasses.length).toBe(0);
  });

  it("8. Koneksi langsung lms_app tanpa context mereturn 0 baris pada ClassAnnouncement", async () => {
    await prisma.$executeRawUnsafe("SET app.current_tenant = '';");
    const announcements = await prisma.classAnnouncement.findMany();
    expect(announcements.length).toBe(0);
  });

  it("9. Koneksi langsung lms_app tanpa context mereturn 0 baris pada AttendanceSession dan AttendanceRecord", async () => {
    await prisma.$executeRawUnsafe("SET app.current_tenant = '';");
    const sessions = await prisma.attendanceSession.findMany();
    const records = await prisma.attendanceRecord.findMany();
    expect(sessions.length).toBe(0);
    expect(records.length).toBe(0);
  });

  it("10. Koneksi langsung lms_app tanpa context mereturn 0 baris pada Quiz, QuizQuestion, dan QuizAttempt", async () => {
    await prisma.$executeRawUnsafe("SET app.current_tenant = '';");
    const quizzes = await prisma.quiz.findMany();
    const questions = await prisma.quizQuestion.findMany();
    const attempts = await prisma.quizAttempt.findMany();
    expect(quizzes.length).toBe(0);
    expect(questions.length).toBe(0);
    expect(attempts.length).toBe(0);
  });
});
