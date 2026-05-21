import type { EditorView } from "@codemirror/view";
import {
  Bold,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link,
  List,
  ListOrdered,
  Plus,
  Quote,
  Smile,
  Strikethrough,
  SquareCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EmojiPicker } from "@/components/editor/EmojiPicker";
import { InsertMenu } from "@/components/editor/InsertMenu";

interface FormatToolbarProps {
  viewRef: { current: EditorView | null };
}

interface ToolbarPosition {
  top: number;
  left: number;
  visible: boolean;
}

export function FormatToolbar({ viewRef }: FormatToolbarProps) {
  const [pos, setPos] = useState<ToolbarPosition>({ top: 0, left: 0, visible: false });
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const update = () => {
      const sel = view.state.selection.main;
      if (sel.empty) {
        setPos((p) => (p.visible ? { ...p, visible: false } : p));
        return;
      }
      const coordsFrom = view.coordsAtPos(sel.from);
      const coordsTo = view.coordsAtPos(sel.to);
      if (!coordsFrom || !coordsTo) {
        setPos((p) => (p.visible ? { ...p, visible: false } : p));
        return;
      }
      const editorRect = view.dom.getBoundingClientRect();
      const top = Math.min(coordsFrom.top, coordsTo.top) - editorRect.top - 46;
      const left = (coordsFrom.left + coordsTo.right) / 2 - editorRect.left;
      setPos({ top: Math.max(top, 4), left, visible: true });
    };
    const handler = setInterval(update, 80);
    return () => clearInterval(handler);
  }, [viewRef]);

  if (!pos.visible) return null;

  return (
    <div
      ref={toolbarRef}
      className="pointer-events-auto absolute z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-violet/30 bg-[#101018]/95 px-1.5 py-1 shadow-[0_18px_60px_rgba(0,0,0,0.5),0_0_0_1px_rgba(139,124,255,0.18)] backdrop-blur-xl"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <ToolBtn label="Bold" onClick={() => wrap(viewRef.current, "**", "**")}>
        <Bold size={13} />
      </ToolBtn>
      <ToolBtn label="Italic" onClick={() => wrap(viewRef.current, "*", "*")}>
        <Italic size={13} />
      </ToolBtn>
      <ToolBtn label="Strikethrough" onClick={() => wrap(viewRef.current, "~~", "~~")}>
        <Strikethrough size={13} />
      </ToolBtn>
      <ToolBtn label="Highlight" onClick={() => wrap(viewRef.current, "==", "==")}>
        <Highlighter size={13} />
      </ToolBtn>
      <ToolBtn label="Inline code" onClick={() => wrap(viewRef.current, "`", "`")}>
        <Code2 size={13} />
      </ToolBtn>
      <Divider />
      <ToolBtn label="Heading 1" onClick={() => linePrefix(viewRef.current, "# ")}>
        <Heading1 size={13} />
      </ToolBtn>
      <ToolBtn label="Heading 2" onClick={() => linePrefix(viewRef.current, "## ")}>
        <Heading2 size={13} />
      </ToolBtn>
      <ToolBtn label="Heading 3" onClick={() => linePrefix(viewRef.current, "### ")}>
        <Heading3 size={13} />
      </ToolBtn>
      <Divider />
      <ToolBtn label="Bullet list" onClick={() => linePrefix(viewRef.current, "- ")}>
        <List size={13} />
      </ToolBtn>
      <ToolBtn label="Numbered list" onClick={() => linePrefix(viewRef.current, "1. ")}>
        <ListOrdered size={13} />
      </ToolBtn>
      <ToolBtn label="Task" onClick={() => linePrefix(viewRef.current, "- [ ] ")}>
        <SquareCheck size={13} />
      </ToolBtn>
      <ToolBtn label="Quote" onClick={() => linePrefix(viewRef.current, "> ")}>
        <Quote size={13} />
      </ToolBtn>
      <Divider />
      <ToolBtn label="Wikilink" onClick={() => wrap(viewRef.current, "[[", "]]")}>
        <Link size={13} />
      </ToolBtn>
      <Divider />
      <ColorPicker viewRef={viewRef} kind="text" />
      <ColorPicker viewRef={viewRef} kind="bg" />
      <Divider />
      <EmojiTrigger viewRef={viewRef} />
      <InsertTrigger viewRef={viewRef} />
    </div>
  );
}

