import type { Extension } from "@codemirror/state";
import * as cmView from "@codemirror/view";
import * as cmState from "@codemirror/state";
import * as cmLanguage from "@codemirror/language";
import * as cmAutocomplete from "@codemirror/autocomplete";
import * as cmCommands from "@codemirror/commands";
import * as cmSearch from "@codemirror/search";
import * as lucide from "lucide";
import moment from "moment";

import { commands } from "@/lib/commands";
import type { FileNode, PermissionGrant, PluginManifest } from "@/types/domain";
import { ensureObsidianDomShim } from "@/features/plugins/obsidian-dom";
import { useVaultStore } from "@/stores/vault-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  emitHostEvent,
  offHostEvent,
  onHostEvent,
  type HostEventName,
} from "@/features/plugins/host-events";
import {
  getActiveEditor,
  makeObsidianEditorShim,
  subscribeActiveEditor,
} from "@/features/plugins/active-editor";
import {
  bindActiveLeafObject,
  clearPluginViewState,
  getActiveLeafObject,
  getPluginViewState,
  listPluginViewLeafStates,
  setPluginViewState,
  unbindActiveLeafObject,
} from "@/features/plugins/view-registry";
import { buildResolvedLinks, toObsidianFileCache } from "@/features/plugins/metadata-adapter";
import {
  clearEditorContributionsForPlugin,
  registerEditorExtension,
  registerEditorSuggest,
} from "@/features/plugins/editor-extension-registry";
import {
  clearProcessorsForPlugin,
  registerMarkdownCodeBlockProcessor,
  registerMarkdownPostProcessor,
  type MarkdownPostProcessor,
  type MarkdownCodeBlockProcessor,
} from "@/features/plugins/processor-registry";
import {
  clearViewRegistryForPlugin,
  getPluginView,
  registerPluginView,
  registerProtocolHandler,
  registerHoverLinkSource,
} from "@/features/plugins/view-registry";
import { registerPluginStyles } from "@/features/plugins/obsidian-styles";
import { renderMarkdownInto } from "@/features/plugins/markdown-render";
import {
  clearPluginCommandsForPlugin,
  registerPluginCommand,
} from "@/features/plugins/plugin-command-registry";
import { usePluginUIStore } from "@/stores/plugin-ui-store";

export interface MainRuntimeBundle {
  id: string;
  manifest: PluginManifest;
  mainSource: string;
  stylesSource?: string | null;
  initialDataSource?: string | null;
  grantedPermissions: PermissionGrant[];
}

export interface MainRuntimeContext {
  files?: FileNode[];
  activePath?: string | null;
}

type Disposer = () => void | Promise<void>;

interface LoadedPlugin {
  pluginId: string;
  unload(): Promise<void>;
  invokeCommand(commandId: string): Promise<void>;
}

class PermissionDeniedError extends Error {
  constructor(public readonly pluginId: string, public readonly permission: string, public readonly api: string) {
    super(`Permission denied for ${api}: ${permission}`);
    this.name = "PermissionDeniedError";
  }
}

class Runtime {
  readonly disposables: Disposer[] = [];
  readonly commandCallbacks = new Map<string, () => void | Promise<void>>();
  readonly workspaceEvents = new EventEmitter();
  readonly metadataEvents = new EventEmitter();
  readonly vaultEvents = new EventEmitter();
  readonly readCache = new Map<string, string>();
  readonly fileCache = new Map<string, TFile | TFolder>();
  plugin?: PluginInstance;
  pluginId: string;
  manifest: PluginManifest;
  permissions: Set<string>;
  activePath: string | null;
  private nextRibbonId = 1;
  private nextStatusId = 1;
  private nextSettingTabId = 1;

  constructor(bundle: MainRuntimeBundle, context: MainRuntimeContext) {
    this.pluginId = bundle.id;
    this.manifest = bundle.manifest;
    this.permissions = new Set(bundle.grantedPermissions.filter((g) => g.granted).map((g) => g.permission));
    this.activePath = context.activePath ?? null;
    this.seedFiles(context.files ?? []);
  }

  has(permission: string): boolean {
    return this.permissions.has(permission);
  }

  require(permission: string, api: string): void {
    if (this.has(permission)) return;
    console.warn(`[plugin:${this.pluginId}] permission denied: ${permission} for ${api}`);
    throw new PermissionDeniedError(this.pluginId, permission, api);
  }

  requireAny(permissions: string[], api: string): void {
    if (permissions.some((p) => this.has(p))) return;
    this.require(permissions[0], api);
  }

  track(dispose: Disposer): void {
    this.disposables.push(dispose);
  }

  notice(message: string, timeout = 4000): void {
    usePluginUIStore.getState().pushNotice({ pluginId: this.pluginId, message, timeout });
  }

  seedFiles(files: FileNode[]): void {
    this.fileCache.clear();
    const visit = (node: FileNode, parent: TFolder | null) => {
      const item: TFile | TFolder =
        node.kind === "folder"
          ? new TFolder(node.path, node.name, parent)
          : new TFile(node.path, node.name, parent, fileStat(node));
      this.fileCache.set(node.path, item);
      if (parent && item instanceof TAbstractFile) parent.children.push(item);
      for (const child of node.children ?? []) {
        visit(child, item instanceof TFolder ? item : parent);
      }
    };
    for (const file of files) visit(file, null);
  }

  files(): TFile[] {
    return Array.from(this.fileCache.values()).filter((f): f is TFile => f instanceof TFile);
  }

  folders(): TFolder[] {
    return Array.from(this.fileCache.values()).filter((f): f is TFolder => f instanceof TFolder);
  }

  cacheFile(path: string, content?: string): TFile {
    const normalized = normalizePath(path);
    const name = normalized.split("/").pop() ?? normalized;
    const file = new TFile(normalized, name, null, { ctime: Date.now(), mtime: Date.now(), size: content?.length ?? 0 });
    this.fileCache.set(normalized, file);
    if (typeof content === "string") this.readCache.set(normalized, content);
    return file;
  }

  removeCached(path: string): void {
    const normalized = normalizePath(path);
    this.fileCache.delete(normalized);
    this.readCache.delete(normalized);
  }

  nextId(prefix: string): string {
    if (prefix === "ribbon") return `${this.pluginId}:ribbon:${this.nextRibbonId++}`;
    if (prefix === "status") return `${this.pluginId}:status:${this.nextStatusId++}`;
    if (prefix === "setting") return `${this.pluginId}:setting:${this.nextSettingTabId++}`;
    return `${this.pluginId}:${prefix}:${Math.random().toString(36).slice(2, 8)}`;
  }

  async invokeCommand(id: string): Promise<void> {
    const callback = this.commandCallbacks.get(id) ?? this.commandCallbacks.get(`${this.pluginId}:${id}`);
    if (!callback) throw new Error(`Plugin command not registered: ${id}`);
    await callback.call(this.plugin);
  }

  async unload(): Promise<void> {
    if (this.plugin && typeof this.plugin.onunload === "function") {
      try {
        await this.plugin.onunload.call(this.plugin);
      } catch (error) {
        console.warn(`[plugin:${this.pluginId}] onunload failed`, error);
      }
    }
    for (const dispose of [...this.disposables].reverse()) {
      try {
        await dispose();
      } catch (error) {
        console.warn(`[plugin:${this.pluginId}] dispose failed`, error);
      }
    }
    this.disposables.length = 0;
    this.commandCallbacks.clear();
    this.workspaceEvents.clear();
    this.metadataEvents.clear();
    this.vaultEvents.clear();
    clearProcessorsForPlugin(this.pluginId);
    clearEditorContributionsForPlugin(this.pluginId);
    clearViewRegistryForPlugin(this.pluginId);
    clearPluginCommandsForPlugin(this.pluginId);
    usePluginUIStore.getState().clearPluginContributions(this.pluginId);
  }
}

class EventEmitter {
  private map = new Map<string, Set<(...args: unknown[]) => void>>();
  on(name: string, cb: (...args: unknown[]) => void): { off: () => void } {
    let set = this.map.get(name);
    if (!set) {
      set = new Set();
      this.map.set(name, set);
    }
    set.add(cb);
    return { off: () => set?.delete(cb) };
  }
  off(name: string, cb: (...args: unknown[]) => void): void {
    this.map.get(name)?.delete(cb);
  }
  trigger(name: string, ...args: unknown[]): void {
    for (const cb of this.map.get(name) ?? []) cb(...args);
  }
  clear(): void {
    this.map.clear();
  }
}

abstract class TAbstractFile {
  vault: unknown = null;
  constructor(public path: string, public name: string, public parent: TFolder | null) {}
}

class TFile extends TAbstractFile {
  extension: string;
  basename: string;
  constructor(path: string, name: string, parent: TFolder | null, public stat: { ctime: number; mtime: number; size: number }) {
    super(path, name, parent);
    const dot = name.lastIndexOf(".");
    this.extension = dot >= 0 ? name.slice(dot + 1) : "";
    this.basename = dot >= 0 ? name.slice(0, dot) : name;
  }
}

class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
  isRoot(): boolean {
    return !this.parent;
  }
}

interface PluginInstance {
  app: unknown;
  manifest: PluginManifest;
  onload?: () => void | Promise<void>;
  onunload?: () => void | Promise<void>;
  [key: string]: unknown;
}

function fileStat(node: FileNode) {
  const mtime = node.modifiedAt ? Date.parse(node.modifiedAt) : Date.now();
  return { ctime: mtime, mtime, size: node.size ?? 0 };
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\//, "");
}

function filePath(file: TFile | TAbstractFile | string): string {
  if (typeof file === "string") return normalizePath(file);
  return file.path;
}

