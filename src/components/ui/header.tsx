"use client";

import React from "react";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Breadcrumb, BreadcrumbItem, BreadcrumbSeparator } from "./breadcrumb";
import { useBreadcrumb } from "./breadcrumb-context";
import { Badge } from "./badge";
import { getRoleBadgeLabel } from "@/lib/i18n/terminology";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Calendar,
  ChevronDown,
  LogOut,
  User as UserIcon,
  KeyRound,
  Menu,
} from "lucide-react";

interface HeaderProps {
  tenantSlug: string;
  user: {
    name?: string | null;
    fullName?: string | null;
    identifier?: string | null;
    activeRole?: string | null;
  };
  institutionType?: string;
  academicTermName?: string;
  currentPageTitle?: string;
  onToggleSidebar?: () => void;
}

export function Header({
  tenantSlug,
  user,
  institutionType = "UNIVERSITY",
  academicTermName = "Semester Ganjil 2024/2025",
  currentPageTitle,
  onToggleSidebar,
}: HeaderProps) {
  const pathname = usePathname();
  const { customTitle } = useBreadcrumb();
  const displayName = user.fullName || user.name || "Pengguna";
  const roleLabel = getRoleBadgeLabel(user.activeRole || "STUDENT", institutionType === "SCHOOL");

  // Dynamic breadcrumb items based on current URL pathname
  const segments = (pathname || "").split("/").filter(Boolean);
  // Example segments: [tenant, "classes", "c3a067e6-..."] or [tenant, "dashboard"]
  const section = segments[1] || "dashboard";
  const subSection = segments[2];

  const getBreadcrumbs = () => {
    const crumbs: Array<{ label: string; href?: string; isCurrent: boolean }> = [
      {
        label: "Dashboard",
        href: `/${tenantSlug}/dashboard`,
        isCurrent: section === "dashboard",
      },
    ];

    if (section === "classes") {
      if (subSection) {
        crumbs.push({
          label: "Kelas Perkuliahan",
          href: `/${tenantSlug}/classes`,
          isCurrent: false,
        });
        crumbs.push({
          label: customTitle || currentPageTitle || "Detail Kelas",
          isCurrent: true,
        });
      } else {
        crumbs.push({
          label: "Kelas Perkuliahan",
          isCurrent: true,
        });
      }
    } else if (section === "admin") {
      if (subSection === "academic") {
        crumbs.push({
          label: "Manajemen Akademik",
          isCurrent: true,
        });
      } else if (subSection === "users") {
        crumbs.push({
          label: "Manajemen Pengguna",
          isCurrent: true,
        });
      } else if (subSection === "settings") {
        crumbs.push({
          label: "Pengaturan Institusi",
          isCurrent: true,
        });
      } else {
        crumbs.push({
          label: "Administrasi",
          isCurrent: true,
        });
      }
    } else if (section === "profile") {
      crumbs.push({
        label: "Profil & Akun Saya",
        isCurrent: true,
      });
    } else if (section === "change-password") {
      crumbs.push({
        label: "Ganti Kata Sandi",
        isCurrent: true,
      });
    }

    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="h-14 bg-white border-b border-[#E2E8F0] px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-[0_1px_2px_rgba(15,23,42,0.02)] max-w-full overflow-hidden">
      {/* Left: Mobile Toggle + Breadcrumbs */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 overflow-hidden">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Buka menu navigasi"
            className="md:hidden p-1.5 -ml-1 text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-[6px] transition"
          >
            <Menu className="w-5 h-5" strokeWidth={1.75} />
          </button>
        )}

        <Breadcrumb className="min-w-0 max-w-full overflow-hidden">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.label + idx}>
                {idx > 0 && <BreadcrumbSeparator className="hidden sm:inline-flex" />}
                <BreadcrumbItem
                  href={crumb.href}
                  isCurrent={crumb.isCurrent}
                  className={!isLast ? "hidden sm:flex" : "flex"}
                >
                  <span className="truncate max-w-[140px] sm:max-w-[200px] md:max-w-none">{crumb.label}</span>
                </BreadcrumbItem>
              </React.Fragment>
            );
          })}
        </Breadcrumb>
      </div>

      {/* Right: Academic Term Selector + Radix DropdownMenu User Profile */}
      <div className="flex items-center gap-3">
        {/* Academic Term Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] text-xs text-[#475569] font-medium">
          <Calendar className="w-3.5 h-3.5 text-[#64748B]" strokeWidth={1.5} />
          <span>{academicTermName}</span>
        </div>

        {/* Radix Accessible DropdownMenu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 p-1.5 pl-2 hover:bg-[#F1F5F9] rounded-[8px] border border-transparent hover:border-[#E2E8F0] transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF]"
              
            >
              <div className="w-7 h-7 rounded-full bg-[#1E40AF] text-white flex items-center justify-center text-xs font-semibold shrink-0 shadow-xs">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block leading-tight text-right">
                <div className="text-xs font-semibold text-[#0F172A] truncate max-w-[150px]">
                  {displayName}
                </div>
                <div className="text-[11px] text-[#64748B]">
                  {roleLabel}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#64748B] hidden sm:block" strokeWidth={1.5} />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[220px] bg-white rounded-[8px] border border-[#E2E8F0] shadow-md p-1.5 z-50 text-xs animate-in fade-in-80 zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
              sideOffset={5}
              align="end"
            >
              <div className="px-3 py-2 border-b border-[#F1F5F9] mb-1">
                <div className="font-semibold text-[#0F172A] truncate">{displayName}</div>
                <div className="text-[#64748B] text-[11px] flex items-center gap-1.5 mt-0.5 font-mono">
                  {user.identifier && <span>{user.identifier}</span>}
                  <span className="text-[10px] px-1.5 py-0.2 bg-[#F1F5F9] text-[#475569] rounded font-sans font-medium border border-[#E2E8F0]">
                    {roleLabel}
                  </span>
                </div>
              </div>

              <DropdownMenu.Item asChild>
                <Link
                  href={`/${tenantSlug}/profile`}
                  className="flex items-center gap-2 px-3 py-2 text-[#334155] hover:text-[#0F172A] hover:bg-[#F8FAFC] rounded-[4px] cursor-pointer outline-none transition"
                >
                  <UserIcon className="w-3.5 h-3.5 text-[#64748B]" strokeWidth={1.5} />
                  <span>Profil & Akun Saya</span>
                </Link>
              </DropdownMenu.Item>

              <DropdownMenu.Item asChild>
                <Link
                  href={`/${tenantSlug}/change-password`}
                  className="flex items-center gap-2 px-3 py-2 text-[#334155] hover:text-[#0F172A] hover:bg-[#F8FAFC] rounded-[4px] cursor-pointer outline-none transition"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#64748B]" strokeWidth={1.5} />
                  <span>Ganti Kata Sandi</span>
                </Link>
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="h-px bg-[#F1F5F9] my-1" />

              <DropdownMenu.Item
                onSelect={() => signOut({ callbackUrl: `/${tenantSlug}/login` })}
                className="flex items-center gap-2 px-3 py-2 text-[#B91C1C] hover:bg-[#FEF2F2] rounded-[4px] cursor-pointer outline-none transition font-medium"
              >
                <LogOut className="w-3.5 h-3.5 text-[#B91C1C]" strokeWidth={1.5} />
                <span>Keluar dari akun</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
