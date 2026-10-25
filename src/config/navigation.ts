import { UserRole } from "@prisma/client";
import { type FeatureKey } from "@/modules/saas/entitlement";

export interface NavigationItem {
  key: string;
  labelKey: string;
  href: (tenantSlug: string) => string;
  roles?: UserRole[]; // Jika undefined, berlaku untuk semua peran
  feature?: FeatureKey;
  status: "ready" | "planned";
  iconName: string;
  section?: "AKADEMIK" | "ADMIN" | "PENGATURAN";
}

/**
 * Registry Navigasi Terpusat Aplikasi LMS Multi-Tenant
 * Hanya item dengan status 'ready' yang akan dirender pada navigasi aplikasi.
 */
export const NAVIGATION_REGISTRY: NavigationItem[] = [
  // 1. Seksi Utama / Akademik
  {
    key: "dashboard",
    labelKey: "Dashboard",
    href: (tenantSlug: string) => `/${tenantSlug}/dashboard`,
    status: "ready",
    iconName: "LayoutDashboard",
    section: "AKADEMIK",
  },
  {
    key: "classes",
    labelKey: "classes",
    href: (tenantSlug: string) => `/${tenantSlug}/classes`,
    feature: "classroom",
    status: "ready",
    iconName: "BookOpen",
    section: "AKADEMIK",
  },

  // 2. Seksi Administrasi Institusi (Khusus Admin)
  {
    key: "admin_users",
    labelKey: "Manajemen Pengguna",
    href: (tenantSlug: string) => `/${tenantSlug}/admin/users`,
    roles: [UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN],
    status: "ready",
    iconName: "Users",
    section: "ADMIN",
  },
  {
    key: "admin_academic",
    labelKey: "Manajemen Akademik",
    href: (tenantSlug: string) => `/${tenantSlug}/admin/academic`,
    roles: [UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN],
    status: "ready",
    iconName: "GraduationCap",
    section: "ADMIN",
  },
  {
    key: "admin_settings",
    labelKey: "Pengaturan Institusi",
    href: (tenantSlug: string) => `/${tenantSlug}/admin/settings`,
    roles: [UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN],
    status: "ready",
    iconName: "Settings",
    section: "ADMIN",
  },

  // 3. Seksi Pengaturan Akun (Semua Peran)
  {
    key: "profile",
    labelKey: "Profil & Akun",
    href: (tenantSlug: string) => `/${tenantSlug}/profile`,
    status: "ready",
    iconName: "User",
    section: "PENGATURAN",
  },

  // Modul Rencana Mendatang (status: 'planned')
  {
    key: "schedule",
    labelKey: "Jadwal",
    href: (tenantSlug: string) => `/${tenantSlug}/schedule`,
    status: "ready",
    iconName: "Clock",
    section: "AKADEMIK",
  },
  {
    key: "grades",
    labelKey: "Buku Nilai",
    href: (tenantSlug: string) => `/${tenantSlug}/grades`,
    feature: "classroom",
    status: "ready",
    iconName: "Award",
    section: "AKADEMIK",
  },
  {
    key: "assignments",
    labelKey: "Tugas & Penilaian",
    href: (tenantSlug: string) => `/${tenantSlug}/assignments`,
    feature: "classroom",
    status: "ready",
    iconName: "CheckSquare",
    section: "AKADEMIK",
  },
];

/**
 * Filter navigasi yang siap dan diizinkan untuk peran dan hak akses pengguna
 */
export function getActiveNavigationItems(
  role?: UserRole | string,
  userFeatures: FeatureKey[] = ["classroom"]
): NavigationItem[] {
  return NAVIGATION_REGISTRY.filter((item) => {
    // 1. Hanya tampilkan item yang berstatus 'ready'
    if (item.status !== "ready") {
      return false;
    }

    // 2. Filter berdasarkan peran jika dibatasi
    if (item.roles && item.roles.length > 0) {
      if (!role || !item.roles.includes(role as UserRole)) {
        return false;
      }
    }

    // 3. Filter berdasarkan hak fitur SaaS jika dibatasi
    if (item.feature) {
      if (!userFeatures.includes(item.feature)) {
        return false;
      }
    }

    return true;
  });
}
