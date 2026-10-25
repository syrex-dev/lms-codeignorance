import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

// Announcement routes
import { GET as getAnnouncements, POST as postAnnouncement } from "@/app/api/classroom/classes/[id]/announcements/route";
import { DELETE as deleteAnnouncement } from "@/app/api/classroom/announcements/[announcementId]/route";

// Attendance routes
import { GET as getAttendance, POST as postAttendance } from "@/app/api/classroom/classes/[id]/attendance/route";
import { PUT as putAttendance } from "@/app/api/classroom/attendance/[sessionId]/route";
import { POST as checkInAttendance } from "@/app/api/classroom/attendance/[sessionId]/check-in/route";

// Quiz routes
import { GET as getQuizzes, POST as postQuiz } from "@/app/api/classroom/classes/[id]/quizzes/route";
import { POST as attemptQuiz } from "@/app/api/classroom/quizzes/[quizId]/attempt/route";

// Gradebook routes
import { GET as getGradebook } from "@/app/api/classroom/classes/[id]/gradebook/route";
import { GET as getStudentGrades } from "@/app/api/classroom/grades/route";

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

describe("INTEGRASI HTTP: Fitur Akademik Inti LMS (Pengumuman, Presensi, Kuis & Buku Nilai)", () => {
  let poltekmi: any;
  let teacherUser: any;
  let studentUser: any;
  let testClass: any;

  let createdAnnouncementId: string;
  let createdAttendanceSessionId: string;
  let createdQuizId: string;

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

    // Bersihkan data presensi, kuis, dan pengumuman lama pada testClass agar pengujian idempotent
    await withTenantTransaction(poltekmi.id, async (tx) => {
      await tx.attendanceRecord.deleteMany({
        where: { session: { classCourseId: testClass.id } },
      });
      await tx.attendanceSession.deleteMany({
        where: { classCourseId: testClass.id },
      });
      await tx.quizAttempt.deleteMany({
        where: { quiz: { classCourseId: testClass.id } },
      });
      await tx.quizQuestion.deleteMany({
        where: { quiz: { classCourseId: testClass.id } },
      });
      await tx.quiz.deleteMany({
        where: { classCourseId: testClass.id },
      });
      await tx.classAnnouncement.deleteMany({
        where: { classCourseId: testClass.id },
      });
    });

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

  // -------------------------------------------------------------
  // 1. PENGUMUMAN KELAS
  // -------------------------------------------------------------
  it("1.1 POST /announcements - Mahasiswa ditolak membuat pengumuman (403)", async () => {
    const cookie = await makeCookie(studentUser, UserRole.STUDENT);
    const req = new NextRequest(`http://localhost:3000/api/classroom/classes/${testClass.id}/announcements`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        title: "Pengumuman Palsu",
        content: "<p>Tidak boleh</p>",
      }),
    });

    const res = await dispatchHttpRequest(req, postAnnouncement, { params: Promise.resolve({ id: testClass.id }) });
    expect(res.status).toBe(403);
  });

  it("1.2 POST /announcements - Dosen berhasil membuat pengumuman disematkan", async () => {
    const cookie = await makeCookie(teacherUser, UserRole.TEACHER);
    const req = new NextRequest(`http://localhost:3000/api/classroom/classes/${testClass.id}/announcements`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        title: "Jadwal Praktikum Minggu Ini",
        content: "<p>Praktikum diadakan di Lab Komputer 2 pukul 09:00 WIB.</p>",
        isPinned: true,
      }),
    });

    const res = await dispatchHttpRequest(req, postAnnouncement, { params: Promise.resolve({ id: testClass.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.announcement).toBeDefined();
    expect(body.announcement.title).toBe("Jadwal Praktikum Minggu Ini");
    expect(body.announcement.isPinned).toBe(true);
    createdAnnouncementId = body.announcement.id;
  });

  it("1.3 GET /announcements - Mahasiswa dapat membaca pengumuman kelas", async () => {
    const cookie = await makeCookie(studentUser, UserRole.STUDENT);
    const req = new NextRequest(`http://localhost:3000/api/classroom/classes/${testClass.id}/announcements`, {
      method: "GET",
      headers: { cookie },
    });

    const res = await dispatchHttpRequest(req, getAnnouncements, { params: Promise.resolve({ id: testClass.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.announcements).toBeInstanceOf(Array);
    const found = body.announcements.find((a: any) => a.id === createdAnnouncementId);
    expect(found).toBeDefined();
    expect(found.author.fullName).toBe("Dr. Hendra Wijaya, M.Kom");
  });

  // -------------------------------------------------------------
  // 2. PRESENSI PERKULIAHAN
  // -------------------------------------------------------------
  it("2.1 POST /attendance - Dosen membuka sesi presensi pertemuan dengan kode akses", async () => {
    const cookie = await makeCookie(teacherUser, UserRole.TEACHER);
    const req = new NextRequest(`http://localhost:3000/api/classroom/classes/${testClass.id}/attendance`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        meetingNumber: 1,
        title: "Pertemuan 1: Pengantar Rekayasa Perangkat Lunak",
        accessCode: "HADIR1",
      }),
    });

    const res = await dispatchHttpRequest(req, postAttendance, { params: Promise.resolve({ id: testClass.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session).toBeDefined();
    expect(body.session.status).toBe("OPEN");
    expect(body.session.accessCode).toBe("HADIR1");
    createdAttendanceSessionId = body.session.id;
  });

  it("2.2 POST /attendance/[sessionId]/check-in - Mahasiswa salah kode ditolak", async () => {
    const cookie = await makeCookie(studentUser, UserRole.STUDENT);
    const req = new NextRequest(`http://localhost:3000/api/classroom/attendance/${createdAttendanceSessionId}/check-in`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ accessCode: "SALAH9" }),
    });

    const res = await dispatchHttpRequest(req, checkInAttendance, {
      params: Promise.resolve({ sessionId: createdAttendanceSessionId }),
    });
    expect(res.status).toBe(400);
  });

  it("2.3 POST /attendance/[sessionId]/check-in - Mahasiswa presensi dengan kode yang benar berhasil", async () => {
    const cookie = await makeCookie(studentUser, UserRole.STUDENT);
    const req = new NextRequest(`http://localhost:3000/api/classroom/attendance/${createdAttendanceSessionId}/check-in`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ accessCode: "HADIR1" }),
    });

    const res = await dispatchHttpRequest(req, checkInAttendance, {
      params: Promise.resolve({ sessionId: createdAttendanceSessionId }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.record.status).toBe("PRESENT");
  });

  it("2.4 GET /attendance - Dosen membaca rekap presensi dan persentase kehadiran", async () => {
    const cookie = await makeCookie(teacherUser, UserRole.TEACHER);
    const req = new NextRequest(`http://localhost:3000/api/classroom/classes/${testClass.id}/attendance`, {
      method: "GET",
      headers: { cookie },
    });

    const res = await dispatchHttpRequest(req, getAttendance, { params: Promise.resolve({ id: testClass.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions.length).toBeGreaterThanOrEqual(1);
    const cindyRecap = body.studentRecap.find((s: any) => s.id === studentUser.id);
    expect(cindyRecap).toBeDefined();
    expect(cindyRecap.presentCount).toBe(1);
    expect(cindyRecap.attendancePercentage).toBe(100);
  });

  // -------------------------------------------------------------
  // 3. KUIS & EVALUASI OTOMATIS
  // -------------------------------------------------------------
  it("3.1 POST /quizzes - Dosen membuat kuis pilihan ganda", async () => {
    const cookie = await makeCookie(teacherUser, UserRole.TEACHER);
    const req = new NextRequest(`http://localhost:3000/api/classroom/classes/${testClass.id}/quizzes`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        title: "Kuis 1: Konsep Dasar Agile & Scrum",
        description: "Jawablah soal pilihan ganda berikut dengan tepat.",
        durationMinutes: 15,
        passingScore: 60,
        status: "PUBLISHED",
        questions: [
          {
            questionText: "Berapa durasi sprint standar dalam Scrum?",
            options: ["1-4 minggu", "6 bulan", "1 tahun", "1 hari"],
            correctOptionIndex: 0,
            points: 50,
          },
          {
            questionText: "Siapa yang bertanggung jawab memaksimalkan nilai produk?",
            options: ["Scrum Master", "Product Owner", "Developer", "Tester"],
            correctOptionIndex: 1,
            points: 50,
          },
        ],
      }),
    });

    const res = await dispatchHttpRequest(req, postQuiz, { params: Promise.resolve({ id: testClass.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quiz).toBeDefined();
    expect(body.quiz.questions.length).toBe(2);
    createdQuizId = body.quiz.id;
  });

  it("3.2 GET /quizzes - Mahasiswa membaca soal tanpa kebocoran kunci jawaban (correctOptionIndex hidden)", async () => {
    const cookie = await makeCookie(studentUser, UserRole.STUDENT);
    const req = new NextRequest(`http://localhost:3000/api/classroom/classes/${testClass.id}/quizzes`, {
      method: "GET",
      headers: { cookie },
    });

    const res = await dispatchHttpRequest(req, getQuizzes, { params: Promise.resolve({ id: testClass.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    const quiz = body.quizzes.find((q: any) => q.id === createdQuizId);
    expect(quiz).toBeDefined();
    // Verifikasi kunci jawaban disembunyikan untuk mahasiswa sebelum submit!
    expect(quiz.questions[0].correctOptionIndex).toBeUndefined();
    expect(quiz.questions[1].correctOptionIndex).toBeUndefined();
  });

  it("3.3 POST /quizzes/[quizId]/attempt - Mahasiswa submit jawaban & server mengkalkulasi skor akurat", async () => {
    const cookie = await makeCookie(studentUser, UserRole.STUDENT);
    // Ambil quiz questions untuk mendapatkan id pertanyaan
    const qRes = await withTenantTransaction(poltekmi.id, async (tx) =>
      tx.quiz.findUniqueOrThrow({
        where: { id: createdQuizId },
        include: { questions: { orderBy: { orderIndex: "asc" } } },
      })
    );

    const q1Id = qRes.questions[0].id;
    const q2Id = qRes.questions[1].id;

    // Jawab: Q1 benar (index 0), Q2 salah (index 0 padahal benar index 1) -> Total skor 50
    const answers = {
      [q1Id]: 0,
      [q2Id]: 0,
    };

    const req = new NextRequest(`http://localhost:3000/api/classroom/quizzes/${createdQuizId}/attempt`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ answers }),
    });

    const res = await dispatchHttpRequest(req, attemptQuiz, {
      params: Promise.resolve({ quizId: createdQuizId }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.score).toBe(50);
    expect(body.isPassed).toBe(false); // passingScore 60
  });

  // -------------------------------------------------------------
  // 4. BUKU NILAI & TRANSKRIP
  // -------------------------------------------------------------
  it("4.1 GET /gradebook - Dosen melihat rekap nilai kelas terintegrasi", async () => {
    const cookie = await makeCookie(teacherUser, UserRole.TEACHER);
    const req = new NextRequest(`http://localhost:3000/api/classroom/classes/${testClass.id}/gradebook`, {
      method: "GET",
      headers: { cookie },
    });

    const res = await dispatchHttpRequest(req, getGradebook, { params: Promise.resolve({ id: testClass.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.className).toBeDefined();
    expect(body.studentGrades).toBeInstanceOf(Array);
    const cindyGrade = body.studentGrades.find((g: any) => g.studentId === studentUser.id);
    expect(cindyGrade).toBeDefined();
    expect(cindyGrade.quizAverage).toBe(50);
    expect(cindyGrade.attendancePercentage).toBe(100);
    expect(cindyGrade.finalScore).toBeGreaterThan(0);
    expect(cindyGrade.letterGrade).toBeDefined();
  });

  it("4.2 GET /grades - Mahasiswa melihat rekap nilai seluruh kelas yang diikutinya", async () => {
    const cookie = await makeCookie(studentUser, UserRole.STUDENT);
    const req = new NextRequest(`http://localhost:3000/api/classroom/grades`, {
      method: "GET",
      headers: { cookie },
    });

    const res = await dispatchHttpRequest(req, getStudentGrades);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.courses).toBeInstanceOf(Array);
    const ti302 = body.courses.find((c: any) => c.code === "TI302");
    expect(ti302).toBeDefined();
    expect(ti302.quizAverage).toBe(50);
    expect(ti302.attendancePercentage).toBe(100);
  });

  afterAll(async () => {
    if (poltekmi && testClass) {
      await withTenantTransaction(poltekmi.id, async (tx) => {
        await tx.attendanceRecord.deleteMany({
          where: { session: { classCourseId: testClass.id } },
        });
        await tx.attendanceSession.deleteMany({
          where: { classCourseId: testClass.id },
        });
        await tx.quizAttempt.deleteMany({
          where: { quiz: { classCourseId: testClass.id } },
        });
        await tx.quizQuestion.deleteMany({
          where: { quiz: { classCourseId: testClass.id } },
        });
        await tx.quiz.deleteMany({
          where: { classCourseId: testClass.id },
        });
        await tx.classAnnouncement.deleteMany({
          where: { classCourseId: testClass.id },
        });
      });
    }
  });

});