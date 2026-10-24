import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", isLoading, disabled, children, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-[6px] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--tenant-accent,#1E40AF)] focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none";

    const variantStyles = {
      primary: "bg-[var(--tenant-accent,#1E40AF)] hover:opacity-90 text-white border border-[var(--tenant-accent,#1E40AF)] shadow-xs",
      secondary: "bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] text-[var(--text-main)] border border-[var(--border-subtle)] shadow-xs",
      outline: "bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] text-[var(--text-main)] border border-[var(--border-subtle)]",
      danger: "bg-[var(--status-danger-bg)] hover:bg-red-100 text-[var(--status-danger)] border border-[var(--status-danger-border)]",
      ghost: "bg-transparent hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]",
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-9 px-4 text-sm gap-2",
      lg: "h-10 px-5 text-sm gap-2",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" strokeWidth={1.75} />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
