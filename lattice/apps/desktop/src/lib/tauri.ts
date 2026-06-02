import { mockInvoke } from "@/lib/browser-mock";

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Invoke a backend command.
 *
 * - In the packaged desktop app (Tauri runtime present) this calls the real Rust
 *   command through `@tauri-apps/api/core`.
 * - In plain browser preview (Vite, no Tauri) it routes to a deterministic
 *   in-memory mock so the UI works without a backend instead of throwing.
 */
export async function safeInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriRuntime()) {
    return mockInvoke<T>(command, args);
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}
