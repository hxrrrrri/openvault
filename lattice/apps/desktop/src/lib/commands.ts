import type {
  AiCliAdapterStatus,
  AiCliRunRequest,
  AiCliRunResult,
  Backlink,
  CollectionItem,
  CollectionQuery,
  CommandItem,
  FileNode,
  GraphFilters,
  GraphPayload,
  NoteContent,
  NoteMetadata,
  OutgoingLink,
  PermissionGrant,
  PluginInfo,
  PluginRuntimeBundle,
  SearchResult,
  TerminalAdapterStatus,
  TerminalSessionInfo,
  UnlinkedMention,
  UnresolvedLink,
  VaultHealthReport,
  VaultInfo,
} from "@/types/domain";
import { titleFromMarkdown } from "@/lib/utils";
import { safeInvoke } from "@/lib/tauri";
import { listPluginCommands } from "@/features/plugins/plugin-command-registry";

interface IndexingSummary {
  scannedFiles: number;
  indexedFiles: number;
  skippedFiles: number;
  durationMs: number;
}

export interface ImportedAsset {
  path: string;
  fileName: string;
  mime: string;
}

export interface ObsidianCommunityPlugin {
  id: string;
  name: string;
  author: string;
  description: string;
  repo: string;
  downloads?: number;
  updatedAt?: number;
}

export type TrashStrategy = "system" | "app" | "permanent";

export const coreCommands: CommandItem[] = [
  {
    id: "note.new",
    group: "Quick Actions",
    label: "New note",
    hint: "Ctrl N",
    kind: "command",
    icon: "plus",
  },
  {
    id: "note.daily",
    group: "Quick Actions",
    label: "Open daily note",
    hint: "Ctrl Shift D",
    kind: "command",
    icon: "calendar",
  },
  {
    id: "note.random",
    group: "Quick Actions",
    label: "Open random note",
    kind: "command",
    icon: "shuffle",
  },
  {
    id: "note.unique",
    group: "Quick Actions",
    label: "New Zettelkasten note (unique ID)",
    kind: "command",
    icon: "plus",
  },
  {
    id: "templates.insert",
    group: "Quick Actions",
    label: "Insert template…",
    kind: "command",
    icon: "file",
  },
  {
    id: "tab.reopen-closed",
    group: "Workspace",
    label: "Reopen closed tab",
    hint: "Ctrl Shift T",
    kind: "command",
    icon: "plus",
  },
  {
    id: "tab.close-active",
    group: "Workspace",
    label: "Close active tab",
    hint: "Ctrl W",
    kind: "command",
    icon: "plus",
  },
  {
    id: "workspace.save",
    group: "Workspace",
    label: "Save workspace…",
    kind: "command",
    icon: "plus",
  },
  {
    id: "workspace.load",
    group: "Workspace",
    label: "Load workspace…",
    kind: "command",
    icon: "plus",
  },
  {
    id: "format.convert",
    group: "Vault",
    label: "Convert wikilinks ↔ markdown links",
    kind: "command",
    icon: "plus",
  },
  {
    id: "collections.open",
    group: "Quick Actions",
    label: "Open collections",
    kind: "command",
    icon: "table",
  },
  {
    id: "ai.open",
    group: "Quick Actions",
    label: "Open terminal",
    kind: "command",
    icon: "terminal",
  },
  {
    id: "canvas.open",
    group: "Quick Actions",
    label: "Open canvas",
    hint: "Ctrl Shift C",
    kind: "command",
    icon: "layout",
  },
  {
    id: "graph.open",
    group: "Quick Actions",
    label: "Open graph",
    hint: "Ctrl G",
    kind: "command",
    icon: "sphere",
  },
  {
    id: "health.open",
    group: "Quick Actions",
    label: "Open vault health",
    kind: "command",
    icon: "shield",
  },
  {
    id: "plugins.open",
    group: "Quick Actions",
    label: "Open plugin marketplace",
    kind: "command",
    icon: "puzzle",
  },
  {
    id: "settings.permissions",
    group: "Settings",
    label: "Plugin permissions",
    kind: "setting",
    icon: "shield",
  },
];

