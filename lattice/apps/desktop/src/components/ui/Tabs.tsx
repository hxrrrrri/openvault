import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ items, value, onChange, className }: TabsProps<T>) {
  return (
    <div className={cn("flex gap-1 rounded-[10px] border border-[var(--border)] bg-white/[0.025] p-1", className)}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-xs font-medium text-[var(--text-3)] transition",
            value === item.id &&
              "bg-violet/15 text-[var(--text)] shadow-[0_0_0_1px_rgba(139,124,255,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]",
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
