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

export interface SerializedObsidianElement {
  tagName: string;
  textContent: string;
  classes: string[];
  attributes: Record<string, string>;
  children: SerializedObsidianElement[];
}

export interface ObsidianHostEvent {
  type:
    | "command.registered"
    | "ribbon.registered"
    | "ribbon.removed"
    | "status-bar.registered"
    | "status-bar.updated"
    | "status-bar.removed"
    | "setting-tab.registered"
    | "setting-tab.updated"
    | "setting-tab.removed"
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
type Disposable = (() => void) | { unload?: () => void; detach?: () => void; off?: () => void };

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
  private nextRibbonId = 1;
  private nextStatusBarId = 1;
  private nextSettingTabId = 1;
  private nextElementActionId = 1;

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

  registerRibbonAction(icon: string, title: string, callback: CommandCallback): string {
    const id = `${this.pluginId}:ribbon:${this.nextRibbonId++}`;
    this.commandCallbacks.set(id, callback);
    this.emit("ribbon.registered", { id, icon, title });
    this.register(() => {
      this.commandCallbacks.delete(id);
      this.emit("ribbon.removed", { id });
    });
    return id;
  }

  registerElementAction(callback: CommandCallback): string {
    const id = `${this.pluginId}:action:${this.nextElementActionId++}`;
    this.commandCallbacks.set(id, callback);
    this.register(() => this.commandCallbacks.delete(id));
    return id;
  }

  registerStatusBarElement(): ShimElement {
    const id = `${this.pluginId}:status:${this.nextStatusBarId++}`;
    const element = new ShimElement("span");
    element.setChangeHandler((updated) => {
      this.emit("status-bar.updated", {
        id,
        text: updated.textContent,
        element: updated.toJSON(),
      });
    });
    this.emit("status-bar.registered", { id, element: element.toJSON() });
    this.register(() => {
      element.remove();
      this.emit("status-bar.removed", { id });
    });
    return element;
  }

  registerSettingTab(tab: PluginSettingTab): void {
    const id = `${this.pluginId}:settings:${this.nextSettingTabId++}`;
    const name = tab.name || tab.constructor.name || this.manifest.name;
    tab.containerEl.setChangeHandler((element) => {
      this.emit("setting-tab.updated", {
        id,
        name,
        element: element.toJSON(),
      });
    });
    tab.display();
    this.emit("setting-tab.registered", {
      id,
      name,
      element: tab.containerEl.toJSON(),
    });
    this.register(() => {
      tab.hide();
      this.emit("setting-tab.removed", { id });
    });
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

class Component {
  private readonly children: Component[] = [];
  private readonly cleanups: Disposable[] = [];
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    await this.onload();
    for (const child of this.children) await child.load();
  }

  async unload(): Promise<void> {
    for (const child of [...this.children].reverse()) await child.unload();
    for (const cleanup of [...this.cleanups].reverse()) dispose(cleanup);
    this.cleanups.length = 0;
    this.children.length = 0;
    if (this.loaded) await this.onunload();
    this.loaded = false;
  }

  async onload(): Promise<void> {}

  async onunload(): Promise<void> {}

  addChild<T extends Component>(component: T): T {
    this.children.push(component);
    if (this.loaded) void component.load();
    return component;
  }

  removeChild<T extends Component>(component: T): T {
    const index = this.children.indexOf(component);
    if (index >= 0) this.children.splice(index, 1);
    void component.unload();
    return component;
  }

  register(disposable: Disposable): void {
    this.cleanups.push(disposable);
    currentRuntime()?.register(disposable);
  }

  registerEvent(disposable: Disposable): void {
    this.register(disposable);
  }

  registerDomEvent(
    element: { addEventListener?: (...args: unknown[]) => void; removeEventListener?: (...args: unknown[]) => void },
    type: string,
    callback: EventListener,
    options?: AddEventListenerOptions,
  ): void {
    element.addEventListener?.(type, callback, options);
    this.register(() => element.removeEventListener?.(type, callback, options));
  }

  registerInterval(intervalId: number): void {
    this.register(() => clearInterval(intervalId));
  }
}

class Modal extends Component {
  titleEl = new ShimElement("h2");
  contentEl = new ShimElement("div");
  modalEl = new ShimElement("div");

