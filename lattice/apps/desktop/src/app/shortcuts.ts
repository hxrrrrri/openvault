import { useEffect } from "react";
import { useUIStore } from "@/stores/ui-store";
import { useVaultStore } from "@/stores/vault-store";

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
        void createNote(`Inbox/Untitled ${Date.now()}.md`);
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
