import { FileText, Hash, Puzzle, Search, Settings, Sparkles, Terminal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchStore } from "@/stores/search-store";
import { useUIStore } from "@/stores/ui-store";
import { useVaultStore } from "@/stores/vault-store";
import type { CommandItem } from "@/types/domain";

interface CommandPaletteProps {
  onClose: () => void;
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const commands = useSearchStore((state) => state.commands);
  const searchResults = useSearchStore((state) => state.results);
  const activeIndex = useSearchStore((state) => state.activeIndex);
  const setSearchQuery = useSearchStore((state) => state.setQuery);
  const setActiveIndex = useSearchStore((state) => state.setActiveIndex);
  const setView = useUIStore((state) => state.setView);
  const setActivePath = useVaultStore((state) => state.setActivePath);
  const createNote = useVaultStore((state) => state.createNote);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void setSearchQuery(query);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [query, setSearchQuery]);

  const items = useMemo<CommandItem[]>(() => {
    const normalized = query.toLowerCase();
    const commandMatches = commands.filter((item) => !normalized || item.label.toLowerCase().includes(normalized));
    const noteMatches = searchResults.map((result) => ({
      id: `search:${result.path}`,
      group: "Notes",
      label: result.title,
      kind: "note" as const,
      path: result.path,
      score: result.score,
      icon: "file",
    }));
    return [...commandMatches, ...noteMatches];
  }, [commands, query, searchResults]);

  function activate(item: CommandItem | undefined) {
    if (!item) return;
    if (item.kind === "note" && item.path) {
      void setActivePath(item.path);
      setView("workspace");
    }
    if (item.id === "note.new") {
      void createNote(`Inbox/Untitled ${Date.now()}.md`);
      setView("workspace");
    }
    if (item.id === "note.daily") {
      void createNote(`Daily Notes/${today()}.md`);
      setView("workspace");
    }
    if (item.id === "canvas.open") setView("canvas");
    if (item.id === "collections.open") setView("collections");
    if (item.id === "ai.open") setView("ai");
    if (item.id === "graph.open") setView("graph");
    if (item.id === "health.open") setView("health");
    if (item.id === "plugins.open") setView("plugins");
    if (item.id === "settings.permissions") setView("settings");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-[#050507]/60 px-4 pt-[12vh] backdrop-blur-xl" onMouseDown={onClose}>
      <section
        className="anim-scale-in mx-auto w-full max-w-2xl overflow-hidden rounded-[18px] border border-violet/35 bg-gradient-to-b from-[#1c1c24]/95 to-[#111116]/95 shadow-[var(--shadow-float),0_0_60px_rgba(139,124,255,0.3)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <Search size={16} className="text-[var(--violet-2)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex(Math.min(items.length - 1, activeIndex + 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex(Math.max(0, activeIndex - 1));
              }
              if (event.key === "Enter") activate(items[activeIndex]);
            }}
            placeholder="Search notes, commands, tags, plugins"
            className="min-w-0 flex-1 bg-transparent p-1 text-[15px] text-[var(--text)] outline-none placeholder:text-[var(--text-4)]"
          />
          <span className="chip mono text-[10px]">{items.length} results</span>
          <kbd className="mono rounded border border-[var(--border)] bg-white/[0.06] px-2 py-1 text-[10px]">ESC</kbd>
        </div>

        <div className="max-h-[440px] overflow-y-auto p-2">
          {groupItems(items).map((group) => (
            <div key={group.name} className="mt-1">
              <div className="pixel-label px-3 py-1 text-[9px]">{group.name}</div>
              {group.items.map((item) => {
                const index = items.indexOf(item);
                const active = index === activeIndex;
                return (
                  <button
                    key={item.id}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => activate(item)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                      active ? "bg-gradient-to-r from-violet/20 to-violet/5 shadow-[inset_0_0_0_1px_rgba(139,124,255,0.28)]" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <span className={`grid size-7 place-items-center rounded-lg bg-white/[0.04] ${active ? "text-[var(--violet-2)]" : "text-[var(--text-3)]"}`}>
                      {iconFor(item)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{item.label}</span>
                      {item.path && <span className="mono block truncate text-[10px] text-[var(--text-4)]">{item.path}</span>}
                    </span>
                    {typeof item.score === "number" && <span className="mono text-[10px] text-[var(--violet-2)]">{item.score.toFixed(2)}</span>}
                    {item.hint && <kbd className="mono rounded border border-[var(--border)] bg-white/[0.04] px-2 py-0.5 text-[10px] text-[var(--text-3)]">{item.hint}</kbd>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <footer className="flex items-center gap-4 border-t border-[var(--border)] px-4 py-2 text-[11px] text-[var(--text-3)]">
          <span className="mono">Up Down navigate</span>
          <span className="mono">Enter open</span>
          <span className="mono">Ctrl K toggle</span>
          <span className="mono ml-auto text-[var(--violet-2)]">semantic local</span>
        </footer>
      </section>
    </div>
  );
}

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function groupItems(items: CommandItem[]) {
  const groups = new Map<string, CommandItem[]>();
  for (const item of items) {
    groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  }
  return Array.from(groups.entries()).map(([name, groupItems]) => ({ name, items: groupItems }));
}

function iconFor(item: CommandItem) {
  if (item.kind === "note") return <FileText size={14} />;
  if (item.kind === "tag") return <Hash size={14} />;
  if (item.kind === "plugin") return <Puzzle size={14} />;
  if (item.kind === "setting") return <Settings size={14} />;
  if (item.id.includes("graph")) return <Sparkles size={14} />;
  return <Terminal size={14} />;
}