export async function loadPluginMainRuntime(
  bundle: MainRuntimeBundle,
  context: MainRuntimeContext = {},
): Promise<LoadedPlugin> {
  ensureObsidianDomShim();
  const runtime = new Runtime(bundle, context);
  const obsidian = createObsidianModule(runtime);
  const module = { exports: {} as unknown };
  const exports = module.exports;
  const require = (id: string) => requireShim(id, runtime, obsidian);

  const processShim = (globalThis as { process?: unknown }).process ?? {
    env: { NODE_ENV: "production" },
    platform: "browser",
    versions: {},
    nextTick: (fn: () => void) => queueMicrotask(fn),
  };
  const globalShim = globalThis;
  const bufferShim = (globalThis as { Buffer?: unknown }).Buffer ?? undefined;

  try {
    const evaluator = new Function(
      "module",
      "exports",
      "require",
      "process",
      "global",
      "Buffer",
      `${bundle.mainSource}\n//# sourceURL=plugin://${bundle.id}/main.js\n`,
    );
    evaluator(module, module.exports, require, processShim, globalShim, bufferShim);
    if (module.exports === exports && exports && Object.keys(exports as object).length === 0) {
      // some plugins reassign module.exports — keep what's on module
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const enriched = new Error(
      `Plugin "${bundle.manifest.name || bundle.id}" failed to load: ${detail}`,
    );
    if (error instanceof Error && error.stack) {
      enriched.stack = `${enriched.message}\n${error.stack}`;
    }
    console.error(`[plugin:${bundle.id}] failed to evaluate main.js`, error);
    throw enriched;
  }

  const PluginCtor = resolvePluginExport(module.exports);
  let instance: PluginInstance;
  const app = createApp(runtime);
  if (typeof PluginCtor === "function") {
    try {
      instance = new (PluginCtor as new (app: unknown, manifest: PluginManifest) => PluginInstance)(app, bundle.manifest);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Plugin "${bundle.manifest.name || bundle.id}" constructor threw: ${detail}`);
    }
  } else if (PluginCtor && typeof PluginCtor === "object") {
    instance = PluginCtor as PluginInstance;
  } else {
    throw new Error(
      `Plugin "${bundle.manifest.name || bundle.id}" did not export a Plugin class or instance (got ${typeof PluginCtor}). Check that main.js ends with "module.exports = MyPlugin" or has a default export.`,
    );
  }
  if (!("app" in instance)) (instance as { app: unknown }).app = app;
  if (!("manifest" in instance)) (instance as { manifest: PluginManifest }).manifest = bundle.manifest;
  runtime.plugin = instance;

  if (bundle.stylesSource && runtime.has("ui:theme")) {
    runtime.track(registerPluginStyles(runtime.pluginId, bundle.stylesSource));
  }

  if (typeof instance.onload === "function") {
    try {
      await instance.onload.call(instance);
    } catch (error) {
      console.error(`[plugin:${bundle.id}] onload failed`, error);
      await runtime.unload().catch(() => undefined);
      throw error;
    }
  }

  return {
    pluginId: bundle.id,
    unload: () => runtime.unload(),
    invokeCommand: (id: string) => runtime.invokeCommand(id),
  };
}

function resolvePluginExport(value: unknown): unknown {
  if (value && typeof value === "object" && "default" in value) {
    return (value as { default: unknown }).default;
  }
  return value;
}

let globalEditorBridgeInstalled = false;
function ensureGlobalEditorBridge(): void {
  if (globalEditorBridgeInstalled) return;
  globalEditorBridgeInstalled = true;
  subscribeActiveEditor(() => {
    emitHostEvent("workspace.active-leaf-change", null);
  });
}

function createApp(runtime: Runtime) {
  ensureGlobalEditorBridge();
  const app: Record<string, unknown> = {
    vault: createVault(runtime),
    metadataCache: createMetadataCache(runtime),
    fileManager: createFileManager(runtime),
    keymap: { pushScope: () => {}, popScope: () => {} },
    scope: createScope(runtime),
    plugins: {
      getPlugin: () => null,
      enablePlugin: async () => false,
      disablePlugin: async () => false,
    },
    setting: { open: () => {}, close: () => {}, openTabById: () => null },
    lastEvent: null,
  };
  app.workspace = createWorkspace(runtime, app);
  return app;
}

function createVault(runtime: Runtime) {
  return {
    adapter: {
      getName: () => "Lattice Vault",
      getBasePath: () => "",
      read: (path: string) => readVault(runtime, path),
      readBinary: async (path: string) => {
        runtime.require("vault:read", "Vault.adapter.readBinary");
        const bytes = await commands.readVaultBinary(path);
        const buffer = new ArrayBuffer(bytes.length);
        new Uint8Array(buffer).set(bytes);
        return buffer;
      },
      write: (path: string, data: string) => writeVault(runtime, path, data),
      writeBinary: async (path: string, data: ArrayBuffer) => {
        runtime.require("vault:write", "Vault.adapter.writeBinary");
        await commands.writeVaultBinary(path, new Uint8Array(data));
      },
      exists: async (path: string) => {
        runtime.require("vault:read", "Vault.adapter.exists");
        return runtime.files().some((f) => f.path === normalizePath(path));
      },
      mkdir: async (path: string) => {
        runtime.require("vault:write", "Vault.adapter.mkdir");
        await commands.createFolder(path).catch(() => null);
      },
      remove: (path: string) => deleteVault(runtime, path),
      rename: (oldPath: string, newPath: string) => renameVault(runtime, oldPath, newPath),
      list: async () => {
        runtime.require("vault:read", "Vault.adapter.list");
        return {
          files: runtime.files().map((f) => f.path),
          folders: runtime.folders().map((f) => f.path),
        };
      },
      stat: async (path: string) => {
        runtime.require("vault:read", "Vault.adapter.stat");
        const file = runtime.fileCache.get(normalizePath(path));
        return file instanceof TFile ? file.stat : null;
      },
    },
    configDir: ".obsidian",
    getName: () => "Lattice Vault",
    getRoot: () => {
      runtime.require("vault:read", "Vault.getRoot");
      return new TFolder("", "", null);
    },
    getFiles: () => {
      runtime.require("vault:read", "Vault.getFiles");
      return runtime.files();
    },
    getMarkdownFiles: () => {
      runtime.require("vault:read", "Vault.getMarkdownFiles");
      return runtime.files().filter((f) => f.extension.toLowerCase() === "md");
    },
    getAllLoadedFiles: () => Array.from(runtime.fileCache.values()),
    getAbstractFileByPath: (path: string) => runtime.fileCache.get(normalizePath(path)) ?? null,
    read: (file: TFile | string) => readVault(runtime, filePath(file)),
    cachedRead: async (file: TFile | string) => {
      const path = filePath(file);
      if (runtime.readCache.has(path)) return runtime.readCache.get(path) ?? "";
      return readVault(runtime, path);
    },
    modify: (file: TFile | string, data: string) => writeVault(runtime, filePath(file), data),
    process: async (file: TFile | string, fn: (data: string) => string) => {
      const current = await readVault(runtime, filePath(file));
      const next = fn(current);
      await writeVault(runtime, filePath(file), next);
      return next;
    },
    create: async (path: string, data: string) => {
      runtime.require("vault:write", "Vault.create");
      const normalized = normalizePath(path);
      await commands.createNote(normalized, data);
      return runtime.cacheFile(normalized, data);
    },
    createFolder: async (path: string) => {
      runtime.require("vault:write", "Vault.createFolder");
      await commands.createFolder(path);
      return new TFolder(normalizePath(path), path.split("/").pop() ?? "", null);
    },
    delete: (file: TFile | string) => deleteVault(runtime, filePath(file)),
    trash: (file: TFile | string) => deleteVault(runtime, filePath(file)),
    rename: (file: TFile | string, newPath: string) => renameVault(runtime, filePath(file), newPath),
    on: (name: string, callback: (...args: unknown[]) => void) => {
      const hostName = vaultEventName(name);
      if (hostName) {
        const dispose = onHostEvent(hostName, callback);
        runtime.track(dispose);
        return { off: dispose };
      }
      runtime.vaultEvents.on(name, callback);
      return { off: () => runtime.vaultEvents.off(name, callback) };
    },
    off: (name: string, callback: (...args: unknown[]) => void) => {
      const hostName = vaultEventName(name);
      if (hostName) offHostEvent(hostName, callback);
      else runtime.vaultEvents.off(name, callback);
    },
    trigger: (name: string, ...args: unknown[]) => runtime.vaultEvents.trigger(name, ...args),
  };
}

function vaultEventName(name: string): HostEventName | null {
  switch (name) {
    case "create":
      return "vault.create";
    case "modify":
      return "vault.modify";
    case "delete":
      return "vault.delete";
    case "rename":
      return "vault.rename";
    case "closed":
      return "vault.closed";
    default:
      return null;
  }
}

interface LeafShim {
  view: MarkdownViewShim | PluginLeafView;
  containerEl: HTMLElement;
  app: unknown;
  getViewState: () => { type: string; state: unknown };
  setViewState: (state: { type: string; state?: unknown; active?: boolean }) => Promise<void>;
  openFile: (file: TFile) => Promise<void>;
  detach: () => void;
  getRoot: () => unknown;
  getDisplayText: () => string;
  getViewType: () => string;
  on: (name: string, callback: (...args: unknown[]) => void) => { off: () => void };
}

interface PluginLeafShim extends LeafShim {
  view: PluginLeafView;
}

function makePluginLeafShim(type: string, state: unknown, app: unknown): PluginLeafShim {
  const containerEl = document.createElement("div");
  const view: PluginLeafView = { getViewType: () => type, containerEl, app };
  return {
    view,
    containerEl,
    app,
    getViewState: () => ({ type, state }),
    setViewState: async () => {},
    openFile: async () => {},
    detach: () => {},
    getRoot: () => null,
    getDisplayText: () => type,
    getViewType: () => type,
    on: () => ({ off: () => {} }),
  };
}

interface MarkdownViewShim {
  file: TFile | null;
  editor: ReturnType<typeof makeObsidianEditorShim> | null;
  getViewType: () => string;
  getMode: () => "source" | "preview";
  containerEl: HTMLElement;
  contentEl: HTMLElement;
  data: string;
  app: unknown;
}

interface PluginLeafView {
  getViewType: () => string;
  containerEl: HTMLElement;
  app?: unknown;
}

function createMarkdownViewShim(runtime: Runtime, app: unknown): MarkdownViewShim {
  const editor = getActiveEditor();
  const file = runtime.activePath
    ? runtime.fileCache.get(runtime.activePath) instanceof TFile
      ? (runtime.fileCache.get(runtime.activePath) as TFile)
      : runtime.cacheFile(runtime.activePath)
    : null;
  const containerEl = document.createElement("div");
  return {
    file,
    editor: editor ? makeObsidianEditorShim(editor) : null,
    getViewType: () => "markdown",
    getMode: () => "source",
    containerEl,
    contentEl: containerEl,
    data: "",
    app,
  };
}

function createWorkspace(runtime: Runtime, app: unknown) {
  const buildMarkdownLeaf = (): LeafShim => {
    const view = createMarkdownViewShim(runtime, app);
    return {
      view,
      containerEl: view.containerEl,
      app,
      getViewState: () => ({ type: "markdown", state: { file: runtime.activePath } }),
      setViewState: async (state) => {
        runtime.require("workspace:layout", "WorkspaceLeaf.setViewState");
        if (state.type && state.type !== "markdown") {
          await openPluginLeaf(state.type, state.state, state.active ?? true);
        }
      },
      openFile: async (file: TFile) => {
        runtime.require("workspace:layout", "WorkspaceLeaf.openFile");
        await useVaultStore.getState().setActivePath(file.path);
      },
      detach: () => {},
      getRoot: () => null,
      getDisplayText: () => view.file?.basename ?? "Untitled",
      getViewType: () => "markdown",
      on: () => ({ off: () => {} }),
    };
  };

  const buildPluginLeaf = (path: string, type: string, state: unknown): LeafShim => {
    const containerEl = document.createElement("div");
    const view: PluginLeafView = { getViewType: () => type, containerEl, app };
    return {
      view,
      containerEl,
      app,
      getViewState: () => ({ type, state }),
      setViewState: async (next) => {
        runtime.require("workspace:layout", "WorkspaceLeaf.setViewState");
        if (next.type && next.type !== type) {
          await openPluginLeaf(next.type, next.state, next.active ?? true);
          return;
        }
        setPluginViewState(path, type, next.state ?? state, next.active ?? true);
      },
      openFile: async () => {},
      detach: () => {
        const tabs = useWorkspaceStore.getState().tabs;
        const tab = tabs.find((t) => t.path === path);
        if (tab) useWorkspaceStore.getState().closeTab(tab.id);
        clearPluginViewState(path);
      },
      getRoot: () => null,
      getDisplayText: () => type,
      getViewType: () => type,
      on: () => ({ off: () => {} }),
    };
  };

  async function openPluginLeaf(type: string, state: unknown, active: boolean): Promise<LeafShim> {
    const path = `plugin-view://${type}`;
    setPluginViewState(path, type, state, active);
    useWorkspaceStore.getState().openTab(path, { activate: active });
    if (active) await useVaultStore.getState().setActivePath(path);
    return buildPluginLeaf(path, type, state);
  }

  function leavesOfType(type: string): LeafShim[] {
    if (type === "markdown") {
      const path = useVaultStore.getState().activePath;
      if (path && !path.startsWith("plugin-view://")) return [buildMarkdownLeaf()];
      return [];
    }
    const real = listPluginViewLeafStates(type).map(({ path, entry }) => {
      const bound = getActiveLeafObject(path) as LeafShim | undefined;
      return bound ?? buildPluginLeaf(path, entry.type, entry.state);
    });
    if (real.length === 0 && getPluginView(type)) {
      return [buildGhostPluginLeaf(type)];
    }
    return real;
  }

  function buildGhostPluginLeaf(type: string): LeafShim {
    const containerEl = document.createElement("div");
    containerEl.dataset.latticeGhostLeaf = type;
    const viewProxyTarget: Record<string, unknown> = {
      getViewType: () => type,
      getDisplayText: () => type,
      getState: () => ({}),
      setState: async () => {},
      getIcon: () => "puzzle",
      containerEl,
      contentEl: containerEl,
      app,
      leaf: null as unknown,
      file: null,
      navigation: false,
    };
    const view = new Proxy(viewProxyTarget, {
      get(target, prop) {
        if (prop in target) return target[prop as string];
        return undefined;
      },
    }) as unknown as PluginLeafView;
    return {
      view,
      containerEl,
      app,
      getViewState: () => ({ type, state: null }),
      setViewState: async () => {},
      openFile: async () => {},
      detach: () => {},
      getRoot: () => null,
      getDisplayText: () => type,
      getViewType: () => type,
      on: () => ({ off: () => {} }),
    };
  }

  function activeLeafSnapshot(): LeafShim {
    const path = useVaultStore.getState().activePath;
    if (path?.startsWith("plugin-view://")) {
      const bound = getActiveLeafObject(path) as LeafShim | undefined;
      if (bound) return bound;
      const type = path.slice("plugin-view://".length);
      const entry = listPluginViewLeafStates(type).find((e) => e.path === path);
      return buildPluginLeaf(path, type, entry?.entry.state ?? null);
    }
    return buildMarkdownLeaf();
  }

  const subscriptions: Array<() => void> = [];
  const subscribe = (name: HostEventName, callback: (...args: unknown[]) => void) => {
    const dispose = onHostEvent(name, callback);
    subscriptions.push(dispose);
    runtime.track(dispose);
    return { off: dispose };
  };

  const obsidianToHost: Record<string, HostEventName> = {
    "file-open": "workspace.file-open",
    "active-leaf-change": "workspace.active-leaf-change",
    "layout-change": "workspace.layout-change",
    quit: "workspace.quit",
    resize: "workspace.resize",
    "css-change": "workspace.css-change",
  };

  return {
    get activeLeaf() {
      return activeLeafSnapshot();
    },
    leftSplit: { collapsed: false },
    rightSplit: { collapsed: false },
    rootSplit: {},
    containerEl: document.body,
    getActiveFile: () => {
      runtime.require("workspace:read", "Workspace.getActiveFile");
      const path = useVaultStore.getState().activePath;
      if (!path || path.startsWith("plugin-view://")) return null;
      const cached = runtime.fileCache.get(path);
      return cached instanceof TFile ? cached : runtime.cacheFile(path);
    },
    getActiveViewOfType: (_ctor?: unknown) => {
      runtime.require("workspace:read", "Workspace.getActiveViewOfType");
      const leaf = activeLeafSnapshot();
      return leaf.view;
    },
    getLeaf: (_newLeaf?: boolean | string) => buildMarkdownLeaf(),
    getMostRecentLeaf: () => buildMarkdownLeaf(),
    getLeftLeaf: () => buildMarkdownLeaf(),
    getRightLeaf: () => buildMarkdownLeaf(),
    getLeafById: (id: string) => {
      const tab = useWorkspaceStore.getState().tabs.find((t) => t.id === id);
      if (!tab) return null;
      const type = parsePluginViewType(tab.path);
      if (!type) return buildMarkdownLeaf();
      const bound = getActiveLeafObject(tab.path) as LeafShim | undefined;
      if (bound) return bound;
      const entry = listPluginViewLeafStates(type).find((e) => e.path === tab.path);
      return buildPluginLeaf(tab.path, type, entry?.entry.state ?? null);
    },
    getLeavesOfType: leavesOfType,
    detachLeavesOfType: (type: string) => {
      runtime.require("workspace:layout", "Workspace.detachLeavesOfType");
      for (const { path } of listPluginViewLeafStates(type)) {
        const tab = useWorkspaceStore.getState().tabs.find((t) => t.path === path);
        if (tab) useWorkspaceStore.getState().closeTab(tab.id);
        clearPluginViewState(path);
      }
    },
    iterateAllLeaves: (cb: (leaf: unknown) => void) => {
      for (const tab of useWorkspaceStore.getState().tabs) {
        const type = parsePluginViewType(tab.path);
        if (type) {
          const bound = getActiveLeafObject(tab.path);
          if (bound) {
            cb(bound);
            continue;
          }
          const entry = listPluginViewLeafStates(type).find((e) => e.path === tab.path);
          cb(buildPluginLeaf(tab.path, type, entry?.entry.state ?? null));
        } else {
          cb(buildMarkdownLeaf());
        }
      }
    },
    iterateRootLeaves: function (cb: (leaf: unknown) => void) {
      this.iterateAllLeaves(cb);
    },
    revealLeaf: async (leaf: LeafShim) => {
      runtime.require("workspace:layout", "Workspace.revealLeaf");
      const type = leaf.getViewType();
      const path = type === "markdown" ? useVaultStore.getState().activePath : `plugin-view://${type}`;
      if (path) await useVaultStore.getState().setActivePath(path);
    },
    openLinkText: async (linktext: string, sourcePath?: string, newLeaf?: boolean) => {
      runtime.require("workspace:layout", "Workspace.openLinkText");
      void sourcePath;
      void newLeaf;
      await useVaultStore.getState().openLinkedNote(linktext);
    },
    setActiveLeaf: (_leaf: LeafShim) => {},
    on: (name: string, callback: (...args: unknown[]) => void) => {
      const hostName = obsidianToHost[name];
      if (hostName) return subscribe(hostName, callback);
      runtime.workspaceEvents.on(name, callback);
      return { off: () => runtime.workspaceEvents.off(name, callback) };
    },
    off: (name: string, callback: (...args: unknown[]) => void) => {
      const hostName = obsidianToHost[name];
      if (hostName) offHostEvent(hostName, callback);
      else runtime.workspaceEvents.off(name, callback);
    },
    trigger: (name: string, ...args: unknown[]) => runtime.workspaceEvents.trigger(name, ...args),
    onLayoutReady: (callback: () => void) => {
      Promise.resolve().then(callback);
    },
    requestSaveLayout: () => {},
    changeLayout: async () => {},
    getLayout: () => ({}),
    setLayout: () => {},
  };
}

function parsePluginViewType(path: string): string | null {
  if (!path.startsWith("plugin-view://")) return null;
  return path.slice("plugin-view://".length);
}

function createMetadataCache(runtime: Runtime) {
  const cache = new Map<string, ReturnType<typeof toObsidianFileCache>>();
  let resolvedSnapshot: { resolved: Record<string, Record<string, number>>; unresolved: Record<string, Record<string, number>> } = { resolved: {}, unresolved: {} };
  let linkBuildPromise: Promise<void> | null = null;

  const ensureLinks = (force = false): Promise<void> => {
    if (linkBuildPromise && !force) return linkBuildPromise;
    linkBuildPromise = (async () => {
      const files = runtime.files().filter((f) => f.extension.toLowerCase() === "md");
      const results: Array<{ path: string; metadata: Awaited<ReturnType<typeof commands.getNoteMetadata>> | null }> = [];
      for (const file of files) {
        try {
          const meta = await commands.getNoteMetadata(file.path);
          results.push({ path: file.path, metadata: meta });
          if (meta) cache.set(file.path, toObsidianFileCache(meta));
        } catch {
          results.push({ path: file.path, metadata: null });
        }
      }
      resolvedSnapshot = buildResolvedLinks(results);
      for (const k of Object.keys(api.resolvedLinks)) delete api.resolvedLinks[k];
      for (const k of Object.keys(api.unresolvedLinks)) delete api.unresolvedLinks[k];
      Object.assign(api.resolvedLinks, resolvedSnapshot.resolved);
      Object.assign(api.unresolvedLinks, resolvedSnapshot.unresolved);
      runtime.metadataEvents.trigger("resolved");
    })();
    return linkBuildPromise;
  };

  const refreshOne = async (path: string): Promise<void> => {
    try {
      const meta = await commands.getNoteMetadata(path);
      if (meta) cache.set(path, toObsidianFileCache(meta));
      else cache.delete(path);
      const file = runtime.fileCache.get(path);
      runtime.metadataEvents.trigger("changed", file ?? path, meta ? cache.get(path) : null);
    } catch {
      cache.delete(path);
    }
  };

  const rebuildLinks = (): void => {
    linkBuildPromise = null;
    void ensureLinks(true);
  };

  const isMd = (path: string): boolean => path.toLowerCase().endsWith(".md");

  runtime.track(
    onHostEvent("vault.modify", (...args) => {
      const path = typeof args[0] === "string" ? args[0] : (args[0] as { path?: string } | undefined)?.path;
      if (!path || !isMd(path)) return;
      void refreshOne(path).then(rebuildLinks);
    }),
  );
  runtime.track(
    onHostEvent("vault.create", (...args) => {
      const path = typeof args[0] === "string" ? args[0] : (args[0] as { path?: string } | undefined)?.path;
      if (!path || !isMd(path)) return;
      void refreshOne(path).then(rebuildLinks);
    }),
  );
  runtime.track(
    onHostEvent("vault.delete", (...args) => {
      const path = typeof args[0] === "string" ? args[0] : (args[0] as { path?: string } | undefined)?.path;
      if (!path) return;
      cache.delete(path);
      rebuildLinks();
      runtime.metadataEvents.trigger("deleted", path);
    }),
  );
  runtime.track(
    onHostEvent("vault.rename", (...args) => {
      const payload = args[0] as { path?: string; oldPath?: string } | undefined;
      const oldPath = payload?.oldPath ?? (typeof args[1] === "string" ? (args[1] as string) : undefined);
      const newPath = payload?.path ?? (typeof args[0] === "string" ? (args[0] as string) : undefined);
      if (oldPath) cache.delete(oldPath);
      if (newPath && isMd(newPath)) void refreshOne(newPath).then(rebuildLinks);
      else rebuildLinks();
    }),
  );

  const api = {
    getFileCache: (file: TFile | string) => {
      runtime.require("vault:read", "MetadataCache.getFileCache");
      const path = filePath(file);
      const cached = cache.get(path);
      if (cached) {
        void commands
          .getNoteMetadata(path)
          .then((meta) => {
            if (meta) cache.set(path, toObsidianFileCache(meta));
          })
          .catch(() => undefined);
        return cached;
      }
      void commands
        .getNoteMetadata(path)
        .then((meta) => {
          if (meta) {
            cache.set(path, toObsidianFileCache(meta));
            runtime.metadataEvents.trigger("changed", runtime.fileCache.get(path));
          }
        })
        .catch(() => undefined);
      return toObsidianFileCache(null);
    },
    getCache: (file: TFile | string) => {
      runtime.require("vault:read", "MetadataCache.getCache");
      const path = filePath(file);
      return cache.get(path) ?? null;
    },
    getFirstLinkpathDest: (linkpath: string) => {
      runtime.require("vault:read", "MetadataCache.getFirstLinkpathDest");
      const cleaned = linkpath.split("#")[0].split("|")[0].trim();
      const candidate = cleaned.toLowerCase().endsWith(".md") ? cleaned : `${cleaned}.md`;
      const direct = runtime.fileCache.get(normalizePath(candidate));
      if (direct instanceof TFile) return direct;
      for (const file of runtime.files()) {
        if (file.path.endsWith(`/${candidate}`) || file.basename.toLowerCase() === cleaned.toLowerCase()) {
          return file;
        }
      }
      return null;
    },
    fileToLinktext: (file: TFile, _sourcePath?: string, _omitMdExtension?: boolean) =>
      file.path.replace(/\.md$/i, ""),
    resolvedLinks: {} as Record<string, Record<string, number>>,
    unresolvedLinks: {} as Record<string, Record<string, number>>,
    on: (name: string, cb: (...args: unknown[]) => void) => {
      const ref = runtime.metadataEvents.on(name, cb);
      return ref;
    },
    off: (name: string, cb: (...args: unknown[]) => void) => runtime.metadataEvents.off(name, cb),
    trigger: (name: string, ...args: unknown[]) => runtime.metadataEvents.trigger(name, ...args),
  };

  void ensureLinks();
  return api;
}

function createFileManager(runtime: Runtime) {
  return {
    getNewFileParent: () => runtime.folders()[0] ?? new TFolder("", "", null),
    generateMarkdownLink: (file: TFile, sourcePath: string, subpath?: string, alias?: string) => {
      const target = file.path.replace(/\.md$/i, "");
      void sourcePath;
      const label = alias ?? target;
      const anchor = subpath ?? "";
      return `[[${target}${anchor}|${label}]]`;
    },
    renameFile: async (file: TFile | string, newPath: string) => renameVault(runtime, filePath(file), newPath),
    processFrontMatter: async (file: TFile | string, fn: (frontmatter: Record<string, unknown>) => void) => {
      const path = filePath(file);
      const content = await readVault(runtime, path);
      const fm: Record<string, unknown> = {};
      fn(fm);
      await writeVault(runtime, path, content);
    },
  };
}

function createScope(runtime: Runtime) {
  return {
    register: (modifiers: string[], key: string, callback: () => void) => {
      void modifiers;
      void key;
      runtime.track(() => {
        void callback;
      });
    },
    unregister: () => {},
  };
}

async function readVault(runtime: Runtime, path: string): Promise<string> {
  runtime.require("vault:read", "Vault.read");
  const normalized = normalizePath(path);
  const note = await commands.readNote(normalized);
  runtime.readCache.set(normalized, note.content);
  runtime.cacheFile(normalized, note.content);
  return note.content;
}

async function writeVault(runtime: Runtime, path: string, content: string): Promise<void> {
  runtime.require("vault:write", "Vault.modify");
  const normalized = normalizePath(path);
  await commands.writeNote(normalized, content);
  runtime.readCache.set(normalized, content);
  runtime.cacheFile(normalized, content);
  runtime.vaultEvents.trigger("modify", runtime.fileCache.get(normalized));
}

async function deleteVault(runtime: Runtime, path: string): Promise<void> {
  runtime.require("vault:write", "Vault.delete");
  const normalized = normalizePath(path);
  await commands.deleteNote(normalized);
  const file = runtime.fileCache.get(normalized);
  runtime.removeCached(normalized);
  if (file) runtime.vaultEvents.trigger("delete", file);
}

async function renameVault(runtime: Runtime, oldPath: string, newPath: string): Promise<void> {
  runtime.require("vault:write", "Vault.rename");
  const oldNormalized = normalizePath(oldPath);
  const newNormalized = normalizePath(newPath);
  await commands.renameNote(oldNormalized, newNormalized);
  const cached = runtime.readCache.get(oldNormalized);
  runtime.removeCached(oldNormalized);
  const file = runtime.cacheFile(newNormalized, cached);
  runtime.vaultEvents.trigger("rename", file, oldNormalized);
}

function createObsidianModule(runtime: Runtime): Record<string, unknown> {
  class Component {
    private readonly children: Component[] = [];
    private readonly cleanups: Disposer[] = [];
    protected loaded = false;
    async load(): Promise<void> {
      if (this.loaded) return;
      this.loaded = true;
      await this.onload();
      for (const child of this.children) await child.load();
    }
    async unload(): Promise<void> {
      for (const child of [...this.children].reverse()) await child.unload();
      for (const dispose of [...this.cleanups].reverse()) {
        try {
          await dispose();
        } catch (error) {
          console.warn(error);
        }
      }
      this.cleanups.length = 0;
      this.children.length = 0;
      if (this.loaded) await this.onunload();
      this.loaded = false;
    }
    async onload(): Promise<void> {}
    async onunload(): Promise<void> {}
    addChild<T extends Component>(child: T): T {
      this.children.push(child);
      if (this.loaded) void child.load();
      return child;
    }
    removeChild<T extends Component>(child: T): T {
      const idx = this.children.indexOf(child);
      if (idx >= 0) this.children.splice(idx, 1);
      void child.unload();
      return child;
    }
    register(disposable: Disposer | { unload?: () => void; detach?: () => void; off?: () => void }): void {
      const dispose: Disposer =
        typeof disposable === "function"
          ? disposable
          : () => {
              const d = disposable as { unload?: () => void; detach?: () => void; off?: () => void };
              d.unload?.();
              d.off?.();
              d.detach?.();
            };
      this.cleanups.push(dispose);
      runtime.track(dispose);
    }
    registerEvent(disposable: { off?: () => void } | (() => void)): void {
      this.register(disposable as Disposer);
    }
    registerDomEvent<T extends EventTarget>(
      el: T,
      type: string,
      callback: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions,
    ): void {
      el.addEventListener(type, callback, options);
      this.register(() => el.removeEventListener(type, callback, options));
    }
    registerInterval(intervalId: number): void {
      this.register(() => clearInterval(intervalId));
    }
  }

  class Notice {
    private el: HTMLElement | null = null;
    constructor(message: string | DocumentFragment, timeout = 4000) {
      const text = message instanceof DocumentFragment ? message.textContent ?? "" : String(message);
      runtime.notice(text, timeout);
    }
    setMessage(message: string): this {
      runtime.notice(message);
      return this;
    }
    hide(): void {
      this.el?.remove();
    }
  }

  class Modal extends Component {
    titleEl: HTMLElement;
    contentEl: HTMLElement;
    modalEl: HTMLElement;
    containerEl: HTMLElement;
    constructor(public app: unknown) {
      super();
      this.containerEl = document.createElement("div");
      this.containerEl.className = "lattice-plugin-modal-container";
      this.modalEl = document.createElement("div");
      this.modalEl.className = "lattice-plugin-modal";
      this.titleEl = document.createElement("h2");
      this.titleEl.className = "lattice-plugin-modal-title";
      this.contentEl = document.createElement("div");
      this.contentEl.className = "lattice-plugin-modal-content";
      this.modalEl.append(this.titleEl, this.contentEl);
      this.containerEl.append(this.modalEl);
      const close = () => this.close();
      this.containerEl.addEventListener("click", (event) => {
        if (event.target === this.containerEl) close();
      });
    }
    open(): void {
      runtime.require("ui:modal", "Modal.open");
      document.body.appendChild(this.containerEl);
      this.onOpen();
    }
    close(): void {
      this.onClose();
      this.containerEl.parentNode?.removeChild(this.containerEl);
    }
    setTitle(title: string): this {
      this.titleEl.textContent = title;
      return this;
    }
    setContent(content: string | DocumentFragment): this {
      this.contentEl.replaceChildren(typeof content === "string" ? document.createTextNode(content) : content);
      return this;
    }
    onOpen(): void {}
    onClose(): void {}
  }

  class PluginSettingTab extends Component {
    containerEl: HTMLElement;
    name = "";
    constructor(public app: unknown, public plugin: unknown) {
      super();
      this.containerEl = document.createElement("div");
      this.containerEl.className = "lattice-plugin-setting-tab";
    }
    display(): void {}
    hide(): void {}
  }

  class Setting {
    settingEl: HTMLElement;
    infoEl: HTMLElement;
    nameEl: HTMLElement;
    descEl: HTMLElement;
    controlEl: HTMLElement;
    constructor(public containerEl: HTMLElement) {
      this.settingEl = document.createElement("div");
      this.settingEl.className = "setting-item";
      this.infoEl = document.createElement("div");
      this.infoEl.className = "setting-item-info";
      this.nameEl = document.createElement("div");
      this.nameEl.className = "setting-item-name";
      this.descEl = document.createElement("div");
      this.descEl.className = "setting-item-description";
      this.controlEl = document.createElement("div");
      this.controlEl.className = "setting-item-control";
      this.infoEl.append(this.nameEl, this.descEl);
      this.settingEl.append(this.infoEl, this.controlEl);
      containerEl.appendChild(this.settingEl);
    }
    setName(name: string): this {
      this.nameEl.textContent = name;
      return this;
    }
    setDesc(desc: string): this {
      this.descEl.textContent = desc;
      return this;
    }
    setHeading(): this {
      this.settingEl.classList.add("setting-item-heading");
      return this;
    }
    setDisabled(disabled: boolean): this {
      this.settingEl.classList.toggle("is-disabled", disabled);
      return this;
    }
    setClass(name: string): this {
      this.settingEl.classList.add(name);
      return this;
    }
    addText(cb: (text: TextComponent) => void): this {
      cb(new TextComponent(this.controlEl));
      return this;
    }
    addTextArea(cb: (text: TextAreaComponent) => void): this {
      cb(new TextAreaComponent(this.controlEl));
      return this;
    }
    addToggle(cb: (toggle: ToggleComponent) => void): this {
      cb(new ToggleComponent(this.controlEl));
      return this;
    }
    addButton(cb: (button: ButtonComponent) => void): this {
      cb(new ButtonComponent(this.controlEl));
      return this;
    }
    addExtraButton(cb: (button: ExtraButtonComponent) => void): this {
      cb(new ExtraButtonComponent(this.controlEl));
      return this;
    }
    addDropdown(cb: (dd: DropdownComponent) => void): this {
      cb(new DropdownComponent(this.controlEl));
      return this;
    }
    addSlider(cb: (slider: SliderComponent) => void): this {
      cb(new SliderComponent(this.controlEl));
      return this;
    }
    addColorPicker(cb: (picker: ColorComponent) => void): this {
      cb(new ColorComponent(this.controlEl));
      return this;
    }
    addMomentFormat(cb: (component: MomentFormatComponent) => void): this {
      cb(new MomentFormatComponent(this.controlEl));
      return this;
    }
    addSearch(cb: (component: SearchComponent) => void): this {
      cb(new SearchComponent(this.controlEl));
      return this;
    }
    addProgressBar(cb: (component: ProgressBarComponent) => void): this {
      cb(new ProgressBarComponent(this.controlEl));
      return this;
    }
    addToggleSwitch(cb: (toggle: ToggleComponent) => void): this {
      cb(new ToggleComponent(this.controlEl));
      return this;
    }
    then(cb: (setting: Setting) => unknown): this {
      try {
        cb(this);
      } catch (error) {
        console.warn(`[plugin:${runtime.pluginId}] Setting.then() threw`, error);
      }
      return this;
    }
    clear(): this {
      this.controlEl.replaceChildren();
      return this;
    }
    setTooltip(tooltip: string): this {
      this.settingEl.setAttribute("aria-label", tooltip);
      this.settingEl.setAttribute("title", tooltip);
      return this;
    }
  }

  class TextComponent {
    inputEl: HTMLInputElement;
    private cb: ((value: string) => void | Promise<void>) | null = null;
    constructor(parent: HTMLElement) {
      this.inputEl = document.createElement("input");
      this.inputEl.type = "text";
      parent.appendChild(this.inputEl);
      this.inputEl.addEventListener("input", () => void this.cb?.(this.inputEl.value));
    }
    setValue(value: string): this {
      this.inputEl.value = value;
      return this;
    }
    getValue(): string {
      return this.inputEl.value;
    }
    setPlaceholder(value: string): this {
      this.inputEl.placeholder = value;
      return this;
    }
    setDisabled(disabled: boolean): this {
      this.inputEl.disabled = disabled;
      return this;
    }
    onChange(cb: (value: string) => void | Promise<void>): this {
      this.cb = cb;
      return this;
    }
  }

  class TextAreaComponent {
    inputEl: HTMLTextAreaElement;
    private cb: ((value: string) => void | Promise<void>) | null = null;
    constructor(parent: HTMLElement) {
      this.inputEl = document.createElement("textarea");
      parent.appendChild(this.inputEl);
      this.inputEl.addEventListener("input", () => void this.cb?.(this.inputEl.value));
    }
    setValue(value: string): this {
      this.inputEl.value = value;
      return this;
    }
    getValue(): string {
      return this.inputEl.value;
    }
    setPlaceholder(value: string): this {
      this.inputEl.placeholder = value;
      return this;
    }
    onChange(cb: (value: string) => void | Promise<void>): this {
      this.cb = cb;
      return this;
    }
  }

  class ToggleComponent {
    toggleEl: HTMLInputElement;
    private cb: ((value: boolean) => void | Promise<void>) | null = null;
    constructor(parent: HTMLElement) {
      this.toggleEl = document.createElement("input");
      this.toggleEl.type = "checkbox";
      this.toggleEl.className = "lattice-plugin-toggle";
      parent.appendChild(this.toggleEl);
      this.toggleEl.addEventListener("change", () => void this.cb?.(this.toggleEl.checked));
    }
    setValue(value: boolean): this {
      this.toggleEl.checked = value;
      return this;
    }
    getValue(): boolean {
      return this.toggleEl.checked;
    }
    onChange(cb: (value: boolean) => void | Promise<void>): this {
      this.cb = cb;
      return this;
    }
  }

  class ButtonComponent {
    buttonEl: HTMLButtonElement;
    constructor(parent: HTMLElement) {
      this.buttonEl = document.createElement("button");
      this.buttonEl.type = "button";
      parent.appendChild(this.buttonEl);
    }
    setButtonText(text: string): this {
      this.buttonEl.textContent = text;
      return this;
    }
    setIcon(_icon: string): this {
      return this;
    }
    setCta(): this {
      this.buttonEl.classList.add("mod-cta");
      return this;
    }
    setWarning(): this {
      this.buttonEl.classList.add("mod-warning");
      return this;
    }
    setDisabled(disabled: boolean): this {
      this.buttonEl.disabled = disabled;
      return this;
    }
    onClick(cb: (event: MouseEvent) => void | Promise<void>): this {
      this.buttonEl.addEventListener("click", (event) => void cb(event));
      return this;
    }
  }

  class DropdownComponent {
    selectEl: HTMLSelectElement;
    private cb: ((value: string) => void | Promise<void>) | null = null;
    constructor(parent: HTMLElement) {
      this.selectEl = document.createElement("select");
      parent.appendChild(this.selectEl);
      this.selectEl.addEventListener("change", () => void this.cb?.(this.selectEl.value));
    }
    addOption(value: string, label: string): this {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      this.selectEl.appendChild(option);
      return this;
    }
    addOptions(options: Record<string, string>): this {
      for (const [value, label] of Object.entries(options)) this.addOption(value, label);
      return this;
    }
    setValue(value: string): this {
      this.selectEl.value = value;
      return this;
    }
    getValue(): string {
      return this.selectEl.value;
    }
    onChange(cb: (value: string) => void | Promise<void>): this {
      this.cb = cb;
      return this;
    }
  }

  class SliderComponent {
    sliderEl: HTMLInputElement;
    private cb: ((value: number) => void | Promise<void>) | null = null;
    constructor(parent: HTMLElement) {
      this.sliderEl = document.createElement("input");
      this.sliderEl.type = "range";
      parent.appendChild(this.sliderEl);
      this.sliderEl.addEventListener("input", () => void this.cb?.(Number(this.sliderEl.value)));
    }
    setLimits(min: number, max: number, step: number): this {
      this.sliderEl.min = String(min);
      this.sliderEl.max = String(max);
      this.sliderEl.step = String(step);
      return this;
    }
    setValue(value: number): this {
      this.sliderEl.value = String(value);
      return this;
    }
    getValue(): number {
      return Number(this.sliderEl.value);
    }
    setDynamicTooltip(): this {
      return this;
    }
    showTooltip(): this {
      return this;
    }
    onChange(cb: (value: number) => void | Promise<void>): this {
      this.cb = cb;
      return this;
    }
  }

  class ExtraButtonComponent {
    extraSettingsEl: HTMLButtonElement;
    private cb: ((event: MouseEvent) => void | Promise<void>) | null = null;
    constructor(parent: HTMLElement) {
      this.extraSettingsEl = document.createElement("button");
      this.extraSettingsEl.type = "button";
      this.extraSettingsEl.className = "clickable-icon extra-setting-button";
      parent.appendChild(this.extraSettingsEl);
      this.extraSettingsEl.addEventListener("click", (event) => void this.cb?.(event));
    }
    setIcon(icon: string): this {
      this.extraSettingsEl.setAttribute("data-icon", icon);
      this.extraSettingsEl.textContent = "";
      try {
        const svg = (lucide as { icons?: Record<string, { toSvg?: () => string }> }).icons?.[icon]?.toSvg?.();
        if (svg) this.extraSettingsEl.innerHTML = svg;
        else this.extraSettingsEl.textContent = icon;
      } catch {
        this.extraSettingsEl.textContent = icon;
      }
      return this;
    }
    setTooltip(tooltip: string): this {
      this.extraSettingsEl.setAttribute("aria-label", tooltip);
      this.extraSettingsEl.setAttribute("title", tooltip);
      return this;
    }
    setDisabled(disabled: boolean): this {
      this.extraSettingsEl.disabled = disabled;
      return this;
    }
    onClick(cb: (event: MouseEvent) => void | Promise<void>): this {
      this.cb = cb;
      return this;
    }
  }

  class ColorComponent {
    private inputEl: HTMLInputElement;
    private cb: ((value: string) => void | Promise<void>) | null = null;
    constructor(parent: HTMLElement) {
      this.inputEl = document.createElement("input");
      this.inputEl.type = "color";
      this.inputEl.className = "lattice-plugin-color";
      parent.appendChild(this.inputEl);
      this.inputEl.addEventListener("input", () => void this.cb?.(this.inputEl.value));
    }
    setValue(value: string): this {
      if (value) this.inputEl.value = value.startsWith("#") ? value : `#${value}`;
      return this;
    }
    getValue(): string {
      return this.inputEl.value;
    }
    setValueRgb(rgb: { r: number; g: number; b: number }): this {
      const hex = `#${[rgb.r, rgb.g, rgb.b].map((c) => Math.max(0, Math.min(255, c | 0)).toString(16).padStart(2, "0")).join("")}`;
      this.inputEl.value = hex;
      return this;
    }
    getValueRgb(): { r: number; g: number; b: number } {
      const m = /^#?([0-9a-f]{6})$/i.exec(this.inputEl.value);
      if (!m) return { r: 0, g: 0, b: 0 };
      const n = parseInt(m[1], 16);
      return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
    }
    setValueHsl(): this {
      return this;
    }
    getValueHsl(): { h: number; s: number; l: number; a: number } {
      return { h: 0, s: 0, l: 0, a: 1 };
    }
    setDisabled(disabled: boolean): this {
      this.inputEl.disabled = disabled;
      return this;
    }
    onChange(cb: (value: string) => void | Promise<void>): this {
      this.cb = cb;
      return this;
    }
  }

  class MomentFormatComponent {
    inputEl: HTMLInputElement;
    private sampleEl: HTMLElement;
    private defaultFormat = "";
    private sampleEnabled = true;
    private cb: ((value: string) => void | Promise<void>) | null = null;
    constructor(parent: HTMLElement) {
      const wrap = document.createElement("div");
      wrap.className = "lattice-plugin-moment-format";
      wrap.style.cssText = "display:flex;flex-direction:column;gap:4px;";
      this.inputEl = document.createElement("input");
      this.inputEl.type = "text";
      this.inputEl.placeholder = "YYYY-MM-DD";
      this.sampleEl = document.createElement("div");
      this.sampleEl.style.cssText = "font-size:11px;opacity:0.7;font-family:var(--font-monospace,monospace);";
      wrap.append(this.inputEl, this.sampleEl);
      parent.appendChild(wrap);
      this.inputEl.addEventListener("input", () => {
        this.updateSample();
        void this.cb?.(this.inputEl.value);
      });
    }
    setDefaultFormat(format: string): this {
      this.defaultFormat = format;
      this.inputEl.placeholder = format;
      this.updateSample();
      return this;
    }
    setPlaceholder(placeholder: string): this {
      this.inputEl.placeholder = placeholder;
      return this;
    }
    setValue(value: string): this {
      this.inputEl.value = value;
      this.updateSample();
      return this;
    }
    getValue(): string {
      return this.inputEl.value;
    }
    setSampleEl(el: HTMLElement): this {
      this.sampleEl = el;
      this.updateSample();
      return this;
    }
    setDisabled(disabled: boolean): this {
      this.inputEl.disabled = disabled;
      return this;
    }
    setSampleEnabled(enabled: boolean): this {
      this.sampleEnabled = enabled;
      this.sampleEl.style.display = enabled ? "" : "none";
      return this;
    }
    onChange(cb: (value: string) => void | Promise<void>): this {
      this.cb = cb;
      return this;
    }
    private updateSample(): void {
      if (!this.sampleEnabled) return;
      try {
        const fmt = this.inputEl.value || this.defaultFormat;
        this.sampleEl.textContent = fmt ? moment().format(fmt) : "";
      } catch {
        this.sampleEl.textContent = "";
      }
    }
  }

  class SearchComponent {
    inputEl: HTMLInputElement;
    clearButtonEl: HTMLElement;
    containerEl: HTMLElement;
    private cb: ((value: string) => void | Promise<void>) | null = null;
    constructor(parent: HTMLElement) {
      this.containerEl = document.createElement("div");
      this.containerEl.className = "search-input-container";
      this.containerEl.style.cssText = "display:inline-flex;align-items:center;gap:4px;";
      this.inputEl = document.createElement("input");
      this.inputEl.type = "search";
      this.inputEl.placeholder = "Search";
      this.clearButtonEl = document.createElement("button");
      this.clearButtonEl.setAttribute("type", "button");
      this.clearButtonEl.textContent = "×";
      this.clearButtonEl.setAttribute("aria-label", "Clear search");
      this.clearButtonEl.style.cssText = "background:transparent;border:0;color:inherit;cursor:pointer;";
      this.containerEl.append(this.inputEl, this.clearButtonEl);
      parent.appendChild(this.containerEl);
      this.inputEl.addEventListener("input", () => void this.cb?.(this.inputEl.value));
      this.clearButtonEl.addEventListener("click", () => {
        this.inputEl.value = "";
        void this.cb?.("");
      });
    }
    setValue(value: string): this {
      this.inputEl.value = value;
      return this;
    }
    getValue(): string {
      return this.inputEl.value;
    }
    setPlaceholder(value: string): this {
      this.inputEl.placeholder = value;
      return this;
    }
    setDisabled(disabled: boolean): this {
      this.inputEl.disabled = disabled;
      return this;
    }
    onChange(cb: (value: string) => void | Promise<void>): this {
      this.cb = cb;
      return this;
    }
    onChanged(): this {
      void this.cb?.(this.inputEl.value);
      return this;
    }
  }

  class ProgressBarComponent {
    private el: HTMLElement;
    private fill: HTMLElement;
    constructor(parent: HTMLElement) {
      this.el = document.createElement("div");
      this.el.className = "lattice-plugin-progress";
      this.el.style.cssText = "width:140px;height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;";
      this.fill = document.createElement("div");
      this.fill.style.cssText = "height:100%;width:0%;background:var(--accent,#8b7cff);transition:width 0.2s;";
      this.el.appendChild(this.fill);
      parent.appendChild(this.el);
    }
    setValue(value: number): this {
      this.fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
      return this;
    }
    setDisabled(): this {
      return this;
    }
  }

  class Menu {
    private items: Array<{ title: string; icon?: string; onClick?: (event: MouseEvent) => void; separator?: boolean }> = [];
    addItem(cb: (item: MenuItemBuilder) => void): this {
      const item = new MenuItemBuilder();
      cb(item);
      this.items.push(item.toJSON());
      return this;
    }
    addSeparator(): this {
      this.items.push({ separator: true, title: "" });
      return this;
    }
    showAtMouseEvent(event: MouseEvent): this {
      return this.showAtPosition({ x: event.clientX, y: event.clientY });
    }
    showAtPosition(position: { x: number; y: number }): this {
      runtime.require("ui:modal", "Menu.show");
      const container = document.createElement("div");
      container.className = "lattice-plugin-menu";
      container.style.cssText = `position:fixed;z-index:9999;left:${position.x}px;top:${position.y}px;background:#101019;border:1px solid #2c2940;border-radius:8px;padding:4px;min-width:160px;box-shadow:0 18px 46px rgba(0,0,0,.45);`;
      for (const item of this.items) {
        if (item.separator) {
          const sep = document.createElement("div");
          sep.style.cssText = "height:1px;background:#2c2940;margin:4px 0;";
          container.appendChild(sep);
          continue;
        }
        const el = document.createElement("button");
        el.type = "button";
        el.textContent = item.title;
        el.style.cssText = "display:block;width:100%;text-align:left;padding:6px 8px;background:transparent;color:#e0d9ff;border:0;border-radius:6px;cursor:pointer;font-size:12px;";
        el.addEventListener("mouseenter", () => (el.style.background = "rgba(139,124,255,.18)"));
        el.addEventListener("mouseleave", () => (el.style.background = "transparent"));
        el.addEventListener("click", (event) => {
          item.onClick?.(event);
          this.hide();
        });
        container.appendChild(el);
      }
      const onAway = (event: MouseEvent) => {
        if (!container.contains(event.target as Node)) this.hide();
      };
      this.hide = () => {
        container.remove();
        document.removeEventListener("mousedown", onAway);
      };
      document.body.appendChild(container);
      setTimeout(() => document.addEventListener("mousedown", onAway), 0);
      return this;
    }
    hide: () => void = () => {};
  }

  class MenuItemBuilder {
    private title = "";
    private icon = "";
    private callback: ((event: MouseEvent) => void) | null = null;
    setTitle(title: string): this {
      this.title = title;
      return this;
    }
    setIcon(icon: string): this {
      this.icon = icon;
      return this;
    }
    onClick(cb: (event: MouseEvent) => void | Promise<void>): this {
      this.callback = (event) => void cb(event);
      return this;
    }
    toJSON() {
      return { title: this.title, icon: this.icon, onClick: this.callback ?? undefined };
    }
  }

  class ItemView extends Component {
    containerEl: HTMLElement;
    contentEl: HTMLElement;
    headerEl: HTMLElement;
    titleEl: HTMLElement;
    leaf: PluginLeafShim;
    app: unknown;
    icon = "puzzle";
    navigation = false;
    constructor(leaf: PluginLeafShim) {
      super();
      this.leaf = leaf ?? makePluginLeafShim("", null, runtime.plugin?.app);
      this.app = this.leaf?.app ?? runtime.plugin?.app;
      this.containerEl = document.createElement("div");
      this.containerEl.className = "lattice-plugin-view view";
      this.headerEl = document.createElement("div");
      this.headerEl.className = "view-header";
      this.titleEl = document.createElement("div");
      this.titleEl.className = "view-header-title";
      this.headerEl.appendChild(this.titleEl);
      this.contentEl = document.createElement("div");
      this.contentEl.className = "view-content";
      this.containerEl.append(this.headerEl, this.contentEl);
    }
    getViewType(): string {
      return "";
    }
    getDisplayText(): string {
      return "";
    }
    getIcon(): string {
      return this.icon;
    }
    getState(): unknown {
      return {};
    }
    async setState(_state: unknown, _result: { history?: boolean }): Promise<void> {}
    async onOpen(): Promise<void> {}
    async onClose(): Promise<void> {}
    onPaneMenu(): void {}
    onResize(): void {}
  }

  class Plugin extends Component {
    app = createApp(runtime);
    manifest = runtime.manifest;
    addCommand(command: { id: string; name?: string; title?: string; callback?: () => void | Promise<void>; checkCallback?: (checking: boolean) => boolean }): { id: string; name: string } {
      runtime.requireAny(["editor:commands", "commands:register"], "Plugin.addCommand");
      const id = `${runtime.pluginId}:${command.id}`;
      const name = command.name ?? command.title ?? command.id;
      const callback = command.callback ?? (command.checkCallback ? () => command.checkCallback?.(false) : undefined);
      if (callback) runtime.commandCallbacks.set(id, callback as () => void | Promise<void>);
      const dispose = registerPluginCommand({
        item: { id, group: "Plugins", label: name, kind: "plugin", icon: "puzzle" },
        run: async () => {
          await runtime.invokeCommand(id);
        },
      });
      runtime.track(() => {
        runtime.commandCallbacks.delete(id);
        dispose();
      });
      return { id, name };
    }
    addRibbonIcon(icon: string, title: string, callback: (event: MouseEvent) => void | Promise<void>): HTMLElement {
      runtime.require("ui:ribbon", "Plugin.addRibbonIcon");
      const id = runtime.nextId("ribbon");
      runtime.commandCallbacks.set(id, () => callback(new MouseEvent("click")));
      usePluginUIStore.getState().registerRibbonItem({ id, pluginId: runtime.pluginId, icon, title });
      const el = document.createElement("button");
      el.setAttribute("aria-label", title);
      el.dataset.latticeRibbonId = id;
      runtime.track(() => {
        runtime.commandCallbacks.delete(id);
        usePluginUIStore.getState().removeRibbonItem(id);
      });
      return el;
    }
    addStatusBarItem(): HTMLElement {
      runtime.require("ui:status-bar", "Plugin.addStatusBarItem");
      const id = runtime.nextId("status");
      const el = document.createElement("div");
      el.className = "status-bar-item";
      usePluginUIStore.getState().upsertStatusItem({
        id,
        pluginId: runtime.pluginId,
        text: el.textContent ?? "",
        containerEl: el,
      });
      runtime.track(() => {
        usePluginUIStore.getState().removeStatusItem(id);
      });
      return el;
    }
    addSettingTab(tab: PluginSettingTab): void {
      runtime.require("ui:settings-tab", "Plugin.addSettingTab");
      const id = runtime.nextId("setting");
      tab.containerEl.empty();
      try {
        tab.display();
      } catch (error) {
        console.warn(`[plugin:${runtime.pluginId}] setting tab display() failed`, error);
      }
      usePluginUIStore.getState().upsertSettingTab({
        id,
        pluginId: runtime.pluginId,
        name: tab.name || runtime.manifest.name,
        containerEl: tab.containerEl,
      });
      runtime.track(() => {
        try {
          tab.hide();
        } catch {}
        usePluginUIStore.getState().removeSettingTab(id);
      });
    }
    registerView(type: string, viewCreator: (leaf: PluginLeafShim) => ItemView): void {
      runtime.require("workspace:views", "Plugin.registerView");
      const pluginInstance = runtime.plugin;
      const disposeView = registerPluginView({
        pluginId: runtime.pluginId,
        type,
        displayName: type,
        create: (host) => {
          const path = `plugin-view://${type}`;
          const leafApp = (pluginInstance as { app?: unknown } | undefined)?.app ?? runtime.plugin?.app ?? null;
          const leafView: PluginLeafView = { getViewType: () => type, containerEl: host, app: leafApp };
          const leaf: PluginLeafShim = {
            view: leafView,
            containerEl: host,
            app: leafApp,
            getViewState: () => ({ type, state: getPluginViewState(path)?.state ?? null }),
            setViewState: async (next) => {
              setPluginViewState(path, type, next.state ?? null, next.active ?? true);
            },
            openFile: async () => {},
            detach: () => {
              const tab = useWorkspaceStore.getState().tabs.find((t) => t.path === path);
              if (tab) useWorkspaceStore.getState().closeTab(tab.id);
              clearPluginViewState(path);
            },
            getRoot: () => null,
            getDisplayText: () => type,
            getViewType: () => type,
            on: () => ({ off: () => {} }),
          };
          const renderError = (phase: string, error: unknown): void => {
            const message = error instanceof Error ? error.message : String(error);
            const stack = error instanceof Error && error.stack ? error.stack : "";
            console.error(`[plugin:${runtime.pluginId}] view "${type}" ${phase} failed`, error);
            const banner = document.createElement("div");
            banner.className = "lattice-plugin-view-error";
            banner.setAttribute("role", "alert");
            banner.style.cssText =
              "padding:16px 20px;margin:12px;border:1px solid var(--danger,#dc2626);border-radius:8px;background:rgba(220,38,38,0.08);color:var(--danger,#dc2626);font-family:var(--font-monospace,monospace);font-size:12px;white-space:pre-wrap;overflow:auto;max-height:60vh;";
            const title = document.createElement("div");
            title.style.cssText = "font-weight:600;margin-bottom:6px;";
            title.textContent = `Plugin view "${type}" ${phase} failed`;
            const msg = document.createElement("div");
            msg.textContent = message;
            banner.append(title, msg);
            if (stack) {
              const pre = document.createElement("pre");
              pre.style.cssText = "margin-top:8px;font-size:11px;opacity:0.8;white-space:pre-wrap;";
              pre.textContent = stack;
              banner.appendChild(pre);
            }
            host.appendChild(banner);
          };
          let view: ItemView | null = null;
          try {
            view = viewCreator(leaf);
          } catch (error) {
            renderError("create", error);
            return {};
          }
          if (!view) return {};
          leaf.view = view as unknown as PluginLeafView;
          if (!(view as { app?: unknown }).app) (view as { app: unknown }).app = leafApp;
          host.appendChild(view.containerEl);
          bindActiveLeafObject(path, leaf);
          let lifecyclePromise: Promise<void> | null = null;
          let opened = false;
          const runLifecycle = (): Promise<void> => {
            if (lifecyclePromise) return lifecyclePromise;
            lifecyclePromise = (async () => {
              try {
                await (view as unknown as { load?: () => Promise<void> }).load?.();
              } catch (error) {
                renderError("load", error);
                throw error;
              }
              try {
                await view!.onOpen();
                opened = true;
              } catch (error) {
                renderError("onOpen", error);
                throw error;
              }
            })().catch((error) => {
              lifecyclePromise = null;
              throw error;
            });
            return lifecyclePromise;
          };
          return {
            onOpen: () => runLifecycle(),
            onClose: async () => {
              try {
                if (opened) await view!.onClose?.();
              } catch (error) {
                console.warn(`[plugin:${runtime.pluginId}] view "${type}" onClose failed`, error);
              }
              try {
                await (view as unknown as { unload?: () => Promise<void> }).unload?.();
              } catch (error) {
                console.warn(`[plugin:${runtime.pluginId}] view "${type}" unload failed`, error);
              }
              opened = false;
              lifecyclePromise = null;
              unbindActiveLeafObject(path);
            },
            setState: (state, result) => view!.setState?.(state, result),
            getState: () => view!.getState?.(),
          };
        },
      });
      const commandId = `${runtime.pluginId}:view:${type}`;
      const disposeCommand = registerPluginCommand({
        item: { id: commandId, group: "Plugin views", label: `Open ${type}`, kind: "plugin", icon: "puzzle" },
        run: async () => openPluginViewOverlay(type),
      });
      runtime.track(() => {
        disposeCommand();
        disposeView();
      });
    }
    registerExtensions(extensions: string[], viewType: string): void {
      void extensions;
      void viewType;
    }
    registerEditorExtension(extension: Extension | Extension[]): void {
      runtime.require("editor:write", "Plugin.registerEditorExtension");
      const list = Array.isArray(extension) ? extension : [extension];
      for (const ext of list) {
        const dispose = registerEditorExtension(runtime.pluginId, ext);
        runtime.track(dispose);
      }
    }
    registerEditorSuggest(suggester: unknown): void {
      runtime.require("editor:write", "Plugin.registerEditorSuggest");
      runtime.track(registerEditorSuggest(runtime.pluginId, suggester));
    }
    registerHoverLinkSource(id: string, source: unknown): void {
      runtime.require("workspace:views", "Plugin.registerHoverLinkSource");
      runtime.track(registerHoverLinkSource(runtime.pluginId, id, source));
    }
    registerObsidianProtocolHandler(action: string, handler: (params: Record<string, string>) => void): void {
      runtime.require("workspace:layout", "Plugin.registerObsidianProtocolHandler");
      runtime.track(registerProtocolHandler(runtime.pluginId, action, handler));
    }
    registerMarkdownPostProcessor(processor: MarkdownPostProcessor, sortOrder?: number): void {
      runtime.require("workspace:views", "Plugin.registerMarkdownPostProcessor");
      runtime.track(registerMarkdownPostProcessor(runtime.pluginId, processor, sortOrder));
    }
    registerMarkdownCodeBlockProcessor(language: string, processor: MarkdownCodeBlockProcessor): void {
      runtime.require("workspace:views", "Plugin.registerMarkdownCodeBlockProcessor");
      runtime.track(registerMarkdownCodeBlockProcessor(runtime.pluginId, language, processor));
    }
    async loadData(): Promise<unknown> {
      runtime.require("storage:plugin-data", "Plugin.loadData");
      const data = await commands.readPluginData(runtime.pluginId);
      if (!data) return null;
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }
    async saveData(data: unknown): Promise<void> {
      runtime.require("storage:plugin-data", "Plugin.saveData");
      await commands.writePluginData(runtime.pluginId, JSON.stringify(data ?? null));
    }
  }

  const debounce = <T extends (...args: unknown[]) => unknown>(fn: T, timeout = 0): T & { cancel: () => void } => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const wrapped = ((...args: Parameters<T>) => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn(...args);
      }, timeout);
    }) as T & { cancel: () => void };
    wrapped.cancel = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    return wrapped;
  };

  class Events {
    private listeners = new Map<string, Set<(...args: unknown[]) => void>>();
    on(name: string, callback: (...args: unknown[]) => void): { id: string; off: () => void } {
      let set = this.listeners.get(name);
      if (!set) {
        set = new Set();
        this.listeners.set(name, set);
      }
      set.add(callback);
      const id = Math.random().toString(36).slice(2);
      return { id, off: () => set?.delete(callback) };
    }
    off(name: string, callback: (...args: unknown[]) => void): void {
      this.listeners.get(name)?.delete(callback);
    }
    offref(ref: { off?: () => void }): void {
      ref?.off?.();
    }
    trigger(name: string, ...args: unknown[]): void {
      for (const cb of this.listeners.get(name) ?? []) {
        try {
          cb(...args);
        } catch (error) {
          console.warn(`Events listener for "${name}" failed`, error);
        }
      }
    }
    tryTrigger(event: { name: string }, args: unknown[]): void {
      this.trigger(event.name, ...args);
    }
  }

  class MarkdownRenderChild extends Component {
    containerEl: HTMLElement;
    constructor(containerEl: HTMLElement) {
      super();
      this.containerEl = containerEl;
    }
  }

  type SuggestItem = unknown;

  class SuggestModal<T = SuggestItem> extends Modal {
    inputEl: HTMLInputElement;
    resultContainerEl: HTMLElement;
    limit = 50;
    emptyStateText = "No results found";
    private items: T[] = [];
    private activeIndex = 0;
    constructor(app: unknown) {
      super(app);
      this.modalEl.classList.add("modal", "prompt");
      this.containerEl.classList.add("prompt-container");
      this.titleEl.remove();
      this.inputEl = document.createElement("input");
      this.inputEl.type = "text";
      this.inputEl.className = "prompt-input";
      this.inputEl.style.cssText = "width:100%;padding:10px 12px;background:transparent;border:0;border-bottom:1px solid var(--background-modifier-border,#2c2940);color:inherit;outline:none;font-size:14px;";
      this.resultContainerEl = document.createElement("div");
      this.resultContainerEl.className = "prompt-results";
      this.resultContainerEl.style.cssText = "max-height:50vh;overflow-y:auto;";
      this.contentEl.replaceChildren(this.inputEl, this.resultContainerEl);
      this.inputEl.addEventListener("input", () => this.refresh());
      this.inputEl.addEventListener("keydown", (event) => this.handleKey(event));
    }
    setPlaceholder(placeholder: string): void {
      this.inputEl.placeholder = placeholder;
    }
    setInstructions(instructions: Array<{ command: string; purpose: string }>): void {
      const bar = document.createElement("div");
      bar.className = "prompt-instructions";
      bar.style.cssText = "display:flex;gap:12px;padding:6px 12px;font-size:11px;opacity:0.7;";
      for (const inst of instructions ?? []) {
        const item = document.createElement("span");
        item.textContent = `${inst.command} ${inst.purpose}`;
        bar.appendChild(item);
      }
      this.contentEl.appendChild(bar);
    }
    open(): void {
      super.open();
      this.refresh();
      setTimeout(() => this.inputEl.focus(), 0);
    }
    getSuggestions(_query: string): T[] | Promise<T[]> {
      return [];
    }
    renderSuggestion(value: T, el: HTMLElement): void {
      el.textContent = String(value);
    }
    onChooseSuggestion(_item: T, _evt: MouseEvent | KeyboardEvent): void {}
    private async refresh(): Promise<void> {
      const query = this.inputEl.value;
      let items: T[] = [];
      try {
        items = (await Promise.resolve(this.getSuggestions(query))) ?? [];
      } catch (error) {
        console.warn(`[plugin:${runtime.pluginId}] SuggestModal.getSuggestions threw`, error);
      }
      this.items = items.slice(0, this.limit);
      this.activeIndex = 0;
      this.renderResults();
    }
    private renderResults(): void {
      this.resultContainerEl.replaceChildren();
      if (this.items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "prompt-empty";
        empty.style.cssText = "padding:12px;opacity:0.65;text-align:center;font-size:12px;";
        empty.textContent = this.emptyStateText;
        this.resultContainerEl.appendChild(empty);
        return;
      }
      this.items.forEach((item, index) => {
        const row = document.createElement("div");
        row.className = "suggestion-item";
        row.style.cssText = "padding:8px 12px;cursor:pointer;";
        if (index === this.activeIndex) row.style.background = "var(--background-modifier-hover,rgba(139,124,255,0.18))";
        try {
          this.renderSuggestion(item, row);
        } catch (error) {
          row.textContent = String(item);
          console.warn(`[plugin:${runtime.pluginId}] renderSuggestion threw`, error);
        }
        row.addEventListener("mouseenter", () => {
          this.activeIndex = index;
          this.updateActiveRow();
        });
        row.addEventListener("click", (event) => this.choose(item, event));
        this.resultContainerEl.appendChild(row);
      });
    }
    private updateActiveRow(): void {
      const rows = Array.from(this.resultContainerEl.children) as HTMLElement[];
      rows.forEach((row, index) => {
        row.style.background = index === this.activeIndex ? "var(--background-modifier-hover,rgba(139,124,255,0.18))" : "";
      });
    }
    private handleKey(event: KeyboardEvent): void {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        this.activeIndex = Math.min(this.items.length - 1, this.activeIndex + 1);
        this.updateActiveRow();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        this.activeIndex = Math.max(0, this.activeIndex - 1);
        this.updateActiveRow();
      } else if (event.key === "Enter") {
        event.preventDefault();
        const item = this.items[this.activeIndex];
        if (item !== undefined) this.choose(item, event);
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.close();
      }
    }
    private choose(item: T, evt: MouseEvent | KeyboardEvent): void {
      try {
        this.onChooseSuggestion(item, evt);
      } catch (error) {
        console.warn(`[plugin:${runtime.pluginId}] onChooseSuggestion threw`, error);
      }
      this.close();
    }
  }

  function fuzzyScore(query: string, target: string): { score: number; matches: number[] } | null {
    if (!query) return { score: 0, matches: [] };
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    let qi = 0;
    let score = 0;
    let lastMatch = -2;
    const matches: number[] = [];
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) {
        matches.push(ti);
        score += ti === lastMatch + 1 ? 2 : 1;
        if (ti === 0 || /\s/.test(t[ti - 1])) score += 2;
        lastMatch = ti;
        qi++;
      }
    }
    if (qi < q.length) return null;
    return { score: score - (t.length - matches.length) * 0.01, matches };
  }

  class FuzzySuggestModal<T = SuggestItem> extends SuggestModal<{ item: T; match: { score: number; matches: number[] } }> {
    getItems(): T[] {
      return [];
    }
    getItemText(item: T): string {
      return String(item);
    }
    onChooseItem(_item: T, _evt: MouseEvent | KeyboardEvent): void {}
    getSuggestions(query: string): Array<{ item: T; match: { score: number; matches: number[] } }> {
      const items = this.getItems();
      const results: Array<{ item: T; match: { score: number; matches: number[] }; sortScore: number }> = [];
      for (const item of items) {
        const text = this.getItemText(item);
        const match = fuzzyScore(query, text);
        if (match) results.push({ item, match, sortScore: match.score });
      }
      results.sort((a, b) => b.sortScore - a.sortScore);
      return results.map(({ item, match }) => ({ item, match }));
    }
    renderSuggestion(value: { item: T; match: { score: number; matches: number[] } }, el: HTMLElement): void {
      const text = this.getItemText(value.item);
      const set = new Set(value.match.matches);
      el.replaceChildren();
      for (let i = 0; i < text.length; i++) {
        if (set.has(i)) {
          const span = document.createElement("span");
          span.className = "suggestion-highlight";
          span.style.cssText = "color:var(--text-accent,#a99bff);font-weight:600;";
          span.textContent = text[i];
          el.appendChild(span);
        } else {
          el.appendChild(document.createTextNode(text[i]));
        }
      }
    }
    onChooseSuggestion(value: { item: T; match: unknown }, evt: MouseEvent | KeyboardEvent): void {
      this.onChooseItem(value.item, evt);
    }
  }

  class EditorSuggest<T = SuggestItem> extends Component {
    app: unknown;
    context: { start: { line: number; ch: number }; end: { line: number; ch: number }; query: string; editor: unknown; file: unknown } | null = null;
    limit = 25;
    scope = { register: () => {}, unregister: () => {} };
    constructor(app: unknown) {
      super();
      this.app = app;
    }
    onTrigger(_cursor: { line: number; ch: number }, _editor: unknown, _file: unknown): { start: { line: number; ch: number }; end: { line: number; ch: number }; query: string } | null {
      return null;
    }
    getSuggestions(_context: unknown): T[] | Promise<T[]> {
      return [];
    }
    renderSuggestion(_value: T, _el: HTMLElement): void {}
    selectSuggestion(_value: T, _evt: MouseEvent | KeyboardEvent): void {}
    close(): void {
      this.context = null;
    }
    open(): void {}
    setInstructions(_instructions: unknown[]): void {}
  }

  const exports: Record<string, unknown> = {
    App: class App {},
    Component,
    Plugin,
    Notice,
    Modal,
    Menu,
    MenuItem: MenuItemBuilder,
    PluginSettingTab,
    Setting,
    TAbstractFile,
    TFile,
    TFolder,
    Vault: class Vault {},
    Workspace: class Workspace {},
    WorkspaceLeaf: class WorkspaceLeaf {},
    WorkspaceItem: class WorkspaceItem {},
    WorkspaceParent: class WorkspaceParent {},
    WorkspaceContainer: class WorkspaceContainer {},
    WorkspaceSplit: class WorkspaceSplit {},
    WorkspaceTabs: class WorkspaceTabs {},
    WorkspaceWindow: class WorkspaceWindow {},
    WorkspaceSidedock: class WorkspaceSidedock {},
    WorkspaceMobileDrawer: class WorkspaceMobileDrawer {},
    WorkspaceRoot: class WorkspaceRoot {},
    WorkspaceRibbon: class WorkspaceRibbon {},
    View: Component,
    ItemView,
    FileView: class FileView extends ItemView {
      file: TFile | null = null;
      allowNoFile = false;
      onLoadFile(_file: TFile): Promise<void> {
        return Promise.resolve();
      }
      onUnloadFile(_file: TFile): Promise<void> {
        return Promise.resolve();
      }
      async setFile(file: TFile | null): Promise<void> {
        if (this.file && this.file !== file) {
          try {
            await this.onUnloadFile(this.file);
          } catch (error) {
            console.warn(`[plugin:${runtime.pluginId}] FileView.onUnloadFile threw`, error);
          }
        }
        this.file = file;
        if (file) {
          try {
            await this.onLoadFile(file);
          } catch (error) {
            console.warn(`[plugin:${runtime.pluginId}] FileView.onLoadFile threw`, error);
          }
        }
      }
      getDisplayText(): string {
        return this.file?.basename ?? "";
      }
      canAcceptExtension(_ext: string): boolean {
        return true;
      }
    },
    TextFileView: class TextFileView extends ItemView {
      file: TFile | null = null;
      data = "";
      requestSave = debounce(() => {
        if (this.file) void this.save();
      }, 250);
      onLoadFile(_file: TFile): Promise<void> {
        return Promise.resolve();
      }
      onUnloadFile(_file: TFile): Promise<void> {
        return Promise.resolve();
      }
      getViewData(): string {
        return this.data;
      }
      setViewData(_data: string, _clear: boolean): void {}
      clear(): void {
        this.data = "";
      }
      async save(): Promise<void> {
        if (!this.file) return;
        try {
          await writeVault(runtime, this.file.path, this.getViewData());
        } catch (error) {
          console.warn(`[plugin:${runtime.pluginId}] TextFileView.save failed`, error);
        }
      }
      async setFile(file: TFile | null): Promise<void> {
        if (this.file && this.file !== file) await this.onUnloadFile(this.file).catch(() => undefined);
        this.file = file;
        if (file) {
          try {
            const content = await readVault(runtime, file.path);
            this.setViewData(content, true);
            await this.onLoadFile(file);
          } catch (error) {
            console.warn(`[plugin:${runtime.pluginId}] TextFileView load failed`, error);
          }
        } else {
          this.clear();
        }
      }
      getDisplayText(): string {
        return this.file?.basename ?? "";
      }
    },
    MarkdownView: class MarkdownView extends ItemView {
      file: TFile | null = null;
      editor: ReturnType<typeof makeObsidianEditorShim> | null = null;
      previewMode = {
        rerender: () => {},
        applyScroll: () => {},
        getScroll: () => 0,
      };
      sourceMode = {
        cmEditor: null as unknown,
        applyScroll: () => {},
        getScroll: () => 0,
      };
      currentMode = {
        type: "source" as "source" | "preview",
        get: () => "source",
      };
      getViewType(): string {
        return "markdown";
      }
      getMode(): "source" | "preview" {
        return this.currentMode.type;
      }
      getViewData(): string {
        const ed = getActiveEditor();
        return ed?.state.doc.toString() ?? "";
      }
      setViewData(_data: string, _clear: boolean): void {}
      clear(): void {}
      getDisplayText(): string {
        return this.file?.basename ?? "";
      }
    },
    MarkdownEditView: class MarkdownEditView {},
    MarkdownPreviewView: class MarkdownPreviewView extends Component {
      static render = async (markdown: string, el: HTMLElement, sourcePath: string) => {
        await renderMarkdownInto(markdown, el, { sourcePath, frontmatter: null });
      };
    },
    MarkdownRenderChild,
    EditorSuggest,
    AbstractInputSuggest: class AbstractInputSuggest {
      constructor(public app?: unknown, public inputEl?: HTMLElement) {}
      getSuggestions(): unknown[] {
        return [];
      }
      renderSuggestion() {}
      selectSuggestion() {}
      close() {}
      open() {}
      setValue() {}
      getValue() {
        return "";
      }
    },
    PopoverSuggest: class PopoverSuggest {
      constructor(public app?: unknown) {}
      open() {}
      close() {}
    },
    SuggestModal,
    FuzzySuggestModal,
    HoverPopover: class HoverPopover {},
    Events,
    Keymap: {
      pushScope: () => {},
      popScope: () => {},
      isModifier: () => false,
      isModEvent: () => false,
    },
    Scope: class Scope {
      register() {
        return {};
      }
      unregister() {}
    },
    MetadataCache: class MetadataCache {},
    FileSystemAdapter: class FileSystemAdapter {
      getName(): string {
        return "filesystem";
      }
      getBasePath(): string {
        return useVaultStore.getState().vault?.path ?? "";
      }
      getFullPath(path: string): string {
        const base = this.getBasePath();
        const clean = normalizePath(path);
        return base ? `${base}/${clean}`.replace(/\/+/g, "/") : clean;
      }
      getResourcePath(path: string): string {
        return `lattice://${normalizePath(path)}`;
      }
      async exists(path: string): Promise<boolean> {
        const normalized = normalizePath(path);
        const file = runtime.fileCache.get(normalized);
        if (file) return true;
        return runtime.files().some((f) => f.path === normalized);
      }
      async stat(path: string): Promise<{ ctime: number; mtime: number; size: number; type: "file" | "folder" } | null> {
        const exists = await this.exists(path);
        if (!exists) return null;
        const now = Date.now();
        return { ctime: now, mtime: now, size: 0, type: "file" };
      }
      async list(path: string): Promise<{ files: string[]; folders: string[] }> {
        runtime.require("vault:read", "FileSystemAdapter.list");
        const normalized = normalizePath(path);
        const prefix = normalized && !normalized.endsWith("/") ? `${normalized}/` : normalized;
        const files: string[] = [];
        const folders = new Set<string>();
        for (const file of runtime.files()) {
          if (!file.path.startsWith(prefix)) continue;
          const rest = file.path.slice(prefix.length);
          if (!rest) continue;
          const slash = rest.indexOf("/");
          if (slash === -1) files.push(file.path);
          else folders.add(`${prefix}${rest.slice(0, slash)}`);
        }
        return { files, folders: Array.from(folders) };
      }
      async read(path: string): Promise<string> {
        return readVault(runtime, path);
      }
      async readBinary(path: string): Promise<ArrayBuffer> {
        const text = await readVault(runtime, path);
        return new TextEncoder().encode(text).buffer;
      }
      async write(path: string, data: string): Promise<void> {
        await writeVault(runtime, path, data);
      }
      async writeBinary(path: string, data: ArrayBuffer): Promise<void> {
        const text = new TextDecoder().decode(new Uint8Array(data));
        await writeVault(runtime, path, text);
      }
      async append(path: string, data: string): Promise<void> {
        const current = await readVault(runtime, path).catch(() => "");
        await writeVault(runtime, path, current + data);
      }
      async mkdir(_path: string): Promise<void> {}
      async rmdir(_path: string, _recursive?: boolean): Promise<void> {}
      async remove(path: string): Promise<void> {
        await commands.deleteNote(normalizePath(path)).catch(() => undefined);
      }
      async trashSystem(path: string): Promise<boolean> {
        await this.remove(path);
        return true;
      }
      async trashLocal(path: string): Promise<void> {
        await this.remove(path);
      }
      async rename(oldPath: string, newPath: string): Promise<void> {
        await renameVault(runtime, normalizePath(oldPath), normalizePath(newPath));
      }
      async copy(oldPath: string, newPath: string): Promise<void> {
        const content = await readVault(runtime, oldPath);
        await writeVault(runtime, newPath, content);
      }
    },
    MarkdownRenderer: {
      render: async (_app: unknown, markdown: string, el: HTMLElement, sourcePath?: string) => {
        await renderMarkdownInto(markdown, el, { sourcePath: sourcePath ?? "", frontmatter: null });
      },
      renderMarkdown: async (markdown: string, el: HTMLElement, sourcePath?: string) => {
        await renderMarkdownInto(markdown, el, { sourcePath: sourcePath ?? "", frontmatter: null });
      },
      renderSingleLineMarkdown: async (markdown: string, el: HTMLElement, sourcePath?: string) => {
        await renderMarkdownInto(markdown, el, { sourcePath: sourcePath ?? "", frontmatter: null });
      },
    },
    ButtonComponent,
    ExtraButtonComponent,
    TextComponent,
    TextAreaComponent,
    ToggleComponent,
    DropdownComponent,
    SliderComponent,
    SearchComponent,
    ColorComponent,
    MomentFormatComponent,
    ProgressBarComponent,
    ValueComponent: class ValueComponent {
      registerOptionListener() {
        return this;
      }
      getValue() {
        return undefined as unknown;
      }
      setValue() {
        return this;
      }
      onChanged() {
        return this;
      }
      setDisabled() {
        return this;
      }
    },
    parseYaml: (input: string) => parseYamlShim(input),
    stringifyYaml: (data: Record<string, unknown>) =>
      Object.entries(data ?? {})
        .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
        .join("\n"),
    normalizePath,
    debounce,
    requestUrl: async (request: unknown) => {
      runtime.require("network:http", "requestUrl");
      const data = typeof request === "string" ? { url: request } : (request as Record<string, unknown>);
      const result = await commands.requestUrl({
        url: String(data.url),
        method: typeof data.method === "string" ? data.method : "GET",
        headers: (data.headers as Record<string, string>) ?? {},
        body: typeof data.body === "string" ? data.body : null,
        contentType: typeof data.contentType === "string" ? data.contentType : null,
      });
      return {
        status: result.status,
        text: result.text,
        json: result.json,
        arrayBuffer:
          result.arrayBuffer && Array.isArray(result.arrayBuffer)
            ? new Uint8Array(result.arrayBuffer).buffer
            : new ArrayBuffer(0),
        headers: result.headers,
      };
    },
    request: async (request: unknown) => {
      runtime.require("network:http", "request");
      const data = typeof request === "string" ? { url: request } : (request as Record<string, unknown>);
      const result = await commands.requestUrl({
        url: String(data.url),
        method: typeof data.method === "string" ? data.method : "GET",
        headers: (data.headers as Record<string, string>) ?? {},
        body: typeof data.body === "string" ? data.body : null,
        contentType: typeof data.contentType === "string" ? data.contentType : null,
      });
      return result.text;
    },
    Platform: {
      isDesktop: true,
      isMobile: false,
      isMobileApp: false,
      isDesktopApp: true,
      isPhone: false,
      isTablet: false,
      isMacOS: navigator.platform.toLowerCase().includes("mac"),
      isWin: navigator.platform.toLowerCase().includes("win"),
      isLinux: navigator.platform.toLowerCase().includes("linux"),
      isIosApp: false,
      isAndroidApp: false,
      isSafari: /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent),
      resourcePathPrefix: "",
    },
    moment,
    addIcon,
    setIcon,
    getIcon,
    getIconIds,
    removeIcon,
    setTooltip: (el: HTMLElement, tooltip: string) => {
      if (el && typeof tooltip === "string") el.setAttribute("aria-label", tooltip);
    },
    htmlToMarkdown,
    sanitizeHTMLToDom,
    requireApiVersion: (_version: string) => true,
    getAllTags: (cache: { tags?: Array<{ tag: string }>; frontmatter?: { tags?: string[] } } | null) => {
      const tags = new Set<string>();
      for (const t of cache?.tags ?? []) tags.add(t.tag);
      for (const t of cache?.frontmatter?.tags ?? []) tags.add(t.startsWith("#") ? t : `#${t}`);
      return Array.from(tags);
    },
    parseLinktext: (linktext: string) => {
      const [pathRaw, subRaw] = linktext.split("#", 2);
      return { path: pathRaw, subpath: subRaw ? `#${subRaw}` : "" };
    },
    resolveSubpath: () => null,
    getDefaultDate: () => new Date(),
    getLanguage: () => (typeof navigator !== "undefined" ? navigator.language : "en"),
    finishRenderMath: async () => {},
    livePreviewState: cmState.StateField.define({
      create: () => ({}),
      update: (value) => value,
    }),
    loadMathJax: async () => {},
    loadMermaid: async () => (await import("mermaid")).default,
    loadPdfJs: async () => ({}),
    loadPrism: async () => ({}),
    arrayBufferToBase64: (buffer: ArrayBuffer) => {
      let binary = "";
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    },
    base64ToArrayBuffer: (base64: string) => {
      const binary = atob(base64);
      const buffer = new ArrayBuffer(binary.length);
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return buffer;
    },
    arrayBufferToHex: (buffer: ArrayBuffer) =>
      Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    hexToArrayBuffer: (hex: string) => {
      const clean = hex.replace(/[^0-9a-f]/gi, "");
      const buffer = new ArrayBuffer(clean.length / 2);
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
      return buffer;
    },
    getBlobArrayBuffer: async (blob: Blob) => blob.arrayBuffer(),
    parseFrontMatterAliases: (frontmatter: Record<string, unknown> | null) => {
      const aliases = frontmatter?.aliases ?? frontmatter?.alias ?? null;
      if (Array.isArray(aliases)) return aliases.map(String);
      if (typeof aliases === "string") return [aliases];
      return null;
    },
    parseFrontMatterEntry: (frontmatter: Record<string, unknown> | null, key: string | RegExp) => {
      if (!frontmatter) return null;
      if (typeof key === "string") return frontmatter[key] ?? null;
      for (const [k, v] of Object.entries(frontmatter)) if (key.test(k)) return v;
      return null;
    },
    parseFrontMatterStringArray: (frontmatter: Record<string, unknown> | null, key: string) => {
      const value = frontmatter?.[key];
      if (Array.isArray(value)) return value.map(String);
      if (typeof value === "string") return [value];
      return null;
    },
    parseFrontMatterTags: (frontmatter: Record<string, unknown> | null) => {
      const tags = frontmatter?.tags ?? frontmatter?.tag ?? null;
      if (Array.isArray(tags)) return tags.map((t) => (String(t).startsWith("#") ? String(t) : `#${t}`));
      if (typeof tags === "string") return tags.split(/[\s,]+/).filter(Boolean).map((t) => (t.startsWith("#") ? t : `#${t}`));
      return null;
    },
    stripHeading: (heading: string) => heading.replace(/^#+\s*/, "").replace(/\[\[|\]\]/g, "").trim(),
    stripHeadingForLink: (heading: string) =>
      heading.replace(/^#+\s*/, "").replace(/[#|\[\]\\]/g, "").trim(),
    prepareFuzzySearch: (query: string) => {
      const needle = query.toLowerCase();
      return (text: string) => {
        const haystack = text.toLowerCase();
        if (!needle) return { score: 0, matches: [] };
        const idx = haystack.indexOf(needle);
        if (idx < 0) return null;
        return { score: -idx, matches: [[idx, idx + needle.length]] };
      };
    },
    prepareSimpleSearch: (query: string) => {
      const needle = query.toLowerCase();
      return (text: string) => {
        if (!needle) return { score: 0, matches: [] };
        const idx = text.toLowerCase().indexOf(needle);
        return idx < 0 ? null : { score: -idx, matches: [[idx, idx + needle.length]] };
      };
    },
    prepareQuery: (query: string) => ({ query }),
    sortSearchResults: (results: Array<{ score?: number }>) => {
      results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    },
    renderMatches: (el: HTMLElement, text: string) => {
      el.textContent = text;
    },
    renderResults: (el: HTMLElement, text: string) => {
      el.textContent = text;
    },
    iterateCacheRefs: () => {},
    iterateRefs: () => {},
    getFrontMatterInfo: (content: string) => {
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (!match) return { exists: false, frontmatter: "", from: 0, to: 0, contentStart: 0 };
      return {
        exists: true,
        frontmatter: match[1],
        from: 0,
        to: match[0].length,
        contentStart: match[0].length + 1,
      };
    },
  };

  return wrapWithFallback(exports, runtime.pluginId);
}

