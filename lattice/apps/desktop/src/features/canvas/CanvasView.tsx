import { Copy, Download, Eraser, FilePlus2, Globe2, Group, Link2, Maximize, Minus, Plus, RotateCcw, Trash2, Type, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { useCanvasStore, type CanvasCard, type CanvasConnection, type CanvasGroup } from "@/stores/canvas-store";
import { useUIStore } from "@/stores/ui-store";
import { useVaultStore } from "@/stores/vault-store";

const BOARD_WIDTH = 4200;
const BOARD_HEIGHT = 3000;
const GRID_SIZE = 40;

export function CanvasView() {
  const cards = useCanvasStore((state) => state.cards);
  const connections = useCanvasStore((state) => state.connections);
  const groups = useCanvasStore((state) => state.groups);
  const selectedCardId = useCanvasStore((state) => state.selectedCardId);
  const selectedGroupId = useCanvasStore((state) => state.selectedGroupId);
  const connectionSourceId = useCanvasStore((state) => state.connectionSourceId);
  const pan = useCanvasStore((state) => state.pan);
  const zoom = useCanvasStore((state) => state.zoom);
  const addCard = useCanvasStore((state) => state.addCard);
  const updateCard = useCanvasStore((state) => state.updateCard);
  const moveCard = useCanvasStore((state) => state.moveCard);
  const deleteSelected = useCanvasStore((state) => state.deleteSelected);
  const duplicateSelected = useCanvasStore((state) => state.duplicateSelected);
  const clearCanvas = useCanvasStore((state) => state.clearCanvas);
  const replaceCanvas = useCanvasStore((state) => state.replaceCanvas);
  const addConnection = useCanvasStore((state) => state.addConnection);
  const addGroup = useCanvasStore((state) => state.addGroup);
  const updateGroup = useCanvasStore((state) => state.updateGroup);
  const setSelectedCardId = useCanvasStore((state) => state.setSelectedCardId);
  const setSelectedGroupId = useCanvasStore((state) => state.setSelectedGroupId);
  const setConnectionSourceId = useCanvasStore((state) => state.setConnectionSourceId);
  const setPan = useCanvasStore((state) => state.setPan);
  const setZoom = useCanvasStore((state) => state.setZoom);
  const activeNote = useVaultStore((state) => state.activeNote);
  const setActivePath = useVaultStore((state) => state.setActivePath);
  const setView = useUIStore((state) => state.setView);
  const [panning, setPanning] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const importInputRef = useRef<HTMLInputElement>(null);

  const cardMap = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const groupMap = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const hasSelection = Boolean(selectedCardId || selectedGroupId);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select")) return;
      if ((event.key === "Delete" || event.key === "Backspace") && hasSelection) {
        event.preventDefault();
        deleteSelected();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d" && hasSelection) {
        event.preventDefault();
        duplicateSelected();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deleteSelected, duplicateSelected, hasSelection]);

  function addTextCard() {
    const width = 300;
    const height = 180;
    const pos = newObjectPosition(width, height, cards.length);
    addCard({ type: "text", title: "Text card", body: "Write freely on the canvas.", x: pos.x, y: pos.y, width, height });
  }

  function addNoteCard() {
    if (!activeNote) return;
    const width = 320;
    const height = 190;
    const pos = newObjectPosition(width, height, cards.length);
    addCard({
      type: "note",
      title: activeNote.title,
      body: activeNote.content.replace(/^---[\s\S]*?---/, "").trim().slice(0, 220),
      path: activeNote.path,
      x: pos.x,
      y: pos.y,
      width,
      height,
    });
  }

  function addWebCard() {
    const url = window.prompt("Web page URL", "https://obsidian.md");
    if (!url) return;
    const normalized = normalizeUrl(url);
    const width = 380;
    const height = 230;
    const pos = newObjectPosition(width, height, cards.length);
    addCard({ type: "web", title: new URL(normalized).hostname, body: normalized, url: normalized, x: pos.x, y: pos.y, width, height });
  }

  function selectCard(card: CanvasCard) {
    if (connectionSourceId && connectionSourceId !== card.id) {
      addConnection(connectionSourceId, card.id);
      return;
    }
    setSelectedCardId(card.id);
  }

  function newObjectPosition(width: number, height: number, index: number) {
    const stagger = (index % 8) * 28;
    return {
      x: snap(BOARD_WIDTH / 2 - pan.x - width / 2 + stagger),
      y: snap(BOARD_HEIGHT / 2 - pan.y - height / 2 + stagger),
    };
  }

  function snap(value: number) {
    return snapToGrid ? Math.round(value / GRID_SIZE) * GRID_SIZE : Math.round(value);
  }

  function moveSnapped(id: string, x: number, y: number) {
    moveCard(id, snap(x), snap(y));
  }

  function fitContent() {
    const boxes = [
      ...cards.map((card) => ({ x: card.x, y: card.y, width: card.width, height: card.height })),
      ...groups.map((group) => ({ x: group.x, y: group.y, width: group.width, height: group.height })),
    ];
    if (!boxes.length) {
      setPan({ x: 0, y: 0 });
      setZoom(1);
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const box of boxes) {
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    }
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const nextZoom = Math.min(1.6, Math.max(0.45, Math.min(900 / width, 620 / height)));
    setZoom(nextZoom);
    setPan({
      x: BOARD_WIDTH / 2 - (minX + maxX) / 2,
      y: BOARD_HEIGHT / 2 - (minY + maxY) / 2,
    });
  }

  function exportCanvas() {
    const snapshot = JSON.stringify({ cards, groups, connections }, null, 2);
    const blob = new Blob([snapshot], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lattice-canvas-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importCanvas(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<{ cards: CanvasCard[]; groups: CanvasGroup[]; connections: CanvasConnection[] }>;
    replaceCanvas({
      cards: Array.isArray(parsed.cards) ? parsed.cards : [],
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
      connections: Array.isArray(parsed.connections) ? parsed.connections : [],
    });
  }

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[radial-gradient(ellipse_at_center,#0a0a14_0%,#050507_82%)]">
      <aside
        className="relative shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[#08080c]/70 p-4"
        style={{ width: sidebarWidth }}
      >
        <ResizeHandle onResize={(delta) => setSidebarWidth((width) => clamp(width + delta, 220, 460))} />
        <div className="pixel-label mb-3 text-[10px]">Canvas</div>
        <div className="grid grid-cols-2 gap-2">
          <Button className="justify-start text-xs" onClick={addTextCard}>
            <Type size={13} /> Text
          </Button>
          <Button className="justify-start text-xs" onClick={addNoteCard} disabled={!activeNote}>
            <FilePlus2 size={13} /> Note
          </Button>
          <Button className="justify-start text-xs" onClick={addWebCard}>
            <Globe2 size={13} /> Web
          </Button>
          <Button
            className="justify-start text-xs"
            onClick={() => {
              const width = 560;
              const height = 320;
              const pos = newObjectPosition(width, height, groups.length);
              addGroup({ x: pos.x, y: pos.y, width, height });
            }}
          >
            <Group size={13} /> Group
          </Button>
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            void importCanvas(event.currentTarget.files?.[0]).finally(() => {
              event.currentTarget.value = "";
            });
          }}
        />

        <div className="divider my-4" />
        <div className="space-y-2">
          <Button
            className="w-full justify-start text-xs"
            variant={connectionSourceId ? "primary" : "default"}
            disabled={!selectedCardId}
            onClick={() => setConnectionSourceId(connectionSourceId ? null : selectedCardId)}
          >
            <Link2 size={13} /> {connectionSourceId ? "Pick target" : "Connect"}
          </Button>
          <Button className="w-full justify-start text-xs" disabled={!hasSelection} onClick={duplicateSelected}>
            <Copy size={13} /> Duplicate
          </Button>
          <Button className="w-full justify-start text-xs" variant="danger" disabled={!hasSelection} onClick={deleteSelected}>
            <Trash2 size={13} /> Delete selected
          </Button>
          <Button className="w-full justify-start text-xs" variant="ghost" onClick={fitContent}>
            <Maximize size={13} /> Fit content
          </Button>
        </div>

        <div className="divider my-4" />
        <div className="grid grid-cols-2 gap-2">
          <Button className="justify-start text-xs" variant={snapToGrid ? "primary" : "default"} onClick={() => setSnapToGrid((value) => !value)}>
            <RotateCcw size={13} /> Snap
          </Button>
          <Button className="justify-start text-xs" onClick={exportCanvas}>
            <Download size={13} /> Export
          </Button>
          <Button className="justify-start text-xs" onClick={() => importInputRef.current?.click()}>
            <Upload size={13} /> Import
          </Button>
          <Button
            className="justify-start text-xs"
            variant="danger"
            onClick={() => {
              if (window.confirm("Clear the entire canvas?")) clearCanvas();
            }}
          >
            <Eraser size={13} /> Clear
          </Button>
        </div>

        <div className="divider my-4" />
        <div className="pixel-label mb-2 text-[10px]">Selected</div>
        {selectedCardId ? (
          <CardInspector card={cardMap.get(selectedCardId) ?? null} updateCard={updateCard} />
        ) : selectedGroupId ? (
          <GroupInspector group={groupMap.get(selectedGroupId) ?? null} updateGroup={updateGroup} />
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--border)] p-3 text-xs text-[var(--text-3)]">Select a card or group.</div>
        )}
      </aside>

      <div
        className="relative min-w-0 flex-1 overflow-hidden"
        onPointerDown={(event) => {
          setSelectedCardId(null);
          setSelectedGroupId(null);
          setPanning({ x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y });
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!panning) return;
          setPan({ x: panning.panX + (event.clientX - panning.x) / zoom, y: panning.panY + (event.clientY - panning.y) / zoom });
        }}
        onPointerUp={(event) => {
          setPanning(null);
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onWheel={(event) => {
          event.preventDefault();
          setZoom(zoom + (event.deltaY > 0 ? -0.08 : 0.08));
        }}
      >
        <div
          className="absolute left-1/2 top-1/2 origin-center"
          style={{
            width: BOARD_WIDTH,
            height: BOARD_HEIGHT,
            transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
          }}
        >
          <CanvasGrid />
          <ConnectionLayer cards={cardMap} connections={connections} />
          {groups.map((group) => (
            <CanvasGroupBox
              key={group.id}
              group={group}
              selected={selectedGroupId === group.id}
              onSelect={() => setSelectedGroupId(group.id)}
              onMove={(id, x, y) => updateGroup(id, { x: snap(x), y: snap(y) })}
              updateGroup={updateGroup}
              zoom={zoom}
            />
          ))}
          {cards.map((card) => (
            <CanvasCardView
              key={card.id}
              card={card}
              selected={selectedCardId === card.id}
              connectionSource={connectionSourceId === card.id}
              onSelect={() => selectCard(card)}
              onMove={moveSnapped}
              onUpdate={updateCard}
              zoom={zoom}
              onOpenNote={(path) => {
                void setActivePath(path);
                setView("workspace");
              }}
            />
          ))}
        </div>

        <div className="absolute bottom-4 left-4 flex items-center gap-2">
          <div className="glass flex gap-1 rounded-xl p-1">
            <IconButton label="Zoom in" onClick={() => setZoom(zoom + 0.15)}>
              <Plus size={15} />
            </IconButton>
            <IconButton label="Zoom out" onClick={() => setZoom(zoom - 0.15)}>
              <Minus size={15} />
            </IconButton>
            <IconButton label="Reset view" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
              <Maximize size={15} />
            </IconButton>
          </div>
          <div className="glass mono rounded-xl px-3 py-2 text-[11px] text-[var(--text-3)]">{Math.round(zoom * 100)}%</div>
        </div>
      </div>
    </div>
  );
}

