"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { getTerminology, getRoleBadgeLabel } from "@/lib/i18n/terminology";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Paperclip,
  Video,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Eye,
  Users,
  BookOpen,
  ArrowLeft,
  Loader2,
  X,
} from "lucide-react";

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
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-[#E3E6EB] rounded w-1/4"></div>
        <div className="h-4 bg-[#E3E6EB] rounded w-1/2"></div>
        <div className="h-48 bg-white border border-[#E3E6EB] rounded-[6px]"></div>
      </div>
    );
  }

  if (error || !classDetail) {
    return (
      <div className="text-center py-12 bg-white border border-[#E3E6EB] rounded-[6px] p-6">
        <h2 className="text-base font-semibold text-[#111827]">
          Akses kelas ditolak atau kelas tidak ditemukan
        </h2>
        <p className="text-xs text-[#4B5563] mt-1 max-w-md mx-auto">
          {error || "Objek kelas tidak tersedia atau sesi Anda tidak memiliki hak akses."}
        </p>
        <Link
          href={`/${tenantSlug}/classes`}
          className="inline-flex items-center gap-1.5 mt-4 text-xs font-medium text-[#1F4E8C] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span>Kembali ke daftar {t.classRoom.toLowerCase()}</span>
        </Link>
      </div>
    );
  }

  const isTeacher = classDetail.isTeacher;
  const canEdit = (isTeacher || classDetail.isAdmin) && !previewAsStudent;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Class Header */}
      <div className="bg-white border border-[#E3E6EB] rounded-[6px] p-5 shadow-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#4B5563] mb-1">
              <Link href={`/${tenantSlug}/classes`} className="hover:underline">
                {t.classRoom}
              </Link>
              <span>/</span>
              <span className="font-mono font-medium text-[#111827]">{classDetail.code}</span>
            </div>
            <h1 className="text-2xl font-semibold text-[#111827] tracking-tight">
              {classDetail.name}
            </h1>
            <p className="text-xs text-[#4B5563] mt-1">
              {classDetail.academicTerm?.name} • {classDetail.roomName ? `Ruang: ${classDetail.roomName}` : t.institutionLabel} • {classDetail.enrollmentCount} {t.student.toLowerCase()} terdaftar
            </p>
          </div>

          {/* Mode Pratinjau Siswa untuk Guru */}
          {isTeacher && (
            <div className="flex items-center gap-3 bg-[#F6F7F9] border border-[#E3E6EB] px-3.5 py-2 rounded-[6px] self-start md:self-auto">
              <span className="text-xs font-medium text-[#4B5563]">Pratinjau sebagai siswa</span>
              <button
                type="button"
                onClick={() => setPreviewAsStudent(!previewAsStudent)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                  previewAsStudent ? "bg-[#1F4E8C]" : "bg-[#CBD5E1]"
                }`}
                aria-label="Toggle pratinjau siswa"
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    previewAsStudent ? "translate-x-4" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          )}
        </div>

        {/* 4px Progress Bar (Siswa atau Mode Pratinjau) */}
        {(classDetail.isEnrolled || previewAsStudent) && (
          <div className="mt-4 pt-3 border-t border-[#E3E6EB]">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[#4B5563]">Progres belajar Anda</span>
              <span className="font-mono font-semibold text-[#1F4E8C]">
                {classDetail.progressPercentage}%
              </span>
            </div>
            <div className="w-full bg-[#E5E7EB] rounded-full h-1 overflow-hidden">
              <div
                className="bg-[#1F4E8C] h-1 rounded-full transition-all duration-300"
                style={{ width: `${classDetail.progressPercentage}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Underline Tabs Navigation */}
      <div className="border-b border-[#E3E6EB] flex items-center gap-6 text-sm">
        <button
          type="button"
          onClick={() => setActiveTab("BERANDA")}
          className={`pb-2.5 -mb-px flex items-center gap-2 text-xs font-medium transition-colors border-b-2 ${
            activeTab === "BERANDA"
              ? "border-[#1F4E8C] text-[#1F4E8C] font-semibold"
              : "border-transparent text-[#4B5563] hover:text-[#111827]"
          }`}
        >
          <BookOpen className="w-4 h-4" strokeWidth={1.5} />
          <span>Beranda</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("MATERI")}
          className={`pb-2.5 -mb-px flex items-center gap-2 text-xs font-medium transition-colors border-b-2 ${
            activeTab === "MATERI"
              ? "border-[#1F4E8C] text-[#1F4E8C] font-semibold"
              : "border-transparent text-[#4B5563] hover:text-[#111827]"
          }`}
        >
          <FileText className="w-4 h-4" strokeWidth={1.5} />
          <span>Materi Pembelajaran</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ANGGOTA")}
          className={`pb-2.5 -mb-px flex items-center gap-2 text-xs font-medium transition-colors border-b-2 ${
            activeTab === "ANGGOTA"
              ? "border-[#1F4E8C] text-[#1F4E8C] font-semibold"
              : "border-transparent text-[#4B5563] hover:text-[#111827]"
          }`}
        >
          <Users className="w-4 h-4" strokeWidth={1.5} />
          <span>Anggota Kelas</span>
        </button>
      </div>

      {/* TAB 1: BERANDA */}
      {activeTab === "BERANDA" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div className="bg-white border border-[#E3E6EB] rounded-[6px] p-5 shadow-none space-y-2">
              <h3 className="text-sm font-semibold text-[#111827]">
                Informasi & deskripsi {t.course.toLowerCase()}
              </h3>
              <p className="text-xs text-[#4B5563] leading-relaxed">
                {classDetail.description || `Mata pelajaran/kuliah ${classDetail.name} pada periode akademik berjalan.`}
              </p>
            </div>

            <div className="bg-white border border-[#E3E6EB] rounded-[6px] p-5 shadow-none space-y-3">
              <h3 className="text-sm font-semibold text-[#111827]">
                Topik pembelajaran
              </h3>
              {classDetail.topics.length === 0 ? (
                <p className="text-xs text-[#6B7280] py-4 text-center">
                  Belum ada topik materi yang diterbitkan.
                </p>
              ) : (
                <div className="divide-y divide-[#E3E6EB]">
                  {classDetail.topics.slice(0, 4).map((topic: any, idx: number) => (
                    <div
                      key={topic.id}
                      onClick={() => setActiveTab("MATERI")}
                      className="py-2.5 flex items-center justify-between cursor-pointer hover:bg-[#F6F7F9] px-2 rounded transition"
                    >
                      <div>
                        <span className="text-[11px] font-mono font-medium text-[#1F4E8C]">
                          {t.meeting} {topic.meetingNumber || idx + 1}
                        </span>
                        <div className="text-xs font-medium text-[#111827]">{topic.title}</div>
                      </div>
                      <span className="text-xs text-[#6B7280]">
                        {topic.materials?.length || 0} materi
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white border border-[#E3E6EB] rounded-[6px] p-5 shadow-none space-y-3">
              <h3 className="text-sm font-semibold text-[#111827]">
                {t.teacher} pengampu
              </h3>
              <div className="space-y-2.5">
                {classDetail.instructors.map((inst: any) => (
                  <div key={inst.id} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#1F4E8C] text-white flex items-center justify-center font-semibold text-xs shrink-0">
                      {inst.instructor.fullName.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[#111827]">{inst.instructor.fullName}</div>
                      <div className="text-[11px] text-[#6B7280]">
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
        <div className="space-y-4">
          {/* Action Bar Guru */}
          {canEdit && (
            <div className="flex items-center justify-between bg-white border border-[#E3E6EB] p-3 rounded-[6px]">
              <span className="text-xs text-[#4B5563]">Kelola kurikulum dan materi pembelajaran:</span>
              <button
                type="button"
                onClick={() => setShowTopicModal(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 bg-[#1F4E8C] hover:bg-[#183E6F] text-white text-xs font-medium rounded-[6px] transition focus:outline-none focus:ring-2 focus:ring-[#1F4E8C]"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Tambah Topik</span>
              </button>
            </div>
          )}

          {/* Daftar Topik & Materi */}
          {classDetail.topics.length === 0 ? (
            <EmptyState
              title="Belum ada topik pembelajaran"
              description={
                canEdit
                  ? "Klik tombol Tambah Topik di atas untuk mulai membuat kurikulum kelas ini."
                  : "Pengajar belum menerbitkan materi pembelajaran untuk kelas ini."
              }
            />
          ) : (
            <div className="space-y-4">
              {classDetail.topics.map((topic: any, topicIdx: number) => (
                <div
                  key={topic.id}
                  className="bg-white border border-[#E3E6EB] rounded-[6px] p-4 space-y-3 shadow-none"
                >
                  {/* Topic Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[#E3E6EB]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono px-2 py-0.5 bg-[#F6F7F9] border border-[#E3E6EB] rounded text-[#111827]">
                          {t.meeting} {topic.meetingNumber || topicIdx + 1}
                        </span>
                        {canEdit && (
                          <span className={`text-[11px] font-medium ${
                            topic.status === "PUBLISHED" ? "text-[#15803D]" : topic.status === "DRAFT" ? "text-[#B45309]" : "text-[#1F4E8C]"
                          }`}>
                            {topic.status === "PUBLISHED" ? "Terbit" : topic.status === "DRAFT" ? "Draf" : "Terjadwal"}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-[#111827] mt-1">{topic.title}</h3>
                      {topic.description && (
                        <p className="text-xs text-[#4B5563] mt-0.5">{topic.description}</p>
                      )}
                    </div>

                    {/* Topic Actions (Guru) */}
                    {canEdit && (
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => handleMoveTopic(topicIdx, "UP")}
                          disabled={topicIdx === 0}
                          title="Naikkan urutan"
                          className="p-1 text-[#6B7280] hover:text-[#111827] disabled:opacity-30 rounded border border-[#E3E6EB]"
                        >
                          <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveTopic(topicIdx, "DOWN")}
                          disabled={topicIdx === classDetail.topics.length - 1}
                          title="Turunkan urutan"
                          className="p-1 text-[#6B7280] hover:text-[#111827] disabled:opacity-30 rounded border border-[#E3E6EB]"
                        >
                          <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTopicId(topic.id);
                            setShowMaterialModal(true);
                          }}
                          className="inline-flex items-center gap-1 h-7 px-2.5 bg-[#1F4E8C] hover:bg-[#183E6F] text-white rounded-[4px] text-xs font-medium transition"
                        >
                          <Plus className="w-3 h-3" strokeWidth={1.75} />
                          <span>Tambah materi</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTopic(topic.id)}
                          className="p-1 text-[#B91C1C] hover:text-[#7F1D1D] rounded border border-[#E3E6EB]"
                          title="Hapus topik"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Materials List */}
                  {topic.materials.length === 0 ? (
                    <p className="text-xs text-[#6B7280] py-2 text-center italic">
                      Belum ada materi dalam topik ini.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {topic.materials.map((mat: any) => {
                        const isDone = mat.progress?.isCompleted;

                        return (
                          <div
                            key={mat.id}
                            className={`p-3 rounded-[6px] border transition ${
                              isDone
                                ? "bg-[#F0FDF4]/50 border-[#BBF7D0]"
                                : "bg-white border-[#E3E6EB] hover:border-[#CBD5E1]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[#6B7280]">
                                    {mat.type === "RICH_TEXT" && <FileText className="w-4 h-4" strokeWidth={1.5} />}
                                    {mat.type === "FILE" && <Paperclip className="w-4 h-4" strokeWidth={1.5} />}
                                    {mat.type === "VIDEO_LINK" && <Video className="w-4 h-4" strokeWidth={1.5} />}
                                    {mat.type === "EXTERNAL_LINK" && <ExternalLink className="w-4 h-4" strokeWidth={1.5} />}
                                  </span>
                                  <h4 className="text-xs font-semibold text-[#111827]">{mat.title}</h4>
                                  {mat.isRequired && (
                                    <span className="text-[10px] text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] px-1.5 py-0.2 rounded">
                                      Wajib
                                    </span>
                                  )}
                                  {canEdit && mat.status !== "PUBLISHED" && (
                                    <span className="text-[10px] text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] px-1.5 py-0.2 rounded font-mono">
                                      {mat.status}
                                    </span>
                                  )}
                                </div>

                                {/* Rich Text Content (Sanitized) */}
                                {mat.type === "RICH_TEXT" && mat.content && (
                                  <div
                                    className="text-xs text-[#374151] leading-relaxed pt-1"
                                    dangerouslySetInnerHTML={{ __html: mat.content }}
                                  />
                                )}

                                {/* Video Player */}
                                {mat.type === "VIDEO_LINK" && mat.videoUrl && (
                                  <div className="pt-2">
                                    <div className="relative aspect-video max-w-md rounded-[6px] overflow-hidden border border-[#E3E6EB]">
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
                                      className="text-xs text-[#1F4E8C] hover:underline inline-flex items-center gap-1 font-medium"
                                    >
                                      <span>Buka tautan: {mat.url}</span>
                                      <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                                    </a>
                                  </div>
                                )}

                                {/* Download Files */}
                                {mat.files && mat.files.length > 0 && (
                                  <div className="pt-2 space-y-1">
                                    {mat.files.map((f: any) => (
                                      <a
                                        key={f.id}
                                        href={f.downloadUrl}
                                        className="inline-flex items-center gap-2 bg-[#F6F7F9] hover:bg-[#E5E7EB] text-xs text-[#111827] px-2.5 py-1 rounded-[4px] border border-[#E3E6EB] transition"
                                      >
                                        <Paperclip className="w-3.5 h-3.5 text-[#6B7280]" strokeWidth={1.5} />
                                        <span className="font-medium">{f.fileName}</span>
                                        <span className="text-[11px] text-[#6B7280]">
                                          ({Math.round(f.fileSize / 1024)} KB)
                                        </span>
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Student Checkmark / Action */}
                              <div className="flex items-center gap-2 shrink-0">
                                {(classDetail.isEnrolled || previewAsStudent) && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleComplete(mat.id)}
                                    className={`text-xs px-2.5 py-1 rounded-[4px] font-medium transition inline-flex items-center gap-1.5 ${
                                      isDone
                                        ? "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]"
                                        : "bg-white hover:bg-[#F6F7F9] text-[#4B5563] border border-[#E3E6EB]"
                                    }`}
                                  >
                                    {isDone ? (
                                      <>
                                        <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" strokeWidth={1.75} />
                                        <span>✓ Selesai</span>
                                      </>
                                    ) : (
                                      <>
                                        <Circle className="w-3.5 h-3.5 text-[#9CA3AF]" strokeWidth={1.5} />
                                        <span>Tandai Selesai</span>
                                      </>
                                    )}
                                  </button>
                                )}

                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMaterial(mat.id)}
                                    className="p-1 text-[#B91C1C] hover:text-[#7F1D1D] rounded border border-[#E3E6EB]"
                                    title="Hapus materi"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
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

      {/* TAB 3: ANGGOTA KELAS (Tanpa Data PII) */}
      {activeTab === "ANGGOTA" && (
        <div className="bg-white border border-[#E3E6EB] rounded-[6px] overflow-hidden shadow-none">
          <div className="px-5 py-3 border-b border-[#E3E6EB] flex items-center justify-between bg-[#F6F7F9]">
            <h3 className="text-xs font-semibold text-[#111827]">Daftar anggota kelas</h3>
            <span className="text-xs text-[#6B7280]">
              Total: {classDetail.members?.length || 0} orang
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#F6F7F9] border-b border-[#E3E6EB] text-[#4B5563]">
                <tr className="h-10">
                  <th className="px-4 font-semibold">Nama anggota</th>
                  <th className="px-4 font-semibold">Peran di kelas</th>
                  <th className="px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E6EB]">
                {classDetail.members?.map((member: any) => {
                  const isTeacherMember = member.role === "PENGAJAR";
                  const roleName = isTeacherMember ? t.teacher : t.student;

                  return (
                    <tr key={member.id} className="h-11 hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-4 font-medium text-[#111827]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-[#1F4E8C] text-white flex items-center justify-center text-[10px] font-semibold shrink-0">
                            {member.fullName.charAt(0)}
                          </div>
                          <span>{member.fullName}</span>
                        </div>
                      </td>
                      <td className="px-4 text-[#4B5563]">
                        {isTeacherMember ? (member.isPrimary ? `${t.teacher} Utama` : t.teacher) : t.student}
                      </td>
                      <td className="px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-medium border ${
                          isTeacherMember
                            ? "bg-[#EBF2FA] text-[#1F4E8C] border-[#BFDBFE]"
                            : "bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]"
                        }`}>
                          {roleName}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH TOPIK */}
      {showTopicModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E3E6EB] rounded-[6px] p-6 max-w-md w-full space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#E3E6EB] pb-3">
              <h3 className="text-sm font-semibold text-[#111827]">Tambah Topik Pembelajaran Baru</h3>
              <button
                type="button"
                onClick={() => setShowTopicModal(false)}
                className="text-[#6B7280] hover:text-[#111827]"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleCreateTopic} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#111827] block mb-1">
                  Nomor {t.meeting} (opsional)
                </label>
                <input
                  type="number"
                  value={topicMeeting}
                  onChange={(e) => setTopicMeeting(e.target.value)}
                  placeholder="Contoh: 1"
                  className="w-full h-9 px-3 text-xs bg-white text-[#111827] border border-[#E3E6EB] rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#1F4E8C]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#111827] block mb-1">
                  Judul topik *
                </label>
                <input
                  type="text"
                  required
                  value={topicTitle}
                  onChange={(e) => setTopicTitle(e.target.value)}
                  placeholder="Contoh: Pengenalan Dasar & Silabus"
                  className="w-full h-9 px-3 text-xs bg-white text-[#111827] border border-[#E3E6EB] rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#1F4E8C]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#111827] block mb-1">
                  Deskripsi capaian pembelajaran
                </label>
                <textarea
                  rows={2}
                  value={topicDesc}
                  onChange={(e) => setTopicDesc(e.target.value)}
                  placeholder="Ringkasan target dan materi yang dibahas..."
                  className="w-full p-2.5 text-xs bg-white text-[#111827] border border-[#E3E6EB] rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#1F4E8C]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E3E6EB]">
                <button
                  type="button"
                  onClick={() => setShowTopicModal(false)}
                  className="h-8 px-3 text-xs text-[#4B5563] hover:text-[#111827] border border-[#E3E6EB] rounded-[6px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !topicTitle.trim()}
                  className="h-8 px-3 text-xs font-medium text-white bg-[#1F4E8C] hover:bg-[#183E6F] rounded-[6px] disabled:opacity-50"
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E3E6EB] rounded-[6px] p-6 max-w-lg w-full space-y-4 shadow-sm max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E3E6EB] pb-3">
              <h3 className="text-sm font-semibold text-[#111827]">Tambah Materi Pembelajaran</h3>
              <button
                type="button"
                onClick={() => setShowMaterialModal(false)}
                className="text-[#6B7280] hover:text-[#111827]"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleCreateMaterial} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#111827] block mb-1">Tipe materi</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMaterialType("RICH_TEXT")}
                    className={`h-8 px-2 text-xs font-medium rounded-[4px] border transition ${
                      materialType === "RICH_TEXT"
                        ? "border-[#1F4E8C] bg-[#EBF2FA] text-[#1F4E8C]"
                        : "border-[#E3E6EB] bg-white text-[#4B5563]"
                    }`}
                  >
                    Teks / Artikel
                  </button>
                  <button
                    type="button"
                    onClick={() => setMaterialType("VIDEO_LINK")}
                    className={`h-8 px-2 text-xs font-medium rounded-[4px] border transition ${
                      materialType === "VIDEO_LINK"
                        ? "border-[#1F4E8C] bg-[#EBF2FA] text-[#1F4E8C]"
                        : "border-[#E3E6EB] bg-white text-[#4B5563]"
                    }`}
                  >
                    Video YouTube
                  </button>
                  <button
                    type="button"
                    onClick={() => setMaterialType("EXTERNAL_LINK")}
                    className={`h-8 px-2 text-xs font-medium rounded-[4px] border transition ${
                      materialType === "EXTERNAL_LINK"
                        ? "border-[#1F4E8C] bg-[#EBF2FA] text-[#1F4E8C]"
                        : "border-[#E3E6EB] bg-white text-[#4B5563]"
                    }`}
                  >
                    Tautan Luar
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[#111827] block mb-1">Judul materi *</label>
                <input
                  type="text"
                  required
                  value={materialTitle}
                  onChange={(e) => setMaterialTitle(e.target.value)}
                  placeholder="Contoh: Modul 1 - Teori Dasar"
                  className="w-full h-9 px-3 text-xs bg-white text-[#111827] border border-[#E3E6EB] rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#1F4E8C]"
                />
              </div>

              {materialType === "RICH_TEXT" && (
                <div>
                  <label className="text-xs font-medium text-[#111827] block mb-1">
                    Konten materi pembelajaran (HTML / Teks)
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={materialContent}
                    onChange={(e) => setMaterialContent(e.target.value)}
                    placeholder="Tuliskan materi pelajaran di sini..."
                    className="w-full p-2.5 text-xs bg-white text-[#111827] border border-[#E3E6EB] rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#1F4E8C]"
                  />
                </div>
              )}

              {(materialType === "VIDEO_LINK" || materialType === "EXTERNAL_LINK") && (
                <div>
                  <label className="text-xs font-medium text-[#111827] block mb-1">
                    URL {materialType === "VIDEO_LINK" ? "Video YouTube" : "Tautan Eksternal"} *
                  </label>
                  <input
                    type="url"
                    required
                    value={materialUrl}
                    onChange={(e) => setMaterialUrl(e.target.value)}
                    placeholder={materialType === "VIDEO_LINK" ? "https://www.youtube.com/watch?v=..." : "https://..."}
                    className="w-full h-9 px-3 text-xs bg-white text-[#111827] border border-[#E3E6EB] rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#1F4E8C]"
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#111827]">
                  <input
                    type="checkbox"
                    checked={materialIsRequired}
                    onChange={(e) => setMaterialIsRequired(e.target.checked)}
                    className="rounded text-[#1F4E8C] focus:ring-[#1F4E8C]"
                  />
                  <span>Wajib diselesaikan untuk progres belajar</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E3E6EB]">
                <button
                  type="button"
                  onClick={() => setShowMaterialModal(false)}
                  className="h-8 px-3 text-xs text-[#4B5563] hover:text-[#111827] border border-[#E3E6EB] rounded-[6px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !materialTitle.trim()}
                  className="h-8 px-3 text-xs font-medium text-white bg-[#1F4E8C] hover:bg-[#183E6F] rounded-[6px] disabled:opacity-50"
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
