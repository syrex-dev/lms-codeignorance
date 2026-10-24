import { PublishStatus, MaterialType } from "@prisma/client";

export { PublishStatus, MaterialType };

export interface ClassroomClassDetail {
  id: string;
  institutionId: string;
  code: string;
  name: string;
  credits: number | null;
  description: string | null;
  roomName: string | null;
  isArchived: boolean;
  academicTerm: {
    id: string;
    name: string;
    code: string;
    startDate: Date;
    endDate: Date;
  };
  programDepartment?: {
    id: string;
    name: string;
    code: string;
  } | null;
  instructors: Array<{
    id: string;
    role: string;
    isPrimary: boolean;
    instructor: {
      id: string;
      fullName: string;
      avatarUrl: string | null;
    };
  }>;
  enrollmentCount: number;
  topics: ClassroomTopicItem[];
  userRole?: string;
  isEnrolled?: boolean;
  progressPercentage?: number;
}

export interface ClassroomTopicItem {
  id: string;
  institutionId: string;
  classCourseId: string;
  title: string;
  description: string | null;
  meetingNumber: number | null;
  status: PublishStatus;
  publishAt: Date | null;
  orderIndex: number;
  materials: ClassroomMaterialItem[];
}

export interface ClassroomMaterialItem {
  id: string;
  institutionId: string;
  topicId: string;
  type: MaterialType;
  title: string;
  content: string | null;
  url: string | null;
  videoUrl: string | null;
  status: PublishStatus;
  publishAt: Date | null;
  orderIndex: number;
  isRequired: boolean;
  files: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    downloadUrl?: string;
  }>;
  progress?: {
    isCompleted: boolean;
    completedAt: Date | null;
    lastViewedAt: Date | null;
  } | null;
}

export interface CreateTopicInput {
  title: string;
  description?: string;
  meetingNumber?: number;
  status?: PublishStatus;
  publishAt?: Date | string | null;
}

export interface UpdateTopicInput {
  title?: string;
  description?: string;
  meetingNumber?: number | null;
  status?: PublishStatus;
  publishAt?: Date | string | null;
  orderIndex?: number;
}

export interface CreateMaterialInput {
  type: MaterialType;
  title: string;
  content?: string;
  url?: string;
  videoUrl?: string;
  status?: PublishStatus;
  publishAt?: Date | string | null;
  isRequired?: boolean;
  files?: Array<{
    storageKey: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    checksum?: string;
  }>;
}

export interface UpdateMaterialInput {
  type?: MaterialType;
  title?: string;
  content?: string;
  url?: string;
  videoUrl?: string;
  status?: PublishStatus;
  publishAt?: Date | string | null;
  isRequired?: boolean;
  orderIndex?: number;
}

export interface ClassroomCopyInput {
  sourceClassCourseId: string;
  includeDrafts?: boolean;
}
