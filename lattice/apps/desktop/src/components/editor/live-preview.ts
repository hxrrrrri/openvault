import { syntaxTree } from "@codemirror/language";
import { type EditorState, RangeSetBuilder, StateField } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
// SyntaxNodeRef shape from @lezer/common (transitive via @codemirror/language)
interface SyntaxNodeRef {
  name: string;
  from: number;
  to: number;
}

const headingMarks: Record<string, Decoration> = {
  ATXHeading1: Decoration.line({ class: "cm-lp-h1" }),
  ATXHeading2: Decoration.line({ class: "cm-lp-h2" }),
  ATXHeading3: Decoration.line({ class: "cm-lp-h3" }),
  ATXHeading4: Decoration.line({ class: "cm-lp-h4" }),
  ATXHeading5: Decoration.line({ class: "cm-lp-h5" }),
  ATXHeading6: Decoration.line({ class: "cm-lp-h6" }),
};

const hideMark = Decoration.replace({});

const inlineMarkNames = new Set([
  "EmphasisMark",
  "StrongEmphasisMark",
  "StrikethroughMark",
  "InlineCode",
  "CodeMark",
  "HeaderMark",
  "QuoteMark",
  "LinkMark",
  "URL",
  "LinkTitle",
  "LinkLabel",
  "Highlight",
  "HighlightMark",
]);

class WikilinkWidget extends WidgetType {
  constructor(private readonly target: string, private readonly label: string, private readonly embed: boolean) {
    super();
  }
  eq(other: WikilinkWidget) {
    return other.target === this.target && other.label === this.label && other.embed === this.embed;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = this.embed ? "cm-lp-embed" : "cm-lp-wikilink";
    span.dataset.target = this.target;
    span.textContent = (this.embed ? "⎘ " : "") + this.label;
    span.title = this.target;
    return span;
  }
  ignoreEvent() {
    return false;
  }
}

class HighlightWidget extends WidgetType {
  constructor(private readonly text: string) {
    super();
  }
  eq(other: HighlightWidget) {
    return other.text === this.text;
  }
  toDOM() {
    const mark = document.createElement("mark");
    mark.className = "cm-lp-highlight";
    mark.textContent = this.text;
    return mark;
  }
  ignoreEvent() {
    return false;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(private readonly checked: boolean) {
    super();
  }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked;
  }
  toDOM() {
    const wrap = document.createElement("span");
    wrap.className = "cm-lp-checkbox" + (this.checked ? " cm-lp-checkbox-on" : "");
    wrap.textContent = this.checked ? "■" : "□";
    return wrap;
  }
  ignoreEvent() {
    return true;
  }
}

interface CursorRange {
  from: number;
  to: number;
}

function cursorTouches(ranges: CursorRange[], from: number, to: number): boolean {
  for (const range of ranges) {
    if (range.from <= to && range.to >= from) return true;
  }
  return false;
}

function buildDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const selection = state.selection;
  const ranges: CursorRange[] = selection.ranges.map((r) => ({
    from: state.doc.lineAt(r.from).from,
    to: state.doc.lineAt(r.to).to,
  }));
  const doc = state.doc;
  const sourceText = doc.toString();

  syntaxTree(state).iterate({
    enter(node: SyntaxNodeRef) {
      const name = node.name;
      if (headingMarks[name]) {
        const line = doc.lineAt(node.from);
        builder.add(line.from, line.from, headingMarks[name]);
        return;
      }
      if (name === "Blockquote") {
        const lineFrom = doc.lineAt(node.from);
        const firstLine = sourceText.slice(lineFrom.from, lineFrom.to);
        const calloutMatch = firstLine.match(/^>\s*\[!([A-Za-z][\w-]*)\]([+-]?)/);
        if (calloutMatch) {
          const type = calloutMatch[1].toLowerCase();
          const decoration = Decoration.line({ class: `cm-lp-callout cm-lp-callout-${type}` });
          let pos = node.from;
          while (pos <= node.to) {
            const line = doc.lineAt(pos);
            builder.add(line.from, line.from, decoration);
            if (line.to >= node.to) break;
            pos = line.to + 1;
          }
        }
        return;
      }
    },
  });

  // Inline pass - need a second pass because we want decorations sorted by from
  const inlineRanges: Array<{ from: number; to: number; deco: Decoration }> = [];

  syntaxTree(state).iterate({
    enter(node: SyntaxNodeRef) {
      const name = node.name;
      const from = node.from;
      const to = node.to;
      if (name === "FencedCode" || name === "CodeBlock") return false;
      if (name === "HeaderMark" || name === "QuoteMark") {
        if (!cursorTouches(ranges, from, to)) {
          // hide the leading marker plus the space after it on the same line
          let endHide = to;
          if (endHide < doc.length && sourceText[endHide] === " ") endHide += 1;
          inlineRanges.push({ from, to: endHide, deco: hideMark });
        }
        return;
      }
      if (name === "EmphasisMark" || name === "StrongEmphasisMark" || name === "StrikethroughMark") {
        if (!cursorTouches(ranges, from, to)) {
          inlineRanges.push({ from, to, deco: hideMark });
        }
        return;
      }
      if (name === "CodeMark") {
        if (!cursorTouches(ranges, from, to)) {
          inlineRanges.push({ from, to, deco: hideMark });
        }
        return;
      }
      if (name === "Emphasis") {
        inlineRanges.push({ from, to, deco: Decoration.mark({ class: "cm-lp-em" }) });
        return;
      }
      if (name === "StrongEmphasis") {
        inlineRanges.push({ from, to, deco: Decoration.mark({ class: "cm-lp-strong" }) });
        return;
      }
      if (name === "Strikethrough") {
        inlineRanges.push({ from, to, deco: Decoration.mark({ class: "cm-lp-strike" }) });
        return;
      }
      if (name === "InlineCode") {
        inlineRanges.push({ from, to, deco: Decoration.mark({ class: "cm-lp-code" }) });
        return;
      }
      if (name === "Link") {
        inlineRanges.push({ from, to, deco: Decoration.mark({ class: "cm-lp-link" }) });
        return;
      }
      return undefined;
    },
  });

  // Custom Obsidian extensions: scan plain text for [[wikilinks]], ![[embeds]], ==highlights==, - [ ] tasks, %%comments%%
  const wikiPattern = /(!?)\[\[([^\]\n]+?)\]\]/g;
  const highlightPattern = /==([^=\n][^=\n]*?)==/g;
  const taskPattern = /^(\s*[-*+]\s)\[( |x|X)\]\s/gm;
  const commentPattern = /%%[\s\S]*?%%/g;

  let match: RegExpExecArray | null;
  while ((match = wikiPattern.exec(sourceText)) !== null) {
    const from = match.index;
    const to = from + match[0].length;
    if (cursorTouches(ranges, from, to)) {
      inlineRanges.push({ from, to, deco: Decoration.mark({ class: "cm-lp-wikilink-raw" }) });
      continue;
    }
    const inside = match[2];
    const [target, alias] = inside.split("|").map((part) => part.trim());
    const label = alias || target.split("#")[0];
    inlineRanges.push({
      from,
      to,
      deco: Decoration.replace({ widget: new WikilinkWidget(target, label, match[1] === "!") }),
    });
  }
  while ((match = highlightPattern.exec(sourceText)) !== null) {
    const from = match.index;
    const to = from + match[0].length;
    if (cursorTouches(ranges, from, to)) {
      inlineRanges.push({ from, to, deco: Decoration.mark({ class: "cm-lp-highlight-raw" }) });
    } else {
      inlineRanges.push({
        from,
        to,
        deco: Decoration.replace({ widget: new HighlightWidget(match[1]) }),
      });
    }
  }
  while ((match = taskPattern.exec(sourceText)) !== null) {
    const prefixLen = match[1].length;
    const bracketFrom = match.index + prefixLen;
    const bracketTo = bracketFrom + 3; // "[x]"
    if (cursorTouches(ranges, bracketFrom, bracketTo)) continue;
    inlineRanges.push({
      from: bracketFrom,
      to: bracketTo,
      deco: Decoration.replace({ widget: new CheckboxWidget(match[2].toLowerCase() === "x") }),
    });
  }
  while ((match = commentPattern.exec(sourceText)) !== null) {
    const from = match.index;
    const to = from + match[0].length;
    if (cursorTouches(ranges, from, to)) {
      inlineRanges.push({ from, to, deco: Decoration.mark({ class: "cm-lp-comment" }) });
    } else {
      inlineRanges.push({ from, to, deco: Decoration.replace({}) });
    }
  }

  inlineRanges.sort((a, b) => a.from - b.from || a.to - b.to);
  // dedupe overlapping replaces: keep the first replace, drop later ones overlapping it
  const filtered: typeof inlineRanges = [];
  let lastReplaceEnd = -1;
  for (const item of inlineRanges) {
    const isReplace = item.deco.spec && (item.deco.spec as { widget?: unknown }).widget !== undefined
      ? true
      : item.deco === hideMark;
    if (isReplace && item.from < lastReplaceEnd) continue;
    if (isReplace) lastReplaceEnd = item.to;
    filtered.push(item);
  }
  for (const item of filtered) {
    builder.add(item.from, item.to, item.deco);
  }
  return builder.finish();
}

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view.state);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.state);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => view.plugin(plugin)?.decorations ?? Decoration.none),
  },
);

