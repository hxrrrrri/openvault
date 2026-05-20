import { lazy, Suspense } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import type { WorkspaceView } from "@/types/domain";

const EditorWorkspace = lazy(() => import("@/components/editor/EditorWorkspace").then((mod) => ({ default: mod.EditorWorkspace })));
const CollectionsView = lazy(() => import("@/features/collections/CollectionsView").then((mod) => ({ default: mod.CollectionsView })));
const AiConsoleView = lazy(() => import("@/features/ai/AiConsoleView").then((mod) => ({ default: mod.AiConsoleView })));
const CanvasView = lazy(() => import("@/features/canvas/CanvasView").then((mod) => ({ default: mod.CanvasView })));
const GraphView = lazy(() => import("@/features/graph/GraphView").then((mod) => ({ default: mod.GraphView })));
const PluginMarketplace = lazy(() => import("@/components/plugins/PluginMarketplace").then((mod) => ({ default: mod.PluginMarketplace })));
const SettingsScreen = lazy(() => import("@/components/settings/SettingsScreen").then((mod) => ({ default: mod.SettingsScreen })));
const VaultHealthDashboard = lazy(() => import("@/components/vault-health/VaultHealthDashboard").then((mod) => ({ default: mod.VaultHealthDashboard })));

interface RoutesProps {
  view: WorkspaceView;
}

export function Routes({ view }: RoutesProps) {
  return (
    <Suspense fallback={<LoadingState label="Loading view" />}>
      {view === "graph" && <GraphView />}
      {view === "collections" && <CollectionsView />}
      {view === "ai" && <AiConsoleView />}
      {view === "canvas" && <CanvasView />}
      {view === "health" && <VaultHealthDashboard />}
      {view === "plugins" && <PluginMarketplace />}
      {view === "settings" && <SettingsScreen />}
      {view === "workspace" && <EditorWorkspace />}
    </Suspense>
  );
}
