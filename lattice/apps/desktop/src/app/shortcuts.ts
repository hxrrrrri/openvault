import { useEffect } from "react";
import { findCommandForCombo, normalizeCombo } from "@/features/hotkeys/hotkey-registry";
import { useSettingsStore } from "@/stores/settings-store";
import { useUIStore } from "@/stores/ui-store";
import { useVaultStore } from "@/stores/vault-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

export function resolveNewNoteFolder(): string {
  const files = useSettingsStore.getState().files;
  switch (files.defaultNoteLocation) {
    case "vault":
      return "";
    case "inbox":
      return "Inbox";
    case "custom":
      return files.newNoteFolder.replace(/^\/+|\/+$/g, "");
    case "same-folder": {
      const activePath = useVaultStore.getState().activePath;
      if (!activePath) return "";
      const idx = activePath.lastIndexOf("/");
      return idx < 0 ? "" : activePath.slice(0, idx);
    }
  }
}

function newNotePath(): string {
  const folder = resolveNewNoteFolder();
  const base = folder ? `${folder}/` : "";
  return `${base}Untitled ${Date.now()}.md`;
}

export function useGlobalShortcuts() {
  const togglePalette = useUIStore((state) => state.togglePalette);
  const setPaletteOpen = useUIStore((state) => state.setPaletteOpen);
  const setView = useUIStore((state) => state.setView);
  const saveActiveNote = useVaultStore((state) => state.saveActiveNote);
  const createNote = useVaultStore((state) => state.createNote);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPaletteOpen(false);
        return;
      }

      const commandId = findCommandForCombo(normalizeCombo(event));
      if (!commandId) return;
      if (commandId === "find.in-editor" || commandId === "find.replace") return;
      if (isEditableTarget(event.target) && !["palette.open", "note.save"].includes(commandId)) {
        return;
      }

      const handled = runHotkeyCommand(commandId, {
        createNote,
        saveActiveNote,
        setView,
        togglePalette,
      });
      if (handled) {
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createNote, saveActiveNote, setPaletteOpen, setView, togglePalette]);
}

interface ShortcutContext {
  createNote: ReturnType<typeof useVaultStore.getState>["createNote"];
  saveActiveNote: ReturnType<typeof useVaultStore.getState>["saveActiveNote"];
  setView: ReturnType<typeof useUIStore.getState>["setView"];
  togglePalette: ReturnType<typeof useUIStore.getState>["togglePalette"];
}

function runHotkeyCommand(commandId: string, context: ShortcutContext): boolean {
  switch (commandId) {
    case "palette.open":
      context.togglePalette();
      return true;
    case "note.save":
      void context.saveActiveNote();
      return true;
    case "note.new":
      void context.createNote(newNotePath());
      context.setView("workspace");
      return true;
    case "note.daily":
      void context.createNote(`Daily Notes/${today()}.md`);
      context.setView("workspace");
      return true;
    case "graph.open":
      context.setView("graph");
      return true;
    case "canvas.open":
      context.setView("canvas");
      return true;
    case "settings.open":
      context.setView("settings");
      return true;
    case "tab.reopen-closed": {
      const path = useWorkspaceStore.getState().reopenLastClosed();
      if (path) void useVaultStore.getState().setActivePath(path);
      return true;
    }
    case "tab.close-active":
      return closeActiveTab();
    case "editor.toggle-mode":
      toggleEditorMode();
      return true;
    default:
      return false;
  }
}

function closeActiveTab(): boolean {
  const workspace = useWorkspaceStore.getState();
  const active = workspace.activeTabId;
  if (!active) return false;
  workspace.closeTab(active);
  const next = useWorkspaceStore.getState().activeTabId;
  const nextPath = useWorkspaceStore.getState().tabs.find((tab) => tab.id === next)?.path ?? null;
  if (nextPath) void useVaultStore.getState().setActivePath(nextPath);
  return true;
}

function toggleEditorMode() {
  const workspace = useWorkspaceStore.getState();
  workspace.setEditorMode(workspace.editorMode === "edit" ? "preview" : "edit");
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable], [role='textbox']"));
}

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
