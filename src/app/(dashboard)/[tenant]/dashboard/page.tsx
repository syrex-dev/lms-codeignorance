import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { getTerminology } from "@/lib/i18n/terminology";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { BookOpen, Calendar, ArrowRight, Clock, Award } from "lucide-react";

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
  const activeTerm = institution.academicTerms[0];

  // Filter kelas sesuai peran
  const enrolledClasses = institution.classCourses.filter((c) => {
    if (currentRole === "STUDENT") {
      return c.enrollments.some((e) => e.studentUserId === user.id);
    }
    if (currentRole === "TEACHER") {
      return c.instructors.some((i) => i.instructorUserId === user.id);
    }
    return true; // Admin melihat semua
  });

  const totalCredits = enrolledClasses.reduce((acc, c) => acc + (c.credits || 0), 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Dashboard"
        description={`Selamat datang kembali, ${user.fullName}. Berikut ringkasan aktivitas akademik pada ${activeTerm?.name || "semester berjalan"}.`}
      />

      {/* Real Academic Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-[#E3E6EB] rounded-[6px] shadow-none">
          <div className="flex items-center justify-between text-[#4B5563]">
            <span className="text-xs font-medium">Kelas aktif</span>
            <BookOpen className="w-4 h-4 text-[#1F4E8C]" strokeWidth={1.5} />
          </div>
          <div className="mt-2 text-2xl font-semibold text-[#111827]">
            {enrolledClasses.length}
          </div>
          <p className="mt-1 text-xs text-[#6B7280]">
            {currentRole === "TEACHER" ? "Kelas yang Anda ampu" : "Kelas yang Anda ikuti"}
          </p>
        </div>

        <div className="p-4 bg-white border border-[#E3E6EB] rounded-[6px] shadow-none">
          <div className="flex items-center justify-between text-[#4B5563]">
            <span className="text-xs font-medium">Total beban {terminology.creditsShort}</span>
            <Award className="w-4 h-4 text-[#1F4E8C]" strokeWidth={1.5} />
          </div>
          <div className="mt-2 text-2xl font-semibold text-[#111827]">
            {totalCredits} <span className="text-sm font-normal text-[#4B5563]">{terminology.creditsShort}</span>
          </div>
          <p className="mt-1 text-xs text-[#6B7280]">
            Beban akademik semester ini
          </p>
        </div>

        <div className="p-4 bg-white border border-[#E3E6EB] rounded-[6px] shadow-none">
          <div className="flex items-center justify-between text-[#4B5563]">
            <span className="text-xs font-medium">Periode akademik</span>
            <Calendar className="w-4 h-4 text-[#1F4E8C]" strokeWidth={1.5} />
          </div>
          <div className="mt-2 text-sm font-semibold text-[#111827] truncate">
            {activeTerm?.name || "Semester Aktif"}
          </div>
          <p className="mt-1 text-xs text-[#6B7280]">
            Status: <span className="text-[#15803D] font-medium">Sedang Berjalan</span>
          </p>
        </div>
      </div>

      {/* Real Enrolled Classes Section */}
      <div className="bg-white border border-[#E3E6EB] rounded-[6px] p-5 shadow-none">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E3E6EB]">
          <div>
            <h2 className="text-base font-semibold text-[#111827]">
              Daftar kelas {isUniversity ? "perkuliahan" : "pelajaran"}
            </h2>
            <p className="text-xs text-[#4B5563] mt-0.5">
              Akses materi pembelajaran dan aktivitas belajar
            </p>
          </div>
          <Link
            href={`/${tenant}/classes`}
            className="text-xs font-medium text-[#1F4E8C] hover:underline flex items-center gap-1"
          >
            <span>Buka semua kelas</span>
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
          </Link>
        </div>

        {enrolledClasses.length === 0 ? (
          <EmptyState
            title="Belum ada kelas terdaftar"
            description="Anda belum terdaftar pada kelas manapun di semester ini. Hubungi bagian akademik jika ini adalah kekeliruan."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {enrolledClasses.map((c) => {
              const primaryInstructor = c.instructors?.[0]?.instructor?.fullName || "Belum ditentukan";
              return (
                <div
                  key={c.id}
                  className="p-4 border border-[#E3E6EB] rounded-[6px] hover:border-[#CBD5E1] transition bg-white flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-[#F6F7F9] border border-[#E3E6EB] rounded text-[#111827]">
                        {c.code}
                      </span>
                      {c.credits && (
                        <span className="text-xs text-[#4B5563]">
                          {c.credits} {terminology.creditsShort}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-[#111827] line-clamp-1">
                      {c.name}
                    </h3>
                    <p className="text-xs text-[#4B5563] mt-1 line-clamp-2">
                      {c.description || `${c.name} pada ${activeTerm?.name || "Semester Aktif"}.`}
                    </p>
                    <div className="mt-3 text-xs text-[#6B7280]">
                      {terminology.teacher}: <span className="text-[#111827] font-medium">{primaryInstructor}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#E3E6EB] flex items-center justify-between">
                    <span className="text-[11px] text-[#6B7280]">
                      {c.enrollments?.length || 0} peserta
                    </span>
                    <Link
                      href={`/${tenant}/classes/${c.id}`}
                      className="inline-flex items-center gap-1.5 h-8 px-3 bg-[#1F4E8C] hover:bg-[#183E6F] text-white text-xs font-medium rounded-[6px] transition focus:outline-none focus:ring-2 focus:ring-[#1F4E8C]"
                    >
                      <span>Buka kelas</span>
                      <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
