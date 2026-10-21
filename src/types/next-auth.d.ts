import { UserRole, InstitutionType } from "@prisma/client";
import "next-auth";

export interface UserMembershipSession {
  institutionId: string;
  role: UserRole;
  status: string;
  institutionSlug: string;
  institutionName: string;
  institutionType: InstitutionType;
}

declare module "next-auth" {
  interface User {
    id: string;
    fullName: string;
    email?: string | null;
    activeRole: UserRole;
    activeInstitutionId: string | null;
    tenantSlug?: string;
    institutionType?: InstitutionType;
    institutionName?: string;
    identifier: string; // Active identifier (NIM/NIS/Staff ID/Email)
    status: UserStatus;
    sessionVersion: number;
    phoneE164?: string | null;
    phoneVerifiedAt?: Date | null;
    mustChangePassword?: boolean;
    memberships?: UserMembershipSession[];
  }

  interface Session {
    user: {
      id: string;
      fullName: string;
      email?: string | null;
      activeRole: UserRole;
      activeInstitutionId: string | null;
      tenantSlug?: string;
      institutionType?: InstitutionType;
      institutionName?: string;
      identifier: string;
      status: UserStatus;
      sessionVersion: number;
      phoneE164?: string | null;
      phoneVerifiedAt?: Date | null;
      mustChangePassword?: boolean;
      memberships?: UserMembershipSession[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    fullName: string;
    activeRole: UserRole;
    activeInstitutionId: string | null;
    tenantSlug?: string;
    institutionType?: InstitutionType;
    institutionName?: string;
    identifier: string;
    status: UserStatus;
    sessionVersion: number;
    phoneE164?: string | null;
    phoneVerifiedAt?: Date | null;
    mustChangePassword?: boolean;
    memberships?: UserMembershipSession[];
  }
}
