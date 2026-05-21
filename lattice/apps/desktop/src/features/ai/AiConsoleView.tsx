import "@xterm/xterm/css/xterm.css";

import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Loader2,
  Plus,
  Power,
  RefreshCcw,
  Terminal as TerminalIcon,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import { Button } from "@/components/ui/Button";
import { commands } from "@/lib/commands";
import { listenTerminalExit, listenTerminalOutput } from "@/lib/events";
import { useVaultStore } from "@/stores/vault-store";
import type {
  TerminalAdapterStatus,
  TerminalSessionInfo,
} from "@/types/domain";

const XTERM_THEME = {
  background: "#07070b",
  foreground: "#ececf4",
  cursor: "#a99bff",
  cursorAccent: "#050507",
  selectionBackground: "rgba(139,124,255,0.28)",
  black: "#0a0a0f",
  brightBlack: "#5d5d70",
  red: "#ff4d5e",
  brightRed: "#ff7a8a",
  green: "#65f2a8",
  brightGreen: "#9af7c7",
  yellow: "#ffb45e",
  brightYellow: "#ffd19a",
  blue: "#6d8dff",
  brightBlue: "#8eaaff",
  magenta: "#8b7cff",
  brightMagenta: "#a99bff",
  cyan: "#7ee0e0",
  brightCyan: "#b6f0f0",
  white: "#b7b7c6",
  brightWhite: "#ececf4",
};

const LAST_CLI_KEY = "lattice.terminalCli";

