import { Maximize, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { useSettingsStore, type LabelMode } from "@/stores/settings-store";
import type { GraphEdge, GraphFilters, GraphNode, GraphPayload } from "@/types/domain";

interface GraphCanvasProps {
  graph: GraphPayload;
  selectedId: string | null;
  hoveredId: string | null;
  filters: GraphFilters;
  labelMode: LabelMode;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onOpenNode: (path: string) => void;
}

interface ViewState {
  tx: number;
  ty: number;
  scale: number;
}

interface Size {
  w: number;
  h: number;
}

export function GraphCanvas({ graph, selectedId, hoveredId, filters, labelMode, onSelect, onHover, onOpenNode }: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const [size, setSize] = useState<Size>({ w: 900, h: 650 });
  const [view, setView] = useState<ViewState>({ tx: 0, ty: 0, scale: 1 });
  const [drag, setDrag] = useState<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const graphSettings = useSettingsStore((state) => state.graph);

  const nodes = useMemo(() => {
    const tagFilters = filters.tags ?? [];
    return layoutNodes(graph.nodes).filter((node) => {
      if (node.isOrphan && filters.includeOrphans === false) return false;
      if (tagFilters.length > 0 && !node.tags.some((tag) => tagFilters.includes(tag))) return false;
      return true;
    });
  }, [graph.nodes, filters.includeOrphans, filters.tags]);

  const edges = useMemo(() => {
    const visible = new Set(nodes.map((node) => node.id));
    return graph.edges.filter((edge) => visible.has(edge.source) && visible.has(edge.target));
  }, [graph.edges, nodes]);

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const worldToScreen = useCallback(
    (x: number, y: number) => ({
      x: size.w / 2 + (x + view.tx) * view.scale,
      y: size.h / 2 + (y + view.ty) * view.scale,
    }),
    [size.h, size.w, view.scale, view.tx, view.ty],
  );

  const hitTest = useCallback(
    (sx: number, sy: number) => {
      for (let index = nodes.length - 1; index >= 0; index -= 1) {
        const node = nodes[index];
        const point = worldToScreen(node.x ?? 0, node.y ?? 0);
        const radius = radiusFor(node) * view.scale + 7;
        if (Math.hypot(point.x - sx, point.y - sy) <= radius) {
          return node;
        }
      }
      return null;
    },
    [nodes, view.scale, worldToScreen],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== size.w * dpr || canvas.height !== size.h * dpr) {
      canvas.width = size.w * dpr;
      canvas.height = size.h * dpr;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    drawBackground(ctx, size);
    drawEdges(ctx, edges, nodeMap, selectedId, hoveredId, worldToScreen, graphSettings.edgeScale, graphSettings.showArrows);
    drawNodes(ctx, nodes, selectedId, hoveredId, worldToScreen, view.scale, timeRef.current, labelMode, graphSettings.nodeScale);
  }, [edges, graphSettings.edgeScale, graphSettings.nodeScale, graphSettings.showArrows, hoveredId, labelMode, nodeMap, nodes, selectedId, size, view.scale, worldToScreen]);

  useEffect(() => {
    const loop = () => {
      timeRef.current += 0.012;
      draw();
      rafRef.current = window.requestAnimationFrame(loop);
    };
    rafRef.current = window.requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setSize({ w: rect.width, h: rect.height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  function zoom(delta: number) {
    setView((current) => ({ ...current, scale: clamp(current.scale + delta, 0.32, 3.5) }));
  }

  function fit() {
    setView({ tx: 0, ty: 0, scale: 1 });
  }

  return (
    <div ref={containerRef} className="absolute-fill overflow-hidden">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        style={{ width: size.w, height: size.h }}
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const hit = hitTest(event.clientX - rect.left, event.clientY - rect.top);
          if (hit) {
            onSelect(hit.id);
          }
          setDrag({ x: event.clientX, y: event.clientY, tx: view.tx, ty: view.ty });
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const sx = event.clientX - rect.left;
          const sy = event.clientY - rect.top;
          const hit = hitTest(sx, sy);
          onHover(hit?.id ?? null);
          if (drag) {
            setView((current) => ({
              ...current,
              tx: drag.tx + (event.clientX - drag.x) / current.scale,
              ty: drag.ty + (event.clientY - drag.y) / current.scale,
            }));
          }
        }}
        onPointerUp={(event) => {
          setDrag(null);
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onDoubleClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const hit = hitTest(event.clientX - rect.left, event.clientY - rect.top);
          if (hit) onOpenNode(hit.path);
        }}
        onWheel={(event) => {
          event.preventDefault();
          zoom(event.deltaY > 0 ? -0.08 : 0.08);
        }}
      />

      <div className="absolute bottom-4 left-4 flex items-center gap-2">
        <div className="glass flex gap-1 rounded-xl p-1">
          <IconButton label="Zoom in" onClick={() => zoom(0.2)}>
            <Plus size={15} />
          </IconButton>
          <IconButton label="Zoom out" onClick={() => zoom(-0.2)}>
            <Minus size={15} />
          </IconButton>
          <IconButton label="Fit graph" onClick={fit}>
            <Maximize size={15} />
          </IconButton>
        </div>
        <div className="glass mono rounded-xl px-3 py-2 text-[11px] text-[var(--text-3)]">{Math.round(view.scale * 100)}%</div>
      </div>

      {hoveredId && <GraphNodePreview node={nodeMap.get(hoveredId) ?? null} />}
    </div>
  );
}

function drawBackground(ctx: CanvasRenderingContext2D, size: Size) {
  const cx = size.w / 2;
  const cy = size.h / 2;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(size.w, size.h) * 0.62);
  gradient.addColorStop(0, "rgba(75,54,184,0.18)");
  gradient.addColorStop(0.42, "rgba(75,54,184,0.05)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size.w, size.h);
}

function drawEdges(
  ctx: CanvasRenderingContext2D,
  edges: GraphEdge[],
  nodes: Map<string, GraphNode>,
  selectedId: string | null,
  hoveredId: string | null,
  worldToScreen: (x: number, y: number) => { x: number; y: number },
  edgeScale: number,
  showArrows: boolean,
) {
  for (const edge of edges) {
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    if (!source || !target) continue;
    const a = worldToScreen(source.x ?? 0, source.y ?? 0);
    const b = worldToScreen(target.x ?? 0, target.y ?? 0);
    const active = source.id === selectedId || target.id === selectedId;
    const hovered = source.id === hoveredId || target.id === hoveredId;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const curve = Math.min(40, len * 0.1) * (edge.type === "semantic" ? 1.5 : 0.8);

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(mx + (-dy / len) * curve, my + (dx / len) * curve, b.x, b.y);
    ctx.strokeStyle =
      edge.type === "semantic"
        ? active
          ? "rgba(109,141,255,0.72)"
          : "rgba(109,141,255,0.22)"
        : active
          ? "rgba(139,124,255,0.62)"
          : hovered
            ? "rgba(139,124,255,0.36)"
            : "rgba(139,124,255,0.18)";
    ctx.lineWidth = (active ? 1.8 : 1) * edgeScale;
    ctx.setLineDash(edge.type === "semantic" ? [3, 4] : []);
    ctx.shadowBlur = active ? 8 : 0;
    ctx.shadowColor = "rgba(139,124,255,0.7)";
    ctx.stroke();
    if (showArrows && (active || hovered)) {
      drawArrow(ctx, a, b, active ? "rgba(255,255,255,0.62)" : "rgba(139,124,255,0.42)", edgeScale);
    }
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
  }
}

function drawArrow(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, color: string, edgeScale: number) {
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const size = 7 * edgeScale;
  const x = a.x + (b.x - a.x) * 0.68;
  const y = a.y + (b.y - a.y) * 0.68;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - Math.cos(angle - Math.PI / 6) * size, y - Math.sin(angle - Math.PI / 6) * size);
  ctx.lineTo(x - Math.cos(angle + Math.PI / 6) * size, y - Math.sin(angle + Math.PI / 6) * size);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawNodes(
  ctx: CanvasRenderingContext2D,
  nodes: GraphNode[],
  selectedId: string | null,
  hoveredId: string | null,
  worldToScreen: (x: number, y: number) => { x: number; y: number },
  scale: number,
  time: number,
  labelMode: LabelMode,
  nodeScale: number,
) {
  for (const node of nodes) {
    const p = worldToScreen(node.x ?? 0, node.y ?? 0);
    const selected = node.id === selectedId;
    const hovered = node.id === hoveredId;
    const radius = radiusFor(node) * nodeScale * scale * (selected ? 1 + Math.sin(time * 2) * 0.04 : 1);
    const colors = colorsFor(node, selected);

    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 6);
    glow.addColorStop(0, colors.glow);
    glow.addColorStop(0.3, colors.glowSoft);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = selected ? 1 : hovered ? 0.85 : 0.55;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.arc(p.x, p.y, radius + 2, 0, Math.PI * 2);
    ctx.strokeStyle = colors.ring;
    ctx.lineWidth = selected ? 1.4 : 0.8;
    ctx.stroke();

    const core = ctx.createRadialGradient(p.x - radius / 3, p.y - radius / 3, 0, p.x, p.y, radius);
    core.addColorStop(0, "#ffffff");
    core.addColorStop(0.5, colors.core);
    core.addColorStop(1, node.isOrphan ? "#3a3a48" : "#5b4ab8");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (selected) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 10 + Math.sin(time * 2) * 4, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const showLabel = labelMode === "all" || (labelMode === "auto" && (selected || hovered || radius > 6 || node.degree > 6));
    if (showLabel) {
      ctx.font = `${selected ? 600 : 500} ${selected ? 11 : 10}px JetBrains Mono, Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const label = node.title.toUpperCase();
      const labelY = p.y + radius + 8;
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(5,5,7,0.62)";
      ctx.fillRect(p.x - textWidth / 2 - 4, labelY - 1, textWidth + 8, 14);
      ctx.fillStyle = selected ? "#ffffff" : hovered ? "#d8d8e8" : "rgba(180,180,200,0.7)";
      ctx.fillText(label, p.x, labelY);
    }
  }
}

function GraphNodePreview({ node }: { node: GraphNode | null }) {
  if (!node) return null;
  return (
    <div className="anim-fade-up pointer-events-none absolute right-4 top-14 w-72 rounded-2xl border border-violet/25 bg-[#111116]/90 p-4 shadow-[var(--shadow-float)] backdrop-blur-xl">
      <div className="pixel-label text-[10px] text-[var(--violet-2)]">{node.isOrphan ? "orphan note" : "linked note"}</div>
      <div className="mt-1 text-sm font-semibold">{node.title}</div>
      <p className="mt-2 text-xs leading-5 text-[var(--text-3)]">{node.degree} graph connections. Double click to open this note in the editor.</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {node.tags.slice(0, 4).map((tag) => (
          <span key={tag} className="chip chip-violet mono text-[10px]">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function layoutNodes(nodes: GraphNode[]): GraphNode[] {
  const count = Math.max(nodes.length, 1);
  return nodes.map((node, index) => {
    if (typeof node.x === "number" && typeof node.y === "number") return node;
    const angle = (index / count) * Math.PI * 2;
    const ring = 160 + (index % 3) * 90;
    return { ...node, x: Math.cos(angle) * ring, y: Math.sin(angle) * ring };
  });
}

function radiusFor(node: GraphNode) {
  if (node.isActive) return 22;
  if (node.isOrphan) return 6;
  return Math.min(16, 7 + Math.sqrt(node.degree) * 2.4);
}

function colorsFor(node: GraphNode, selected: boolean) {
  if (selected || node.isActive) {
    return { core: "#ffffff", glow: "rgba(255,255,255,0.95)", glowSoft: "rgba(255,255,255,0.18)", ring: "rgba(139,124,255,0.9)" };
  }
  if (node.isOrphan) {
    return { core: "#7a7a92", glow: "rgba(255,255,255,0.12)", glowSoft: "rgba(255,255,255,0.05)", ring: "rgba(255,255,255,0.18)" };
  }
  if (node.tags.some((tag) => tag.includes("machine-learning"))) {
    return { core: "#8eaaff", glow: "rgba(109,141,255,0.75)", glowSoft: "rgba(109,141,255,0.18)", ring: "rgba(109,141,255,0.45)" };
  }
  return { core: "#b6abff", glow: "rgba(139,124,255,0.85)", glowSoft: "rgba(139,124,255,0.18)", ring: "rgba(139,124,255,0.5)" };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
