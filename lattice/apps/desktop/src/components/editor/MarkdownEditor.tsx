import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { codeFolding, foldGutter, foldKeymap, indentUnit } from "@codemirror/language";
import { search, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, keymap, lineNumbers, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { useEffect, useRef } from "react";
import { latticeCompletions, type CompletionDataSource } from "@/components/editor/completions";
import { FormatToolbar } from "@/components/editor/FormatToolbar";
import { livePreview, livePreviewClickHandler, livePreviewTheme } from "@/components/editor/live-preview";
import { useSettingsStore } from "@/stores/settings-store";
import { listEditorExtensions, subscribeEditorExtensions } from "@/features/plugins/editor-extension-registry";
import { setActiveEditor } from "@/features/plugins/active-editor";

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
  ".cm-foldGutter .cm-gutterElement": {
    cursor: "pointer",
    color: "var(--text-4)",
    opacity: 0.55,
  },
  ".cm-foldGutter .cm-gutterElement:hover": { color: "var(--violet-2)", opacity: 1 },
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
  ".cm-panels": {
    background: "#0c0c12",
    color: "var(--text-2)",
    borderTop: "1px solid rgba(139,124,255,0.18)",
  },
  ".cm-panel.cm-search": {
    padding: "6px 8px",
    fontSize: "12px",
  },
  ".cm-panel.cm-search input": {
    background: "#0a0a10",
    border: "1px solid rgba(139,124,255,0.28)",
    color: "var(--text)",
    borderRadius: "5px",
    padding: "3px 8px",
    marginRight: "4px",
  },
  ".cm-panel.cm-search button": {
    background: "rgba(139,124,255,0.16)",
    color: "var(--text)",
    border: "1px solid rgba(139,124,255,0.28)",
    borderRadius: "5px",
    padding: "3px 8px",
    cursor: "pointer",
    marginRight: "3px",
  },
  ".cm-panel.cm-search button:hover": { background: "rgba(139,124,255,0.28)" },
  ".cm-searchMatch": { background: "rgba(247,215,116,0.32)" },
  ".cm-searchMatch-selected": { background: "rgba(247,215,116,0.55)", outline: "1px solid #f7d774" },
  ".cm-lp-indent-guide": {
    backgroundImage:
      "repeating-linear-gradient(to right, rgba(139,124,255,0.16) 0, rgba(139,124,255,0.16) 1px, transparent 1px, transparent var(--lp-indent-step, 28px))",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "14px 0",
    backgroundSize: "var(--lp-indent-total, 0) 100%",
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
  const pluginExtCompartment = useRef(new Compartment()).current;

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
    const langs = editorSettings.spellcheckLanguages.filter(Boolean).join(",");
    const contentAttributes: Record<string, string> = {
      spellcheck: String(editorSettings.spellCheck),
    };
    if (editorSettings.spellCheck && langs) contentAttributes.lang = langs;
    if (editorSettings.rtl) contentAttributes.dir = "rtl";
    const extensions = [
      editorSettings.lineNumbers ? lineNumbers() : [],
      editorSettings.foldHeading || editorSettings.foldIndent ? codeFolding() : [],
      editorSettings.foldHeading || editorSettings.foldIndent ? foldGutter() : [],
      history(),
      markdown(),
      EditorState.tabSize.of(editorSettings.tabSize),
      indentUnit.of(editorSettings.indentWithTabs ? "\t" : " ".repeat(editorSettings.tabSize)),
      EditorView.contentAttributes.of(contentAttributes),
      editorSettings.lineWrapping ? EditorView.lineWrapping : [],
      editorSettings.autoPairMarkdown || editorSettings.autoPairBrackets
        ? markdownPairs({
            markdown: editorSettings.autoPairMarkdown,
            brackets: editorSettings.autoPairBrackets,
          })
        : [],
      editorSettings.showIndentationGuides ? indentGuides(editorSettings.tabSize) : [],
      search({ top: true }),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        ...foldKeymap,
        indentWithTab,
      ]),
      latticeCompletions(source),
      pluginExtCompartment.of(listEditorExtensions()),
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
    setActiveEditor(view, null);
    return () => {
      setActiveEditor(null, null);
      view.destroy();
      viewRef.current = null;
      exposeView?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editorSettings.autoPairBrackets,
    editorSettings.autoPairMarkdown,
    editorSettings.foldHeading,
    editorSettings.foldIndent,
    editorSettings.indentWithTabs,
    editorSettings.lineNumbers,
    editorSettings.lineWrapping,
    editorSettings.rtl,
    editorSettings.showIndentationGuides,
    editorSettings.spellCheck,
    editorSettings.spellcheckLanguages.join(","),
    editorSettings.tabSize,
    livePreviewEnabled,
  ]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, [value]);

  useEffect(() => {
    return subscribeEditorExtensions(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: pluginExtCompartment.reconfigure(listEditorExtensions()),
      });
    });
  }, [pluginExtCompartment]);

  return (
    <div className="relative h-full min-h-0">
      <div ref={hostRef} className="h-full min-h-0" />
      <FormatToolbar viewRef={viewRef} />
    </div>
  );
}

function markdownPairs({ markdown: md, brackets }: { markdown: boolean; brackets: boolean }) {
  const pairs = new Map<string, string>();
  if (brackets) {
    pairs.set("(", ")");
    pairs.set("[", "]");
    pairs.set("{", "}");
    pairs.set('"', '"');
    pairs.set("'", "'");
  }
  if (md) {
    pairs.set("`", "`");
    pairs.set("*", "*");
    pairs.set("_", "_");
    pairs.set("=", "=");
    pairs.set("~", "~");
  }
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

function indentGuides(tabSize: number) {
  const guideClass = "cm-lp-indent-guide";
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = build(update.view);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );

  function build(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const doc = view.state.doc;
    for (const range of view.visibleRanges) {
      for (let pos = range.from; pos <= range.to; ) {
        const line = doc.lineAt(pos);
        const indent = leadingIndent(line.text, tabSize);
        if (indent > 0) {
          const stepEm = tabSize * 0.6;
          builder.add(
            line.from,
            line.from,
            Decoration.line({
              class: guideClass,
              attributes: {
                style: `--lp-indent-total:${indent * stepEm}em;--lp-indent-step:${stepEm}em`,
              },
            }),
          );
        }
        pos = line.to + 1;
      }
    }
    return builder.finish();
  }

  function leadingIndent(text: string, tab: number): number {
    let units = 0;
    for (const ch of text) {
      if (ch === "\t") units += 1;
      else if (ch === " ") units += 1 / tab;
      else break;
    }
    return Math.floor(units);
  }
}
