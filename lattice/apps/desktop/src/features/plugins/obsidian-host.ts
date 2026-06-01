import { commands } from "@/lib/commands";
import type { FileNode, PluginInfo, PluginRuntimeBundle } from "@/types/domain";
import { loadPluginMainRuntime, type MainRuntimeBundle, type MainRuntimeContext } from "@/features/plugins/main-runtime";

interface PluginSession {
  pluginId: string;
  unload: () => Promise<void>;
  invokeCommand: (commandId: string) => Promise<void>;
}

export class ObsidianPluginHost {
  private sessions = new Map<string, PluginSession>();
  private loading = new Map<string, Promise<void>>();

  async enable(plugin: PluginInfo): Promise<void> {
    if (plugin.manifest.ecosystem !== "obsidian") return;
    if (this.loading.has(plugin.id)) return this.loading.get(plugin.id);
    const task = this.enableInternal(plugin);
    this.loading.set(plugin.id, task);
    try {
      await task;
    } finally {
      this.loading.delete(plugin.id);
    }
  }

  private async enableInternal(plugin: PluginInfo): Promise<void> {
    await this.disable(plugin.id);
    const bundle = await commands.readPluginRuntimeBundle(plugin.id);
    const files = await commands.listFiles().catch(() => []);
    const context: MainRuntimeContext = {
      files,
      activePath: firstMarkdownPath(files),
    };
    const loaded = await loadPluginMainRuntime(toRuntimeBundle(bundle), context);
    this.sessions.set(plugin.id, {
      pluginId: plugin.id,
      unload: loaded.unload,
      invokeCommand: loaded.invokeCommand,
    });
  }

  async disable(pluginId: string): Promise<void> {
    const session = this.sessions.get(pluginId);
    if (!session) return;
    this.sessions.delete(pluginId);
    try {
      await session.unload();
    } catch (error) {
      console.warn(`Plugin unload failed for ${pluginId}`, error);
    }
  }

  async invokeCommand(pluginId: string, commandId: string): Promise<void> {
    const session = this.sessions.get(pluginId);
    if (!session) throw new Error(`Plugin not running: ${pluginId}`);
    await session.invokeCommand(commandId);
  }

  async invokeRibbonAction(pluginId: string, ribbonId: string): Promise<void> {
    return this.invokeCommand(pluginId, ribbonId);
  }

  isEnabled(pluginId: string): boolean {
    return this.sessions.has(pluginId);
  }

  async enableMany(plugins: PluginInfo[]): Promise<void> {
    await Promise.all(plugins.map((plugin) => this.enable(plugin).catch((error) => console.warn(`Plugin enable failed: ${plugin.id}`, error))));
  }
}

let sharedHost: ObsidianPluginHost | null = null;

export function createObsidianPluginHost(): ObsidianPluginHost {
  return getObsidianPluginHost();
}

export function getObsidianPluginHost(): ObsidianPluginHost {
  sharedHost ??= new ObsidianPluginHost();
  return sharedHost;
}

function toRuntimeBundle(bundle: PluginRuntimeBundle): MainRuntimeBundle {
  return {
    id: bundle.id,
    manifest: bundle.manifest,
    mainSource: bundle.mainSource,
    stylesSource: bundle.stylesSource ?? null,
    initialDataSource: bundle.initialDataSource ?? null,
    grantedPermissions: bundle.grantedPermissions,
  };
}

function firstMarkdownPath(files: FileNode[]): string | null {
  for (const file of files) {
    if (file.kind === "file" && file.isMarkdown) return file.path;
    const child = firstMarkdownPath(file.children ?? []);
    if (child) return child;
  }
  return null;
}
