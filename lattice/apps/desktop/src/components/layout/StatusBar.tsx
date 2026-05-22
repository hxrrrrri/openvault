import { Circle, Database, FileText } from "lucide-react";
import { PluginElementView } from "@/components/plugins/PluginElementView";
import { usePluginUIStore } from "@/stores/plugin-ui-store";
import { useVaultStore } from "@/stores/vault-store";

export function StatusBar() {
  const activeNote = useVaultStore((state) => state.activeNote);
  const saving = useVaultStore((state) => state.saving);
  const lastSavedAt = useVaultStore((state) => state.lastSavedAt);
  const vault = useVaultStore((state) => state.vault);
  const pluginStatusItems = usePluginUIStore((state) => state.statusItems);

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
      <span className="mono flex items-center gap-1.5">
        <Database size={12} />
        {vault?.indexedPercent ?? 0}% indexed
      </span>
      {pluginStatusItems.map((item) => (
        <span key={item.id} className="mono flex min-w-0 items-center gap-1.5 border-l border-[var(--border)] pl-3">
          {item.element ? <PluginElementView element={item.element} /> : item.text}
        </span>
      ))}
      <span className="mono ml-auto">{lastSavedAt ? `last save ${new Date(lastSavedAt).toLocaleTimeString()}` : "LATTICE v0.1.0"}</span>
    </footer>
  );
}
