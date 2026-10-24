import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, helperText, error, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-[var(--text-main)] mb-1">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`w-full h-9 px-3 text-sm bg-[var(--bg-surface)] text-[var(--text-main)] placeholder:text-[var(--text-disabled)] border rounded-[6px] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--tenant-accent,#1E40AF)] focus:ring-offset-1 disabled:opacity-50 disabled:bg-[var(--bg-canvas)] ${
            error ? "border-[var(--status-danger)] focus:ring-[var(--status-danger)]" : "border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-[var(--status-danger)] mt-1">{error}</p>}
        {!error && helperText && <p className="text-xs text-[var(--text-muted)] mt-1">{helperText}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
