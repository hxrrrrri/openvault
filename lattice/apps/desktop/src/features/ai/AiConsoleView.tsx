import { Bot, CheckCircle2, Play, RefreshCcw, Save, Sparkles, Terminal, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { commands } from "@/lib/commands";
import { useVaultStore } from "@/stores/vault-store";
import type { AiCliAdapterStatus, AiCliRunResult } from "@/types/domain";

const TASKS = [
  "Suggest missing links for the active note",
  "Turn this note into an evergreen note with YAML properties",
  "Create a project plan from this vault context",
  "Summarize the active note and propose follow-up notes",
];

export function AiConsoleView() {
  const [adapters, setAdapters] = useState<AiCliAdapterStatus[]>([]);
  const [selected, setSelected] = useState("claude-code");
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState(TASKS[0]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AiCliRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeNote = useVaultStore((state) => state.activeNote);
  const createNote = useVaultStore((state) => state.createNote);
  const refreshFiles = useVaultStore((state) => state.refreshFiles);
  const selectedAdapter = useMemo(() => adapters.find((adapter) => adapter.id === selected), [adapters, selected]);
  const output = result?.stdout.trim() || result?.stderr.trim() || "";

  async function loadAdapters() {
    const next = await commands.listAiCliAdapters().catch(() => []);
    setAdapters(next);
    const preferred = next.find((adapter) => adapter.available)?.id ?? next[0]?.id ?? "claude-code";
    setSelected((current) => next.some((adapter) => adapter.id === current) ? current : preferred);
  }

  useEffect(() => {
    void loadAdapters();
  }, []);

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const context = activeNote
        ? `${prompt}\n\n## Active Note\nPath: ${activeNote.path}\n\n${activeNote.content.slice(0, 14000)}`
        : prompt;
      const next = await commands.runAiCli({ adapterId: selected, prompt: context, model: model || null });
      setResult(next);
      if (next.exitCode !== 0 && !next.stdout.trim()) {
        setError(next.stderr || `${selected} exited with code ${next.exitCode}`);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "AI CLI run failed");
    } finally {
      setRunning(false);
    }
  }

  async function saveOutput() {
    if (!output) return;
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-${now.getTime()}`;
    await createNote(
      `AI Runs/${stamp}.md`,
      `---
provider: ${JSON.stringify(selected)}
model: ${JSON.stringify(model || selectedAdapter?.label || selected)}
sourceNote: ${JSON.stringify(activeNote?.path ?? "")}
tags:
  - ai-run
---

# AI Run - ${selectedAdapter?.label ?? selected}

## Prompt

${prompt}

## Output

${output}
`,
    );
    await refreshFiles();
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-gradient-to-b from-[#09090d] to-[#060609]">
      <aside className="w-[320px] shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[#0b0b10] p-4">
        <div className="pixel-label mb-3 flex items-center gap-2 text-[10px]">
          <Terminal size={13} /> CLI providers
        </div>
        <div className="space-y-2">
          {adapters.map((adapter) => (
            <button
              key={adapter.id}
              className={`row w-full text-left ${selected === adapter.id ? "active" : ""}`}
              onClick={() => setSelected(adapter.id)}
              title={adapter.available ? adapter.command : adapter.installHint}
            >
              {adapter.available ? <CheckCircle2 size={13} className="text-[var(--success)]" /> : <XCircle size={13} className="text-[var(--warning)]" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{adapter.label}</span>
                <span className="mono block truncate text-[10px] text-[var(--text-4)]">{adapter.command}</span>
              </span>
            </button>
          ))}
        </div>
        <Button variant="ghost" className="mt-3 w-full text-xs" onClick={() => void loadAdapters()}>
          <RefreshCcw size={13} /> Refresh availability
        </Button>

        <div className="divider my-5" />
        <label className="block text-xs text-[var(--text-2)]">
          Model override
          <input
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="optional"
            className="mt-2 w-full rounded-lg border border-[var(--border)] bg-white/[0.025] px-3 py-2 text-xs outline-none focus:border-violet/40"
          />
        </label>
        {selectedAdapter && !selectedAdapter.available && (
          <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-400/5 px-3 py-2 text-xs leading-5 text-[var(--warning)]">
            {selectedAdapter.installHint}
          </div>
        )}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-[var(--border)] p-5">
          <div className="flex items-center gap-3">
            <div>
              <div className="pixel-label text-[10px]">AI automation console</div>
              <h1 className="mt-1 text-xl font-semibold">Run real local CLIs against the active vault</h1>
            </div>
            <div className="chip chip-violet mono ml-auto">
              <Sparkles size={11} /> {selectedAdapter?.label ?? selected}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {TASKS.map((task) => (
              <button key={task} className="chip cursor-pointer hover:border-violet/40 hover:text-[var(--violet-2)]" onClick={() => setPrompt(task)}>
                {task}
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-2">
          <section className="flex min-h-0 flex-col border-r border-[var(--border)] p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Bot size={15} /> Prompt
            </div>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="min-h-0 flex-1 resize-none rounded-lg border border-[var(--border)] bg-[#0d0d12] p-4 text-sm leading-6 text-[var(--text-2)] outline-none focus:border-violet/40"
            />
            <div className="mt-3 flex gap-2">
              <Button variant="primary" onClick={() => void run()} disabled={running || !prompt.trim()}>
                <Play size={14} /> {running ? "Running" : "Run CLI"}
              </Button>
              <Button variant="ghost" onClick={() => void saveOutput()} disabled={!output}>
                <Save size={14} /> Save as note
              </Button>
            </div>
          </section>

          <section className="flex min-h-0 flex-col p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Terminal size={15} /> Output
              {result && <span className="mono ml-auto text-[10px] text-[var(--text-4)]">{result.elapsedMs}ms / exit {result.exitCode}</span>}
            </div>
            {error && <div className="mb-3 rounded-lg border border-red-400/25 bg-red-500/5 px-3 py-2 text-xs text-[var(--danger)]">{error}</div>}
            <pre className="min-h-0 flex-1 overflow-auto rounded-lg border border-[var(--border)] bg-[#050507] p-4 text-xs leading-5 text-[var(--text-2)]">
              {running ? "Running provider CLI..." : output || "Run a provider to see stdout/stderr here."}
            </pre>
          </section>
        </div>
      </main>
    </div>
  );
}
