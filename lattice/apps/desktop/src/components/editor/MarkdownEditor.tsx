import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { useEffect, useRef } from "react";
import { latticeCompletions, type CompletionDataSource } from "@/components/editor/completions";
import { FormatToolbar } from "@/components/editor/FormatToolbar";
import { livePreview, livePreviewClickHandler, livePreviewTheme } from "@/components/editor/live-preview";
import { useSettingsStore } from "@/stores/settings-store";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  completionSource?: CompletionDataSource;
  onOpenLink?: (target: string) => void;
  livePreviewEnabled?: boolean;
  exposeView?: (view: EditorView | null) => void;
}

const latticeTheme = EditorView.theme({
  "&": {
    background: "transparent",
    color: "var(--text)",
    height: "100%",
    fontSize: "16.5px",
  },
  ".cm-scroller": {
    fontFamily:
      '"Inter", "Segoe UI Variable", ui-sans-serif, system-ui, sans-serif',
    lineHeight: "1.8",
    fontFeatureSettings: '"ss01", "cv11"',
  },
  ".cm-gutters": {
    background: "transparent",
    border: "none",
    color: "var(--text-4)",
    paddingRight: "6px",
  },
  ".cm-activeLine": {
    background:
      "linear-gradient(90deg, rgba(139,124,255,0.10), rgba(139,124,255,0.02) 60%, transparent)",
    boxShadow: "inset 2px 0 0 rgba(139,124,255,0.55)",
    borderRadius: "0 8px 8px 0",
  },
  ".cm-activeLineGutter": { background: "transparent", color: "var(--violet-2)" },
  ".cm-content": {
    caretColor: "var(--violet-2)",
    padding: "28px 0 160px",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftWidth: "2px",
    borderLeftColor: "var(--violet-2)",
    boxShadow: "0 0 10px rgba(169,155,255,0.5)",
  },
  ".cm-line": { padding: "0 14px" },
  "&.cm-focused": { outline: "none" },
  ".cm-tooltip": {
    background: "#0f0f15",
    border: "1px solid rgba(139,124,255,0.3)",
    borderRadius: "8px",
    boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
    color: "var(--text-2)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete": { padding: "4px" },
  ".cm-tooltip-autocomplete > ul": {
    fontFamily: "Inter, system-ui",
    fontSize: "12px",
    maxHeight: "280px",
  },
  ".cm-tooltip-autocomplete > ul > li": {
    borderRadius: "6px",
    padding: "5px 10px",
    color: "var(--text-2)",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    background: "rgba(139,124,255,0.18)",
    color: "#ffffff",
  },
  ".cm-completionDetail": { color: "var(--text-3)", fontStyle: "normal", fontSize: "11px", marginLeft: "8px" },
  ".cm-selectionBackground, .cm-content ::selection": {
    background: "rgba(139,124,255,0.25) !important",
  },
});

export function MarkdownEditor({
  value,
  onChange,
  completionSource,
  onOpenLink,
  livePreviewEnabled = true,
  exposeView,
}: MarkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onOpenLinkRef = useRef(onOpenLink);
  const sourceRef = useRef(completionSource);
  const editorSettings = useSettingsStore((state) => state.editor);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    onOpenLinkRef.current = onOpenLink;
  }, [onOpenLink]);
  useEffect(() => {
    sourceRef.current = completionSource;
  }, [completionSource]);

  useEffect(() => {
    if (!hostRef.current) return;
    const source: CompletionDataSource = {
      notes: () => sourceRef.current?.notes() ?? [],
      tags: () => sourceRef.current?.tags() ?? [],
    };
    const extensions = [
      editorSettings.lineNumbers ? lineNumbers() : [],
      history(),
      markdown(),
      EditorState.tabSize.of(editorSettings.tabSize),
      EditorView.contentAttributes.of({ spellcheck: String(editorSettings.spellCheck) }),
      editorSettings.lineWrapping ? EditorView.lineWrapping : [],
      editorSettings.autoPairMarkdown ? markdownPairs() : [],
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      latticeCompletions(source),
      livePreviewEnabled ? livePreview : [],
      livePreviewEnabled ? livePreviewTheme : [],
      livePreviewEnabled && onOpenLink
        ? livePreviewClickHandler((target) => onOpenLinkRef.current?.(target))
        : [],
      latticeTheme,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onChangeRef.current(update.state.doc.toString());
      }),
    ];
    const state = EditorState.create({ doc: value, extensions });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    exposeView?.(view);
    return () => {
      view.destroy();
      viewRef.current = null;
      exposeView?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editorSettings.autoPairMarkdown,
    editorSettings.lineNumbers,
    editorSettings.lineWrapping,
    editorSettings.spellCheck,
    editorSettings.tabSize,
    livePreviewEnabled,
  ]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, [value]);

  return (
    <div className="relative h-full min-h-0">
      <div ref={hostRef} className="h-full min-h-0" />
      <FormatToolbar viewRef={viewRef} />
    </div>
  );
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
