"use client";

import React, { useState } from "react";
import { signOut } from "next-auth/react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbSeparator } from "./breadcrumb";
import { Badge } from "./badge";
import { getRoleBadgeLabel } from "@/lib/i18n/terminology";
import { Calendar, ChevronDown, LogOut, User as UserIcon } from "lucide-react";

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
}

export function Header({
  tenantSlug,
  user,
  institutionType = "UNIVERSITY",
  academicTermName = "Semester Ganjil 2024/2025",
  currentPageTitle,
}: HeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const displayName = user.fullName || user.name || "Pengguna";
  const roleLabel = getRoleBadgeLabel(user.activeRole || "STUDENT", institutionType === "SCHOOL");

  return (
    <header className="h-14 bg-white border-b border-[#E3E6EB] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-2 pl-8 md:pl-0">
        <Breadcrumb>
          <BreadcrumbItem href={`/${tenantSlug}/dashboard`}>Beranda</BreadcrumbItem>
          {currentPageTitle && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem isCurrent>{currentPageTitle}</BreadcrumbItem>
            </>
          )}
        </Breadcrumb>
      </div>

      {/* Right: Academic Term Selector + User Profile Menu */}
      <div className="flex items-center gap-3">
        {/* Academic Term Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#F6F7F9] border border-[#E3E6EB] rounded-[4px] text-xs text-[#4B5563]">
          <Calendar className="w-3.5 h-3.5 text-[#6B7280]" strokeWidth={1.5} />
          <span>{academicTermName}</span>
        </div>

        {/* User Identity Menu (Single source of identity block) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 p-1 pl-2 hover:bg-[#F6F7F9] rounded-[6px] border border-transparent hover:border-[#E3E6EB] transition text-left focus:outline-none focus:ring-2 focus:ring-[#1F4E8C]"
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
          >
            <div className="w-7 h-7 rounded-full bg-[#1F4E8C] text-white flex items-center justify-center text-xs font-semibold shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block leading-tight text-right">
              <div className="text-xs font-semibold text-[#111827] truncate max-w-[150px]">
                {displayName}
              </div>
              <div className="text-[11px] text-[#4B5563]">
                {roleLabel}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#6B7280] hidden sm:block" strokeWidth={1.5} />
          </button>

          {/* User Menu Dropdown */}
          {userMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setUserMenuOpen(false)}
              />
              <div className="absolute right-0 mt-1 w-56 bg-white border border-[#E3E6EB] rounded-[6px] shadow-sm py-1.5 z-30 text-xs">
                <div className="px-3 py-2 border-b border-[#E3E6EB] bg-[#F6F7F9]/50">
                  <div className="font-semibold text-[#111827] truncate">{displayName}</div>
                  <div className="text-[#4B5563] text-[11px] flex items-center gap-1.5 mt-0.5">
                    {user.identifier && <span className="font-mono">{user.identifier}</span>}
                    <Badge variant="accent">{roleLabel}</Badge>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: `/${tenantSlug}/login` })}
                  className="w-full text-left px-3 py-2 text-[#B91C1C] hover:bg-[#FEF2F2] flex items-center gap-2 transition"
                >
                  <LogOut className="w-3.5 h-3.5 text-[#B91C1C]" strokeWidth={1.5} />
                  <span>Keluar dari akun</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
