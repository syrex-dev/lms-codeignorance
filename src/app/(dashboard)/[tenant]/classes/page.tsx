"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { getTerminology } from "@/lib/i18n/terminology";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowRight, Search, BookOpen, User as UserIcon } from "lucide-react";

export default function ClassroomClassesPage() {
  const params = useParams();
  const tenantSlug = params.tenant as string;
  const { data: session } = useSession();

  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const isSchool = tenantSlug.toLowerCase().includes("sman") || tenantSlug.toLowerCase().includes("sekolah");
  const t = getTerminology(isSchool ? "SCHOOL" : "UNIVERSITY");

  useEffect(() => {
    async function loadClasses() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/classroom/classes?search=${encodeURIComponent(search)}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Gagal memuat daftar kelas.");
        }
        setClasses(data.classes || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadClasses();
  }, [search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t.classRoom}
        description={`Daftar ${t.classRoom.toLowerCase()} aktif pada semester berjalan.`}
        action={
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Cari ${t.course.toLowerCase()} atau kode...`}
              className="w-full h-9 pl-9 pr-3 text-xs bg-white text-[#111827] border border-[#E3E6EB] rounded-[6px] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1"
            />
          </div>
        }
      />

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-[6px] text-xs text-[#B91C1C]"
        >
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-[#E3E6EB] rounded-[6px] p-4 animate-pulse space-y-3">
              <div className="h-4 bg-[#F3F4F6] rounded w-1/3"></div>
              <div className="h-5 bg-[#F3F4F6] rounded w-3/4"></div>
              <div className="h-3 bg-[#F3F4F6] rounded w-1/2"></div>
              <div className="h-8 bg-[#F3F4F6] rounded w-full mt-4"></div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && classes.length === 0 && (
        <EmptyState
          title={`Belum ada ${t.classRoom.toLowerCase()} yang diikuti`}
          description="Anda belum terdaftar pada kelas manapun di semester ini. Hubungi bagian akademik jika ini adalah kekeliruan."
        />
      )}

      {/* Classes Grid */}
      {!loading && classes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((c) => {
            const hasProgress = typeof c.progressPercentage === "number";
            const primaryInstructor = c.instructors?.[0]?.instructor?.fullName || "Belum ditentukan";

            return (
              <div
                key={c.id}
                className="bg-white border border-[#E3E6EB] rounded-[6px] p-4 flex flex-col justify-between hover:border-[#CBD5E1] transition"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-mono font-semibold px-2 py-0.5 bg-[#F6F7F9] border border-[#E3E6EB] rounded text-[#111827]">
                      {c.code}
                    </span>
                    <span className="text-[#6B7280]">
                      {c.academicTerm?.name || "Semester Aktif"}
                    </span>
                  </div>

                  <h2 className="text-sm font-semibold text-[#111827] line-clamp-2">
                    {c.name}
                  </h2>

                  <p className="text-xs text-[#4B5563] mt-1 line-clamp-2">
                    {c.description || `${t.course} ${c.name} pada ${c.academicTerm?.name || "Tahun Akademik Berjalan"}.`}
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-[#E3E6EB] flex items-center justify-between text-xs text-[#4B5563]">
                    <span className="truncate max-w-[160px]">
                      {t.teacher}: <strong className="font-medium text-[#111827]">{primaryInstructor}</strong>
                    </span>
                    {c.credits && (
                      <span className="text-[#6B7280]">
                        {c.credits} {t.creditsShort}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E3E6EB] space-y-3">
                  {/* Progress Bar 4px */}
                  {hasProgress && (
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-[#6B7280]">Progres</span>
                        <span className="font-mono font-semibold text-[#1F4E8C]">
                          {c.progressPercentage}%
                        </span>
                      </div>
                      <div className="w-full bg-[#E5E7EB] rounded-full h-1 overflow-hidden">
                        <div
                          className="bg-[#1F4E8C] h-1 rounded-full transition-all duration-300"
                          style={{ width: `${c.progressPercentage}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <Link
                    href={`/${tenantSlug}/classes/${c.id}`}
                    className="w-full h-8 flex items-center justify-center gap-1.5 bg-[#1F4E8C] hover:bg-[#183E6F] text-white font-medium px-3 rounded-[6px] text-xs transition focus:outline-none focus:ring-2 focus:ring-[#1F4E8C]"
                  >
                    <span>Masuk ke kelas</span>
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
