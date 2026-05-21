import { AlertTriangle, RotateCcw, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { defaultBindings, normalizeCombo, useHotkeyStore } from "./hotkey-registry";

interface CommandLabel {
  id: string;
  label: string;
}

const KNOWN_LABELS: CommandLabel[] = [
  { id: "palette.open", label: "Open command palette" },
  { id: "note.save", label: "Save active note" },
  { id: "note.new", label: "New note" },
  { id: "note.daily", label: "Open today's daily note" },
  { id: "note.random", label: "Open random note" },
  { id: "note.unique", label: "Create unique-ID note" },
  { id: "graph.open", label: "Open graph view" },
  { id: "canvas.open", label: "Open canvas" },
  { id: "tab.reopen-closed", label: "Reopen last closed tab" },
  { id: "tab.close-active", label: "Close active tab" },
  { id: "find.in-editor", label: "Find in note" },
  { id: "find.replace", label: "Find and replace" },
  { id: "editor.toggle-mode", label: "Toggle reading / editing" },
  { id: "settings.open", label: "Open settings" },
  { id: "templates.insert", label: "Insert template…" },
  { id: "workspace.save", label: "Save workspace…" },
  { id: "workspace.load", label: "Load workspace…" },
  { id: "format.convert", label: "Convert wikilinks ↔ markdown" },
];

export function HotkeyEditor() {
  const bindings = useHotkeyStore((state) => state.bindings);
  const setBinding = useHotkeyStore((state) => state.setBinding);
  const resetDefaults = useHotkeyStore((state) => state.resetDefaults);
  const conflicts = useHotkeyStore((state) => state.conflicts());
  const [filter, setFilter] = useState("");
  const [recordingId, setRecordingId] = useState<string | null>(null);

  const commands: CommandLabel[] = useMemo(() => {
    const map = new Map<string, CommandLabel>();
    for (const entry of KNOWN_LABELS) map.set(entry.id, entry);
    for (const commandId of Object.keys(bindings)) {
      if (!map.has(commandId)) map.set(commandId, { id: commandId, label: commandId });
    }
    const list = Array.from(map.values());
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((entry) => entry.label.toLowerCase().includes(q) || entry.id.toLowerCase().includes(q));
  }, [bindings, filter]);

  const conflictMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const conflict of conflicts) map.set(conflict.combo, conflict.commandIds);
    return map;
  }, [conflicts]);

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2 text-[var(--text-3)]" size={13} />
          <input
            value={filter}
            onChange={(event) => setFilter(event.currentTarget.value)}
            placeholder="Filter commands"
            className="w-full rounded-md border border-[var(--border)] bg-black/25 pl-7 pr-2 py-1.5 text-xs text-[var(--text)] outline-none focus:border-violet/40"
          />
        </div>
        <button
          type="button"
          onClick={resetDefaults}
          className="flex items-center gap-1 rounded-md border border-[var(--border)] bg-white/[0.025] px-3 py-1.5 text-xs text-[var(--text-3)] hover:text-white"
        >
          <RotateCcw size={11} /> Reset defaults
        </button>
      </div>

      {conflicts.length > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-100">
          <AlertTriangle size={12} />
          {conflicts.length} conflicting binding{conflicts.length === 1 ? "" : "s"}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-black/20">
        <table className="w-full text-sm">
          <thead className="bg-black/30 text-[10px] uppercase text-[var(--text-4)]">
            <tr>
              <th className="px-3 py-2 text-left">Command</th>
              <th className="px-3 py-2 text-left">Hotkey</th>
              <th className="px-3 py-2 text-left">Default</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {commands.map((entry) => {
              const current = bindings[entry.id] ?? "";
              const isConflict = current ? (conflictMap.get(current)?.length ?? 0) > 1 : false;
              const recording = recordingId === entry.id;
              return (
                <tr key={entry.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-1.5 text-[var(--text-2)]">{entry.label}</td>
                  <td className="px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() => setRecordingId(entry.id)}
                      onKeyDown={(event) => {
                        if (recording) {
                          event.preventDefault();
                          if (event.key === "Escape") {
                            setRecordingId(null);
                            return;
                          }
                          if (event.key === "Backspace" || event.key === "Delete") {
                            setBinding(entry.id, null);
                            setRecordingId(null);
                            return;
                          }
                          const combo = normalizeCombo(event.nativeEvent);
                          if (combo && combo !== "Mod" && combo !== "Shift" && combo !== "Alt") {
                            setBinding(entry.id, combo);
                            setRecordingId(null);
                          }
                        }
                      }}
                      className={`mono rounded border px-2 py-0.5 text-[11px] ${
                        recording
                          ? "border-violet/60 bg-violet/15 text-white"
                          : isConflict
                          ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
                          : "border-[var(--border)] bg-white/[0.025] text-[var(--text-2)]"
                      }`}
                    >
                      {recording ? "press keys…" : current || "—"}
                    </button>
                  </td>
                  <td className="mono px-3 py-1.5 text-[11px] text-[var(--text-4)]">
                    {defaultBindings[entry.id] ?? "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {current && (
                      <button
                        type="button"
                        onClick={() => setBinding(entry.id, null)}
                        className="text-[var(--text-4)] hover:text-rose-300"
                        title="Clear binding"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
