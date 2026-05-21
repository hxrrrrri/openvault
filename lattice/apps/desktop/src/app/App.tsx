import { useEffect, useState } from "react";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { CommandBar } from "@/components/layout/CommandBar";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { SidebarRail } from "@/components/layout/SidebarRail";
import { StatusBar } from "@/components/layout/StatusBar";
import { MobilePreview } from "@/components/mobile/MobilePreview";
import { LoadingState } from "@/components/ui/LoadingState";
import { OnboardingScreen } from "@/features/onboarding/OnboardingScreen";
import { Routes } from "@/app/routes";
import { useGlobalShortcuts } from "@/app/shortcuts";
import { PagePreview } from "@/features/core-plugins/page-preview/PagePreview";
import { useGraphStore } from "@/stores/graph-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUIStore } from "@/stores/ui-store";
import { useVaultStore } from "@/stores/vault-store";

export function App() {
  const vault = useVaultStore((state) => state.vault);
  const initialized = useVaultStore((state) => state.initialized);
  const initialize = useVaultStore((state) => state.initialize);
  const refreshFiles = useVaultStore((state) => state.refreshFiles);
  const vaultError = useVaultStore((state) => state.error);
  const loadGraph = useGraphStore((state) => state.loadGraph);
  const view = useUIStore((state) => state.view);
  const paletteOpen = useUIStore((state) => state.paletteOpen);
  const leftOpen = useUIStore((state) => state.leftOpen);
  const rightOpen = useUIStore((state) => state.rightOpen);
  const mobilePreview = useUIStore((state) => state.mobilePreview);
  const setPaletteOpen = useUIStore((state) => state.setPaletteOpen);
  const setLeftOpen = useUIStore((state) => state.setLeftOpen);
  const setRightOpen = useUIStore((state) => state.setRightOpen);
  const appearance = useSettingsStore((state) => state.appearance);
  const [leftWidth, setLeftWidth] = useState(270);
  const [rightWidth, setRightWidth] = useState(330);

  useGlobalShortcuts();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    document.body.style.setProperty("zoom", `${appearance.uiScale}%`);
    const accent = accentTokens(appearance.accent);
    document.documentElement.style.setProperty("--violet", accent.primary);
    document.documentElement.style.setProperty("--violet-2", accent.secondary);
    document.documentElement.style.setProperty("--violet-deep", accent.deep);
  }, [appearance.accent, appearance.uiScale]);

  useEffect(() => {
    if (!vault) return;
    void refreshFiles();
    void loadGraph();
  }, [loadGraph, refreshFiles, vault]);

  if (!initialized) {
    return <LoadingState label="Opening local vault" />;
  }

  if (!vault) {
    return <OnboardingScreen onEnter={() => void initialize()} error={vaultError} />;
  }

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <CommandBar vault={vault} />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {mobilePreview ? (
          <MobilePreview />
        ) : (
          <>
            {leftOpen ? (
              <LeftSidebar
                width={leftWidth}
                onResize={(delta) => setLeftWidth((width) => clamp(width + delta, 220, 420))}
              />
            ) : (
              <SidebarRail side="left" onClick={() => setLeftOpen(true)} />
            )}

            <main className="relative z-20 flex min-w-0 flex-1 flex-col overflow-hidden">
              <Routes view={view} />
            </main>

            {view === "workspace" &&
              (rightOpen ? (
                <RightSidebar
                  width={rightWidth}
                  onResize={(delta) => setRightWidth((width) => clamp(width - delta, 260, 520))}
                />
              ) : (
                <SidebarRail side="right" onClick={() => setRightOpen(true)} />
              ))}
          </>
        )}
      </div>

      {!mobilePreview && <StatusBar />}
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      <PagePreview />
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function accentTokens(accent: "violet" | "indigo" | "emerald" | "amber") {
  const tokens = {
    violet: { primary: "#8b7cff", secondary: "#a99bff", deep: "#4b36b8" },
    indigo: { primary: "#6d8dff", secondary: "#9ab0ff", deep: "#3656b8" },
    emerald: { primary: "#35d49a", secondary: "#78e8bd", deep: "#137a58" },
    amber: { primary: "#ffb45e", secondary: "#ffd19a", deep: "#a86213" },
  };
  return tokens[accent];
}
