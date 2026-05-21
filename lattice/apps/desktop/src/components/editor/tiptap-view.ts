import type { Editor } from "@tiptap/react";
import type { EditorView } from "@tiptap/pm/view";

export function getMountedEditorView(editor: Editor | null): EditorView | null {
  if (!editor || editor.isDestroyed) return null;
  try {
    const view = editor.view;
    if (!view?.dom?.isConnected) return null;
    return view;
  } catch {
    return null;
  }
}
