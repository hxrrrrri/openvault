import { create } from "zustand";
import type { GraphFilters, GraphPayload } from "@/types/domain";
import type { LabelMode } from "@/stores/settings-store";
import { commands } from "@/lib/commands";

type GraphMode = "global" | "local";

interface GraphState {
  graph: GraphPayload;
  mode: GraphMode;
  labelMode: LabelMode;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  filters: GraphFilters;
  loadGraph: () => Promise<void>;
  loadLocalGraph: (path: string) => Promise<void>;
  setMode: (mode: GraphMode) => void;
  setLabelMode: (mode: LabelMode) => void;
  setSelectedNodeId: (id: string | null) => void;
  setHoveredNodeId: (id: string | null) => void;
  setFilters: (filters: GraphFilters) => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  graph: { nodes: [], edges: [] },
  mode: "global",
  labelMode: "auto",
  selectedNodeId: null,
  hoveredNodeId: null,
  filters: { includeOrphans: true, depth: 2 },
  async loadGraph() {
    const graph = await commands.getGlobalGraph(get().filters).catch(() => ({ nodes: [], edges: [] }));
    const current = get().selectedNodeId;
    set({ graph, selectedNodeId: graph.nodes.some((node) => node.id === current) ? current : null });
  },
  async loadLocalGraph(path) {
    const graph = await commands.getLocalGraph(path, get().filters.depth ?? 2).catch(() => ({ nodes: [], edges: [] }));
    const current = get().selectedNodeId;
    set({ graph, selectedNodeId: graph.nodes.some((node) => node.id === current) ? current : null });
  },
  setMode: (mode) => set({ mode }),
  setLabelMode: (labelMode) => set({ labelMode }),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  setHoveredNodeId: (hoveredNodeId) => set({ hoveredNodeId }),
  setFilters: (filters) => set({ filters }),
}));
