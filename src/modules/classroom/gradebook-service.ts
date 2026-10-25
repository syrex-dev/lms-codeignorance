import { withTenantTransaction } from "@/lib/db/tenant-prisma";

export function calculateLetterGrade(score: number): string {
  if (score >= 85) return "A";
  if (score >= 75) return "AB";
  if (score >= 65) return "B";
  if (score >= 60) return "BC";
  if (score >= 50) return "C";
  if (score >= 40) return "D";
  return "E";
}

export async function getClassGradebook({
  institutionId,
  classCourseId,
  userId,
  role,
}: {
  institutionId: string;
  classCourseId: string;
  userId: string;
  role: string;
}) {
  return withTenantTransaction(institutionId, async (tx) => {
    const classCourse = await tx.classCourse.findUnique({
      where: { id: classCourseId },
      include: {
        enrollments: {
          where: { status: "ACTIVE" },
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                identifiers: {
                  select: { value: true, isPrimary: true },
                },
              },
            },
          },
        },
        assignments: {
          include: {
            submissions: true,
          },
        },
        quizzes: {
          include: {
            attempts: true,
          },
        },
        attendanceSessions: {
          include: {
            records: true,
          },
        },
        topics: {
          include: {
            materials: {
              include: {
                progresses: true,
              },
            },
          },
        },
      },
    });

    if (!classCourse) {
      throw new Error("Kelas tidak ditemukan.");
    }

    const totalMaterials = classCourse.topics.reduce(
      (sum: number, t: any) => sum + t.materials.length,
      0
    );
    const totalSessions = classCourse.attendanceSessions.length;
    const totalAssignments = classCourse.assignments.length;
    const totalQuizzes = classCourse.quizzes.length;

    const studentGrades = classCourse.enrollments.map((en: any) => {
      const studentId = en.student.id;
      const studentName = en.student.fullName;
      const studentIdNumber =
        en.student.identifiers.find((i: any) => i.isPrimary)?.value ||
        en.student.identifiers[0]?.value ||
        "-";

      // 1. Rata-rata Nilai Tugas
      let assignmentSum = 0;
      let assignmentCount = 0;
      classCourse.assignments.forEach((asg: any) => {
        const sub = asg.submissions.find((s: any) => s.studentUserId === studentId);
        if (sub && sub.score !== null && sub.score !== undefined) {
          assignmentSum += sub.score;
          assignmentCount++;
        }
      });
      const assignmentAverage = assignmentCount > 0 ? Math.round((assignmentSum / assignmentCount) * 10) / 10 : 0;

      // 2. Rata-rata Nilai Kuis
      let quizSum = 0;
      let quizCount = 0;
      classCourse.quizzes.forEach((qz: any) => {
        const att = qz.attempts.find((a: any) => a.studentUserId === studentId);
        if (att && att.score !== null && att.score !== undefined) {
          quizSum += att.score;
          quizCount++;
        }
      });
      const quizAverage = quizCount > 0 ? Math.round((quizSum / quizCount) * 10) / 10 : 0;

      // 3. Persentase Presensi
      let presentCount = 0;
      classCourse.attendanceSessions.forEach((sess: any) => {
        const rec = sess.records.find((r: any) => r.studentUserId === studentId);
        if (rec?.status === "PRESENT") presentCount++;
        else if (rec?.status === "EXCUSED") presentCount += 0.5;
      });
      const attendancePercentage = totalSessions > 0
        ? Math.round((presentCount / totalSessions) * 100)
        : 100;

      // 4. Progres Materi
      let completedMaterials = 0;
      classCourse.topics.forEach((t: any) => {
        t.materials.forEach((m: any) => {
          const prog = m.progresses.find((p: any) => p.studentUserId === studentId);
          if (prog?.isCompleted) completedMaterials++;
        });
      });
      const materialProgressPercentage = totalMaterials > 0
        ? Math.round((completedMaterials / totalMaterials) * 100)
        : 100;

      // 5. Nilai Akhir Tertimbang: Tugas 35%, Kuis 35%, Presensi 15%, Materi 15%
      const finalScore = Math.round(
        (assignmentAverage * 0.35 +
         quizAverage * 0.35 +
         attendancePercentage * 0.15 +
         materialProgressPercentage * 0.15) * 10
      ) / 10;

      const letterGrade = calculateLetterGrade(finalScore);

      return {
        studentId,
        studentName,
        studentIdNumber,
        assignmentAverage,
        quizAverage,
        attendancePercentage,
        materialProgressPercentage,
        finalScore,
        letterGrade,
      };
    });

    return {
      classCourseId: classCourse.id,
      className: classCourse.name,
      classCode: classCourse.code,
      totalStudents: studentGrades.length,
      studentGrades,
    };
  });
}

export async function getStudentOverallGrades({
  institutionId,
  studentUserId,
}: {
  institutionId: string;
  studentUserId: string;
}) {
  return withTenantTransaction(institutionId, async (tx) => {
    const enrollments = await tx.classEnrollment.findMany({
      where: { studentUserId, status: "ACTIVE" },
      include: {
        classCourse: {
          include: {
            assignments: {
              include: {
                submissions: {
                  where: { studentUserId },
                },
              },
            },
            quizzes: {
              include: {
                attempts: {
                  where: { studentUserId },
                },
              },
            },
            attendanceSessions: {
              include: {
                records: {
                  where: { studentUserId },
                },
              },
            },
          },
        },
      },
    });

    const courses = enrollments.map((en: any) => {
      const cc = en.classCourse;
      // Nilai Tugas
      let asgSum = 0;
      let asgCount = 0;
      cc.assignments.forEach((a: any) => {
        if (a.submissions[0]?.score !== null && a.submissions[0]?.score !== undefined) {
          asgSum += a.submissions[0].score;
          asgCount++;
        }
      });
      const assignmentAverage = asgCount > 0 ? Math.round((asgSum / asgCount) * 10) / 10 : 0;

      // Nilai Kuis
      let qzSum = 0;
      let qzCount = 0;
      cc.quizzes.forEach((q: any) => {
        if (q.attempts[0]?.score !== null && q.attempts[0]?.score !== undefined) {
          qzSum += q.attempts[0].score;
          qzCount++;
        }
      });
      const quizAverage = qzCount > 0 ? Math.round((qzSum / qzCount) * 10) / 10 : 0;

      // Presensi
      let presentCount = 0;
      cc.attendanceSessions.forEach((s: any) => {
        if (s.records[0]?.status === "PRESENT") presentCount++;
        else if (s.records[0]?.status === "EXCUSED") presentCount += 0.5;
      });
      const attendancePercentage = cc.attendanceSessions.length > 0
        ? Math.round((presentCount / cc.attendanceSessions.length) * 100)
        : 100;

      const finalScore = Math.round(
        (assignmentAverage * 0.4 + quizAverage * 0.4 + attendancePercentage * 0.2) * 10
      ) / 10;

      return {
        id: cc.id,
        code: cc.code,
        name: cc.name,
        credits: cc.credits || 3,
        assignmentAverage,
        quizAverage,
        attendancePercentage,
        finalScore,
        letterGrade: calculateLetterGrade(finalScore),
      };
    });

    return { courses };
  });
}
