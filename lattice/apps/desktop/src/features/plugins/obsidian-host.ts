import { commands } from "@/lib/commands";
import type { FileNode, PluginInfo, PluginRuntimeBundle } from "@/types/domain";
import { registerPluginStyles } from "@/features/plugins/obsidian-styles";
import { clearPluginCommandsForPlugin, registerPluginCommand } from "@/features/plugins/plugin-command-registry";
import type { ObsidianCommandRegistration, ObsidianHostEvent, ObsidianRuntimeContext } from "@/features/plugins/obsidian-runtime";

interface WorkerPending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

interface PluginSession {
  worker: Worker;
  cleanup: Array<() => void>;
  pending: Map<number, WorkerPending>;
  nextRequestId: number;
}

type WorkerMessage =
  | { type: "loaded"; requestId: number; commands: ObsidianCommandRegistration[] }
  | { type: "unloaded"; requestId: number }
  | { type: "commandInvoked"; requestId: number }
  | { type: "error"; requestId: number; error: string }
  | { type: "call"; requestId: number; action: string; payload?: unknown }
  | { type: "event"; event: ObsidianHostEvent };

export class ObsidianPluginHost {
  private sessions = new Map<string, PluginSession>();

  async enable(plugin: PluginInfo): Promise<void> {
    if (plugin.manifest.ecosystem !== "obsidian") return;
    await this.disable(plugin.id);

    const bundle = await commands.readPluginRuntimeBundle(plugin.id);
    const files = await commands.listFiles().catch(() => []);
    const context: ObsidianRuntimeContext = {
      files,
      activePath: firstMarkdownPath(files),
    };
    const worker = new Worker(new URL("./obsidian-worker.ts", import.meta.url), { type: "module" });
    const session: PluginSession = {
      worker,
      cleanup: [],
      pending: new Map(),
      nextRequestId: 1,
    };
    this.sessions.set(plugin.id, session);

    worker.onmessage = (message: MessageEvent<WorkerMessage>) => {
      void this.handleWorkerMessage(plugin.id, bundle, session, message.data);
    };
    worker.onerror = (event) => {
      console.error(`Obsidian plugin worker failed for ${plugin.id}`, event.message);
    };

    if (bundle.stylesSource && hasPermission(bundle, "ui:theme")) {
      session.cleanup.push(registerPluginStyles(plugin.id, bundle.stylesSource));
    }

    await this.request(session, {
      type: "load",
      bundle: toRuntimeBundle(bundle),
      context,
    });
  }

  async disable(pluginId: string): Promise<void> {
    const session = this.sessions.get(pluginId);
    if (!session) return;
    try {
      await this.request(session, { type: "unload" });
    } catch (error) {
      console.warn(`Obsidian plugin unload failed for ${pluginId}`, error);
    }
    for (const cleanup of [...session.cleanup].reverse()) cleanup();
    clearPluginCommandsForPlugin(pluginId);
    session.worker.terminate();
    this.sessions.delete(pluginId);
  }

  async invokeCommand(pluginId: string, commandId: string): Promise<void> {
    const session = this.sessions.get(pluginId);
    if (!session) throw new Error(`Obsidian plugin is not running: ${pluginId}`);
    await this.request(session, { type: "invokeCommand", commandId });
  }

  private request(session: PluginSession, message: Record<string, unknown>): Promise<unknown> {
    const requestId = session.nextRequestId++;
    session.worker.postMessage({ ...message, requestId });
    return new Promise((resolve, reject) => {
      session.pending.set(requestId, { resolve, reject });
    });
  }

  private async handleWorkerMessage(pluginId: string, bundle: PluginRuntimeBundle, session: PluginSession, message: WorkerMessage): Promise<void> {
    if (message.type === "call") {
      await this.handleRuntimeCall(session, message.requestId, message.action, message.payload);
      return;
    }
    if (message.type === "event") {
      this.handleRuntimeEvent(pluginId, session, message.event);
      return;
    }

    const pending = session.pending.get(message.requestId);
    if (!pending) return;
    session.pending.delete(message.requestId);
    if (message.type === "error") {
      pending.reject(new Error(message.error));
      return;
    }
    if (message.type === "loaded") {
      for (const command of message.commands) {
        this.registerCommand(pluginId, session, command);
      }
      pending.resolve(message.commands);
      return;
    }
    if (message.type === "unloaded" || message.type === "commandInvoked") {
      pending.resolve(true);
      return;
    }

    void bundle;
  }

  private handleRuntimeEvent(pluginId: string, session: PluginSession, event: ObsidianHostEvent): void {
    if (event.type === "command.registered") {
      this.registerCommand(pluginId, session, event.payload as ObsidianCommandRegistration);
    }
    if (event.type === "permission.denied" || event.type === "api.unsupported") {
      console.warn(`Obsidian plugin ${pluginId}: ${event.type}`, event.payload);
    }
    if (event.type === "notice") {
      console.info(`Obsidian plugin ${pluginId}:`, event.payload);
    }
  }

  private registerCommand(pluginId: string, session: PluginSession, command: ObsidianCommandRegistration): void {
    if (!command?.id) return;
    const dispose = registerPluginCommand({
      item: {
        id: command.id,
        group: "Plugins",
        label: command.name,
        kind: "plugin",
        icon: "puzzle",
      },
      run: async () => {
        await this.request(session, { type: "invokeCommand", commandId: command.id });
      },
    });
    session.cleanup.push(dispose);
    void pluginId;
  }

  private async handleRuntimeCall(session: PluginSession, requestId: number, action: string, payload: unknown): Promise<void> {
    try {
      const value = await runHostAction(action, payload);
      session.worker.postMessage({ type: "callResult", requestId, ok: true, value });
    } catch (error) {
      session.worker.postMessage({ type: "callResult", requestId, ok: false, error: String(error) });
    }
  }
}

export function createObsidianPluginHost(): ObsidianPluginHost {
  return new ObsidianPluginHost();
}

async function runHostAction(action: string, payload: unknown): Promise<unknown> {
  const data = asRecord(payload);
  if (action === "vault.read") {
    return (await commands.readNote(String(data.path))).content;
  }
  if (action === "vault.modify") {
    return commands.writeNote(String(data.path), String(data.content ?? ""));
  }
  if (action === "vault.create") {
    return commands.createNote(String(data.path), String(data.content ?? ""));
  }
  if (action === "vault.delete") {
    return commands.deleteNote(String(data.path));
  }
  if (action === "vault.rename") {
    return commands.renameNote(String(data.oldPath), String(data.newPath));
  }
  if (action === "storage.loadData") {
    return commands.readPluginData(String(data.pluginId));
  }
  if (action === "storage.saveData") {
    return commands.writePluginData(String(data.pluginId), String(data.data ?? "null"));
  }
  if (action === "metadata.getFileCache") {
    return commands.getNoteMetadata(String(data.path));
  }
  throw new Error(`Unsupported Obsidian host action: ${action}`);
}

function toRuntimeBundle(bundle: PluginRuntimeBundle) {
  return {
    id: bundle.id,
    manifest: bundle.manifest,
    mainSource: bundle.mainSource,
    initialDataSource: bundle.initialDataSource,
    grantedPermissions: bundle.grantedPermissions,
  };
}

function hasPermission(bundle: PluginRuntimeBundle, permission: string): boolean {
  return bundle.grantedPermissions.some((grant) => grant.permission === permission && grant.granted);
}

function firstMarkdownPath(files: FileNode[]): string | null {
  for (const file of files) {
    if (file.kind === "file" && file.isMarkdown) return file.path;
    const child = firstMarkdownPath(file.children ?? []);
    if (child) return child;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