  constructor(public app: ObsidianApp) {
    super();
  }

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

class PluginSettingTab extends Component {
  containerEl = new ShimElement("div");
  name = "";

  constructor(public app: ObsidianApp, public plugin: ObsidianPluginInstance) {
    super();
  }

  display(): void {}

  hide(): void {}
}

class Menu {
  items: unknown[] = [];

  addItem(callback: (item: MenuItem) => void): this {
    const item = new MenuItem();
    callback(item);
    this.items.push(item);
    return this;
  }

  addSeparator(): this {
    this.items.push({ separator: true });
    return this;
  }

  showAtMouseEvent(_event: unknown): this {
    currentRuntime()?.emit("notice", { message: "Plugin menu opened" });
    return this;
  }

  showAtPosition(_position: { x: number; y: number }): this {
    currentRuntime()?.emit("notice", { message: "Plugin menu opened" });
    return this;
  }

  hide(): void {}
}

class MenuItem {
  title = "";
  icon = "";
  callback: (() => void | Promise<void>) | null = null;

  setTitle(title: string): this {
    this.title = title;
    return this;
  }

  setIcon(icon: string): this {
    this.icon = icon;
    return this;
  }

  onClick(callback: () => void | Promise<void>): this {
    this.callback = callback;
    return this;
  }
}

class Setting extends Component {
  controlEl = new ShimElement("div");
  settingEl = new ShimElement("div");
  infoEl = new ShimElement("div");

  constructor(public containerEl: ShimElement) {
    super();
    this.settingEl.addClass("setting-item");
    this.infoEl.addClass("setting-item-info");
    this.controlEl.addClass("setting-item-control");
    this.settingEl.appendChild(this.infoEl);
    this.settingEl.appendChild(this.controlEl);
    this.containerEl.appendChild(this.settingEl);
  }

  setName(value: string): this {
    this.infoEl.setText(value);
    return this;
  }

  setDesc(value: string): this {
    this.settingEl.setAttribute("data-desc", value);
    this.infoEl.createDiv({ text: value, cls: "setting-item-description" });
    return this;
  }

  addText(callback: (component: SettingTextComponent) => void): this {
    callback(new SettingTextComponent(this.controlEl));
    return this;
  }

  addToggle(callback: (component: SettingToggleComponent) => void): this {
    callback(new SettingToggleComponent(this.controlEl));
    return this;
  }

  addButton(callback: (component: SettingButtonComponent) => void): this {
    callback(new SettingButtonComponent(this.controlEl));
    return this;
  }
}

class SettingTextComponent {
  private value = "";
  private readonly inputEl: ShimElement;

  constructor(containerEl?: ShimElement) {
    this.inputEl = new ShimElement("input");
    this.inputEl.setAttr("type", "text");
    containerEl?.appendChild(this.inputEl);
  }