export const commands = {
  bootstrapVault() {
    return safeInvoke<VaultInfo>("bootstrap_vault");
  },
  createVault(path: string) {
    return safeInvoke<VaultInfo>("create_vault", { path });
  },
  openVault(path: string) {
    return safeInvoke<VaultInfo>("open_vault", { path });
  },
  getVaultState() {
    return safeInvoke<VaultInfo>("get_vault_state");
  },
  scanVault() {
    return safeInvoke<IndexingSummary>("scan_vault");
  },
  listFiles() {
    return safeInvoke<FileNode[]>("list_files");
  },
  listTags() {
    return safeInvoke<string[]>("list_tags");
  },
  readNote(path: string) {
    return safeInvoke<NoteContent>("read_note", { path });
  },
  writeNote(path: string, content: string) {
    return safeInvoke("write_note", { path, content });
  },
  createNote(path: string, content = `# ${titleFromMarkdown(path, "")}\n`) {
    return safeInvoke<FileNode>("create_note", { path, content });
  },
  renameNote(oldPath: string, newPath: string, options: { updateLinks?: boolean } = {}) {
    return safeInvoke<FileNode>("rename_note", {
      oldPath,
      newPath,
      updateLinks: options.updateLinks,
    });
  },
  deleteNote(path: string, options: { trashStrategy?: TrashStrategy } = {}) {
    return safeInvoke<boolean>("delete_note", {
      path,
      trashStrategy: options.trashStrategy,
    });
  },
  createFolder(path: string) {
    return safeInvoke<FileNode>("create_folder", { path });
  },
  readAssetDataUrl(path: string, basePath?: string | null) {
    return safeInvoke<string>("read_asset_data_url", { path, basePath });
  },
  importAsset(request: {
    fileName: string;
    bytesBase64: string;
    attachmentFolder?: string | null;
  }) {
    return safeInvoke<ImportedAsset>("import_asset", request);
  },
  getNoteMetadata(path: string) {
    return safeInvoke<NoteMetadata>("get_note_metadata", { path });
  },
  getGlobalGraph(filters: GraphFilters = {}) {
    return safeInvoke<GraphPayload>("get_global_graph", { filters });
  },
  getLocalGraph(path: string, depth = 2) {
    return safeInvoke<GraphPayload>("get_local_graph", { path, depth });
  },
  getBacklinks(path: string) {
    return safeInvoke<Backlink[]>("get_backlinks", { path });
  },
  getOutgoingLinks(path: string) {
    return safeInvoke<OutgoingLink[]>("get_outgoing_links", { path });
  },
  getUnresolvedLinks(path: string) {
    return safeInvoke<UnresolvedLink[]>("get_unresolved_links", { path });
  },
  getUnlinkedMentions(path: string) {
    return safeInvoke<UnlinkedMention[]>("get_unlinked_mentions", { path });
  },
  convertUnlinkedMention(sourcePath: string, targetPath: string, line: number) {
    return safeInvoke<NoteContent>("convert_unlinked_mention", {
      sourcePath,
      targetPath,
      line,
    });
  },
  search(query: string) {
    if (!query.trim()) return Promise.resolve<SearchResult[]>([]);
    return safeInvoke<SearchResult[]>("search", { query, options: {} });
  },
  async commandSearch(query: string) {
    try {
      const remote = await safeInvoke<CommandItem[]>("command_search", {
        query,
      });
      return mergeCommands(mergeCommands(coreCommands, remote), listPluginCommands(query));
    } catch {
      const normalized = query.toLowerCase();
      return mergeCommands(coreCommands, listPluginCommands(query)).filter(
        (item) => !normalized || item.label.toLowerCase().includes(normalized),
      );
    }
  },
  getVaultHealth() {
    return safeInvoke<VaultHealthReport>("get_vault_health");
  },
  listPlugins() {
    return safeInvoke<PluginInfo[]>("list_plugins");
  },
  listObsidianCommunityPlugins() {
    return safeInvoke<ObsidianCommunityPlugin[]>("list_obsidian_community_plugins");
  },
  installPluginFromFolder(path: string) {
    return safeInvoke<PluginInfo>("install_plugin_from_folder", { path });
  },
  installObsidianPluginsFromVault(path: string) {
    return safeInvoke<PluginInfo[]>("install_obsidian_plugins_from_vault", {
      path,
    });
  },
  installObsidianCommunityPlugin(repo: string) {
    return safeInvoke<PluginInfo>("install_obsidian_community_plugin", { repo });
  },
  installObsidianPluginFromSources(request: {
    manifestJson: string;
    mainSource: string;
    stylesSource?: string | null;
  }) {
    return safeInvoke<PluginInfo>("install_obsidian_plugin_from_sources", request);
  },
  enablePlugin(id: string) {
    return safeInvoke<boolean>("enable_plugin", { id });
  },
  disablePlugin(id: string) {
    return safeInvoke<boolean>("disable_plugin", { id });
  },
  readPluginRuntimeBundle(id: string) {
    return safeInvoke<PluginRuntimeBundle>("read_plugin_runtime_bundle", { id });
  },
  readPluginData(id: string) {
    return safeInvoke<string | null>("read_plugin_data", { id });
  },
  writePluginData(id: string, data: string) {
    return safeInvoke<boolean>("write_plugin_data", { id, data });
  },
  updatePluginPermissions(id: string, permissions: PermissionGrant[]) {
    return safeInvoke<boolean>("update_plugin_permissions", {
      id,
      permissions,
    });
  },
  listCollectionItems(query: CollectionQuery) {
    return safeInvoke<CollectionItem[]>("list_collection_items", { query });
  },
  listAiCliAdapters() {
    return safeInvoke<AiCliAdapterStatus[]>("list_ai_cli_adapters");
  },
  runAiCli(request: AiCliRunRequest) {
    return safeInvoke<AiCliRunResult>("run_ai_cli", { request });
  },
  listTerminalAdapters() {
    return safeInvoke<TerminalAdapterStatus[]>("list_terminal_adapters");
  },
  listTerminalSessions() {
    return safeInvoke<TerminalSessionInfo[]>("list_terminal_sessions");
  },
  startTerminalSession(request: {
    cliId: string;
    cols?: number;
    rows?: number;
  }) {
    return safeInvoke<TerminalSessionInfo>("start_terminal_session", {
      request,
    });
  },
  getTerminalHistory(sessionId: string) {
    return safeInvoke<string[]>("get_terminal_history", { sessionId });
  },
  writeTerminalInput(sessionId: string, data: string) {
    return safeInvoke<boolean>("write_terminal_input", { sessionId, data });
  },
  resizeTerminalSession(request: {
    sessionId: string;
    cols: number;
    rows: number;
  }) {
    return safeInvoke<boolean>("resize_terminal_session", { request });
  },
  killTerminalSession(sessionId: string) {
    return safeInvoke<boolean>("kill_terminal_session", { sessionId });
  },
  killAllTerminalSessions() {
    return safeInvoke<boolean>("kill_all_terminal_sessions");
  },
};

function mergeCommands(
  local: CommandItem[],
  remote: CommandItem[],
): CommandItem[] {
  const byId = new Map<string, CommandItem>();
  for (const item of [...local, ...remote]) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values());
}
