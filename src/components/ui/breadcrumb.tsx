import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItemProps {
  href?: string;
  isCurrent?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Breadcrumb({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center text-xs text-[#4B5563] min-w-0 max-w-full overflow-hidden ${className}`}>
      <ol className="flex items-center space-x-1.5 min-w-0 max-w-full overflow-hidden">{children}</ol>
    </nav>
  );
}

export function BreadcrumbItem({ href, isCurrent, className = "", children }: BreadcrumbItemProps) {
  return (
    <li className={`flex items-center space-x-1.5 min-w-0 max-w-[100px] sm:max-w-none overflow-hidden ${className}`}>
      {href && !isCurrent ? (
        <Link href={href} className="hover:text-[#111827] transition-colors truncate block max-w-full">
          {children}
        </Link>
      ) : (
        <span className={`truncate block max-w-full ${isCurrent ? "font-medium text-[#111827]" : ""}`}>{children}</span>
      )}
    </li>
  );
}

export function BreadcrumbSeparator({ className = "" }: { className?: string }) {
  return (
    <li aria-hidden="true" className={`text-[#9CA3AF] shrink-0 ${className}`}>
      <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
    </li>
  );
}
