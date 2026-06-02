import { AlertTriangle, Circle, Database, FileText, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { PluginElementView } from "@/components/plugins/PluginElementView";
import { useIndexingStatus } from "@/features/indexing/useIndexingStatus";
import { usePluginUIStore, type PluginStatusContribution } from "@/stores/plugin-ui-store";
import { useVaultStore } from "@/stores/vault-store";

export function StatusBar() {
  const activeNote = useVaultStore((state) => state.activeNote);
  const saving = useVaultStore((state) => state.saving);
  const lastSavedAt = useVaultStore((state) => state.lastSavedAt);
  const vault = useVaultStore((state) => state.vault);
  const pluginStatusItems = usePluginUIStore((state) => state.statusItems);
  const { status: indexStatus, rebuild } = useIndexingStatus(vault?.path);

  return (
    <footer className="flex h-[26px] items-center gap-4 border-t border-[var(--border)] bg-[#08080c] px-3 text-[11px] text-[var(--text-3)]">
      <span className="mono flex items-center gap-1.5">
        <Circle size={8} className={saving ? "fill-[var(--warning)] text-[var(--warning)]" : "fill-[var(--success)] text-[var(--success)]"} />
        {saving ? "SAVING" : "SAVED"}
      </span>
      <span className="mono flex items-center gap-1.5">
        <FileText size={12} />
        {activeNote?.wordCount ?? 0} words
      </span>
      <IndexingIndicator status={indexStatus} onRebuild={rebuild} fallbackPercent={vault?.indexedPercent ?? 0} />
      {pluginStatusItems.map((item) => (
        <PluginStatusEntry key={item.id} item={item} />
      ))}
      <span className="mono ml-auto">{lastSavedAt ? `last save ${new Date(lastSavedAt).toLocaleTimeString()}` : "LATTICE v0.1.0"}</span>
    </footer>
  );
}

function IndexingIndicator({
  status,
  onRebuild,
  fallbackPercent,
}: {
  status: import("@/types/domain").IndexStatus | null;
  onRebuild: () => void;
  fallbackPercent: number;
}) {
  const phase = status?.phase ?? "idle";
  const active = phase === "scanning" || phase === "indexing";
  const failed = phase === "failed";
  const stale = status?.stale ?? false;

  if (active) {
    const total = status?.total ?? 0;
    const processed = status?.processed ?? 0;
    const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
    return (
      <span className="mono flex items-center gap-1.5 text-[var(--text-2)]" title={status?.message ?? "Indexing"}>
        <Loader2 size={12} className="animate-spin" />
        Indexing {total > 0 ? `${processed}/${total} (${pct}%)` : "…"}
      </span>
    );
  }

  if (failed) {
    return (
      <button
        type="button"
        onClick={onRebuild}
        className="mono flex items-center gap-1.5 text-[var(--danger)] hover:underline"
        title={status?.error ?? "Indexing failed — click to rebuild"}
      >
        <AlertTriangle size={12} />
        Index error — rebuild
      </button>
    );
  }

  if (stale) {
    return (
      <button
        type="button"
        onClick={onRebuild}
        className="mono flex items-center gap-1.5 text-[var(--warning)] hover:underline"
        title="Index may be out of date — click to rebuild"
      >
        <AlertTriangle size={12} />
        Index stale — rebuild
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onRebuild}
      className="mono flex items-center gap-1.5 hover:text-[var(--text-2)]"
      title="Index up to date — click to rebuild"
    >
      <Database size={12} />
      {status?.lastSummary ? "Indexed" : `${fallbackPercent}% indexed`}
    </button>
  );
}

function PluginStatusEntry({ item }: { item: PluginStatusContribution }) {
  const hostRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !item.containerEl) return;
    host.replaceChildren(item.containerEl);
    return () => {
      if (host.contains(item.containerEl!)) host.removeChild(item.containerEl!);
    };
  }, [item.containerEl]);

  return (
    <span className="mono flex min-w-0 items-center gap-1.5 border-l border-[var(--border)] pl-3">
      {item.containerEl ? <span ref={hostRef} /> : item.element ? <PluginElementView element={item.element} /> : item.text}
    </span>
  );
}
