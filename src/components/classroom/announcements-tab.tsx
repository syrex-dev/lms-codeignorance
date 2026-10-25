"use client";

import React, { useState, useEffect } from "react";
import {
  Pin,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Megaphone,
  BookOpen,
  FileText,
} from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  author: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
  };
}

interface AnnouncementsTabProps {
  classCourseId: string;
  isInstructor: boolean;
  classDetail: any;
  primaryInstructor: string;
}

export function AnnouncementsTab({
  classCourseId,
  isInstructor,
  classDetail,
  primaryInstructor,
}: AnnouncementsTabProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal create
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/classroom/classes/${classCourseId}/announcements`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal memuat pengumuman kelas.");
      }
      const data = await res.json();
      setAnnouncements(data.announcements || []);
    } catch (err: any) {
      setError(err.message || "Gagal memuat pengumuman.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, [classCourseId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setModalError("Judul dan isi pengumuman wajib diisi.");
      return;
    }

    try {
      setSubmitting(true);
      setModalError(null);
      const res = await fetch(`/api/classroom/classes/${classCourseId}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, isPinned }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal mempublikasikan pengumuman.");
      }

      setShowCreateModal(false);
      setTitle("");
      setContent("");
      setIsPinned(false);
      await fetchAnnouncements();
    } catch (err: any) {
      setModalError(err.message || "Gagal mempublikasikan pengumuman.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (announcementId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus pengumuman ini?")) return;
    try {
      const res = await fetch(`/api/classroom/announcements/${announcementId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal menghapus pengumuman.");
      }
      setAnnouncements((prev) => prev.filter((a) => a.id !== announcementId));
    } catch (err: any) {
      alert(err.message || "Gagal menghapus pengumuman.");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Kolom Kiri: Daftar Pengumuman Kelas (Lebar 2/3) */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[var(--tenant-accent,#1E40AF)] flex items-center justify-center">
              <Megaphone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A]">Pengumuman & Informasi Kelas</h2>
              <p className="text-xs text-slate-500">Pemberitahuan resmi dari dosen pengampu</p>
            </div>
          </div>

          {isInstructor && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="h-8 px-3.5 bg-[var(--tenant-accent,#1E40AF)] hover:opacity-95 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buat Pengumuman</span>
            </button>
          )}
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--tenant-accent,#1E40AF)]" />
            <span>Memuat pengumuman kelas...</span>
          </div>
        ) : announcements.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-slate-500 text-xs">
            Belum ada pengumuman untuk kelas ini.
          </div>
        ) : (
          <div className="space-y-3.5">
            {announcements.map((item) => (
              <div
                key={item.id}
                className={`bg-white border rounded-2xl p-5 shadow-xs transition ${
                  item.isPinned
                    ? "border-blue-300 bg-gradient-to-r from-blue-50/40 via-white to-slate-50/30"
                    : "border-slate-200/80"
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[var(--tenant-accent,#1E40AF)] text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {item.author.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-[#0F172A]">{item.author.fullName}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(item.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.isPinned && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-[var(--tenant-accent,#1E40AF)] border border-blue-200 rounded-full text-[10px] font-semibold">
                        <Pin className="w-3 h-3 fill-current" />
                        <span>Disematkan</span>
                      </span>
                    )}
                    {isInstructor && (
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="font-bold text-sm text-[#0F172A] mb-1.5">{item.title}</h3>
                <div
                  className="text-xs text-slate-700 leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: item.content }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kolom Kanan: Deskripsi & Silabus (Lebar 1/3) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4 h-fit">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-[var(--tenant-accent,#1E40AF)] flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#0F172A]">Silabus & Informasi Kuliah</h2>
            <p className="text-xs text-slate-500">Katalog standar akademik</p>
          </div>
        </div>

        <div className="text-xs text-slate-700 leading-relaxed space-y-3">
          <p>
            Mata kuliah <strong>{classDetail.name}</strong> ({classDetail.code}) dirancang untuk memberikan pemahaman menyeluruh dan keterampilan praktis sesuai dengan kurikulum standar institusi.
          </p>

          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Beban Kredit:</span>
              <span className="font-semibold text-[#0F172A]">{classDetail.credits || 3} SKS</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tahun Akademik:</span>
              <span className="font-semibold text-[#0F172A]">{classDetail.academicTerm?.name || "Semester Aktif"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Ruang Kelas:</span>
              <span className="font-semibold text-[#0F172A]">{classDetail.roomName || "LAB-KOMP-1"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Dosen Pengampu:</span>
              <span className="font-semibold text-[#0F172A] text-right">{primaryInstructor}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Buat Pengumuman */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-[#0F172A]">Buat Pengumuman Baru</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Judul Pengumuman</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Mis. Informasi Perubahan Jadwal Pertemuan 5"
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[var(--tenant-accent,#1E40AF)]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Isi Pengumuman</label>
                <textarea
                  rows={5}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Tuliskan detail pengumuman yang akan dibaca seluruh mahasiswa kelas ini..."
                  className="w-full p-3 bg-white border border-slate-300 rounded-lg text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[var(--tenant-accent,#1E40AF)]"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pinCheck"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="rounded border-slate-300 text-[var(--tenant-accent,#1E40AF)]"
                />
                <label htmlFor="pinCheck" className="text-slate-700 font-medium cursor-pointer">
                  Sematkan pengumuman ini di bagian paling atas
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="h-8 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-8 px-4 bg-[var(--tenant-accent,#1E40AF)] hover:opacity-95 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>Publikasikan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
