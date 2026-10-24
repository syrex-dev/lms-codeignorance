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
          <label htmlFor={inputId} className="block text-xs font-medium text-[#111827] mb-1">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`w-full h-9 px-3 text-sm bg-white text-[#111827] placeholder:text-[#9CA3AF] border rounded-[6px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#1F4E8C] focus:ring-offset-1 disabled:opacity-50 disabled:bg-[#F6F7F9] ${
            error ? "border-[#B91C1C] focus:ring-[#B91C1C]" : "border-[#E3E6EB] hover:border-[#CBD5E1]"
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-[#B91C1C] mt-1">{error}</p>}
        {!error && helperText && <p className="text-xs text-[#4B5563] mt-1">{helperText}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
