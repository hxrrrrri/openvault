import {
  ArrowRight,
  Brush,
  Check,
  Circle,
  Diamond,
  Eraser,
  Hexagon,
  Highlighter,
  Minus,
  PaintBucket,
  Pencil,
  Pentagon,
  PenTool,
  Redo2,
  RectangleHorizontal,
  Square,
  Star,
  Trash2,
  Triangle,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

type BrushTool = "pencil" | "brush" | "marker" | "calligraphy" | "spray" | "eraser";
type ShapeTool =
  | "line"
  | "arrow"
  | "rect"
  | "roundRect"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "pentagon"
  | "hexagon"
  | "star";
type DrawTool = BrushTool | ShapeTool;

interface DrawingPadProps {
  onClose: () => void;
  onInsert: (bytesBase64: string) => void | Promise<void>;
}

interface Point {
  x: number;
  y: number;
}

const MAX_HISTORY = 40;

const BRUSH_TOOLS: Array<{ id: BrushTool; label: string; icon: ReactNode }> = [
  { id: "pencil", label: "Pencil", icon: <Pencil size={14} /> },
  { id: "brush", label: "Brush", icon: <Brush size={14} /> },
  { id: "marker", label: "Marker", icon: <Highlighter size={14} /> },
  { id: "calligraphy", label: "Calligraphy", icon: <PenTool size={14} /> },
  { id: "spray", label: "Spray", icon: <PaintBucket size={14} /> },
  { id: "eraser", label: "Eraser", icon: <Eraser size={14} /> },
];

const SHAPE_TOOLS: Array<{ id: ShapeTool; label: string; icon: ReactNode }> = [
  { id: "line", label: "Line", icon: <Minus size={14} /> },
  { id: "arrow", label: "Arrow", icon: <ArrowRight size={14} /> },
  { id: "rect", label: "Rectangle", icon: <Square size={14} /> },
  { id: "roundRect", label: "Rounded rectangle", icon: <RectangleHorizontal size={14} /> },
  { id: "ellipse", label: "Ellipse", icon: <Circle size={14} /> },
  { id: "triangle", label: "Triangle", icon: <Triangle size={14} /> },
  { id: "diamond", label: "Diamond", icon: <Diamond size={14} /> },
  { id: "pentagon", label: "Pentagon", icon: <Pentagon size={14} /> },
  { id: "hexagon", label: "Hexagon", icon: <Hexagon size={14} /> },
  { id: "star", label: "Star", icon: <Star size={14} /> },
];

export function DrawingPad({ onClose, onInsert }: DrawingPadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const startRef = useRef<Point | null>(null);
  const lastRef = useRef<Point | null>(null);
  const snapshotRef = useRef<ImageData | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const redoRef = useRef<ImageData[]>([]);
  const [tool, setTool] = useState<DrawTool>("pencil");
  const [color, setColor] = useState("#111111");
  const [size, setSize] = useState(5);
  const [fillShape, setFillShape] = useState(false);
  const [busy, setBusy] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    fillCanvas(ctx, canvas);
    pushHistory(false);
  }, []);

  const canUndo = historyRef.current.length > 1;
  const canRedo = redoRef.current.length > 0;
  void historyVersion;

  function syncHistoryState() {
    setHistoryVersion((version) => version + 1);
  }

  function pushHistory(clearRedo = true) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    historyRef.current = [
      ...historyRef.current.slice(Math.max(0, historyRef.current.length - MAX_HISTORY + 1)),
      ctx.getImageData(0, 0, canvas.width, canvas.height),
    ];
    if (clearRedo) redoRef.current = [];
    syncHistoryState();
  }

  function restoreImage(image: ImageData | undefined) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !image) return;
    ctx.putImageData(image, 0, 0);
  }

  function undo() {
    if (historyRef.current.length <= 1) return;
    const current = historyRef.current.pop();
    if (current) redoRef.current.push(current);
    restoreImage(historyRef.current[historyRef.current.length - 1]);
    syncHistoryState();
  }

  function redo() {
    const next = redoRef.current.pop();
    if (!next) return;
    historyRef.current.push(next);
    restoreImage(next);
    syncHistoryState();
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    fillCanvas(ctx, canvas);
    pushHistory();
  }

  async function insertDrawing() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      await onInsert(dataUrl.split(",")[1] ?? "");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function pointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const point = getPoint(canvas, event);
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    startRef.current = point;
    lastRef.current = point;
    snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (isBrushTool(tool)) {
      drawBrushStroke(ctx, tool, point, point, color, size);
    }
  }

  function pointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = event.currentTarget;
    const point = getPoint(canvas, event);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (isBrushTool(tool)) {
      drawBrushStroke(ctx, tool, lastRef.current ?? point, point, color, size);
      lastRef.current = point;
      return;
    }
    drawShapePreview(ctx, point);
  }

  function pointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = event.currentTarget;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {}
    if (!isBrushTool(tool)) {
      drawShapePreview(ctx, getPoint(canvas, event));
    }
    drawingRef.current = false;
    startRef.current = null;
    lastRef.current = null;
    snapshotRef.current = null;
    pushHistory();
  }

  function drawShapePreview(ctx: CanvasRenderingContext2D, end: Point) {
    const start = startRef.current;
    const snapshot = snapshotRef.current;
    if (!start || !snapshot || isBrushTool(tool)) return;
    ctx.putImageData(snapshot, 0, 0);
    drawShape(ctx, tool, start, end, color, size, fillShape);
  }

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-5 backdrop-blur-md">
      <div className="flex h-[min(900px,calc(100vh-40px))] w-[min(1240px,calc(100vw-40px))] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[#0b0b10] shadow-[0_30px_100px_rgba(0,0,0,0.78)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[#12121a] px-3 py-2">
          <div className="pixel-label mr-1 text-[10px]">Draw</div>
          <ToolGroup>
            {BRUSH_TOOLS.map((item) => (
              <ToolButton key={item.id} active={tool === item.id} label={item.label} onClick={() => setTool(item.id)}>
                {item.icon}
              </ToolButton>
            ))}
          </ToolGroup>
          <ToolGroup>
            {SHAPE_TOOLS.map((item) => (
              <ToolButton key={item.id} active={tool === item.id} label={item.label} onClick={() => setTool(item.id)}>
                {item.icon}
              </ToolButton>
            ))}
            <ToolButton active={fillShape} label="Fill shapes" onClick={() => setFillShape((value) => !value)}>
              <PaintBucket size={14} />
            </ToolButton>
          </ToolGroup>
          <ToolGroup>
            <ToolButton active={false} label="Undo" onClick={undo} disabled={!canUndo}>
              <Undo2 size={14} />
            </ToolButton>
            <ToolButton active={false} label="Redo" onClick={redo} disabled={!canRedo}>
              <Redo2 size={14} />
            </ToolButton>
          </ToolGroup>
          <label className="flex items-center gap-2 text-[11px] text-[var(--text-3)]">
            Color
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.currentTarget.value)}
              className="h-7 w-9 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0"
            />
          </label>
          <label className="flex items-center gap-2 text-[11px] text-[var(--text-3)]">
            Size
            <input
              type="range"
              min={1}
              max={56}
              value={size}
              onChange={(event) => setSize(Number(event.currentTarget.value))}
              className="w-28 accent-[#8b7cff]"
            />
            <span className="mono w-8 text-[10px]">{size}px</span>
          </label>
          <Button variant="ghost" className="ml-auto px-2 py-1 text-[11px]" onClick={clear}>
            <Trash2 size={13} /> Clear
          </Button>
          <Button variant="primary" className="px-2.5 py-1 text-[11px]" onClick={() => void insertDrawing()} disabled={busy}>
            <Check size={13} /> Insert PNG
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-md text-[var(--text-3)] hover:bg-white/[0.06] hover:text-white"
            aria-label="Close drawing pad"
          >
            <X size={15} />
          </button>
        </div>
        <div className="min-h-0 flex-1 bg-[#17171d] p-4">
          <canvas
            ref={canvasRef}
            width={1600}
            height={1000}
            className="h-full w-full touch-none rounded-lg bg-white shadow-[0_18px_70px_rgba(0,0,0,0.35)]"
            style={{ cursor: tool === "eraser" ? "cell" : "crosshair" }}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerUp}
          />
        </div>
      </div>
    </div>
  );
}

