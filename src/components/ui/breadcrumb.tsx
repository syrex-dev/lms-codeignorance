import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function Breadcrumb({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center text-xs text-[var(--text-muted)] min-w-0 max-w-full overflow-hidden ${className}`}>
      <ol className="flex items-center gap-1.5 min-w-0 max-w-full list-none p-0 m-0">
        {children}
      </ol>
    </nav>
  );
}

export function BreadcrumbItem({
  href,
  isCurrent = false,
  className = "",
  children,
}: {
  href?: string;
  isCurrent?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <li className={`items-center min-w-0 max-w-full ${className}`}>
      {href && !isCurrent ? (
        <Link href={href} className="hover:text-[var(--text-main)] transition-colors truncate block max-w-full">
          {children}
        </Link>
      ) : (
        <span className={`truncate block max-w-full ${isCurrent ? "font-medium text-[var(--text-main)]" : ""}`}>{children}</span>
      )}
    </li>
  );
}

export function BreadcrumbSeparator({ className = "" }: { className?: string }) {
  return (
    <li aria-hidden="true" className={`text-[var(--text-disabled)] shrink-0 select-none ${className}`}>
      <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
    </li>
  );
}
