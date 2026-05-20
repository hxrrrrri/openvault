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
  SearchResult,
  UnlinkedMention,
  UnresolvedLink,
  VaultHealthReport,
  VaultInfo,
} from "@/types/domain";
import { titleFromMarkdown } from "@/lib/utils";
import { safeInvoke } from "@/lib/tauri";

interface IndexingSummary {
  scannedFiles: number;
  indexedFiles: number;
  skippedFiles: number;
  durationMs: number;
}

export const coreCommands: CommandItem[] = [
  { id: "note.new", group: "Quick Actions", label: "New note", hint: "Ctrl N", kind: "command", icon: "plus" },
  { id: "note.daily", group: "Quick Actions", label: "Open daily note", hint: "Ctrl Shift D", kind: "command", icon: "calendar" },
  { id: "collections.open", group: "Quick Actions", label: "Open collections", kind: "command", icon: "table" },
  { id: "ai.open", group: "Quick Actions", label: "Open AI console", kind: "command", icon: "sparkles" },
  { id: "canvas.open", group: "Quick Actions", label: "Open canvas", hint: "Ctrl Shift C", kind: "command", icon: "layout" },
  { id: "graph.open", group: "Quick Actions", label: "Open graph", hint: "Ctrl G", kind: "command", icon: "sphere" },
  { id: "health.open", group: "Quick Actions", label: "Open vault health", kind: "command", icon: "shield" },
  { id: "plugins.open", group: "Quick Actions", label: "Open plugin marketplace", kind: "command", icon: "puzzle" },
  { id: "settings.permissions", group: "Settings", label: "Plugin permissions", kind: "setting", icon: "shield" },
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
  renameNote(oldPath: string, newPath: string) {
    return safeInvoke<FileNode>("rename_note", { oldPath, newPath });
  },
  deleteNote(path: string) {
    return safeInvoke<boolean>("delete_note", { path });
  },
  createFolder(path: string) {
    return safeInvoke<FileNode>("create_folder", { path });
  },
  readAssetDataUrl(path: string, basePath?: string | null) {
    return safeInvoke<string>("read_asset_data_url", { path, basePath });
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
    return safeInvoke<NoteContent>("convert_unlinked_mention", { sourcePath, targetPath, line });
  },
  search(query: string) {
    if (!query.trim()) return Promise.resolve<SearchResult[]>([]);
    return safeInvoke<SearchResult[]>("search", { query, options: {} });
  },
  async commandSearch(query: string) {
    try {
      const remote = await safeInvoke<CommandItem[]>("command_search", { query });
      return mergeCommands(coreCommands, remote);
    } catch {
      const normalized = query.toLowerCase();
      return coreCommands.filter((item) => !normalized || item.label.toLowerCase().includes(normalized));
    }
  },
  getVaultHealth() {
    return safeInvoke<VaultHealthReport>("get_vault_health");
  },
  listPlugins() {
    return safeInvoke<PluginInfo[]>("list_plugins");
  },
  installPluginFromFolder(path: string) {
    return safeInvoke<PluginInfo>("install_plugin_from_folder", { path });
  },
  enablePlugin(id: string) {
    return safeInvoke<boolean>("enable_plugin", { id });
  },
  disablePlugin(id: string) {
    return safeInvoke<boolean>("disable_plugin", { id });
  },
  updatePluginPermissions(id: string, permissions: PermissionGrant[]) {
    return safeInvoke<boolean>("update_plugin_permissions", { id, permissions });
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
};

function mergeCommands(local: CommandItem[], remote: CommandItem[]): CommandItem[] {
  const byId = new Map<string, CommandItem>();
  for (const item of [...local, ...remote]) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values());
}
