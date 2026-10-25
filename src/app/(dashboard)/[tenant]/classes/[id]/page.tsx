"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { getTerminology } from "@/lib/i18n/terminology";
import { PageHeader } from "@/components/ui/page-header";
import { AnnouncementsTab } from "@/components/classroom/announcements-tab";
import { AttendanceTab } from "@/components/classroom/attendance-tab";
import { QuizzesSection } from "@/components/classroom/quizzes-section";
import { GradebookTab } from "@/components/classroom/gradebook-tab";
import { CalendarCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useBreadcrumb } from "@/components/ui/breadcrumb-context";
import { RichTextEditor } from "@/components/classroom/rich-text-editor";
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
  ChevronUp,
  Upload,
  CheckSquare,
  Award,
  AlertCircle,
  Clock,
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
  const [activeTab, setActiveTab] = useState<"MATERI" | "BERANDA" | "TUGAS" | "ANGGOTA" | "PRESENSI" | "NILAI">("MATERI");
  const [previewAsStudent, setPreviewAsStudent] = useState(false);

  // Split-Pane Active Material Selection
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [collapsedTopics, setCollapsedTopics] = useState<Record<string, boolean>>({});

  // Members search state
  const [memberSearch, setMemberSearch] = useState("");

  // Modal: Tambah Topik
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicDesc, setTopicDesc] = useState("");
  const [topicMeeting, setTopicMeeting] = useState("");
  const [topicStatus, setTopicStatus] = useState("PUBLISHED");

  // Modal: Tambah/Edit Materi
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [materialType, setMaterialType] = useState<"RICH_TEXT" | "FILE" | "VIDEO_LINK" | "EXTERNAL_LINK">("RICH_TEXT");
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialContent, setMaterialContent] = useState("");
  const [materialUrl, setMaterialUrl] = useState("");
  const [materialStatus, setMaterialStatus] = useState("PUBLISHED");
  const [materialIsRequired, setMaterialIsRequired] = useState(true);
  const [materialUploadedFile, setMaterialUploadedFile] = useState<any | null>(null);
  const [uploadingMaterialFile, setUploadingMaterialFile] = useState(false);

  // Copy Curriculum Modal
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [targetClassId, setTargetClassId] = useState("");
  const [copyIncludeMaterials, setCopyIncludeMaterials] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Tab Tugas: State
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignTitle, setAssignTitle] = useState("");
  const [assignInstructions, setAssignInstructions] = useState("");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [assignMaxScore, setAssignMaxScore] = useState(100);
  const [assignAllowLate, setAssignAllowLate] = useState(false);

  // Modal Submit Tugas (Siswa)
  const [submitModalAssign, setSubmitModalAssign] = useState<any | null>(null);
  const [submitText, setSubmitText] = useState("");
  const [submitFileUrl, setSubmitFileUrl] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  // Modal Beri Nilai (Dosen)
  const [gradeModalSubmission, setGradeModalSubmission] = useState<any | null>(null);
  const [gradeScore, setGradeScore] = useState<number>(100);
  const [gradeFeedback, setGradeFeedback] = useState("");
  const [gradeLoading, setGradeLoading] = useState(false);

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

  async function loadAssignments() {
    try {
      setAssignmentsLoading(true);
      const res = await fetch(`/api/classroom/classes/${classId}/assignments`);
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments || []);
      }
    } catch {
      // ignore
    } finally {
      setAssignmentsLoading(false);
    }
  }

  useEffect(() => {
    loadDetail();
    return () => {
      setCustomTitle(null);
    };
  }, [classId, previewAsStudent]);

  useEffect(() => {
    if (activeTab === "TUGAS") {
      loadAssignments();
    }
  }, [activeTab, classId]);

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

  // 1. REORDER TOPIK (Naik / Turun)
  async function handleReorderTopic(direction: "UP" | "DOWN", topicId: string) {
    if (!classDetail?.topics) return;
    const topics = [...classDetail.topics];
    const idx = topics.findIndex((t: any) => t.id === topicId);
    if (idx === -1) return;
    if (direction === "UP" && idx === 0) return;
    if (direction === "DOWN" && idx === topics.length - 1) return;

    const targetIdx = direction === "UP" ? idx - 1 : idx + 1;
    const temp = topics[idx];
    topics[idx] = topics[targetIdx];
    topics[targetIdx] = temp;

    // Optimistic update
    setClassDetail({ ...classDetail, topics });

    try {
      const topicIds = topics.map((t: any) => t.id);
      await fetch(`/api/classroom/classes/${classId}/topics`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicIds }),
      });
    } catch {
      loadDetail();
    }
  }

  // 2. REORDER MATERI (Naik / Turun)
  async function handleReorderMaterial(direction: "UP" | "DOWN", topicId: string, materialId: string) {
    if (!classDetail?.topics) return;
    const topic = classDetail.topics.find((t: any) => t.id === topicId);
    if (!topic || !topic.materials) return;

    const materials = [...topic.materials];
    const idx = materials.findIndex((m: any) => m.id === materialId);
    if (idx === -1) return;
    if (direction === "UP" && idx === 0) return;
    if (direction === "DOWN" && idx === materials.length - 1) return;

    const targetIdx = direction === "UP" ? idx - 1 : idx + 1;
    const temp = materials[idx];
    materials[idx] = materials[targetIdx];
    materials[targetIdx] = temp;

    // Optimistic update
    const updatedTopics = classDetail.topics.map((t: any) =>
      t.id === topicId ? { ...t, materials } : t
    );
    setClassDetail({ ...classDetail, topics: updatedTopics });

    try {
      const materialIds = materials.map((m: any) => m.id);
      await fetch(`/api/classroom/topics/${topicId}/materials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialIds }),
      });
    } catch {
      loadDetail();
    }
  }

  // 3. HAPUS TOPIK
  async function handleDeleteTopic(topicId: string, title: string) {
    if (!confirm(`Hapus topik "${title}" beserta seluruh materinya?`)) return;

    try {
      const res = await fetch(`/api/classroom/topics/${topicId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus topik.");
      loadDetail();
    } catch (err: any) {
      alert(err.message);
    }
  }

  // 4. HAPUS MATERI
  async function handleDeleteMaterial(materialId: string, title: string) {
    if (!confirm(`Hapus materi "${title}"?`)) return;

    try {
      const res = await fetch(`/api/classroom/materials/${materialId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus materi.");
      loadDetail();
    } catch (err: any) {
      alert(err.message);
    }
  }

  // 5. UBAH STATUS MATERI (DRAFT / PUBLISHED)
  async function handleChangeMaterialStatus(materialId: string, newStatus: string) {
    try {
      await fetch(`/api/classroom/materials/${materialId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      loadDetail();
    } catch {}
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

  // Handle Material File Upload
  async function handleMaterialFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingMaterialFile(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/classroom/files/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengunggah berkas materi.");

      setMaterialUploadedFile(data.file);
      if (!materialTitle.trim()) {
        setMaterialTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingMaterialFile(false);
    }
  }

  async function handleCreateMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTopicId || !materialTitle.trim()) return;

    setActionLoading(true);
    try {
      const payload: any = {
        type: materialType,
        title: materialTitle.trim(),
        status: materialStatus,
        isRequired: materialIsRequired,
      };

      if (materialType === "RICH_TEXT") {
        payload.content = materialContent;
      } else if (materialType === "FILE") {
        if (!materialUploadedFile) {
          alert("Pilih dan unggah berkas dokumen terlebih dahulu.");
          setActionLoading(false);
          return;
        }
        payload.files = [materialUploadedFile];
      } else {
        payload.url = materialUrl.trim();
        payload.videoUrl = materialUrl.trim();
      }

      const res = await fetch(`/api/classroom/topics/${selectedTopicId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat materi baru.");

      // Hapus draf di localStorage
      localStorage.removeItem(`lms_draft_${classId}_${selectedTopicId}`);

      setShowMaterialModal(false);
      setMaterialTitle("");
      setMaterialContent("");
      setMaterialUrl("");
      setMaterialUploadedFile(null);
      loadDetail();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  function handleCloseMaterialModal() {
    if (materialTitle.trim() || materialContent.trim()) {
      if (!confirm("Ada draf materi yang belum disimpan. Yakin ingin menutup?")) {
        return;
      }
    }
    setShowMaterialModal(false);
  }

  // Handle Buat Tugas Baru
  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!assignTitle.trim() || !assignDueDate) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/classroom/classes/${classId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: assignTitle.trim(),
          instructions: assignInstructions,
          dueDate: assignDueDate,
          maxScore: assignMaxScore,
          allowLateSubmission: assignAllowLate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat tugas baru.");

      setShowAssignmentModal(false);
      setAssignTitle("");
      setAssignInstructions("");
      setAssignDueDate("");
      loadAssignments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  // Handle Siswa Kumpul Tugas
  async function handleSubmitAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!submitModalAssign) return;

    setSubmitLoading(true);
    try {
      const res = await fetch(`/api/classroom/assignments/${submitModalAssign.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textContent: submitText,
          fileUrl: submitFileUrl || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengumpulkan tugas.");

      setSubmitModalAssign(null);
      setSubmitText("");
      setSubmitFileUrl("");
      loadAssignments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitLoading(false);
    }
  }

  // Handle Dosen Beri Nilai
  async function handleGradeSubmission(e: React.FormEvent) {
    e.preventDefault();
    if (!gradeModalSubmission) return;

    setGradeLoading(true);
    try {
      const res = await fetch(`/api/classroom/submissions/${gradeModalSubmission.id}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: gradeScore,
          feedback: gradeFeedback,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan nilai.");

      setGradeModalSubmission(null);
      loadAssignments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGradeLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-xs text-[#64748B]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span>Memuat ruang kelas...</span>
      </div>
    );
  }

  if (error || !classDetail) {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-8 text-center max-w-lg mx-auto shadow-xs">
        <div className="w-12 h-12 rounded-full bg-[#EFF6FF] text-[#1E40AF] flex items-center justify-center mx-auto mb-3">
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
            onClick={() => setActiveTab("TUGAS")}
            className={`pb-3 font-semibold transition-colors flex items-center gap-2 relative ${
              activeTab === "TUGAS" ? "text-[#1E40AF]" : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            <CheckSquare className="w-4 h-4" strokeWidth={1.75} />
            <span>Tugas & Evaluasi</span>
            {activeTab === "TUGAS" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E40AF] rounded-t" />}
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

          <button
            type="button"
            onClick={() => setActiveTab("PRESENSI")}
            className={`pb-3 font-semibold transition-colors flex items-center gap-2 relative ${
              activeTab === "PRESENSI" ? "text-[#1E40AF]" : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            <CalendarCheck className="w-4 h-4" strokeWidth={1.75} />
            <span>Presensi</span>
            {activeTab === "PRESENSI" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E40AF] rounded-t" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("NILAI")}
            className={`pb-3 font-semibold transition-colors flex items-center gap-2 relative ${
              activeTab === "NILAI" ? "text-[#1E40AF]" : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            <Award className="w-4 h-4" strokeWidth={1.75} />
            <span>Buku Nilai</span>
            {activeTab === "NILAI" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E40AF] rounded-t" />}
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
                {classDetail.topics?.length || 0} Topik
              </span>
            </div>

            {(!classDetail.topics || classDetail.topics.length === 0) ? (
              <p className="text-xs text-[#64748B] text-center py-6 italic">
                Belum ada materi pembelajaran yang diterbitkan.
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
                            <div className="flex items-center gap-0.5 mr-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleReorderTopic("UP", topic.id)}
                                disabled={topicIdx === 0}
                                title="Naikkan urutan topik"
                                className="p-0.5 text-[#64748B] hover:text-[#0F172A] disabled:opacity-30"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReorderTopic("DOWN", topic.id)}
                                disabled={topicIdx === classDetail.topics.length - 1}
                                title="Turunkan urutan topik"
                                className="p-0.5 text-[#64748B] hover:text-[#0F172A] disabled:opacity-30"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTopicId(topic.id);
                                  setShowMaterialModal(true);
                                }}
                                className="p-1 hover:text-[#1E40AF] rounded"
                                title="Tambah materi di topik ini"
                              >
                                <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                                <span className="sr-only">Tambah materi</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTopic(topic.id, topic.title)}
                                className="p-1 text-[#B91C1C] hover:bg-red-50 rounded"
                                title="Hapus topik"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
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
                            topicMaterials.map((mat: any, matIdx: number) => {
                              const isSelected = activeMaterial?.id === mat.id;
                              const isCompleted = mat.progress?.isCompleted;

                              return (
                                <div
                                  key={mat.id}
                                  className={`w-full p-2 rounded-[4px] text-xs flex items-center justify-between gap-1 transition ${
                                    isSelected ? "bg-[#EFF6FF] text-[#1E40AF] font-semibold" : "text-[#475569] hover:bg-[#F8FAFC]"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => setSelectedMaterialId(mat.id)}
                                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                                  >
                                    {isCompleted ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D] shrink-0" strokeWidth={2} />
                                    ) : (
                                      <Circle className="w-3.5 h-3.5 text-[#CBD5E1] shrink-0" strokeWidth={1.5} />
                                    )}
                                    <span className="truncate">{mat.title}</span>
                                  </button>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {mat.type === "FILE" && <Paperclip className="w-3 h-3 text-[#64748B]" />}
                                    {mat.type === "VIDEO_LINK" && <Video className="w-3 h-3 text-[#64748B]" />}
                                    {mat.type === "EXTERNAL_LINK" && <ExternalLink className="w-3 h-3 text-[#64748B]" />}

                                    {canEdit && (
                                      <div className="flex items-center gap-0.5 ml-1">
                                        <button
                                          type="button"
                                          onClick={() => handleReorderMaterial("UP", topic.id, mat.id)}
                                          disabled={matIdx === 0}
                                          className="p-0.5 text-[#64748B] hover:text-[#0F172A] disabled:opacity-30"
                                          title="Naikkan materi"
                                        >
                                          <ChevronUp className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleReorderMaterial("DOWN", topic.id, mat.id)}
                                          disabled={matIdx === topicMaterials.length - 1}
                                          className="p-0.5 text-[#64748B] hover:text-[#0F172A] disabled:opacity-30"
                                          title="Turunkan materi"
                                        >
                                          <ChevronDown className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteMaterial(mat.id, mat.title)}
                                          className="p-0.5 text-[#B91C1C] hover:bg-red-50 rounded"
                                          title="Hapus materi"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
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
                          <div className="text-xs font-semibold text-[#0F172A]">Dokumen Berkas Materi</div>
                          <div className="text-[11px] text-[#64748B]">Dapat diunduh atau dipelajari langsung</div>
                        </div>
                      </div>
                      {activeMaterial.files?.[0]?.downloadUrl && (
                        <a
                          href={activeMaterial.files[0].downloadUrl}
                          download
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white rounded-[6px] text-xs font-semibold transition shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Unduh Dokumen</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Video Embed Player 16:9 */}
                {activeMaterial.type === "VIDEO_LINK" && (
                  <div className="aspect-video w-full rounded-[8px] overflow-hidden bg-black border border-[#E2E8F0] shadow-xs">
                    <iframe
                      src={activeMaterial.videoUrl}
                      title={activeMaterial.title}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}

                {/* External Link Card */}
                {activeMaterial.type === "EXTERNAL_LINK" && (
                  <div className="p-6 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] text-center space-y-3">
                    <ExternalLink className="w-8 h-8 text-[#1E40AF] mx-auto" strokeWidth={1.5} />
                    <h3 className="text-sm font-semibold text-[#0F172A]">{activeMaterial.title}</h3>
                    <p className="text-xs text-[#64748B] max-w-sm mx-auto truncate font-mono">
                      {activeMaterial.url}
                    </p>
                    <a
                      href={activeMaterial.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white rounded-[6px] text-xs font-semibold transition shadow-xs"
                    >
                      <span>Buka Tautan di Tab Baru</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#64748B]">
                <BookOpen className="w-8 h-8 text-[#94A3B8] mb-2" strokeWidth={1.5} />
                <p className="text-xs">Pilih salah satu materi di samping untuk mulai belajar.</p>
              </div>
            )}

            {/* Bottom Action Bar */}
            {activeMaterial && (
              <div className="pt-6 mt-6 border-t border-[#F1F5F9] flex flex-wrap items-center justify-between gap-3">
                <div>
                  {prevMaterial ? (
                    <button
                      type="button"
                      onClick={() => setSelectedMaterialId(prevMaterial.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#F8FAFC] text-[#334155] border border-[#E2E8F0] rounded-[6px] text-xs font-medium transition shadow-xs"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 text-[#64748B]" />
                      <span>Sebelumnya</span>
                    </button>
                  ) : <div />}
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => handleToggleComplete(activeMaterial.id)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-xs font-semibold transition shadow-xs ${
                      activeMaterial.progress?.isCompleted
                        ? "bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]"
                        : "bg-[#1E40AF] hover:bg-[#1D4ED8] text-white"
                    }`}
                  >
                    {activeMaterial.progress?.isCompleted ? (
                      <>
                        <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                        <span>Selesai Dipelajari</span>
                      </>
                    ) : (
                      <>
                        <Circle className="w-3.5 h-3.5" strokeWidth={2} />
                        <span>Tandai Selesai</span>
                      </>
                    )}
                  </button>
                </div>

                <div>
                  {nextMaterial ? (
                    <button
                      type="button"
                      onClick={() => setSelectedMaterialId(nextMaterial.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#F8FAFC] text-[#334155] border border-[#E2E8F0] rounded-[6px] text-xs font-medium transition shadow-xs"
                    >
                      <span>Materi Berikutnya</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#64748B]" />
                    </button>
                  ) : <div />}
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* TAB 2: TUGAS & EVALUASI */}
      {activeTab === "TUGAS" && (
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F1F5F9]">
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A]">Tugas & Evaluasi Pembelajaran</h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Daftar penugasan mandiri dan kelompok untuk mengukur capaian pembelajaran kelas ini.
              </p>
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={() => setShowAssignmentModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white rounded-[6px] text-xs font-semibold transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                <span>+ Buat Tugas Baru</span>
              </button>
            )}
          </div>

          {assignmentsLoading ? (
            <div className="py-12 text-center text-xs text-[#64748B]">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              <span>Memuat penugasan...</span>
            </div>
          ) : assignments.length === 0 ? (
            <EmptyState
              title="Belum Ada Tugas di Kelas Ini"
              description="Pengajar belum membuat tugas atau evaluasi untuk kelas ini."
            />
          ) : (
            <div className="space-y-4">
              {assignments.map((assign) => {
                const mySub = assign.mySubmission;
                const isGraded = mySub?.status === "GRADED";
                const isSubmitted = !!mySub;
                const isLate = new Date() > new Date(assign.dueDate);

                return (
                  <div
                    key={assign.id}
                    className="border border-[#E2E8F0] hover:border-[#CBD5E1] rounded-[8px] p-5 transition space-y-3 bg-[#F8FAFC]"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-bold text-[#0F172A]">{assign.title}</h3>
                          {assign.status === "DRAFT" && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 bg-[#FEF3C7] text-[#B45309] rounded border border-[#FDE68A]">
                              DRAF
                            </span>
                          )}
                        </div>
                        <div
                          className="text-xs text-[#475569] leading-relaxed max-w-2xl"
                          dangerouslySetInnerHTML={{ __html: assign.instructions || "<p>Tidak ada instruksi khusus.</p>" }}
                        />
                      </div>

                      <div className="flex flex-col sm:items-end gap-1.5 shrink-0 text-xs">
                        <div className="flex items-center gap-1.5 text-[#64748B]">
                          <Clock className="w-3.5 h-3.5 text-[#64748B]" />
                          <span>Batas: {new Date(assign.dueDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <span className="font-semibold text-[#0F172A]">Maks: {assign.maxScore} Poin</span>

                        {/* Status Mahasiswa */}
                        {!canEdit && (
                          <div className="mt-1">
                            {isGraded ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#15803D] bg-[#DCFCE7] border border-[#BBF7D0] px-2 py-0.5 rounded font-mono">
                                <Award className="w-3 h-3" />
                                Nilai: {mySub.score}/{assign.maxScore}
                              </span>
                            ) : isSubmitted ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1D4ED8] bg-[#DBEAFE] border border-[#BFDBFE] px-2 py-0.5 rounded">
                                <CheckCircle2 className="w-3 h-3" />
                                Sudah Dikumpulkan
                              </span>
                            ) : isLate ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B91C1C] bg-[#FEE2E2] border border-[#FECACA] px-2 py-0.5 rounded">
                                <AlertCircle className="w-3 h-3" />
                                Terlambat
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B45309] bg-[#FEF3C7] border border-[#FDE68A] px-2 py-0.5 rounded">
                                Belum Dikumpulkan
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Student Action / Submission Result */}
                    {!canEdit && (
                      <div className="pt-3 border-t border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        {isGraded && mySub.feedback && (
                          <div className="p-2.5 bg-white rounded border border-[#E2E8F0] text-xs text-[#334155] w-full sm:w-auto flex-1">
                            <strong>Umpan Balik Dosen:</strong> {mySub.feedback}
                          </div>
                        )}
                        <div className="ml-auto">
                          <button
                            type="button"
                            onClick={() => {
                              setSubmitModalAssign(assign);
                              setSubmitText(mySub?.textContent || "");
                              setSubmitFileUrl(mySub?.fileUrl || "");
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white rounded-[6px] text-xs font-semibold transition shadow-xs"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{isSubmitted ? "Kirim Ulang Jawaban" : "Kumpulkan Jawaban"}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Teacher Action / Submissions Stats */}
                    {canEdit && (
                      <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
                        <span className="text-[#64748B]">
                          {assign.submissionCount || assign.submissions?.length || 0}/{studentCount} mahasiswa mengumpulkan
                        </span>
                        {assign.submissions && assign.submissions.length > 0 && (
                          <div className="flex gap-2">
                            {assign.submissions.map((sub: any) => (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => {
                                  setGradeModalSubmission(sub);
                                  setGradeScore(sub.score ?? assign.maxScore);
                                  setGradeFeedback(sub.feedback || "");
                                }}
                                className="px-2.5 py-1 bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] rounded text-[11px] font-medium transition"
                              >
                                Nilai: {sub.student?.fullName || "Mahasiswa"} {sub.score !== null ? `(${sub.score}p)` : "(Baru)"}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: BERANDA & SILABUS (PENGUMUMAN & SILABUS) */}
      {activeTab === "BERANDA" && (
        <AnnouncementsTab
          classCourseId={classId}
          isInstructor={canEdit}
          classDetail={classDetail}
          primaryInstructor={primaryInstructor}
        />
      )}

      {/* TAB 4: ANGGOTA KELAS */}
      {activeTab === "ANGGOTA" && (
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#1E40AF]" strokeWidth={1.75} />
              <h2 className="text-sm font-semibold text-[#0F172A]">Daftar Anggota Kelas</h2>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Cari anggota atau NIM/NIDN..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-2.5 text-xs bg-white border border-[#CBD5E1] rounded-[6px]"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-[#E2E8F0] rounded-[6px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#475569] font-semibold">
                <tr>
                  <th className="p-3">Nama & Identitas</th>
                  <th className="p-3">Peran di Kelas</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] text-[#0F172A]">
                {filteredMembers.map((member: any) => (
                  <tr key={member.id} className="hover:bg-[#F8FAFC] transition">
                    <td className="p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#1E40AF] text-white flex items-center justify-center font-semibold text-xs shrink-0 shadow-xs">
                        {member.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-[#0F172A]">{member.fullName}</div>
                        <div className="text-[11px] font-mono text-[#64748B]">
                          {member.identifier || "-"}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE]">
                        {member.role === "PENGAJAR" ? "Dosen Pengampu" : "Mahasiswa"}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]">
                        Aktif
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: PRESENSI PERKULIAHAN */}
      {activeTab === "PRESENSI" && (
        <AttendanceTab
          classCourseId={classId}
          isInstructor={canEdit}
          currentUserId={session?.user?.id || ""}
        />
      )}

      {/* TAB 6: BUKU NILAI & EVALUASI */}
      {activeTab === "NILAI" && (
        <GradebookTab
          classCourseId={classId}
          isInstructor={canEdit}
          currentUserId={session?.user?.id || ""}
        />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-xl max-w-xl w-full p-5 space-y-4 animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <h3 className="text-sm font-semibold text-[#0F172A]">Tambah Materi Pembelajaran</h3>
              <button type="button" onClick={handleCloseMaterialModal} className="p-1 text-[#64748B] hover:text-[#0F172A]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateMaterial} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Tipe Materi</label>
                <select value={materialType} onChange={(e) => setMaterialType(e.target.value as any)} className="w-full h-8 px-2 text-xs border border-[#CBD5E1] rounded-[6px] bg-white">
                  <option value="RICH_TEXT">Artikel / Teks Kaya (Rich Text)</option>
                  <option value="FILE">Dokumen / Berkas (PDF, DOCX, ZIP)</option>
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

              {/* Rich Text Editor */}
              {materialType === "RICH_TEXT" && (
                <div>
                  <label className="block text-xs font-medium text-[#334155] mb-1">Konten Materi</label>
                  <RichTextEditor
                    value={materialContent}
                    onChange={setMaterialContent}
                    draftKey={`lms_draft_${classId}_${selectedTopicId}`}
                  />
                </div>
              )}

              {/* File Upload Option */}
              {materialType === "FILE" && (
                <div className="p-4 border border-dashed border-[#CBD5E1] rounded-[8px] bg-[#F8FAFC] space-y-2 text-center">
                  <label className="cursor-pointer block">
                    <Upload className="w-8 h-8 text-[#64748B] mx-auto mb-1" />
                    <span className="text-xs font-semibold text-[#1E40AF]">
                      {uploadingMaterialFile ? "Mengunggah berkas..." : "Pilih Berkas Dokumen"}
                    </span>
                    <p className="text-[11px] text-[#64748B]">PDF, DOCX, PPTX, XLS, ZIP (Maks. 25MB)</p>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip"
                      disabled={uploadingMaterialFile}
                      onChange={handleMaterialFileUpload}
                      className="sr-only"
                    />
                  </label>
                  {materialUploadedFile && (
                    <div className="text-xs font-medium text-[#15803D] pt-1">
                      Berkas siap: {materialUploadedFile.fileName} ({(materialUploadedFile.fileSize / 1024).toFixed(1)} KB)
                    </div>
                  )}
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
                <button type="button" onClick={handleCloseMaterialModal} className="px-3 py-1.5 text-xs border border-[#E2E8F0] rounded-[6px] hover:bg-[#F8FAFC]">
                  Batal
                </button>
                <button type="submit" disabled={actionLoading || uploadingMaterialFile} className="px-4 py-1.5 bg-[#1E40AF] text-white text-xs font-semibold rounded-[6px] hover:bg-[#1D4ED8] disabled:opacity-50">
                  {actionLoading ? "Menyimpan..." : "Simpan Materi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Buat Tugas Baru */}
      {showAssignmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <h3 className="text-sm font-semibold text-[#0F172A]">Buat Tugas Pembelajaran Baru</h3>
              <button type="button" onClick={() => setShowAssignmentModal(false)} className="p-1 text-[#64748B] hover:text-[#0F172A]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateAssignment} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Judul Tugas</label>
                <input
                  type="text"
                  required
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  placeholder="Contoh: Tugas 1 - Analisis Kebutuhan Sistem"
                  className="w-full h-8 px-2.5 text-xs border border-[#CBD5E1] rounded-[6px]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Instruksi Tugas</label>
                <textarea
                  rows={3}
                  value={assignInstructions}
                  onChange={(e) => setAssignInstructions(e.target.value)}
                  placeholder="Jelaskan instruksi pengerjaan tugas..."
                  className="w-full p-2 text-xs border border-[#CBD5E1] rounded-[6px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#334155] mb-1">Batas Waktu Pengumpulan</label>
                  <input
                    type="datetime-local"
                    required
                    value={assignDueDate}
                    onChange={(e) => setAssignDueDate(e.target.value)}
                    className="w-full h-8 px-2 text-xs border border-[#CBD5E1] rounded-[6px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#334155] mb-1">Nilai Maksimal</label>
                  <input
                    type="number"
                    value={assignMaxScore}
                    onChange={(e) => setAssignMaxScore(parseFloat(e.target.value))}
                    className="w-full h-8 px-2 text-xs border border-[#CBD5E1] rounded-[6px]"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="allowLate"
                  checked={assignAllowLate}
                  onChange={(e) => setAssignAllowLate(e.target.checked)}
                  className="rounded border-[#CBD5E1]"
                />
                <label htmlFor="allowLate" className="text-xs text-[#475569]">
                  Izinkan pengumpulan terlambat
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#F1F5F9]">
                <button type="button" onClick={() => setShowAssignmentModal(false)} className="px-3 py-1.5 text-xs border border-[#E2E8F0] rounded-[6px] hover:bg-[#F8FAFC]">
                  Batal
                </button>
                <button type="submit" disabled={actionLoading} className="px-4 py-1.5 bg-[#1E40AF] text-white text-xs font-semibold rounded-[6px] hover:bg-[#1D4ED8] disabled:opacity-50">
                  {actionLoading ? "Menyimpan..." : "Terbitkan Tugas"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Siswa Kumpul Tugas */}
      {submitModalAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <h3 className="text-sm font-semibold text-[#0F172A]">Kumpulkan Jawaban Tugas</h3>
              <button type="button" onClick={() => setSubmitModalAssign(null)} className="p-1 text-[#64748B] hover:text-[#0F172A]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitAssignment} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Teks Jawaban / Catatan</label>
                <textarea
                  rows={4}
                  value={submitText}
                  onChange={(e) => setSubmitText(e.target.value)}
                  placeholder="Ketik jawaban tugas atau tautan drive Anda..."
                  className="w-full p-2 text-xs border border-[#CBD5E1] rounded-[6px]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Tautan Berkas Jawaban (Opsional)</label>
                <input
                  type="url"
                  value={submitFileUrl}
                  onChange={(e) => setSubmitFileUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full h-8 px-2.5 text-xs border border-[#CBD5E1] rounded-[6px]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#F1F5F9]">
                <button type="button" onClick={() => setSubmitModalAssign(null)} className="px-3 py-1.5 text-xs border border-[#E2E8F0] rounded-[6px] hover:bg-[#F8FAFC]">
                  Batal
                </button>
                <button type="submit" disabled={submitLoading} className="px-4 py-1.5 bg-[#1E40AF] text-white text-xs font-semibold rounded-[6px] hover:bg-[#1D4ED8] disabled:opacity-50">
                  {submitLoading ? "Mengirim..." : "Kirimkan Sekarang"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Dosen Beri Nilai */}
      {gradeModalSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <h3 className="text-sm font-semibold text-[#0F172A]">Beri Nilai & Umpan Balik</h3>
              <button type="button" onClick={() => setGradeModalSubmission(null)} className="p-1 text-[#64748B] hover:text-[#0F172A]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleGradeSubmission} className="space-y-3">
              <div className="p-2.5 bg-[#F8FAFC] rounded border border-[#E2E8F0] text-xs">
                <div><strong>Mahasiswa:</strong> {gradeModalSubmission.student?.fullName}</div>
                {gradeModalSubmission.textContent && (
                  <div className="mt-1"><strong>Jawaban:</strong> {gradeModalSubmission.textContent}</div>
                )}
                {gradeModalSubmission.fileUrl && (
                  <div className="mt-1"><strong>Tautan:</strong> <a href={gradeModalSubmission.fileUrl} target="_blank" className="text-[#1E40AF] underline">{gradeModalSubmission.fileUrl}</a></div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Skor / Nilai (0 - 100)</label>
                <input
                  type="number"
                  required
                  min={0}
                  max={100}
                  value={gradeScore}
                  onChange={(e) => setGradeScore(parseFloat(e.target.value))}
                  className="w-full h-8 px-2 text-xs border border-[#CBD5E1] rounded-[6px]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">Catatan Umpan Balik</label>
                <textarea
                  rows={3}
                  value={gradeFeedback}
                  onChange={(e) => setGradeFeedback(e.target.value)}
                  placeholder="Bagus, pertahankan struktur analisis..."
                  className="w-full p-2 text-xs border border-[#CBD5E1] rounded-[6px]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#F1F5F9]">
                <button type="button" onClick={() => setGradeModalSubmission(null)} className="px-3 py-1.5 text-xs border border-[#E2E8F0] rounded-[6px] hover:bg-[#F8FAFC]">
                  Batal
                </button>
                <button type="submit" disabled={gradeLoading} className="px-4 py-1.5 bg-[#1E40AF] text-white text-xs font-semibold rounded-[6px] hover:bg-[#1D4ED8] disabled:opacity-50">
                  {gradeLoading ? "Menyimpan..." : "Simpan Nilai"}
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
                <select required value={targetClassId} onChange={(e) => setTargetClassId(e.target.value)} className="w-full h-8 px-2 text-xs border border-[#CBD5E1] rounded-[6px] bg-white">
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
