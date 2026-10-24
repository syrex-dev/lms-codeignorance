import { prisma } from "@/lib/db/prisma";
import { withTenantTransaction } from "@/lib/db/tenant-prisma";
import { requireFeature } from "@/modules/saas/entitlement";
import { sanitizeRichText, isSafeUrl } from "./sanitizer";
import { processVideoUrl } from "./video-helper";
import { validateMaterialFile, checkTenantStorageQuota, generateSignedFileToken } from "./file-security";
import {
  PublishStatus,
  MaterialType,
  CreateTopicInput,
  UpdateTopicInput,
  CreateMaterialInput,
  UpdateMaterialInput,
  ClassroomCopyInput,
} from "./types";
import { UserRole } from "@prisma/client";

/**
 * Audit Log Helper
 */
async function recordClassroomAudit(
  tenantDb: any,
  params: {
    institutionId: string;
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    details?: any;
  }
) {
  try {
    await tenantDb.auditLog.create({
      data: {
        institutionId: params.institutionId,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        newValue: params.details || {},
      },
    });
  } catch (err) {
    console.error("Failed to record classroom audit log:", err);
  }
}

/**
 * 1. ENTITLEMENT GUARD
 */
export async function assertClassroomEntitlement(institutionId: string) {
  await requireFeature(institutionId, "classroom");
}

/**
 * 2. GET DAFTAR KELAS (Admin, Guru, Siswa)
 */
