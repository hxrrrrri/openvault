import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface HotkeyBinding {
  commandId: string;
  combo: string; // e.g. "Ctrl+Shift+P"
}

interface HotkeyState {
  bindings: Record<string, string>;
  conflicts: () => Array<{ combo: string; commandIds: string[] }>;
  setBinding: (commandId: string, combo: string | null) => void;
  resetDefaults: () => void;
}

export const defaultBindings: Record<string, string> = {
  "palette.open": "Mod+K",
  "note.save": "Mod+S",
  "note.new": "Mod+N",
  "note.daily": "Mod+Shift+D",
  "graph.open": "Mod+G",
  "canvas.open": "Mod+Shift+C",
  "tab.reopen-closed": "Mod+Shift+T",
  "tab.close-active": "Mod+W",
  "find.in-editor": "Mod+F",
  "find.replace": "Mod+H",
  "editor.toggle-mode": "Mod+E",
  "settings.open": "Mod+,",
};

export const useHotkeyStore = create<HotkeyState>()(
  persist(
    (set, get) => ({
      bindings: { ...defaultBindings },
      conflicts: () => {
        const grouped = new Map<string, string[]>();
        for (const [commandId, combo] of Object.entries(get().bindings)) {
          if (!combo) continue;
          const list = grouped.get(combo) ?? [];
          list.push(commandId);
          grouped.set(combo, list);
        }
        return Array.from(grouped.entries())
          .filter(([, ids]) => ids.length > 1)
          .map(([combo, commandIds]) => ({ combo, commandIds }));
      },
      setBinding: (commandId, combo) =>
        set((state) => {
          const bindings = { ...state.bindings };
          if (combo) bindings[commandId] = combo;
          else delete bindings[commandId];
          return { bindings };
        }),
      resetDefaults: () => set({ bindings: { ...defaultBindings } }),
    }),
    { name: "lattice-hotkeys", version: 1 },
  ),
);

export function normalizeCombo(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push("Mod");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  if (!["Control", "Meta", "Alt", "Shift"].includes(event.key)) parts.push(key);
  return parts.join("+");
}

export function findCommandForCombo(combo: string): string | null {
  const bindings = useHotkeyStore.getState().bindings;
  for (const [commandId, value] of Object.entries(bindings)) {
    if (value === combo) return commandId;
  }
  return null;
}
