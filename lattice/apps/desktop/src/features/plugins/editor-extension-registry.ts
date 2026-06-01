import type { Extension } from "@codemirror/state";

interface EditorExtensionEntry {
  pluginId: string;
  extension: Extension;
}

interface EditorSuggestEntry {
  pluginId: string;
  suggester: unknown;
}

const extensions: EditorExtensionEntry[] = [];
const suggesters: EditorSuggestEntry[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeEditorExtensions(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function registerEditorExtension(
  pluginId: string,
  extension: Extension,
): () => void {
  const entry: EditorExtensionEntry = { pluginId, extension };
  extensions.push(entry);
  notify();
  return () => {
    const index = extensions.indexOf(entry);
    if (index >= 0) {
      extensions.splice(index, 1);
      notify();
    }
  };
}

export function registerEditorSuggest(
  pluginId: string,
  suggester: unknown,
): () => void {
  const entry: EditorSuggestEntry = { pluginId, suggester };
  suggesters.push(entry);
  notify();
  return () => {
    const index = suggesters.indexOf(entry);
    if (index >= 0) {
      suggesters.splice(index, 1);
      notify();
    }
  };
}

export function clearEditorContributionsForPlugin(pluginId: string): void {
  let changed = false;
  for (let index = extensions.length - 1; index >= 0; index -= 1) {
    if (extensions[index].pluginId === pluginId) {
      extensions.splice(index, 1);
      changed = true;
    }
  }
  for (let index = suggesters.length - 1; index >= 0; index -= 1) {
    if (suggesters[index].pluginId === pluginId) {
      suggesters.splice(index, 1);
      changed = true;
    }
  }
  if (changed) notify();
}

export function listEditorExtensions(): Extension[] {
  return extensions.map((entry) => entry.extension);
}

export function listEditorSuggesters(): EditorSuggestEntry[] {
  return [...suggesters];
}
