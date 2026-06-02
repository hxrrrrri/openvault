import { useCallback, useEffect, useState } from "react";
import type { IndexStatus } from "@/types/domain";
import { commands } from "@/lib/commands";
import { isTauriRuntime } from "@/lib/tauri";

/** Event name emitted by the Rust backend on every indexing progress tick. */
export const INDEX_PROGRESS_EVENT = "lattice://index-progress";

/**
 * Track the background indexing job.
 *
 * - Fetches the current status on mount and whenever `vaultPath` changes.
 * - In the desktop app, subscribes to `lattice://index-progress` events so the
 *   indicator updates live during a reindex.
 * - Falls back to a short poll while a job is active (also covers browser mode).
 */
export function useIndexingStatus(vaultPath: string | undefined) {
  const [status, setStatus] = useState<IndexStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await commands.getIndexingStatus());
    } catch {
      // Backend not ready yet; ignore.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, vaultPath]);

  // Live updates via Tauri events.
  useEffect(() => {
    if (!isTauriRuntime()) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const stop = await listen<IndexStatus>(INDEX_PROGRESS_EVENT, (event) => {
        setStatus(event.payload);
      });
      if (cancelled) stop();
      else unlisten = stop;
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // Poll while a job is active (covers browser mode and missed events).
  useEffect(() => {
    const active = status?.phase === "scanning" || status?.phase === "indexing";
    if (!active) return;
    const id = window.setInterval(() => void refresh(), 1200);
    return () => window.clearInterval(id);
  }, [status?.phase, refresh]);

  const rebuild = useCallback(async () => {
    try {
      await commands.rebuildIndex();
    } finally {
      void refresh();
    }
  }, [refresh]);

  const cancel = useCallback(async () => {
    try {
      await commands.cancelIndexing();
    } finally {
      void refresh();
    }
  }, [refresh]);

  return { status, refresh, rebuild, cancel };
}
