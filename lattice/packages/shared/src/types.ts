export type FileKind = "file" | "folder";

export interface FileNode {
  id: string;
  path: string;
  name: string;
  kind: FileKind;
  children?: FileNode[];
  size?: number;
  modifiedAt?: string;
  isMarkdown?: boolean;
}

export interface VaultInfo {
  name: string;
  path: string;
  noteCount: number;
  tagCount: number;
  indexedPercent: number;
  hasObsidianConfig: boolean;
}

export interface NoteContent {
  path: string;
  title: string;
  content: string;
  modifiedAt: string;
  wordCount: number;
}

export interface NoteMetadata {
  path: string;
  title: string;
  headings: Heading[];
  links: LinkMetadata[];
  tags: string[];
  properties: Record<string, unknown>;
  tasks: TaskMetadata[];
  wordCount: number;
  lineCount: number;
  excerpt: string;
}

export interface Heading {
  level: number;
  text: string;
  slug: string;
  lineStart: number;
  lineEnd: number;
}

export type LinkType = "wikilink" | "markdown" | "embed";

export interface LinkMetadata {
  targetText: string;
  resolvedPath?: string | null;
  linkType: LinkType;
  displayText?: string | null;
  line: number;
  column: number;
}

export interface OutgoingLink {
  targetText: string;
  resolvedPath?: string | null;
  linkType: string;
  line: number;
}

export interface UnresolvedLink {
  sourcePath: string;
  targetText: string;
  line: number;
}

export interface TaskMetadata {
  text: string;
  completed: boolean;
  line: number;
  blockId?: string | null;
  dueDate?: string | null;
  priority?: string | null;
}

export interface GraphNode {
  id: string;
  path: string;
  title: string;
  type: "note" | "tag" | "folder";
  tags: string[];
  degree: number;
  isOrphan: boolean;
  isActive: boolean;
  lastModified: string;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: "wikilink" | "markdown" | "semantic";
  weight: number;
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphFilters {
  tags?: string[];
  folders?: string[];
  includeOrphans?: boolean;
  depth?: number;
}

export interface Backlink {
  sourcePath: string;
  sourceTitle: string;
  excerpt: string;
  line: number;
}

export interface UnlinkedMention {
  sourcePath: string;
  sourceTitle: string;
  excerpt: string;
  line: number;
  matchText: string;
}

export interface SearchResult {
  path: string;
  title: string;
  excerpt: string;
  score: number;
  kind: "note" | "tag" | "command" | "plugin";
}

export interface CollectionQuery {
  folder?: string | null;
  text?: string | null;
}

export interface CollectionItem {
  path: string;
  title: string;
  excerpt: string;
  properties: Record<string, unknown>;
  tags: string[];
  modifiedAt: string;
  wordCount: number;
}

export interface AiCliAdapterStatus {
  id: string;
  label: string;
  available: boolean;
  command: string;
  installHint: string;
}

export interface AiCliRunRequest {
  adapterId: string;
  prompt: string;
  model?: string | null;
}

export interface AiCliRunResult {
  adapterId: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  elapsedMs: number;
}

export interface VaultHealthReport {
  score: number;
  totalNotes: number;
  totalLinks: number;
  orphanNotes: number;
  brokenLinks: number;
  staleNotes: number;
  notesWithoutTags: number;
  duplicateTitles: string[];
  mostConnected: Array<{ title: string; path: string; links: number }>;
  suggestions: Array<{ title: string; body: string; severity: "info" | "warning" | "danger" }>;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  permissions: Record<string, string[]>;
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  installedPath: string;
  manifest: PluginManifest;
  grantedPermissions: PermissionGrant[];
}

export interface PermissionGrant {
  permission: string;
  granted: boolean;
  lastUsedAt?: string | null;
}