function b64ToBytes(b64: string): Uint8Array {
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

function truncate(label: string, max = 18) {
  return label.length > max ? `${label.slice(0, max - 1)}...` : label;
}

export function AiConsoleView() {
  const [open, setOpen] = useState(true);
  const [selectedCli, setSelectedCli] = useState("shell");
  const [adapters, setAdapters] = useState<TerminalAdapterStatus[]>([]);
  const [loadingAdapters, setLoadingAdapters] = useState(true);
  const [sessions, setSessions] = useState<TerminalSessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);
  const [adapterWidth, setAdapterWidth] = useState(280);
  const [isPending, startTransition] = useTransition();
  const vault = useVaultStore((state) => state.vault);

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    let resizeObserver: ResizeObserver | undefined;

    void (async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      if (disposed || !containerRef.current) return;

      const term = new Terminal({
        theme: XTERM_THEME,
        fontFamily:
          '"Cascadia Mono", "Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace',
        fontSize: 14,
        lineHeight: 1,
        letterSpacing: 0,
        cursorBlink: true,
        cursorStyle: "bar",
        scrollback: 10000,
        convertEol: false,
        allowTransparency: false,
        cols: 120,
        rows: 32,
      });

      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);
      fit.fit();

      termRef.current = term;
      fitRef.current = fit;
      setTerminalReady(true);

      term.onData((data) => {
        const sessionId = activeSessionIdRef.current;
        if (!sessionId) return;
        void commands.writeTerminalInput(sessionId, data).catch(() => {});
      });

      let resizeTimer: number | null = null;
      const pushResize = () => {
        const sessionId = activeSessionIdRef.current;
        if (!sessionId) return;
        void commands
          .resizeTerminalSession({
            sessionId,
            cols: term.cols,
            rows: term.rows,
          })
          .catch(() => {});
      };

      term.onResize(() => {
        if (resizeTimer) window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(pushResize, 80);
      });

      resizeObserver = new ResizeObserver(() => {
        try {
          fit.fit();
        } catch {}
      });
      resizeObserver.observe(containerRef.current);
    })();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      termRef.current?.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  const syncActiveSize = useCallback((sessionId: string) => {
    const term = termRef.current;
    if (!term) return;
    try {
      fitRef.current?.fit();
    } catch {}
    void commands
      .resizeTerminalSession({ sessionId, cols: term.cols, rows: term.rows })
      .catch(() => {});
  }, []);

  const loadTerminalState = useCallback(async () => {
    setLoadingAdapters(true);
    setErrorMsg(null);
    try {
      const [nextAdapters, nextSessions] = await Promise.all([
        commands.listTerminalAdapters(),
        commands.listTerminalSessions(),
      ]);
      setAdapters(nextAdapters);
      setSessions(nextSessions);

      const lastCli = window.localStorage.getItem(LAST_CLI_KEY);
      const preferred =
        nextAdapters.find((adapter) => adapter.id === lastCli) ??
        nextAdapters.find((adapter) => adapter.id === "shell") ??
        nextAdapters.find((adapter) => adapter.available) ??
        nextAdapters[0];
      if (preferred) setSelectedCli(preferred.id);
      if (nextSessions[0]) setActiveSessionId(nextSessions[0].id);
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Could not load terminal adapters",
      );
    } finally {
      setLoadingAdapters(false);
    }
  }, []);

  useEffect(() => {
    void loadTerminalState();
  }, [loadTerminalState]);

  useEffect(() => {
    let disposed = false;
    let unlistenOutput: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;

    void (async () => {
      unlistenOutput = await listenTerminalOutput((event) => {
        if (disposed) return;
        setSessions((current) =>
          current.map((session) =>
            session.id === event.sessionId
              ? { ...session, historySize: session.historySize + 1 }
              : session,
          ),
        );
        if (activeSessionIdRef.current === event.sessionId) {
          termRef.current?.write(b64ToBytes(event.chunk));
        }
      });
      unlistenExit = await listenTerminalExit((event) => {
        if (disposed) return;
        setSessions((current) =>
          current.map((session) =>
            session.id === event.sessionId
              ? { ...session, alive: false }
              : session,
          ),
        );
      });
    })();

    return () => {
      disposed = true;
      unlistenOutput?.();
      unlistenExit?.();
    };
  }, []);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
    if (!terminalReady) return;
    const term = termRef.current;
    if (!term) return;

    term.reset();
    if (!activeSessionId) {
      term.writeln(
        "\x1b[2mSelect a CLI and click + to start a terminal.\x1b[0m",
      );
      return;
    }

    syncActiveSize(activeSessionId);
    let cancelled = false;
    void commands
      .getTerminalHistory(activeSessionId)
      .then((history) => {
        if (cancelled || activeSessionIdRef.current !== activeSessionId) return;
        term.reset();
        for (const chunk of history) {
          term.write(b64ToBytes(chunk));
        }
        window.setTimeout(() => {
          try {
            term.focus();
          } catch {}
        }, 20);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeSessionId, syncActiveSize, terminalReady]);

  const pickCli = useCallback((id: string) => {
    setSelectedCli(id);
    try {
      window.localStorage.setItem(LAST_CLI_KEY, id);
    } catch {}
  }, []);

  const startSession = useCallback(() => {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const term = termRef.current;
        try {
          fitRef.current?.fit();
        } catch {}
        const session = await commands.startTerminalSession({
          cliId: selectedCli,
          cols: term?.cols,
          rows: term?.rows,
        });
        setSessions((current) => [...current, session]);
        setActiveSessionId(session.id);
        setOpen(true);
        window.setTimeout(() => termRef.current?.focus(), 100);
      } catch (error) {
        setErrorMsg(
          error instanceof Error ? error.message : "Failed to start terminal",
        );
      }
    });
  }, [selectedCli, startTransition]);

  const killSession = useCallback((sessionId: string) => {
    void commands.killTerminalSession(sessionId).catch(() => {});
    setSessions((current) => {
      const remaining = current.filter((session) => session.id !== sessionId);
      if (activeSessionIdRef.current === sessionId) {
        setActiveSessionId(remaining.at(-1)?.id ?? null);
      }
      return remaining;
    });
  }, []);

  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? null;
  const activeLabel =
    activeSession?.cliLabel ??
    adapters.find((adapter) => adapter.id === selectedCli)?.label ??
    "Terminal";
  const activeAdapterMissing = adapters.find(
    (adapter) => adapter.id === selectedCli && !adapter.available,
  );

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-gradient-to-b from-[#0a0a0e] to-[#07070b] text-[var(--text-2)]">
      <aside
        className="relative flex shrink-0 flex-col overflow-hidden bg-[#08080c]/76 shadow-[inset_-1px_0_0_rgba(139,124,255,0.08)] backdrop-blur-xl"
        style={{ width: adapterWidth }}
      >
        <ResizeHandle
          label="Resize terminal sidebar"
          onResize={(delta) => setAdapterWidth((width) => clamp(width + delta, 220, 420))}
        />
        <div className="px-4 py-4 shadow-[inset_0_-1px_0_rgba(139,124,255,0.08)]">
          <div className="flex items-start gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-[rgba(139,124,255,0.13)] text-[var(--violet-2)] shadow-[inset_0_1px_0_rgba(169,155,255,0.05),0_10px_28px_-18px_rgba(139,124,255,0.9)]">
              <TerminalIcon size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="pixel-label text-[10px]">Terminal</div>
              <div className="mt-0.5 truncate text-xs font-semibold text-[var(--text)]" title={vault?.path}>
                {vault?.name ?? "Vault"}
              </div>
            </div>
            <Button
              variant="ghost"
              className="border-transparent bg-white/[0.025] px-1.5 py-1 text-[11px] text-[var(--text-3)] hover:bg-violet/10 hover:text-[var(--violet-2)]"
              onClick={() => void loadTerminalState()}
              title="Reload adapters and sessions"
            >
              <RefreshCcw size={12} />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="pixel-label mb-2 text-[10px]">CLI adapters</div>
          <div className="space-y-1.5">
            {adapters.map((adapter) => (
              <button
                key={adapter.id}
                className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                  selectedCli === adapter.id
                    ? "bg-[rgba(139,124,255,0.12)] text-[var(--text)] shadow-[inset_2px_0_0_rgba(169,155,255,0.85),0_12px_24px_-22px_rgba(139,124,255,0.9)]"
                    : "bg-white/[0.025] text-[var(--text-2)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.035)] hover:bg-[rgba(139,124,255,0.07)] hover:text-[var(--text)]"
                }`}
                onClick={() => pickCli(adapter.id)}
                title={adapter.available ? adapter.command : adapter.installHint}
              >
                {adapter.available ? (
                  <CheckCircle2 size={13} className="text-[var(--success)]" />
                ) : (
                  <XCircle size={13} className="text-[var(--warning)]" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.06em]">
                    {adapter.label}
                  </span>
                  <span className="mono block truncate text-[10px] text-[var(--text-4)]">
                    {adapter.command}
                  </span>
                </span>
              </button>
            ))}
            {!adapters.length && !loadingAdapters && (
              <div className="rounded-lg bg-white/[0.02] px-3 py-4 text-center text-[11px] text-[var(--text-3)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.06)]">
                No CLI adapters detected.
              </div>
            )}
          </div>
        </div>

        <div className="p-3 shadow-[inset_0_1px_0_rgba(139,124,255,0.08)]">
          <Button
            variant="primary"
            className="w-full justify-center gap-1.5 border-transparent text-xs"
            onClick={startSession}
            disabled={isPending || loadingAdapters}
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}
            Start selected CLI
          </Button>
          {errorMsg ? (
            <div className="mt-2 rounded-lg bg-red-500/5 px-2.5 py-2 text-[11px] text-[var(--danger)] shadow-[inset_2px_0_0_rgba(255,77,94,0.45)]">
              {errorMsg}
            </div>
          ) : null}
          {activeAdapterMissing ? (
            <div className="mt-2 rounded-lg bg-amber-400/5 px-2.5 py-2 text-[11px] text-[var(--warning)] shadow-[inset_2px_0_0_rgba(255,180,94,0.45)]">
              {activeAdapterMissing.installHint}
            </div>
          ) : null}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-[42px] items-center gap-2 bg-[#08080c]/70 px-3 shadow-[inset_0_-1px_0_rgba(139,124,255,0.08)] backdrop-blur-xl">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <div className="flex max-w-[58vw] items-center gap-1 overflow-x-auto pb-px">
              {sessions.length ? (
                sessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  return (
                    <div
                      key={session.id}
                      className={`group flex h-7 shrink-0 items-center gap-2 rounded-lg px-2.5 text-[11px] transition ${
                        isActive
                          ? "bg-[rgba(139,124,255,0.12)] text-[var(--text)] shadow-[inset_0_-2px_0_rgba(169,155,255,0.75)]"
                          : "bg-white/[0.025] text-[var(--text-3)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.035)] hover:bg-[rgba(139,124,255,0.07)] hover:text-[var(--text-2)]"
                      }`}
                      title={session.cliLabel}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveSessionId(session.id)}
                        className="flex min-w-0 items-center gap-2"
                      >
                        <TerminalIcon size={11} className="shrink-0 text-[var(--violet-2)]" />
                        <span
                          className={`pulse inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                            session.alive
                              ? "bg-[var(--success)] shadow-[0_0_6px_#65F2A8]"
                              : "bg-[var(--text-4)]"
                          }`}
                        />
                        <span className="truncate">{truncate(session.cliLabel)}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Close ${session.cliLabel}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          killSession(session.id);
                        }}
                        className="text-[var(--text-4)] transition hover:text-[var(--danger)]"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="flex h-7 items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 text-[11px] text-[var(--text-3)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.04)]">
                  <TerminalIcon size={11} />
                  no sessions
                </div>
              )}
            </div>

            <select
              value={selectedCli}
              onChange={(event) => pickCli(event.target.value)}
              disabled={loadingAdapters}
              title="Choose provider for the next terminal tab"
              className="mono h-7 shrink-0 rounded-lg border-transparent bg-white/[0.035] px-2 text-[10px] uppercase tracking-[0.08em] text-[var(--text-2)] outline-none shadow-[inset_0_0_0_1px_rgba(139,124,255,0.04)] transition hover:bg-[rgba(139,124,255,0.07)] focus:bg-violet/10"
            >
              {adapters.map((adapter) => (
                <option key={adapter.id} value={adapter.id}>
                  {adapter.available ? adapter.label : `${adapter.label} (missing)`}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={startSession}
              disabled={isPending || loadingAdapters}
              aria-label="New terminal"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgba(139,124,255,0.12)] text-[var(--violet-2)] shadow-[0_10px_24px_-18px_rgba(139,124,255,0.9),inset_0_0_0_1px_rgba(169,155,255,0.08)] transition hover:bg-violet/20 hover:text-white disabled:cursor-wait disabled:opacity-40"
              title="Start a new terminal with the selected provider"
            >
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={13} />}
            </button>
          </div>

          {activeSession && (
            <div className="hidden items-center gap-2 rounded-full bg-white/[0.025] px-3 py-1 text-[10px] text-[var(--text-3)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.04)] md:flex">
              <span
                className={`size-1.5 rounded-full ${activeSession.alive ? "bg-[var(--success)] shadow-[0_0_6px_#65F2A8]" : "bg-[var(--text-4)]"}`}
              />
              <span className="mono uppercase tracking-[0.1em]">{activeLabel}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.025] text-[var(--text-3)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.035)] transition hover:bg-[rgba(139,124,255,0.08)] hover:text-[var(--violet-2)]"
            aria-label={open ? "Collapse terminal" : "Expand terminal"}
          >
            {open ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
        </div>

        <div
          className="min-h-0 flex-1 overflow-hidden transition-[height] duration-200"
          style={{ height: open ? "100%" : "0px" }}
        >
          <div
            ref={containerRef}
            className="h-full w-full px-3 pb-3 pt-3"
            style={{
              background:
                "radial-gradient(120% 80% at 50% 0%, rgba(139,124,255,0.06), transparent 60%), #07070b",
            }}
          />
        </div>

        {!open && (
          <div className="bg-[#08080c]/60 px-3 py-2 text-[11px] text-[var(--text-3)] shadow-[inset_0_1px_0_rgba(139,124,255,0.08)]">
            Terminal collapsed - click the chevron above to expand.
          </div>
        )}
      </main>
    </div>
  );
}

function ResizeHandle({
  label,
  onResize,
}: {
  label: string;
  onResize: (deltaX: number) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="absolute right-0 top-0 z-20 h-full w-2 cursor-col-resize bg-transparent transition hover:bg-violet/20"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        let lastX = event.clientX;
        const move = (moveEvent: PointerEvent) => {
          onResize(moveEvent.clientX - lastX);
          lastX = moveEvent.clientX;
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up, { once: true });
      }}
    />
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
