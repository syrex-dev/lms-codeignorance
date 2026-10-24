"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { getTerminology } from "@/lib/i18n/terminology";

export default function ClassroomClassesPage() {
  const params = useParams();
  const tenantSlug = params.tenant as string;
  const router = useRouter();
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1">
            <span>📚 Ruang Kelas & Pembelajaran</span>
            <span>•</span>
            <span>{t.institutionLabel}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {t.classRoom}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Pusat interaksi belajar mengajar, materi terstruktur, dan pemantauan progres pembelajaran.
          </p>
        </div>

        {/* Pencarian */}
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 text-xs">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Cari ${t.course.toLowerCase()} atau kode...`}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-xl text-xs text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 animate-pulse space-y-3">
              <div className="h-4 bg-slate-800 rounded w-1/3"></div>
              <div className="h-6 bg-slate-800 rounded w-3/4"></div>
              <div className="h-3 bg-slate-800 rounded w-1/2"></div>
              <div className="h-10 bg-slate-800 rounded w-full mt-4"></div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && classes.length === 0 && (
        <div className="text-center py-16 bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl p-8">
          <div className="text-4xl mb-3">📖</div>
          <h3 className="text-sm font-semibold text-white">Belum Ada {t.classRoom} yang Diikuti</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
            Anda belum terdaftar atau belum ditugaskan pada kelas mana pun di semester ini. Hubungi administrator jika ini adalah kekeliruan.
          </p>
        </div>
      )}

      {/* Classes Grid */}
      {!loading && classes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {classes.map((c) => {
            const hasProgress = typeof c.progressPercentage === "number";
            const primaryInstructor = c.instructors?.[0]?.instructor?.fullName || "Belum ditentukan";

            return (
              <div
                key={c.id}
                className="group relative bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 transition duration-200 flex flex-col justify-between shadow-lg hover:shadow-indigo-500/10"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
                    <span className="bg-slate-800/80 px-2.5 py-0.5 rounded-md text-indigo-300 font-semibold">
                      {c.code}
                    </span>
                    <span>{c.academicTerm?.name || "Semester Aktif"}</span>
                  </div>

                  <h2 className="text-base font-bold text-white group-hover:text-indigo-300 transition line-clamp-2">
                    {c.name}
                  </h2>

                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {c.description || `${t.course} ${c.name} pada ${c.academicTerm?.name || "Tahun Akademik Berjalan"}.`}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <span>👨‍🏫</span>
                      <span className="truncate max-w-[160px] font-medium text-slate-300">
                        {primaryInstructor}
                      </span>
                    </div>
                    {c.credits && (
                      <span className="text-[11px] text-slate-400">
                        {c.credits} {t.credits.split(" ")[0]}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {/* Progress Bar (Jika Siswa) */}
                  {hasProgress && (
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-slate-400">Progres Belajar</span>
                        <span className="font-mono font-bold text-indigo-400">
                          {c.progressPercentage}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${c.progressPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  <Link
                    href={`/${tenantSlug}/classes/${c.id}`}
                    className="w-full flex items-center justify-center gap-1.5 bg-indigo-600/90 hover:bg-indigo-600 text-white font-medium py-2 px-4 rounded-xl text-xs transition shadow-sm"
                  >
                    <span>Masuk ke Kelas</span>
                    <span>→</span>
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
