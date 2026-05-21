import { describe, expect, it } from "vitest";
import { loadObsidianPlugin, ObsidianPermissionError, type ObsidianHostBridge, type ObsidianHostEvent, type ObsidianRuntimeBundle } from "@/features/plugins/obsidian-runtime";
import { registerPluginStyles } from "@/features/plugins/obsidian-styles";

const allPermissions = [
  "vault:read",
  "vault:write",
  "workspace:read",
  "workspace:layout",
  "workspace:views",
  "editor:commands",
  "ui:modal",
  "ui:ribbon",
  "ui:status-bar",
  "ui:settings-tab",
  "storage:plugin-data",
];

describe("Obsidian runtime shim", () => {
  it("loads a simple Obsidian plugin and registers commands", async () => {
    const bridge = memoryBridge(allPermissions);
    const runtime = await loadObsidianPlugin(
      bundle(`
        const { Plugin, Notice } = require("obsidian");
        module.exports = class SamplePlugin extends Plugin {
          onload() {
            new Notice("loaded");
            this.addCommand({ id: "hello", name: "Say hello", callback: () => this.saveData({ clicked: true }) });
          }
        };
      `),
      bridge,
    );

    expect(runtime.commands).toEqual([{ id: "sample-plugin:hello", name: "Say hello", pluginId: "sample-plugin" }]);
    expect(bridge.events.some((event) => event.type === "notice")).toBe(true);

    await runtime.invokeCommand("sample-plugin:hello");
    expect(JSON.parse(bridge.data ?? "{}")).toEqual({ clicked: true });
  });

  it("allows vault read and write through the shim", async () => {
    const bridge = memoryBridge(allPermissions, { "A.md": "# A" });
    await loadObsidianPlugin(
      bundle(`
        const { Plugin } = require("obsidian");
        module.exports = class VaultPlugin extends Plugin {
          async onload() {
            const file = this.app.vault.getMarkdownFiles()[0];
            const content = await this.app.vault.read(file);
            await this.app.vault.modify(file, content + "\\nupdated");
          }
        };
      `),
      bridge,
      { files: [fileNode("A.md")] },
    );

    expect(bridge.vault["A.md"]).toBe("# A\nupdated");
  });

  it("persists plugin data through loadData and saveData", async () => {
    const bridge = memoryBridge(allPermissions);
    bridge.data = JSON.stringify({ count: 4 });

    await loadObsidianPlugin(
      bundle(`
        const { Plugin } = require("obsidian");
        module.exports = class DataPlugin extends Plugin {
          async onload() {
            const data = await this.loadData();
            await this.saveData({ count: data.count + 1 });
          }
        };
      `),
      bridge,
    );

    expect(JSON.parse(bridge.data ?? "{}")).toEqual({ count: 5 });
  });

  it("cleans up managed styles on unload", () => {
    const cleanup = registerPluginStyles("sample-plugin", ".sample { color: red; }");
    expect(document.head.querySelectorAll("style[data-lattice-plugin-style='sample-plugin']")).toHaveLength(1);

    cleanup();

    expect(document.head.querySelectorAll("style[data-lattice-plugin-style='sample-plugin']")).toHaveLength(0);
  });

  it("denies shim APIs when permissions are missing", async () => {
    const bridge = memoryBridge(["vault:read"], { "A.md": "# A" });

    await expect(
      loadObsidianPlugin(
        bundle(`
          const { Plugin } = require("obsidian");
          module.exports = class DeniedPlugin extends Plugin {
            async onload() {
              await this.app.vault.modify("A.md", "blocked");
            }
          };
        `),
        bridge,
      ),
    ).rejects.toBeInstanceOf(ObsidianPermissionError);

    expect(bridge.events).toContainEqual({
      type: "permission.denied",
      pluginId: "sample-plugin",
      payload: { permission: "vault:write", apiName: "Vault.modify" },
    });
    expect(bridge.vault["A.md"]).toBe("# A");
  });
});

function bundle(mainSource: string): ObsidianRuntimeBundle {
  return {
    id: "sample-plugin",
    manifest: {
      id: "sample-plugin",
      name: "Sample Plugin",
      version: "1.0.0",
      description: "Sample",
      author: "Tests",
      main: "main.js",
      permissions: {},
      ecosystem: "obsidian",
    },
    mainSource,
    grantedPermissions: allPermissions.map((permission) => ({ permission, granted: true })),
  };
}

function fileNode(path: string) {
  return {
    id: path,
    path,
    name: path,
    kind: "file" as const,
    isMarkdown: path.endsWith(".md"),
    modifiedAt: new Date().toISOString(),
    size: 3,
  };
}

function memoryBridge(permissions: string[], initialVault: Record<string, string> = {}) {
  const granted = new Set(permissions);
  const bridge: ObsidianHostBridge & {
    events: ObsidianHostEvent[];
    vault: Record<string, string>;
    data: string | null;
  } = {
    events: [],
    vault: { ...initialVault },
    data: null,
    hasPermission(permission) {
      return granted.has(permission);
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
      if (action === "storage.loadData") return this.data as T;
      if (action === "storage.saveData") {
        this.data = String(data.data ?? "null");
        return true as T;
      }
      if (action === "metadata.getFileCache") return null as T;
      throw new Error(`unsupported action ${action}`);
    },
    emit(event) {
      this.events.push(event);
    },
  };
  return bridge;
}
