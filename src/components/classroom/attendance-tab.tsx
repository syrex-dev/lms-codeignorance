"use client";

import React, { useState, useEffect } from "react";
import {
  CalendarCheck,
  Plus,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Check,
  Users,
  Key,
} from "lucide-react";

interface AttendanceSession {
  id: string;
  meetingNumber: number;
  title: string;
  date: string;
  status: "OPEN" | "CLOSED";
  accessCode?: string | null;
  records: Array<{
    id: string;
    studentUserId: string;
    status: "PRESENT" | "EXCUSED" | "SICK" | "ABSENT";
  }>;
}

interface StudentRecap {
  id: string;
  fullName: string;
  identifier: string;
  presentCount: number;
  excusedCount: number;
  sickCount: number;
  absentCount: number;
  attendancePercentage: number;
}

interface AttendanceTabProps {
  classCourseId: string;
  isInstructor: boolean;
  currentUserId: string;
}

export function AttendanceTab({
  classCourseId,
  isInstructor,
  currentUserId,
}: AttendanceTabProps) {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [studentRecap, setStudentRecap] = useState<StudentRecap[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal open session
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [meetingNumber, setMeetingNumber] = useState("");
  const [title, setTitle] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [submittingSession, setSubmittingSession] = useState(false);

  // Student check-in state
  const [checkInCode, setCheckInCode] = useState("");
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInMsg, setCheckInMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/classroom/classes/${classCourseId}/attendance`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal memuat presensi.");
      }
      const data = await res.json();
      setSessions(data.sessions || []);
      setStudentRecap(data.studentRecap || []);
      setTotalSessions(data.totalSessions || 0);
    } catch (err: any) {
      setError(err.message || "Gagal memuat presensi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [classCourseId]);

  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingSession(true);
      const res = await fetch(`/api/classroom/classes/${classCourseId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingNumber: meetingNumber ? parseInt(meetingNumber) : undefined,
          title: title.trim(),
          accessCode: accessCode.trim().toUpperCase() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal membuat sesi presensi.");
      }

      setShowOpenModal(false);
      setMeetingNumber("");
      setTitle("");
      setAccessCode("");
      await fetchAttendance();
    } catch (err: any) {
      alert(err.message || "Gagal membuka sesi.");
    } finally {
      setSubmittingSession(false);
    }
  };

  const handleMarkAllPresent = async (sessionId: string) => {
    if (!confirm("Tandai seluruh mahasiswa hadir untuk sesi ini?")) return;
    try {
      const records = studentRecap.map((s) => ({
        studentUserId: s.id,
        status: "PRESENT" as const,
      }));

      const res = await fetch(`/api/classroom/attendance/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });

      if (!res.ok) throw new Error("Gagal menandai seluruh mahasiswa.");
      await fetchAttendance();
    } catch (err: any) {
      alert(err.message || "Gagal memperbarui presensi.");
    }
  };

  const handleStatusChange = async (sessionId: string, studentUserId: string, newStatus: any) => {
    try {
      const res = await fetch(`/api/classroom/attendance/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: [{ studentUserId, status: newStatus }],
        }),
      });
      if (!res.ok) throw new Error("Gagal memperbarui status.");
      await fetchAttendance();
    } catch (err: any) {
      alert(err.message || "Gagal mengubah status presensi.");
    }
  };

  const handleCloseSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/classroom/attendance/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });
      if (!res.ok) throw new Error("Gagal menutup sesi.");
      await fetchAttendance();
    } catch (err: any) {
      alert(err.message || "Gagal menutup sesi.");
    }
  };

  const handleStudentCheckIn = async (sessionId: string) => {
    try {
      setCheckInLoading(true);
      setCheckInMsg(null);
      const res = await fetch(`/api/classroom/attendance/${sessionId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: checkInCode }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Gagal melakukan presensi.");
      }

      setCheckInMsg({ type: "success", text: "Presensi kehadiran Anda berhasil dicatat!" });
      setCheckInCode("");
      await fetchAttendance();
    } catch (err: any) {
      setCheckInMsg({ type: "error", text: err.message || "Gagal melakukan presensi." });
    } finally {
      setCheckInLoading(false);
    }
  };

  const activeSession = sessions.find((s) => s.status === "OPEN");
  const myRecordForActive = activeSession?.records.find((r) => r.studentUserId === currentUserId);
  const myRecap = studentRecap.find((s) => s.id === currentUserId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-[var(--tenant-accent,#1E40AF)] flex items-center justify-center">
            <CalendarCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#0F172A]">Presensi Perkuliahan</h2>
            <p className="text-xs text-slate-500">Pencatatan kehadiran sesi pertemuan dan evaluasi keaktifan</p>
          </div>
        </div>

        {isInstructor && (
          <button
            type="button"
            onClick={() => setShowOpenModal(true)}
            className="h-8 px-3.5 bg-[var(--tenant-accent,#1E40AF)] hover:opacity-95 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Buka Sesi Presensi Pertemuan</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STUDENT ACTIVE SESSION PROMPT */}
      {!isInstructor && activeSession && (
        <div className="p-5 bg-gradient-to-r from-blue-50 via-indigo-50/50 to-white border border-blue-200 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="font-bold text-xs text-blue-950 uppercase tracking-wide">
                Sesi Pertemuan Ke-{activeSession.meetingNumber} Sedang Dibuka
              </span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
              Status: OPEN
            </span>
          </div>

          <p className="text-xs text-slate-700">
            {activeSession.title} ({new Date(activeSession.date).toLocaleDateString("id-ID")})
          </p>

          {myRecordForActive ? (
            <div className="p-3 bg-emerald-100/70 border border-emerald-300/80 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Anda telah tercatat HADIR pada pertemuan ini.</span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              {activeSession.accessCode && (
                <div className="relative w-full sm:w-48">
                  <Key className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    maxLength={6}
                    value={checkInCode}
                    onChange={(e) => setCheckInCode(e.target.value.toUpperCase())}
                    placeholder="Kode Akses (6 digit)"
                    className="w-full h-9 pl-8 pr-3 text-xs bg-white text-[#0F172A] border border-slate-300 rounded-lg uppercase tracking-wider font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[var(--tenant-accent,#1E40AF)]"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => handleStudentCheckIn(activeSession.id)}
                disabled={checkInLoading}
                className="w-full sm:w-auto h-9 px-4 bg-[var(--tenant-accent,#1E40AF)] hover:opacity-95 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                {checkInLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <Check className="w-3.5 h-3.5" />
                <span>Konfirmasi Kehadiran Sekarang</span>
              </button>
            </div>
          )}

          {checkInMsg && (
            <div
              className={`p-3 text-xs rounded-xl flex items-center gap-2 ${
                checkInMsg.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              <span>{checkInMsg.text}</span>
            </div>
          )}
        </div>
      )}

      {/* STUDENT SUMMARY CARDS */}
      {!isInstructor && myRecap && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-xs text-center">
            <span className="text-[11px] text-slate-500 font-medium block">Total Pertemuan</span>
            <div className="text-xl font-bold text-[#0F172A] mt-1">{totalSessions}</div>
          </div>
          <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-xs text-center">
            <span className="text-[11px] text-emerald-600 font-medium block">Hadir</span>
            <div className="text-xl font-bold text-emerald-700 mt-1">{myRecap.presentCount}</div>
          </div>
          <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-xs text-center">
            <span className="text-[11px] text-amber-600 font-medium block">Izin / Sakit</span>
            <div className="text-xl font-bold text-amber-700 mt-1">{myRecap.excusedCount + myRecap.sickCount}</div>
          </div>
          <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-xs text-center">
            <span className="text-[11px] text-blue-600 font-medium block">Persentase</span>
            <div className="text-xl font-bold text-[var(--tenant-accent,#1E40AF)] mt-1">{myRecap.attendancePercentage}%</div>
          </div>
        </div>
      )}

      {/* SESSIONS LIST & RECAP TABLE */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--tenant-accent,#1E40AF)]" />
          <span>Memuat sesi presensi...</span>
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-slate-500 text-xs">
          Belum ada sesi presensi yang dibuat untuk kelas ini.
        </div>
      ) : (
        <div className="space-y-6">
          {/* TEACHER: SESSIONS DETAIL LIST */}
          {isInstructor && (
            <div className="space-y-4">
              <h3 className="font-bold text-xs text-[#0F172A] uppercase tracking-wider">
                Daftar Sesi Pertemuan
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sessions.map((sess) => (
                  <div key={sess.id} className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#0F172A]">
                        Pertemuan {sess.meetingNumber}: {sess.title}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          sess.status === "OPEN"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {sess.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                      <span>Tanggal: {new Date(sess.date).toLocaleDateString("id-ID")}</span>
                      {sess.accessCode && (
                        <span className="font-mono bg-blue-50 text-[var(--tenant-accent,#1E40AF)] px-2 py-0.5 rounded border border-blue-200 font-bold">
                          Kode: {sess.accessCode}
                        </span>
                      )}
                      <span>Tercatat: {sess.records.filter((r) => r.status === "PRESENT").length} Hadir</span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleMarkAllPresent(sess.id)}
                        className="h-7 px-2.5 bg-blue-50 text-[var(--tenant-accent,#1E40AF)] hover:bg-blue-100 text-[11px] font-semibold rounded-md transition"
                      >
                        Tandai Semua Hadir
                      </button>
                      {sess.status === "OPEN" && (
                        <button
                          type="button"
                          onClick={() => handleCloseSession(sess.id)}
                          className="h-7 px-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-[11px] font-semibold rounded-md transition"
                        >
                          Tutup Sesi
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TABLE REKAP PRESENSI MAHASISWA */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-xs text-[#0F172A]">
                {isInstructor ? "Matriks Presensi Seluruh Mahasiswa" : "Riwayat Kehadiran Saya"}
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="px-4 py-3">Nama Mahasiswa</th>
                    <th className="px-3 py-3 text-center">NIM</th>
                    <th className="px-3 py-3 text-center">Hadir</th>
                    <th className="px-3 py-3 text-center">Izin</th>
                    <th className="px-3 py-3 text-center">Sakit</th>
                    <th className="px-3 py-3 text-center">Alfa</th>
                    <th className="px-4 py-3 text-center">% Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(isInstructor ? studentRecap : studentRecap.filter((s) => s.id === currentUserId)).map((st) => (
                    <tr key={st.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-semibold text-[#0F172A]">{st.fullName}</td>
                      <td className="px-3 py-3 text-center font-mono text-slate-500">{st.identifier}</td>
                      <td className="px-3 py-3 text-center font-bold text-emerald-700">{st.presentCount}</td>
                      <td className="px-3 py-3 text-center text-blue-700">{st.excusedCount}</td>
                      <td className="px-3 py-3 text-center text-amber-700">{st.sickCount}</td>
                      <td className="px-3 py-3 text-center text-red-600">{st.absentCount}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                            st.attendancePercentage >= 75
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {st.attendancePercentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Buka Sesi */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-[#0F172A]">Buka Sesi Presensi Pertemuan</h3>
              <button
                type="button"
                onClick={() => setShowOpenModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOpenSession} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pertemuan Ke-</label>
                <input
                  type="number"
                  min={1}
                  value={meetingNumber}
                  onChange={(e) => setMeetingNumber(e.target.value)}
                  placeholder="Otomatis (berikutnya)"
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[var(--tenant-accent,#1E40AF)]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Judul / Topik Pertemuan</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Mis. Pertemuan 3: Diagram Aktivitas & Use Case"
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[var(--tenant-accent,#1E40AF)]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kode Akses Mandiri Mahasiswa (Opsional)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  placeholder="Contoh: HADIR3"
                  className="w-full h-9 px-3 font-mono uppercase bg-white border border-slate-300 rounded-lg text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[var(--tenant-accent,#1E40AF)]"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Jika diisi, mahasiswa harus memasukkan kode ini untuk konfirmasi hadir.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowOpenModal(false)}
                  className="h-8 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingSession}
                  className="h-8 px-4 bg-[var(--tenant-accent,#1E40AF)] hover:opacity-95 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs"
                >
                  {submittingSession && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>Buka Sesi Presensi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
