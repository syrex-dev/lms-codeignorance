import React from "react";

export function Table({ className = "", ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto border border-[var(--border-subtle)] rounded-[6px] bg-[var(--bg-surface)]">
      <table className={`w-full text-left border-collapse text-sm ${className}`} {...props} />
    </div>
  );
}

export function TableHeader({ className = "", ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] ${className}`} {...props} />
  );
}

export function TableBody({ className = "", ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-[var(--border-subtle)] text-[var(--text-main)] ${className}`} {...props} />
  );
}

export function TableRow({ className = "", ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`h-[44px] hover:bg-[var(--bg-canvas)] transition-colors ${className}`} {...props} />
  );
}

export function TableHead({ className = "", ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`h-[44px] px-3.5 text-xs font-semibold text-[var(--text-muted)] align-middle ${className}`} {...props} />
  );
}

export function TableCell({ className = "", ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`h-[44px] px-3.5 text-sm text-[var(--text-main)] align-middle ${className}`} {...props} />
  );
}
