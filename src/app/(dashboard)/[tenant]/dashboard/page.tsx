import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { getTerminology } from "@/lib/i18n/terminology";
import Link from "next/link";
import {
  BookOpen,
  Calendar,
  Clock,
  Award,
  Users,
  CheckCircle,
  GraduationCap,
  School,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  params: Promise<{
    tenant: string;
  }>;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { tenant } = await params;
  const session = await getServerSession(authOptions);

  const institution = await prisma.institution.findUnique({
    where: { slug: tenant },
    include: {
      academicTerms: { where: { isActive: true }, take: 1 },
      classCourses: {
        include: {
          instructors: { include: { instructor: true } },
          enrollments: true,
          scheduleEntries: {
            include: { room: true, instructor: true },
          },
        },
      },
    },
  });

  if (!institution || !session?.user) {
    return null;
  }

  const terminology = getTerminology(institution.type);
  const isUniversity = institution.type === "UNIVERSITY";
  const user = session.user;
  const currentRole = user.activeRole;

  // Filter kelas sesuai peran
  const enrolledClasses = institution.classCourses.filter((c) => {
    if (currentRole === "STUDENT") {
      return c.enrollments.some((e) => e.studentUserId === user.id);
    }
    if (currentRole === "TEACHER") {
      return c.instructors.some((i) => i.instructorUserId === user.id);
    }
    return true; // Admin sees all
  });

  // Ambil entri jadwal perkuliahan / pelajaran
  const scheduleList = institution.classCourses.flatMap((c) =>
    c.scheduleEntries.map((s) => ({
      ...s,
      courseName: c.name,
      courseCode: c.code,
      credits: c.credits,
    }))
  );

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div
        className={`p-6 md:p-8 rounded-3xl text-white relative overflow-hidden shadow-xl ${
          isUniversity
            ? "bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 shadow-blue-500/10"
            : "bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-900 shadow-emerald-500/10"
        }`}
      >
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold mb-4 border border-white/20">
            {isUniversity ? (
              <GraduationCap className="w-3.5 h-3.5" />
            ) : (
              <School className="w-3.5 h-3.5" />
            )}
            <span>
              {institution.name} • {terminology.institutionLabel}
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Selamat Datang, {user.fullName}!
          </h1>
          <p className="mt-2 text-slate-100 text-sm leading-relaxed">
            Anda masuk sebagai{" "}
            <span className="font-bold underline decoration-white/40">
              {currentRole}
            </span>{" "}
            dengan ID resmi:{" "}
            <span className="font-mono bg-white/20 px-2 py-0.5 rounded font-bold">
              {user.identifier}
            </span>
            . Semua data dan tampilan secara dinamis disesuaikan dengan standar{" "}
            <strong>{terminology.institutionLabel}</strong>.
          </p>
        </div>

        {/* Glow */}
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {terminology.classRoom} Aktif
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
            {enrolledClasses.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Terdaftar di semester berjalan
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Beban {terminology.credits}
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
            {isUniversity
              ? `${enrolledClasses.reduce((acc, c) => acc + (c.credits || 0), 0)} SKS`
              : `${enrolledClasses.length * 4} JP`}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Beban akademik aktif
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Jadwal Sesi
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
            {scheduleList.length} Pertemuan
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Jadwal mingguan terdaftar
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Modul {terminology.admissionShort}
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
            Aktif
          </div>
          <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            Gelombang 2025/2026
          </div>
        </div>
      </div>

      {/* Main Grid: Enrolled Courses & Schedule Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: List of Classes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Daftar {terminology.classRoom}</span>
            </h2>
            <Link
              href={`/${tenant}/classes`}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
            >
              <span>Lihat Semua</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {enrolledClasses.map((item) => {
              const primaryInstructor = item.instructors.find((i) => i.isPrimary)?.instructor;
              return (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-mono font-bold">
                        {item.code}
                      </span>
                      {isUniversity && (
                        <span className="text-xs text-slate-500 font-medium">
                          {item.credits} SKS
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {item.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {terminology.teacher}:{" "}
                      <strong>
                        {primaryInstructor?.fullName || "Belum ditentukan"}
                      </strong>
                    </p>
                  </div>

                  <Link
                    href={`/${tenant}/classes`}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all text-center"
                  >
                    Buka Kelas
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Today's Schedule & i18n Dictionary Card */}
        <div className="space-y-6">
          {/* Schedule Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Jadwal Pekan Ini</span>
              </h3>
              <Link
                href={`/${tenant}/schedule`}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Detail
              </Link>
            </div>

            {scheduleList.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                Belum ada jadwal terdaftar.
              </p>
            ) : (
              <div className="space-y-3">
                {scheduleList.map((sch) => (
                  <div
                    key={sch.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {sch.dayOfWeek}
                      </span>
                      <span className="font-mono text-slate-500">
                        {sch.startTime} - {sch.endTime}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {sch.courseName}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Ruang: <strong>{sch.room.name}</strong> ({sch.room.code})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dynamic i18n Terminology Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-lg">
            <div className="flex items-center space-x-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-3">
              <Sparkles className="w-4 h-4" />
              <span>Pemetaan Istilah Institusi ({terminology.institutionLabel})</span>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between py-1 border-b border-white/10">
                <span className="text-slate-400">Pengajar:</span>
                <span className="font-semibold text-white">{terminology.teacher} ({terminology.teacherId})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/10">
                <span className="text-slate-400">Peserta Didik:</span>
                <span className="font-semibold text-white">{terminology.student} ({terminology.studentId})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/10">
                <span className="text-slate-400">Unit Mata Kuliah:</span>
                <span className="font-semibold text-white">{terminology.course} ({terminology.credits})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/10">
                <span className="text-slate-400">Laporan Nilai:</span>
                <span className="font-semibold text-white">{terminology.gradeReport} ({terminology.gpa})</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Penerimaan Siswa/Mhs:</span>
                <span className="font-semibold text-emerald-400">{terminology.admissionShort}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
