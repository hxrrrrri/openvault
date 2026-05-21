import { AlertTriangle, GitBranch, Link2Off, RefreshCcw, Sparkles, Tags } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { GlowCard } from "@/components/ui/GlowCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { commands } from "@/lib/commands";
import type { VaultHealthReport } from "@/types/domain";

export function VaultHealthDashboard() {
  const [report, setReport] = useState<VaultHealthReport | null>(null);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void commands.getVaultHealth().then(setReport);
  }, []);

  async function refreshHealth(runIndex: boolean) {
    setRunning(true);
    setStatus(runIndex ? "Re-indexing vault..." : "Running local audit...");
    try {
      if (runIndex) {
        const summary = await commands.scanVault();
        setStatus(`Indexed ${summary.indexedFiles ?? 0} notes in ${summary.durationMs ?? 0} ms.`);
      }
      const next = await commands.getVaultHealth();
      setReport(next);
      if (!runIndex) setStatus("Audit complete.");
    } finally {
      setRunning(false);
    }
  }

  if (!report) return <LoadingState label="Loading vault health" />;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-[#08080c] to-[#050507] px-8 py-7">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <div className="pixel-label text-[11px]">Vault health</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal">How is your knowledge?</h1>
        </div>
        <div className="flex gap-2">
          {status && <span className="self-center text-xs text-[var(--text-3)]">{status}</span>}
          <Button icon={<RefreshCcw size={14} />} disabled={running} onClick={() => void refreshHealth(true)}>
            Re-index
          </Button>
          <Button variant="primary" icon={<Sparkles size={14} />} disabled={running} onClick={() => void refreshHealth(false)}>
            Run audit
          </Button>
        </div>
      </header>

      <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1fr_1fr_1fr]">
        <div className="gradient-card min-h-[200px] overflow-visible p-6">
          <div className="pixel-label text-[10px] text-[var(--text-2)]">Vault health score</div>
          <div className="mt-4 grid grid-cols-[132px_1fr] items-center gap-5">
            <HealthRing score={report.score} />
            <div className="min-w-0">
              <div className="text-base font-medium">Strong and growing</div>
              <p className="mt-1 max-w-xs text-xs leading-5 text-[var(--text-2)]">
                Connect orphan notes and resolve broken links to improve retrieval quality and graph density.
              </p>
            </div>
          </div>
        </div>
        <Kpi icon={<GitBranch size={48} />} label="Orphaned notes" value={report.orphanNotes} tone="warning" />
        <Kpi icon={<Link2Off size={48} />} label="Broken links" value={report.brokenLinks} tone="danger" />
        <Kpi icon={<Tags size={48} />} label="Without tags" value={report.notesWithoutTags} tone="muted" />
      </section>

      <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <GlowCard className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="pixel-label text-[10px]">Most connected notes</div>
            <span className="chip chip-violet mono text-[10px]">top {report.mostConnected.length}</span>
          </div>
          <div className="space-y-1">
            {report.mostConnected.map((note, index) => (
              <div key={note.path} className="flex items-center gap-3 border-b border-[var(--border)] py-2 last:border-b-0">
                <span className="mono w-6 text-[11px] text-[var(--text-4)]">{String(index + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{note.title}</span>
                <div className="h-1 w-28 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full bg-gradient-to-r from-[#4B36B8] to-[#8B7CFF]" style={{ width: `${Math.min(100, note.links * 2)}%` }} />
                </div>
                <span className="mono w-8 text-right text-[var(--violet-2)]">{note.links}</span>
              </div>
            ))}
          </div>
        </GlowCard>

        <GlowCard className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="pixel-label text-[10px]">Suggested improvements</div>
            <span className="chip chip-violet mono text-[10px]">local</span>
          </div>
          <div className="space-y-3">
            {report.suggestions.map((suggestion) => (
              <div key={suggestion.title} className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle size={14} className={suggestion.severity === "danger" ? "text-[var(--danger)]" : "text-[var(--warning)]"} />
                  {suggestion.title}
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--text-3)]">{suggestion.body}</p>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Metric label="Total notes" value={report.totalNotes} />
        <Metric label="Total links" value={report.totalLinks} />
        <Metric label="Duplicate titles" value={report.duplicateTitles.length} />
        <Metric label="Stale notes" value={report.staleNotes} />
      </section>
    </div>
  );
}

function HealthRing({ score }: { score: number }) {
  const size = 124;
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (score / 100) * c;
  return (
    <svg width={size} height={size} className="shrink-0 overflow-visible drop-shadow-[0_0_16px_rgba(139,124,255,0.5)]">
      <defs>
        <linearGradient id="health-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A99BFF" />
          <stop offset="100%" stopColor="#6D8DFF" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(116,107,158,0.32)" strokeWidth="6" fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="url(#health-ring-grad)"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 6} textAnchor="middle" fill="var(--text)" fontSize="34" fontWeight="600">
        {score}
      </text>
      <text x={size / 2} y={size / 2 + 25} textAnchor="middle" fill="var(--text-2)" fontSize="9" letterSpacing="2">
        /100
      </text>
    </svg>
  );
}

function Kpi({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: "warning" | "danger" | "muted" }) {
  const colors = {
    warning: "border-amber-300/25 bg-amber-400/5 text-[var(--warning)]",
    danger: "border-red-400/25 bg-red-500/5 text-[var(--danger)]",
    muted: "border-[var(--border)] bg-white/[0.02] text-[var(--text-2)]",
  };
  return (
    <div className={`card relative min-h-[200px] overflow-hidden p-5 ${colors[tone]}`}>
      <div className="absolute right-4 top-4 grid size-12 place-items-center rounded-xl bg-[#0b0b12]/70 opacity-40 shadow-[inset_0_0_0_1px_rgba(139,124,255,0.14)]">
        {icon}
      </div>
      <div className="pixel-label text-[10px]">{label}</div>
      <div className="mt-9 text-5xl font-semibold leading-none">{value}</div>
      <div className="mt-3 text-xs text-[var(--text-3)]">tracked from current index</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <GlowCard className="p-4">
      <div className="pixel-label text-[10px]">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </GlowCard>
  );
}
