import { isTauriRuntime } from "@/lib/tauri";

export interface IndexProgressEvent {
  scannedFiles: number;
  indexedFiles: number;
  currentPath?: string;
  done: boolean;
}

export async function listenIndexProgress(handler: (event: IndexProgressEvent) => void): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => undefined;
  }
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<IndexProgressEvent>("lattice://index-progress", (event) => handler(event.payload));
  return unlisten;
}
