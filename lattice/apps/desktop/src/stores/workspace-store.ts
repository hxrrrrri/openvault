import { create } from "zustand";
import type { EditorMode } from "@/types/domain";

interface WorkspaceState {
  editorMode: EditorMode;
  focusMode: boolean;
  setEditorMode: (mode: EditorMode) => void;
  setFocusMode: (enabled: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  editorMode: "split",
  focusMode: false,
  setEditorMode: (editorMode) => set({ editorMode }),
  setFocusMode: (focusMode) => set({ focusMode }),
}));
