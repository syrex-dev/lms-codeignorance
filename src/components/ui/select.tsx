import React from "react";
import { ChevronDown } from "lucide-react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", label, helperText, error, id, children, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-medium text-[var(--text-main)] mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={`w-full h-9 pl-3 pr-8 text-sm bg-[var(--bg-surface)] text-[var(--text-main)] border rounded-[6px] appearance-none transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--tenant-accent,#1E40AF)] focus:ring-offset-1 disabled:opacity-50 disabled:bg-[var(--bg-canvas)] ${
              error ? "border-[var(--status-danger)] focus:ring-[var(--status-danger)]" : "border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
            } ${className}`}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            className="w-4 h-4 text-[var(--text-subtle)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            strokeWidth={1.5}
          />
        </div>
        {error && <p className="text-xs text-[var(--status-danger)] mt-1">{error}</p>}
        {!error && helperText && <p className="text-xs text-[var(--text-muted)] mt-1">{helperText}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
