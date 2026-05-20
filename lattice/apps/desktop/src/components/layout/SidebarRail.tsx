import { PanelLeftOpen, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function SidebarRail({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "grid w-[18px] shrink-0 place-items-center border-[var(--border)] bg-transparent text-[var(--text-3)] transition hover:bg-white/[0.03] hover:text-[var(--text)]",
        side === "left" ? "border-r" : "border-l",
      )}
      title={`Open ${side} panel`}
    >
      {side === "left" ? <PanelLeftOpen size={12} /> : <PanelRightOpen size={12} />}
    </button>
  );
}