export const livePreviewTheme = EditorView.baseTheme({
  ".cm-lp-h1": {
    fontSize: "2.6em",
    fontWeight: "800",
    letterSpacing: "-0.025em",
    lineHeight: "1.18",
    padding: "0.55em 14px 0.25em",
    marginTop: "0.35em",
    background:
      "linear-gradient(90deg, #ffffff 0%, #d8d0ff 40%, #a99bff 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    color: "#ffffff",
    borderBottom: "1px solid rgba(139,124,255,0.22)",
    position: "relative",
  },
  ".cm-lp-h1::before": {
    content: "''",
    position: "absolute",
    left: 0,
    top: "0.65em",
    bottom: "0.4em",
    width: "3px",
    borderRadius: "3px",
    background: "linear-gradient(180deg, #8b7cff, #4b36b8)",
    boxShadow: "0 0 12px rgba(139,124,255,0.55)",
  },
  ".cm-lp-h2": {
    fontSize: "2em",
    fontWeight: "750",
    letterSpacing: "-0.018em",
    lineHeight: "1.22",
    padding: "0.45em 14px 0.2em",
    marginTop: "0.25em",
    color: "#eee7ff",
    position: "relative",
  },
  ".cm-lp-h2::before": {
    content: "''",
    position: "absolute",
    left: 0,
    top: "0.55em",
    bottom: "0.3em",
    width: "3px",
    borderRadius: "3px",
    background: "rgba(169,155,255,0.7)",
  },
  ".cm-lp-h3": {
    fontSize: "1.55em",
    fontWeight: "700",
    letterSpacing: "-0.012em",
    lineHeight: "1.28",
    padding: "0.35em 14px 0.15em",
    color: "#d8ccff",
    position: "relative",
  },
  ".cm-lp-h3::before": {
    content: "''",
    position: "absolute",
    left: 0,
    top: "0.5em",
    bottom: "0.3em",
    width: "2px",
    borderRadius: "2px",
    background: "rgba(169,155,255,0.5)",
  },
  ".cm-lp-h4": {
    fontSize: "1.28em",
    fontWeight: "650",
    letterSpacing: "-0.005em",
    padding: "0.28em 14px 0.1em",
    color: "#c9beff",
  },
  ".cm-lp-h5": {
    fontSize: "1.12em",
    fontWeight: "650",
    padding: "0.22em 14px 0.08em",
    color: "#b6abff",
  },
  ".cm-lp-h6": {
    fontSize: "0.92em",
    fontWeight: "700",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "0.18em 14px 0.05em",
    color: "var(--text-3)",
  },
  ".cm-lp-strong": { fontWeight: "700", color: "#f4f1ff" },
  ".cm-lp-em": { fontStyle: "italic", color: "#e5dcff" },
  ".cm-lp-strike": { textDecoration: "line-through", color: "var(--text-3)" },
  ".cm-lp-code": {
    background: "rgba(139,124,255,0.12)",
    border: "1px solid rgba(139,124,255,0.22)",
    borderRadius: "4px",
    padding: "0 4px",
    fontFamily: "JetBrains Mono, Consolas, monospace",
    fontSize: "0.92em",
    color: "#c9beff",
  },
  ".cm-lp-link": { color: "var(--violet-2)", textDecoration: "underline", textUnderlineOffset: "3px" },
  ".cm-lp-wikilink": {
    display: "inline-flex",
    alignItems: "center",
    padding: "1px 8px",
    margin: "0 1px",
    borderRadius: "6px",
    background: "rgba(139,124,255,0.12)",
    border: "1px solid rgba(139,124,255,0.35)",
    color: "#e2d9ff",
    cursor: "pointer",
    fontSize: "0.92em",
    transition: "all 120ms ease",
  },
  ".cm-lp-wikilink:hover": {
    background: "rgba(139,124,255,0.22)",
    borderColor: "rgba(139,124,255,0.55)",
    color: "#ffffff",
  },
  ".cm-lp-embed": {
    display: "inline-block",
    padding: "2px 10px",
    margin: "0 1px",
    borderRadius: "6px",
    background: "rgba(109,141,255,0.14)",
    border: "1px dashed rgba(109,141,255,0.45)",
    color: "#cbd4ff",
    fontSize: "0.9em",
  },
  ".cm-lp-wikilink-raw": { color: "rgba(180,160,235,0.65)" },
  ".cm-lp-highlight": {
    background: "rgba(247,215,116,0.28)",
    color: "#fff6da",
    padding: "0 4px",
    borderRadius: "3px",
  },
  ".cm-lp-highlight-raw": { background: "rgba(247,215,116,0.16)", color: "#f7d774" },
  ".cm-lp-comment": { color: "rgba(180,180,210,0.35)", fontStyle: "italic" },
  ".cm-lp-checkbox": {
    display: "inline-block",
    width: "1em",
    color: "rgba(180,180,210,0.6)",
    marginRight: "4px",
    fontFamily: "JetBrains Mono, Consolas, monospace",
  },
  ".cm-lp-checkbox-on": { color: "var(--success)" },
  ".cm-lp-callout": {
    background: "rgba(139,124,255,0.06)",
    borderLeft: "3px solid rgba(139,124,255,0.55)",
    paddingLeft: "12px !important",
  },
  ".cm-lp-callout-warning, .cm-lp-callout-caution, .cm-lp-callout-attention": {
    background: "rgba(255,180,80,0.07)",
    borderLeftColor: "rgba(255,180,80,0.55)",
  },
  ".cm-lp-callout-danger, .cm-lp-callout-error, .cm-lp-callout-failure, .cm-lp-callout-bug": {
    background: "rgba(255,90,110,0.07)",
    borderLeftColor: "rgba(255,90,110,0.55)",
  },
  ".cm-lp-callout-success, .cm-lp-callout-check, .cm-lp-callout-done": {
    background: "rgba(110,225,170,0.05)",
    borderLeftColor: "rgba(110,225,170,0.55)",
  },
  ".cm-lp-callout-info, .cm-lp-callout-abstract, .cm-lp-callout-summary, .cm-lp-callout-tldr": {
    background: "rgba(110,180,255,0.06)",
    borderLeftColor: "rgba(110,180,255,0.55)",
  },
  ".cm-lp-callout-quote, .cm-lp-callout-cite": {
    background: "rgba(255,255,255,0.03)",
    borderLeftColor: "rgba(116,107,158,0.5)",
  },
  ".cm-line": {
    transition: "background 160ms ease",
  },
  ".cm-line:hover .cm-lp-wikilink, .cm-line:hover .cm-lp-embed": {
    boxShadow: "0 0 0 1px rgba(139,124,255,0.4)",
  },
});

// Make widgets clickable through to host
export function livePreviewClickHandler(onOpen: (target: string) => void) {
  return EditorView.domEventHandlers({
    click(event) {
      const target = event.target as HTMLElement | null;
      const link = target?.closest<HTMLElement>("[data-target]");
      if (!link) return false;
      const wiki = link.dataset.target;
      if (!wiki) return false;
      event.preventDefault();
      onOpen(wiki);
      return true;
    },
  });
}

// Optional state field so themes can read mode; currently unused but exported
export const livePreviewState = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (deco, tr) => (tr.docChanged || tr.selection ? deco.map(tr.changes) : deco),
});
