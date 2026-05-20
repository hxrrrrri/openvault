import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function GlowCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "card transition duration-200 hover:-translate-y-0.5 hover:border-violet/40 hover:shadow-[var(--shadow-card),0_0_22px_rgba(139,124,255,0.16)]",
        className,
      )}
      {...props}
    />
  );
}
