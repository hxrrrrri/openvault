import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force";
import type { Simulation, SimulationLinkDatum, SimulationNodeDatum } from "d3-force";
import { Maximize, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type WheelEvent } from "react";
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

interface SimNode extends SimulationNodeDatum {
  id: string;
  path: string;
  title: string;
  tags: string[];
  degree: number;
  isOrphan: boolean;
  isActive: boolean;
  group: number;
  pinned: boolean;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  id: string;
  type: GraphEdge["type"];
  weight: number;
}

interface NodeMotion {
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  phase: number;
}

interface ViewState {
  tx: number;
  ty: number;
  scale: number;
}

const REPEL_STRENGTH = -92;
const LINK_DISTANCE = 52;
const COLLIDE_PAD = 2;
const CENTER_STRENGTH = 0.035;
const ALPHA_DECAY = 0.034;
const CLICK_THRESHOLD_PX = 5;
const LINK_STRENGTH = 0.34;
const HOVER_CAPTURE_SCREEN_PX = 18;
const GRAPH_MIN_ZOOM = 0.04;
const GRAPH_MAX_ZOOM = 24;
const GRAPH_FIT_MAX_ZOOM = 2.4;
const WHEEL_ZOOM_TARGET_SENSITIVITY = 0.0016;
const WHEEL_ZOOM_SENSITIVITY = 0.00032;
const WHEEL_ZOOM_DECAY_MS = 130;
const WHEEL_ZOOM_MAX_VELOCITY = 0.55;
const WHEEL_ZOOM_MAX_STEP = 0.055;
const WHEEL_ZOOM_STOP_EPSILON = 0.00018;
const BUTTON_ZOOM_FACTOR = 1.22;
const CAMERA_SMOOTHING_MS = 42;
const AUTO_LABEL_ZOOM = 1.35;
const CLUSTER_LABEL_ZOOM = 1.75;
const NODE_HOVER_MOTION_RADIUS_PX = 150;
const NODE_HOVER_MOTION_MAX_PX = 10;
const NODE_HOVER_PUSH = 0.11;
const NODE_HOVER_DRIFT = 0.045;
const NODE_HOVER_SPRING = 0.035;
const NODE_HOVER_DAMPING = 0.88;

