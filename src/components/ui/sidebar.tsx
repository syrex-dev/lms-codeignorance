"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getActiveNavigationItems } from "@/config/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Menu,
  X,
  GraduationCap,
  School,
  Users,
  Settings,
  User,
  Clock,
  CheckSquare,
  Award,
} from "lucide-react";

interface SidebarProps {
  tenantSlug: string;
  institutionName: string;
  institutionType?: string;
  role?: string;
}

export function Sidebar({
  tenantSlug,
  institutionName,
  institutionType = "UNIVERSITY",
  role,
}: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = getActiveNavigationItems(role);
  const isSchool = institutionType === "SCHOOL";

  const iconMap: Record<string, React.ReactNode> = {
    LayoutDashboard: <LayoutDashboard className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
    BookOpen: <BookOpen className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
    Users: <Users className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
    GraduationCap: <GraduationCap className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
    Settings: <Settings className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
    User: <User className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
    Clock: <Clock className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
    CheckSquare: <CheckSquare className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
    Award: <Award className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
  };

  const navContent = (
    <div className="flex flex-col h-full bg-white border-r border-[#E3E6EB]">
      {/* Brand Header */}
      <div className="h-14 px-4 border-b border-[#E3E6EB] flex items-center justify-between">
        <Link
          href={`/${tenantSlug}/dashboard`}
          className="flex items-center gap-2.5 min-w-0"
          title={institutionName}
        >
          <div className="w-7 h-7 rounded-[4px] bg-[#1F4E8C] text-white flex items-center justify-center shrink-0">
            {isSchool ? (
              <School className="w-4 h-4" strokeWidth={1.75} />
            ) : (
              <GraduationCap className="w-4 h-4" strokeWidth={1.75} />
            )}
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-semibold text-[#111827] truncate leading-tight">
              {institutionName}
            </span>
            <span className="block text-[11px] text-[#6B7280] leading-tight">
              {isSchool ? "Portal Sekolah" : "Portal Akademik"}
            </span>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-1 text-[#6B7280] hover:text-[#111827]"
          aria-label="Tutup menu"
        >
          <X className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </div>

      {/* Menu Groups */}
      <div className="flex-1 py-3 overflow-y-auto space-y-4">
        <div>
          <div className="px-4 pb-1 text-[11px] font-medium text-[#6B7280]">
            Menu utama
          </div>
          <nav className="space-y-0.5">
            {items.map((item) => {
              const href = item.href(tenantSlug);
              const isActive =
                item.key === "dashboard"
                  ? pathname === href
                  : pathname.startsWith(href);

              const label =
                item.key === "classes"
                  ? isSchool
                    ? "Kelas"
                    : "Kelas perkuliahan"
                  : item.labelKey;

              return (
                <Link
                  key={item.key}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2 text-xs transition-colors ${
                    isActive
                      ? "border-l-[3px] border-[#1F4E8C] bg-[#EBF2FA] text-[#1F4E8C] font-semibold"
                      : "border-l-[3px] border-transparent text-[#4B5563] hover:bg-[#F6F7F9] hover:text-[#111827]"
                  }`}
                  title={label}
                >
                  {iconMap[item.iconName] || <BookOpen className="w-4 h-4" strokeWidth={1.75} />}
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 p-1.5 bg-white border border-[#E3E6EB] rounded-[4px] text-[#4B5563] shadow-sm"
        aria-label="Buka menu navigasi"
      >
        <Menu className="w-5 h-5" strokeWidth={1.75} />
      </button>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[240px] transform transition-transform duration-200 ease-in-out md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {navContent}
      </aside>

      {/* Desktop Persistent 240px Sidebar */}
      <aside className="hidden md:block w-[240px] shrink-0 sticky top-0 h-screen">
        {navContent}
      </aside>
    </>
  );
}
