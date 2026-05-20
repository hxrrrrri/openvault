import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "primary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
}

export function Button({ className, variant = "default", icon, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 rounded-[10px] border px-3.5 py-2 text-[13px] font-medium transition duration-150",
        "active:translate-y-px active:shadow-inner focus:outline-none focus:ring-2 focus:ring-violet/40 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "default" &&
          "border-[var(--border)] bg-white/[0.03] text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-white/[0.06]",
        variant === "primary" &&
          "border-white/20 bg-gradient-to-b from-[#8B7CFF] to-[#6E5DE8] text-white shadow-[0_8px_24px_-8px_rgba(139,124,255,0.6),inset_0_1px_0_rgba(255,255,255,0.25)] hover:from-[#9c8eff] hover:to-[#7c6cf0]",
        variant === "ghost" &&
          "border-transparent bg-transparent text-[var(--text-2)] hover:bg-white/[0.04] hover:text-[var(--text)]",
        variant === "danger" &&
          "border-red-400/25 bg-red-500/5 text-[var(--danger)] hover:bg-red-500/10",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