export function GraphCanvas({
  graph,
  selectedId,
  hoveredId,
  filters,
  labelMode,
  onSelect,
  onHover,
  onOpenNode,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const simLinksRef = useRef<SimLink[]>([]);
  const sizeRef = useRef({ w: 900, h: 650 });
  const viewRef = useRef<ViewState>({ tx: 0, ty: 0, scale: 1 });
  const targetViewRef = useRef<ViewState>({ tx: 0, ty: 0, scale: 1 });
  const lastFrameAtRef = useRef<number | null>(null);
  const labelModeRef = useRef<LabelMode>(labelMode);
  const selectedIdRef = useRef<string | null>(selectedId);
  const hoveredIdRef = useRef<string | null>(hoveredId);
  const graphSettingsRef = useRef({ nodeScale: 1, edgeScale: 1, showArrows: true });
  const hoverLockRef = useRef<string | null>(null);
  const nodeMotionRef = useRef<Map<string, NodeMotion>>(new Map());
  const mousePosRef = useRef<{ sx: number; sy: number } | null>(null);
  const wheelZoomRef = useRef<{
    velocity: number;
    focus: { x: number; y: number } | null;
  }>({ velocity: 0, focus: null });

  const pointerRef = useRef<{
    startX: number;
    startY: number;
    moved: boolean;
    mode: "idle" | "drag" | "pan";
    node: SimNode | null;
    panFromTx: number;
    panFromTy: number;
    pointerId: number;
  } | null>(null);

  const [view, setView] = useState<ViewState>({ tx: 0, ty: 0, scale: 1 });
  const [hoverPreviewId, setHoverPreviewId] = useState<string | null>(null);
  const graphSettings = useSettingsStore((state) => state.graph);

  useEffect(() => {
    labelModeRef.current = labelMode;
  }, [labelMode]);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    hoveredIdRef.current = hoveredId;
  }, [hoveredId]);
  useEffect(() => {
    graphSettingsRef.current = {
      nodeScale: graphSettings.nodeScale,
      edgeScale: graphSettings.edgeScale,
      showArrows: graphSettings.showArrows,
    };
  }, [graphSettings.edgeScale, graphSettings.nodeScale, graphSettings.showArrows]);

  const visibleNodes = useMemo(() => {
    const tagFilters = filters.tags ?? [];
    return graph.nodes.filter((node) => {
      if (node.isOrphan && filters.includeOrphans === false) return false;
      if (tagFilters.length > 0 && !node.tags.some((tag) => tagFilters.includes(tag))) return false;
      return true;
    });
  }, [graph.nodes, filters.includeOrphans, filters.tags]);

  const visibleEdges = useMemo(() => {
    const ids = new Set(visibleNodes.map((node) => node.id));
    return graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
  }, [graph.edges, visibleNodes]);

  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const edge of visibleEdges) {
      if (!map.has(edge.source)) map.set(edge.source, new Set());
      if (!map.has(edge.target)) map.set(edge.target, new Set());
      map.get(edge.source)!.add(edge.target);
      map.get(edge.target)!.add(edge.source);
    }
    return map;
  }, [visibleEdges]);
  const adjacencyRef = useRef(adjacency);
  useEffect(() => {
    adjacencyRef.current = adjacency;
  }, [adjacency]);

  // Smooth focus-alpha state for each node/edge, lerped each frame
  const nodeAlphaRef = useRef<Map<string, number>>(new Map());
  const edgeAlphaRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const prev = new Map(simNodesRef.current.map((n) => [n.id, n]));
    const nodes: SimNode[] = visibleNodes.map((node) => {
      const existing = prev.get(node.id);
      return {
        id: node.id,
        path: node.path,
        title: node.title,
        tags: node.tags,
        degree: node.degree,
        isOrphan: node.isOrphan,
        isActive: node.isActive,
        group: groupFor(node),
        pinned: existing?.pinned ?? false,
        x: existing?.x ?? node.x ?? (Math.random() - 0.5) * 400,
        y: existing?.y ?? node.y ?? (Math.random() - 0.5) * 400,
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
        fx: existing?.fx ?? null,
        fy: existing?.fy ?? null,
      };
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = visibleEdges
      .map((edge, index) => {
        const source = byId.get(edge.source);
        const target = byId.get(edge.target);
        if (!source || !target) return null;
        return {
          id: edge.id ?? `${edge.source}->${edge.target}-${index}`,
          source,
          target,
          type: edge.type,
          weight: edge.weight ?? 1,
        };
      })
      .filter(Boolean) as SimLink[];

    simNodesRef.current = nodes;
    simLinksRef.current = links;

    const settleAndFreeze = (sim: Simulation<SimNode, SimLink>, nodeList: SimNode[]) => {
      sim.alpha(1);
      while (sim.alpha() > 0.001) sim.tick();
      for (const n of nodeList) {
        if (!n.pinned) {
          n.fx = n.x ?? 0;
          n.fy = n.y ?? 0;
        }
      }
    };

    if (simRef.current) {
      simRef.current.nodes(nodes);
      const linkForce = simRef.current.force<ReturnType<typeof forceLink<SimNode, SimLink>>>("link");
      if (linkForce) linkForce.links(links);
      settleAndFreeze(simRef.current, nodes);
    } else {
      simRef.current = forceSimulation<SimNode, SimLink>(nodes)
        .force(
          "link",
          forceLink<SimNode, SimLink>(links)
            .id((node) => node.id)
            .distance((link) => LINK_DISTANCE * (link.type === "semantic" ? 1.4 : 1))
            .strength((link) => LINK_STRENGTH * (link.type === "semantic" ? 0.4 : 1)),
        )
        .force(
          "charge",
          forceManyBody<SimNode>()
            .strength((node) => REPEL_STRENGTH * (node.isActive ? 1.5 : 1))
            .distanceMax(720),
        )
        .force("center", forceCenter(0, 0))
        .force("x", forceX(0).strength(CENTER_STRENGTH))
        .force("y", forceY(0).strength(CENTER_STRENGTH))
        .force(
          "collide",
          forceCollide<SimNode>((node) => radiusFor(node) + COLLIDE_PAD),
        )
        .alphaDecay(ALPHA_DECAY)
        .velocityDecay(0.45)
        .stop();
      settleAndFreeze(simRef.current, nodes);
    }
  }, [visibleEdges, visibleNodes]);

  useEffect(() => {
    return () => {
      setHoverLock(null);
      simRef.current?.stop();
      simRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      sizeRef.current = { w: rect.width, h: rect.height };
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const worldToScreen = useCallback((x: number, y: number) => {
    const size = sizeRef.current;
    const v = viewRef.current;
    return {
      x: size.w / 2 + (x + v.tx) * v.scale,
      y: size.h / 2 + (y + v.ty) * v.scale,
    };
  }, []);

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const size = sizeRef.current;
    const v = viewRef.current;
    return {
      x: (sx - size.w / 2) / v.scale - v.tx,
      y: (sy - size.h / 2) / v.scale - v.ty,
    };
  }, []);

  const hitTest = useCallback(
    (sx: number, sy: number): SimNode | null => {
      const world = screenToWorld(sx, sy);
      const nodes = simNodesRef.current;
      const scale = viewRef.current.scale;
      let best: SimNode | null = null;
      let bestDistSq = Infinity;
      for (let index = nodes.length - 1; index >= 0; index -= 1) {
        const node = nodes[index];
        const dx = (node.x ?? 0) - world.x;
        const dy = (node.y ?? 0) - world.y;
        const distSq = dx * dx + dy * dy;
        const r = radiusFor(node) + HOVER_CAPTURE_SCREEN_PX / scale;
        if (distSq <= r * r && distSq < bestDistSq) {
          best = node;
          bestDistSq = distSq;
        }
      }
      return best;
    },
    [screenToWorld],
  );

  // Single stable RAF loop. Reads everything from refs so it never restarts.
  useEffect(() => {
    const loop = () => {
      timeRef.current += 0.012;
      const canvas = canvasRef.current;
      if (canvas) {
        const size = sizeRef.current;
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== size.w * dpr || canvas.height !== size.h * dpr) {
          canvas.width = size.w * dpr;
          canvas.height = size.h * dpr;
        }
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const now = window.performance.now();
          const lastFrameAt = lastFrameAtRef.current ?? now - 16.7;
          lastFrameAtRef.current = now;
          const frameDeltaMs = now - lastFrameAt;
          applyWheelZoom(frameDeltaMs);
          viewRef.current = easeCamera(viewRef.current, targetViewRef.current, frameDeltaMs);

          const mouse = mousePosRef.current;
          updateNodeMotion(
            simNodesRef.current,
            nodeMotionRef.current,
            mouse && !pointerRef.current ? mouse : null,
            worldToScreen,
            timeRef.current,
          );

          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, size.w, size.h);
          drawBackground(ctx, size);
          ctx.save();
          const focusId = hoveredIdRef.current ?? selectedIdRef.current;
          const focusSet = focusId
            ? new Set<string>([focusId, ...(adjacencyRef.current.get(focusId) ?? [])])
            : null;
          // Smooth lerp node/edge alpha values toward target each frame
          const LERP = 0.16;
          for (const node of simNodesRef.current) {
            const target = !focusSet || focusSet.has(node.id) ? 1 : 0.32;
            const current = nodeAlphaRef.current.get(node.id) ?? 1;
            nodeAlphaRef.current.set(node.id, current + (target - current) * LERP);
          }
          for (const link of simLinksRef.current) {
            const sourceId = (link.source as SimNode).id;
            const targetId = (link.target as SimNode).id;
            const target = !focusSet || (focusSet.has(sourceId) && focusSet.has(targetId)) ? 1 : 0.42;
            const current = edgeAlphaRef.current.get(link.id) ?? 1;
            edgeAlphaRef.current.set(link.id, current + (target - current) * LERP);
          }
          drawEdges(
            ctx,
            simLinksRef.current,
            selectedIdRef.current,
            hoveredIdRef.current,
            edgeAlphaRef.current,
            nodeMotionRef.current,
            worldToScreen,
            graphSettingsRef.current.edgeScale,
            graphSettingsRef.current.showArrows,
          );
          drawNodes(
            ctx,
            simNodesRef.current,
            selectedIdRef.current,
            hoveredIdRef.current,
            nodeAlphaRef.current,
            nodeMotionRef.current,
            worldToScreen,
            viewRef.current.scale,
            timeRef.current,
            labelModeRef.current,
            graphSettingsRef.current.nodeScale,
          );
          ctx.restore();
        }
      }
      rafRef.current = window.requestAnimationFrame(loop);
    };
    rafRef.current = window.requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [worldToScreen]);

  function setCameraTarget(next: ViewState | ((current: ViewState) => ViewState), immediate = false) {
    const resolved = typeof next === "function" ? next(targetViewRef.current) : next;
    targetViewRef.current = resolved;
    setView(resolved);
    if (immediate) viewRef.current = resolved;
  }

  function zoomByFactor(factor: number, focusScreen?: { x: number; y: number }, immediate = false) {
    setCameraTarget((current) => zoomView(current, factor, sizeRef.current, focusScreen), immediate);
  }

  function applyWheelZoom(deltaMs: number) {
    const wheel = wheelZoomRef.current;
    if (!wheel.focus || Math.abs(wheel.velocity) < WHEEL_ZOOM_STOP_EPSILON) {
      wheel.velocity = 0;
      return;
    }

    const step = clamp(wheel.velocity, -WHEEL_ZOOM_MAX_STEP, WHEEL_ZOOM_MAX_STEP);
    targetViewRef.current = zoomView(targetViewRef.current, Math.exp(step), sizeRef.current, wheel.focus);
    setView(targetViewRef.current);

    const safeDelta = Number.isFinite(deltaMs) ? clamp(deltaMs, 1, 50) : 16.7;
    wheel.velocity *= Math.exp(-safeDelta / WHEEL_ZOOM_DECAY_MS);
  }

  function fit() {
    const nodes = simNodesRef.current;
    const size = sizeRef.current;
    if (!nodes.length) {
      setCameraTarget({ tx: 0, ty: 0, scale: 1 }, true);
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of nodes) {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const scale = clamp(Math.min((size.w - 80) / w, (size.h - 80) / h), GRAPH_MIN_ZOOM, GRAPH_FIT_MAX_ZOOM);
    const tx = -(minX + maxX) / 2;
    const ty = -(minY + maxY) / 2;
    setCameraTarget({ tx, ty, scale });
  }

  function setHoverLock(nextId: string | null) {
    const previousId = hoverLockRef.current;
    if (previousId && previousId !== nextId) {
      const previous = simNodesRef.current.find((node) => node.id === previousId);
      if (previous && !previous.pinned) {
        previous.fx = null;
        previous.fy = null;
      }
    }

    hoverLockRef.current = nextId;
    if (!nextId) return;

    const next = simNodesRef.current.find((node) => node.id === nextId);
    if (next && !next.pinned) {
      next.fx = next.x ?? 0;
      next.fy = next.y ?? 0;
      next.vx = 0;
      next.vy = 0;
    }
  }

  return (
    <div ref={containerRef} className="absolute-fill overflow-hidden">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onPointerDown={(event) => {
          targetViewRef.current = viewRef.current;
          setView(viewRef.current);
          const rect = event.currentTarget.getBoundingClientRect();
          const sx = event.clientX - rect.left;
          const sy = event.clientY - rect.top;
          const hit = hitTest(sx, sy);
          pointerRef.current = {
            startX: sx,
            startY: sy,
            moved: false,
            mode: "idle",
            node: hit,
            panFromTx: viewRef.current.tx,
            panFromTy: viewRef.current.ty,
            pointerId: event.pointerId,
          };
          if (hit) {
            selectedIdRef.current = hit.id;
            hoveredIdRef.current = hit.id;
            onSelect(hit.id);
            onHover(hit.id);
            setHoverPreviewId(hit.id);
            setHoverLock(hit.id);
          }
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const sx = event.clientX - rect.left;
          const sy = event.clientY - rect.top;
          const tracker = pointerRef.current;

          if (tracker) {
            const dx = sx - tracker.startX;
            const dy = sy - tracker.startY;
            const dist = Math.hypot(dx, dy);

            if (tracker.mode === "idle" && dist > CLICK_THRESHOLD_PX) {
              tracker.moved = true;
              if (tracker.node) {
                tracker.mode = "drag";
                tracker.node.fx = tracker.node.x;
                tracker.node.fy = tracker.node.y;
              } else {
                tracker.mode = "pan";
              }
            }

            if (tracker.mode === "drag" && tracker.node) {
              const world = screenToWorld(sx, sy);
              tracker.node.x = world.x;
              tracker.node.y = world.y;
              tracker.node.fx = world.x;
              tracker.node.fy = world.y;
              tracker.node.vx = 0;
              tracker.node.vy = 0;
              return;
            }
            if (tracker.mode === "pan") {
              const dragScale = viewRef.current.scale;
              setCameraTarget(
                {
                  ...viewRef.current,
                  tx: tracker.panFromTx + dx / dragScale,
                  ty: tracker.panFromTy + dy / dragScale,
                },
                true,
              );
              return;
            }
          }

          mousePosRef.current = { sx, sy };
          const hit = hitTest(sx, sy);
          const nextId = hit?.id ?? null;
          if (hoveredIdRef.current !== nextId) {
            hoveredIdRef.current = nextId;
            onHover(nextId);
            setHoverPreviewId(nextId);
            setHoverLock(nextId);
          }
        }}
        onPointerUp={(event) => {
          const tracker = pointerRef.current;
          pointerRef.current = null;
          try {
            event.currentTarget.releasePointerCapture(event.pointerId);
          } catch {}
          if (!tracker) return;

          if (tracker.mode === "drag" && tracker.node) {
            tracker.node.pinned = true;
            tracker.node.fx = tracker.node.x ?? tracker.node.fx;
            tracker.node.fy = tracker.node.y ?? tracker.node.fy;
            tracker.node.vx = 0;
            tracker.node.vy = 0;
            setHoverLock(tracker.node.id);
            return;
          }

          if (!tracker.moved) {
            const rect = event.currentTarget.getBoundingClientRect();
            const sx = event.clientX - rect.left;
            const sy = event.clientY - rect.top;
            const hit = hitTest(sx, sy) ?? tracker.node;
            onSelect(hit?.id ?? null);
            selectedIdRef.current = hit?.id ?? null;
            if (hit) {
              hoveredIdRef.current = hit.id;
              onHover(hit.id);
              setHoverPreviewId(hit.id);
              setHoverLock(hit.id);
            }
          }
        }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const sx = event.clientX - rect.left;
          const sy = event.clientY - rect.top;
          const hit = hitTest(sx, sy);
          if (!hit) return;
          selectedIdRef.current = hit.id;
          hoveredIdRef.current = hit.id;
          onSelect(hit.id);
          onHover(hit.id);
          setHoverPreviewId(hit.id);
          setHoverLock(hit.id);
        }}
        onPointerCancel={(event) => {
          const tracker = pointerRef.current;
          pointerRef.current = null;
          try {
            event.currentTarget.releasePointerCapture(event.pointerId);
          } catch {}
          if (tracker?.mode === "drag" && tracker.node && !tracker.node.pinned) {
            tracker.node.fx = null;
            tracker.node.fy = null;
          }
        }}
        onPointerLeave={() => {
          mousePosRef.current = null;
          setHoverLock(null);
          if (hoveredIdRef.current !== null) {
            hoveredIdRef.current = null;
            onHover(null);
            setHoverPreviewId(null);
          }
        }}
        onDoubleClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const hit = hitTest(event.clientX - rect.left, event.clientY - rect.top);
          if (hit) {
            onOpenNode(hit.path);
            return;
          }
          fit();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          const hit = hitTest(event.clientX - rect.left, event.clientY - rect.top);
          if (hit) {
            hit.pinned = !hit.pinned;
            if (!hit.pinned) {
              hit.fx = null;
              hit.fy = null;
              if (hoverLockRef.current === hit.id) hoverLockRef.current = null;
            } else {
              hit.fx = hit.x;
              hit.fy = hit.y;
              setHoverLock(hit.id);
            }
          }
        }}
        onWheel={(event) => {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          const focus = { x: event.clientX - rect.left, y: event.clientY - rect.top };
          const delta = wheelDeltaPixels(event, sizeRef.current.h);
          targetViewRef.current = zoomView(
            targetViewRef.current,
            Math.exp(-delta * WHEEL_ZOOM_TARGET_SENSITIVITY),
            sizeRef.current,
            focus,
          );
          setView(targetViewRef.current);
          const wheel = wheelZoomRef.current;
          wheel.focus = focus;
          wheel.velocity = clamp(
            wheel.velocity - delta * WHEEL_ZOOM_SENSITIVITY,
            -WHEEL_ZOOM_MAX_VELOCITY,
            WHEEL_ZOOM_MAX_VELOCITY,
          );
        }}
      />

      <div className="absolute bottom-4 left-4 flex items-center gap-2">
        <div className="glass flex gap-1 rounded-xl p-1">
          <IconButton label="Zoom in" onClick={() => zoomByFactor(BUTTON_ZOOM_FACTOR)}>
            <Plus size={15} />
          </IconButton>
          <IconButton label="Zoom out" onClick={() => zoomByFactor(1 / BUTTON_ZOOM_FACTOR)}>
            <Minus size={15} />
          </IconButton>
          <IconButton label="Fit graph" onClick={fit}>
            <Maximize size={15} />
          </IconButton>
        </div>
        <div className="glass mono rounded-xl px-3 py-2 text-[11px] text-[var(--text-3)]">
          {Math.round(view.scale * 100)}%
        </div>
      </div>

      {hoverPreviewId && <GraphNodePreview node={simNodesRef.current.find((n) => n.id === hoverPreviewId) ?? null} />}
    </div>
  );
}

