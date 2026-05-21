import type { FileNode, PermissionGrant, PluginManifest } from "@/types/domain";

export interface ObsidianRuntimeBundle {
  id: string;
  manifest: PluginManifest;
  mainSource: string;
  initialDataSource?: string | null;
  grantedPermissions: PermissionGrant[];
}

export interface ObsidianRuntimeContext {
  files?: FileNode[];
  activePath?: string | null;
}

export interface ObsidianCommandRegistration {
  id: string;
  name: string;
  pluginId: string;
}

export interface ObsidianHostEvent {
  type:
    | "command.registered"
    | "ribbon.registered"
    | "status-bar.registered"
    | "setting-tab.registered"
    | "notice"
    | "markdown-processor.registered"
    | "permission.denied"
    | "api.unsupported";
  pluginId: string;
  payload?: unknown;
}

export interface ObsidianHostBridge {
  hasPermission(permission: string): boolean;
  call<T>(action: string, payload?: unknown): Promise<T>;
  emit(event: ObsidianHostEvent): void;
}

export interface LoadedObsidianPlugin {
  pluginId: string;
  commands: ObsidianCommandRegistration[];
  unload(): Promise<void>;
  invokeCommand(id: string): Promise<void>;
}

interface FileStat {
  ctime: number;
  mtime: number;
  size: number;
}

type CommandCallback = () => void | Promise<void>;
type Disposable = (() => void) | { unload?: () => void; detach?: () => void };

export class ObsidianPermissionError extends Error {
  constructor(
    public readonly pluginId: string,
    public readonly permission: string,
    public readonly apiName: string,
  ) {
    super(`Permission denied for ${apiName}: ${permission}`);
    this.name = "ObsidianPermissionError";
  }
}