function ToolGroup({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-1 rounded-lg bg-black/20 p-1 shadow-[inset_0_0_0_1px_rgba(139,124,255,0.08)]">{children}</div>;
}

function ToolButton({
  active,
  disabled,
  label,
  children,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-8 place-items-center rounded-md transition ${
        active
          ? "bg-violet/20 text-white shadow-[inset_0_0_0_1px_rgba(169,155,255,0.3)]"
          : "text-[var(--text-3)] hover:bg-white/[0.06] hover:text-white"
      } disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent`}
    >
      {children}
    </button>
  );
}

function drawBrushStroke(
  ctx: CanvasRenderingContext2D,
  tool: BrushTool,
  from: Point,
  to: Point,
  color: string,
  size: number,
) {
  if (tool === "spray") {
    drawSpray(ctx, to, color, size);
    return;
  }

  ctx.save();
  ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
  ctx.lineCap = tool === "marker" ? "square" : "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = tool === "marker" ? 0.34 : tool === "calligraphy" ? 0.88 : 1;
  ctx.lineWidth =
    tool === "pencil"
      ? Math.max(1, size * 0.55)
      : tool === "marker"
        ? Math.max(4, size * 1.8)
        : tool === "calligraphy"
          ? Math.max(2, size * 0.9)
          : size;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();

  if (tool === "calligraphy") {
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = Math.max(1, size * 0.28);
    ctx.beginPath();
    ctx.moveTo(from.x - size * 0.35, from.y + size * 0.35);
    ctx.lineTo(to.x - size * 0.35, to.y + size * 0.35);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  tool: ShapeTool,
  start: Point,
  end: Point,
  color: string,
  size: number,
  fillShape: boolean,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();

  if (tool === "line" || tool === "arrow") {
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    if (tool === "arrow") drawArrowHead(ctx, start, end, size);
    ctx.restore();
    return;
  }

  if (tool === "rect") {
    ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
  } else if (tool === "roundRect") {
    roundedRect(ctx, start.x, start.y, end.x - start.x, end.y - start.y, Math.max(10, size * 2));
  } else if (tool === "ellipse") {
    ctx.ellipse(
      (start.x + end.x) / 2,
      (start.y + end.y) / 2,
      Math.max(1, Math.abs(end.x - start.x) / 2),
      Math.max(1, Math.abs(end.y - start.y) / 2),
      0,
      0,
      Math.PI * 2,
    );
  } else if (tool === "triangle") {
    polygon(ctx, start, end, 3, -Math.PI / 2);
  } else if (tool === "diamond") {
    polygon(ctx, start, end, 4, Math.PI / 4);
  } else if (tool === "pentagon") {
    polygon(ctx, start, end, 5, -Math.PI / 2);
  } else if (tool === "hexagon") {
    polygon(ctx, start, end, 6, Math.PI / 6);
  } else if (tool === "star") {
    star(ctx, start, end);
  }

  if (fillShape) {
    ctx.globalAlpha = 0.16;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.stroke();
  ctx.restore();
}

function drawSpray(ctx: CanvasRenderingContext2D, point: Point, color: string, size: number) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.42;
  const radius = Math.max(3, size * 1.7);
  const dots = Math.max(18, size * 4);
  for (let index = 0; index < dots; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius;
    ctx.fillRect(point.x + Math.cos(angle) * distance, point.y + Math.sin(angle) * distance, 1.5, 1.5);
  }
  ctx.restore();
}

function drawArrowHead(ctx: CanvasRenderingContext2D, start: Point, end: Point, size: number) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const length = Math.max(16, size * 4);
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - length * Math.cos(angle - Math.PI / 6), end.y - length * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - length * Math.cos(angle + Math.PI / 6), end.y - length * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const left = Math.min(x, x + width);
  const top = Math.min(y, y + height);
  const w = Math.abs(width);
  const h = Math.abs(height);
  const r = Math.min(radius, w / 2, h / 2);
  ctx.moveTo(left + r, top);
  ctx.lineTo(left + w - r, top);
  ctx.quadraticCurveTo(left + w, top, left + w, top + r);
  ctx.lineTo(left + w, top + h - r);
  ctx.quadraticCurveTo(left + w, top + h, left + w - r, top + h);
  ctx.lineTo(left + r, top + h);
  ctx.quadraticCurveTo(left, top + h, left, top + h - r);
  ctx.lineTo(left, top + r);
  ctx.quadraticCurveTo(left, top, left + r, top);
}

function polygon(ctx: CanvasRenderingContext2D, start: Point, end: Point, sides: number, rotation: number) {
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2;
  const rx = Math.max(1, Math.abs(end.x - start.x) / 2);
  const ry = Math.max(1, Math.abs(end.y - start.y) / 2);
  for (let index = 0; index < sides; index += 1) {
    const angle = rotation + (index / sides) * Math.PI * 2;
    const x = cx + Math.cos(angle) * rx;
    const y = cy + Math.sin(angle) * ry;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function star(ctx: CanvasRenderingContext2D, start: Point, end: Point) {
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2;
  const outerX = Math.max(1, Math.abs(end.x - start.x) / 2);
  const outerY = Math.max(1, Math.abs(end.y - start.y) / 2);
  const innerX = outerX * 0.45;
  const innerY = outerY * 0.45;
  for (let index = 0; index < 10; index += 1) {
    const outer = index % 2 === 0;
    const angle = -Math.PI / 2 + (index / 10) * Math.PI * 2;
    const x = cx + Math.cos(angle) * (outer ? outerX : innerX);
    const y = cy + Math.sin(angle) * (outer ? outerY : innerY);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function fillCanvas(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function isBrushTool(tool: DrawTool): tool is BrushTool {
  return ["pencil", "brush", "marker", "calligraphy", "spray", "eraser"].includes(tool);
}

function getPoint(canvas: HTMLCanvasElement, event: React.PointerEvent<HTMLCanvasElement>): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}