function wheelDeltaPixels(event: WheelEvent<HTMLCanvasElement>, viewportHeight: number) {
  if (event.deltaMode === 1) return event.deltaY * 16;
  if (event.deltaMode === 2) return event.deltaY * viewportHeight;
  return event.deltaY;
}

function zoomView(
  current: ViewState,
  factor: number,
  size: { w: number; h: number },
  focusScreen?: { x: number; y: number },
): ViewState {
  const next = clamp(current.scale * factor, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM);
  if (!focusScreen) return { ...current, scale: next };
  const before = {
    x: (focusScreen.x - size.w / 2) / current.scale - current.tx,
    y: (focusScreen.y - size.h / 2) / current.scale - current.ty,
  };
  const tx = (focusScreen.x - size.w / 2) / next - before.x;
  const ty = (focusScreen.y - size.h / 2) / next - before.y;
  return { tx, ty, scale: next };
}

function easeCamera(current: ViewState, target: ViewState, deltaMs: number): ViewState {
  const safeDelta = Number.isFinite(deltaMs) ? clamp(deltaMs, 1, 50) : 16.7;
  const blend = 1 - Math.exp(-safeDelta / CAMERA_SMOOTHING_MS);
  const next = {
    tx: lerp(current.tx, target.tx, blend),
    ty: lerp(current.ty, target.ty, blend),
    scale: Math.exp(lerp(Math.log(current.scale), Math.log(target.scale), blend)),
  };

  if (
    Math.abs(next.tx - target.tx) < 0.01 &&
    Math.abs(next.ty - target.ty) < 0.01 &&
    Math.abs(next.scale - target.scale) < 0.001
  ) {
    return target;
  }

  return next;
}

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