export async function loadObsidianPlugin(
  bundle: ObsidianRuntimeBundle,
  bridge: ObsidianHostBridge,
  context: ObsidianRuntimeContext = {},
): Promise<LoadedObsidianPlugin> {
  const runtime = new RuntimeState(bundle, bridge, context);
  const obsidian = createObsidianModule(runtime);
  const module = { exports: {} as unknown };
  const exports = module.exports;
  const require = (id: string) => requireShim(id, runtime, obsidian);

  try {
    const evaluator = new Function("module", "exports", "require", `"use strict";\n${bundle.mainSource}\n`);
    evaluator(module, exports, require);
  } catch (error) {
    runtime.unsupported("main.js could not be evaluated as a CommonJS Obsidian plugin.", { error: String(error) });
    throw error;
  }

  const pluginExport = resolvePluginExport(module.exports);
  const plugin =
    typeof pluginExport === "function"
      ? new (pluginExport as new (app: ObsidianApp, manifest: PluginManifest) => ObsidianPluginInstance)(runtime.app, bundle.manifest)
      : pluginExport;
  if (!plugin || typeof plugin !== "object") {
    throw new Error(`Obsidian plugin ${bundle.id} did not export a plugin class or instance.`);
  }
  if (!("app" in plugin)) {
    Object.assign(plugin, { app: runtime.app, manifest: bundle.manifest });
  }
  runtime.plugin = plugin as ObsidianPluginInstance;

  if (typeof runtime.plugin.onload === "function") {
    await runtime.plugin.onload.call(runtime.plugin);
  }

  return {
    pluginId: bundle.id,
    commands: runtime.commands,
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

class RuntimeState {
  readonly pluginId: string;
  readonly manifest: PluginManifest;
  readonly app: ObsidianApp;
  readonly commands: ObsidianCommandRegistration[] = [];
  readonly commandCallbacks = new Map<string, CommandCallback>();
  readonly disposables: Array<() => void> = [];
  readonly workspaceEmitter = new EventEmitter();
  readonly fileCache = new Map<string, TAbstractFile>();
  readonly readCache = new Map<string, string>();
  plugin?: ObsidianPluginInstance;
  activePath: string | null;

  constructor(
    private readonly bundle: ObsidianRuntimeBundle,
    private readonly bridge: ObsidianHostBridge,
    context: ObsidianRuntimeContext,
  ) {
    this.pluginId = bundle.id;
    this.manifest = bundle.manifest;
    this.activePath = context.activePath ?? null;
    this.seedFiles(context.files ?? []);
    this.app = {
      vault: createVaultApi(this),
      workspace: createWorkspaceApi(this),
      metadataCache: createMetadataCacheApi(this),
    };
  }

  hasPermission(permission: string): boolean {
    return this.bridge.hasPermission(permission);
  }

  requirePermission(permission: string, apiName: string): void {
    if (this.hasPermission(permission)) return;
    this.bridge.emit({
      type: "permission.denied",
      pluginId: this.pluginId,
      payload: { permission, apiName },
    });
    throw new ObsidianPermissionError(this.pluginId, permission, apiName);
  }

  requireAnyPermission(permissions: string[], apiName: string): void {
    if (permissions.some((permission) => this.hasPermission(permission))) return;
    this.requirePermission(permissions[0], apiName);
  }

  call<T>(action: string, payload?: unknown): Promise<T> {
    return this.bridge.call<T>(action, payload);
  }

  emit(type: ObsidianHostEvent["type"], payload?: unknown): void {
    this.bridge.emit({ type, pluginId: this.pluginId, payload });
  }

  unsupported(apiName: string, payload?: unknown): void {
    this.emit("api.unsupported", { apiName, ...asObject(payload) });
  }

  register(disposable: Disposable): void {
    this.disposables.push(() => dispose(disposable));
  }

  registerCommand(command: { id: string; name?: string; title?: string; callback?: CommandCallback }): void {
    this.requireAnyPermission(["editor:commands", "commands:register"], "Plugin.addCommand");
    const id = `${this.pluginId}:${command.id}`;
    const registration = {
      id,
      name: command.name ?? command.title ?? command.id,
      pluginId: this.pluginId,
    };
    this.commands.push(registration);
    if (command.callback) this.commandCallbacks.set(id, command.callback);
    this.emit("command.registered", registration);
    this.register(() => this.commandCallbacks.delete(id));
  }

  async invokeCommand(id: string): Promise<void> {
    activeRuntime = this;
    const callback = this.commandCallbacks.get(id) ?? this.commandCallbacks.get(`${this.pluginId}:${id}`);
    if (!callback) throw new Error(`Obsidian command is not registered: ${id}`);
    await callback.call(this.plugin);
  }

  async unload(): Promise<void> {
    if (this.plugin && typeof this.plugin.onunload === "function") {
      await this.plugin.onunload.call(this.plugin);
    }
    for (const cleanup of [...this.disposables].reverse()) {
      cleanup();
    }
    this.disposables.length = 0;
    this.commandCallbacks.clear();
    this.workspaceEmitter.clear();
  }

  seedFiles(files: FileNode[]): void {
    this.fileCache.clear();
    const visit = (node: FileNode, parent: TFolder | null) => {
      const file = node.kind === "folder" ? new TFolder(node.path, node.name, parent) : new TFile(node.path, node.name, parent, fileStat(node));
      this.fileCache.set(node.path, file);
      if (parent) parent.children.push(file);
      for (const child of node.children ?? []) visit(child, file instanceof TFolder ? file : parent);
    };
    for (const file of files) visit(file, null);
  }

  files(): TFile[] {
    return Array.from(this.fileCache.values()).filter((file): file is TFile => file instanceof TFile);
  }

  folders(): TFolder[] {
    return Array.from(this.fileCache.values()).filter((file): file is TFolder => file instanceof TFolder);
  }

  cacheFile(path: string, content?: string): TFile {
    const normalized = normalizePath(path);
    const name = normalized.split("/").pop() ?? normalized;
    const file = new TFile(normalized, name, null, { ctime: Date.now(), mtime: Date.now(), size: content?.length ?? 0 });
    this.fileCache.set(normalized, file);
    if (typeof content === "string") this.readCache.set(normalized, content);
    return file;
  }

  removeCachedFile(path: string): void {
    this.fileCache.delete(normalizePath(path));
    this.readCache.delete(normalizePath(path));
  }
}

class EventEmitter {
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  on(name: string, callback: (...args: unknown[]) => void): () => void {
    const listeners = this.listeners.get(name) ?? new Set();
    listeners.add(callback);
    this.listeners.set(name, listeners);
    return () => this.off(name, callback);
  }

  off(name: string, callback: (...args: unknown[]) => void): void {
    this.listeners.get(name)?.delete(callback);
  }

  trigger(name: string, ...args: unknown[]): void {
    for (const callback of this.listeners.get(name) ?? []) callback(...args);
  }

  clear(): void {
    this.listeners.clear();
  }
}

export class TAbstractFile {
  vault: unknown = null;

  constructor(
    public path: string,
    public name: string,
    public parent: TFolder | null,
  ) {}
}

export class TFile extends TAbstractFile {
  extension: string;
  basename: string;

  constructor(path: string, name: string, parent: TFolder | null, public stat: FileStat) {
    super(path, name, parent);
    const dot = name.lastIndexOf(".");
    this.extension = dot >= 0 ? name.slice(dot + 1) : "";
    this.basename = dot >= 0 ? name.slice(0, dot) : name;
  }
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];

  isRoot(): boolean {
    return !this.parent;
  }
}

class Notice {
  constructor(message: string | DocumentFragment, timeout?: number) {
    currentRuntime()?.requirePermission("ui:modal", "Notice");
    currentRuntime()?.emit("notice", { message: String(message), timeout });
  }

  hide(): void {}
}

class Modal {
  titleEl = new ShimElement("h2");
  contentEl = new ShimElement("div");
  modalEl = new ShimElement("div");

  constructor(public app: ObsidianApp) {}

  open(): void {
    currentRuntime()?.requirePermission("ui:modal", "Modal.open");
    currentRuntime()?.emit("notice", { message: "Plugin modal opened" });
    this.onOpen();
  }

  close(): void {
    this.onClose();
  }

  onOpen(): void {}

  onClose(): void {}
}

class PluginSettingTab {
  containerEl = new ShimElement("div");

  constructor(public app: ObsidianApp, public plugin: ObsidianPluginInstance) {}

  display(): void {}

  hide(): void {}
}

class Setting {
  controlEl = new ShimElement("div");
  settingEl = new ShimElement("div");
  infoEl = new ShimElement("div");

  constructor(public containerEl: ShimElement) {}

  setName(value: string): this {
    this.infoEl.setText(value);
    return this;
  }

  setDesc(value: string): this {
    this.settingEl.setAttribute("data-desc", value);
    return this;
  }

  addText(callback: (component: SettingTextComponent) => void): this {
    callback(new SettingTextComponent());
    return this;
  }

  addToggle(callback: (component: SettingToggleComponent) => void): this {
    callback(new SettingToggleComponent());
    return this;
  }

  addButton(callback: (component: SettingButtonComponent) => void): this {
    callback(new SettingButtonComponent());
    return this;
  }
}

class SettingTextComponent {
  private value = "";
  setPlaceholder(_value: string): this {
    return this;
  }
  setValue(value: string): this {
    this.value = value;
    return this;
  }
  getValue(): string {
    return this.value;
  }
  onChange(_callback: (value: string) => void | Promise<void>): this {
    return this;
  }
}

class SettingToggleComponent {
  private value = false;
  setValue(value: boolean): this {
    this.value = value;
    return this;
  }
  getValue(): boolean {
    return this.value;
  }
  onChange(_callback: (value: boolean) => void | Promise<void>): this {
    return this;
  }
}

class SettingButtonComponent {
  setButtonText(_value: string): this {
    return this;
  }
  setCta(): this {
    return this;
  }
  onClick(_callback: () => void | Promise<void>): this {
    return this;
  }
}

class ShimElement {
  textContent = "";
  children: ShimElement[] = [];
  private classes = new Set<string>();
  private attributes = new Map<string, string>();

  constructor(public tagName: string) {}

  setText(value: string): this {
    this.textContent = value;
    return this;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addClass(name: string): this {
    this.classes.add(name);
    return this;
  }

  removeClass(name: string): this {
    this.classes.delete(name);
    return this;
  }

  empty(): void {
    this.children = [];
    this.textContent = "";
  }

  createEl(tagName: string, options?: { text?: string; cls?: string }): ShimElement {
    const child = new ShimElement(tagName);
    if (options?.text) child.setText(options.text);
    if (options?.cls) child.addClass(options.cls);
    this.children.push(child);
    return child;
  }

  appendChild(child: ShimElement): ShimElement {
    this.children.push(child);
    return child;
  }

  remove(): void {}
}

interface ObsidianApp {
  vault: ReturnType<typeof createVaultApi>;
  workspace: ReturnType<typeof createWorkspaceApi>;
  metadataCache: ReturnType<typeof createMetadataCacheApi>;
}

interface ObsidianPluginInstance {
  app: ObsidianApp;
  manifest: PluginManifest;
  onload?: () => void | Promise<void>;
  onunload?: () => void | Promise<void>;
  [key: string]: unknown;
}

let activeRuntime: RuntimeState | null = null;

function currentRuntime(): RuntimeState | null {
  return activeRuntime;
}

function createObsidianModule(runtime: RuntimeState): Record<string, unknown> {
  activeRuntime = runtime;

  class Plugin {
    app = runtime.app;
    manifest = runtime.manifest;

    addCommand(command: { id: string; name?: string; title?: string; callback?: CommandCallback }): void {
      runtime.registerCommand(command);
    }

    addRibbonIcon(icon: string, title: string, callback: () => void | Promise<void>): ShimElement {
      runtime.requirePermission("ui:ribbon", "Plugin.addRibbonIcon");
      runtime.emit("ribbon.registered", { icon, title });
      const element = new ShimElement("button");
      element.setAttribute("aria-label", title);
      element.setAttribute("data-callback", String(runtime.commands.length));
      runtime.register(() => element.remove());
      void callback;
      return element;
    }

    addStatusBarItem(): ShimElement {
      runtime.requirePermission("ui:status-bar", "Plugin.addStatusBarItem");
      const element = new ShimElement("span");
      runtime.emit("status-bar.registered", { id: `${runtime.pluginId}:status-bar` });
      runtime.register(() => element.remove());
      return element;
    }

    addSettingTab(tab: PluginSettingTab): void {
      runtime.requirePermission("ui:settings-tab", "Plugin.addSettingTab");
      runtime.emit("setting-tab.registered", { name: tab.constructor.name });
      runtime.register(() => tab.hide());
    }

    register(disposable: Disposable): void {
      runtime.register(disposable);
    }

    registerEvent(disposable: Disposable): void {
      runtime.register(disposable);
    }

    registerInterval(intervalId: number): void {
      runtime.register(() => clearInterval(intervalId));
    }

    registerMarkdownPostProcessor(processor: unknown): void {
      runtime.requirePermission("workspace:views", "Plugin.registerMarkdownPostProcessor");
      runtime.emit("markdown-processor.registered", { kind: "postProcessor" });
      runtime.register(() => void processor);
    }

    registerMarkdownCodeBlockProcessor(language: string, processor: unknown): void {
      runtime.requirePermission("workspace:views", "Plugin.registerMarkdownCodeBlockProcessor");
      runtime.emit("markdown-processor.registered", { kind: "codeBlock", language });
      runtime.register(() => void processor);
    }

    async loadData(): Promise<unknown> {
      runtime.requirePermission("storage:plugin-data", "Plugin.loadData");
      const data = await runtime.call<string | null>("storage.loadData", { pluginId: runtime.pluginId });
      if (!data) return null;
      return JSON.parse(data);
    }

    async saveData(data: unknown): Promise<void> {
      runtime.requirePermission("storage:plugin-data", "Plugin.saveData");
      await runtime.call("storage.saveData", {
        pluginId: runtime.pluginId,
        data: JSON.stringify(data, null, 2),
      });
    }
  }

  return {
    App: class App {},
    Plugin,
    Notice,
    Modal,
    PluginSettingTab,
    Setting,
    TAbstractFile,
    TFile,
    TFolder,
    MarkdownView: class MarkdownView {},
    normalizePath,
    requestUrl: async (request: unknown) => {
      runtime.requirePermission("network:http", "requestUrl");
      return runtime.call("network.requestUrl", request);
    },
  };
}

function createVaultApi(runtime: RuntimeState) {
  return {
    adapter: {
      getName: () => "LATTICE Vault",
      read: (path: string) => readVaultPath(runtime, path),
      write: (path: string, data: string) => writeVaultPath(runtime, path, data),
      exists: async (path: string) => {
        runtime.requirePermission("vault:read", "Vault.adapter.exists");
        return runtime.files().some((file) => file.path === normalizePath(path));
      },
      mkdir: async (_path: string) => {
        runtime.requirePermission("vault:write", "Vault.adapter.mkdir");
        runtime.unsupported("Vault.adapter.mkdir", { reason: "folder creation is not exposed to the worker yet" });
      },
      remove: (path: string) => deleteVaultPath(runtime, path),
      rename: (oldPath: string, newPath: string) => renameVaultPath(runtime, oldPath, newPath),
      list: async (_path: string) => {
        runtime.requirePermission("vault:read", "Vault.adapter.list");
        return { files: runtime.files().map((file) => file.path), folders: runtime.folders().map((folder) => folder.path) };
      },
    },
    configDir: ".obsidian",
    getFiles: () => {
      runtime.requirePermission("vault:read", "Vault.getFiles");
      return runtime.files();
    },
    getMarkdownFiles: () => {
      runtime.requirePermission("vault:read", "Vault.getMarkdownFiles");
      return runtime.files().filter((file) => file.extension.toLowerCase() === "md");
    },
    read: (file: TFile | string) => readVaultPath(runtime, filePath(file)),
    cachedRead: async (file: TFile | string) => {
      const path = filePath(file);
      if (runtime.readCache.has(path)) return runtime.readCache.get(path) ?? "";
      return readVaultPath(runtime, path);
    },
    modify: (file: TFile | string, data: string) => writeVaultPath(runtime, filePath(file), data),
    create: async (path: string, data: string) => {
      runtime.requirePermission("vault:write", "Vault.create");
      const normalized = normalizePath(path);
      await runtime.call("vault.create", { path: normalized, content: data });
      return runtime.cacheFile(normalized, data);
    },
    delete: (file: TFile | string) => deleteVaultPath(runtime, filePath(file)),
    rename: (file: TFile | string, newPath: string) => renameVaultPath(runtime, filePath(file), newPath),
  };
}

function createWorkspaceApi(runtime: RuntimeState) {
  const activeLeaf = {
    view: {
      file: runtime.activePath ? runtime.fileCache.get(runtime.activePath) ?? runtime.cacheFile(runtime.activePath) : null,
    },
    openFile: async (file: TFile) => {
      runtime.requirePermission("workspace:layout", "WorkspaceLeaf.openFile");
      runtime.activePath = file.path;
      activeLeaf.view.file = file;
      runtime.workspaceEmitter.trigger("active-leaf-change", activeLeaf);
    },
    getViewState: () => ({ type: "markdown", state: { file: runtime.activePath } }),
    setViewState: async (state: unknown) => {
      runtime.requirePermission("workspace:layout", "WorkspaceLeaf.setViewState");
      runtime.unsupported("WorkspaceLeaf.setViewState", { state });
    },
  };

  return {
    activeLeaf,
    getActiveFile: () => {
      runtime.requirePermission("workspace:read", "Workspace.getActiveFile");
      return runtime.activePath ? runtime.fileCache.get(runtime.activePath) ?? runtime.cacheFile(runtime.activePath) : null;
    },
    getActiveViewOfType: (_viewType: unknown) => {
      runtime.requirePermission("workspace:read", "Workspace.getActiveViewOfType");
      return activeLeaf.view;
    },
    getLeaf: () => {
      runtime.requirePermission("workspace:layout", "Workspace.getLeaf");
      return activeLeaf;
    },
    on: (name: string, callback: (...args: unknown[]) => void) => runtime.workspaceEmitter.on(name, callback),
    off: (name: string, callback: (...args: unknown[]) => void) => runtime.workspaceEmitter.off(name, callback),
    trigger: (name: string, ...args: unknown[]) => runtime.workspaceEmitter.trigger(name, ...args),
  };
}

function createMetadataCacheApi(runtime: RuntimeState) {
  return {
    getFileCache: async (file: TFile | string) => {
      runtime.requirePermission("vault:read", "MetadataCache.getFileCache");
      return runtime.call("metadata.getFileCache", { path: filePath(file) });
    },
    getFirstLinkpathDest: (linkpath: string, _sourcePath: string) => {
      runtime.requirePermission("vault:read", "MetadataCache.getFirstLinkpathDest");
      const normalized = normalizePath(linkpath.endsWith(".md") ? linkpath : `${linkpath}.md`);
      return runtime.fileCache.get(normalized) ?? null;
    },
    on: (name: string, callback: (...args: unknown[]) => void) => runtime.workspaceEmitter.on(`metadata:${name}`, callback),
    off: (name: string, callback: (...args: unknown[]) => void) => runtime.workspaceEmitter.off(`metadata:${name}`, callback),
    trigger: (name: string, ...args: unknown[]) => runtime.workspaceEmitter.trigger(`metadata:${name}`, ...args),
  };
}

async function readVaultPath(runtime: RuntimeState, path: string): Promise<string> {
  runtime.requirePermission("vault:read", "Vault.read");
  const normalized = normalizePath(path);
  const content = await runtime.call<string>("vault.read", { path: normalized });
  runtime.readCache.set(normalized, content);
  runtime.cacheFile(normalized, content);
  return content;
}

async function writeVaultPath(runtime: RuntimeState, path: string, content: string): Promise<void> {
  runtime.requirePermission("vault:write", "Vault.modify");
  const normalized = normalizePath(path);
  await runtime.call("vault.modify", { path: normalized, content });
  runtime.readCache.set(normalized, content);
  runtime.cacheFile(normalized, content);
}

async function deleteVaultPath(runtime: RuntimeState, path: string): Promise<void> {
  runtime.requirePermission("vault:write", "Vault.delete");
  const normalized = normalizePath(path);
  await runtime.call("vault.delete", { path: normalized });
  runtime.removeCachedFile(normalized);
}

async function renameVaultPath(runtime: RuntimeState, oldPath: string, newPath: string): Promise<void> {
  runtime.requirePermission("vault:write", "Vault.rename");
  const oldNormalized = normalizePath(oldPath);
  const newNormalized = normalizePath(newPath);
  await runtime.call("vault.rename", { oldPath: oldNormalized, newPath: newNormalized });
  const cached = runtime.readCache.get(oldNormalized);
  runtime.removeCachedFile(oldNormalized);
  runtime.cacheFile(newNormalized, cached);
}

function requireShim(id: string, runtime: RuntimeState, obsidian: Record<string, unknown>): unknown {
  if (id === "obsidian") return obsidian;
  if (id === "path") {
    runtime.requirePermission("system:node-api", "require('path')");
    return pathShim;
  }
  if (id === "fs") {
    runtime.requirePermission("system:filesystem", "require('fs')");
    return {
      promises: {
        readFile: (path: string) => readVaultPath(runtime, path),
        writeFile: (path: string, data: string) => writeVaultPath(runtime, path, data),
      },
    };
  }
  if (id === "electron") {
    runtime.requirePermission("system:node-api", "require('electron')");
    runtime.unsupported("electron", { reason: "Electron internals are not available inside the worker sandbox." });
    return {};
  }
  runtime.unsupported(`require('${id}')`, { reason: "Only obsidian and gated desktop adapters are exposed." });
  throw new Error(`Unsupported module in Obsidian plugin sandbox: ${id}`);
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
    const index = name.lastIndexOf(".");
    return index >= 0 ? name.slice(index) : "";
  },
  join(...parts: string[]) {
    return normalizePath(parts.join("/"));
  },
  normalize: normalizePath,
};

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\//, "");
}

function filePath(file: TFile | string): string {
  return typeof file === "string" ? normalizePath(file) : file.path;
}

function fileStat(node: FileNode): FileStat {
  const modified = node.modifiedAt ? Date.parse(node.modifiedAt) : Date.now();
  return {
    ctime: modified,
    mtime: modified,
    size: node.size ?? 0,
  };
}

function dispose(disposable: Disposable): void {
  if (typeof disposable === "function") {
    disposable();
    return;
  }
  if (typeof disposable.unload === "function") {
    disposable.unload();
    return;
  }
  disposable.detach?.();
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
