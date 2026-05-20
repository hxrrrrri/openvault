import { BrainCircuit, Check, Code2, Download, Palette, Puzzle, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { GlowCard } from "@/components/ui/GlowCard";
import { commands } from "@/lib/commands";
import type { PermissionGrant, PluginInfo } from "@/types/domain";
import { PermissionModal } from "@/components/plugins/PermissionModal";

const categories = ["All", "Editor", "Query", "Productivity", "AI", "Theme"];

export function PluginMarketplace() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [filter, setFilter] = useState("All");
  const [modalPlugin, setModalPlugin] = useState<PluginInfo | null>(null);

  useEffect(() => {
    void commands.listPlugins().then(setPlugins);
  }, []);

  const visible = plugins.filter((plugin) => filter === "All" || categoryFor(plugin) === filter);

  async function savePermissions(plugin: PluginInfo, grants: PermissionGrant[]) {
    await commands.updatePluginPermissions(plugin.id, grants);
    setPlugins((current) => current.map((item) => (item.id === plugin.id ? { ...item, grantedPermissions: grants } : item)));
  }

  async function installPlugin() {
    const path = window.prompt("Plugin folder path", "C:/path/to/plugin");
    if (!path) return;
    const plugin = await commands.installPluginFromFolder(path);
    setPlugins((current) => [plugin, ...current.filter((item) => item.id !== plugin.id)]);
  }

  async function setPluginEnabled(plugin: PluginInfo, enabled: boolean) {
    if (enabled) await commands.enablePlugin(plugin.id);
    else await commands.disablePlugin(plugin.id);
    setPlugins((current) => current.map((item) => (item.id === plugin.id ? { ...item, enabled } : item)));
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-[#08080c] to-[#050507] px-8 py-7">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="pixel-label text-[11px]">Plugin marketplace</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal">Extend your vault, safely.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-3)]">
            Every plugin declares permissions. LATTICE stores grants separately so access can be reviewed and revoked.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip chip-success mono">
            <Check size={11} /> SANDBOX PLANNED
          </span>
          <Button onClick={() => void installPlugin()}>Install from folder</Button>
        </div>
      </header>

      <section className="gradient-card mb-6 flex min-h-[180px] items-center gap-7 p-7">
        <div className="grid size-28 shrink-0 place-items-center rounded-[22px] border border-white/15 bg-gradient-to-br from-[#1a1530] to-[#0e0e1a] text-[var(--violet-2)] shadow-[0_0_24px_rgba(139,124,255,0.3)]">
          <BrainCircuit size={48} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="pixel-label text-[10px] text-white/70">Local plugins</div>
          <div className="mt-1 flex items-center gap-2">
            <h2 className="text-2xl font-semibold">Install from a folder</h2>
            <span className="chip chip-success mono text-[10px]">OSS</span>
          </div>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">Plugins are loaded from real local manifests. No marketplace data is mocked into a new vault.</p>
        </div>
        <Button variant="primary" onClick={() => void installPlugin()}>
          Install
        </Button>
      </section>

      <div className="mb-5 flex items-center gap-2">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setFilter(category)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              filter === category ? "border-violet/50 bg-violet/15 text-[var(--text)] shadow-[0_0_12px_rgba(139,124,255,0.25)]" : "border-[var(--border)] bg-white/[0.02] text-[var(--text-2)]"
            }`}
          >
            {category}
          </button>
        ))}
        <span className="pixel-label ml-auto text-[10px]">{visible.length} plugins</span>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        {visible.map((plugin) => (
          <PluginCard
            key={plugin.id}
            plugin={plugin}
            onOpenPermissions={() => setModalPlugin(plugin)}
            onToggleEnabled={(enabled) => void setPluginEnabled(plugin, enabled)}
          />
        ))}
      </div>
      {visible.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-3)]">
          No plugins installed in this vault.
        </div>
      )}

      {modalPlugin && (
        <PermissionModal
          plugin={modalPlugin}
          onClose={() => setModalPlugin(null)}
          onSave={(grants) => void savePermissions(modalPlugin, grants)}
        />
      )}
    </div>
  );
}

function PluginCard({ plugin, onOpenPermissions, onToggleEnabled }: { plugin: PluginInfo; onOpenPermissions: () => void; onToggleEnabled: (enabled: boolean) => void }) {
  const grantedCount = plugin.grantedPermissions.filter((grant) => grant.granted).length;
  return (
    <GlowCard className="flex min-h-[210px] flex-col p-5">
      <div className="mb-3 flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-gradient-to-br from-[#1a1530] to-[#0e0e1a] text-[var(--violet-2)]">
          {glyphFor(plugin)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{plugin.name}</h3>
            {plugin.enabled && <Check size={12} className="text-[var(--success)]" />}
          </div>
          <div className="mono mt-0.5 text-[11px] text-[var(--text-3)]">by {plugin.author}</div>
        </div>
        <span className="chip mono text-[10px]">
          <Download size={10} /> local
        </span>
      </div>
      <p className="mb-3 flex-1 text-xs leading-5 text-[var(--text-2)]">{plugin.description}</p>
      <div className="mb-3 flex flex-wrap gap-1">
        {plugin.grantedPermissions.map((grant) => (
          <span key={grant.permission} className={`chip mono text-[9px] ${grant.granted ? "chip-violet" : ""}`}>
            {grant.permission}
          </span>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-[var(--border)] pt-3">
        <span className="chip chip-success mono text-[9px]">OSS</span>
        <span className="chip mono text-[9px]">{grantedCount} grants</span>
        <Button className="py-1.5 text-[11px]" variant={plugin.enabled ? "ghost" : "primary"} onClick={() => onToggleEnabled(!plugin.enabled)}>
          {plugin.enabled ? "Disable" : "Enable"}
        </Button>
        <Button className="ml-auto py-1.5 text-[11px]" onClick={onOpenPermissions}>
          <Shield size={12} /> Permissions
        </Button>
      </div>
    </GlowCard>
  );
}

function categoryFor(plugin: PluginInfo): string {
  if (plugin.id.includes("embedding")) return "AI";
  if (plugin.id.includes("style")) return "Theme";
  return "Productivity";
}

function glyphFor(plugin: PluginInfo) {
  const category = categoryFor(plugin);
  if (category === "AI") return <BrainCircuit size={20} />;
  if (category === "Theme") return <Palette size={20} />;
  if (category === "Query") return <Code2 size={20} />;
  return <Puzzle size={20} />;
}