  setPlaceholder(value: string): this {
    this.inputEl.setAttr("placeholder", value);
    return this;
  }
  setValue(value: string): this {
    this.value = value;
    this.inputEl.setAttr("value", value);
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
  private readonly toggleEl: ShimElement;

  constructor(containerEl?: ShimElement) {
    this.toggleEl = new ShimElement("button");
    this.toggleEl.addClass("toggle");
    this.toggleEl.setAttr("type", "button");
    containerEl?.appendChild(this.toggleEl);
  }

  setValue(value: boolean): this {
    this.value = value;
    this.toggleEl.setAttr("aria-pressed", String(value));
    this.toggleEl.toggleClass("on", value);
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
  private readonly buttonEl: ShimElement;

  constructor(containerEl?: ShimElement) {
    this.buttonEl = new ShimElement("button");
    this.buttonEl.addClass("plugin-setting-button");
    this.buttonEl.setAttr("type", "button");
    containerEl?.appendChild(this.buttonEl);
  }

  setButtonText(value: string): this {
    this.buttonEl.setText(value);
    return this;
  }
  setCta(): this {
    this.buttonEl.addClass("mod-cta");
    return this;
  }
  onClick(callback: () => void | Promise<void>): this {
    const runtime = currentRuntime();
    if (runtime) {
      const actionId = runtime.registerElementAction(callback);
      this.buttonEl.setAttr("data-lattice-action-id", actionId);
      this.buttonEl.setAttr("data-lattice-plugin-id", runtime.pluginId);
    }
    return this;
  }
}

class ShimElement {
  textContent = "";
  children: ShimElement[] = [];
  private classes = new Set<string>();
  private attributes = new Map<string, string>();
  private onChange: ((element: ShimElement) => void) | null = null;
  private parent: ShimElement | null = null;

  constructor(public tagName: string) {}

  setChangeHandler(onChange: ((element: ShimElement) => void) | null): this {
    this.onChange = onChange;
    return this;
  }

  setText(value: string): this {
    this.textContent = value;
    this.notifyChange();
    return this;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    this.notifyChange();
  }

  addClass(name: string): this {
    this.classes.add(name);
    this.notifyChange();
    return this;
  }

  addClasses(names: string[]): this {
    for (const name of names) this.addClass(name);
    return this;
  }

  removeClass(name: string): this {
    this.classes.delete(name);
    this.notifyChange();
    return this;
  }

  removeClasses(names: string[]): this {
    for (const name of names) this.removeClass(name);
    return this;
  }

  toggleClass(name: string, value?: boolean): this {
    const next = value ?? !this.classes.has(name);
    if (next) this.addClass(name);
    else this.removeClass(name);
    return this;
  }

  hasClass(name: string): boolean {
    return this.classes.has(name);
  }

  setAttr(name: string, value: string): this {
    this.setAttribute(name, value);
    return this;
  }

  setAttrs(attrs: Record<string, string>): this {
    for (const [key, value] of Object.entries(attrs)) this.setAttr(key, value);
    return this;
  }

  getAttr(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  empty(): void {
    this.children = [];
    this.textContent = "";
    this.notifyChange();
  }

  createEl(tagName: string, options?: { text?: string; cls?: string | string[]; attr?: Record<string, string> }): ShimElement {
    const child = new ShimElement(tagName);
    child.parent = this;
    if (options?.text) child.setText(options.text);
    if (Array.isArray(options?.cls)) child.addClasses(options.cls);
    else if (options?.cls) child.addClass(options.cls);
    if (options?.attr) child.setAttrs(options.attr);
    this.children.push(child);
    this.notifyChange();
    return child;
  }

  createDiv(options?: { text?: string; cls?: string | string[]; attr?: Record<string, string> }): ShimElement {
    return this.createEl("div", options);
  }

  createSpan(options?: { text?: string; cls?: string | string[]; attr?: Record<string, string> }): ShimElement {
    return this.createEl("span", options);
  }

  appendText(text: string): this {
    this.textContent += text;
    this.notifyChange();
    return this;
  }

  appendChild(child: ShimElement): ShimElement {
    child.parent = this;
    this.children.push(child);
    this.notifyChange();
    return child;
  }

  on(_type: string, _selectorOrCallback: unknown, _callback?: unknown): () => void {
    return () => {};
  }

  off(): void {}

  onClickEvent(callback: () => void): this {
    void callback;
    return this;
  }

  show(): this {
    this.attributes.set("style.display", "");
    this.notifyChange();
    return this;
  }

  hide(): this {
    this.attributes.set("style.display", "none");
    this.notifyChange();
    return this;
  }

  detach(): void {
    this.remove();
  }

  remove(): void {
    this.children = [];
    this.textContent = "";
    this.notifyChange();
  }

  toJSON(): SerializedObsidianElement {
    return {
      tagName: this.tagName,
      textContent: this.textContent,
      classes: Array.from(this.classes),
      attributes: Object.fromEntries(this.attributes),
      children: this.children.map((child) => child.toJSON()),
    };
  }

  private notifyChange(): void {
    if (this.parent) {
      this.parent.notifyChange();
      return;
    }
    this.onChange?.(this);
  }
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

  class Plugin extends Component {
    app = runtime.app;
    manifest = runtime.manifest;

    addCommand(command: { id: string; name?: string; title?: string; callback?: CommandCallback }): void {
      runtime.registerCommand(command);
    }

    addRibbonIcon(icon: string, title: string, callback: () => void | Promise<void>): ShimElement {
      runtime.requirePermission("ui:ribbon", "Plugin.addRibbonIcon");
      const element = new ShimElement("button");
      const id = runtime.registerRibbonAction(icon, title, callback);
      element.setAttribute("aria-label", title);
      element.setAttribute("data-lattice-ribbon-id", id);
      runtime.register(() => element.remove());
      return element;
    }

    addStatusBarItem(): ShimElement {
      runtime.requirePermission("ui:status-bar", "Plugin.addStatusBarItem");
      return runtime.registerStatusBarElement();
    }

    addSettingTab(tab: PluginSettingTab): void {
      runtime.requirePermission("ui:settings-tab", "Plugin.addSettingTab");
      runtime.registerSettingTab(tab);
    }

    registerView(type: string, viewCreator: unknown): void {
      runtime.requirePermission("workspace:views", "Plugin.registerView");
      runtime.emit("api.unsupported", { apiName: "Plugin.registerView", type, supportedAs: "registered placeholder" });
      runtime.register(() => void viewCreator);
    }

    registerExtensions(extensions: string[]): void {
      runtime.emit("api.unsupported", { apiName: "Plugin.registerExtensions", extensions });
    }

    registerEditorExtension(extension: unknown): void {
      runtime.requirePermission("editor:write", "Plugin.registerEditorExtension");
      runtime.emit("api.unsupported", { apiName: "Plugin.registerEditorExtension", supportedAs: "load-safe placeholder" });
      runtime.register(() => void extension);
    }

    registerEditorSuggest(suggester: unknown): void {
      runtime.requirePermission("editor:write", "Plugin.registerEditorSuggest");
      runtime.emit("api.unsupported", { apiName: "Plugin.registerEditorSuggest", supportedAs: "load-safe placeholder" });
      runtime.register(() => void suggester);
    }

    registerHoverLinkSource(id: string, source: unknown): void {
      runtime.requirePermission("workspace:views", "Plugin.registerHoverLinkSource");
      runtime.emit("api.unsupported", { apiName: "Plugin.registerHoverLinkSource", id, supportedAs: "load-safe placeholder" });
      runtime.register(() => void source);
    }

    registerObsidianProtocolHandler(action: string, handler: unknown): void {
      runtime.requirePermission("workspace:layout", "Plugin.registerObsidianProtocolHandler");
      runtime.emit("api.unsupported", { apiName: "Plugin.registerObsidianProtocolHandler", action, supportedAs: "load-safe placeholder" });
      runtime.register(() => void handler);
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
    Component,
    Plugin,
    Notice,
    Modal,
    Menu,
    PluginSettingTab,
    Setting,
    TAbstractFile,
    TFile,
    TFolder,
    WorkspaceLeaf: class WorkspaceLeaf {},
    View: Component,
    ItemView: class ItemView extends Component {},
    FileView: class FileView extends Component {},
    MarkdownView: class MarkdownView extends Component {},
    MarkdownRenderer: {
      render: async (_app: unknown, _markdown: string, _el: ShimElement, _sourcePath: string, _component: Component) => {},
    },
    normalizePath,
    debounce,
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
  if (typeof disposable.off === "function") {
    disposable.off();
    return;
  }
  disposable.detach?.();
}

function debounce<T extends (...args: unknown[]) => unknown>(fn: T, timeout = 0): T & { cancel: () => void } {
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
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