function drawBackground(ctx: CanvasRenderingContext2D, size: { w: number; h: number }) {
  const cx = size.w / 2;
  const cy = size.h / 2;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(size.w, size.h) * 0.72);
  gradient.addColorStop(0, "rgba(75,54,184,0.16)");
  gradient.addColorStop(0.42, "rgba(75,54,184,0.04)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size.w, size.h);
}

function updateNodeMotion(
  nodes: SimNode[],
  motionById: Map<string, NodeMotion>,
  mouse: { sx: number; sy: number } | null,
  worldToScreen: (x: number, y: number) => { x: number; y: number },
  time: number,
) {
  const liveIds = new Set<string>();

  for (const node of nodes) {
    liveIds.add(node.id);
    let motion = motionById.get(node.id);
    if (!motion) {
      motion = { ox: 0, oy: 0, vx: 0, vy: 0, phase: phaseFor(node.id) };
      motionById.set(node.id, motion);
    }

    let influence = 0;
    let ux = 0;
    let uy = 0;
    if (mouse) {
      const p = worldToScreen(node.x ?? 0, node.y ?? 0);
      const dx = p.x - mouse.sx;
      const dy = p.y - mouse.sy;
      const dist = Math.max(1, Math.hypot(dx, dy));
      influence = Math.pow(clamp(1 - dist / NODE_HOVER_MOTION_RADIUS_PX, 0, 1), 1.7);
      ux = dx / dist;
      uy = dy / dist;
    }

    const pinFactor = node.pinned ? 0.35 : 1;
    if (influence > 0) {
      const driftX = Math.cos(time * 2.1 + motion.phase);
      const driftY = Math.sin(time * 1.8 + motion.phase * 1.37);
      motion.vx += (ux * NODE_HOVER_PUSH + driftX * NODE_HOVER_DRIFT) * influence * pinFactor;
      motion.vy += (uy * NODE_HOVER_PUSH + driftY * NODE_HOVER_DRIFT) * influence * pinFactor;
    }

    motion.vx -= motion.ox * NODE_HOVER_SPRING;
    motion.vy -= motion.oy * NODE_HOVER_SPRING;
    motion.vx *= NODE_HOVER_DAMPING;
    motion.vy *= NODE_HOVER_DAMPING;
    motion.ox = clamp(motion.ox + motion.vx, -NODE_HOVER_MOTION_MAX_PX, NODE_HOVER_MOTION_MAX_PX);
    motion.oy = clamp(motion.oy + motion.vy, -NODE_HOVER_MOTION_MAX_PX, NODE_HOVER_MOTION_MAX_PX);

    if (!mouse && Math.abs(motion.ox) < 0.01 && Math.abs(motion.oy) < 0.01) {
      motion.ox = 0;
      motion.oy = 0;
      motion.vx = 0;
      motion.vy = 0;
    }
  }

  for (const id of motionById.keys()) {
    if (!liveIds.has(id)) motionById.delete(id);
  }
}

