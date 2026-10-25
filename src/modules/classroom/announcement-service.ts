import { withTenantTransaction } from "@/lib/db/tenant-prisma";
import { sanitizeRichText } from "./sanitizer";

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  isPinned?: boolean;
}

export async function getAnnouncementsForClass({
  institutionId,
  classCourseId,
}: {
  institutionId: string;
  classCourseId: string;
}) {
  return withTenantTransaction(institutionId, async (tx) => {
    return tx.classAnnouncement.findMany({
      where: { classCourseId },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });
  });
}

export async function createAnnouncement({
  institutionId,
  classCourseId,
  authorUserId,
  role,
  input,
}: {
  institutionId: string;
  classCourseId: string;
  authorUserId: string;
  role: string;
  input: CreateAnnouncementInput;
}) {
  const isInstructorOrAdmin =
    ["INSTRUCTOR", "LECTURER", "TEACHER", "ADMIN", "SUPERADMIN", "PLATFORM_ADMIN"].includes(role.toUpperCase());

  if (!isInstructorOrAdmin) {
    throw new Error("Akses ditolak: Hanya pengajar atau admin yang dapat membuat pengumuman.");
  }

  const cleanTitle = (input.title || "").trim();
  if (!cleanTitle) {
    throw new Error("Judul pengumuman wajib diisi.");
  }

  const cleanContent = sanitizeRichText(input.content || "");
  if (!cleanContent) {
    throw new Error("Isi pengumuman wajib diisi.");
  }

  return withTenantTransaction(institutionId, async (tx) => {
    return tx.classAnnouncement.create({
      data: {
        institutionId,
        classCourseId,
        authorUserId,
        title: cleanTitle,
        content: cleanContent,
        isPinned: Boolean(input.isPinned),
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
    });
  });
}

export async function deleteAnnouncement({
  institutionId,
  announcementId,
  userId,
  role,
}: {
  institutionId: string;
  announcementId: string;
  userId: string;
  role: string;
}) {
  const isAdmin = ["ADMIN", "SUPERADMIN", "PLATFORM_ADMIN"].includes(role.toUpperCase());

  return withTenantTransaction(institutionId, async (tx) => {
    const announcement = await tx.classAnnouncement.findUnique({
      where: { id: announcementId },
    });

    if (!announcement) {
      throw new Error("Pengumuman tidak ditemukan.");
    }

    if (!isAdmin && announcement.authorUserId !== userId) {
      throw new Error("Akses ditolak: Hanya pembuat pengumuman atau admin yang dapat menghapus.");
    }

    return tx.classAnnouncement.delete({
      where: { id: announcementId },
    });
  });
}