function requireShim(id: string, runtime: Runtime, obsidian: Record<string, unknown>): unknown {
  if (id === "obsidian") return obsidian;
  if (id === "@codemirror/view") return cmView;
  if (id === "@codemirror/state") return cmState;
  if (id === "@codemirror/language") return cmLanguage;
  if (id === "@codemirror/autocomplete") return cmAutocomplete;
  if (id === "@codemirror/commands") return cmCommands;
  if (id === "@codemirror/search") return cmSearch;
  if (id === "moment") return moment;
  if (id === "path") {
    runtime.require("system:node-api", "require('path')");
    return pathShim;
  }
  if (id === "fs") {
    runtime.require("system:filesystem", "require('fs')");
    return {
      promises: {
        readFile: async (path: string) => readVault(runtime, path),
        writeFile: async (path: string, data: string) => writeVault(runtime, path, data),
      },
    };
  }
  if (id === "electron" || id === "os" || id === "child_process") {
    runtime.require("system:node-api", `require('${id}')`);
    return {};
  }
  console.warn(`[plugin:${runtime.pluginId}] unsupported module: ${id}`);
  return {};
}

function openPluginViewOverlay(type: string): void {
  const factory = getPluginView(type);
  if (!factory) return;
  ensureObsidianDomShim();
  const path = `plugin-view://${type}`;
  try {
    useWorkspaceStore.getState().openTab(path, { activate: true });
    void useVaultStore.getState().setActivePath(path);
    return;
  } catch (error) {
    console.warn("Could not open plugin view as tab; falling back to overlay", error);
  }
  const overlay = document.createElement("div");
  overlay.className = "lattice-plugin-view-overlay";
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(5,5,8,.65);backdrop-filter:blur(4px);z-index:9000;display:grid;place-items:center;";
  const panel = document.createElement("div");
  panel.className = "lattice-plugin-view-panel";
  panel.style.cssText =
    "background:#0c0c14;border:1px solid #2c2940;border-radius:14px;min-width:640px;max-width:90vw;max-height:80vh;overflow:auto;box-shadow:0 28px 72px rgba(0,0,0,.55);position:relative;";
  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #1f1d33;";
  const title = document.createElement("div");
  title.textContent = factory.displayName || type;
  title.style.cssText = "font-size:13px;color:#e6e0ff;letter-spacing:.04em;";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "×";
  close.style.cssText = "background:transparent;color:#a298f5;border:0;font-size:20px;cursor:pointer;";
  header.append(title, close);
  const body = document.createElement("div");
  body.style.cssText = "padding:14px;min-height:240px;";
  panel.append(header, body);
  overlay.append(panel);
  document.body.appendChild(overlay);
  const instance = factory.create(body);
  const dismiss = async () => {
    try {
      await instance.onClose?.();
    } catch (error) {
      console.warn(error);
    }
    overlay.remove();
  };
  close.addEventListener("click", () => void dismiss());
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) void dismiss();
  });
}

