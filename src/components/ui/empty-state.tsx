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
    <div className="py-12 px-4 text-center border border-dashed border-[#E3E6EB] rounded-[6px] bg-white">
      <div className="w-10 h-10 rounded-full bg-[#F6F7F9] flex items-center justify-center mx-auto mb-3 text-[#6B7280]">
        {icon || <FolderOpen className="w-5 h-5" strokeWidth={1.5} />}
      </div>
      <h3 className="text-sm font-semibold text-[#111827]">{title}</h3>
      <p className="text-xs text-[#4B5563] mt-1 max-w-sm mx-auto leading-relaxed">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
