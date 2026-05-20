import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

export function SplitPane({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("flex min-h-0 min-w-0 flex-1 overflow-hidden", className)}>{children}</div>;
}
