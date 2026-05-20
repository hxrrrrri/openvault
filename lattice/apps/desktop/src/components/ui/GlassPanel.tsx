import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export function GlassPanel({ className, padded = true, ...props }: GlassPanelProps) {
  return <div className={cn("glass rounded-[var(--r-md)]", padded && "p-4", className)} {...props} />;
}
