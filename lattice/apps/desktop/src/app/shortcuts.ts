import { useEffect } from "react";
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
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        togglePalette();
      }
      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveActiveNote();
      }
      if (mod && event.key.toLowerCase() === "n") {
        event.preventDefault();
        void createNote(newNotePath());
        setView("workspace");
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        void createNote(`Daily Notes/${today()}.md`);
        setView("workspace");
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        setView("canvas");
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === "t") {
        event.preventDefault();
        const path = useWorkspaceStore.getState().reopenLastClosed();
        if (path) void useVaultStore.getState().setActivePath(path);
      }
      if (mod && event.key.toLowerCase() === "w") {
        const active = useWorkspaceStore.getState().activeTabId;
        if (active) {
          event.preventDefault();
          useWorkspaceStore.getState().closeTab(active);
          const next = useWorkspaceStore.getState().activeTabId;
          const nextPath = useWorkspaceStore.getState().tabs.find((t) => t.id === next)?.path ?? null;
          if (nextPath) void useVaultStore.getState().setActivePath(nextPath);
        }
      }
      if (mod && event.key.toLowerCase() === "g") {
        event.preventDefault();
        setView("graph");
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createNote, saveActiveNote, setPaletteOpen, setView, togglePalette]);
}

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