function EmojiTrigger({ viewRef }: { viewRef: { current: EditorView | null } }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const position = useAnchoredPanel(open, triggerRef, 360, 470);
  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        title="Emoji"
        onClick={() => setOpen((o) => !o)}
        className="grid size-7 place-items-center rounded-md text-[var(--text-2)] transition hover:bg-violet/15 hover:text-white"
      >
        <Smile size={13} />
      </button>
      {open && position && createPortal(
        <>
          <button
            type="button"
            aria-label="Close emoji picker"
            className="fixed inset-0 z-[300] cursor-default bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-[310]"
            style={{ top: position.top, left: position.left }}
            onMouseDown={(event) => event.stopPropagation()}
          >
          <EmojiPicker
            maxHeight={position.maxHeight}
            onPick={(emoji) => {
              const view = viewRef.current;
              if (!view) return;
              const sel = view.state.selection.main;
              view.dispatch({
                changes: { from: sel.from, to: sel.to, insert: emoji },
                selection: { anchor: sel.from + emoji.length },
              });
              view.focus();
            }}
            onClose={() => setOpen(false)}
          />
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

function InsertTrigger({ viewRef }: { viewRef: { current: EditorView | null } }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const position = useAnchoredPanel(open, triggerRef, 430, 560);
  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        title="Insert media / embed"
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 items-center gap-1 rounded-md bg-violet/15 px-2 text-[11px] font-semibold text-white transition hover:bg-violet/25"
      >
        <Plus size={12} /> Insert
      </button>
      {open && position && createPortal(
        <>
          <button
            type="button"
            aria-label="Close insert menu"
            className="fixed inset-0 z-[300] cursor-default bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-[310]"
            style={{ top: position.top, left: position.left }}
            onMouseDown={(event) => event.stopPropagation()}
          >
          <InsertMenu
            maxHeight={position.maxHeight}
            width={430}
            onInsert={(text) => {
              const view = viewRef.current;
              if (!view) return;
              const sel = view.state.selection.main;
              view.dispatch({
                changes: { from: sel.from, to: sel.to, insert: text },
                selection: { anchor: sel.from + text.length },
              });
              view.focus();
            }}
            onClose={() => setOpen(false)}
          />
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

function ToolBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md text-[var(--text-2)] transition hover:bg-violet/15 hover:text-white"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-[var(--border)]" />;
}

const PALETTE: Array<{ color: string; label: string }> = [
  { color: "#ffffff", label: "White" },
  { color: "#b6abff", label: "Violet" },
  { color: "#8eaaff", label: "Indigo" },
  { color: "#7ee0b4", label: "Emerald" },
  { color: "#f7d774", label: "Amber" },
  { color: "#ff7a8a", label: "Coral" },
  { color: "#cdb8ff", label: "Lavender" },
  { color: "#a6a6c1", label: "Slate" },
];

function ColorPicker({
  viewRef,
  kind,
}: {
  viewRef: { current: EditorView | null };
  kind: "text" | "bg";
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        title={kind === "text" ? "Text color" : "Background color"}
        onClick={() => setOpen((o) => !o)}
        className="grid size-7 place-items-center rounded-md text-[var(--text-2)] transition hover:bg-violet/15 hover:text-white"
      >
        <span
          className="mono text-[10px] font-bold"
          style={{
            background: kind === "bg" ? "rgba(247,215,116,0.4)" : "transparent",
            color: kind === "text" ? "#b6abff" : "#fff",
            padding: "0 4px",
            borderRadius: 3,
          }}
        >
          A
        </span>
      </button>
      {open && (
        <div
          className="absolute left-1/2 top-9 z-40 flex w-44 -translate-x-1/2 flex-wrap gap-1 rounded-lg border border-[#30294f] bg-[#101018] p-2 shadow-[0_14px_40px_rgba(0,0,0,0.5)]"
          onMouseDown={(event) => event.preventDefault()}
        >
          {PALETTE.map((swatch) => (
            <button
              key={swatch.color}
              type="button"
              title={swatch.label}
              className="size-6 rounded-md border border-[#2f2a55] transition hover:scale-110 hover:border-violet/45"
              style={{ background: swatch.color }}
              onClick={() => {
                const view = viewRef.current;
                if (!view) return;
                const sel = view.state.selection.main;
                if (sel.empty) {
                  setOpen(false);
                  return;
                }
                const text = view.state.doc.sliceString(sel.from, sel.to);
                const style =
                  kind === "text"
                    ? `color:${swatch.color}`
                    : `background-color:${swatch.color};padding:0 4px;border-radius:3px`;
                const replaced = `<span style="${style}">${text}</span>`;
                view.dispatch({
                  changes: { from: sel.from, to: sel.to, insert: replaced },
                  selection: { anchor: sel.from + replaced.length },
                });
                view.focus();
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function wrap(view: EditorView | null, left: string, right: string) {
  if (!view) return;
  const sel = view.state.selection.main;
  const text = view.state.doc.sliceString(sel.from, sel.to);
  const insert = `${left}${text || ""}${right}`;
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert },
    selection: text
      ? { anchor: sel.from + left.length + text.length + right.length }
      : { anchor: sel.from + left.length },
  });
  view.focus();
}

function linePrefix(view: EditorView | null, prefix: string) {
  if (!view) return;
  const sel = view.state.selection.main;
  const line = view.state.doc.lineAt(sel.from);
  const text = line.text;
  const cleaned = text.replace(/^(\s*)([#>\-*]+\s+|\d+\.\s+|- \[[ x]\] )?/, "$1");
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: `${cleaned ? "" : ""}${prefix}${cleaned}` },
    selection: { anchor: line.from + prefix.length + cleaned.length },
  });
  view.focus();
}

function useAnchoredPanel(
  open: boolean,
  ref: React.RefObject<HTMLElement | null>,
  width: number,
  preferredMaxHeight: number,
) {
  const [position, setPosition] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const update = () => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 18;
      const gap = 10;
      const anchorCenter = rect.left + rect.width / 2;
      const left = clamp(anchorCenter - width / 2, margin, window.innerWidth - width - margin);
      const top = Math.min(rect.bottom + gap, window.innerHeight - 340);
      setPosition({
        top: Math.max(margin, top),
        left,
        maxHeight: Math.min(preferredMaxHeight, Math.max(320, window.innerHeight - top - margin)),
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, preferredMaxHeight, ref, width]);

  return position;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
