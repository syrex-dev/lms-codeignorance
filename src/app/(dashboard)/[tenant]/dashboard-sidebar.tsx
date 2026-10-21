"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { TerminologyMapping } from "@/lib/i18n/terminology";
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Clock,
  Award,
  CheckSquare,
  Users,
  Megaphone,
  UserPlus,
  LogOut,
  GraduationCap,
  School,
  Building2,
} from "lucide-react";

interface DashboardSidebarProps {
  tenantSlug: string;
  institution: any;
  terminology: TerminologyMapping;
  user: any;
}

export function DashboardSidebar({
  tenantSlug,
  institution,
  terminology,
  user,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const isUniversity = institution.type === "UNIVERSITY";
  const currentRole = user.activeRole;
  const isAdmin = currentRole === "SUPER_ADMIN" || currentRole === "INSTITUTION_ADMIN";

  const navItems = [
    {
      label: "Dashboard",
      href: `/${tenantSlug}/dashboard`,
      icon: LayoutDashboard,
    },
    {
      label: terminology.classRoom,
      href: `/${tenantSlug}/classes`,
      icon: BookOpen,
    },
    {
      label: `Jadwal ${isUniversity ? "Kuliah" : "Pelajaran"}`,
      href: `/${tenantSlug}/schedule`,
      icon: Clock,
    },
    {
      label: "Tugas & Ujian",
      href: `/${tenantSlug}/assignments`,
      icon: CheckSquare,
    },
    {
      label: "Presensi",
      href: `/${tenantSlug}/attendance`,
      icon: Calendar,
    },
    {
      label: terminology.gradeReport,
      href: `/${tenantSlug}/gradebook`,
      icon: Award,
    },
    {
      label: "Pengumuman",
      href: `/${tenantSlug}/announcements`,
      icon: Megaphone,
    },
    {
      label: terminology.admissionShort,
      href: `/${tenantSlug}/admission`,
      icon: UserPlus,
    },
  ];

  const adminNavItems = [
    {
      label: `Data ${terminology.departmentShort}`,
      href: `/${tenantSlug}/admin/departments`,
      icon: Building2,
    },
    {
      label: "Manajemen Pengguna",
      href: `/${tenantSlug}/admin/users`,
      icon: Users,
    },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between hidden md:flex h-screen sticky top-0">
      <div>
        {/* Brand / Logo */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center space-x-3">
          <div
            className={`p-2.5 rounded-xl text-white shadow-md ${
              isUniversity
                ? "bg-blue-600 shadow-blue-500/20"
                : "bg-emerald-600 shadow-emerald-500/20"
            }`}
          >
            {isUniversity ? (
              <GraduationCap className="w-5 h-5" />
            ) : (
              <School className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
              {terminology.institutionLabel}
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {institution.name}
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="p-3 space-y-1">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Menu Utama
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? isUniversity
                      ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold"
                      : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive
                      ? isUniversity
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-400"
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          {isAdmin && (
            <>
              <div className="pt-4 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Administrasi Master
              </div>
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4 text-slate-400" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* User Card & Logout */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800">
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {user.fullName}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {user.identifier} ({user.activeRole})
            </div>
          </div>
          <button
            type="button"
            id="sidebar-logout-btn"
            onClick={() => signOut({ callbackUrl: `/${tenantSlug}/login` })}
            title="Keluar dari akun"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
