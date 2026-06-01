export interface PluginViewFactory {
  pluginId: string;
  type: string;
  displayName: string;
  icon?: string;
  create: (host: HTMLElement) => PluginViewInstance;
}

export interface PluginViewInstance {
  onOpen?: () => void | Promise<void>;
  onClose?: () => void | Promise<void>;
  setState?: (state: unknown, result: { history?: boolean }) => void | Promise<void>;
  getState?: () => unknown;
}

interface ProtocolHandlerEntry {
  pluginId: string;
  action: string;
  handler: (params: Record<string, string>) => void | Promise<void>;
}

interface ViewStateEntry {
  type: string;
  state: unknown;
  active: boolean;
  updatedAt: number;
}

const views = new Map<string, PluginViewFactory>();
const protocolHandlers = new Map<string, ProtocolHandlerEntry>();
const hoverSources = new Map<string, { pluginId: string; source: unknown }>();
const viewStates = new Map<string, ViewStateEntry>();
const activeLeafObjects = new Map<string, unknown>();
const listeners = new Set<() => void>();
const stateListeners = new Set<(path: string) => void>();

export function bindActiveLeafObject(path: string, leaf: unknown): void {
  activeLeafObjects.set(path, leaf);
}

export function getActiveLeafObject(path: string): unknown | undefined {
  return activeLeafObjects.get(path);
}

export function unbindActiveLeafObject(path: string): void {
  activeLeafObjects.delete(path);
}

function notify() {
  for (const listener of listeners) listener();
}

function notifyState(path: string) {
  for (const listener of stateListeners) listener(path);
}

export function subscribeViewRegistry(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribeViewState(listener: (path: string) => void): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

export function registerPluginView(factory: PluginViewFactory): () => void {
  views.set(factory.type, factory);
  notify();
  return () => {
    if (views.get(factory.type) === factory) {
      views.delete(factory.type);
      notify();
    }
  };
}

export function getPluginView(type: string): PluginViewFactory | undefined {
  return views.get(type);
}

export function listPluginViews(): PluginViewFactory[] {
  return Array.from(views.values());
}

export function setPluginViewState(path: string, type: string, state: unknown, active = true): void {
  viewStates.set(path, { type, state, active, updatedAt: Date.now() });
  notifyState(path);
}

export function getPluginViewState(path: string): ViewStateEntry | undefined {
  return viewStates.get(path);
}

export function clearPluginViewState(path: string): void {
  if (viewStates.delete(path)) notifyState(path);
}

export function listPluginViewLeafStates(type?: string): Array<{ path: string; entry: ViewStateEntry }> {
  const out: Array<{ path: string; entry: ViewStateEntry }> = [];
  for (const [path, entry] of viewStates.entries()) {
    if (!type || entry.type === type) out.push({ path, entry });
  }
  return out;
}

export function registerProtocolHandler(
  pluginId: string,
  action: string,
  handler: (params: Record<string, string>) => void | Promise<void>,
): () => void {
  const entry: ProtocolHandlerEntry = { pluginId, action, handler };
  protocolHandlers.set(action, entry);
  return () => {
    if (protocolHandlers.get(action) === entry) {
      protocolHandlers.delete(action);
    }
  };
}

export async function dispatchProtocolAction(
  action: string,
  params: Record<string, string>,
): Promise<boolean> {
  const entry = protocolHandlers.get(action);
  if (!entry) return false;
  try {
    await entry.handler(params);
    return true;
  } catch (error) {
    console.warn(`[plugin:${entry.pluginId}] protocol handler "${action}" failed`, error);
    return false;
  }
}

export function registerHoverLinkSource(
  pluginId: string,
  id: string,
  source: unknown,
): () => void {
  hoverSources.set(id, { pluginId, source });
  return () => {
    if (hoverSources.get(id)?.pluginId === pluginId) {
      hoverSources.delete(id);
    }
  };
}

export function clearViewRegistryForPlugin(pluginId: string): void {
  let changed = false;
  for (const [type, factory] of [...views.entries()]) {
    if (factory.pluginId === pluginId) {
      views.delete(type);
      changed = true;
    }
  }
  for (const [action, entry] of [...protocolHandlers.entries()]) {
    if (entry.pluginId === pluginId) protocolHandlers.delete(action);
  }
  for (const [id, entry] of [...hoverSources.entries()]) {
    if (entry.pluginId === pluginId) hoverSources.delete(id);
  }
  if (changed) notify();
}
