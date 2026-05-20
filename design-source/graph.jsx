// LATTICE — Knowledge Graph
// Renders an interactive luminous constellation. Pan, zoom, hover, click.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

const KIND_COLORS = {
  center:   { core: "#ffffff", glow: "rgba(255,255,255,0.95)", ring: "rgba(139,124,255,0.9)" },
  linked:   { core: "#b6abff", glow: "rgba(139,124,255,0.85)", ring: "rgba(139,124,255,0.5)" },
  semantic: { core: "#8eaaff", glow: "rgba(109,141,255,0.75)", ring: "rgba(109,141,255,0.45)" },
  orphan:   { core: "#7a7a92", glow: "rgba(255,255,255,0.10)", ring: "rgba(255,255,255,0.18)" },
};

function KnowledgeGraph({
  selectedId = "g0",
  onSelect = () => {},
  hoverId = null,
  setHoverId = () => {},
  showLabels = true,
  filter = { tags: true, semantic: true, orphans: true, depth: 2 },
  compact = false,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState({ tx: 0, ty: 0, scale: 1 });
  const [drag, setDrag] = useState(null);
  const tRef = useRef(0);
  const rafRef = useRef(0);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const e = entries[0];
      setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Animation loop
  useEffect(() => {
    const loop = () => {
      tRef.current += 0.012;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  });

  // Filter visible
  const visibleNodes = useMemo(() => {
    return GRAPH_NODES.filter(n => {
      if (n.kind === "orphan" && !filter.orphans) return false;
      return true;
    });
  }, [filter.orphans]);

  const visibleEdges = useMemo(() => {
    const ids = new Set(visibleNodes.map(n => n.id));
    return GRAPH_EDGES.filter(e => {
      if (!ids.has(e[0]) || !ids.has(e[1])) return false;
      const meta = e[2] || {};
      if (meta.semantic && !filter.semantic) return false;
      return true;
    });
  }, [visibleNodes, filter.semantic]);

  const worldToScreen = (x, y) => ({
    x: size.w / 2 + (x + view.tx) * view.scale,
    y: size.h / 2 + (y + view.ty) * view.scale,
  });

  const screenToWorld = (sx, sy) => ({
    x: (sx - size.w / 2) / view.scale - view.tx,
    y: (sy - size.h / 2) / view.scale - view.ty,
  });

  const draw = useCallback(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const dpr = window.devicePixelRatio || 1;
    if (cvs.width !== size.w * dpr || cvs.height !== size.h * dpr) {
      cvs.width = size.w * dpr;
      cvs.height = size.h * dpr;
    }
    const ctx = cvs.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    const t = tRef.current;

    // Background blobs (subtle ambient)
    const cx = size.w / 2, cy = size.h / 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(size.w, size.h) * 0.6);
    grad.addColorStop(0, "rgba(75,54,184,0.18)");
    grad.addColorStop(0.4, "rgba(75,54,184,0.05)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size.w, size.h);

    // EDGES
    visibleEdges.forEach(([a, b, meta = {}]) => {
      const na = GRAPH_NODES.find(n => n.id === a);
      const nb = GRAPH_NODES.find(n => n.id === b);
      if (!na || !nb) return;
      const pa = worldToScreen(na.x, na.y);
      const pb = worldToScreen(nb.x, nb.y);
      const isActive = na.id === selectedId || nb.id === selectedId;
      const isHovered = na.id === hoverId || nb.id === hoverId;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      // Curved edge using midpoint perpendicular
      const mx = (pa.x + pb.x) / 2;
      const my = (pa.y + pb.y) / 2;
      const dx = pb.x - pa.x, dy = pb.y - pa.y;
      const len = Math.hypot(dx, dy);
      const nx = -dy / len, ny = dx / len;
      const curve = Math.min(40, len * 0.1) * (meta.semantic ? 1.6 : 0.8);
      ctx.quadraticCurveTo(mx + nx * curve, my + ny * curve, pb.x, pb.y);

      if (meta.semantic) {
        ctx.strokeStyle = isActive ? "rgba(109,141,255,0.7)" : "rgba(109,141,255,0.22)";
        ctx.setLineDash([3, 4]);
        ctx.lineWidth = isActive ? 1.4 : 0.9;
      } else {
        const baseA = isActive ? 0.6 : isHovered ? 0.35 : 0.18;
        ctx.strokeStyle = `rgba(139,124,255,${baseA})`;
        ctx.setLineDash([]);
        ctx.lineWidth = isActive ? 1.8 : 1;
      }
      ctx.shadowBlur = isActive ? 8 : 0;
      ctx.shadowColor = "rgba(139,124,255,0.7)";
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
    });

    // NODES
    visibleNodes.forEach(n => {
      const p = worldToScreen(n.x, n.y);
      const c = KIND_COLORS[n.kind];
      const isSel = n.id === selectedId;
      const isHov = n.id === hoverId;
      const breathe = n.kind === "center" ? Math.sin(t * 1.4) * 0.15 + 1 : 1;
      const r = n.r * view.scale * breathe;

      // Outer glow
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 6);
      glow.addColorStop(0, c.glow);
      glow.addColorStop(0.3, c.glow.replace(/[\d.]+\)/, "0.18)"));
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = isSel ? 1 : (isHov ? 0.85 : 0.55);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Ring
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 2, 0, Math.PI * 2);
      ctx.strokeStyle = c.ring;
      ctx.lineWidth = isSel ? 1.4 : 0.8;
      ctx.stroke();

      // Core
      const core = ctx.createRadialGradient(p.x - r/3, p.y - r/3, 0, p.x, p.y, r);
      core.addColorStop(0, "#ffffff");
      core.addColorStop(0.5, c.core);
      core.addColorStop(1, n.kind === "orphan" ? "#3a3a48" : "#5b4ab8");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Pulse on selected
      if (isSel) {
        const pulseR = r + 8 + Math.sin(t * 2) * 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${0.35 - Math.sin(t * 2) * 0.15})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Label
      if (showLabels && (n.kind === "center" || r > 6 || isSel || isHov)) {
        ctx.font = `${n.kind === "center" ? 600 : 500} ${n.kind === "center" ? 11 : 10}px "JetBrains Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const labelY = p.y + r + 8;
        const text = n.label.toUpperCase();
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = "rgba(5,5,7,0.6)";
        ctx.fillRect(p.x - tw/2 - 4, labelY - 1, tw + 8, 14);
        ctx.fillStyle = isSel ? "#ffffff" : (isHov ? "#d8d8e8" : "rgba(180,180,200,0.7)");
        ctx.fillText(text, p.x, labelY);
      }
    });
  }, [size, view, visibleNodes, visibleEdges, selectedId, hoverId, showLabels]);

  // Pointer interactions
  const hitTest = (sx, sy) => {
    for (let i = visibleNodes.length - 1; i >= 0; i--) {
      const n = visibleNodes[i];
      const p = worldToScreen(n.x, n.y);
      const d = Math.hypot(p.x - sx, p.y - sy);
      if (d <= n.r * view.scale + 6) return n.id;
    }
    return null;
  };

  const onPointerDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const hit = hitTest(sx, sy);
    if (hit) {
      onSelect(hit);
      return;
    }
    setDrag({ sx, sy, tx: view.tx, ty: view.ty });
  };

  const onPointerMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    if (drag) {
      setView(v => ({ ...v, tx: drag.tx + (sx - drag.sx) / view.scale, ty: drag.ty + (sy - drag.sy) / view.scale }));
    } else {
      const hit = hitTest(sx, sy);
      setHoverId(hit);
      e.currentTarget.style.cursor = hit ? "pointer" : "grab";
    }
  };

  const onPointerUp = () => setDrag(null);

  const onWheel = (e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const w0 = screenToWorld(sx, sy);
    const next = Math.max(0.4, Math.min(2.5, view.scale * (1 - e.deltaY * 0.001)));
    setView(v => {
      const nv = { ...v, scale: next };
      // Adjust translate so cursor stays anchored
      const w1 = {
        x: (sx - size.w / 2) / next - v.tx,
        y: (sy - size.h / 2) / next - v.ty,
      };
      nv.tx = v.tx + (w0.x - w1.x);
      nv.ty = v.ty + (w0.y - w1.y);
      return nv;
    });
  };

  const zoom = (delta) => setView(v => ({ ...v, scale: Math.max(0.4, Math.min(2.5, v.scale + delta)) }));
  const fit = () => setView({ tx: 0, ty: 0, scale: compact ? 0.55 : 0.75 });

  useEffect(() => { fit(); /* eslint-disable-line */ }, []);

  // Hover preview position
  const hover = visibleNodes.find(n => n.id === hoverId);
  const hoverPos = hover ? worldToScreen(hover.x, hover.y) : null;

  return (
    <div ref={containerRef} className="absolute-fill" style={{ position: "relative", overflow: "hidden", borderRadius: "inherit" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", cursor: "grab", touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => { setDrag(null); setHoverId(null); }}
        onWheel={onWheel}
      />

      {/* Hover preview card */}
      {hover && hoverPos && (
        <div
          className="anim-fade-up no-select"
          style={{
            position: "absolute",
            left: Math.min(size.w - 230, Math.max(10, hoverPos.x + 18)),
            top: Math.min(size.h - 110, Math.max(10, hoverPos.y - 80)),
            width: 220,
            padding: 12,
            borderRadius: 12,
            background: "linear-gradient(180deg, rgba(28,28,36,0.96), rgba(17,17,22,0.96))",
            border: "1px solid rgba(139,124,255,0.3)",
            boxShadow: "var(--shadow-float), 0 0 24px rgba(139,124,255,0.25)",
            backdropFilter: "blur(20px)",
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          <div className="pixel-label" style={{ fontSize: 10, color: hover.kind === "orphan" ? "#FFB45E" : "#A99BFF" }}>
            {hover.kind === "center" ? "ACTIVE NODE" : hover.kind === "semantic" ? "SEMANTIC LINK" : hover.kind === "orphan" ? "ORPHAN NOTE" : "LINKED NOTE"}
          </div>
          <div style={{ marginTop: 4, fontSize: 14, fontWeight: 600, color: "#ECECF4" }}>{hover.label}</div>
          <div style={{ marginTop: 8, fontSize: 11, color: "#8F8FA3", lineHeight: 1.5 }}>
            {hover.kind === "orphan" ? "No incoming or outgoing links." : `${Math.round(3 + Math.random() * 18)} connections · last edited 2d ago`}
          </div>
        </div>
      )}

      {/* Floating graph toolbar */}
      {!compact && (
        <div style={{ position: "absolute", top: 14, left: 14, display: "flex", gap: 8, alignItems: "center" }}>
          <div className="glass" style={{ display: "flex", padding: 4, borderRadius: 12, gap: 2 }}>
            <button className="btn btn-ghost" style={{ padding: "6px 8px" }} onClick={() => zoom(0.2)}><Icon name="zoomIn"/></button>
            <button className="btn btn-ghost" style={{ padding: "6px 8px" }} onClick={() => zoom(-0.2)}><Icon name="zoomOut"/></button>
            <button className="btn btn-ghost" style={{ padding: "6px 8px" }} onClick={fit}><Icon name="fit"/></button>
          </div>
          <div className="glass pixel-label" style={{ padding: "8px 12px", borderRadius: 10, fontSize: 11 }}>
            {Math.round(view.scale * 100)}% · {visibleNodes.length} NODES · {visibleEdges.length} EDGES
          </div>
        </div>
      )}

      {/* Mini-map */}
      {!compact && (
        <div style={{ position: "absolute", bottom: 14, right: 14, width: 160, height: 110 }}>
          <MiniMap nodes={visibleNodes} view={view} size={size} selectedId={selectedId}/>
        </div>
      )}
    </div>
  );
}

function MiniMap({ nodes, view, size, selectedId }) {
  const W = 160, H = 110;
  // Bounding box of all nodes
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const minX = Math.min(...xs) - 30, maxX = Math.max(...xs) + 30;
  const minY = Math.min(...ys) - 30, maxY = Math.max(...ys) + 30;
  const sx = (W - 10) / (maxX - minX), sy = (H - 10) / (maxY - minY);
  const s = Math.min(sx, sy);
  const proj = (x, y) => ({
    x: 5 + (x - minX) * s,
    y: 5 + (y - minY) * s,
  });
  // Viewport rect in world coords
  const halfW = (size.w / 2) / view.scale;
  const halfH = (size.h / 2) / view.scale;
  const vp = {
    x1: -view.tx - halfW, y1: -view.ty - halfH,
    x2: -view.tx + halfW, y2: -view.ty + halfH,
  };
  return (
    <div className="glass" style={{ width: W, height: H, borderRadius: 10, position: "relative", overflow: "hidden" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
        {nodes.map(n => {
          const p = proj(n.x, n.y);
          const isSel = n.id === selectedId;
          return <circle key={n.id} cx={p.x} cy={p.y} r={isSel ? 2.5 : Math.max(0.8, n.r * 0.08)} fill={isSel ? "#fff" : (n.kind === "orphan" ? "#5d5d70" : "#8B7CFF")} opacity={isSel ? 1 : 0.7}/>;
        })}
        {/* Viewport rect */}
        <rect
          x={proj(vp.x1, vp.y1).x}
          y={proj(vp.x1, vp.y1).y}
          width={Math.max(4, (vp.x2 - vp.x1) * s)}
          height={Math.max(4, (vp.y2 - vp.y1) * s)}
          fill="none" stroke="rgba(139,124,255,0.6)" strokeWidth="1"
        />
      </svg>
      <div className="pixel-label" style={{ position: "absolute", top: 4, left: 6, fontSize: 9 }}>MINIMAP</div>
    </div>
  );
}

window.KnowledgeGraph = KnowledgeGraph;