const pathShim = {
  basename(path: string) {
    return normalizePath(path).split("/").pop() ?? "";
  },
  dirname(path: string) {
    const parts = normalizePath(path).split("/");
    parts.pop();
    return parts.join("/") || ".";
  },
  extname(path: string) {
    const name = pathShim.basename(path);
    const idx = name.lastIndexOf(".");
    return idx >= 0 ? name.slice(idx) : "";
  },
  join(...parts: string[]) {
    return normalizePath(parts.join("/"));
  },
  normalize: normalizePath,
  sep: "/",
};

const iconRegistry = new Map<string, string>();

function addIcon(iconId: string, svgContent: string): void {
  iconRegistry.set(iconId, svgContent);
}

function removeIcon(iconId: string): void {
  iconRegistry.delete(iconId);
}

function getIconIds(): string[] {
  const fromLucide = Object.keys(lucide).filter((key) => /^[A-Z]/.test(key)).map(pascalToKebab);
  return Array.from(new Set([...iconRegistry.keys(), ...fromLucide]));
}

function pascalToKebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/^-/, "").toLowerCase();
}

function kebabToPascal(name: string): string {
  return name.replace(/(^|-)([a-z0-9])/g, (_match, _dash, ch: string) => ch.toUpperCase());
}

interface LucideIconNode {
  // Lucide icons are exported as IconNode tuples or factories.
  // Both shapes are accepted by lucide.createElement.
  toString?: () => string;
}

