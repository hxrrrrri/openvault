import { Puzzle } from "lucide-react";
import { useEffect, useRef } from "react";
import { PluginElementView } from "@/components/plugins/PluginElementView";
import { GlowCard } from "@/components/ui/GlowCard";
import { usePluginUIStore, type PluginSettingContribution } from "@/stores/plugin-ui-store";

export function PluginSettingsContributions() {
  const tabs = usePluginUIStore((state) => state.settingTabs);

  if (tabs.length === 0) {
    return (
      <GlowCard className="p-5">
        <div className="pixel-label text-[10px]">Plugin settings</div>
        <p className="mt-3 text-sm leading-6 text-[var(--text-3)]">
          Enabled plugins that register a settings tab will appear here so you can configure them inside Lattice.
        </p>
      </GlowCard>
    );
  }

  return (
    <div className="grid max-w-5xl grid-cols-1 gap-4">
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
          <PluginSettingTabBody tab={tab} />
        </GlowCard>
      ))}
    </div>
  );
}

function PluginSettingTabBody({ tab }: { tab: PluginSettingContribution }) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !tab.containerEl) return;
    host.replaceChildren(tab.containerEl);
    return () => {
      if (host.contains(tab.containerEl!)) host.removeChild(tab.containerEl!);
    };
  }, [tab.containerEl]);

  if (tab.containerEl) {
    return <div ref={hostRef} className="plugin-rendered-settings lattice-plugin-settings-host" />;
  }
  return (
    <div className="plugin-rendered-settings">
      <PluginElementView element={tab.element} />
    </div>
  );
}
