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
  Calendar,
  Clock,
  CheckSquare,
} from "lucide-react";

interface DashboardShellProps {
  tenantSlug: string;
  institutionName: string;
  institutionType?: string;
  themeColor?: string | null;
  logoUrl?: string | null;
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
  themeColor,
  logoUrl,
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
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
  }, []);

  const toggleCollapsed = () => {
    const nextState = !collapsed;
    setCollapsed(nextState);
    localStorage.setItem("lms_sidebar_collapsed", String(nextState));
  };

  const navItems = getActiveNavigationItems(user.activeRole || "STUDENT");

  const iconMap: Record<string, React.ReactNode> = {
    LayoutDashboard: <LayoutDashboard className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
    BookOpen: <BookOpen className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
    Users: <Users className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
    GraduationCap: <GraduationCap className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
    Settings: <Settings className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
    User: <User className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
    Clock: <Clock className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
    CheckSquare: <CheckSquare className="w-4 h-4 shrink-0" strokeWidth={1.75} />,
  };

  const getLabel = (item: NavigationItem) => {
    if (item.key === "classes") {
      return institutionType === "UNIVERSITY" ? "Kelas Perkuliahan" : "Mata Pelajaran";
    }
    return item.labelKey;
  };

  const sections = [
    {
      title: "Akademik",
      items: navItems.filter((i) => i.section === "AKADEMIK" || !i.section),
    },
    {
      title: "Administrasi Institusi",
      items: navItems.filter((i) => i.section === "ADMIN"),
    },
    {
      title: "Pengaturan",
      items: navItems.filter((i) => i.section === "PENGATURAN"),
    },
  ].filter((sec) => sec.items.length > 0);

  const bottomItems = navItems.slice(0, 4);

  const accentColor = themeColor || "#1E40AF";
  const monogram = institutionName ? institutionName.substring(0, 2).toUpperCase() : "LM";

  const rootStyles = {
    "--tenant-accent": accentColor,
    "--tenant-accent-hover": accentColor,
    "--tenant-accent-subtle": `${accentColor}18`,
  } as React.CSSProperties;

  return (
    <Tooltip.Provider delayDuration={150}>
      <div style={rootStyles} className="min-h-screen flex bg-[var(--bg-canvas)]">
        {/* Skip to Main Content Link for A11y */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--tenant-accent,#1E40AF)] focus:text-white focus:rounded-[6px] focus:shadow-md focus:text-xs focus:font-semibold"
        >
          Lewati ke konten utama
        </a>

        {/* Desktop Collapsible Sidebar (240px <-> 64px) */}
        <aside
          aria-label="Navigasi sidebar utama"
          className={`hidden md:flex flex-col bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] shrink-0 sticky top-0 h-screen transition-[width] duration-200 ease-out z-20 ${
            collapsed ? "w-16" : "w-60"
          }`}
        >
          {/* Sidebar Header 56px */}
          <div className="h-14 px-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between">
            {!collapsed ? (
              <div className="flex items-center gap-2.5 min-w-0">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={institutionName}
                    className="w-8 h-8 rounded-[8px] object-cover shrink-0 shadow-xs border border-[var(--border-subtle)]"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-[8px] text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-xs tracking-wider"
                    style={{ backgroundColor: "var(--tenant-accent, #1E40AF)" }}
                  >
                    {monogram}
                  </div>
                )}
                <div className="min-w-0 leading-tight">
                  <span className="block text-xs font-semibold text-[var(--text-main)] truncate leading-tight">
                    {institutionName}
                  </span>
                  <span className="block text-[11px] text-[var(--text-subtle)] leading-tight">
                    {institutionType === "UNIVERSITY" ? "Portal Perkuliahan" : "Portal Sekolah"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-full flex justify-center">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={institutionName}
                    className="w-8 h-8 rounded-[8px] object-cover shadow-xs border border-[var(--border-subtle)]"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-[8px] text-white flex items-center justify-center shadow-xs font-bold text-xs"
                    style={{ backgroundColor: "var(--tenant-accent, #1E40AF)" }}
                  >
                    {monogram}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation Menu List */}
          <nav className="flex-1 py-3 px-2 space-y-4 overflow-y-auto" aria-label="Menu navigasi">
            {sections.map((sec, secIdx) => (
              <div key={sec.title}>
                {!collapsed ? (
                  <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-disabled)]">
                    {sec.title}
                  </div>
                ) : (
                  secIdx > 0 && (
                    <div className="my-2 border-t border-[var(--border-subtle)]" />
                  )
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
                            ? "bg-[var(--tenant-accent-subtle,#EFF6FF)] text-[var(--tenant-accent,#1E40AF)]"
                            : "text-[var(--text-muted)] hover:bg-[var(--bg-canvas)] hover:text-[var(--text-main)]"
                        }`}
                      >
                        {isActive && (
                          <span
                            className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r"
                            style={{ backgroundColor: "var(--tenant-accent, #1E40AF)" }}
                          />
                        )}
                        <span className={isActive ? "text-[var(--tenant-accent,#1E40AF)]" : "text-[var(--text-subtle)] group-hover:text-[var(--text-main)]"}>
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
          <div className="p-2 border-t border-[var(--border-subtle)] flex justify-center">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Bentangkan menu navigasi" : undefined}
              className="w-full h-9 flex items-center justify-center gap-2 rounded-[6px] text-xs font-medium text-[var(--text-subtle)] hover:text-[var(--text-main)] hover:bg-[var(--bg-canvas)] transition"
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
            <div className="relative w-72 max-w-[80vw] bg-[var(--bg-surface)] h-full shadow-xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
              <div className="h-14 px-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  {logoUrl ? (
                    <img src={logoUrl} alt={institutionName} className="w-7 h-7 rounded-[6px] object-cover shrink-0" />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-[6px] text-white flex items-center justify-center shrink-0 font-bold text-xs"
                      style={{ backgroundColor: "var(--tenant-accent, #1E40AF)" }}
                    >
                      {monogram}
                    </div>
                  )}
                  <span className="text-xs font-semibold text-[var(--text-main)] truncate">
                    {institutionName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Tutup menu"
                  className="p-1.5 text-[var(--text-subtle)] hover:text-[var(--text-main)] rounded"
                >
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>

              <nav className="flex-1 py-4 px-3 space-y-4 overflow-y-auto" aria-label="Menu navigasi mobile">
                {sections.map((sec) => (
                  <div key={sec.title}>
                    <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-disabled)]">
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
                                ? "bg-[var(--tenant-accent-subtle,#EFF6FF)] text-[var(--tenant-accent,#1E40AF)] border-l-2"
                                : "text-[var(--text-muted)] hover:bg-[var(--bg-canvas)]"
                            }`}
                            style={isActive ? { borderLeftColor: "var(--tenant-accent, #1E40AF)" } : undefined}
                          >
                            <span className={isActive ? "text-[var(--tenant-accent,#1E40AF)]" : "text-[var(--text-subtle)]"}>
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
          className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] px-2 flex items-center justify-around z-30 shadow-[0_-1px_3px_rgba(15,23,42,0.04)]"
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
                  isActive ? "text-[var(--tenant-accent,#1E40AF)] font-semibold" : "text-[var(--text-subtle)] hover:text-[var(--text-main)]"
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