function CanvasCardView({
  card,
  selected,
  connectionSource,
  onSelect,
  onMove,
  onUpdate,
  onOpenNote,
  zoom,
}: {
  card: CanvasCard;
  selected: boolean;
  connectionSource: boolean;
  onSelect: () => void;
  onMove: (id: string, x: number, y: number) => void;
  onUpdate: (id: string, patch: Partial<CanvasCard>) => void;
  onOpenNote: (path: string) => void;
  zoom: number;
}) {
  const dragRef = useRef<{ x: number; y: number; cardX: number; cardY: number } | null>(null);
  return (
    <article
      className={`absolute flex flex-col overflow-hidden rounded-lg border bg-[#111116]/95 shadow-[var(--shadow-card)] backdrop-blur-xl ${
        selected ? "border-violet/60 ring-2 ring-violet/20" : connectionSource ? "border-emerald-300/60" : "border-[var(--border)]"
      }`}
      style={{ left: card.x, top: card.y, width: card.width, height: card.height }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
        dragRef.current = { x: event.clientX, y: event.clientY, cardX: card.x, cardY: card.y };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragRef.current) return;
        onMove(card.id, dragRef.current.cardX + (event.clientX - dragRef.current.x) / zoom, dragRef.current.cardY + (event.clientY - dragRef.current.y) / zoom);
      }}
      onPointerUp={(event) => {
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onDoubleClick={() => {
        if (card.type === "note" && card.path) onOpenNote(card.path);
      }}
    >
      <header className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <span className="pixel-label text-[9px]">{card.type}</span>
        <input
          value={card.title}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => onUpdate(card.id, { title: event.target.value })}
          className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none"
        />
      </header>
      {card.type === "text" && (
        <textarea
          value={card.body}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => onUpdate(card.id, { body: event.target.value })}
          className="min-h-0 flex-1 resize-none bg-transparent p-3 text-xs leading-5 text-[var(--text-2)] outline-none"
        />
      )}
      {card.type === "note" && (
        <div className="min-h-0 flex-1 p-3 text-xs leading-5 text-[var(--text-2)]">
          <p>{card.body}</p>
          <div className="mono mt-3 text-[10px] text-[var(--violet-2)]">{card.path}</div>
        </div>
      )}
      {card.type === "web" && (
        <div className="min-h-0 flex-1 p-3">
          <a className="text-xs text-[var(--violet-2)]" href={card.url} target="_blank" rel="noreferrer" onPointerDown={(event) => event.stopPropagation()}>
            {card.url}
          </a>
          <div className="mt-3 grid h-[120px] place-items-center rounded-lg border border-[var(--border)] bg-black/25 text-xs text-[var(--text-3)]">Web page card</div>
        </div>
      )}
    </article>
  );
}

