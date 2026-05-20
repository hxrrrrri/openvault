import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { useEffect, useRef } from "react";
import { useSettingsStore } from "@/stores/settings-store";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const latticeTheme = EditorView.theme({
  "&": {
    background: "transparent",
    color: "var(--text-2)",
    height: "100%",
    fontSize: "14px",
  },
  ".cm-scroller": {
    fontFamily: "Inter, ui-sans-serif, system-ui",
    lineHeight: "1.8",
  },
  ".cm-gutters": {
    background: "transparent",
    border: "none",
    color: "var(--text-4)",
  },
  ".cm-activeLine": {
    background: "linear-gradient(90deg, rgba(139,124,255,0.08), transparent)",
    boxShadow: "inset 2px 0 0 rgba(139,124,255,0.6)",
  },
  ".cm-activeLineGutter": {
    background: "transparent",
    color: "var(--violet-2)",
  },
  ".cm-content": {
    caretColor: "var(--violet-2)",
    padding: "24px 0 80px",
  },
  ".cm-line": {
    padding: "0 12px",
  },
  "&.cm-focused": {
    outline: "none",
  },
});

export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const editorSettings = useSettingsStore((state) => state.editor);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!hostRef.current) return;
    const extensions = [
      editorSettings.lineNumbers ? lineNumbers() : [],
      history(),
      markdown(),
      EditorState.tabSize.of(editorSettings.tabSize),
      EditorView.contentAttributes.of({ spellcheck: String(editorSettings.spellCheck) }),
      editorSettings.lineWrapping ? EditorView.lineWrapping : [],
      editorSettings.autoPairMarkdown ? markdownPairs() : [],
      keymap.of([...defaultKeymap, ...historyKeymap]),
      latticeTheme,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
    ];
    const state = EditorState.create({
      doc: value,
      extensions,
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [
    editorSettings.autoPairMarkdown,
    editorSettings.lineNumbers,
    editorSettings.lineWrapping,
    editorSettings.spellCheck,
    editorSettings.tabSize,
  ]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  return <div ref={hostRef} className="h-full min-h-0" />;
}

function markdownPairs() {
  const pairs = new Map([
    ["[", "]"],
    ["(", ")"],
    ["{", "}"],
    ['"', '"'],
    ["'", "'"],
    ["`", "`"],
    ["*", "*"],
    ["_", "_"],
  ]);

  return EditorView.inputHandler.of((view, from, to, text) => {
    const closing = pairs.get(text);
    if (!closing || from !== to) return false;
    view.dispatch({
      changes: { from, to, insert: `${text}${closing}` },
      selection: { anchor: from + text.length },
    });
    return true;
  });
}
