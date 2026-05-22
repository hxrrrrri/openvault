import { Puzzle } from "lucide-react";
import { PluginElementView } from "@/components/plugins/PluginElementView";
import { GlowCard } from "@/components/ui/GlowCard";
import { usePluginUIStore } from "@/stores/plugin-ui-store";

export function PluginSettingsContributions() {
  const tabs = usePluginUIStore((state) => state.settingTabs);

  if (tabs.length === 0) {
    return (
      <GlowCard className="p-5">
        <div className="pixel-label text-[10px]">Runtime settings tabs</div>
        <p className="mt-3 text-sm leading-6 text-[var(--text-3)]">
          Enabled Obsidian plugins that register settings tabs will appear here.
        </p>
      </GlowCard>
    );
  }

  return (
    <div className="grid max-w-5xl grid-cols-1 gap-4 xl:grid-cols-2">
      {tabs.map((tab) => (
        <GlowCard key={tab.id} className="p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet/10 text-[var(--violet-2)]">
              <Puzzle size={16} />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{tab.name}</div>
              <div className="mono mt-0.5 text-[10px] text-[var(--text-4)]">{tab.pluginId}</div>
            </div>
          </div>
          <div className="plugin-rendered-settings">
            <PluginElementView element={tab.element} />
          </div>
        </GlowCard>
      ))}
    </div>
  );
}
