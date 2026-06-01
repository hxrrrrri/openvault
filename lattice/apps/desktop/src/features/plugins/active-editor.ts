import type { EditorView } from "@codemirror/view";

let activeEditor: EditorView | null = null;
let activePath: string | null = null;
const listeners = new Set<(view: EditorView | null, path: string | null) => void>();

export function setActiveEditor(view: EditorView | null, path: string | null = null): void {
  activeEditor = view;
  activePath = path;
  for (const listener of listeners) listener(view, path);
}

export function getActiveEditor(): EditorView | null {
  return activeEditor;
}

export function getActiveEditorPath(): string | null {
  return activePath;
}

export function subscribeActiveEditor(listener: (view: EditorView | null, path: string | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export interface ObsidianEditorPosition {
  line: number;
  ch: number;
}

export function makeObsidianEditorShim(view: EditorView) {
  const doc = () => view.state.doc;
  const offsetToPos = (offset: number): ObsidianEditorPosition => {
    const clamped = Math.max(0, Math.min(doc().length, offset));
    const line = doc().lineAt(clamped);
    return { line: line.number - 1, ch: clamped - line.from };
  };
  const posToOffset = (pos: ObsidianEditorPosition): number => {
    const lineIdx = Math.max(1, Math.min(doc().lines, pos.line + 1));
    const line = doc().line(lineIdx);
    return line.from + Math.max(0, Math.min(line.length, pos.ch));
  };
  return {
    getValue: () => doc().toString(),
    setValue: (content: string) => {
      view.dispatch({ changes: { from: 0, to: doc().length, insert: content } });
    },
    getLine: (lineIdx: number) => {
      if (lineIdx < 0 || lineIdx >= doc().lines) return "";
      return doc().line(lineIdx + 1).text;
    },
    setLine: (lineIdx: number, text: string) => {
      if (lineIdx < 0 || lineIdx >= doc().lines) return;
      const line = doc().line(lineIdx + 1);
      view.dispatch({ changes: { from: line.from, to: line.to, insert: text } });
    },
    lineCount: () => doc().lines,
    lastLine: () => doc().lines - 1,
    getRange: (from: ObsidianEditorPosition, to: ObsidianEditorPosition) =>
      doc().sliceString(posToOffset(from), posToOffset(to)),
    replaceRange: (text: string, from: ObsidianEditorPosition, to?: ObsidianEditorPosition) => {
      view.dispatch({
        changes: { from: posToOffset(from), to: posToOffset(to ?? from), insert: text },
      });
    },
    replaceSelection: (text: string) => {
      view.dispatch(view.state.replaceSelection(text));
    },
    getSelection: () =>
      doc().sliceString(view.state.selection.main.from, view.state.selection.main.to),
    somethingSelected: () => view.state.selection.main.from !== view.state.selection.main.to,
    getCursor: () => offsetToPos(view.state.selection.main.head),
    setCursor: (pos: ObsidianEditorPosition | number) => {
      const offset = typeof pos === "number" ? pos : posToOffset(pos);
      view.dispatch({ selection: { anchor: offset } });
    },
    setSelection: (anchor: ObsidianEditorPosition, head?: ObsidianEditorPosition) => {
      view.dispatch({
        selection: { anchor: posToOffset(anchor), head: posToOffset(head ?? anchor) },
      });
    },
    posToOffset,
    offsetToPos,
    hasFocus: () => view.hasFocus,
    focus: () => view.focus(),
    blur: () => view.contentDOM.blur(),
    getDoc: () => view.state.doc,
    refresh: () => {},
    cm: view,
  };
}
