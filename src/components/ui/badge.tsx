import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "accent" | "success" | "warning" | "danger";
}

export function Badge({ className = "", variant = "neutral", children, ...props }: BadgeProps) {
  const variantStyles = {
    neutral: "bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]",
    accent: "bg-[#EBF2FA] text-[#1F4E8C] border-[#BFDBFE]",
    success: "bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]",
    warning: "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]",
    danger: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
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