function CanvasGroupBox({
  group,
  selected,
  onSelect,
  onMove,
  updateGroup,
  zoom,
}: {
  group: CanvasGroup;
  selected: boolean;
  onSelect: () => void;
  onMove: (id: string, x: number, y: number) => void;
  updateGroup: (id: string, patch: Partial<CanvasGroup>) => void;
  zoom: number;
}) {
  const dragRef = useRef<{ x: number; y: number; groupX: number; groupY: number } | null>(null);
  return (
    <section
      className={`absolute rounded-lg border ${selected ? "border-violet/60 ring-2 ring-violet/15" : "border-violet/20"}`}
      style={{ left: group.x, top: group.y, width: group.width, height: group.height, background: group.color }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
        dragRef.current = { x: event.clientX, y: event.clientY, groupX: group.x, groupY: group.y };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragRef.current) return;
        onMove(group.id, dragRef.current.groupX + (event.clientX - dragRef.current.x) / zoom, dragRef.current.groupY + (event.clientY - dragRef.current.y) / zoom);
      }}
      onPointerUp={(event) => {
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
    >
      <input
        value={group.label}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => updateGroup(group.id, { label: event.target.value })}
        className="m-3 rounded border border-violet/25 bg-black/30 px-2 py-1 text-xs font-semibold outline-none focus:border-violet/55"
      />
    </section>
  );
}

