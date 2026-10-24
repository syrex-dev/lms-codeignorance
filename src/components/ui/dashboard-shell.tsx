"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getActiveNavigationItems, NavigationItem } from "@/config/navigation";
import { Header } from "@/components/ui/header";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  GraduationCap,
  Settings,
  User,
  PanelLeftClose,
  PanelLeft,
  X,
  School,
} from "lucide-react";

interface DashboardShellProps {
  tenantSlug: string;
  institutionName: string;
  institutionType?: string;
  user: {
    name?: string | null;
    fullName?: string | null;
    identifier?: string | null;
    activeRole?: string | null;
  };
  academicTermName?: string;
  children: React.ReactNode;
}

export function DashboardShell({
  tenantSlug,
  institutionName,
  institutionType = "UNIVERSITY",
  user,
  academicTermName,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Restore collapsed preference from localStorage
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("lms_sidebar_collapsed");
    if (saved === "true") {
      setCollapsed(true);
    }
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("lms_sidebar_collapsed", String(next));
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const items = getActiveNavigationItems(user.activeRole || undefined);
  const isSchool = institutionType === "SCHOOL";

  const iconMap: Record<string, React.ReactNode> = {
    LayoutDashboard: <LayoutDashboard className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
    BookOpen: <BookOpen className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
    Users: <Users className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
    GraduationCap: <GraduationCap className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
    Settings: <Settings className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
    User: <User className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
  };

  const getLabel = (item: NavigationItem) => {
    if (item.key === "classes") {
      if (user.activeRole === "TEACHER") {
        return isSchool ? "Kelas Ampu" : "Kelas Ampu";
      }
      return isSchool ? "Kelas Pelajaran" : "Kelas Perkuliahan";
    }
    return item.labelKey;
  };

  // Group items by section
  const sections: { title: string; items: NavigationItem[] }[] = [
    {
      title: "Akademik",
      items: items.filter((i) => i.section === "AKADEMIK" || !i.section),
    },
    {
      title: "Administrasi",
      items: items.filter((i) => i.section === "ADMIN"),
    },
    {
      title: "Pengaturan",
      items: items.filter((i) => i.section === "PENGATURAN"),
    },
  ].filter((s) => s.items.length > 0);

  // Bottom navigation items (max 4)
  const bottomItems = [
    items.find((i) => i.key === "dashboard"),
    items.find((i) => i.key === "classes"),
    items.find((i) => i.key === "admin_users" || i.key === "admin_academic"),
    items.find((i) => i.key === "profile"),
  ].filter(Boolean) as NavigationItem[];

  return (
    <Tooltip.Provider delayDuration={150}>
      <div className="min-h-screen flex bg-[#F8FAFC]">
        {/* Skip to Content Accessible Link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#1E40AF] focus:text-white focus:rounded-[6px] focus:shadow-md focus:text-xs focus:font-semibold"
        >
          Lewati ke konten utama
        </a>

        {/* Desktop Collapsible Sidebar */}
        <aside
          className={`hidden md:flex flex-col bg-white border-r border-[#E2E8F0] shrink-0 sticky top-0 h-screen transition-[width] duration-200 ease-out z-20 ${
            collapsed ? "w-16" : "w-60"
          }`}
        >
          {/* Header Brand */}
          <div className="h-14 px-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
            {!collapsed ? (
              <Link
                href={`/${tenantSlug}/dashboard`}
                className="flex items-center gap-2.5 min-w-0"
                title={institutionName}
              >
                <div className="w-8 h-8 rounded-[8px] bg-[#1E40AF] text-white flex items-center justify-center shrink-0 shadow-xs">
                  {isSchool ? (
                    <School className="w-4 h-4" strokeWidth={1.75} />
                  ) : (
                    <GraduationCap className="w-4 h-4" strokeWidth={1.75} />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-semibold text-[#0F172A] truncate leading-tight">
                    {institutionName}
                  </span>
                  <span className="block text-[11px] text-[#64748B] leading-tight">
                    {isSchool ? "Portal Sekolah" : "Portal Akademik"}
                  </span>
                </div>
              </Link>
            ) : (
              <div className="w-full flex justify-center">
                <div className="w-8 h-8 rounded-[8px] bg-[#1E40AF] text-white flex items-center justify-center shadow-xs">
                  {isSchool ? (
                    <School className="w-4 h-4" strokeWidth={1.75} />
                  ) : (
                    <GraduationCap className="w-4 h-4" strokeWidth={1.75} />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Navigation Links Grouped by Section */}
          <nav className="flex-1 py-4 px-2 space-y-4 overflow-y-auto" aria-label="Menu navigasi utama">
            {sections.map((sec, secIdx) => (
              <div key={sec.title}>
                {!collapsed && (
                  <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                    {sec.title}
                  </div>
                )}
                {collapsed && secIdx > 0 && (
                  <div className="my-2 border-t border-[#F1F5F9]" />
                )}
                <div className="space-y-1">
                  {sec.items.map((item) => {
                    const href = item.href(tenantSlug);
                    const isActive = pathname === href || (item.key !== "dashboard" && pathname.startsWith(href));
                    const label = getLabel(item);

                    const navButton = (
                      <Link
                        href={href}
                        className={`group flex items-center rounded-[6px] text-xs font-medium transition-colors relative ${
                          collapsed
                            ? "w-10 h-10 mx-auto justify-center"
                            : "px-3 py-2 gap-2.5"
                        } ${
                          isActive
                            ? "bg-[#EFF6FF] text-[#1E40AF]"
                            : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                        }`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-[#1E40AF] rounded-r" />
                        )}
                        <span className={isActive ? "text-[#1E40AF]" : "text-[#64748B] group-hover:text-[#0F172A]"}>
                          {iconMap[item.iconName] || <BookOpen className="w-4 h-4 shrink-0" strokeWidth={1.75} />}
                        </span>
                        {!collapsed && <span className="truncate">{label}</span>}
                      </Link>
                    );

                    if (collapsed) {
                      return (
                        <Tooltip.Root key={item.key}>
                          <Tooltip.Trigger asChild>{navButton}</Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content
                              side="right"
                              sideOffset={8}
                              className="bg-[#0F172A] text-white text-xs px-2.5 py-1 rounded-[6px] shadow-md z-50 animate-in fade-in-50"
                            >
                              {label}
                              <Tooltip.Arrow className="fill-[#0F172A]" />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      );
                    }

                    return <div key={item.key}>{navButton}</div>;
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Sidebar Collapse Toggle Footer */}
          <div className="p-2 border-t border-[#E2E8F0] flex justify-center">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Bentangkan menu navigasi" : undefined}
              className="w-full h-9 flex items-center justify-center gap-2 rounded-[6px] text-xs font-medium text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition"
            >
              {collapsed ? (
                <PanelLeft className="w-4 h-4" strokeWidth={1.75} />
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4" strokeWidth={1.75} />
                  <span className="text-[11px]">Ciutkan menu</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Mobile Slide-Over Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileOpen(false)}
            />
            {/* Drawer Panel */}
            <div className="relative w-72 max-w-[80vw] bg-white h-full shadow-xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
              <div className="h-14 px-4 border-b border-[#E2E8F0] flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-[6px] bg-[#1E40AF] text-white flex items-center justify-center shrink-0">
                    <GraduationCap className="w-4 h-4" strokeWidth={1.75} />
                  </div>
                  <span className="text-xs font-semibold text-[#0F172A] truncate">
                    {institutionName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Tutup menu"
                  className="p-1.5 text-[#64748B] hover:text-[#0F172A] rounded"
                >
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>

              <nav className="flex-1 py-4 px-3 space-y-4 overflow-y-auto" aria-label="Menu navigasi mobile">
                {sections.map((sec) => (
                  <div key={sec.title}>
                    <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                      {sec.title}
                    </div>
                    <div className="space-y-1">
                      {sec.items.map((item) => {
                        const href = item.href(tenantSlug);
                        const isActive = pathname === href || (item.key !== "dashboard" && pathname.startsWith(href));
                        const label = getLabel(item);

                        return (
                          <Link
                            key={item.key}
                            href={href}
                            onClick={() => setMobileOpen(false)}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-xs font-medium transition ${
                              isActive
                                ? "bg-[#EFF6FF] text-[#1E40AF] border-l-2 border-[#1E40AF]"
                                : "text-[#475569] hover:bg-[#F8FAFC]"
                            }`}
                          >
                            <span className={isActive ? "text-[#1E40AF]" : "text-[#64748B]"}>
                              {iconMap[item.iconName] || <BookOpen className="w-4 h-4 shrink-0" strokeWidth={1.75} />}
                            </span>
                            <span className="truncate">{label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* Main Application Area */}
        <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
          {/* Header 56px Sticky */}
          <Header
            tenantSlug={tenantSlug}
            user={user}
            institutionType={institutionType}
            academicTermName={academicTermName}
            onToggleSidebar={() => setMobileOpen(true)}
          />

          <main id="main-content" className="flex-1 p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto outline-none min-w-0 max-w-full">
            {children}
          </main>
        </div>

        {/* Mobile Ergonomic Bottom Navigation Bar (< 768px) */}
        <nav
          aria-label="Navigasi bawah mobile"
          className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-[#E2E8F0] px-2 flex items-center justify-around z-30 shadow-[0_-1px_3px_rgba(15,23,42,0.04)]"
        >
          {bottomItems.map((item) => {
            const href = item.href(tenantSlug);
            const isActive = pathname === href || (item.key !== "dashboard" && pathname.startsWith(href));
            const label = getLabel(item);

            return (
              <Link
                key={item.key}
                href={href}
                className={`flex flex-col items-center justify-center flex-1 py-1 gap-0.5 text-[10px] font-medium transition ${
                  isActive ? "text-[#1E40AF]" : "text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                <span>{iconMap[item.iconName]}</span>
                <span className="truncate max-w-[64px]">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </Tooltip.Provider>
  );
}
