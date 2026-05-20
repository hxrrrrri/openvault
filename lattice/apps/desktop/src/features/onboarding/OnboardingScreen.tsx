import { Code2, FolderOpen, Lock, Plus, Shield, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { LatticeMark } from "@/components/ui/LatticeMark";
import { useVaultStore } from "@/stores/vault-store";

interface OnboardingScreenProps {
  onEnter: () => void;
  error?: string | null;
}

export function OnboardingScreen({ onEnter, error }: OnboardingScreenProps) {
  const [step, setStep] = useState<"welcome" | "indexing">("welcome");
  const [progress, setProgress] = useState(0);
  const openVault = useVaultStore((state) => state.openVault);
  const createVault = useVaultStore((state) => state.createVault);

  useEffect(() => {
    if (step !== "indexing") return;
    const timer = window.setInterval(() => {
      setProgress((current) => {
        const next = Math.min(100, current + 3.2);
        if (next >= 100) {
          window.clearInterval(timer);
          window.setTimeout(onEnter, 420);
        }
        return next;
      });
    }, 70);
    return () => window.clearInterval(timer);
  }, [onEnter, step]);

  async function chooseVault(mode: "create" | "open" | "import") {
    const fallback = mode === "create" ? "C:/Users/haris/Documents/Lattice Vault" : "C:/Users/haris/Documents";
    const path = window.prompt(mode === "create" ? "New vault folder path" : "Vault folder path", fallback);
    if (!path) return;
    if (mode === "create") await createVault(path);
    else await openVault(path);
    setStep("indexing");
  }

  return (
    <div className="bg-ambient relative grid h-screen w-screen place-items-center overflow-hidden">
      <ConstellationBackdrop />

      <div className="absolute left-7 top-6 z-10 flex items-center gap-3">
        <div className="grid size-[30px] place-items-center rounded-[9px] bg-gradient-to-br from-[#8B7CFF] to-[#4B36B8] shadow-[0_0_16px_rgba(139,124,255,0.5)]">
          <LatticeMark size={16} />
        </div>
        <span className="text-sm font-semibold tracking-[0.04em]">LATTICE</span>
        <span className="pixel-label text-[10px]">v0.1.0 nightly</span>
      </div>

      <div className="pixel-label absolute right-7 top-7 z-10 text-[10px]">open-source / local-first</div>

      {step === "welcome" ? (
        <section className="anim-scale-in glass relative z-10 w-[min(620px,calc(100vw-32px))] rounded-[24px] border-violet/20 p-9 shadow-[var(--shadow-float),0_0_80px_rgba(75,54,184,0.3)]">
          <div className="pixel-label text-[11px]">Welcome to LATTICE</div>
          <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-normal">
            Your knowledge,
            <br />
            as a <span className="bg-gradient-to-r from-[#A99BFF] to-[#6D8DFF] bg-clip-text text-transparent">luminous constellation</span>.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-[var(--text-2)]">
            Open a vault to begin. Everything stays on this machine: Markdown files in folders you can read, version, and back up.
          </p>
          {error && <div className="mt-4 rounded-lg border border-red-400/25 bg-red-500/5 px-3 py-2 text-xs text-[var(--danger)]">{error}</div>}

          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <OnboardingOption icon={<Plus size={16} />} title="Create new vault" sub="Empty folder with starter templates" featured onClick={() => void chooseVault("create")} />
            <OnboardingOption icon={<FolderOpen size={16} />} title="Open local folder" sub="Use an existing folder of Markdown files" onClick={() => void chooseVault("open")} />
            <OnboardingOption icon={<Shield size={16} />} title="Import Obsidian vault" sub="Detect .obsidian without modifying it" onClick={() => void chooseVault("import")} />
            <OnboardingOption icon={<Lock size={16} />} title="Use default vault" sub="Create or open Documents/Lattice Vault" onClick={() => void chooseVault("create")} />
          </div>

          <div className="card-inner mt-5 grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
            <TrustItem icon={<Lock size={12} />} label="Markdown stays yours" />
            <TrustItem icon={<WifiOff size={12} />} label="No hidden network" />
            <TrustItem icon={<Code2 size={12} />} label="Open source" />
            <TrustItem icon={<Shield size={12} />} label="Safe plugins" />
          </div>
        </section>
      ) : (
        <section className="anim-scale-in glass relative z-10 w-[min(540px,calc(100vw-32px))] rounded-[24px] border-violet/25 p-9 shadow-[var(--shadow-float),0_0_80px_rgba(75,54,184,0.3)]">
          <div className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-2xl border border-violet/25 bg-black/30 text-[var(--violet-2)]">
              <LatticeMark size={22} />
            </div>
            <div>
              <div className="pixel-label text-[10px]">Indexing / local</div>
              <h2 className="mt-1 text-lg font-semibold">Building your constellation</h2>
            </div>
          </div>
          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full bg-gradient-to-r from-[#4B36B8] via-[#8B7CFF] to-[#A99BFF] shadow-[0_0_12px_rgba(139,124,255,0.6)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mono mt-2 flex justify-between text-[11px] text-[var(--text-3)]">
            <span>real vault files</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="divider my-5" />
          <div className="space-y-2 text-xs text-[var(--text-2)]">
            <Step done={progress > 8} label="Scan folder tree" />
            <Step done={progress > 24} label="Parse Markdown and YAML frontmatter" />
            <Step done={progress > 52} label="Resolve wikilinks and backlinks" />
            <Step done={progress > 74} label="Prepare search and graph payloads" />
            <Step done={progress > 92} label="Persist workspace state" />
          </div>
          <div className="mx-auto mt-6 flex w-fit rounded-[10px] border border-transparent px-3.5 py-2 text-[11px] text-[var(--text-2)]">
            AI and embeddings remain local unless enabled later
          </div>
        </section>
      )}
    </div>
  );
}

function OnboardingOption({ icon, title, sub, featured, onClick }: { icon: ReactNode; title: string; sub: string; featured?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        "group flex flex-col gap-3 rounded-[14px] border p-3.5 text-left transition hover:-translate-y-0.5 hover:border-violet/45",
        featured ? "border-violet/45 bg-violet/10 shadow-[0_0_24px_rgba(139,124,255,0.18)]" : "border-[var(--border)] bg-white/[0.02]",
      ].join(" ")}
    >
      <span className="grid size-8 place-items-center rounded-[9px] border border-violet/25 bg-black/40 text-[var(--violet-2)]">{icon}</span>
      <span>
        <span className="block text-[13px] font-semibold">{title}</span>
        <span className="mt-1 block text-[11px] text-[var(--text-3)]">{sub}</span>
      </span>
    </button>
  );
}

function TrustItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-2)]">
      <span className="text-[var(--violet-2)]">{icon}</span>
      {label}
    </div>
  );
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <div className={done ? "text-[var(--text)]" : "text-[var(--text-3)]"}>
      <span className={done ? "mr-2 inline-block size-2 rounded-full bg-[var(--violet)] shadow-[0_0_10px_rgba(139,124,255,0.5)]" : "mr-2 inline-block size-2 rounded-full border border-[var(--border)]"} />
      {label}
    </div>
  );
}

function ConstellationBackdrop() {
  return (
    <svg className="absolute inset-0 z-0 h-full w-full opacity-70" aria-hidden="true">
      {Array.from({ length: 60 }).map((_, index) => {
        const x = (index * 73 + 12) % 100;
        const y = (index * 137 + 8) % 100;
        const r = (index % 4) + 1;
        const opacity = 0.18 + (index % 5) * 0.11;
        return <circle key={index} cx={`${x}%`} cy={`${y}%`} r={r} fill={index % 7 === 0 ? "#A99BFF" : "#ffffff"} opacity={opacity} />;
      })}
    </svg>
  );
}
