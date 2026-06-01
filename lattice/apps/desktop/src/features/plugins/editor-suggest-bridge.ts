import type { CompletionContext, CompletionResult, Completion } from "@codemirror/autocomplete";
import { listEditorSuggesters } from "@/features/plugins/editor-extension-registry";

interface EditorPosition {
  line: number;
  ch: number;
}

interface SuggestTriggerInfo {
  start: EditorPosition;
  end: EditorPosition;
  query: string;
}

interface SuggestContext extends SuggestTriggerInfo {
  editor: ObsidianEditorShim;
  file: null;
}

interface ObsidianEditorShim {
  getValue: () => string;
  getCursor: () => EditorPosition;
  getLine: (line: number) => string;
  lineCount: () => number;
  getRange: (from: EditorPosition, to: EditorPosition) => string;
  replaceRange: (text: string, from: EditorPosition, to: EditorPosition) => void;
  posToOffset: (pos: EditorPosition) => number;
  offsetToPos: (offset: number) => EditorPosition;
  somethingSelected: () => boolean;
  getSelection: () => string;
  setCursor: (pos: EditorPosition) => void;
}

interface EditorSuggestLike {
  onTrigger?: (cursor: EditorPosition, editor: ObsidianEditorShim, file: null) => SuggestTriggerInfo | null;
  getSuggestions?: (context: SuggestContext) => unknown[] | Promise<unknown[]>;
  renderSuggestion?: (value: unknown, el: HTMLElement) => void;
  selectSuggestion?: (value: unknown, event: KeyboardEvent | MouseEvent) => void;
}

function buildEditorShim(context: CompletionContext): ObsidianEditorShim {
  const doc = context.state.doc;
  const cursor = context.pos;
  const offsetToPos = (offset: number): EditorPosition => {
    const clamped = Math.max(0, Math.min(doc.length, offset));
    const line = doc.lineAt(clamped);
    return { line: line.number - 1, ch: clamped - line.from };
  };
  const posToOffset = (pos: EditorPosition): number => {
    const lineIdx = Math.max(1, Math.min(doc.lines, pos.line + 1));
    const line = doc.line(lineIdx);
    return line.from + Math.max(0, Math.min(line.length, pos.ch));
  };
  return {
    getValue: () => doc.toString(),
    getCursor: () => offsetToPos(cursor),
    getLine: (lineIdx: number) => {
      if (lineIdx < 0 || lineIdx >= doc.lines) return "";
      return doc.line(lineIdx + 1).text;
    },
    lineCount: () => doc.lines,
    getRange: (from, to) => doc.sliceString(posToOffset(from), posToOffset(to)),
    replaceRange: () => {},
    posToOffset,
    offsetToPos,
    somethingSelected: () => context.state.selection.main.from !== context.state.selection.main.to,
    getSelection: () => doc.sliceString(context.state.selection.main.from, context.state.selection.main.to),
    setCursor: () => {},
  };
}

function suggestionLabel(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return String(obj.label ?? obj.displayName ?? obj.title ?? obj.value ?? obj.text ?? JSON.stringify(value));
  }
  return String(value);
}

function suggestionDetail(value: unknown): string | undefined {
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const detail = obj.detail ?? obj.subtext ?? obj.path;
    return typeof detail === "string" ? detail : undefined;
  }
  return undefined;
}

function applyValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.apply === "string") return obj.apply;
    if (typeof obj.label === "string") return obj.label;
    if (typeof obj.value === "string") return obj.value;
  }
  return suggestionLabel(value);
}

export async function pluginSuggestCompletions(
  context: CompletionContext,
): Promise<CompletionResult | null> {
  const suggesters = listEditorSuggesters();
  if (!suggesters.length) return null;
  const editor = buildEditorShim(context);
  const cursor = editor.getCursor();

  for (const { suggester } of suggesters) {
    const obj = suggester as EditorSuggestLike;
    if (!obj || typeof obj.onTrigger !== "function" || typeof obj.getSuggestions !== "function") continue;
    let trigger: SuggestTriggerInfo | null = null;
    try {
      trigger = obj.onTrigger(cursor, editor, null);
    } catch (error) {
      console.warn("EditorSuggest.onTrigger failed", error);
      continue;
    }
    if (!trigger) continue;

    const suggestContext: SuggestContext = { ...trigger, editor, file: null };
    let suggestions: unknown[] = [];
    try {
      const result = obj.getSuggestions(suggestContext);
      suggestions = await Promise.resolve(result);
    } catch (error) {
      console.warn("EditorSuggest.getSuggestions failed", error);
      continue;
    }
    if (!suggestions?.length) continue;

    const from = editor.posToOffset(trigger.start);
    const to = editor.posToOffset(trigger.end);
    const options: Completion[] = suggestions.slice(0, 200).map((value) => ({
      label: suggestionLabel(value),
      detail: suggestionDetail(value),
      type: "variable",
      apply: (view, _completion, applyFrom, applyTo) => {
        const insertion = applyValue(value);
        view.dispatch({
          changes: { from: applyFrom, to: applyTo, insert: insertion },
          selection: { anchor: applyFrom + insertion.length },
        });
        try {
          obj.selectSuggestion?.(value, new KeyboardEvent("keydown", { key: "Enter" }));
        } catch (error) {
          console.warn("EditorSuggest.selectSuggestion failed", error);
        }
      },
      info: () => {
        if (typeof obj.renderSuggestion !== "function") return null;
        const el = document.createElement("div");
        try {
          obj.renderSuggestion(value, el);
        } catch (error) {
          console.warn("EditorSuggest.renderSuggestion failed", error);
        }
        return el;
      },
    }));

    return { from, to, options, validFor: /[\w@#$/.:-]*$/ };
  }
  return null;
}
