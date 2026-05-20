import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export function IconButton({ label, children, className, ...props }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-grid size-8 place-items-center rounded-[9px] border border-transparent bg-transparent text-[var(--text-3)] transition hover:border-[var(--border)] hover:bg-white/[0.04] hover:text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-violet/40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
