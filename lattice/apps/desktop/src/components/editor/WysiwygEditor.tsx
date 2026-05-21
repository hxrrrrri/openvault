import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef, useState } from "react";
import { Markdown } from "tiptap-markdown";
import { LatticeImage } from "@/components/editor/WysiwygExtensions";

export interface WysiwygEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  exposeEditor?: (editor: Editor | null) => void;
}

const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---\n?/;

function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  const match = content.match(FRONTMATTER_PATTERN);
  if (!match) return { frontmatter: "", body: content };
  return {
    frontmatter: match[0],
    body: content.slice(match[0].length),
  };
}

export function WysiwygEditor({ value, onChange, placeholder, exposeEditor }: WysiwygEditorProps) {
  const onChangeRef = useRef(onChange);
  const exposeRef = useRef(exposeEditor);
  const lastEmittedRef = useRef<string>(value);
  const frontmatterRef = useRef<string>(splitFrontmatter(value).frontmatter);
  const [editorError, setEditorError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    exposeRef.current = exposeEditor;
  }, [exposeEditor]);

  const initialBody = useMemo(() => sanitizeEditorBody(splitFrontmatter(value).body), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: { HTMLAttributes: { class: "lp-code-block" } },
        bulletList: { keepMarks: true },
        link: false,
        orderedList: { keepMarks: true },
        underline: false,
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
      Typography,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: "lp-link" },
      }),
      LatticeImage,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: placeholder ?? "Start writing, or press / for commands...",
        emptyEditorClass: "is-editor-empty",
      }),
      Markdown.configure({
        html: true,
        tightLists: true,
        bulletListMarker: "-",
        linkify: true,
        breaks: false,
        transformPastedText: true,
        transformCopiedText: false,
      }),
    ],
    content: initialBody,
    autofocus: false,
    editorProps: {
      attributes: {
        class: "lattice-prose lattice-wysiwyg focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      const body = safeGetMarkdown(editor);
      if (body === null) {
        setEditorError("The visual editor could not serialize this note. Source text is still preserved.");
        return;
      }
      const composed = frontmatterRef.current + body;
      if (composed === lastEmittedRef.current) return;
      lastEmittedRef.current = composed;
      setEditorError(null);
      onChangeRef.current(composed);
    },
  });

  useEffect(() => {
    if (!editor) {
      exposeRef.current?.(null);
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      exposeRef.current?.(editor);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      exposeRef.current?.(null);
    };
  }, [editor]);

  useEffect(() => {
    return () => {
      exposeRef.current?.(null);
    };
  }, []);

  // Sync external value changes back into the editor (e.g. file switch).
  useEffect(() => {
    if (!editor) return;
    const { frontmatter, body } = splitFrontmatter(value);
    frontmatterRef.current = frontmatter;
    if (value === lastEmittedRef.current) return;
    const current = safeGetMarkdown(editor);
    if (current === null) {
      setEditorError("The visual editor could not read this note. Use split view to edit the Markdown source.");
      return;
    }
    if (current === body) {
      lastEmittedRef.current = value;
      return;
    }
    try {
      editor.commands.setContent(sanitizeEditorBody(body), { emitUpdate: false });
      setEditorError(null);
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "The visual editor could not open this note.");
    }
    lastEmittedRef.current = value;
  }, [editor, value]);

  return (
    <div className="lattice-wysiwyg-host h-full min-h-0 overflow-y-auto">
      {editorError && (
        <div className="mx-auto mt-4 max-w-[860px] rounded-lg border border-amber-300/25 bg-amber-400/5 px-4 py-2 text-xs text-amber-100/85">
          {editorError}
        </div>
      )}
      <EditorContent editor={editor} className="lattice-wysiwyg-wrap" />
    </div>
  );
}

function safeGetMarkdown(editor: Editor): string | null {
  try {
    return (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown();
  } catch {
    return null;
  }
}

function sanitizeEditorBody(value: string): string {
  return value.replace(/\u0000/g, "");
}
