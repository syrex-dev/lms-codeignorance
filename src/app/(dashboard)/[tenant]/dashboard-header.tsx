"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import { TerminologyMapping } from "@/lib/i18n/terminology";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  LogOut,
  Sparkles,
  UserCheck,
  Shield,
} from "lucide-react";

interface DashboardHeaderProps {
  tenantSlug: string;
  institution: any;
  activeTerm: any;
  user: any;
  terminology: TerminologyMapping;
}

export function DashboardHeader({
  tenantSlug,
  institution,
  activeTerm,
  user,
  terminology,
}: DashboardHeaderProps) {
  const isUniversity = institution.type === "UNIVERSITY";
  const { update } = useSession();
  const [isSwitching, setIsSwitching] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  const memberships = user.memberships || [];
  const currentRole = user.activeRole;

  const handleSwitchRole = async (targetRole: string, targetSlug: string) => {
    setIsSwitching(true);
    await update({
      activeRole: targetRole,
      tenantSlug: targetSlug,
    });
    setShowRoleDropdown(false);
    window.location.href = `/${targetSlug}/dashboard`;
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Term indicator */}
      <div className="flex items-center space-x-3">
        <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 font-medium">
          <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
          <span>
            {activeTerm ? activeTerm.name : "Tahun Akademik Aktif"}
          </span>
        </div>

        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
            isUniversity
              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          }`}
        >
          {isUniversity ? "Kampus" : "Sekolah"}
        </span>

        {/* Role Badge & Role Switcher */}
        {memberships.length > 1 ? (
          <div className="relative">
            <button
              type="button"
              id="role-switcher-btn"
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 transition-colors"
            >
              <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span>Peran: {currentRole}</span>
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>

            {showRoleDropdown && (
              <div className="absolute left-0 mt-1.5 w-56 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Ganti Konteks Peran Aktif
                </div>
                {memberships.map((m: any, idx: number) => (
                  <button
                    key={`${m.institutionId}-${m.role}-${idx}`}
                    onClick={() => handleSwitchRole(m.role, m.institutionSlug)}
                    disabled={isSwitching || m.role === currentRole}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors ${
                      m.role === currentRole
                        ? "text-blue-600 font-bold bg-blue-50/50 dark:bg-blue-950/30"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{m.role}</div>
                      <div className="text-[10px] text-slate-400">{m.institutionName}</div>
                    </div>
                    {m.role === currentRole && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono">
                        Aktif
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <span className="hidden md:inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <Shield className="w-3 h-3 text-slate-400" />
            <span>{currentRole}</span>
          </span>
        )}
      </div>

      {/* Right: Tenant switch helper & User avatar */}
      <div className="flex items-center space-x-4">
        {/* Quick Demo Switcher */}
        <div className="hidden md:flex items-center space-x-2 text-xs bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-slate-500">Demo Switch:</span>
          <Link
            href="/poltekmi/dashboard"
            className={`font-semibold hover:underline ${
              tenantSlug === "poltekmi" ? "text-blue-600 font-bold" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Poltekmi
          </Link>
          <span className="text-slate-300">|</span>
          <Link
            href="/sman1/dashboard"
            className={`font-semibold hover:underline ${
              tenantSlug === "sman1" ? "text-emerald-600 font-bold" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            SMAN 1
          </Link>
        </div>

        {/* Notifications */}
        <button
          type="button"
          className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 relative transition-colors"
          title="Notifikasi"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full" />
        </button>

        {/* User Badge */}
        <div className="flex items-center space-x-3 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
            {user.fullName?.charAt(0) || "U"}
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
              {user.fullName}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {user.identifier}
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: `/${tenantSlug}/login` })}
            className="text-slate-400 hover:text-red-500 transition-colors p-1"
            title="Keluar"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
