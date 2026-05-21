import type { Editor } from "@tiptap/react";
import {
  Code2,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Table2,
  Type,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getMountedEditorView } from "@/components/editor/tiptap-view";

interface SlashItem {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  keywords: string[];
  run: (editor: Editor) => void;
}

const ITEMS: SlashItem[] = [
  {
    id: "h1",
    label: "Heading 1",
    hint: "Large gradient title",
    icon: <Heading1 size={14} />,
    keywords: ["h1", "heading", "title"],
    run: (e) => e.chain().focus().clearNodes().setHeading({ level: 1 }).run(),
  },
  {
    id: "h2",
    label: "Heading 2",
    hint: "Section heading",
    icon: <Heading2 size={14} />,
    keywords: ["h2", "heading"],
    run: (e) => e.chain().focus().clearNodes().setHeading({ level: 2 }).run(),
  },
  {
    id: "h3",
    label: "Heading 3",
    hint: "Sub heading",
    icon: <Heading3 size={14} />,
    keywords: ["h3", "heading"],
    run: (e) => e.chain().focus().clearNodes().setHeading({ level: 3 }).run(),
  },
  {
    id: "p",
    label: "Paragraph",
    hint: "Body text",
    icon: <Type size={14} />,
    keywords: ["paragraph", "text", "p"],
    run: (e) => e.chain().focus().clearNodes().setParagraph().run(),
  },
  {
    id: "ul",
    label: "Bullet list",
    hint: "Unordered list",
    icon: <Minus size={14} />,
    keywords: ["bullet", "list", "ul"],
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    id: "ol",
    label: "Numbered list",
    hint: "Ordered list",
    icon: <ListOrdered size={14} />,
    keywords: ["numbered", "ordered", "list", "ol"],
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "todo",
    label: "Task list",
    hint: "Checkboxes",
    icon: <ListChecks size={14} />,
    keywords: ["task", "todo", "checkbox"],
    run: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    id: "quote",
    label: "Quote",
    hint: "Block quote",
    icon: <Quote size={14} />,
    keywords: ["quote", "blockquote"],
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "code",
    label: "Code block",
    hint: "Monospace code",
    icon: <Code2 size={14} />,
    keywords: ["code", "block"],
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: "divider",
    label: "Divider",
    hint: "Horizontal rule",
    icon: <Minus size={14} />,
    keywords: ["divider", "hr", "line"],
    run: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    id: "image",
    label: "Image",
    hint: "Paste an image URL",
    icon: <ImageIcon size={14} />,
    keywords: ["image", "img", "picture"],
    run: (e) => {
      const url = window.prompt("Image URL");
      if (!url) return;
      e.chain().focus().setImage({ src: url }).run();
    },
  },
  {
    id: "table",
    label: "Table",
    hint: "3x2 markdown table",
    icon: <Table2 size={14} />,
    keywords: ["table", "grid"],
    run: (e) => {
      e
        .chain()
        .focus()
        .insertContent(
          "\n| Column | Column | Column |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n",
        )
        .run();
    },
  },
];

interface WysiwygSlashMenuProps {
  editor: Editor | null;
}

export function WysiwygSlashMenu({ editor }: WysiwygSlashMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const slashFromRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ITEMS;
    return ITEMS.filter((item) =>
      [item.id, item.label.toLowerCase(), ...item.keywords].some((k) => k.includes(q)),
    );
  }, [query]);

  useEffect(() => {
    if (!editor) return;

    const update = () => {
      const view = getMountedEditorView(editor);
      if (!view) return;
      const { state } = view;
      if (!view.hasFocus()) return;
      const { from, empty } = state.selection;
      if (!empty) {
        if (open) setOpen(false);
        return;
      }
      const textBefore = state.doc.textBetween(Math.max(0, from - 60), from, "\n", "\n");
      const match = /(?:^|\n|\s)(\/([\w-]*))$/.exec(textBefore);
      if (!match) {
        if (open) setOpen(false);
        slashFromRef.current = null;
        return;
      }
      const slashOffset = match[1].length;
      const slashStart = from - slashOffset;
      slashFromRef.current = slashStart;
      setQuery(match[2] ?? "");
      setActive(0);
      try {
        const coords = view.coordsAtPos(slashStart);
        const editorRect = view.dom.getBoundingClientRect();
        setPos({
          top: coords.bottom - editorRect.top + 8,
          left: coords.left - editorRect.left,
        });
        if (!open) setOpen(true);
      } catch {
        if (open) setOpen(false);
      }
    };

    editor.on("selectionUpdate", update);
    editor.on("update", update);
    const frame = window.requestAnimationFrame(update);
    return () => {
      window.cancelAnimationFrame(frame);
      editor.off("selectionUpdate", update);
      editor.off("update", update);
    };
  }, [editor, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (!editor || !open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((a) => (a + 1) % Math.max(1, filtered.length));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((a) => (a - 1 + filtered.length) % Math.max(1, filtered.length));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        runItem(filtered[active]);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [active, editor, filtered, open]);

  function runItem(item: SlashItem | undefined) {
    if (!editor || !item) return;
    const from = slashFromRef.current;
    if (from === null) return;
    const to = editor.state.selection.from;
    editor.chain().focus().deleteRange({ from, to }).run();
    item.run(editor);
    setOpen(false);
    setQuery("");
    slashFromRef.current = null;
  }

  if (!open || !editor) return null;

  return (
    <div
      ref={containerRef}
      className="anim-fade-up absolute z-40 w-[300px] rounded-xl border border-violet/30 bg-[#101018]/97 p-1 shadow-[0_24px_80px_rgba(0,0,0,0.6),0_0_0_1px_rgba(139,124,255,0.18)] backdrop-blur-xl"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className="px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--text-4)]">
        Blocks
      </div>
      <div className="max-h-72 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="px-3 py-3 text-xs text-[var(--text-3)]">No matches.</div>
        )}
        {filtered.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => runItem(item)}
            onMouseEnter={() => setActive(index)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition ${
              index === active ? "bg-violet/15 text-white" : "text-[var(--text-2)] hover:bg-white/[0.04]"
            }`}
          >
            <span className="grid size-7 place-items-center rounded-md border border-[var(--border)] bg-black/30 text-[var(--violet-2)]">
              {item.icon}
            </span>
            <span className="flex flex-1 flex-col leading-tight">
              <span className="text-[12px] font-semibold">{item.label}</span>
              <span className="text-[10px] text-[var(--text-3)]">{item.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
