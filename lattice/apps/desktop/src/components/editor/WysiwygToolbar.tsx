import type { Editor } from "@tiptap/react";
import {
  Bold,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Strikethrough,
  Underline,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getMountedEditorView } from "@/components/editor/tiptap-view";

interface WysiwygToolbarProps {
  editor: Editor | null;
}

export function WysiwygToolbar({ editor }: WysiwygToolbarProps) {
  const [pos, setPos] = useState<{ top: number; left: number; visible: boolean }>({
    top: 0,
    left: 0,
    visible: false,
  });

  useEffect(() => {
    if (!editor) {
      setPos((p) => (p.visible ? { ...p, visible: false } : p));
      return;
    }
    const update = () => {
      const view = getMountedEditorView(editor);
      if (!view) {
        setPos((p) => (p.visible ? { ...p, visible: false } : p));
        return;
      }
      const { state } = view;
      const { from, to, empty } = state.selection;
      if (empty || !view.hasFocus()) {
        setPos((p) => (p.visible ? { ...p, visible: false } : p));
        return;
      }
      try {
        const start = view.coordsAtPos(from);
        const end = view.coordsAtPos(to);
        const editorRect = view.dom.getBoundingClientRect();
        const top = Math.min(start.top, end.top) - editorRect.top - 46;
        const left = (start.left + end.right) / 2 - editorRect.left;
        setPos({ top: Math.max(top, 4), left, visible: true });
      } catch {
        setPos((p) => (p.visible ? { ...p, visible: false } : p));
      }
    };
    const hide = () =>
      setTimeout(() => setPos((p) => (p.visible ? { ...p, visible: false } : p)), 100);
    editor.on("selectionUpdate", update);
    editor.on("blur", hide);
    editor.on("focus", update);
    const frame = window.requestAnimationFrame(update);
    return () => {
      window.cancelAnimationFrame(frame);
      editor.off("selectionUpdate", update);
      editor.off("focus", update);
      editor.off("blur", hide);
    };
  }, [editor]);

  if (!editor || !pos.visible) return null;

  return (
    <div
      className="pointer-events-auto absolute z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-violet/30 bg-[#101018]/95 px-1.5 py-1 shadow-[0_18px_60px_rgba(0,0,0,0.5),0_0_0_1px_rgba(139,124,255,0.18)] backdrop-blur-xl"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <Btn label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={13} />
      </Btn>
      <Btn label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={13} />
      </Btn>
      <Btn label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <Underline size={13} />
      </Btn>
      <Btn label="Strike" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough size={13} />
      </Btn>
      <Btn label="Highlight" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()}>
        <Highlighter size={13} />
      </Btn>
      <Btn label="Code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code2 size={13} />
      </Btn>
      <Divider />
      <Btn label="H1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 size={13} />
      </Btn>
      <Btn label="H2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 size={13} />
      </Btn>
      <Btn label="H3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 size={13} />
      </Btn>
      <Divider />
      <Btn label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List size={13} />
      </Btn>
      <Btn label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered size={13} />
      </Btn>
      <Btn label="Task list" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <ListTodo size={13} />
      </Btn>
      <Btn label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote size={13} />
      </Btn>
      <Divider />
      <Btn
        label="Link"
        active={editor.isActive("link")}
        onClick={() => {
          const previous = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("URL", previous ?? "https://");
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
          }
          editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }}
      >
        <Link2 size={13} />
      </Btn>
    </div>
  );
}

function Btn({
  active,
  children,
  label,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`grid size-7 place-items-center rounded-md transition ${
        active ? "bg-violet/25 text-white" : "text-[var(--text-2)] hover:bg-violet/15 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-[var(--border)]" />;
}
