import { loadObsidianPlugin, type ObsidianHostBridge, type ObsidianHostEvent, type ObsidianRuntimeBundle } from "@/features/plugins/obsidian-runtime";
import type { FileNode, PermissionGrant, PluginManifest } from "@/types/domain";

const allHarnessPermissions = [
  "vault:read",
  "vault:write",
  "workspace:read",
  "workspace:layout",
  "workspace:views",
  "editor:read",
  "editor:write",
  "editor:commands",
  "ui:modal",
  "ui:ribbon",
  "ui:status-bar",
  "ui:settings-tab",
  "ui:theme",
  "storage:plugin-data",
  "network:http",
  "system:node-api",
  "system:filesystem",
];

export interface ObsidianCompatibilityFixture {
  id: string;
  name: string;
  representativeOf: string;
  mainSource: string;
  manifest?: Partial<PluginManifest>;
}

export interface ObsidianCompatibilityResult {
  id: string;
  name: string;
  representativeOf: string;
  status: "functional" | "loadable" | "failed";
  commands: number;
  ribbonItems: number;
  statusItems: number;
  settingTabs: number;
  markdownProcessors: number;
  unsupportedApis: string[];
  error?: string;
}

export const TOP_PLUGIN_COMPATIBILITY_FIXTURES: ObsidianCompatibilityFixture[] = [
  {
    id: "calendar-like",
    name: "Calendar-style UI plugin",
    representativeOf: "Calendar / Periodic Notes style plugins",
    mainSource: `
      const { Plugin, PluginSettingTab, Setting, Notice } = require("obsidian");
      module.exports = class CalendarLikePlugin extends Plugin {
        onload() {
          this.addRibbonIcon("calendar", "Open calendar", () => new Notice("Calendar opened"));
          this.addCommand({ id: "open-calendar", name: "Open calendar", callback: () => new Notice("Command opened calendar") });
          this.addStatusBarItem().setText("Calendar ready");
          this.addSettingTab(new class extends PluginSettingTab {
            constructor(app, plugin) {
              super(app, plugin);
              this.name = "Calendar";
            }
            display() {
              this.containerEl.empty();
              new Setting(this.containerEl).setName("Week starts on").setDesc("Representative setting").addText((text) => text.setValue("Monday"));
            }
          }(this.app, this));
        }
      };
    `,
  },
  {
    id: "dataview-like",
    name: "Dataview-style Markdown processor",
    representativeOf: "Dataview / query block style plugins",
    mainSource: `
      const { Plugin } = require("obsidian");
      module.exports = class DataviewLikePlugin extends Plugin {
        async onload() {
          this.registerMarkdownPostProcessor(() => {});
          this.registerMarkdownCodeBlockProcessor("dataview", () => {});
          const file = this.app.vault.getMarkdownFiles()[0];
          if (file) {
            await this.app.vault.cachedRead(file);
            await this.app.metadataCache.getFileCache(file);
          }
        }
      };
    `,
  },
  {
    id: "templater-like",
    name: "Templater-style command plugin",
    representativeOf: "Templater / QuickAdd command and vault mutation plugins",
    mainSource: `
      const { Plugin, Modal } = require("obsidian");
      module.exports = class TemplaterLikePlugin extends Plugin {
        onload() {
          this.addCommand({
            id: "insert-template",
            name: "Insert template",
            callback: async () => {
              const file = this.app.vault.getMarkdownFiles()[0];
              if (file) await this.app.vault.modify(file, await this.app.vault.read(file) + "\\nTemplate inserted");
              new Modal(this.app).open();
            }
          });
        }
      };
    `,
  },
  {
    id: "kanban-like",
    name: "Kanban-style custom view plugin",
    representativeOf: "Kanban / custom workspace view plugins",
    mainSource: `
      const { Plugin, ItemView } = require("obsidian");
      module.exports = class KanbanLikePlugin extends Plugin {
        onload() {
          this.registerView("kanban-board", (leaf) => new ItemView(leaf));
          this.registerHoverLinkSource("kanban-card", {});
        }
      };
    `,
  },
  {
    id: "excalidraw-like",
    name: "Drawing/editor-extension plugin",
    representativeOf: "Excalidraw / advanced editor extension plugins",
    mainSource: `
      const { Plugin, Menu } = require("obsidian");
      module.exports = class DrawingLikePlugin extends Plugin {
        onload() {
          this.registerEditorExtension([]);
          this.registerEditorSuggest({});
          new Menu().addItem((item) => item.setTitle("Drawing tool").setIcon("pencil")).showAtPosition({ x: 0, y: 0 });
        }
      };
    `,
  },
];

