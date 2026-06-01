export type HostEventName =
  | "vault.create"
  | "vault.modify"
  | "vault.delete"
  | "vault.rename"
  | "vault.closed"
  | "workspace.file-open"
  | "workspace.active-leaf-change"
  | "workspace.layout-change"
  | "workspace.quit"
  | "workspace.resize"
  | "workspace.css-change"
  | "metadata.changed"
  | "metadata.resolved";

type Listener = (...args: unknown[]) => void;

const listeners = new Map<HostEventName, Set<Listener>>();

export function onHostEvent(name: HostEventName, listener: Listener): () => void {
  let set = listeners.get(name);
  if (!set) {
    set = new Set();
    listeners.set(name, set);
  }
  set.add(listener);
  return () => set?.delete(listener);
}

export function offHostEvent(name: HostEventName, listener: Listener): void {
  listeners.get(name)?.delete(listener);
}

export function emitHostEvent(name: HostEventName, ...args: unknown[]): void {
  const set = listeners.get(name);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(...args);
    } catch (error) {
      console.warn(`Host event listener for "${name}" failed`, error);
    }
  }
}
