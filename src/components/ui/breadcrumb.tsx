import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItemProps {
  href?: string;
  isCurrent?: boolean;
  children: React.ReactNode;
}

export function Breadcrumb({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center text-xs text-[#4B5563] ${className}`}>
      <ol className="flex items-center space-x-1.5">{children}</ol>
    </nav>
  );
}

export function BreadcrumbItem({ href, isCurrent, children }: BreadcrumbItemProps) {
  return (
    <li className="flex items-center space-x-1.5">
      {href && !isCurrent ? (
        <Link href={href} className="hover:text-[#111827] transition-colors">
          {children}
        </Link>
      ) : (
        <span className={isCurrent ? "font-medium text-[#111827]" : ""}>{children}</span>
      )}
    </li>
  );
}

export function BreadcrumbSeparator() {
  return (
    <li aria-hidden="true" className="text-[#9CA3AF]">
      <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
    </li>
  );
}