function withMotion(point: { x: number; y: number }, motion: NodeMotion | undefined) {
  if (!motion) return point;
  return { x: point.x + motion.ox, y: point.y + motion.oy };
}

function phaseFor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 33 + id.charCodeAt(index)) | 0;
  return (Math.abs(hash) % 628) / 100;
}

function drawEdges(
  ctx: CanvasRenderingContext2D,
  links: SimLink[],
  selectedId: string | null,
  hoveredId: string | null,
  edgeAlpha: Map<string, number>,
  nodeMotion: Map<string, NodeMotion>,
  worldToScreen: (x: number, y: number) => { x: number; y: number },
  edgeScale: number,
  showArrows: boolean,
) {
  for (const link of links) {
    const sourceNode = link.source as SimNode;
    const targetNode = link.target as SimNode;
    if (!sourceNode || !targetNode) continue;
    const a = withMotion(worldToScreen(sourceNode.x ?? 0, sourceNode.y ?? 0), nodeMotion.get(sourceNode.id));
    const b = withMotion(worldToScreen(targetNode.x ?? 0, targetNode.y ?? 0), nodeMotion.get(targetNode.id));
    const active = sourceNode.id === selectedId || targetNode.id === selectedId;
    const hovered = sourceNode.id === hoveredId || targetNode.id === hoveredId;
    const focusAlpha = edgeAlpha.get(link.id) ?? 1;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const curve = Math.min(28, len * 0.08) * (link.type === "semantic" ? 1.4 : 0.6);

    const distanceScale = clamp(len / 180, 0.75, 2.35);
    const sourceColor = colorsFor(sourceNode, false, false);
    const targetColor = colorsFor(targetNode, false, false);

    ctx.globalAlpha = Math.max(0.36, focusAlpha);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(mx + (-dy / len) * curve, my + (dx / len) * curve, b.x, b.y);
    if (link.type === "semantic") {
      ctx.strokeStyle = active
        ? "rgba(195,208,255,0.94)"
        : hovered
          ? "rgba(160,188,255,0.86)"
          : alphaColor(mixHex(sourceColor.core, targetColor.core, 0.55), 0.48);
      ctx.setLineDash([3, 4]);
    } else {
      ctx.strokeStyle = active
        ? "rgba(232,226,255,0.96)"
        : hovered
          ? "rgba(214,205,255,0.88)"
          : alphaColor(mixHex(sourceColor.core, targetColor.core, 0.5), 0.58);
      ctx.setLineDash([]);
    }
    ctx.lineWidth = (active ? 1.85 : hovered ? 1.5 : 0.82) * edgeScale * distanceScale;
    ctx.shadowBlur = active ? 10 : hovered ? 6 : 0;
    ctx.shadowColor = "rgba(139,124,255,0.7)";
    ctx.stroke();
    if (showArrows) {
      drawArrow(ctx, a, b, active || hovered ? "rgba(199,188,255,0.78)" : alphaColor(mixHex(sourceColor.core, targetColor.core, 0.5), 0.36), edgeScale);
    }
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  a: { x: number; y: number },
  b: { x: number; y: number },
  color: string,
  edgeScale: number,
) {
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const size = 7 * edgeScale;
  const x = a.x + (b.x - a.x) * 0.7;
  const y = a.y + (b.y - a.y) * 0.7;
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
  nodes: SimNode[],
  selectedId: string | null,
  hoveredId: string | null,
  nodeAlpha: Map<string, number>,
  nodeMotion: Map<string, NodeMotion>,
  worldToScreen: (x: number, y: number) => { x: number; y: number },
  scale: number,
  time: number,
  labelMode: LabelMode,
  nodeScale: number,
) {
  for (const node of nodes) {
    const selected = node.id === selectedId;
    const hovered = node.id === hoveredId;
    const p = withMotion(worldToScreen(node.x ?? 0, node.y ?? 0), nodeMotion.get(node.id));
    const focusAlpha = nodeAlpha.get(node.id) ?? 1;
    const baseRadius = radiusFor(node);
    const pulse = selected ? 1 + Math.sin(time * 2.6) * 0.06 : hovered ? 1.14 : 1;
    const radius = baseRadius * nodeScale * scale * pulse;
    const colors = colorsFor(node, selected, hovered);

    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 6);
    glow.addColorStop(0, colors.glow);
    glow.addColorStop(0.3, colors.glowSoft);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = (selected ? 1 : hovered ? 0.92 : 0.6) * focusAlpha;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = focusAlpha;

    ctx.beginPath();
    ctx.arc(p.x, p.y, radius + 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = colors.ring;
    ctx.lineWidth = selected ? 1.4 : 0.75;
    ctx.stroke();

    const core = ctx.createRadialGradient(p.x - radius / 3, p.y - radius / 3, 0, p.x, p.y, radius);
    core.addColorStop(0, colors.coreLight);
    core.addColorStop(0.55, colors.core);
    core.addColorStop(1, colors.coreDark);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (node.pinned) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(169,155,255,0.58)";
      ctx.lineWidth = 0.7;
      ctx.setLineDash([2, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (selected) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 10 + Math.sin(time * 2) * 4, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(169,155,255,0.42)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const showLabel =
      labelMode === "all" ||
      (labelMode === "auto" &&
        (selected ||
          hovered ||
          (scale >= AUTO_LABEL_ZOOM && node.degree > 6) ||
          (scale >= CLUSTER_LABEL_ZOOM && focusAlpha > 0.72)));
    if (showLabel) {
      ctx.font = `${selected ? 600 : 500} ${selected ? 11 : 10}px JetBrains Mono, Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const label = node.title.toUpperCase();
      const labelY = p.y + radius + 8;
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = alphaColor(colors.coreDark, selected || hovered ? 0.78 : 0.58);
      ctx.fillRect(p.x - textWidth / 2 - 4, labelY - 1, textWidth + 8, 14);
      ctx.fillStyle = selected ? "#eeeaff" : hovered ? "#e6e6f3" : "rgba(190,190,210,0.72)";
      ctx.fillText(label, p.x, labelY);
    }
  }
  ctx.globalAlpha = 1;
}

function GraphNodePreview({ node }: { node: SimNode | null }) {
  if (!node) return null;
  return (
    <div className="anim-fade-up pointer-events-none absolute right-4 top-14 w-72 rounded-2xl border border-violet/25 bg-[#111116]/90 p-4 shadow-[var(--shadow-float)] backdrop-blur-xl">
      <div className="pixel-label text-[10px] text-[var(--violet-2)]">
        {node.isOrphan ? "orphan note" : node.pinned ? "pinned note" : "linked note"}
      </div>
      <div className="mt-1 text-sm font-semibold">{node.title}</div>
      <p className="mt-2 text-xs leading-5 text-[var(--text-3)]">
        {node.degree} connections. Drag to place, right click to pin or release, double click to open.
      </p>
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

function radiusFor(node: { isActive: boolean; isOrphan: boolean; degree: number }) {
  if (node.isActive) return 6.2;
  if (node.isOrphan) return 1.8;
  return Math.min(5.8, 2.2 + Math.sqrt(Math.max(1, node.degree)) * 0.82);
}

function groupFor(node: GraphNode): number {
  if (node.isActive) return 0;
  if (node.isOrphan) return 1;
  const seed = node.tags[0] ?? node.path;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return 2 + (Math.abs(hash) % 5);
}

function colorsFor(node: SimNode, selected: boolean, hovered: boolean) {
  const palette = NODE_PALETTE[node.group] ?? NODE_PALETTE[3];
  const intensified = selected || hovered;
  return {
    core: intensified ? palette.coreHot : palette.core,
    coreLight: intensified ? "#eeeaff" : palette.coreLight,
    coreDark: palette.coreDark,
    ring: intensified ? palette.ringHot : palette.ring,
    glow: intensified ? palette.glowHot : palette.glow,
    glowSoft: palette.glowSoft,
  };
}

function alphaColor(hex: string, alpha: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

function mixHex(a: string, b: string, ratio: number) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return a;
  const mix = (from: number, to: number) => Math.round(from + (to - from) * ratio);
  return `#${toHex(mix(ca.r, cb.r))}${toHex(mix(ca.g, cb.g))}${toHex(mix(ca.b, cb.b))}`;
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  const value = Number.parseInt(clean, 16);
  if (Number.isNaN(value)) return null;
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function toHex(value: number) {
  return value.toString(16).padStart(2, "0");
}

const NODE_PALETTE: Record<
  number,
  {
    core: string;
    coreHot: string;
    coreLight: string;
    coreDark: string;
    ring: string;
    ringHot: string;
    glow: string;
    glowHot: string;
    glowSoft: string;
  }
> = {
  0: {
    core: "#d8d0ff",
    coreHot: "#eeeaff",
    coreLight: "#f4f0ff",
    coreDark: "#cdb8ff",
    ring: "rgba(199,188,255,0.78)",
    ringHot: "rgba(238,234,255,0.96)",
    glow: "rgba(169,155,255,0.78)",
    glowHot: "rgba(199,188,255,0.92)",
    glowSoft: "rgba(139,124,255,0.2)",
  },
  1: {
    core: "#c4c4dc",
    coreHot: "#e6e6f5",
    coreLight: "#f0f0fa",
    coreDark: "#4a4a5e",
    ring: "rgba(220,220,240,0.6)",
    ringHot: "rgba(218,214,244,0.9)",
    glow: "rgba(220,220,240,0.55)",
    glowHot: "rgba(240,240,255,0.85)",
    glowSoft: "rgba(220,220,240,0.16)",
  },
  2: {
    core: "#b6abff",
    coreHot: "#dccfff",
    coreLight: "#f0eaff",
    coreDark: "#5b4ab8",
    ring: "rgba(182,171,255,0.55)",
    ringHot: "rgba(220,207,255,0.95)",
    glow: "rgba(139,124,255,0.78)",
    glowHot: "rgba(180,160,255,0.95)",
    glowSoft: "rgba(139,124,255,0.18)",
  },
  3: {
    core: "#f7d774",
    coreHot: "#ffe8a0",
    coreLight: "#fff4cf",
    coreDark: "#7a5a0e",
    ring: "rgba(247,215,116,0.55)",
    ringHot: "rgba(255,230,140,0.95)",
    glow: "rgba(247,215,116,0.7)",
    glowHot: "rgba(255,232,160,0.95)",
    glowSoft: "rgba(247,215,116,0.18)",
  },
  4: {
    core: "#ff7a8a",
    coreHot: "#ffb0bb",
    coreLight: "#ffe0e5",
    coreDark: "#8e2334",
    ring: "rgba(255,122,138,0.55)",
    ringHot: "rgba(255,200,210,0.95)",
    glow: "rgba(255,122,138,0.7)",
    glowHot: "rgba(255,180,195,0.95)",
    glowSoft: "rgba(255,122,138,0.18)",
  },
  5: {
    core: "#8eaaff",
    coreHot: "#bcd0ff",
    coreLight: "#e3ecff",
    coreDark: "#243b87",
    ring: "rgba(142,170,255,0.55)",
    ringHot: "rgba(200,215,255,0.95)",
    glow: "rgba(109,141,255,0.7)",
    glowHot: "rgba(160,185,255,0.95)",
    glowSoft: "rgba(109,141,255,0.18)",
  },
  6: {
    core: "#7ee0b4",
    coreHot: "#b5f0d4",
    coreLight: "#dffaeb",
    coreDark: "#13533a",
    ring: "rgba(126,224,180,0.55)",
    ringHot: "rgba(180,240,210,0.95)",
    glow: "rgba(126,224,180,0.7)",
    glowHot: "rgba(180,240,210,0.95)",
    glowSoft: "rgba(126,224,180,0.18)",
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
