import { BrainCircuit, FilePenLine, Gem, GitBranch, LayoutDashboard, PanelTop, Search, Settings, Shield, Smartphone, Sparkles, Table2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { LatticeMark } from "@/components/ui/LatticeMark";
import { Tabs } from "@/components/ui/Tabs";
import { useUIStore } from "@/stores/ui-store";
import type { VaultInfo, WorkspaceView } from "@/types/domain";

const tabs: Array<{ id: WorkspaceView; label: string; icon: ReactNode }> = [
  { id: "workspace", label: "Editor", icon: <FilePenLine size={13} /> },
  { id: "collections", label: "Collections", icon: <Table2 size={13} /> },
  { id: "ai", label: "AI", icon: <Sparkles size={13} /> },
  { id: "canvas", label: "Canvas", icon: <LayoutDashboard size={13} /> },
  { id: "graph", label: "Graph", icon: <GitBranch size={13} /> },
  { id: "health", label: "Health", icon: <Shield size={13} /> },
  { id: "plugins", label: "Plugins", icon: <Gem size={13} /> },
  { id: "settings", label: "Settings", icon: <Settings size={13} /> },
];

export function CommandBar({ vault }: { vault: VaultInfo | null }) {
  const view = useUIStore((state) => state.view);
  const setView = useUIStore((state) => state.setView);
  const setPaletteOpen = useUIStore((state) => state.setPaletteOpen);
  const mobilePreview = useUIStore((state) => state.mobilePreview);
  const setMobilePreview = useUIStore((state) => state.setMobilePreview);

  return (
    <header className="relative z-10 flex h-[52px] items-center gap-3 border-b border-[var(--border)] bg-gradient-to-b from-[#111116]/95 to-[#0a0a0f]/95 px-3.5 backdrop-blur-xl">
      <div className="flex items-center gap-2.5 border-r border-[var(--border)] pr-3.5">
        <div className="grid size-[26px] place-items-center rounded-lg bg-gradient-to-br from-[#8B7CFF] to-[#4B36B8] shadow-[0_0_12px_rgba(139,124,255,0.5),inset_0_1px_0_rgba(255,255,255,0.2)]">
          <LatticeMark size={14} />
        </div>
        <div className="flex min-w-[140px] flex-col leading-tight">
          <span className="truncate text-xs font-semibold">{vault?.name ?? "No Vault"}</span>
          <span className="mono truncate text-[10px] text-[var(--text-3)]">{vault?.path ?? "Open a local folder"}</span>
        </div>
      </div>

      <Tabs items={tabs} value={view} onChange={setView} />

      <button
        onClick={() => setPaletteOpen(true)}
        className="flex max-w-xl flex-1 items-center gap-2.5 rounded-[10px] border border-[var(--border)] bg-white/[0.025] px-3 py-2 text-left text-xs text-[var(--text-3)] transition hover:border-violet/40 hover:shadow-[0_0_0_1px_rgba(139,124,255,0.15)]"
      >
        <Search size={14} />
        <span className="truncate">Search notes, commands, tags, plugins</span>
        <span className="ml-auto flex gap-1">
          <kbd className="mono rounded border border-[var(--border)] bg-white/[0.05] px-1.5 py-0.5 text-[10px]">Ctrl</kbd>
          <kbd className="mono rounded border border-[var(--border)] bg-white/[0.05] px-1.5 py-0.5 text-[10px]">K</kbd>
        </span>
      </button>

      <Button
        variant="ghost"
        className="px-2"
        title="Toggle mobile companion preview"
        onClick={() => setMobilePreview(!mobilePreview)}
      >
        {mobilePreview ? <PanelTop size={16} /> : <Smartphone size={16} />}
      </Button>

      <div className="chip chip-violet mono">
        <span className="size-1.5 rounded-full bg-[var(--success)] shadow-[0_0_6px_#65F2A8]" />
        INDEXED
      </div>
      <div className="hidden items-center gap-1 text-[var(--text-3)] xl:flex">
        <BrainCircuit size={14} className="text-[var(--violet-2)]" />
        <span className="mono text-[10px]">LOCAL AI</span>
      </div>
      <div className="grid size-7 place-items-center overflow-hidden rounded-full border border-white/20 bg-black">
        <LatticeMark size={28} />
      </div>
    </header>
  );
}