export async function runObsidianCompatibilityHarness(
  fixtures: ObsidianCompatibilityFixture[] = TOP_PLUGIN_COMPATIBILITY_FIXTURES,
): Promise<ObsidianCompatibilityResult[]> {
  const results: ObsidianCompatibilityResult[] = [];
  for (const fixture of fixtures) {
    const bridge = memoryBridge();
    try {
      const runtime = await loadObsidianPlugin(toBundle(fixture), bridge, {
        files: [fileNode("Welcome.md")],
        activePath: "Welcome.md",
      });
      await runtime.unload();
      const unsupportedApis = bridge.events
        .filter((event) => event.type === "api.unsupported")
        .map((event) => String((event.payload as { apiName?: string })?.apiName ?? "unknown"));
      results.push({
        id: fixture.id,
        name: fixture.name,
        representativeOf: fixture.representativeOf,
        status: unsupportedApis.length > 0 ? "loadable" : "functional",
        commands: bridge.events.filter((event) => event.type === "command.registered").length,
        ribbonItems: bridge.events.filter((event) => event.type === "ribbon.registered").length,
        statusItems: bridge.events.filter((event) => event.type === "status-bar.registered").length,
        settingTabs: bridge.events.filter((event) => event.type === "setting-tab.registered").length,
        markdownProcessors: bridge.events.filter((event) => event.type === "markdown-processor.registered").length,
        unsupportedApis,
      });
    } catch (error) {
      results.push({
        id: fixture.id,
        name: fixture.name,
        representativeOf: fixture.representativeOf,
        status: "failed",
        commands: 0,
        ribbonItems: 0,
        statusItems: 0,
        settingTabs: 0,
        markdownProcessors: 0,
        unsupportedApis: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}

function toBundle(fixture: ObsidianCompatibilityFixture): ObsidianRuntimeBundle {
  const manifest: PluginManifest = {
    id: fixture.id,
    name: fixture.name,
    version: "0.0.0-harness",
    description: fixture.representativeOf,
    author: "LATTICE compatibility harness",
    main: "main.js",
    permissions: {},
    ecosystem: "obsidian",
    minAppVersion: "1.5.0",
    isDesktopOnly: false,
    styles: "styles.css",
    ...fixture.manifest,
  };
  return {
    id: fixture.id,
    manifest,
    mainSource: fixture.mainSource,
    grantedPermissions: allHarnessPermissions.map((permission): PermissionGrant => ({ permission, granted: true, lastUsedAt: null })),
  };
}

function memoryBridge() {
  const events: ObsidianHostEvent[] = [];
  const vault: Record<string, string> = { "Welcome.md": "# Welcome" };
  const bridge: ObsidianHostBridge & { events: ObsidianHostEvent[]; vault: Record<string, string> } = {
    events,
    vault,
    hasPermission() {
      return true;
    },
    async call<T>(action: string, payload?: unknown): Promise<T> {
      const data = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
      if (action === "vault.read") return (this.vault[String(data.path)] ?? "") as T;
      if (action === "vault.modify" || action === "vault.create") {
        this.vault[String(data.path)] = String(data.content ?? "");
        return true as T;
      }
      if (action === "vault.delete") {
        delete this.vault[String(data.path)];
        return true as T;
      }
      if (action === "vault.rename") {
        this.vault[String(data.newPath)] = this.vault[String(data.oldPath)] ?? "";
        delete this.vault[String(data.oldPath)];
        return true as T;
      }
      if (action === "storage.loadData") return null as T;
      if (action === "storage.saveData") return true as T;
      if (action === "metadata.getFileCache") return { headings: [], links: [], frontmatter: {} } as T;
      if (action === "network.requestUrl") return { status: 200, text: "" } as T;
      throw new Error(`unsupported harness action ${action}`);
    },
    emit(event) {
      this.events.push(event);
    },
  };
  return bridge;
}

function fileNode(path: string): FileNode {
  return {
    id: path,
    path,
    name: path,
    kind: "file",
    isMarkdown: path.endsWith(".md"),
    modifiedAt: new Date().toISOString(),
    size: 9,
  };
}
