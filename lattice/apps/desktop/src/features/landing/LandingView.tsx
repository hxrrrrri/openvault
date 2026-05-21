import { ArrowRight, FolderOpen, GitBranch, Globe, Heart, Layers, Plus, Sparkles, Workflow } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { LatticeMark, LatticeWordmark } from "@/components/ui/LatticeMark";
import { useUIStore } from "@/stores/ui-store";
import { useVaultStore } from "@/stores/vault-store";

export function LandingView() {
  const setView = useUIStore((state) => state.setView);
  const vault = useVaultStore((state) => state.vault);
  const openVault = useVaultStore((state) => state.openVault);
  const createVault = useVaultStore((state) => state.createVault);

  async function chooseVault(mode: "create" | "open") {
    const fallback =
      mode === "create"
        ? "C:/Users/haris/Documents/Lattice Vault"
        : "C:/Users/haris/Documents";
    const path = window.prompt(
      mode === "create" ? "New vault folder path" : "Vault folder path",
      fallback,
    );
    if (!path) return;
    if (mode === "create") await createVault(path);
    else await openVault(path);
    setView("workspace");
  }

  return (
    <div className="relative flex min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,#0e0e1a_0%,#050507_70%)]">
      <ConstellationBackdrop />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-12 px-8 py-14">
        <header className="flex flex-col items-center gap-5 text-center">
          <LatticeWordmark height={64} />
          <div className="pixel-label text-[10px]">A new shape for your second brain</div>
          <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-tight">
            Local-first knowledge,
            <br />
            <span className="bg-gradient-to-r from-[#A99BFF] via-[#8B7CFF] to-[#6D8DFF] bg-clip-text text-transparent">
              luminous as a constellation.
            </span>
          </h1>
          <p className="max-w-xl text-sm leading-6 text-[var(--text-2)]">
            Lattice is a faster, prettier, more powerful Obsidian. Every note stays as Markdown on your disk.
            Every link draws a thread. Every idea has a place to live.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {vault ? (
              <Button variant="primary" onClick={() => setView("workspace")}>
                <ArrowRight size={14} /> Back to {vault.name}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void chooseVault("create")}>
                <Plus size={14} /> Create vault
              </Button>
            )}
            <Button variant="ghost" onClick={() => void chooseVault("open")}>
              <FolderOpen size={14} /> Open folder
            </Button>
            <Button variant="ghost" onClick={() => setView("graph")}>
              <GitBranch size={14} /> Live graph
            </Button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Sparkles size={16} />}
            title="Live preview editor"
            body="Headings, callouts, wikilinks and embeds render as you type. Slash menu, floating toolbar, per-note theme presets."
          />
          <FeatureCard
            icon={<GitBranch size={16} />}
            title="Force-directed graph"
            body="Drag nodes, pin clusters, hover for previews. Real physics with a smooth animated drift."
          />
          <FeatureCard
            icon={<Layers size={16} />}
            title="Canvas + Bases"
            body="Whiteboards, kanban, gallery, and calendar views over your existing Markdown files."
          />
          <FeatureCard
            icon={<Workflow size={16} />}
            title="Plugin sandbox"
            body="Run Obsidian-style community plugins with explicit, revocable permission grants."
          />
          <FeatureCard
            icon={<Globe size={16} />}
            title="Embed anything"
            body="GIFs, YouTube, Vimeo, audio, local video, PDFs, iframes — paste a URL, get an inline player."
          />
          <FeatureCard
            icon={<Heart size={16} />}
            title="Open & yours"
            body="No proprietary database. Your files. Your machine. Sync via Git, iCloud, Syncthing — your call."
          />
        </section>

        <section className="grid gap-4 rounded-3xl bg-white/[0.02] p-8 shadow-[inset_0_0_0_1px_rgba(139,124,255,0.16)] lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="pixel-label text-[10px]">Quick jump</div>
            <h2 className="mt-1 text-2xl font-semibold">Where do you want to go?</h2>
            <p className="mt-2 max-w-md text-sm text-[var(--text-3)]">
              Every workspace tab is one click away. Drop into the editor, scan the graph, or explore plugins —
              landing always remembered through the logo.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
            <QuickJump label="Editor" view="workspace" setView={setView} />
            <QuickJump label="Graph" view="graph" setView={setView} />
            <QuickJump label="Canvas" view="canvas" setView={setView} />
            <QuickJump label="Collections" view="collections" setView={setView} />
            <QuickJump label="Plugins" view="plugins" setView={setView} />
            <QuickJump label="Settings" view="settings" setView={setView} />
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5 text-[11px] text-[var(--text-3)]">
          <div className="flex items-center gap-2">
            <LatticeMark size={20} rounded={4} />
            <span>Lattice v0.1.0 nightly</span>
          </div>
          <span className="mono">open source / local first / yours forever</span>
        </footer>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="group rounded-2xl bg-white/[0.025] p-5 shadow-[inset_0_0_0_1px_rgba(139,124,255,0.14)] transition hover:-translate-y-0.5 hover:shadow-[inset_0_0_0_1px_rgba(169,155,255,0.28)]">
      <span className="grid size-9 place-items-center rounded-lg bg-violet/10 text-[var(--violet-2)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.14)]">
        {icon}
      </span>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1.5 text-xs leading-5 text-[var(--text-3)]">{body}</p>
    </div>
  );
}

function QuickJump({
  label,
  view,
  setView,
}: {
  label: string;
  view: "workspace" | "graph" | "canvas" | "collections" | "plugins" | "settings";
  setView: (view: "workspace" | "graph" | "canvas" | "collections" | "plugins" | "settings") => void;
}) {
  return (
    <button
      type="button"
      onClick={() => setView(view)}
      className="flex items-center justify-between rounded-xl bg-white/[0.025] px-3 py-2 text-xs text-[var(--text-2)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.14)] transition hover:text-white hover:shadow-[inset_0_0_0_1px_rgba(169,155,255,0.28)]"
    >
      {label}
      <ArrowRight size={12} />
    </button>
  );
}

function ConstellationBackdrop() {
  return (
    <svg className="absolute inset-0 z-0 h-full w-full opacity-60" aria-hidden="true">
      {Array.from({ length: 70 }).map((_, index) => {
        const x = (index * 73 + 12) % 100;
        const y = (index * 137 + 8) % 100;
        const r = (index % 4) + 1;
        const opacity = 0.18 + (index % 5) * 0.11;
        return (
          <circle
            key={index}
            cx={`${x}%`}
            cy={`${y}%`}
            r={r}
            fill={index % 7 === 0 ? "#A99BFF" : "#ffffff"}
            opacity={opacity}
          />
        );
      })}
    </svg>
  );
}