function ConnectionLayer({ cards, connections }: { cards: Map<string, CanvasCard>; connections: Array<{ id: string; sourceId: string; targetId: string; color: string }> }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full">
      {connections.map((connection) => {
        const source = cards.get(connection.sourceId);
        const target = cards.get(connection.targetId);
        if (!source || !target) return null;
        const x1 = source.x + source.width / 2;
        const y1 = source.y + source.height / 2;
        const x2 = target.x + target.width / 2;
        const y2 = target.y + target.height / 2;
        return <line key={connection.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke={connection.color} strokeWidth={2} strokeOpacity={0.55} />;
      })}
    </svg>
  );
}

function CardInspector({ card, updateCard }: { card: CanvasCard | null; updateCard: (id: string, patch: Partial<CanvasCard>) => void }) {
  if (!card) return null;
  return (
    <div className="card-inner space-y-3 p-3">
      <label className="block text-xs text-[var(--text-2)]">
        Title
        <input
          value={card.title}
          onChange={(event) => updateCard(card.id, { title: event.target.value })}
          className="mt-1 w-full rounded-md border border-[var(--border)] bg-[#09090e] px-2 py-1.5 text-xs text-[var(--text)] outline-none focus:border-violet/45"
        />
      </label>
      <label className="block text-xs">
        Width
        <input type="range" min={180} max={520} value={card.width} onChange={(event) => updateCard(card.id, { width: Number(event.target.value) })} className="mt-2 w-full accent-[#8B7CFF]" />
      </label>
      <label className="block text-xs">
        Height
        <input type="range" min={120} max={420} value={card.height} onChange={(event) => updateCard(card.id, { height: Number(event.target.value) })} className="mt-2 w-full accent-[#8B7CFF]" />
      </label>
    </div>
  );
}