function resolveLucideIcon(name: string): LucideIconNode | null {
  const lucideAny = lucide as unknown as Record<string, unknown>;
  const direct = lucideAny[name];
  if (direct && typeof direct !== "function") return direct as LucideIconNode;
  const pascal = kebabToPascal(name);
  const value = lucideAny[pascal] ?? lucideAny[`${pascal}Icon`] ?? null;
  return (value as LucideIconNode) ?? null;
}

export function setIcon(el: HTMLElement, iconId: string, size?: number): void {
  if (!el) return;
  el.replaceChildren();
  const custom = iconRegistry.get(iconId);
  if (custom) {
    const wrapper = document.createElement("span");
    wrapper.innerHTML = custom;
    const svg = wrapper.firstElementChild ?? wrapper;
    if (size && svg instanceof Element) {
      svg.setAttribute("width", String(size));
      svg.setAttribute("height", String(size));
    }
    el.appendChild(svg);
    return;
  }
  const node = resolveLucideIcon(iconId);
  if (!node) return;
  try {
    const created = (lucide as unknown as { createElement: (n: unknown) => SVGElement }).createElement(node);
    if (size) {
      created.setAttribute("width", String(size));
      created.setAttribute("height", String(size));
    }
    created.setAttribute("stroke", "currentColor");
    created.setAttribute("fill", "none");
    created.setAttribute("stroke-width", "1.75");
    el.appendChild(created);
  } catch (error) {
    console.warn(`setIcon: failed to render "${iconId}"`, error);
  }
}

