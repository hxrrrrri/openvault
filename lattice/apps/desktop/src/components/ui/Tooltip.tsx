import type { PropsWithChildren, ReactNode } from "react";

export function Tooltip({ label, children }: PropsWithChildren<{ label: ReactNode }>) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--border)] bg-[#111116] px-2 py-1 text-[11px] text-[var(--text-2)] opacity-0 shadow-lg transition group-hover:opacity-100">
        {label}
      </span>
    </span>
  );
}
