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
          <label htmlFor={selectId} className="block text-xs font-medium text-[#111827] mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={`w-full h-9 pl-3 pr-8 text-sm bg-white text-[#111827] border rounded-[6px] appearance-none transition-colors focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1 disabled:opacity-50 disabled:bg-[#F6F7F9] ${
              error ? "border-[#B91C1C] focus:ring-[#B91C1C]" : "border-[#E3E6EB] hover:border-[#CBD5E1]"
            } ${className}`}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            className="w-4 h-4 text-[#6B7280] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            strokeWidth={1.5}
          />
        </div>
        {error && <p className="text-xs text-[#B91C1C] mt-1">{error}</p>}
        {!error && helperText && <p className="text-xs text-[#4B5563] mt-1">{helperText}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