export async function getClassroomsForUser(params: {
  institutionId: string;
  userId: string;
  role: string;
  termId?: string;
  search?: string;
  currentTime?: Date;
}) {
  const { institutionId, userId, role, termId, search, currentTime = new Date() } = params;
  await assertClassroomEntitlement(institutionId);

  return withTenantTransaction(institutionId, async (tenantDb) => {
    const where: any = {
      institutionId,
      deletedAt: null,
      isArchived: false,
    };

    if (termId) {
      where.academicTermId = termId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    // Role-based filtering
    if (role === UserRole.STUDENT) {
      where.enrollments = {
        some: {
          studentUserId: userId,
          status: "ACTIVE",
        },
      };
    } else if (role === UserRole.TEACHER) {
      where.instructors = {
        some: {
          instructorUserId: userId,
        },
      };
    } else if (role === UserRole.INSTITUTION_ADMIN || role === UserRole.SUPER_ADMIN) {
      // Admin sees all
    } else {
      // Peran lain tidak memiliki akses ke ruang kelas
      return [];
    }

    const classes = await tenantDb.classCourse.findMany({
      where,
      include: {
        academicTerm: true,
        programDepartment: true,
        instructors: {
          include: {
            instructor: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            enrollments: true,
            topics: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Jika siswa, hitung progres untuk setiap kelas
    if (role === UserRole.STUDENT) {
      const classesWithProgress = await Promise.all(
        classes.map(async (c: any) => {
          const progress = await calculateClassProgress(tenantDb, institutionId, c.id, userId, currentTime);
          return {
            ...c,
            progressPercentage: progress.percentage,
          };
        })
      );
      return classesWithProgress;
    }

    return classes;
  });
}

/**
 * 3. GET DETAIL KELAS & KONTEN (Topik, Materi, Anggota)
 */
export async function getClassroomDetail(params: {
  institutionId: string;
  classCourseId: string;
  userId: string;
  role: string;
  currentTime?: Date;
  isPreviewAsStudent?: boolean;
}) {
  const { institutionId, classCourseId, userId, role, currentTime = new Date(), isPreviewAsStudent = false } = params;
  await assertClassroomEntitlement(institutionId);

  return withTenantTransaction(institutionId, async (tenantDb) => {
    const classCourse = await tenantDb.classCourse.findFirst({
      where: {
        id: classCourseId,
        institutionId,
        deletedAt: null,
      },
      include: {
        academicTerm: true,
        programDepartment: true,
        instructors: {
          include: {
            instructor: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        },
        enrollments: {
          where: { status: "ACTIVE" },
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
                // PRIVASI KETAT: TIDAK ADA nomor HP, tanggal lahir, atau contactEmail!
              },
            },
          },
        },
        topics: {
          where: { deletedAt: null },
          orderBy: { orderIndex: "asc" },
          include: {
            materials: {
              where: { deletedAt: null },
              orderBy: { orderIndex: "asc" },
              include: {
                files: true,
                progresses: {
                  where: { studentUserId: userId },
                },
              },
            },
          },
        },
      },
    });

    if (!classCourse) {
      return null;
    }

    const isTeacher = classCourse.instructors.some((i: any) => i.instructorUserId === userId);
    const isEnrolled = classCourse.enrollments.some((e: any) => e.studentUserId === userId);
    let isAdmin = false;
    if (role === UserRole.INSTITUTION_ADMIN || role === UserRole.SUPER_ADMIN) {
      const adminMember = await tenantDb.membership.findFirst({
        where: {
          institutionId,
          userId,
          role: { in: [UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN] },
        },
      });
      isAdmin = !!adminMember;
    }

    // Hak akses fail-closed
    if (!isAdmin && !isTeacher && !isEnrolled) {
      return null; // 404 objek tidak boleh diketahui
    }

    const viewAsStudent = (role === UserRole.STUDENT) || (isTeacher && isPreviewAsStudent);

    // Filter materi dan topik jika dilihat sebagai siswa
    let visibleTopics = classCourse.topics;

    if (viewAsStudent) {
      visibleTopics = visibleTopics
        .filter((t: any) => {
          if (t.status === PublishStatus.DRAFT) return false;
          if (t.status === PublishStatus.SCHEDULED) {
            return t.publishAt && new Date(t.publishAt) <= currentTime;
          }
          return true;
        })
        .map((t: any) => {
          const visibleMaterials = t.materials.filter((m: any) => {
            if (m.status === PublishStatus.DRAFT) return false;
            if (m.status === PublishStatus.SCHEDULED) {
              return m.publishAt && new Date(m.publishAt) <= currentTime;
            }
            return true;
          });
          return {
            ...t,
            materials: visibleMaterials,
          };
        });
    }

    // Attach signed download URLs for files
    const enrichedTopics = visibleTopics.map((topic: any) => ({
      ...topic,
      materials: topic.materials.map((mat: any) => ({
        ...mat,
        files: mat.files.map((file: any) => ({
          id: file.id,
          fileName: file.fileName,
          mimeType: file.mimeType,
          fileSize: file.fileSize,
          downloadUrl: `/api/${classCourse.institutionId}/classroom/files/${file.id}/download?token=${generateSignedFileToken({
            fileId: file.id,
            materialId: mat.id,
            classCourseId,
            institutionId,
            userId,
          })}`,
        })),
        progress: mat.progresses?.[0] || null,
      })),
    }));

    // Hitung progress kelas
    let progressPercentage = 0;
    if (viewAsStudent) {
      const prog = await calculateClassProgress(tenantDb, institutionId, classCourseId, userId, currentTime);
      progressPercentage = prog.percentage;
    }

    // Tab Anggota tersanitasi (hanya nama, avatar, dan peran)
    const sanitizedMembers = [
      ...classCourse.instructors.map((i: any) => ({
        id: i.instructor.id,
        fullName: i.instructor.fullName,
        avatarUrl: i.instructor.avatarUrl,
        role: "PENGAJAR",
        isPrimary: i.isPrimary,
      })),
      ...classCourse.enrollments.map((e: any) => ({
        id: e.student.id,
        fullName: e.student.fullName,
        avatarUrl: e.student.avatarUrl,
        role: "SISWA",
      })),
    ];

    return {
      ...classCourse,
      topics: enrichedTopics,
      members: sanitizedMembers,
      isTeacher,
      isEnrolled,
      isAdmin,
      progressPercentage,
    };
  });
}

/**
 * 4. TOPIK CRUD & REORDERING
 */
export async function createTopic(params: {
  institutionId: string;
  classCourseId: string;
  userId: string;
  role: string;
  input: CreateTopicInput;
}) {
  const { institutionId, classCourseId, userId, role, input } = params;
  await assertClassroomEntitlement(institutionId);

  return withTenantTransaction(institutionId, async (tenantDb) => {
    await assertTeacherOrAdmin(tenantDb, institutionId, classCourseId, userId, role);

    const count = await tenantDb.topic.count({
      where: { classCourseId, deletedAt: null },
    });

    const topic = await tenantDb.topic.create({
      data: {
        institutionId,
        classCourseId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        meetingNumber: input.meetingNumber || null,
        status: input.status || PublishStatus.PUBLISHED,
        publishAt: input.publishAt ? new Date(input.publishAt) : null,
        orderIndex: count,
      },
    });

    await recordClassroomAudit(tenantDb, {
      institutionId,
      userId,
      action: "CREATE_TOPIC",
      entityType: "Topic",
      entityId: topic.id,
      details: { classCourseId, title: topic.title },
    });

    return topic;
  });
}

export async function updateTopic(params: {
  institutionId: string;
  topicId: string;
  userId: string;
  role: string;
  input: UpdateTopicInput;
}) {
  const { institutionId, topicId, userId, role, input } = params;
  await assertClassroomEntitlement(institutionId);

  return withTenantTransaction(institutionId, async (tenantDb) => {
    const existing = await tenantDb.topic.findFirst({
      where: { id: topicId, institutionId, deletedAt: null },
    });
    if (!existing) throw new Error("Topik tidak ditemukan.");

    await assertTeacherOrAdmin(tenantDb, institutionId, existing.classCourseId, userId, role);

    const data: any = {};
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.description !== undefined) data.description = input.description?.trim() || null;
    if (input.meetingNumber !== undefined) data.meetingNumber = input.meetingNumber;
    if (input.status !== undefined) data.status = input.status;
    if (input.publishAt !== undefined) data.publishAt = input.publishAt ? new Date(input.publishAt) : null;
    if (input.orderIndex !== undefined) data.orderIndex = input.orderIndex;

    const updated = await tenantDb.topic.update({
      where: { id: topicId },
      data,
    });

    await recordClassroomAudit(tenantDb, {
      institutionId,
      userId,
      action: "UPDATE_TOPIC",
      entityType: "Topic",
      entityId: topicId,
      details: data,
    });

    return updated;
  });
}

export async function deleteTopic(params: {
  institutionId: string;
  topicId: string;
  userId: string;
  role: string;
}) {
  const { institutionId, topicId, userId, role } = params;
  await assertClassroomEntitlement(institutionId);

  return withTenantTransaction(institutionId, async (tenantDb) => {
    const existing = await tenantDb.topic.findFirst({
      where: { id: topicId, institutionId, deletedAt: null },
    });
    if (!existing) throw new Error("Topik tidak ditemukan.");

    await assertTeacherOrAdmin(tenantDb, institutionId, existing.classCourseId, userId, role);

    // Soft delete topic and its materials
    await tenantDb.topic.update({
      where: { id: topicId },
      data: { deletedAt: new Date() },
    });

    await tenantDb.material.updateMany({
      where: { topicId },
      data: { deletedAt: new Date() },
    });

    await recordClassroomAudit(tenantDb, {
      institutionId,
      userId,
      action: "DELETE_TOPIC",
      entityType: "Topic",
      entityId: topicId,
    });

    return { success: true };
  });
}

export async function reorderTopics(params: {
  institutionId: string;
  classCourseId: string;
  topicIds: string[];
  userId: string;
  role: string;
}) {
  const { institutionId, classCourseId, topicIds, userId, role } = params;
  await assertClassroomEntitlement(institutionId);

  return withTenantTransaction(institutionId, async (tenantDb) => {
    await assertTeacherOrAdmin(tenantDb, institutionId, classCourseId, userId, role);

    await Promise.all(
      topicIds.map((id, index) =>
        tenantDb.topic.updateMany({
          where: { id, classCourseId, institutionId },
          data: { orderIndex: index },
        })
      )
    );

    return { success: true };
  });
}

/**
 * 5. MATERI CRUD
 */
export async function createMaterial(params: {
  institutionId: string;
  topicId: string;
  userId: string;
  role: string;
  input: CreateMaterialInput;
}) {
  const { institutionId, topicId, userId, role, input } = params;
  await assertClassroomEntitlement(institutionId);

  return withTenantTransaction(institutionId, async (tenantDb) => {
    const topic = await tenantDb.topic.findFirst({
      where: { id: topicId, institutionId, deletedAt: null },
    });
    if (!topic) throw new Error("Topik tidak ditemukan.");

    await assertTeacherOrAdmin(tenantDb, institutionId, topic.classCourseId, userId, role);

    // Sanitasi & Validasi konten sesuai tipe
    let safeContent = input.content;
    let safeUrl = input.url;
    let safeVideoUrl = input.videoUrl;

    if (input.type === MaterialType.RICH_TEXT && input.content) {
      safeContent = sanitizeRichText(input.content);
    } else if (input.type === MaterialType.VIDEO_LINK && input.videoUrl) {
      const vid = processVideoUrl(input.videoUrl);
      if (!vid.isValid) throw new Error(vid.error || "URL video tidak valid.");
      safeVideoUrl = vid.embedUrl;
      safeUrl = vid.originalUrl;
    } else if (input.type === MaterialType.EXTERNAL_LINK && input.url) {
      if (!isSafeUrl(input.url)) throw new Error("Tautan eksternal tidak aman.");
      safeUrl = input.url.trim();
    }

    const count = await tenantDb.material.count({
      where: { topicId, deletedAt: null },
    });

    const material = await tenantDb.material.create({
      data: {
        institutionId,
        topicId,
        type: input.type,
        title: input.title.trim(),
        content: safeContent || null,
        url: safeUrl || null,
        videoUrl: safeVideoUrl || null,
        status: input.status || PublishStatus.PUBLISHED,
        publishAt: input.publishAt ? new Date(input.publishAt) : null,
        isRequired: input.isRequired ?? true,
        orderIndex: count,
      },
    });

    // Handle files if provided
    if (input.files && input.files.length > 0) {
      await Promise.all(
        input.files.map((file) =>
          tenantDb.materialFile.create({
            data: {
              institutionId,
              materialId: material.id,
              storageKey: file.storageKey,
              fileName: file.fileName,
              mimeType: file.mimeType,
              fileSize: file.fileSize,
              checksum: file.checksum || null,
              uploadedById: userId,
            },
          })
        )
      );
    }

    await recordClassroomAudit(tenantDb, {
      institutionId,
      userId,
      action: "CREATE_MATERIAL",
      entityType: "Material",
      entityId: material.id,
      details: { topicId, title: material.title, type: material.type },
    });

    return material;
  });
}

export async function updateMaterial(params: {
  institutionId: string;
  materialId: string;
  userId: string;
  role: string;
  input: UpdateMaterialInput;
}) {
  const { institutionId, materialId, userId, role, input } = params;
  await assertClassroomEntitlement(institutionId);

  return withTenantTransaction(institutionId, async (tenantDb) => {
    const existing = await tenantDb.material.findFirst({
      where: { id: materialId, institutionId, deletedAt: null },
      include: { topic: true },
    });
    if (!existing) throw new Error("Materi tidak ditemukan.");

    await assertTeacherOrAdmin(tenantDb, institutionId, existing.topic.classCourseId, userId, role);

    const data: any = {};
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.type !== undefined) data.type = input.type;
    if (input.isRequired !== undefined) data.isRequired = input.isRequired;
    if (input.status !== undefined) data.status = input.status;
    if (input.publishAt !== undefined) data.publishAt = input.publishAt ? new Date(input.publishAt) : null;
    if (input.orderIndex !== undefined) data.orderIndex = input.orderIndex;

    if (input.content !== undefined) {
      data.content = existing.type === MaterialType.RICH_TEXT ? sanitizeRichText(input.content) : input.content;
    }
    if (input.videoUrl !== undefined) {
      const vid = processVideoUrl(input.videoUrl);
      if (!vid.isValid) throw new Error(vid.error || "URL video tidak valid.");
      data.videoUrl = vid.embedUrl;
      data.url = vid.originalUrl;
    }
    if (input.url !== undefined) {
      if (!isSafeUrl(input.url)) throw new Error("Tautan tidak aman.");
      data.url = input.url.trim();
    }

    const updated = await tenantDb.material.update({
      where: { id: materialId },
      data,
    });

    await recordClassroomAudit(tenantDb, {
      institutionId,
      userId,
      action: "UPDATE_MATERIAL",
      entityType: "Material",
      entityId: materialId,
      details: data,
    });

    return updated;
  });
}

export async function deleteMaterial(params: {
  institutionId: string;
  materialId: string;
  userId: string;
  role: string;
}) {
  const { institutionId, materialId, userId, role } = params;
  await assertClassroomEntitlement(institutionId);

  return withTenantTransaction(institutionId, async (tenantDb) => {
    const existing = await tenantDb.material.findFirst({
      where: { id: materialId, institutionId, deletedAt: null },
      include: { topic: true },
    });
    if (!existing) throw new Error("Materi tidak ditemukan.");

    await assertTeacherOrAdmin(tenantDb, institutionId, existing.topic.classCourseId, userId, role);

    await tenantDb.material.update({
      where: { id: materialId },
      data: { deletedAt: new Date() },
    });

    await recordClassroomAudit(tenantDb, {
      institutionId,
      userId,
      action: "DELETE_MATERIAL",
      entityType: "Material",
      entityId: materialId,
    });

    return { success: true };
  });
}

/**
 * 6. PROGRES BELAJAR SISWA
 */
export async function markMaterialCompleted(params: {
  institutionId: string;
  materialId: string;
  studentUserId: string;
}) {
  const { institutionId, materialId, studentUserId } = params;
  await assertClassroomEntitlement(institutionId);

  return withTenantTransaction(institutionId, async (tenantDb) => {
    // Validasi materi ada dan siswa ter-enroll
    const material = await tenantDb.material.findFirst({
      where: { id: materialId, institutionId, deletedAt: null },
      include: { topic: true },
    });
    if (!material) throw new Error("Materi tidak ditemukan.");

    const enrollment = await tenantDb.classEnrollment.findFirst({
      where: {
        classCourseId: material.topic.classCourseId,
        studentUserId,
        status: "ACTIVE",
      },
    });
    if (!enrollment) throw new Error("Anda tidak terdaftar dalam kelas ini.");

    // Idempotent upsert
    const progress = await tenantDb.materialProgress.upsert({
      where: {
        studentUserId_materialId: {
          studentUserId,
          materialId,
        },
      },
      update: {
        isCompleted: true,
        completedAt: new Date(),
        lastViewedAt: new Date(),
      },
      create: {
        institutionId,
        studentUserId,
        materialId,
        isCompleted: true,
        completedAt: new Date(),
        lastViewedAt: new Date(),
      },
    });

    return progress;
  });
}

export async function recordMaterialView(params: {
  institutionId: string;
  materialId: string;
  studentUserId: string;
}) {
  const { institutionId, materialId, studentUserId } = params;
  return withTenantTransaction(institutionId, async (tenantDb) => {
    return tenantDb.materialProgress.upsert({
      where: {
        studentUserId_materialId: {
          studentUserId,
          materialId,
        },
      },
      update: {
        lastViewedAt: new Date(),
      },
      create: {
        institutionId,
        studentUserId,
        materialId,
        isCompleted: false,
        lastViewedAt: new Date(),
      },
    });
  });
}

/**
 * Kalkulasi persentase progres belajar:
 * persentase = materi wajib yang selesai / materi wajib yang sudah terbit (PUBLISHED / SCHEDULED <= now)
 */
export async function calculateClassProgress(
  tenantDb: any,
  institutionId: string,
  classCourseId: string,
  studentUserId: string,
  currentTime: Date = new Date()
): Promise<{ completedCount: number; totalCount: number; percentage: number }> {
  // Ambil semua materi wajib yang sudah terbit di kelas ini
  const publishedTopics = await tenantDb.topic.findMany({
    where: {
      classCourseId,
      institutionId,
      deletedAt: null,
      OR: [
        { status: PublishStatus.PUBLISHED },
        { status: PublishStatus.SCHEDULED, publishAt: { lte: currentTime } },
      ],
    },
    select: { id: true },
  });

  const topicIds = publishedTopics.map((t: any) => t.id);
  if (topicIds.length === 0) {
    return { completedCount: 0, totalCount: 0, percentage: 100 };
  }

  // Materi wajib yang terbit
  const requiredMaterials = await tenantDb.material.findMany({
    where: {
      institutionId,
      topicId: { in: topicIds },
      deletedAt: null,
      isRequired: true,
      OR: [
        { status: PublishStatus.PUBLISHED },
        { status: PublishStatus.SCHEDULED, publishAt: { lte: currentTime } },
      ],
    },
    select: { id: true },
  });

  const totalCount = requiredMaterials.length;
  if (totalCount === 0) {
    return { completedCount: 0, totalCount: 0, percentage: 100 };
  }

  const materialIds = requiredMaterials.map((m: any) => m.id);

  // Materi yang sudah diselesaikan siswa
  const completedProgresses = await tenantDb.materialProgress.count({
    where: {
      institutionId,
      studentUserId,
      materialId: { in: materialIds },
      isCompleted: true,
    },
  });

  const percentage = Math.round((completedProgresses / totalCount) * 100);

  return {
    completedCount: completedProgresses,
    totalCount,
    percentage,
  };
}

/**
 * 7. SALIN KONTEN ANTAR KELAS (DRAFT di tenant yang sama, tanpa progres)
 */
export async function copyClassroomContent(params: {
  institutionId: string;
  sourceClassCourseId: string;
  targetClassCourseId: string;
  userId: string;
  role: string;
  includeDrafts?: boolean;
}) {
  const { institutionId, sourceClassCourseId, targetClassCourseId, userId, role, includeDrafts = false } = params;
  await assertClassroomEntitlement(institutionId);

  return withTenantTransaction(institutionId, async (tenantDb) => {
    // Pastikan kedua kelas berada di tenant yang sama
    const sourceClass = await tenantDb.classCourse.findFirst({
      where: { id: sourceClassCourseId, institutionId, deletedAt: null },
      include: {
        topics: {
          where: { deletedAt: null },
          orderBy: { orderIndex: "asc" },
          include: {
            materials: {
              where: { deletedAt: null },
              orderBy: { orderIndex: "asc" },
              include: { files: true },
            },
          },
        },
      },
    });

    const targetClass = await tenantDb.classCourse.findFirst({
      where: { id: targetClassCourseId, institutionId, deletedAt: null },
    });

    if (!sourceClass || !targetClass) {
      throw new Error("Kelas sumber atau kelas tujuan tidak ditemukan di tenant ini.");
    }

    await assertTeacherOrAdmin(tenantDb, institutionId, targetClassCourseId, userId, role);

    // Ambil orderIndex awal untuk target class
    let currentTopicIndex = await tenantDb.topic.count({
      where: { classCourseId: targetClassCourseId, deletedAt: null },
    });

    let copiedTopicsCount = 0;
    let copiedMaterialsCount = 0;

    for (const srcTopic of sourceClass.topics) {
      if (!includeDrafts && srcTopic.status === PublishStatus.DRAFT) continue;

      const newTopic = await tenantDb.topic.create({
        data: {
          institutionId,
          classCourseId: targetClassCourseId,
          title: `${srcTopic.title} (Salinan)`,
          description: srcTopic.description,
          meetingNumber: srcTopic.meetingNumber,
          status: PublishStatus.DRAFT, // Salinan selalu berstatus DRAFT
          orderIndex: currentTopicIndex++,
        },
      });
      copiedTopicsCount++;

      let currentMaterialIndex = 0;
      for (const srcMat of srcTopic.materials) {
        if (!includeDrafts && srcMat.status === PublishStatus.DRAFT) continue;

        const newMat = await tenantDb.material.create({
          data: {
            institutionId,
            topicId: newTopic.id,
            type: srcMat.type,
            title: srcMat.title,
            content: srcMat.content,
            url: srcMat.url,
            videoUrl: srcMat.videoUrl,
            status: PublishStatus.DRAFT, // Salinan materi selalu DRAFT
            isRequired: srcMat.isRequired,
            orderIndex: currentMaterialIndex++,
          },
        });
        copiedMaterialsCount++;

        // Referensikan berkas materi dengan aman
        for (const srcFile of srcMat.files) {
          await tenantDb.materialFile.create({
            data: {
              institutionId,
              materialId: newMat.id,
              storageKey: srcFile.storageKey,
              fileName: srcFile.fileName,
              mimeType: srcFile.mimeType,
              fileSize: srcFile.fileSize,
              checksum: srcFile.checksum,
              uploadedById: userId,
            },
          });
        }
      }
    }

    await recordClassroomAudit(tenantDb, {
      institutionId,
      userId,
      action: "COPY_CLASSROOM_CONTENT",
      entityType: "ClassCourse",
      entityId: targetClassCourseId,
      details: {
        sourceClassCourseId,
        copiedTopicsCount,
        copiedMaterialsCount,
      },
    });

    return {
      success: true,
      copiedTopicsCount,
      copiedMaterialsCount,
    };
  });
}

/**
 * HELPER: Verifikasi wewenang pengajar atau admin kelas
 */
async function assertTeacherOrAdmin(
  tenantDb: any,
  institutionId: string,
  classCourseId: string,
  userId: string,
  role: string
) {
  if (role === UserRole.INSTITUTION_ADMIN || role === UserRole.SUPER_ADMIN) {
    const adminMember = await tenantDb.membership.findFirst({
      where: {
        institutionId,
        userId,
        role: { in: [UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN] },
      },
    });
    if (adminMember) return;
  }

  if (role === UserRole.TEACHER) {
    const isInstructor = await tenantDb.classInstructor.findFirst({
      where: {
        classCourseId,
        instructorUserId: userId,
      },
    });
    if (isInstructor) return;
  }

  throw new Error("Akses ditolak: Anda tidak memiliki wewenang pengajar di kelas ini.");
}
