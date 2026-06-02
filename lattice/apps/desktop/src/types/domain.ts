export type {
  Backlink,
  AiCliAdapterStatus,
  AiCliRunRequest,
  AiCliRunResult,
  CollectionItem,
  CollectionFilterOperator,
  CollectionPropertyFilter,
  CollectionQuery,
  CollectionSort,
  FileNode,
  GraphEdge,
  GraphFilters,
  GraphNode,
  GraphPayload,
  IndexPhase,
  IndexStatus,
  IndexingSummary,
  LinkMetadata,
  NoteContent,
  NoteMetadata,
  OutgoingLink,
  PermissionGrant,
  PluginCompatibilityLevel,
  PluginCompatibilityReport,
  PluginInfo,
  PluginManifest,
  PluginRuntimeBundle,
  SearchResult,
  TaskMetadata,
  TerminalAdapterStatus,
  TerminalExitEvent,
  TerminalOutputEvent,
  TerminalSessionInfo,
  UnlinkedMention,
  UnresolvedLink,
  VaultHealthReport,
  VaultInfo,
} from "@lattice/shared";

export type WorkspaceView =
  | "landing"
  | "workspace"
  | "collections"
  | "ai"
  | "canvas"
  | "graph"
  | "health"
  | "plugins"
  | "settings";

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
