import { BookOpen, Calendar, Command, FileText, GitBranch, Link, PenTool, Puzzle, Search, Settings, Sparkles, Table2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getObsidianPluginHost } from "@/features/plugins/obsidian-host";
import { usePluginUIStore } from "@/stores/plugin-ui-store";

const iconMap: Record<string, LucideIcon> = {
  book: BookOpen,
  calendar: Calendar,
  command: Command,
  edit: PenTool,
  file: FileText,
  graph: GitBranch,
  link: Link,
  pencil: PenTool,
  search: Search,
  settings: Settings,
  sparkles: Sparkles,
  table: Table2,
};

export function PluginRibbon() {
  const items = usePluginUIStore((state) => state.ribbonItems);
  if (items.length === 0) return null;

  return (
    <aside className="flex w-[42px] shrink-0 flex-col items-center gap-1 border-r border-[var(--border)] bg-[#08080c] px-1.5 py-2">
      {items.map((item) => {
        const Icon = iconFor(item.icon);
        return (
          <button
            key={item.id}
            type="button"
            title={item.title}
            className="grid size-8 place-items-center rounded-md text-[var(--text-3)] transition hover:bg-violet/15 hover:text-white"
            onClick={() => void getObsidianPluginHost().invokeRibbonAction(item.pluginId, item.id)}
          >
            <Icon size={15} />
          </button>
        );
      })}
    </aside>
  );
}

function iconFor(icon: string): LucideIcon {
  const normalized = icon.toLowerCase().replace(/^lucide-/, "");
  return iconMap[normalized] ?? Puzzle;
}