export function getIcon(iconId: string): SVGElement | null {
  const host = document.createElement("span");
  setIcon(host, iconId);
  const child = host.firstElementChild;
  return child instanceof SVGElement ? child : null;
}

function htmlToMarkdown(html: string): string {
  if (typeof html !== "string") return "";
  const template = document.createElement("template");
  template.innerHTML = html;
  return walkHtmlToMarkdown(template.content).trim();
}

function walkHtmlToMarkdown(node: Node): string {
  let out = "";
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.textContent ?? "";
      continue;
    }
    if (!(child instanceof HTMLElement)) continue;
    const tag = child.tagName.toLowerCase();
    const inner = walkHtmlToMarkdown(child);
    switch (tag) {
      case "br":
        out += "\n";
        break;
      case "strong":
      case "b":
        out += `**${inner}**`;
        break;
      case "em":
      case "i":
        out += `*${inner}*`;
        break;
      case "code":
        out += `\`${inner}\``;
        break;
      case "pre":
        out += `\n\n\`\`\`\n${inner}\n\`\`\`\n\n`;
        break;
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        out += `\n\n${"#".repeat(Number(tag.slice(1)))} ${inner}\n\n`;
        break;
      case "p":
      case "div":
        out += `\n\n${inner}\n\n`;
        break;
      case "a": {
        const href = child.getAttribute("href") ?? "";
        out += href ? `[${inner}](${href})` : inner;
        break;
      }
      case "img": {
        const src = child.getAttribute("src") ?? "";
        const alt = child.getAttribute("alt") ?? "";
        out += src ? `![${alt}](${src})` : "";
        break;
      }
      case "li":
        out += `- ${inner}\n`;
        break;
      case "ul":
      case "ol":
        out += `\n${inner}\n`;
        break;
      case "blockquote":
        out += inner
          .split("\n")
          .map((line) => (line ? `> ${line}` : ">"))
          .join("\n");
        break;
      default:
        out += inner;
    }
  }
  return out;
}

