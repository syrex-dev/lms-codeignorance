"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { getTerminology } from "@/lib/i18n/terminology";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { useBreadcrumb } from "@/components/ui/breadcrumb-context";
import {
  FileText,
  Paperclip,
  Video,
  ExternalLink,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Eye,
  Users,
  BookOpen,
  ArrowLeft,
  ArrowRight,
  Loader2,
  X,
  Copy,
  Search,
  Download,
  Check,
  ChevronDown,
} from "lucide-react";

export default function ClassroomDetailPage() {
  const params = useParams();
  const tenantSlug = params.tenant as string;
  const classId = params.id as string;
  const router = useRouter();
  const { data: session } = useSession();
  const { setCustomTitle } = useBreadcrumb();

  const [classDetail, setClassDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"BERANDA" | "MATERI" | "ANGGOTA">("MATERI");
  const [previewAsStudent, setPreviewAsStudent] = useState(false);

  // Split-Pane Active Material Selection
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [collapsedTopics, setCollapsedTopics] = useState<Record<string, boolean>>({});

  // Members search state
  const [memberSearch, setMemberSearch] = useState("");

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

  // Copy Curriculum Modal
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [targetClassId, setTargetClassId] = useState("");
  const [copyIncludeMaterials, setCopyIncludeMaterials] = useState(true);
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

      if (data.classDetail?.code && data.classDetail?.name) {
        setCustomTitle(`${data.classDetail.code} - ${data.classDetail.name}`);
      }

      if (!selectedMaterialId && data.classDetail?.topics) {
        const firstMat = data.classDetail.topics.flatMap((t: any) => t.materials)?.[0];
        if (firstMat) {
          setSelectedMaterialId(firstMat.id);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetail();
    return () => {
      setCustomTitle(null);
    };
  }, [classId, previewAsStudent]);

  async function loadClassesForCopy() {
    try {
      const res = await fetch("/api/classroom/classes");
      if (res.ok) {
        const data = await res.json();
        setAvailableClasses((data.classes || []).filter((c: any) => c.id !== classId));
      }
    } catch {}
  }

  async function handleCopyCurriculum(e: React.FormEvent) {
    e.preventDefault();
    if (!targetClassId) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/classroom/classes/${classId}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceClassCourseId: targetClassId,
          includeMaterials: copyIncludeMaterials,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyalin kurikulum.");

      setShowCopyModal(false);
      loadDetail();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  const allFlatMaterials = useMemo(() => {
    if (!classDetail?.topics) return [];
    return classDetail.topics.flatMap((topic: any) =>
      topic.materials.map((mat: any) => ({
        ...mat,
        topicTitle: topic.title,
        topicMeetingNumber: topic.meetingNumber,
      }))
    );
  }, [classDetail]);

  const activeMaterial = useMemo(() => {
    if (!allFlatMaterials.length) return null;
    return allFlatMaterials.find((m: any) => m.id === selectedMaterialId) || allFlatMaterials[0];
  }, [allFlatMaterials, selectedMaterialId]);

  const activeMaterialIndex = useMemo(() => {
    if (!activeMaterial) return -1;
    return allFlatMaterials.findIndex((m: any) => m.id === activeMaterial.id);
  }, [allFlatMaterials, activeMaterial]);

  const prevMaterial = activeMaterialIndex > 0 ? allFlatMaterials[activeMaterialIndex - 1] : null;
  const nextMaterial = activeMaterialIndex < allFlatMaterials.length - 1 ? allFlatMaterials[activeMaterialIndex + 1] : null;

  async function handleToggleComplete(materialId: string) {
    if (!classDetail) return;
    const originalDetail = { ...classDetail };

    setClassDetail((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        topics: prev.topics.map((t: any) => ({
          ...t,
          materials: t.materials.map((m: any) => {
            if (m.id === materialId) {
              const isCurrentlyCompleted = m.progress?.isCompleted;
              return {
                ...m,
                progress: {
                  ...m.progress,
                  isCompleted: !isCurrentlyCompleted,
                  completedAt: !isCurrentlyCompleted ? new Date().toISOString() : null,
                },
              };
            }
            return m;
          }),
        })),
      };
    });

    try {
      const res = await fetch(`/api/classroom/materials/${materialId}/progress`, { method: "POST" });
      if (!res.ok) throw new Error("Gagal memperbarui status belajar.");
    } catch (err: any) {
      setClassDetail(originalDetail);
      alert(err.message);
    }
  }

  async function handleCreateTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!topicTitle.trim()) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/classroom/classes/${classId}/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: topicTitle.trim(),
          description: topicDesc.trim() || undefined,
          meetingNumber: topicMeeting ? parseInt(topicMeeting, 10) : undefined,
          status: topicStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat topik baru.");

      setShowTopicModal(false);
      setTopicTitle("");
      setTopicDesc("");
      setTopicMeeting("");
      loadDetail();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCreateMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTopicId || !materialTitle.trim()) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/classroom/topics/${selectedTopicId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: materialType,
          title: materialTitle.trim(),
          content: materialType === "RICH_TEXT" ? materialContent : undefined,
          videoUrl: materialType === "VIDEO_LINK" ? materialUrl : undefined,
          url: materialType === "EXTERNAL_LINK" ? materialUrl : undefined,
          status: materialStatus,
          isRequired: materialIsRequired,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambahkan materi baru.");

      setShowMaterialModal(false);
      setMaterialTitle("");
      setMaterialContent("");
      setMaterialUrl("");
      loadDetail();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading && !classDetail) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-xs text-[#64748B] gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#1E40AF]" strokeWidth={2} />
        <span>Memuat ruang belajar kelas...</span>
      </div>
    );
  }

  if (error || !classDetail) {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-8 text-center max-w-md mx-auto shadow-xs">
        <div className="w-10 h-10 rounded-full bg-red-50 text-[#B91C1C] flex items-center justify-center mx-auto mb-3">
          <BookOpen className="w-5 h-5" strokeWidth={1.75} />
        </div>
        <h3 className="text-sm font-semibold text-[#0F172A]">Akses Kelas Terbatas</h3>
        <p className="text-xs text-[#64748B] mt-1">{error || "Kelas tidak ditemukan."}</p>
        <Link
          href={`/${tenantSlug}/classes`}
          className="inline-flex items-center gap-1.5 mt-4 px-3.5 py-2 bg-[#1E40AF] text-white rounded-[6px] text-xs font-semibold hover:bg-[#1D4ED8] transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Kembali ke Daftar Kelas</span>
        </Link>
      </div>
    );
  }

  const isTeacher = classDetail.isTeacher;
  const isAdmin = classDetail.isAdmin;
  const canEdit = (isTeacher || isAdmin) && !previewAsStudent;
  const studentCount = classDetail.enrollmentCount ?? classDetail.enrollments?.length ?? 0;
  const primaryInstructor = classDetail.instructors?.find((i: any) => i.isPrimary)?.instructor?.fullName || classDetail.instructors?.[0]?.instructor?.fullName || "Belum ditentukan";

  const filteredMembers = (classDetail.members || []).filter((m: any) => {
    if (!memberSearch.trim()) return true;
    const q = memberSearch.toLowerCase();
    return m.fullName.toLowerCase().includes(q) || (m.identifier && m.identifier.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Kartu Kelas */}
      <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded text-[#0F172A]">
                {classDetail.code}
              </span>
              <span className="text-xs text-[#475569] font-medium">
                {classDetail.credits || 3} {t.creditsShort}
              </span>
              {classDetail.progressPercentage !== undefined && (
                <span className="text-[11px] font-semibold text-[#15803D] bg-[#DCFCE7] border border-[#BBF7D0] px-2 py-0.5 rounded font-mono">
                  {classDetail.progressPercentage}% Selesai
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-[#0F172A]">
              {classDetail.name}
            </h1>
            <p className="text-xs text-[#64748B] mt-1">
              {classDetail.academicTerm?.name || "Semester Aktif"} • {classDetail.roomName ? `Ruang: ${classDetail.roomName}` : (classDetail.programDepartment?.name || t.institutionLabel)} • <strong className="text-[#0F172A] font-semibold">{studentCount} {t.student.toLowerCase()} terdaftar</strong> • {t.teacher}: <strong className="text-[#0F172A] font-semibold">{primaryInstructor}</strong>
            </p>
          </div>

          {(isTeacher || isAdmin) && (
            <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
              <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1.5 rounded-[6px]">
                <span className="text-xs font-medium text-[#475569]">Pratinjau Mahasiswa</span>
                <button
                  type="button"
                  onClick={() => setPreviewAsStudent(!previewAsStudent)}
                  role="switch"
                  aria-label="Mode pratinjau mahasiswa"
                  aria-checked={previewAsStudent}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                    previewAsStudent ? "bg-[#1E40AF]" : "bg-[#CBD5E1]"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      previewAsStudent ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      loadClassesForCopy();
                      setShowCopyModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 h-8 px-3 bg-white hover:bg-[#F8FAFC] text-[#334155] border border-[#E2E8F0] rounded-[6px] text-xs font-medium transition shadow-xs"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#64748B]" strokeWidth={1.75} />
                    <span>Salin Kurikulum</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowTopicModal(true)}
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white rounded-[6px] text-xs font-semibold transition shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                    <span>+ Tambah Topik</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Tabs */}
      <div className="border-b border-[#E2E8F0] sticky top-14 bg-[#F8FAFC] z-20 pt-1 overflow-x-auto scrollbar-none max-w-full">
        <nav className="flex space-x-6 text-xs font-medium" aria-label="Tabs Navigasi Kelas">
          <button
            type="button"
            onClick={() => setActiveTab("MATERI")}
            className={`pb-3 font-semibold transition-colors flex items-center gap-2 relative ${
              activeTab === "MATERI" ? "text-[#1E40AF]" : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            <BookOpen className="w-4 h-4" strokeWidth={1.75} />
            <span>Materi Pembelajaran</span>
            {activeTab === "MATERI" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E40AF] rounded-t" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("BERANDA")}
            className={`pb-3 font-semibold transition-colors flex items-center gap-2 relative ${
              activeTab === "BERANDA" ? "text-[#1E40AF]" : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            <FileText className="w-4 h-4" strokeWidth={1.75} />
            <span>Beranda & Silabus</span>
            {activeTab === "BERANDA" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E40AF] rounded-t" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ANGGOTA")}
            className={`pb-3 font-semibold transition-colors flex items-center gap-2 relative ${
              activeTab === "ANGGOTA" ? "text-[#1E40AF]" : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            <Users className="w-4 h-4" strokeWidth={1.75} />
            <span>Anggota Kelas ({studentCount + (classDetail.instructors?.length || 1)})</span>
            {activeTab === "ANGGOTA" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E40AF] rounded-t" />}
          </button>
        </nav>
      </div>

      {/* TAB 1: MATERI PEMBELAJARAN (SPLIT-PANE LEARNING WORKSPACE) */}
      {activeTab === "MATERI" && (
        <div data-testid="split-pane-workspace" className="flex flex-col lg:flex-row items-start gap-6 max-w-full min-w-0">
          {/* Kolom Kiri: Sticky Course Outline (Lebar ~320px) */}
          <aside className="w-full max-w-full lg:w-80 shrink-0 bg-white border border-[#E2E8F0] rounded-[8px] p-4 shadow-xs lg:sticky lg:top-28 max-h-[calc(100vh-140px)] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <h2 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
                Daftar Topik & Materi
              </h2>
              <span className="text-[11px] text-[#64748B] font-mono">
                {allFlatMaterials.length} materi
              </span>
            </div>

            {classDetail.topics.length === 0 ? (
              <p className="text-xs text-[#64748B] text-center py-6 italic">
                Belum ada topik pembelajaran.
              </p>
            ) : (
              <div className="space-y-3">
                {classDetail.topics.map((topic: any, topicIdx: number) => {
                  const isCollapsed = collapsedTopics[topic.id];
                  const topicMaterials = topic.materials || [];
                  const topicCompleted = topicMaterials.filter((m: any) => m.progress?.isCompleted).length;

                  return (
                    <div key={topic.id} className="border border-[#E2E8F0] rounded-[6px] overflow-hidden bg-white">
                      <div
                        onClick={() => setCollapsedTopics((prev) => ({ ...prev, [topic.id]: !prev[topic.id] }))}
                        className="p-3 bg-[#F8FAFC] hover:bg-[#F1F5F9] cursor-pointer transition flex items-center justify-between gap-2 select-none"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 bg-white border border-[#E2E8F0] rounded text-[#0F172A]">
                              P{topic.meetingNumber || topicIdx + 1}
                            </span>
                            <span className="text-[11px] font-semibold text-[#0F172A] truncate">
                              {topic.title}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#64748B] mt-0.5 block">
                            {topicCompleted}/{topicMaterials.length} selesai
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTopicId(topic.id);
                                setShowMaterialModal(true);
                              }}
                              className="p-1 hover:text-[#1E40AF] rounded"
                              title="Tambah materi di topik ini"
                            >
                              <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2} />
                              <span className="text-[11px] hidden sm:inline">Tambah materi</span>
                              <span className="sr-only">Tambah materi</span>
                            </button>
                          )}
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-[#64748B] transition-transform ${isCollapsed ? "-rotate-90" : "rotate-0"}`}
                            strokeWidth={1.75}
                          />
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div className="divide-y divide-[#F1F5F9] p-1">
                          {topicMaterials.length === 0 ? (
                            <p className="text-[11px] text-[#94A3B8] p-2 text-center italic">Belum ada materi</p>
                          ) : (
                            topicMaterials.map((mat: any) => {
                              const isSelected = activeMaterial?.id === mat.id;
                              const isCompleted = mat.progress?.isCompleted;

                              return (
                                <button
                                  key={mat.id}
                                  type="button"
                                  onClick={() => setSelectedMaterialId(mat.id)}
                                  className={`w-full text-left p-2 rounded-[4px] text-xs flex items-center justify-between gap-2 transition ${
                                    isSelected ? "bg-[#EFF6FF] text-[#1E40AF] font-semibold" : "text-[#475569] hover:bg-[#F8FAFC]"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {isCompleted ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D] shrink-0" strokeWidth={2} />
                                    ) : (
                                      <Circle className="w-3.5 h-3.5 text-[#CBD5E1] shrink-0" strokeWidth={1.5} />
                                    )}
                                    <span className="truncate">{mat.title}</span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {mat.type === "FILE" && <Paperclip className="w-3 h-3 text-[#64748B]" />}
                                    {mat.type === "VIDEO_LINK" && <Video className="w-3 h-3 text-[#64748B]" />}
                                    {mat.type === "EXTERNAL_LINK" && <ExternalLink className="w-3 h-3 text-[#64748B]" />}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          {/* Kolom Kanan: Focused Content Viewer */}
          <main className="flex-1 w-full bg-white border border-[#E2E8F0] rounded-[8px] p-6 sm:p-8 shadow-xs flex flex-col justify-between min-h-[500px]">
            {activeMaterial ? (
              <div className="space-y-6">
                <div className="pb-4 border-b border-[#F1F5F9] space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 bg-[#F1F5F9] text-[#475569] rounded border border-[#E2E8F0]">
                      {activeMaterial.topicTitle}
                    </span>
                    {activeMaterial.isRequired && (
                      <span className="text-[10px] font-semibold text-[#B91C1C] bg-[#FEE2E2] px-1.5 py-0.5 rounded border border-[#FECACA]">
                        Wajib
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg sm:text-2xl font-bold text-[#0F172A]">
                    {activeMaterial.title}
                  </h2>
                </div>

                {/* Rich Text Viewer */}
                {activeMaterial.type === "RICH_TEXT" && (
                  <div
                    className="max-w-[68ch] text-sm text-[#334155] leading-relaxed space-y-4"
                    dangerouslySetInnerHTML={{ __html: activeMaterial.content || "<p>Tidak ada konten teks.</p>" }}
                  />
                )}

                {/* Inline PDF Preview + Download */}
                {activeMaterial.type === "FILE" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[6px] bg-[#EFF6FF] text-[#1E40AF] flex items-center justify-center">
                          <Paperclip className="w-5 h-5" strokeWidth={1.75} />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[#0F172A]">Dokumen Materi PDF</div>
                          <div className="text-[11px] text-[#64748B]">Dapat dibaca langsung di bawah atau diunduh</div>
                        </div>
                      </div>
                      {activeMaterial.files?.[0]?.downloadUrl && (
                        <a
                          href={activeMaterial.files[0].downloadUrl}
                          download
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white rounded-[6px] text-xs font-semibold transition shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" strokeWidth={2} />
                          <span>Unduh Dokumen</span>
                        </a>
                      )}
                    </div>
                    <div className="w-full h-[520px] rounded-[8px] border border-[#E2E8F0] overflow-hidden bg-slate-100">
                      <iframe src={activeMaterial.files?.[0]?.downloadUrl || "#"} title={activeMaterial.title} className="w-full h-full" />
                    </div>
                  </div>
                )}

                {/* 16:9 Responsive Video */}
                {activeMaterial.type === "VIDEO_LINK" && activeMaterial.videoUrl && (
                  <div className="space-y-3">
                    <div className="relative aspect-video w-full max-w-3xl rounded-[8px] overflow-hidden border border-[#E2E8F0] shadow-sm bg-black">
                      <iframe
                        src={activeMaterial.videoUrl}
                        title={activeMaterial.title}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}

                {/* External Link Card */}
                {activeMaterial.type === "EXTERNAL_LINK" && activeMaterial.url && (
                  <div className="p-5 border border-[#E2E8F0] rounded-[8px] bg-[#F8FAFC] max-w-xl space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#EFF6FF] text-[#1E40AF] flex items-center justify-center">
                        <ExternalLink className="w-4 h-4" strokeWidth={1.75} />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-[#0F172A]">Tautan Sumber Eksternal</h4>
                        <p className="text-[11px] text-[#64748B] truncate max-w-md">{activeMaterial.url}</p>
                      </div>
                    </div>
                    <a
                      href={activeMaterial.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-[6px] transition shadow-xs"
                    >
                      <span>Buka di Tab Baru</span>
                      <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState title="Pilih materi untuk mulai belajar" description="Pilih salah satu item materi pada daftar topik di sebelah kiri." />
            )}

            {/* Action Bar Bawah Materi */}
            {activeMaterial && (
              <div className="mt-8 pt-5 border-t border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => prevMaterial && setSelectedMaterialId(prevMaterial.id)}
                  disabled={!prevMaterial}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-xs font-medium text-[#334155] rounded-[6px] disabled:opacity-30 disabled:pointer-events-none transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Sebelumnya</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleComplete(activeMaterial.id)}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 rounded-[6px] text-xs font-semibold transition shadow-xs ${
                    activeMaterial.progress?.isCompleted
                      ? "bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0] hover:bg-[#bbf7d0]"
                      : "bg-[#1E40AF] text-white hover:bg-[#1D4ED8]"
                  }`}
                >
                  {activeMaterial.progress?.isCompleted ? (
                    <>
                      <Check className="w-4 h-4 text-[#15803D]" strokeWidth={2.5} />
                      <span>✓ Selesai Dipelajari</span>
                    </>
                  ) : (
                    <>
                      <Circle className="w-4 h-4" strokeWidth={2} />
                      <span>Tandai Selesai</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => nextMaterial && setSelectedMaterialId(nextMaterial.id)}
                  disabled={!nextMaterial}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-xs font-medium text-[#334155] rounded-[6px] disabled:opacity-30 disabled:pointer-events-none transition"
                >
                  <span>Materi Berikutnya</span>
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              </div>
            )}
          </main>
        </div>
      )}

      {/* TAB 2: BERANDA & SILABUS */}
      {activeTab === "BERANDA" && (
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-[#0F172A] mb-2">Deskripsi & Silabus Perkuliahan</h3>
            <p className="text-xs text-[#475569] leading-relaxed max-w-3xl">
              {classDetail.description || `Mata kuliah/pelajaran ${classDetail.name} (${classDetail.code}) berbobot ${classDetail.credits || 3} ${t.creditsShort} pada ${classDetail.academicTerm?.name || "Semester Aktif"}.`}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#F1F5F9]">
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px]">
              <span className="text-[11px] text-[#64748B]">Beban Satuan Kredit</span>
              <div className="text-base font-bold text-[#0F172A] mt-0.5">{classDetail.credits || 3} {t.creditsShort}</div>
            </div>
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px]">
              <span className="text-[11px] text-[#64748B]">Ruang Perkuliahan</span>
              <div className="text-base font-bold text-[#0F172A] mt-0.5">{classDetail.roomName || "LAB-KOMP-1"}</div>
            </div>
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px]">
              <span className="text-[11px] text-[#64748B]">Dosen Pengampu Utama</span>
              <div className="text-base font-bold text-[#0F172A] mt-0.5 truncate">{primaryInstructor}</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ANGGOTA KELAS (DENGAN IDENTITAS NIM/NIDN & PENCARIAN INSTAN) */}
      {activeTab === "ANGGOTA" && (
        <div data-testid="class-members-section" className="bg-white border border-[#E2E8F0] rounded-[8px] overflow-hidden shadow-xs space-y-0 max-w-full">
          <div className="p-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8FAFC]">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama atau NIM/NIDN anggota..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full h-8 pl-9 pr-3 text-xs bg-white border border-[#CBD5E1] rounded-[6px] text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#1E40AF]"
              />
            </div>
            <span className="text-xs text-[#64748B] font-medium font-mono">
              Total {filteredMembers.length} anggota terdaftar
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#475569]">
                <tr className="h-10">
                  <th className="px-5 font-semibold">Nama & Identitas</th>
                  <th className="px-5 font-semibold">Peran di Kelas</th>
                  <th className="px-5 font-semibold">Status Keikutsertaan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-xs text-[#94A3B8] italic">
                      Tidak ditemukan anggota kelas yang cocok.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member: any) => {
                    const isTeacherMember = member.role === "PENGAJAR";

                    return (
                      <tr key={member.id} className="h-14 hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-5 font-medium text-[#0F172A]">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#1E40AF] text-white flex items-center justify-center text-xs font-semibold shrink-0 shadow-xs">
                              {member.fullName.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-[#0F172A] text-xs">
                                {member.fullName}
                              </div>
                              <div className="font-mono text-[11px] text-[#64748B] mt-0.5">
                                {isTeacherMember ? "NIDN" : "NIM"}: <span className="font-semibold text-[#334155]">{member.identifier || "-"}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5">
                          {isTeacherMember ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-semibold bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE]">
                              {member.isPrimary ? "Dosen Pengampu Utama" : "Dosen Pengampu"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                              {t.student}
                            </span>
                          )}
                        </td>
                        <td className="px-5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] text-[11px] font-semibold bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
                            <span>Aktif</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Tambah Topik */}
      {showTopicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <h3 className="text-sm font-semibold text-[#0F172A]">Tambah Topik Pembelajaran Baru</h3>
              <button type="button" onClick={() => setShowTopicModal(false)} className="p-1 text-[#64748B] hover:text-[#0F172A]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTopic} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Judul Topik / Pertemuan</label>
                <input
                  type="text"
                  required
                  value={topicTitle}
                  onChange={(e) => setTopicTitle(e.target.value)}
                  placeholder="Contoh: Pengenalan Dasar & Silabus"
                  className="w-full h-8 px-2.5 text-xs border border-[#CBD5E1] rounded-[6px] focus:ring-1 focus:ring-[#1E40AF]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Nomor Pertemuan</label>
                <input
                  type="number"
                  value={topicMeeting}
                  onChange={(e) => setTopicMeeting(e.target.value)}
                  placeholder="1, 2, dst."
                  className="w-full h-8 px-2.5 text-xs border border-[#CBD5E1] rounded-[6px] focus:ring-1 focus:ring-[#1E40AF]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
                <button type="button" onClick={() => setShowTopicModal(false)} className="px-3 py-1.5 text-xs border border-[#E2E8F0] rounded-[6px] hover:bg-[#F8FAFC]">
                  Batal
                </button>
                <button type="submit" disabled={actionLoading} className="px-4 py-1.5 bg-[#1E40AF] text-white text-xs font-semibold rounded-[6px] hover:bg-[#1D4ED8] disabled:opacity-50">
                  {actionLoading ? "Menyimpan..." : "Simpan Topik"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Tambah Materi */}
      {showMaterialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <h3 className="text-sm font-semibold text-[#0F172A]">Tambah Materi Pembelajaran</h3>
              <button type="button" onClick={() => setShowMaterialModal(false)} className="p-1 text-[#64748B] hover:text-[#0F172A]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateMaterial} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Tipe Materi</label>
                <select value={materialType} onChange={(e) => setMaterialType(e.target.value as any)} className="w-full h-8 px-2 text-xs border border-[#CBD5E1] rounded-[6px]">
                  <option value="RICH_TEXT">Artikel / Teks Kaya</option>
                  <option value="VIDEO_LINK">Tautan Video Pembelajaran (Embed)</option>
                  <option value="EXTERNAL_LINK">Tautan Eksternal / Referensi</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Judul Materi</label>
                <input
                  type="text"
                  required
                  value={materialTitle}
                  onChange={(e) => setMaterialTitle(e.target.value)}
                  placeholder="Contoh: Modul 1 - Teori Dasar"
                  className="w-full h-8 px-2.5 text-xs border border-[#CBD5E1] rounded-[6px]"
                />
              </div>
              {materialType === "RICH_TEXT" && (
                <div>
                  <label className="block text-xs font-medium text-[#334155] mb-1">Isi Konten (HTML / Teks)</label>
                  <textarea
                    rows={4}
                    required
                    value={materialContent}
                    onChange={(e) => setMaterialContent(e.target.value)}
                    placeholder="Tuliskan materi pelajaran di sini..."
                    className="w-full p-2 text-xs border border-[#CBD5E1] rounded-[6px]"
                  />
                </div>
              )}
              {(materialType === "VIDEO_LINK" || materialType === "EXTERNAL_LINK") && (
                <div>
                  <label className="block text-xs font-medium text-[#334155] mb-1">URL Tautan / Video</label>
                  <input
                    type="url"
                    required
                    value={materialUrl}
                    onChange={(e) => setMaterialUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full h-8 px-2.5 text-xs border border-[#CBD5E1] rounded-[6px]"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-3 border-t border-[#F1F5F9]">
                <button type="button" onClick={() => setShowMaterialModal(false)} className="px-3 py-1.5 text-xs border border-[#E2E8F0] rounded-[6px] hover:bg-[#F8FAFC]">
                  Batal
                </button>
                <button type="submit" disabled={actionLoading} className="px-4 py-1.5 bg-[#1E40AF] text-white text-xs font-semibold rounded-[6px] hover:bg-[#1D4ED8] disabled:opacity-50">
                  {actionLoading ? "Menyimpan..." : "Simpan Materi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Salin Kurikulum */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <Copy className="w-4 h-4 text-[#1E40AF]" strokeWidth={1.75} />
                <h3 className="text-sm font-semibold text-[#0F172A]">Salin Kurikulum Kelas Lain</h3>
              </div>
              <button type="button" onClick={() => setShowCopyModal(false)} className="p-1 text-[#64748B] hover:text-[#0F172A]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCopyCurriculum} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Kelas Sumber</label>
                <select required value={targetClassId} onChange={(e) => setTargetClassId(e.target.value)} className="w-full h-8 px-2 text-xs border border-[#CBD5E1] rounded-[6px]">
                  <option value="">-- Pilih Kelas Sumber --</option>
                  {availableClasses.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#F1F5F9]">
                <button type="button" onClick={() => setShowCopyModal(false)} className="px-3 py-1.5 text-xs border border-[#E2E8F0] rounded-[6px] hover:bg-[#F8FAFC]">
                  Batal
                </button>
                <button type="submit" disabled={actionLoading || !targetClassId} className="px-4 py-1.5 bg-[#1E40AF] text-white text-xs font-semibold rounded-[6px] hover:bg-[#1D4ED8] disabled:opacity-50">
                  {actionLoading ? "Menyalin..." : "Salin Sekarang"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
