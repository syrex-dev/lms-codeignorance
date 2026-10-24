import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";
import { getTerminology } from "@/lib/i18n/terminology";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BookOpen,
  Calendar,
  ArrowRight,
  Award,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  PlayCircle,
  Building2,
  ChevronRight,
  TrendingUp,
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

  if (!session?.user) {
    return null;
  }

  const user = session.user;
  const currentRole = user.activeRole;

  // 1. Dapatkan tenant root
  const institution = await prisma.institution.findUnique({
    where: { slug: tenant },
    include: {
      academicTerms: { where: { isActive: true }, take: 1 },
      subscription: true,
    },
  });

  if (!institution) {
    return null;
  }

  const terminology = getTerminology(institution.type);
  const isUniversity = institution.type === "UNIVERSITY";
  const activeTerm = institution.academicTerms[0];

  // 2. Query data berbasis transaksi tenant (penegakan PostgreSQL RLS app.current_tenant)
  const dashboardData: any = await withTenantTransaction(institution.id, async (tenantDb) => {
    // A. DATA KHUSUS MAHASISWA / SISWA
    if (currentRole === "STUDENT") {
      const enrollments = await tenantDb.classEnrollment.findMany({
        where: {
          studentUserId: user.id,
          status: "ACTIVE",
          classCourse: {
            institutionId: institution.id,
          },
        },
        include: {
          classCourse: {
            include: {
              academicTerm: true,
              programDepartment: true,
              instructors: {
                include: {
                  instructor: {
                    select: { id: true, fullName: true, avatarUrl: true },
                  },
                },
              },
              topics: {
                where: { deletedAt: null },
                include: {
                  materials: {
                    where: { deletedAt: null, status: "PUBLISHED" },
                    include: {
                      progresses: {
                        where: { studentUserId: user.id },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Hitung metrik dan progres tiap kelas
      const studentClasses = enrollments.map((enr: any) => {
        const cls = enr.classCourse;
        const allMaterials = cls.topics.flatMap((t: any) => t.materials);
        const totalMaterials = allMaterials.length;
        const completedMaterials = allMaterials.filter((m: any) => m.progresses?.[0]?.isCompleted).length;
        const progressPercentage = totalMaterials > 0 ? Math.round((completedMaterials / totalMaterials) * 100) : 0;
        const primaryInstructor = cls.instructors?.find((i: any) => i.isPrimary)?.instructor?.fullName || cls.instructors?.[0]?.instructor?.fullName || "Belum ditentukan";

        return {
          id: cls.id,
          code: cls.code,
          name: cls.name,
          credits: cls.credits || 3,
          description: cls.description,
          room: cls.roomName || "LAB-KOMP-1",
          primaryInstructor,
          totalMaterials,
          completedMaterials,
          progressPercentage,
          allMaterials,
          topics: cls.topics,
        };
      });

      // Cari materi terakhir diakses atau materi berikutnya yang belum selesai (Lanjutkan Belajar)
      let resumeItem: {
        classId: string;
        className: string;
        topicTitle: string;
        materialId: string;
        materialTitle: string;
        materialType: string;
        progressPercentage: number;
      } | null = null;

      // Cari dari material progress terakhir diakses
      const lastProgress = await tenantDb.materialProgress.findFirst({
        where: {
          studentUserId: user.id,
          institutionId: institution.id,
        },
        orderBy: { lastViewedAt: "desc" },
        include: {
          material: {
            include: {
              topic: {
                include: { classCourse: true },
              },
            },
          },
        },
      });

      if (lastProgress && lastProgress.material && lastProgress.material.topic) {
        const mat = lastProgress.material;
        const top = mat.topic;
        const cls = top.classCourse;
        const matchedClass = studentClasses.find((c: any) => c.id === cls.id);

        resumeItem = {
          classId: cls.id,
          className: cls.name,
          topicTitle: top.title,
          materialId: mat.id,
          materialTitle: mat.title,
          materialType: mat.type,
          progressPercentage: matchedClass?.progressPercentage || 67,
        };
      } else if (studentClasses.length > 0) {
        // Fallback ke materi pertama di kelas pertama jika belum ada progress record
        const firstCls = studentClasses[0];
        const firstTopic = firstCls.topics[0];
        const firstMat = firstTopic?.materials[0];
        if (firstMat) {
          resumeItem = {
            classId: firstCls.id,
            className: firstCls.name,
            topicTitle: firstTopic.title,
            materialId: firstMat.id,
            materialTitle: firstMat.title,
            materialType: firstMat.type,
            progressPercentage: firstCls.progressPercentage,
          };
        }
      }

      const totalCredits = studentClasses.reduce((acc: number, c: any) => acc + c.credits, 0);
      const avgProgress = studentClasses.length > 0
        ? Math.round(studentClasses.reduce((acc: number, c: any) => acc + c.progressPercentage, 0) / studentClasses.length)
        : 0;

      return {
        role: "STUDENT",
        studentClasses,
        totalCredits,
        avgProgress,
        resumeItem,
      };
    }

    // B. DATA KHUSUS DOSEN / GURU
    if (currentRole === "TEACHER") {
      const instructed = await tenantDb.classInstructor.findMany({
        where: {
          instructorUserId: user.id,
          classCourse: { institutionId: institution.id },
        },
        include: {
          classCourse: {
            include: {
              academicTerm: true,
              enrollments: { where: { status: "ACTIVE" } },
              topics: {
                where: { deletedAt: null },
                include: {
                  materials: { where: { deletedAt: null } },
                },
              },
            },
          },
        },
      });

      const teacherClasses = instructed.map((inst: any) => {
        const cls = inst.classCourse;
        const studentCount = cls.enrollments?.length || 0;
        const totalMaterials = cls.topics.flatMap((t: any) => t.materials).length;
        const draftMaterials = cls.topics.flatMap((t: any) => t.materials).filter((m: any) => m.status === "DRAFT" || m.status === "SCHEDULED").length;

        return {
          id: cls.id,
          code: cls.code,
          name: cls.name,
          credits: cls.credits || 3,
          studentCount,
          totalMaterials,
          draftMaterials,
          isPrimary: inst.isPrimary,
        };
      });

      const totalStudents = teacherClasses.reduce((acc: number, c: any) => acc + c.studentCount, 0);
      const totalDrafts = teacherClasses.reduce((acc: number, c: any) => acc + c.draftMaterials, 0);

      return {
        role: "TEACHER",
        teacherClasses,
        totalStudents,
        totalDrafts,
      };
    }

    // C. DATA KHUSUS ADMIN INSTITUSI
    const [termsCount, activeTermCount, departmentsCount, coursesCount, classesCount, usersCount, pendingUsersCount] = await Promise.all([
      tenantDb.academicTerm.count({ where: { institutionId: institution.id } }),
      tenantDb.academicTerm.count({ where: { institutionId: institution.id, isActive: true } }),
      tenantDb.programDepartment.count({ where: { institutionId: institution.id } }),
      tenantDb.classCourse.count({ where: { institutionId: institution.id } }),
      tenantDb.classCourse.count({ where: { institutionId: institution.id } }),
      tenantDb.user.count({ where: { institutionId: institution.id, deletedAt: null } }),
      tenantDb.user.count({ where: { institutionId: institution.id, status: "PENDING_ACTIVATION", deletedAt: null } }),
    ]);

    const maxUsersQuota = 500;

    const checklist = [
      {
        id: 1,
        title: "Periode Akademik Aktif",
        description: "Semester atau tahun ajaran berjalan",
        isComplete: activeTermCount > 0,
        href: `/${tenant}/admin/academic`,
      },
      {
        id: 2,
        title: isUniversity ? "Program Studi & Jurusan" : "Tingkat & Jurusan",
        description: "Struktur unit akademik institusi",
        isComplete: departmentsCount > 0,
        href: `/${tenant}/admin/academic`,
      },
      {
        id: 3,
        title: isUniversity ? "Mata Kuliah & Kelas" : "Mata Pelajaran & Rombel",
        description: "Daftar kurikulum dan rombongan belajar",
        isComplete: classesCount > 0,
        href: `/${tenant}/admin/academic`,
      },
      {
        id: 4,
        title: "Pengguna & Akun Civitas",
        description: "Dosen/Guru dan Mahasiswa/Siswa terdaftar",
        isComplete: usersCount > 0,
        href: `/${tenant}/admin/users`,
      },
    ];

    const completedChecklistCount = checklist.filter((c) => c.isComplete).length;
    const checklistProgress = Math.round((completedChecklistCount / checklist.length) * 100);

    return {
      role: "ADMIN",
      termsCount,
      departmentsCount,
      classesCount,
      usersCount,
      pendingUsersCount,
      maxUsersQuota,
      checklist,
      checklistProgress,
    };
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Dashboard"
        description={`Selamat datang kembali, ${user.fullName}. Berikut ringkasan aktivitas akademik pada ${activeTerm?.name || "semester berjalan"}.`}
      />

      {/* =================================================================== */}
      {/* 1. TAMPILAN MAHASISWA / SISWA                                       */}
      {/* =================================================================== */}
      {dashboardData.role === "STUDENT" && (
        <div className="space-y-6">
          {/* Banner "Lanjutkan Belajar" */}
          {dashboardData.resumeItem && (
            <div
              data-testid="continue-learning-banner"
              className="p-4 sm:p-5 bg-gradient-to-r from-[#EFF6FF] via-white to-[#F8FAFC] border border-[#BFDBFE] rounded-[8px] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold px-2 py-0.5 bg-[#1E40AF] text-white rounded-[4px] uppercase tracking-wide">
                    Lanjutkan Belajar
                  </span>
                  <span className="text-xs text-[#64748B] font-medium">
                    {dashboardData.resumeItem.className}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-[#0F172A]">
                  {dashboardData.resumeItem.materialTitle}
                </h3>
                <p className="text-xs text-[#475569]">
                  Topik: {dashboardData.resumeItem.topicTitle} • Progres kelas: {dashboardData.resumeItem.progressPercentage}%
                </p>
              </div>

              <Link
                href={`/${tenant}/classes/${dashboardData.resumeItem.classId}`}
                className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-[6px] shadow-xs transition"
              >
                <PlayCircle className="w-4 h-4" strokeWidth={1.75} />
                <span>Lanjutkan Materi</span>
              </Link>
            </div>
          )}

          {/* Kartu Metrik Akademik Mahasiswa */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white border border-[#E2E8F0] rounded-[8px] shadow-xs">
              <div className="flex items-center justify-between text-[#64748B]">
                <span className="text-xs font-medium">Kelas Aktif Diikuti</span>
                <BookOpen className="w-4 h-4 text-[#1E40AF]" strokeWidth={1.75} />
              </div>
              <div data-testid="metric-student-classes" className="mt-2 text-2xl font-bold text-[#0F172A] font-mono">
                {dashboardData.studentClasses.length}
              </div>
              <p className="mt-1 text-xs text-[#64748B]">
                {dashboardData.studentClasses.length > 0 ? "Terdaftar & aktif semester ini" : "Belum ada kelas"}
              </p>
            </div>

            <div className="p-4 bg-white border border-[#E2E8F0] rounded-[8px] shadow-xs">
              <div className="flex items-center justify-between text-[#64748B]">
                <span className="text-xs font-medium">Total Beban {terminology.creditsShort}</span>
                <Award className="w-4 h-4 text-[#1E40AF]" strokeWidth={1.75} />
              </div>
              <div data-testid="metric-student-credits" className="mt-2 text-2xl font-bold text-[#0F172A] font-mono">
                {dashboardData.totalCredits} <span className="text-xs font-normal text-[#64748B] font-sans">{terminology.creditsShort}</span>
              </div>
              <p className="mt-1 text-xs text-[#64748B]">
                Beban akademik semester ini
              </p>
            </div>

            <div className="p-4 bg-white border border-[#E2E8F0] rounded-[8px] shadow-xs">
              <div className="flex items-center justify-between text-[#64748B]">
                <span className="text-xs font-medium">Rata-rata Penyelesaian</span>
                <TrendingUp className="w-4 h-4 text-[#15803D]" strokeWidth={1.75} />
              </div>
              <div data-testid="metric-student-avg-progress" className="mt-2 text-2xl font-bold text-[#0F172A] font-mono">
                {dashboardData.avgProgress}%
              </div>
              <div className="mt-2 w-full bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#15803D] h-full rounded-full transition-all"
                  style={{ width: `${dashboardData.avgProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Grid Kelas Mahasiswa dengan Bar Progres */}
          <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#F1F5F9]">
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-[#0F172A]">
                  Daftar Kelas Semester Berjalan
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Akses materi pembelajaran, silabus, dan aktivitas kelas
                </p>
              </div>
              <Link
                href={`/${tenant}/classes`}
                className="text-xs font-semibold text-[#1E40AF] hover:underline flex items-center gap-1"
              >
                <span>Buka semua kelas</span>
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
              </Link>
            </div>

            {dashboardData.studentClasses.length === 0 ? (
              <EmptyState
                title="Belum ada kelas terdaftar"
                description="Anda belum terdaftar pada kelas manapun di semester ini. Hubungi bagian akademik jika ini adalah kekeliruan."
              />
            ) : (
              <div data-testid="student-classes-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dashboardData.studentClasses.map((c: any) => (
                  <div
                    key={c.id}
                    data-testid="student-class-card"
                    className="p-4 border border-[#E2E8F0] rounded-[8px] hover:border-[#CBD5E1] transition bg-white flex flex-col justify-between shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded text-[#0F172A]">
                          {c.code}
                        </span>
                        <span className="text-xs text-[#475569] font-medium">
                          {c.credits} {terminology.creditsShort} • {c.room}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-[#0F172A] line-clamp-1">
                        {c.name}
                      </h3>
                      <p className="text-xs text-[#64748B] mt-1 line-clamp-2">
                        {c.description || `${c.name} pada ${activeTerm?.name || "Semester Aktif"}.`}
                      </p>
                      <div className="mt-3 text-xs text-[#64748B] flex items-center gap-1.5">
                        <span>{terminology.teacher}:</span>
                        <strong className="text-[#0F172A] font-medium">{c.primaryInstructor}</strong>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#F1F5F9] space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#64748B] text-[11px]">Progres Materi</span>
                        <span className="font-mono font-semibold text-[#0F172A] text-xs">
                          {c.progressPercentage}%
                        </span>
                      </div>
                      <div className="w-full bg-[#E2E8F0] h-1 rounded-full overflow-hidden">
                        <div
                          className="bg-[#1E40AF] h-full rounded-full transition-all"
                          style={{ width: `${c.progressPercentage}%` }}
                        />
                      </div>
                      <div className="pt-2 flex justify-end">
                        <Link
                          href={`/${tenant}/classes/${c.id}`}
                          className="inline-flex items-center gap-1.5 h-8 px-3.5 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-medium rounded-[6px] transition shadow-xs"
                        >
                          <span>Buka Kelas</span>
                          <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. TAMPILAN DOSEN / GURU                                            */}
      {/* =================================================================== */}
      {dashboardData.role === "TEACHER" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white border border-[#E2E8F0] rounded-[8px] shadow-xs">
              <div className="flex items-center justify-between text-[#64748B]">
                <span className="text-xs font-medium">Kelas yang Diampu</span>
                <BookOpen className="w-4 h-4 text-[#1E40AF]" strokeWidth={1.75} />
              </div>
              <div data-testid="metric-teacher-classes" className="mt-2 text-2xl font-bold text-[#0F172A] font-mono">
                {dashboardData.teacherClasses.length}
              </div>
              <p className="mt-1 text-xs text-[#64748B]">
                Semester berjalan
              </p>
            </div>

            <div className="p-4 bg-white border border-[#E2E8F0] rounded-[8px] shadow-xs">
              <div className="flex items-center justify-between text-[#64748B]">
                <span className="text-xs font-medium">Total Mahasiswa Terdaftar</span>
                <Users className="w-4 h-4 text-[#1E40AF]" strokeWidth={1.75} />
              </div>
              <div data-testid="metric-teacher-students" className="mt-2 text-2xl font-bold text-[#0F172A] font-mono">
                {dashboardData.totalStudents}
              </div>
              <p className="mt-1 text-xs text-[#64748B]">
                Di seluruh kelas yang Anda ampu
              </p>
            </div>

            <div className="p-4 bg-white border border-[#E2E8F0] rounded-[8px] shadow-xs">
              <div className="flex items-center justify-between text-[#64748B]">
                <span className="text-xs font-medium">Materi Perlu Tindakan</span>
                <Clock className="w-4 h-4 text-[#B45309]" strokeWidth={1.75} />
              </div>
              <div data-testid="metric-teacher-drafts" className="mt-2 text-2xl font-bold text-[#B45309] font-mono">
                {dashboardData.totalDrafts}
              </div>
              <p className="mt-1 text-xs text-[#64748B]">
                Status Draf / Terjadwal
              </p>
            </div>
          </div>

          {/* Grid Kelas Dosen */}
          <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#F1F5F9]">
              <div>
                <h2 className="text-base font-semibold text-[#0F172A]">
                  Daftar Kelas Ampu Anda
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Kelola kurikulum, publikasikan materi, dan pantau anggota kelas
                </p>
              </div>
              <Link
                href={`/${tenant}/classes`}
                className="text-xs font-semibold text-[#1E40AF] hover:underline flex items-center gap-1"
              >
                <span>Lihat semua</span>
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
              </Link>
            </div>

            {dashboardData.teacherClasses.length === 0 ? (
              <EmptyState
                title="Belum ada kelas yang diampu"
                description="Anda belum ditugaskan sebagai pengampu kelas pada semester ini."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dashboardData.teacherClasses.map((c: any) => (
                  <div
                    key={c.id}
                    className="p-4 border border-[#E2E8F0] rounded-[8px] hover:border-[#CBD5E1] transition bg-white flex flex-col justify-between shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded text-[#0F172A]">
                          {c.code}
                        </span>
                        <span className="text-xs text-[#475569] font-medium">
                          {c.credits} {terminology.creditsShort}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-[#0F172A]">
                        {c.name}
                      </h3>
                      <div className="mt-3 flex items-center gap-4 text-xs text-[#64748B]">
                        <span>{c.studentCount} peserta</span>
                        <span>•</span>
                        <span>{c.totalMaterials} materi</span>
                        {c.draftMaterials > 0 && (
                          <span className="text-[#B45309] font-medium">
                            ({c.draftMaterials} draf)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex justify-end">
                      <Link
                        href={`/${tenant}/classes/${c.id}`}
                        className="inline-flex items-center gap-1.5 h-8 px-3.5 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-medium rounded-[6px] transition shadow-xs"
                      >
                        <span>Kelola Materi</span>
                        <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. TAMPILAN ADMIN INSTITUSI                                         */}
      {/* =================================================================== */}
      {dashboardData.role === "ADMIN" && (
        <div className="space-y-6">
          {/* Onboarding Checklist Institusi */}
          <div
            data-testid="admin-onboarding-checklist"
            className="p-5 bg-white border border-[#E2E8F0] rounded-[8px] shadow-xs space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#F1F5F9]">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-[#0F172A]">
                  Checklist Kesiapan Penyiapan Institusi
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Lengkapi seluruh tahapan fondasi akademik untuk operasional penuh
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#1E40AF] font-mono">
                  {dashboardData.checklistProgress}% Lengkap
                </span>
                <div className="w-24 bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#1E40AF] h-full rounded-full transition-all"
                    style={{ width: `${dashboardData.checklistProgress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(dashboardData.checklist || []).map((step: any) => (
                <Link
                  key={step.id}
                  href={step.href}
                  className="p-3.5 rounded-[6px] border border-[#E2E8F0] hover:border-[#CBD5E1] bg-[#F8FAFC] hover:bg-white transition flex items-start gap-3 group"
                >
                  <div className="mt-0.5 shrink-0">
                    {step.isComplete ? (
                      <CheckCircle2 className="w-4 h-4 text-[#15803D]" strokeWidth={2} />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-[#CBD5E1] group-hover:border-[#1E40AF] transition" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-[#0F172A]">
                        {step.title}
                      </h4>
                      <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#0F172A] transition" />
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      {step.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Operational Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-white border border-[#E2E8F0] rounded-[8px] shadow-xs">
              <div className="flex items-center justify-between text-[#64748B]">
                <span className="text-xs font-medium">Kapasitas Pengguna</span>
                <Users className="w-4 h-4 text-[#1E40AF]" strokeWidth={1.75} />
              </div>
              <div className="mt-2 text-2xl font-bold text-[#0F172A] font-mono">
                {dashboardData.usersCount} <span className="text-xs font-normal text-[#64748B] font-sans">/ {dashboardData.maxUsersQuota}</span>
              </div>
              <div className="mt-2 w-full bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#1E40AF] h-full rounded-full"
                  style={{ width: `${Math.min(100, Math.round((dashboardData.usersCount / dashboardData.maxUsersQuota) * 100))}%` }}
                />
              </div>
            </div>

            <div className="p-4 bg-white border border-[#E2E8F0] rounded-[8px] shadow-xs">
              <div className="flex items-center justify-between text-[#64748B]">
                <span className="text-xs font-medium">Aktivasi Tertunda</span>
                <Clock className="w-4 h-4 text-[#B45309]" strokeWidth={1.75} />
              </div>
              <div className="mt-2 text-2xl font-bold text-[#B45309] font-mono">
                {dashboardData.pendingUsersCount}
              </div>
              <Link
                href={`/${tenant}/admin/users`}
                className="mt-1 inline-block text-[11px] text-[#1E40AF] hover:underline font-medium"
              >
                Lihat daftar aktivasi →
              </Link>
            </div>

            <div className="p-4 bg-white border border-[#E2E8F0] rounded-[8px] shadow-xs">
              <div className="flex items-center justify-between text-[#64748B]">
                <span className="text-xs font-medium">Total Kelas Aktif</span>
                <BookOpen className="w-4 h-4 text-[#1E40AF]" strokeWidth={1.75} />
              </div>
              <div className="mt-2 text-2xl font-bold text-[#0F172A] font-mono">
                {dashboardData.classesCount}
              </div>
              <p className="mt-1 text-xs text-[#64748B]">
                Tahun ajaran berjalan
              </p>
            </div>

            <div className="p-4 bg-white border border-[#E2E8F0] rounded-[8px] shadow-xs">
              <div className="flex items-center justify-between text-[#64748B]">
                <span className="text-xs font-medium">Periode Akademik</span>
                <Calendar className="w-4 h-4 text-[#15803D]" strokeWidth={1.75} />
              </div>
              <div className="mt-2 text-xs font-bold text-[#0F172A] truncate">
                {activeTerm?.name || "Semester Aktif"}
              </div>
              <p className="mt-1 text-xs text-[#15803D] font-medium">
                Sedang Berjalan
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
