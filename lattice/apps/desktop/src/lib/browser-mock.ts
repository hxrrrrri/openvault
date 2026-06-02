/**
 * Deterministic in-browser command provider.
 *
 * When the app runs under plain Vite (no Tauri runtime — e.g. `pnpm desktop:web`
 * or a hosted preview), there is no Rust backend to answer `invoke` calls. This
 * module stands in for that backend with a small, fully in-memory vault so every
 * panel (editor, graph, search, collections, plugins, health) renders real data
 * instead of throwing. It is intentionally simple and side-effect free; mutations
 * update the in-memory store so search/graph stay consistent within a session.
 *
 * This is NOT used in the packaged desktop app — see `safeInvoke` in `tauri.ts`,
 * which only falls back here when `isTauriRuntime()` is false.
 */

const NOW = "2026-06-01T12:00:00.000Z";

const seedNotes: Record<string, string> = {
  "Welcome.md":
    "# Welcome to LATTICE\n\nThis is a **browser preview** running without the desktop backend.\n\nExplore the [[Graph]] view and the [[Plugins]] system. #getting-started",
  "Graph.md":
    "# Graph\n\nThe graph connects notes via [[wikilinks]]. See also [[Welcome]]. #concept",
  "Plugins.md":
    "# Plugins\n\nLATTICE runs Obsidian-compatible plugins behind a permission model. #concept #security",
  "Daily/2026-06-01.md":
    "# 2026-06-01\n\n- [ ] Try the [[Graph]]\n- [x] Read [[Welcome]]\n\n#daily",
};

const store = new Map<string, string>(Object.entries(seedNotes));

const VAULT_PATH = "/preview/Lattice Vault";

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

