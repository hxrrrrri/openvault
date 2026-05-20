import { Home, Mic, Network, Search, Send, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useUIStore } from "@/stores/ui-store";

type MobileTab = "home" | "search" | "graph" | "inbox";

export function MobilePreview() {
  const setMobilePreview = useUIStore((state) => state.setMobilePreview);
  const [tab, setTab] = useState<MobileTab>("home");

  return (
    <div className="bg-ambient relative grid min-h-0 flex-1 place-items-center overflow-hidden">
      <div className="absolute left-6 top-5 z-10">
        <Button onClick={() => setMobilePreview(false)}>Back to desktop</Button>
      </div>
      <div className="absolute right-7 top-6 z-10 text-right">
        <div className="pixel-label text-[10px]">Mobile companion</div>
        <div className="mt-1 text-sm">Responsive preview</div>
      </div>

      <div className="relative z-10 h-[720px] w-[360px] overflow-hidden rounded-[38px] border border-white/15 bg-[#08080c] p-3 shadow-[var(--shadow-float),0_0_70px_rgba(139,124,255,0.2)]">
        <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-[#111116] to-[#050507]">
          <div className="mono flex h-8 items-center justify-between px-6 text-[11px]">
            <span>19:42</span>
            <span className="text-[var(--success)]">offline</span>
          </div>
          <main className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === "home" && <MobileHome />}
            {tab === "search" && <MobileSearch />}
            {tab === "graph" && <MobileGraph />}
            {tab === "inbox" && <MobileInbox />}
          </main>
          <nav className="grid h-16 grid-cols-4 border-t border-[var(--border)] bg-black/30">
            <MobileNav id="home" active={tab} onClick={setTab} icon={<Home size={17} />} label="Home" />
            <MobileNav id="search" active={tab} onClick={setTab} icon={<Search size={17} />} label="Search" />
            <MobileNav id="graph" active={tab} onClick={setTab} icon={<Network size={17} />} label="Graph" />
            <MobileNav id="inbox" active={tab} onClick={setTab} icon={<Send size={17} />} label="Inbox" />
          </nav>
        </div>
      </div>
    </div>
  );
}

function MobileHome() {
  return (
    <div>
      <div className="pixel-label text-[9px]">Today / 2026-05-20</div>
      <h2 className="mt-1 text-xl font-semibold">Capture what matters.</h2>
      <section className="gradient-card mt-4 min-h-[128px] p-4">
        <div className="pixel-label text-[9px] text-white/70">Daily note</div>
        <p className="mt-2 text-sm leading-5 text-white/80">3 ideas, 2 tasks, 1 unresolved link waiting for review.</p>
        <Button className="mt-3 bg-white/10 text-xs">Open daily note</Button>
      </section>
      <div className="pixel-label mb-2 mt-5 text-[9px]">Quick actions</div>
      <div className="grid grid-cols-2 gap-2">
        <QuickAction icon={<Mic size={18} />} label="Voice" sub="On-device" />
        <QuickAction icon={<Sparkles size={18} />} label="Link idea" sub="Local AI" />
      </div>
    </div>
  );
}

function MobileSearch() {
  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-3 text-[var(--text-3)]" size={15} />
        <input className="w-full rounded-2xl border border-[var(--border)] bg-white/[0.03] py-3 pl-10 pr-3 text-sm outline-none" placeholder="Search vault" />
      </div>
      <div className="pixel-label mb-2 mt-5 text-[9px]">Semantic matches</div>
      {["Project Atlas", "Vector Embeddings", "Local-First Manifesto"].map((title, index) => (
        <div key={title} className="card mb-2 flex items-center gap-3 p-3">
          <FileDot />
          <span className="min-w-0 flex-1 truncate text-sm">{title}</span>
          <span className="mono text-[10px] text-[var(--violet-2)]">{(0.92 - index * 0.06).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

function MobileGraph() {
  return (
    <div>
      <div className="pixel-label text-[10px]">Your constellation</div>
      <div className="relative mt-4 h-[420px] rounded-3xl border border-[var(--border)] bg-[radial-gradient(circle_at_center,rgba(139,124,255,0.18),transparent_55%),#050507]">
        {Array.from({ length: 18 }).map((_, index) => (
          <span
            key={index}
            className="absolute rounded-full bg-[var(--violet-2)] shadow-[0_0_12px_rgba(139,124,255,0.7)]"
            style={{
              width: 5 + (index % 4) * 2,
              height: 5 + (index % 4) * 2,
              left: `${12 + ((index * 37) % 76)}%`,
              top: `${10 + ((index * 53) % 78)}%`,
              opacity: 0.45 + (index % 4) * 0.12,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function MobileInbox() {
  return (
    <div>
      <div className="pixel-label mb-3 text-[10px]">Inbox / 3 unprocessed</div>
      {["Voice capture", "Book quote", "Broken link idea"].map((title) => (
        <div key={title} className="card mb-2 p-3">
          <div className="text-sm font-medium">{title}</div>
          <div className="mono mt-1 text-[10px] text-[var(--text-3)]">queued for daily note</div>
        </div>
      ))}
    </div>
  );
}

function QuickAction({ icon, label, sub }: { icon: ReactNode; label: string; sub: string }) {
  return (
    <button className="card flex flex-col items-start gap-3 p-3 text-left">
      <span className="text-[var(--violet-2)]">{icon}</span>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mono mt-1 block text-[10px] text-[var(--text-3)]">{sub}</span>
      </span>
    </button>
  );
}

function MobileNav({ id, active, onClick, icon, label }: { id: MobileTab; active: MobileTab; onClick: (tab: MobileTab) => void; icon: ReactNode; label: string }) {
  return (
    <button onClick={() => onClick(id)} className={`grid place-items-center text-[10px] ${active === id ? "text-[var(--violet-2)]" : "text-[var(--text-3)]"}`}>
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function FileDot() {
  return <span className="grid size-8 place-items-center rounded-lg border border-[var(--border)] bg-black/30 text-[var(--violet-2)]">MD</span>;
}
