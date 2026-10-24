import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "accent" | "success" | "warning" | "danger";
}

export function Badge({ className = "", variant = "neutral", children, ...props }: BadgeProps) {
  const variantStyles = {
    neutral: "bg-[var(--bg-subtle)] text-[var(--text-muted)] border-[var(--border-subtle)]",
    accent: "bg-[var(--tenant-accent-subtle,#EFF6FF)] text-[var(--tenant-accent,#1E40AF)] border-[var(--accent-200)]",
    success: "bg-[var(--status-success-bg)] text-[var(--status-success)] border-[var(--status-success-border)]",
    warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-[var(--status-warning-border)]",
    danger: "bg-[var(--status-danger-bg)] text-[var(--status-danger)] border-[var(--status-danger-border)]",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-xs font-medium border ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
