import { isTauriRuntime } from "@/lib/tauri";
import type { TerminalExitEvent, TerminalOutputEvent } from "@/types/domain";

export interface IndexProgressEvent {
  scannedFiles: number;
  indexedFiles: number;
  currentPath?: string;
  done: boolean;
}

export async function listenIndexProgress(
  handler: (event: IndexProgressEvent) => void,
): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => undefined;
  }
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<IndexProgressEvent>(
    "lattice://index-progress",
    (event) => handler(event.payload),
  );
  return unlisten;
}

export async function listenTerminalOutput(
  handler: (event: TerminalOutputEvent) => void,
): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => undefined;
  }
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<TerminalOutputEvent>(
    "lattice://terminal-output",
    (event) => handler(event.payload),
  );
  return unlisten;
}

export async function listenTerminalExit(
  handler: (event: TerminalExitEvent) => void,
): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => undefined;
  }
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<TerminalExitEvent>(
    "lattice://terminal-exit",
    (event) => handler(event.payload),
  );
  return unlisten;
}
