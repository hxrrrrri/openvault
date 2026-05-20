import { Eye, GitBranch, RotateCcw, Tag } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { useSettingsStore } from "@/stores/settings-store";
import { useGraphStore } from "@/stores/graph-store";
import { useUIStore } from "@/stores/ui-store";
import { useVaultStore } from "@/stores/vault-store";

export function GraphView() {
  const graph = useGraphStore((state) => state.graph);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const hoveredNodeId = useGraphStore((state) => state.hoveredNodeId);
  const filters = useGraphStore((state) => state.filters);
  const graphMode = useGraphStore((state) => state.mode);
  const labelMode = useGraphStore((state) => state.labelMode);
  const loadGraph = useGraphStore((state) => state.loadGraph);
  const loadLocalGraph = useGraphStore((state) => state.loadLocalGraph);
  const setGraphMode = useGraphStore((state) => state.setMode);
  const setLabelMode = useGraphStore((state) => state.setLabelMode);
  const setSelectedNodeId = useGraphStore((state) => state.setSelectedNodeId);
  const setHoveredNodeId = useGraphStore((state) => state.setHoveredNodeId);
  const setFilters = useGraphStore((state) => state.setFilters);
  const setGraphSettings = useSettingsStore((state) => state.setGraph);
  const setActivePath = useVaultStore((state) => state.setActivePath);
  const activeNote = useVaultStore((state) => state.activeNote);
  const setView = useUIStore((state) => state.setView);
  const selected = graph.nodes.find((node) => node.id === selectedNodeId) ?? graph.nodes[0];
  const tags = useMemo(() => Array.from(new Set(graph.nodes.flatMap((node) => node.tags))).sort(), [graph.nodes]);

  useEffect(() => {
    if (graphMode === "local" && activeNote) {
      void loadLocalGraph(activeNote.path);
    } else {
      void loadGraph();
    }
  }, [activeNote?.path, filters, graphMode, loadGraph, loadLocalGraph]);

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[radial-gradient(ellipse_at_center,#0a0a14_0%,#050507_80%)]">
      <aside className="w-64 shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[#08080c]/60 p-4 backdrop-blur-xl">
        <div className="pixel-label mb-3 text-[10px]">Graph filters</div>
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3 text-xs text-[var(--text-2)]">
            Show orphan notes
            <button className={`toggle ${filters.includeOrphans !== false ? "on" : ""}`} onClick={() => setFilters({ ...filters, includeOrphans: filters.includeOrphans === false })} />
          </label>
          <label className="block text-xs text-[var(--text-2)]">
            <span className="mb-2 flex items-center justify-between">
              Link depth <span className="mono text-[var(--violet-2)]">{filters.depth ?? 2}</span>
            </span>
            <input
              type="range"
              min={1}
              max={5}
              value={filters.depth ?? 2}
              onChange={(event) => setFilters({ ...filters, depth: Number(event.target.value) })}
              className="w-full accent-[#8B7CFF]"
            />
          </label>
        </div>

        <div className="divider my-4" />
        <div className="pixel-label mb-3 text-[10px]">Cluster legend</div>
        <div className="space-y-2 text-xs text-[var(--text-2)]">
          <Legend color="#ffffff" label="Active node" />
          <Legend color="#A99BFF" label="Linked note" />
          <Legend color="#8eaaff" label="Semantic similarity" />
          <Legend color="#5d5d70" label="Orphan note" />
        </div>

        <div className="pixel-label mb-3 mt-5 flex items-center gap-2 text-[10px]">
          <Tag size={12} /> Filter by tag
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 9).map((tag) => (
            <button
              key={tag}
              className={`chip mono cursor-pointer px-2 py-0.5 text-[10px] hover:border-violet/40 hover:text-[var(--violet-2)] ${(filters.tags ?? []).includes(tag) ? "chip-violet" : ""}`}
              onClick={() => {
                const current = filters.tags ?? [];
                const tags = current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag];
                setFilters({ ...filters, tags });
              }}
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="divider my-4" />
        <div className="pixel-label mb-3 text-[10px]">Node inspector</div>
        {selected && (
          <div className="card p-3">
            <div className="flex items-center gap-2">
              <span className="pulse size-2.5 rounded-full bg-white shadow-[0_0_10px_#fff]" />
              <span className="text-xs font-semibold">{selected.title}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric label="Links" value={selected.degree} />
              <Metric label="Tags" value={selected.tags.length} />
            </div>
            <Button
              variant="primary"
              className="mt-3 w-full py-1.5 text-xs"
              onClick={() => {
                void setActivePath(selected.path);
                setView("workspace");
              }}
            >
              Open in editor
            </Button>
          </div>
        )}
      </aside>

      <div className="relative min-w-0 flex-1">
        <GraphCanvas
          graph={graph}
          selectedId={selectedNodeId}
          hoveredId={hoveredNodeId}
          filters={filters}
          labelMode={labelMode}
          onSelect={setSelectedNodeId}
          onHover={setHoveredNodeId}
          onOpenNode={(path) => {
            void setActivePath(path);
            setView("workspace");
          }}
        />
        <div className="pointer-events-none absolute right-4 top-4 text-right">
          <div className="pixel-label text-[10px]">Vault constellation</div>
          <div className="mt-1 text-base font-semibold">Global graph - {graph.nodes.length} nodes</div>
        </div>
        <div className="absolute left-4 top-4 flex gap-2">
          <Button
            variant="ghost"
            className="bg-black/20 text-xs"
            onClick={() => {
              if (graphMode === "local" && activeNote) void loadLocalGraph(activeNote.path);
              else void loadGraph();
            }}
          >
            <RotateCcw size={13} /> Refresh
          </Button>
          <Button
            variant={labelMode !== "auto" ? "primary" : "ghost"}
            className="bg-black/20 text-xs"
            onClick={() => {
              const next = labelMode === "auto" ? "all" : labelMode === "all" ? "none" : "auto";
              setLabelMode(next);
              setGraphSettings({ labelMode: next });
            }}
          >
            <Eye size={13} /> Labels {labelMode}
          </Button>
          <Button
            variant={graphMode === "local" ? "primary" : "ghost"}
            className="bg-black/20 text-xs"
            onClick={() => {
              const next = graphMode === "local" ? "global" : "local";
              setGraphMode(next);
              if (next === "local" && activeNote) void loadLocalGraph(activeNote.path);
              else void loadGraph();
            }}
          >
            <GitBranch size={13} /> {graphMode === "local" ? "Global graph" : "Local graph"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}80` }} />
      {label}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-inner p-2">
      <div className="pixel-label text-[9px]">{label}</div>
      <div className="mono mt-1 text-lg text-[var(--violet-2)]">{value}</div>
    </div>
  );
}
