import React from "react";
import { FolderOpen } from "lucide-react";

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: EmptyStateProps) {
  return (
    <div className="py-12 px-4 text-center border border-dashed border-[var(--border-subtle)] rounded-[6px] bg-[var(--bg-surface)]">
      <div className="w-10 h-10 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center mx-auto mb-3 text-[var(--text-subtle)]">
        {icon || <FolderOpen className="w-5 h-5" strokeWidth={1.5} />}
      </div>
      <h3 className="text-sm font-semibold text-[var(--text-main)]">{title}</h3>
      <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto leading-relaxed">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
