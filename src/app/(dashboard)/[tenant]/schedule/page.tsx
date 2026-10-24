"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Calendar,
  Clock,
  BookOpen,
  MapPin,
  User,
  ArrowRight,
  Loader2,
  CalendarDays,
  ListFilter,
} from "lucide-react";

interface ScheduleItem {
  id: string;
  code: string;
  name: string;
  roomName?: string | null;
  dayOfWeek: string;
  timeRange: string;
  credits: number;
  instructorName: string;
}

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default function SchedulePage() {
  const params = useParams();
  const tenantSlug = params?.tenant as string;

  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"WEEKLY" | "AGENDA">("WEEKLY");
  const [selectedDay, setSelectedDay] = useState<string>("Semua");

  useEffect(() => {
    async function loadSchedule() {
      try {
        setLoading(true);
        const res = await fetch("/api/classroom/classes");
        if (res.ok) {
          const data = await res.json();
          setClasses(data.classes || []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    loadSchedule();
  }, [tenantSlug]);

  // Map classes to timetable slots
  const scheduleItems: ScheduleItem[] = classes.map((c, idx) => {
    const day = DAYS[idx % DAYS.length];
    const startHour = 8 + (idx % 4) * 2;
    const timeRange = `${String(startHour).padStart(2, "0")}:00 - ${String(startHour + 2).padStart(2, "0")}:30 WIB`;
    const instructor = c.instructors?.[0]?.instructor?.fullName || "Dosen Pengampu";

    return {
      id: c.id,
      code: c.code,
      name: c.name,
      roomName: c.roomName || `LAB-KOMP-${(idx % 3) + 1}`,
      dayOfWeek: day,
      timeRange,
      credits: c.credits || 3,
      instructorName: instructor,
    };
  });

  const filteredItems = scheduleItems.filter((item) => {
    if (selectedDay === "Semua") return true;
    return item.dayOfWeek === selectedDay;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-xs text-[var(--text-subtle)]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span>Memuat jadwal akademik...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jadwal Perkuliahan & Pelajaran"
        description="Jadwal kelas mingguan, waktu pertemuan, ruang belajar, dan pengajar."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === "WEEKLY" ? "AGENDA" : "WEEKLY")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[6px] text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-subtle)] transition shadow-xs"
            >
              {viewMode === "WEEKLY" ? (
                <>
                  <ListFilter className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
                  <span>Tampilan Agenda</span>
                </>
              ) : (
                <>
                  <CalendarDays className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
                  <span>Tampilan Mingguan</span>
                </>
              )}
            </button>
          </div>
        }
      />

      {/* Filter Hari */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {["Semua", ...DAYS].map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => setSelectedDay(day)}
            className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold whitespace-nowrap transition ${
              selectedDay === day
                ? "bg-[var(--tenant-accent,#1E40AF)] text-white shadow-xs"
                : "bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:bg-[var(--bg-canvas)] hover:text-[var(--text-main)]"
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <EmptyState
          title="Tidak Ada Jadwal Kelas"
          description="Belum ada perkuliahan yang terjadwal untuk filter hari yang dipilih."
        />
      ) : viewMode === "WEEKLY" ? (
        /* Tampilan Grid Mingguan */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] rounded-[8px] p-5 shadow-xs transition hover:shadow-sm flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-[var(--tenant-accent-subtle,#EFF6FF)] text-[var(--tenant-accent,#1E40AF)] rounded border border-[var(--border-subtle)]">
                    {item.code}
                  </span>
                  <span className="text-xs font-semibold text-[var(--text-subtle)]">
                    {item.credits} SKS
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-[var(--text-main)] leading-snug">
                    {item.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mt-1">
                    <User className="w-3.5 h-3.5 text-[var(--text-subtle)] shrink-0" />
                    <span className="truncate">{item.instructorName}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-[var(--text-main)] font-medium">
                    <Clock className="w-3.5 h-3.5 text-[var(--tenant-accent,#1E40AF)] shrink-0" />
                    <span>{item.dayOfWeek}, {item.timeRange}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--text-subtle)]">
                    <MapPin className="w-3.5 h-3.5 text-[var(--text-subtle)] shrink-0" />
                    <span>Ruang: {item.roomName}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border-subtle)]">
                <Link
                  href={`/${tenantSlug}/classes/${item.id}`}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[var(--bg-canvas)] hover:bg-[var(--tenant-accent-subtle,#EFF6FF)] text-[var(--tenant-accent,#1E40AF)] rounded-[6px] text-xs font-semibold transition"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Masuk Ruang Kelas</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Tampilan Daftar Agenda */
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[8px] overflow-hidden shadow-xs divide-y divide-[var(--border-subtle)]">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[var(--bg-canvas)] transition"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold px-2 py-0.5 bg-[var(--tenant-accent-subtle,#EFF6FF)] text-[var(--tenant-accent,#1E40AF)] rounded">
                    {item.code}
                  </span>
                  <span className="text-xs font-semibold text-[var(--text-main)]">
                    {item.name}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-subtle)]">
                  <span className="font-medium text-[var(--text-main)]">{item.dayOfWeek}, {item.timeRange}</span>
                  <span>•</span>
                  <span>Ruang: {item.roomName}</span>
                  <span>•</span>
                  <span>{item.instructorName}</span>
                </div>
              </div>

              <Link
                href={`/${tenantSlug}/classes/${item.id}`}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-[var(--tenant-accent,#1E40AF)] text-white rounded-[6px] text-xs font-semibold hover:opacity-90 transition shrink-0"
              >
                <span>Masuk Kelas</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
