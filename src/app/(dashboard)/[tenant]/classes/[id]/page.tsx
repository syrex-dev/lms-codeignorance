"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { getTerminology } from "@/lib/i18n/terminology";

export default function ClassroomDetailPage() {
  const params = useParams();
  const tenantSlug = params.tenant as string;
  const classId = params.id as string;
  const router = useRouter();
  const { data: session } = useSession();

  const [classDetail, setClassDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"BERANDA" | "MATERI" | "ANGGOTA">("BERANDA");
  const [previewAsStudent, setPreviewAsStudent] = useState(false);

  // Modal states
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicDesc, setTopicDesc] = useState("");
  const [topicMeeting, setTopicMeeting] = useState("");
  const [topicStatus, setTopicStatus] = useState("PUBLISHED");

  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [materialType, setMaterialType] = useState<"RICH_TEXT" | "FILE" | "VIDEO_LINK" | "EXTERNAL_LINK">("RICH_TEXT");
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialContent, setMaterialContent] = useState("");
  const [materialUrl, setMaterialUrl] = useState("");
  const [materialStatus, setMaterialStatus] = useState("PUBLISHED");
  const [materialIsRequired, setMaterialIsRequired] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const isSchool = tenantSlug.toLowerCase().includes("sman") || tenantSlug.toLowerCase().includes("sekolah");
  const t = getTerminology(isSchool ? "SCHOOL" : "UNIVERSITY");

  async function loadDetail() {
    try {
      setLoading(true);
      setError(null);
      const url = `/api/classroom/classes/${classId}${previewAsStudent ? "?preview=true" : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memuat informasi kelas.");
      }
      setClassDetail(data.classDetail);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetail();
  }, [classId, previewAsStudent]);

  // Handle Mark Completed
  async function handleToggleComplete(materialId: string) {
    try {
      const res = await fetch(`/api/classroom/materials/${materialId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "COMPLETE" }),
      });
      if (res.ok) {
        await loadDetail();
      }
    } catch (err) {
      console.error("Failed to mark completed:", err);
    }
  }

  // Handle Create Topic
  async function handleCreateTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!topicTitle.trim()) return;

    try {
      setActionLoading(true);
      const res = await fetch(`/api/classroom/classes/${classId}/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: topicTitle,
          description: topicDesc,
          meetingNumber: topicMeeting ? parseInt(topicMeeting, 10) : undefined,
          status: topicStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat topik.");

      setShowTopicModal(false);
      setTopicTitle("");
      setTopicDesc("");
      setTopicMeeting("");
      await loadDetail();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  // Handle Create Material
  async function handleCreateMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTopicId || !materialTitle.trim()) return;

    try {
      setActionLoading(true);
      const res = await fetch(`/api/classroom/topics/${selectedTopicId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: materialType,
          title: materialTitle,
          content: materialType === "RICH_TEXT" ? materialContent : undefined,
          videoUrl: materialType === "VIDEO_LINK" ? materialUrl : undefined,
          url: materialType === "EXTERNAL_LINK" ? materialUrl : undefined,
          status: materialStatus,
          isRequired: materialIsRequired,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat materi.");

      setShowMaterialModal(false);
      setMaterialTitle("");
      setMaterialContent("");
      setMaterialUrl("");
      await loadDetail();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  // Handle Reorder Topic Up/Down
  async function handleMoveTopic(topicIndex: number, direction: "UP" | "DOWN") {
    if (!classDetail?.topics) return;
    const topics = [...classDetail.topics];
    const targetIndex = direction === "UP" ? topicIndex - 1 : topicIndex + 1;
    if (targetIndex < 0 || targetIndex >= topics.length) return;

    const [moved] = topics.splice(topicIndex, 1);
    topics.splice(targetIndex, 0, moved);

    const topicIds = topics.map((t) => t.id);

    try {
      await fetch(`/api/classroom/classes/${classId}/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicIds }),
      });
      await loadDetail();
    } catch (err) {
      console.error("Failed to reorder topics:", err);
    }
  }

  // Handle Delete Topic
  async function handleDeleteTopic(topicId: string) {
    if (!confirm("Apakah Anda yakin ingin menghapus topik ini beserta seluruh materinya?")) return;
    try {
      await fetch(`/api/classroom/topics/${topicId}`, { method: "DELETE" });
      await loadDetail();
    } catch (err) {
      console.error("Failed to delete topic:", err);
    }
  }

  // Handle Delete Material
  async function handleDeleteMaterial(materialId: string) {
    if (!confirm("Hapus materi ini?")) return;
    try {
      await fetch(`/api/classroom/materials/${materialId}`, { method: "DELETE" });
      await loadDetail();
    } catch (err) {
      console.error("Failed to delete material:", err);
    }
  }

  if (loading && !classDetail) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-800 rounded w-1/4"></div>
        <div className="h-4 bg-slate-800 rounded w-1/2"></div>
        <div className="h-64 bg-slate-900 rounded-2xl"></div>
      </div>
    );
  }

  if (error || !classDetail) {
    return (
      <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
        <div className="text-4xl mb-3">⚠️</div>
        <h2 className="text-base font-bold text-white">Akses Kelas Ditolak atau Kelas Tidak Ditemukan</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">{error || "Objek kelas tidak tersedia."}</p>
        <Link
          href={`/${tenantSlug}/classes`}
          className="inline-block mt-4 text-xs font-semibold text-indigo-400 hover:underline"
        >
          ← Kembali ke Daftar {t.classRoom}
        </Link>
      </div>
    );
  }

  const isTeacher = classDetail.isTeacher;
  const canEdit = (isTeacher || classDetail.isAdmin) && !previewAsStudent;

  return (
    <div className="space-y-6">
      {/* Banner & Breadcrumb */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 mb-1">
              <Link href={`/${tenantSlug}/classes`} className="hover:underline">
                {t.classRoom}
              </Link>
              <span>/</span>
              <span>{classDetail.code}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              {classDetail.name}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {classDetail.academicTerm?.name} • {classDetail.roomName ? `Ruang: ${classDetail.roomName}` : t.institutionLabel} • {classDetail.enrollmentCount} {t.student} Terdaftar
            </p>
          </div>

          {/* Mode Pratinjau untuk Pengajar */}
          {isTeacher && (
            <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-2xl">
              <span className="text-xs font-semibold text-slate-300">Pratinjau Siswa</span>
              <button
                type="button"
                onClick={() => setPreviewAsStudent(!previewAsStudent)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  previewAsStudent ? "bg-indigo-600" : "bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    previewAsStudent ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          )}
        </div>

        {/* Progress Bar (Untuk Siswa atau Mode Pratinjau) */}
        {(classDetail.isEnrolled || previewAsStudent) && (
          <div className="mt-5 pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-300">Progres Belajar Anda</span>
              <span className="font-mono font-bold text-indigo-400">{classDetail.progressPercentage}% Selesai</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${classDetail.progressPercentage}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab("BERANDA")}
          className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === "BERANDA"
              ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <span>🏠</span> Beranda
        </button>
        <button
          onClick={() => setActiveTab("MATERI")}
          className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === "MATERI"
              ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <span>📖</span> Materi Pembelajaran
        </button>
        <button
          onClick={() => setActiveTab("ANGGOTA")}
          className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === "ANGGOTA"
              ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <span>👥</span> Anggota Kelas
        </button>

        {/* Placeholder Tabs (Tugas, Kuis, Presensi) */}
        {["Tugas", "Kuis", "Diskusi", "Presensi", "Nilai"].map((tab) => (
          <button
            key={tab}
            disabled
            className="py-2 px-3 rounded-xl text-xs font-medium text-slate-600 cursor-not-allowed flex items-center gap-1.5 opacity-60"
          >
            <span>{tab}</span>
            <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono">Fase 4</span>
          </button>
        ))}
      </div>

      {/* TAB 1: BERANDA */}
      {activeTab === "BERANDA" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📌</span> Informasi & Deskripsi {t.course}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {classDetail.description || "Tidak ada deskripsi pengantar untuk kelas ini."}
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📑</span> Topik Pembelajaran Terbaru
              </h3>
              {classDetail.topics.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">Belum ada topik materi yang diterbitkan.</p>
              ) : (
                <div className="space-y-2">
                  {classDetail.topics.slice(0, 3).map((topic: any, idx: number) => (
                    <div
                      key={topic.id}
                      onClick={() => setActiveTab("MATERI")}
                      className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl hover:border-slate-700 cursor-pointer transition flex items-center justify-between"
                    >
                      <div>
                        <span className="text-[10px] font-mono text-indigo-400 font-semibold uppercase">
                          {t.meeting} {topic.meetingNumber || idx + 1}
                        </span>
                        <div className="text-xs font-bold text-white">{topic.title}</div>
                      </div>
                      <span className="text-xs text-slate-500">
                        {topic.materials?.length || 0} Materi →
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>👨‍🏫</span> {t.teacher} Pengampu
              </h3>
              <div className="space-y-3">
                {classDetail.instructors.map((inst: any) => (
                  <div key={inst.id} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-600/30 border border-indigo-500 flex items-center justify-center font-bold text-xs text-indigo-300">
                      {inst.instructor.fullName.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{inst.instructor.fullName}</div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {inst.isPrimary ? `${t.teacher} Utama` : `${t.teacher} Pendamping`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MATERI PEMBELAJARAN */}
      {activeTab === "MATERI" && (
        <div className="space-y-6">
          {/* Action Bar Guru */}
          {canEdit && (
            <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 p-3 rounded-2xl">
              <span className="text-xs text-slate-400">Kelola kurikulum dan materi pembelajaran:</span>
              <button
                type="button"
                onClick={() => setShowTopicModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-1.5 px-3 rounded-xl text-xs transition flex items-center gap-1.5 shadow"
              >
                <span>➕</span> Tambah Topik
              </button>
            </div>
          )}

          {/* Daftar Topik & Materi */}
          {classDetail.topics.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl p-6">
              <div className="text-4xl mb-3">📚</div>
              <h3 className="text-sm font-bold text-white">Belum Ada Topik Pembelajaran</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {canEdit
                  ? "Klik tombol Tambah Topik di atas untuk mulai membuat kurikulum kelas ini."
                  : "Pengajar belum menerbitkan materi pembelajaran."}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {classDetail.topics.map((topic: any, topicIdx: number) => (
                <div
                  key={topic.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm"
                >
                  {/* Topic Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-indigo-950 text-indigo-300 font-mono font-bold px-2 py-0.5 rounded">
                          {t.meeting} {topic.meetingNumber || topicIdx + 1}
                        </span>
                        {canEdit && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              topic.status === "PUBLISHED"
                                ? "bg-emerald-950 text-emerald-400"
                                : topic.status === "DRAFT"
                                ? "bg-amber-950 text-amber-400"
                                : "bg-blue-950 text-blue-400"
                            }`}
                          >
                            {topic.status}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-white mt-1">{topic.title}</h3>
                      {topic.description && (
                        <p className="text-xs text-slate-400 mt-0.5">{topic.description}</p>
                      )}
                    </div>

                    {/* Topic Actions (Guru) */}
                    {canEdit && (
                      <div className="flex items-center gap-1.5 self-end md:self-auto">
                        <button
                          type="button"
                          onClick={() => handleMoveTopic(topicIdx, "UP")}
                          disabled={topicIdx === 0}
                          title="Naikkan Urutan"
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg text-xs"
                        >
                          ⬆️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveTopic(topicIdx, "DOWN")}
                          disabled={topicIdx === classDetail.topics.length - 1}
                          title="Turunkan Urutan"
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg text-xs"
                        >
                          ⬇️
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTopicId(topic.id);
                            setShowMaterialModal(true);
                          }}
                          className="bg-indigo-600/80 hover:bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium transition"
                        >
                          ➕ Materi
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTopic(topic.id)}
                          className="text-red-400 hover:text-red-300 p-1.5 text-xs"
                          title="Hapus Topik"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Materials List */}
                  {topic.materials.length === 0 ? (
                    <p className="text-xs text-slate-500 py-3 text-center italic">
                      Belum ada materi dalam topik ini.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {topic.materials.map((mat: any) => {
                        const isDone = mat.progress?.isCompleted;

                        return (
                          <div
                            key={mat.id}
                            className={`p-4 rounded-xl border transition ${
                              isDone
                                ? "bg-slate-950/80 border-emerald-900/50"
                                : "bg-slate-950/50 border-slate-800 hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1.5 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs">
                                    {mat.type === "RICH_TEXT" && "📝"}
                                    {mat.type === "FILE" && "📁"}
                                    {mat.type === "VIDEO_LINK" && "🎬"}
                                    {mat.type === "EXTERNAL_LINK" && "🔗"}
                                  </span>
                                  <h4 className="text-sm font-bold text-white">{mat.title}</h4>
                                  {mat.isRequired && (
                                    <span className="text-[10px] bg-red-950/80 text-red-400 font-semibold px-1.5 py-0.2 rounded">
                                      Wajib
                                    </span>
                                  )}
                                  {canEdit && mat.status !== "PUBLISHED" && (
                                    <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.2 rounded font-mono">
                                      {mat.status}
                                    </span>
                                  )}
                                </div>

                                {/* Rich Text Content (Sanitized) */}
                                {mat.type === "RICH_TEXT" && mat.content && (
                                  <div
                                    className="text-xs text-slate-300 leading-relaxed prose prose-invert max-w-none pt-1"
                                    dangerouslySetInnerHTML={{ __html: mat.content }}
                                  />
                                )}

                                {/* Video Player (YouTube Safe Embed) */}
                                {mat.type === "VIDEO_LINK" && mat.videoUrl && (
                                  <div className="pt-2">
                                    <div className="relative aspect-video max-w-md rounded-xl overflow-hidden border border-slate-800">
                                      <iframe
                                        src={mat.videoUrl}
                                        title={mat.title}
                                        className="w-full h-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* External Link */}
                                {mat.type === "EXTERNAL_LINK" && mat.url && (
                                  <div className="pt-1">
                                    <a
                                      href={mat.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                                    >
                                      <span>Buka Tautan: {mat.url}</span>
                                      <span>↗</span>
                                    </a>
                                  </div>
                                )}

                                {/* Download Files */}
                                {mat.files && mat.files.length > 0 && (
                                  <div className="pt-2 space-y-1.5">
                                    {mat.files.map((f: any) => (
                                      <a
                                        key={f.id}
                                        href={f.downloadUrl}
                                        className="inline-flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 text-xs text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition"
                                      >
                                        <span>⬇️</span>
                                        <span className="font-medium">{f.fileName}</span>
                                        <span className="text-[10px] text-slate-400">
                                          ({Math.round(f.fileSize / 1024)} KB)
                                        </span>
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Student Checkmark / Action */}
                              <div className="flex items-center gap-2">
                                {(classDetail.isEnrolled || previewAsStudent) && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleComplete(mat.id)}
                                    className={`text-xs px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
                                      isDone
                                        ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                        : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                                    }`}
                                  >
                                    <span>{isDone ? "✓ Selesai" : "Tandai Selesai"}</span>
                                  </button>
                                )}

                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMaterial(mat.id)}
                                    className="text-red-400 hover:text-red-300 p-1 text-xs"
                                    title="Hapus Materi"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ANGGOTA KELAS (Tanpa Data Pribadi PII) */}
      {activeTab === "ANGGOTA" && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Daftar Anggota Kelas</h3>
            <span className="text-xs text-slate-400 font-mono">
              Total: {classDetail.members?.length || 0} orang
            </span>
          </div>

          <div className="divide-y divide-slate-800/80">
            {classDetail.members?.map((member: any) => (
              <div key={member.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                      member.role === "PENGAJAR"
                        ? "bg-indigo-600/30 border border-indigo-500 text-indigo-300"
                        : "bg-slate-800 border border-slate-700 text-slate-300"
                    }`}
                  >
                    {member.fullName.charAt(0)}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{member.fullName}</div>
                    <div className="text-[10px] text-slate-400">
                      {member.role === "PENGAJAR" ? t.teacher : t.student}
                    </div>
                  </div>
                </div>

                <span
                  className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${
                    member.role === "PENGAJAR"
                      ? "bg-indigo-950 text-indigo-300 border border-indigo-800"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {member.role === "PENGAJAR" ? (member.isPrimary ? `${t.teacher} Utama` : t.teacher) : t.student}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL TAMBAH TOPIK */}
      {showTopicModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Tambah Topik Pembelajaran Baru</h3>
            <form onSubmit={handleCreateTopic} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Nomor {t.meeting} (Opsional)
                </label>
                <input
                  type="number"
                  value={topicMeeting}
                  onChange={(e) => setTopicMeeting(e.target.value)}
                  placeholder="Contoh: 1"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Judul Topik *
                </label>
                <input
                  type="text"
                  required
                  value={topicTitle}
                  onChange={(e) => setTopicTitle(e.target.value)}
                  placeholder="Contoh: Pengenalan Dasar & Silabus"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Deskripsi / Capaian Pembelajaran
                </label>
                <textarea
                  rows={2}
                  value={topicDesc}
                  onChange={(e) => setTopicDesc(e.target.value)}
                  placeholder="Ringkasan target dan materi yang dibahas..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Status Publikasi</label>
                <select
                  value={topicStatus}
                  onChange={(e) => setTopicStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="PUBLISHED">PUBLISHED (Langsung Terbit)</option>
                  <option value="DRAFT">DRAFT (Disimpan Pribadi)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowTopicModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-xl text-xs font-semibold"
                >
                  {actionLoading ? "Menyimpan..." : "Simpan Topik"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH MATERI */}
      {showMaterialModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Tambah Materi Pembelajaran</h3>
            <form onSubmit={handleCreateMaterial} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Tipe Materi</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMaterialType("RICH_TEXT")}
                    className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 ${
                      materialType === "RICH_TEXT"
                        ? "bg-indigo-950 border-indigo-500 text-indigo-300"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    <span>📝</span> Teks Kaya
                  </button>
                  <button
                    type="button"
                    onClick={() => setMaterialType("VIDEO_LINK")}
                    className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 ${
                      materialType === "VIDEO_LINK"
                        ? "bg-indigo-950 border-indigo-500 text-indigo-300"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    <span>🎬</span> Video
                  </button>
                  <button
                    type="button"
                    onClick={() => setMaterialType("EXTERNAL_LINK")}
                    className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 ${
                      materialType === "EXTERNAL_LINK"
                        ? "bg-indigo-950 border-indigo-500 text-indigo-300"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    <span>🔗</span> Tautan
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Judul Materi *</label>
                <input
                  type="text"
                  required
                  value={materialTitle}
                  onChange={(e) => setMaterialTitle(e.target.value)}
                  placeholder="Contoh: Modul 1 - Teori Dasar"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              {materialType === "RICH_TEXT" && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Konten Materi (Teks/HTML)</label>
                  <textarea
                    rows={4}
                    value={materialContent}
                    onChange={(e) => setMaterialContent(e.target.value)}
                    placeholder="Tuliskan materi pelajaran di sini..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Konten otomatis disanitasi di server (bebas dari script & event handlers berbahaya).
                  </p>
                </div>
              )}

              {(materialType === "VIDEO_LINK" || materialType === "EXTERNAL_LINK") && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    {materialType === "VIDEO_LINK" ? "URL Video (YouTube / Drive / Vimeo) *" : "URL Tautan *"}
                  </label>
                  <input
                    type="url"
                    required
                    value={materialUrl}
                    onChange={(e) => setMaterialUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Status Publikasi</label>
                  <select
                    value={materialStatus}
                    onChange={(e) => setMaterialStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="PUBLISHED">PUBLISHED</option>
                    <option value="DRAFT">DRAFT</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="isRequired"
                    checked={materialIsRequired}
                    onChange={(e) => setMaterialIsRequired(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-indigo-600"
                  />
                  <label htmlFor="isRequired" className="text-xs text-slate-300 cursor-pointer">
                    Wajib Diselesaikan
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowMaterialModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-xl text-xs font-semibold"
                >
                  {actionLoading ? "Menyimpan..." : "Simpan Materi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
