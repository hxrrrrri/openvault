export type {
  Backlink,
  AiCliAdapterStatus,
  AiCliRunRequest,
  AiCliRunResult,
  CollectionItem,
  CollectionQuery,
  FileNode,
  GraphEdge,
  GraphFilters,
  GraphNode,
  GraphPayload,
  LinkMetadata,
  NoteContent,
  NoteMetadata,
  OutgoingLink,
  PermissionGrant,
  PluginInfo,
  PluginManifest,
  SearchResult,
  TaskMetadata,
  UnlinkedMention,
  UnresolvedLink,
  VaultHealthReport,
  VaultInfo,
} from "@lattice/shared";

export type WorkspaceView = "workspace" | "collections" | "ai" | "canvas" | "graph" | "health" | "plugins" | "settings";

export type EditorMode = "edit" | "preview" | "split";

export interface CommandItem {
  id: string;
  group: string;
  label: string;
  hint?: string;
  kind: "command" | "note" | "tag" | "plugin" | "setting";
  icon?: string;
  path?: string;
  score?: number;
}