function sanitizeHTMLToDom(html: string): DocumentFragment {
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const el of Array.from(template.content.querySelectorAll("script,style,iframe,object,embed,link,meta"))) {
    el.remove();
  }
  for (const el of Array.from(template.content.querySelectorAll<HTMLElement>("*"))) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith("on") || /^javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
    }
  }
  return template.content;
}

function parseYamlShim(input: string): Record<string, unknown> {
  if (typeof input !== "string") return {};
  const lines = input.split("\n");
  const out: Record<string, unknown> = {};
  let key: string | null = null;
  let list: unknown[] | null = null;
  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    if (!line.trim()) continue;
    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && key) {
      if (!list) {
        list = [];
        out[key] = list;
      }
      list.push(coerceYamlValue(listMatch[1].trim()));
      continue;
    }
    const m = line.match(/^([\w.-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    key = m[1];
    const value = m[2].trim();
    if (!value) {
      list = [];
      out[key] = list;
    } else {
      list = null;
      out[key] = coerceYamlValue(value);
    }
  }
  return out;
}

function coerceYamlValue(raw: string): unknown {
  const value = raw.replace(/^["']|["']$/g, "");
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "~") return null;
  const num = Number(value);
  if (Number.isFinite(num) && value.trim() !== "") return num;
  return value;
}

function wrapWithFallback(exportsObj: Record<string, unknown>, pluginId: string): Record<string, unknown> {
  const warned = new Set<string>();
  function makeFallback(name: string): unknown {
    const fn = function FallbackShim(this: unknown) {
      if (!warned.has(name)) {
        warned.add(name);
        console.warn(`[plugin:${pluginId}] obsidian.${name} is not implemented — returning shim.`);
      }
      return this instanceof (FallbackShim as unknown as { new (): unknown }) ? this : undefined;
    } as unknown as Record<string, unknown> & ((...args: unknown[]) => unknown);
    return new Proxy(fn, {
      get(target, prop) {
        if (prop === Symbol.toPrimitive) return () => `[Obsidian shim: ${name}]`;
        if (prop === "prototype" || prop === "name" || prop === "length") {
          return Reflect.get(target, prop);
        }
        if (prop === Symbol.iterator || prop === Symbol.asyncIterator) return undefined;
        if (prop === Symbol.toStringTag) return "Module";
        return makeFallback(`${name}.${String(prop)}`);
      },
      construct() {
        return {};
      },
    });
  }
  return new Proxy(exportsObj, {
    get(target, prop, receiver) {
      if (prop in target) return Reflect.get(target, prop, receiver);
      if (typeof prop !== "string") return undefined;
      return makeFallback(prop);
    },
    has() {
      return true;
    },
  });
}
