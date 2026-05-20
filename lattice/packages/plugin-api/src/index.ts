import type { CommandAPI } from "./commands";
import type { EditorAPI } from "./editor";
import type { MetadataAPI } from "./metadata";
import type { PermissionAPI } from "./permissions";
import type { VaultAPI } from "./vault";
import type { WorkspaceAPI } from "./workspace";

export * from "./commands";
export * from "./editor";
export * from "./manifest";
export * from "./metadata";
export * from "./permissions";
export * from "./vault";
export * from "./workspace";

export interface SettingsAPI {
  get<T>(key: string, fallbackValue: T): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
}

export interface PluginContext {
  id: string;
  vault: VaultAPI;
  workspace: WorkspaceAPI;
  metadata: MetadataAPI;
  commands: CommandAPI;
  editor: EditorAPI;
  settings: SettingsAPI;
  permissions: PermissionAPI;
}

export interface LatticePlugin {
  onload(context: PluginContext): void | Promise<void>;
  onunload?(): void | Promise<void>;
}
