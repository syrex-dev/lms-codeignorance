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
}

/**
 * Registry Navigasi Terpusat Aplikasi LMS Multi-Tenant
 * Hanya item dengan status 'ready' yang akan dirender pada sidebar aplikasi
 * sampai modul terkait selesai diimplementasikan dan lulus pengujian.
 */
export const NAVIGATION_REGISTRY: NavigationItem[] = [
  {
    key: "dashboard",
    labelKey: "Dashboard",
    href: (tenantSlug: string) => `/${tenantSlug}/dashboard`,
    status: "ready",
    iconName: "LayoutDashboard",
  },
  {
    key: "classes",
    labelKey: "classes",
    href: (tenantSlug: string) => `/${tenantSlug}/classes`,
    feature: "classroom",
    status: "ready",
    iconName: "BookOpen",
  },
  // Modul-modul masa depan yang sedang direncanakan (status: 'planned')
  {
    key: "schedule",
    labelKey: "Jadwal",
    href: (tenantSlug: string) => `/${tenantSlug}/schedule`,
    status: "planned",
    iconName: "Clock",
  },
  {
    key: "assignments",
    labelKey: "Tugas & Ujian",
    href: (tenantSlug: string) => `/${tenantSlug}/assignments`,
    status: "planned",
    iconName: "CheckSquare",
  },
  {
    key: "attendance",
    labelKey: "Presensi",
    href: (tenantSlug: string) => `/${tenantSlug}/attendance`,
    status: "planned",
    iconName: "Calendar",
  },
  {
    key: "gradebook",
    labelKey: "Nilai & Rapor",
    href: (tenantSlug: string) => `/${tenantSlug}/gradebook`,
    status: "planned",
    iconName: "Award",
  },
  {
    key: "announcements",
    labelKey: "Pengumuman",
    href: (tenantSlug: string) => `/${tenantSlug}/announcements`,
    status: "planned",
    iconName: "Megaphone",
  },
  {
    key: "admission",
    labelKey: "Penerimaan Siswa/Mhs",
    href: (tenantSlug: string) => `/${tenantSlug}/admission`,
    status: "planned",
    iconName: "UserPlus",
  },
  {
    key: "admin_users",
    labelKey: "Manajemen Pengguna",
    href: (tenantSlug: string) => `/${tenantSlug}/admin/users`,
    roles: [UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN],
    status: "planned",
    iconName: "Users",
  },
  {
    key: "admin_departments",
    labelKey: "Data Akademik",
    href: (tenantSlug: string) => `/${tenantSlug}/admin/departments`,
    roles: [UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN],
    status: "planned",
    iconName: "Building2",
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
