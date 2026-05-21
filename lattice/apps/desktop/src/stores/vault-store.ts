import { create } from "zustand";
import type { FileNode, NoteContent, VaultInfo } from "@/types/domain";
import { commands } from "@/lib/commands";
import { useWorkspaceStore } from "@/stores/workspace-store";

const LAST_VAULT_KEY = "lattice.lastVaultPath";

interface VaultState {
  vault: VaultInfo | null;
  files: FileNode[];
  tags: string[];
  activePath: string | null;
  activeNote: NoteContent | null;
  initialized: boolean;
  loading: boolean;
  saving: boolean;
  lastSavedAt: string | null;
  error: string | null;
  initialize: () => Promise<void>;
  setActivePath: (path: string) => Promise<void>;
  openVault: (path: string) => Promise<void>;
  createVault: (path: string) => Promise<void>;
  refreshFiles: () => Promise<void>;
  updateActiveContent: (content: string) => void;
  saveActiveNote: () => Promise<void>;
  createNote: (path: string, content?: string) => Promise<void>;
  createFolder: (path: string) => Promise<void>;
  openLinkedNote: (target: string) => Promise<void>;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  vault: null,
  files: [],
  tags: [],
  activePath: null,
  activeNote: null,
  initialized: false,
  loading: false,
  saving: false,
  lastSavedAt: null,
  error: null,
  async initialize() {
    if (get().initialized || get().loading) return;
    set({ loading: true, error: null });
    try {
      const savedPath = readLastVaultPath();
      const vault = savedPath ? await commands.openVault(savedPath).catch(() => commands.bootstrapVault()) : await commands.bootstrapVault();
      rememberVaultPath(vault.path);
      const files = await commands.listFiles();
      const tags = await commands.listTags().catch(() => []);
      set({ vault, files, tags, loading: false, initialized: true });
      const firstNote = firstMarkdownPath(files);
      if (firstNote) {
        await get().setActivePath(firstNote);
      } else {
        set({ activePath: null, activeNote: null });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Could not initialize a local vault",
        loading: false,
        initialized: true,
      });
    }
  },
  async setActivePath(path) {
    set({ loading: true, activePath: path, error: null });
    useWorkspaceStore.getState().openTab(path, { activate: true });
    try {
      const note = await commands.readNote(path);
      set({ activeNote: note, loading: false });
    } catch (error) {
      set({
        activeNote: null,
        loading: false,
        error: error instanceof Error ? error.message : `Could not open ${path}`,
      });
    }
  },
  async openVault(path) {
    set({ loading: true, error: null });
    const vault = await commands.openVault(path);
    rememberVaultPath(vault.path);
    const files = await commands.listFiles();
    const tags = await commands.listTags().catch(() => []);
    set({ vault, files, tags, loading: false, initialized: true, activePath: null, activeNote: null });
    const firstNote = firstMarkdownPath(files);
    if (firstNote) await get().setActivePath(firstNote);
  },
  async createVault(path) {
    set({ loading: true, error: null });
    const vault = await commands.createVault(path);
    rememberVaultPath(vault.path);
    const files = await commands.listFiles();
    const tags = await commands.listTags().catch(() => []);
    set({ vault, files, tags, loading: false, initialized: true, activePath: null, activeNote: null });
  },
  async refreshFiles() {
    const [files, tags, vault] = await Promise.all([
      commands.listFiles(),
      commands.listTags().catch(() => []),
      commands.getVaultState().catch(() => get().vault),
    ]);
    set({ files, tags, vault });
  },
  updateActiveContent(content) {
    const activeNote = get().activeNote;
    if (!activeNote) return;
    set({
      activeNote: {
        ...activeNote,
        content,
        wordCount: content.trim().match(/\b[\p{L}\p{N}'-]+\b/gu)?.length ?? 0,
      },
    });
  },
  async saveActiveNote() {
    const activeNote = get().activeNote;
    if (!activeNote) return;
    set({ saving: true });
    await commands.writeNote(activeNote.path, activeNote.content);
    set({ saving: false, lastSavedAt: new Date().toISOString() });
    await get().refreshFiles();
  },
  async createNote(path, content) {
    const file = await commands.createNote(path, content);
    await get().refreshFiles();
    await get().setActivePath(file.path);
  },
  async createFolder(path) {
    await commands.createFolder(path);
    await get().refreshFiles();
  },
  async openLinkedNote(target) {
    const cleanTarget = normalizeWikiTarget(target);
    if (!cleanTarget) return;
    const notePath = findNotePath(get().files, cleanTarget);
    if (notePath) {
      await get().setActivePath(notePath);
      return;
    }
    const path = ensureMarkdownPath(sanitizeNotePath(cleanTarget));
    await get().createNote(path);
  },
}));

function readLastVaultPath(): string | null {
  try {
    return window.localStorage.getItem(LAST_VAULT_KEY);
  } catch {
    return null;
  }
}

function rememberVaultPath(path: string) {
  try {
    window.localStorage.setItem(LAST_VAULT_KEY, path);
  } catch {}
}

function normalizeWikiTarget(target: string): string {
  return target
    .split("#")[0]
    .split("|")[0]
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
}

function ensureMarkdownPath(path: string): string {
  return path.toLowerCase().endsWith(".md") ? path : `${path}.md`;
}

function sanitizeNotePath(path: string): string {
  const sanitized = path
    .split("/")
    .map((part) => part.replace(/[<>:"|?*]/g, "").trim())
    .filter(Boolean)
    .join("/");
  return sanitized || `Untitled ${Date.now()}`;
}

function firstMarkdownPath(files: FileNode[]): string | null {
  return flattenFiles(files).find((file) => file.kind === "file" && file.isMarkdown)?.path ?? null;
}

function findNotePath(files: FileNode[], target: string): string | null {
  const normalized = normalizeComparable(target);
  const markdown = normalizeComparable(ensureMarkdownPath(target));
  for (const file of flattenFiles(files)) {
    if (file.kind !== "file" || !file.isMarkdown) continue;
    const path = normalizeComparable(file.path);
    const basename = normalizeComparable(file.name.replace(/\.md$/i, ""));
    if (path === normalized || path === markdown || basename === normalized) {
      return file.path;
    }
  }
  return null;
}

function flattenFiles(files: FileNode[]): FileNode[] {
  return files.flatMap((file) => [file, ...(file.children ? flattenFiles(file.children) : [])]);
}

function normalizeComparable(value: string): string {
  return value.replace(/\\/g, "/").replace(/\.md$/i, "").toLowerCase();
}
