"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CheckSquare,
  Clock,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  Calendar,
} from "lucide-react";

export default function AggregatedAssignmentsPage() {
  const params = useParams();
  const tenantSlug = params?.tenant as string;

  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<any[]>([]);

  useEffect(() => {
    async function loadAssignments() {
      try {
        setLoading(true);
        const res = await fetch("/api/classroom/assignments");
        if (res.ok) {
          const data = await res.json();
          setAssignments(data.assignments || []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    loadAssignments();
  }, [tenantSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-xs text-[var(--text-subtle)]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span>Memuat rekap tugas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tugas & Penilaian Akademik"
        description="Daftar seluruh tugas, tenggat waktu pengumpulan, status pengerjaan, dan evaluasi nilai."
      />

      {assignments.length === 0 ? (
        <EmptyState
          title="Belum Ada Tugas Aktif"
          description="Saat ini tidak ada tugas atau evaluasi yang perlu dikumpulkan di seluruh kelas Anda."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignments.map((item) => {
            const hasSubmission = !!item.mySubmission;
            const isGraded = item.mySubmission?.status === "GRADED";
            const isLate = new Date() > new Date(item.dueDate);

            return (
              <div
                key={item.id}
                className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] rounded-[8px] p-5 shadow-xs transition hover:shadow-sm flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-[var(--tenant-accent-subtle,#EFF6FF)] text-[var(--tenant-accent,#1E40AF)] rounded">
                      {item.classCourse?.code || "KELAS"}
                    </span>
                    <div>
                      {isGraded ? (
                        <span className="text-[11px] font-semibold text-[var(--status-success)] bg-[var(--status-success-bg)] border border-[var(--status-success-border)] px-2 py-0.5 rounded font-mono">
                          Nilai: {item.mySubmission.score}/{item.maxScore}
                        </span>
                      ) : hasSubmission ? (
                        <span className="text-[11px] font-semibold text-[var(--status-info)] bg-[var(--status-info-bg)] border border-[var(--status-info-border)] px-2 py-0.5 rounded">
                          Sudah Dikumpulkan
                        </span>
                      ) : isLate ? (
                        <span className="text-[11px] font-semibold text-[var(--status-danger)] bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] px-2 py-0.5 rounded">
                          Terlambat
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-[var(--status-warning)] bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] px-2 py-0.5 rounded">
                          Belum Dikumpulkan
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-main)]">
                      {item.title}
                    </h3>
                    <p className="text-xs text-[var(--text-subtle)] mt-0.5">
                      {item.classCourse?.name}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-subtle)]">
                    <div className="flex items-center gap-1.5 font-medium text-[var(--text-main)]">
                      <Clock className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
                      <span>Batas: {new Date(item.dueDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <span>Maks. {item.maxScore} Poin</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--border-subtle)]">
                  <Link
                    href={`/${tenantSlug}/classes/${item.classCourseId}`}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[var(--bg-canvas)] hover:bg-[var(--tenant-accent-subtle,#EFF6FF)] text-[var(--tenant-accent,#1E40AF)] rounded-[6px] text-xs font-semibold transition"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Lihat di Ruang Kelas</span>
                    <ArrowRight className="w-3.5 h-3.5" />
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
