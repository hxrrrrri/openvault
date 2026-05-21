import {
  BrainCircuit,
  FilePenLine,
  Gem,
  GitBranch,
  Home,
  LayoutDashboard,
  PanelTop,
  Search,
  Settings,
  Shield,
  Smartphone,
  Table2,
  Terminal,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { LatticeMark } from "@/components/ui/LatticeMark";
import { Tabs } from "@/components/ui/Tabs";
import { useUIStore } from "@/stores/ui-store";
import type { VaultInfo, WorkspaceView } from "@/types/domain";

const tabs: Array<{ id: WorkspaceView; label: string; icon: ReactNode }> = [
  { id: "workspace", label: "Editor", icon: <FilePenLine size={13} /> },
  { id: "collections", label: "Collections", icon: <Table2 size={13} /> },
  { id: "ai", label: "Terminal", icon: <Terminal size={13} /> },
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
    <header className="relative z-10 flex h-[60px] min-w-0 items-center gap-2 border-b border-[var(--border)] bg-gradient-to-b from-[#111116]/95 to-[#0a0a0f]/95 px-3 backdrop-blur-xl">
      <button
        type="button"
        onClick={() => setView("landing")}
        title={vault ? `${vault.name} - ${vault.path}` : "Lattice landing page"}
        className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-white/[0.025] transition hover:border-violet/35 hover:bg-violet/10"
      >
        <LatticeMark size={34} rounded={8} />
      </button>

      <Button
        variant={view === "landing" ? "primary" : "ghost"}
        className="px-2 py-1.5 text-[11px]"
        title="Home / landing"
        onClick={() => setView("landing")}
      >
        <Home size={14} />
      </Button>

      <Tabs
        items={tabs}
        value={view}
        onChange={setView}
        className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      />

      <button
        onClick={() => setPaletteOpen(true)}
        className="hidden min-w-[210px] max-w-[360px] flex-[0_1_360px] items-center gap-2.5 rounded-[10px] border border-[var(--border)] bg-white/[0.025] px-3 py-2 text-left text-xs text-[var(--text-3)] transition hover:border-violet/40 hover:shadow-[0_0_0_1px_rgba(139,124,255,0.15)] lg:flex"
      >
        <Search size={14} />
        <span className="truncate">Search notes, commands, tags, plugins</span>
        <span className="ml-auto hidden gap-1 xl:flex">
          <kbd className="mono rounded border border-[var(--border)] bg-white/[0.05] px-1.5 py-0.5 text-[10px]">
            Ctrl
          </kbd>
          <kbd className="mono rounded border border-[var(--border)] bg-white/[0.05] px-1.5 py-0.5 text-[10px]">
            K
          </kbd>
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

      <div className="chip chip-violet mono hidden 2xl:inline-flex">
        <span className="size-1.5 rounded-full bg-[var(--success)] shadow-[0_0_6px_#65F2A8]" />
        INDEXED
      </div>
      <div className="hidden items-center gap-1 text-[var(--text-3)] 2xl:flex">
        <BrainCircuit size={14} className="text-[var(--violet-2)]" />
        <span className="mono text-[10px]">LOCAL AI</span>
      </div>
    </header>
  );
}
