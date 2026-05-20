import { FilePlus2, Globe2, Group, Link2, Maximize, Minus, Plus, RotateCcw, Trash2, Type } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { useCanvasStore, type CanvasCard, type CanvasGroup } from "@/stores/canvas-store";
import { useUIStore } from "@/stores/ui-store";
import { useVaultStore } from "@/stores/vault-store";

export function CanvasView() {
  const cards = useCanvasStore((state) => state.cards);
  const connections = useCanvasStore((state) => state.connections);
  const groups = useCanvasStore((state) => state.groups);
  const selectedCardId = useCanvasStore((state) => state.selectedCardId);
  const connectionSourceId = useCanvasStore((state) => state.connectionSourceId);
  const pan = useCanvasStore((state) => state.pan);
  const zoom = useCanvasStore((state) => state.zoom);
  const addCard = useCanvasStore((state) => state.addCard);
  const updateCard = useCanvasStore((state) => state.updateCard);
  const moveCard = useCanvasStore((state) => state.moveCard);
  const deleteSelected = useCanvasStore((state) => state.deleteSelected);
  const addConnection = useCanvasStore((state) => state.addConnection);
  const addGroup = useCanvasStore((state) => state.addGroup);
  const updateGroup = useCanvasStore((state) => state.updateGroup);
  const setSelectedCardId = useCanvasStore((state) => state.setSelectedCardId);
  const setConnectionSourceId = useCanvasStore((state) => state.setConnectionSourceId);
  const setPan = useCanvasStore((state) => state.setPan);
  const setZoom = useCanvasStore((state) => state.setZoom);
  const resetCanvas = useCanvasStore((state) => state.resetCanvas);
  const activeNote = useVaultStore((state) => state.activeNote);
  const setActivePath = useVaultStore((state) => state.setActivePath);
  const setView = useUIStore((state) => state.setView);
  const [panning, setPanning] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const cardMap = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);

  function addTextCard() {
    addCard({ type: "text", title: "Text card", body: "Write freely on the canvas.", x: 260 - pan.x, y: 180 - pan.y, width: 280, height: 170 });
  }

  function addNoteCard() {
    if (!activeNote) return;
    addCard({
      type: "note",
      title: activeNote.title,
      body: activeNote.content.replace(/^---[\s\S]*?---/, "").trim().slice(0, 220),
      path: activeNote.path,
      x: 320 - pan.x,
      y: 220 - pan.y,
      width: 300,
      height: 180,
    });
  }

  function addWebCard() {
    const url = window.prompt("Web page URL", "https://obsidian.md");
    if (!url) return;
    const normalized = normalizeUrl(url);
    addCard({ type: "web", title: new URL(normalized).hostname, body: normalized, url: normalized, x: 360 - pan.x, y: 240 - pan.y, width: 360, height: 220 });
  }

  function selectCard(card: CanvasCard) {
    if (connectionSourceId && connectionSourceId !== card.id) {
      addConnection(connectionSourceId, card.id);
      return;
    }
    setSelectedCardId(card.id);
  }

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[radial-gradient(ellipse_at_center,#0a0a14_0%,#050507_82%)]">
      <aside className="w-64 shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[#08080c]/70 p-4">
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
          <Button className="justify-start text-xs" onClick={addGroup}>
            <Group size={13} /> Group
          </Button>
        </div>

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
          <Button className="w-full justify-start text-xs" variant="danger" disabled={!selectedCardId} onClick={deleteSelected}>
            <Trash2 size={13} /> Delete card
          </Button>
          <Button className="w-full justify-start text-xs" variant="ghost" onClick={resetCanvas}>
            <RotateCcw size={13} /> Reset board
          </Button>
        </div>

        <div className="divider my-4" />
        <div className="pixel-label mb-2 text-[10px]">Selected</div>
        {selectedCardId ? (
          <CardInspector card={cardMap.get(selectedCardId) ?? null} updateCard={updateCard} />
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--border)] p-3 text-xs text-[var(--text-3)]">Select a card.</div>
        )}
      </aside>

      <div
        className="relative min-w-0 flex-1 overflow-hidden"
        onPointerDown={(event) => {
          setSelectedCardId(null);
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
          className="absolute left-1/2 top-1/2 h-[3000px] w-[4200px] origin-center"
          style={{ transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})` }}
        >
          <CanvasGrid />
          <ConnectionLayer cards={cardMap} connections={connections} />
          {groups.map((group) => (
            <CanvasGroupBox key={group.id} group={group} updateGroup={updateGroup} />
          ))}
          {cards.map((card) => (
            <CanvasCardView
              key={card.id}
              card={card}
              selected={selectedCardId === card.id}
              connectionSource={connectionSourceId === card.id}
              onSelect={() => selectCard(card)}
              onMove={moveCard}
              onUpdate={updateCard}
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
}: {
  card: CanvasCard;
  selected: boolean;
  connectionSource: boolean;
  onSelect: () => void;
  onMove: (id: string, x: number, y: number) => void;
  onUpdate: (id: string, patch: Partial<CanvasCard>) => void;
  onOpenNote: (path: string) => void;
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
        onMove(card.id, dragRef.current.cardX + event.clientX - dragRef.current.x, dragRef.current.cardY + event.clientY - dragRef.current.y);
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

function CanvasGroupBox({ group, updateGroup }: { group: CanvasGroup; updateGroup: (id: string, patch: Partial<CanvasGroup>) => void }) {
  const dragRef = useRef<{ x: number; y: number; groupX: number; groupY: number } | null>(null);
  return (
    <section
      className="absolute rounded-lg border border-violet/20"
      style={{ left: group.x, top: group.y, width: group.width, height: group.height, background: group.color }}
      onPointerDown={(event) => {
        event.stopPropagation();
        dragRef.current = { x: event.clientX, y: event.clientY, groupX: group.x, groupY: group.y };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragRef.current) return;
        updateGroup(group.id, { x: dragRef.current.groupX + event.clientX - dragRef.current.x, y: dragRef.current.groupY + event.clientY - dragRef.current.y });
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
        className="m-3 rounded border border-violet/20 bg-black/30 px-2 py-1 text-xs font-semibold outline-none"
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

function CanvasGrid() {
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    />
  );
}

function normalizeUrl(raw: string) {
  try {
    return new URL(raw).toString();
  } catch {
    return new URL(`https://${raw}`).toString();
  }
}
