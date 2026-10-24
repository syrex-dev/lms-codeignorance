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
      "inline-flex items-center justify-center font-medium rounded-[6px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none";

    const variantStyles = {
      primary: "bg-[#1F4E8C] hover:bg-[#183E6F] text-white border border-[#1F4E8C]",
      secondary: "bg-white hover:bg-[#F6F7F9] text-[#111827] border border-[#E3E6EB]",
      outline: "bg-white hover:bg-[#F6F7F9] text-[#111827] border border-[#E3E6EB]",
      danger: "bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]",
      ghost: "bg-transparent hover:bg-[#F6F7F9] text-[#4B5563] hover:text-[#111827]",
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