function titleOf(path: string, content: string): string {
  const heading = content.match(/^#\s+(.+)$/m);
  if (heading) return heading[1].trim();
  return basename(path).replace(/\.md$/, "");
}

function wikilinksIn(content: string): string[] {
  const out: string[] = [];
  const re = /!?\[\[([^\]|#]+)(?:[^\]]*)?\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content))) out.push(match[1].trim());
  return out;
}

function tagsIn(content: string): string[] {
  const out = new Set<string>();
  const re = /(?:^|\s)#([a-zA-Z][\w/-]*)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content))) out.add(`#${match[1]}`);
  return [...out];
}

function resolveTarget(target: string): string | null {
  const direct = target.endsWith(".md") ? target : `${target}.md`;
  if (store.has(direct)) return direct;
  for (const path of store.keys()) {
    if (basename(path).replace(/\.md$/, "") === target) return path;
  }
  return null;
}

function vaultInfo() {
  const tags = new Set<string>();
  for (const content of store.values()) tagsIn(content).forEach((t) => tags.add(t));
  return {
    name: "Lattice Vault (preview)",
    path: VAULT_PATH,
    noteCount: store.size,
    tagCount: tags.size,
    indexedPercent: 100,
    hasObsidianConfig: false,
  };
}

function fileTree() {
  type Node = {
    id: string;
    path: string;
    name: string;
    kind: "file" | "folder";
    children?: Node[];
    isMarkdown?: boolean;
    modifiedAt?: string;
  };
  const folders = new Map<string, Node>();
  const roots: Node[] = [];
  const ensureFolder = (path: string): Node => {
    let folder = folders.get(path);
    if (!folder) {
      folder = {
        id: path,
        path,
        name: basename(path),
        kind: "folder",
        children: [],
      };
      folders.set(path, folder);
      const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
      if (parent) ensureFolder(parent).children!.push(folder);
      else roots.push(folder);
    }
    return folder;
  };
  for (const path of [...store.keys()].sort()) {
    const node: Node = {
      id: path,
      path,
      name: basename(path),
      kind: "file",
      isMarkdown: true,
      modifiedAt: NOW,
    };
    if (path.includes("/")) ensureFolder(path.slice(0, path.lastIndexOf("/"))).children!.push(node);
    else roots.push(node);
  }
  return roots;
}

function graphPayload() {
  const nodes = [...store.entries()].map(([path, content]) => ({
    id: path,
    path,
    title: titleOf(path, content),
    type: "note" as const,
    tags: tagsIn(content),
    degree: 0,
    isOrphan: false,
    isActive: false,
    lastModified: NOW,
  }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: Array<{
    id: string;
    source: string;
    target: string;
    type: "wikilink";
    weight: number;
  }> = [];
  for (const [path, content] of store.entries()) {
    for (const link of wikilinksIn(content)) {
      const target = resolveTarget(link);
      if (target) {
        edges.push({ id: `${path}->${target}`, source: path, target, type: "wikilink", weight: 1 });
        byId.get(path)!.degree += 1;
        byId.get(target)!.degree += 1;
      }
    }
  }
  for (const node of nodes) node.isOrphan = node.degree === 0;
  return { nodes, edges };
}

function search(query: string) {
  const q = query.toLowerCase().replace(/^(line|block|section):\(?|\)?$/g, "").trim();
  if (!q) return [];
  return [...store.entries()]
    .filter(([path, content]) => `${path}\n${content}`.toLowerCase().includes(q))
    .map(([path, content]) => ({
      path,
      title: titleOf(path, content),
      excerpt: content.split("\n").find((l) => l.toLowerCase().includes(q)) ?? content.slice(0, 120),
      score: 1,
      kind: "note" as const,
    }));
}

function noteContent(path: string) {
  const content = store.get(path) ?? "";
  return {
    path,
    title: titleOf(path, content),
    content,
    modifiedAt: NOW,
    wordCount: content.split(/\s+/).filter(Boolean).length,
  };
}

function completedIndexStatus() {
  return {
    phase: "completed",
    processed: store.size,
    total: store.size,
    message: "Index up to date (preview)",
    error: null,
    stale: false,
    lastSummary: {
      scannedFiles: store.size,
      indexedFiles: store.size,
      skippedFiles: 0,
      createdFiles: store.size,
      updatedFiles: 0,
      deletedFiles: 0,
      errors: [],
      durationMs: 1,
    },
  };
}

/** Route a command to the in-memory provider. Resolves to mock data or `null`. */
export async function mockInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const a = (args ?? {}) as Record<string, unknown>;
  const result: unknown = (() => {
    switch (command) {
      case "bootstrap_vault":
      case "create_vault":
      case "open_vault":
      case "get_vault_state":
        return vaultInfo();
      case "get_indexing_status":
        return completedIndexStatus();
      case "scan_vault":
      case "reindex_vault":
      case "rebuild_index":
        return completedIndexStatus().lastSummary;
      case "start_indexing":
      case "cancel_indexing":
      case "watch_vault":
        return true;
      case "list_files":
        return fileTree();
      case "list_tags": {
        const tags = new Set<string>();
        for (const content of store.values()) tagsIn(content).forEach((t) => tags.add(t));
        return [...tags].sort();
      }
      case "read_note":
        return noteContent(String(a.path));
      case "write_note": {
        store.set(String(a.path), String(a.content ?? ""));
        return true;
      }
      case "create_note": {
        const path = String(a.path);
        if (!store.has(path)) store.set(path, String(a.content ?? `# ${titleOf(path, "")}\n`));
        return { id: path, path, name: basename(path), kind: "file", isMarkdown: true };
      }
      case "rename_note": {
        const oldPath = String(a.oldPath);
        const newPath = String(a.newPath);
        if (store.has(oldPath)) {
          store.set(newPath, store.get(oldPath)!);
          store.delete(oldPath);
        }
        return { id: newPath, path: newPath, name: basename(newPath), kind: "file", isMarkdown: true };
      }
      case "delete_note":
        store.delete(String(a.path));
        return true;
      case "create_folder":
        return { id: String(a.path), path: String(a.path), name: basename(String(a.path)), kind: "folder", children: [] };
      case "get_note_metadata": {
        const path = String(a.path);
        const content = store.get(path) ?? "";
        return {
          path,
          title: titleOf(path, content),
          headings: [],
          links: wikilinksIn(content).map((targetText) => ({
            targetText,
            resolvedPath: resolveTarget(targetText),
            linkType: "wikilink",
            line: 0,
            column: 0,
          })),
          tags: tagsIn(content),
          properties: {},
          tasks: [],
          wordCount: content.split(/\s+/).filter(Boolean).length,
          lineCount: content.split("\n").length,
          excerpt: content.slice(0, 120),
        };
      }
      case "get_global_graph":
        return graphPayload();
      case "get_local_graph":
        return graphPayload();
      case "get_backlinks": {
        const target = String(a.path);
        const targetBase = basename(target).replace(/\.md$/, "");
        return [...store.entries()]
          .filter(([, content]) => wikilinksIn(content).includes(targetBase))
          .map(([path, content]) => ({
            sourcePath: path,
            sourceTitle: titleOf(path, content),
            excerpt: content.slice(0, 120),
            line: 0,
          }));
      }
      case "get_outgoing_links": {
        const content = store.get(String(a.path)) ?? "";
        return wikilinksIn(content).map((targetText) => ({
          targetText,
          resolvedPath: resolveTarget(targetText),
          linkType: "wikilink",
          line: 0,
        }));
      }
      case "get_unresolved_links":
      case "get_unlinked_mentions":
        return [];
      case "search":
        return search(String(a.query ?? ""));
      case "command_search":
        return [];
      case "get_vault_health": {
        const graph = graphPayload();
        return {
          score: 92,
          totalNotes: store.size,
          totalLinks: graph.edges.length,
          orphanNotes: graph.nodes.filter((n) => n.isOrphan).length,
          brokenLinks: 0,
          staleNotes: 0,
          notesWithoutTags: 0,
          duplicateTitles: [],
          mostConnected: graph.nodes
            .slice()
            .sort((x, y) => y.degree - x.degree)
            .slice(0, 5)
            .map((n) => ({ title: n.title, path: n.path, links: n.degree })),
          suggestions: [
            {
              title: "Browser preview",
              body: "This vault is in-memory. Launch the desktop app for a real vault.",
              severity: "info",
            },
          ],
        };
      }
      case "get_permission_audit_log":
        return [];
      case "read_plugin_secret":
        return null;
      case "write_plugin_secret":
        return true;
      case "list_plugins":
      case "list_obsidian_community_plugins":
      case "list_ai_cli_adapters":
      case "list_terminal_adapters":
      case "list_terminal_sessions":
      case "list_collection_items":
        return [];
      default:
        return null;
    }
  })();
  return result as T;
}