const GROUP_COLORS = [
  "rgba(139,124,255,0.09)",
  "rgba(109,141,255,0.09)",
  "rgba(126,224,180,0.08)",
  "rgba(247,215,116,0.08)",
  "rgba(255,122,138,0.08)",
];

function GroupInspector({ group, updateGroup }: { group: CanvasGroup | null; updateGroup: (id: string, patch: Partial<CanvasGroup>) => void }) {
  if (!group) return null;
  return (
    <div className="card-inner space-y-3 p-3">
      <label className="block text-xs text-[var(--text-2)]">
        Label
        <input
          value={group.label}
          onChange={(event) => updateGroup(group.id, { label: event.target.value })}
          className="mt-1 w-full rounded-md border border-[var(--border)] bg-[#09090e] px-2 py-1.5 text-xs text-[var(--text)] outline-none focus:border-violet/45"
        />
      </label>
      <div>
        <div className="mb-2 text-xs text-[var(--text-2)]">Color</div>
        <div className="flex gap-1.5">
          {GROUP_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`size-6 rounded-md border transition ${group.color === color ? "border-violet/60" : "border-[var(--border)] hover:border-violet/40"}`}
              style={{ background: color }}
              onClick={() => updateGroup(group.id, { color })}
              title={color}
            />
          ))}
        </div>
      </div>
      <label className="block text-xs">
        Width
        <input type="range" min={260} max={1100} value={group.width} onChange={(event) => updateGroup(group.id, { width: Number(event.target.value) })} className="mt-2 w-full accent-[#8B7CFF]" />
      </label>
      <label className="block text-xs">
        Height
        <input type="range" min={160} max={760} value={group.height} onChange={(event) => updateGroup(group.id, { height: Number(event.target.value) })} className="mt-2 w-full accent-[#8B7CFF]" />
      </label>
    </div>
  );
}

function CanvasGrid() {
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage:
          "linear-gradient(rgba(139,124,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(139,124,255,0.055) 1px, transparent 1px)",
        backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
      }}
    />
  );
}

function ResizeHandle({ onResize }: { onResize: (deltaX: number) => void }) {
  return (
    <button
      type="button"
      aria-label="Resize canvas sidebar"
      className="absolute right-0 top-0 z-20 h-full w-2 cursor-col-resize bg-transparent transition hover:bg-violet/20"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        let lastX = event.clientX;
        const move = (moveEvent: PointerEvent) => {
          onResize(moveEvent.clientX - lastX);
          lastX = moveEvent.clientX;
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up, { once: true });
      }}
    />
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeUrl(raw: string) {
  try {
    return new URL(raw).toString();
  } catch {
    return new URL(`https://${raw}`).toString();
  }
}
