import { commands } from "@/lib/commands";
import { formatLink } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";
import { useVaultStore } from "@/stores/vault-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { resolveNewNoteFolder } from "@/app/shortcuts";
import type { FileNode } from "@/types/domain";

const TEMPLATE_FOLDER_DEFAULT = "Templates";

export async function runRandomNote(): Promise<string | null> {
  const files = collectMarkdownFiles(useVaultStore.getState().files);
  if (!files.length) return null;
  const target = files[Math.floor(Math.random() * files.length)];
  await useVaultStore.getState().setActivePath(target.path);
  return target.path;
}

export async function runUniqueNote(): Promise<string> {
  const folder = resolveNewNoteFolder();
  const base = folder ? `${folder}/` : "";
  const id = uniqueId();
  const path = `${base}${id} Untitled.md`;
  await useVaultStore.getState().createNote(path);
  return path;
}

export async function listTemplates(): Promise<FileNode[]> {
  const files = collectMarkdownFiles(useVaultStore.getState().files);
  const folder = TEMPLATE_FOLDER_DEFAULT.toLowerCase();
  return files.filter((file) => file.path.toLowerCase().startsWith(`${folder}/`));
}

export async function insertTemplate(path: string): Promise<boolean> {
  const note = useVaultStore.getState().activeNote;
  if (!note) return false;
  const template = await commands.readNote(path);
  const rendered = renderTemplateTokens(template.content);
  const next = `${note.content.replace(/\n*$/, "\n")}${rendered}\n`;
  useVaultStore.getState().updateActiveContent(next);
  return true;
}

export function reopenClosedTab(): string | null {
  const path = useWorkspaceStore.getState().reopenLastClosed();
  if (path) void useVaultStore.getState().setActivePath(path);
  return path;
}

export function closeActiveTab(): void {
  const state = useWorkspaceStore.getState();
  if (!state.activeTabId) return;
  state.closeTab(state.activeTabId);
  const next = useWorkspaceStore.getState().activeTabId;
  const nextPath = useWorkspaceStore.getState().tabs.find((t) => t.id === next)?.path ?? null;
  if (nextPath) void useVaultStore.getState().setActivePath(nextPath);
}

const SAVED_WORKSPACES_KEY = "lattice.workspaces";

export interface SavedWorkspace {
  name: string;
  tabs: Array<{ path: string; pinned: boolean }>;
  activeTabPath: string | null;
  savedAt: string;
}

export function listSavedWorkspaces(): SavedWorkspace[] {
  try {
    const raw = window.localStorage.getItem(SAVED_WORKSPACES_KEY);
    return raw ? (JSON.parse(raw) as SavedWorkspace[]) : [];
  } catch {
    return [];
  }
}

export function saveCurrentWorkspace(name: string): SavedWorkspace {
  const state = useWorkspaceStore.getState();
  const active = state.tabs.find((t) => t.id === state.activeTabId);
  const workspace: SavedWorkspace = {
    name,
    tabs: state.tabs.map((tab) => ({ path: tab.path, pinned: tab.pinned })),
    activeTabPath: active?.path ?? null,
    savedAt: new Date().toISOString(),
  };
  const all = listSavedWorkspaces().filter((entry) => entry.name !== name);
  all.push(workspace);
  window.localStorage.setItem(SAVED_WORKSPACES_KEY, JSON.stringify(all));
  return workspace;
}

export function loadWorkspace(name: string): boolean {
  const found = listSavedWorkspaces().find((entry) => entry.name === name);
  if (!found) return false;
  const store = useWorkspaceStore.getState();
  store.closeAllTabs();
  for (const tab of found.tabs) {
    store.openTab(tab.path, { activate: false, pinned: tab.pinned });
  }
  if (found.activeTabPath) {
    const id = useWorkspaceStore.getState().tabs.find((t) => t.path === found.activeTabPath)?.id;
    if (id) store.activateTab(id);
    void useVaultStore.getState().setActivePath(found.activeTabPath);
  }
  return true;
}

export function deleteWorkspace(name: string): void {
  const all = listSavedWorkspaces().filter((entry) => entry.name !== name);
  window.localStorage.setItem(SAVED_WORKSPACES_KEY, JSON.stringify(all));
}

export async function convertLinksGlobally(direction: "wikilink-to-markdown" | "markdown-to-wikilink"): Promise<number> {
  const files = collectMarkdownFiles(useVaultStore.getState().files);
  let count = 0;
  const linkFormat = direction === "wikilink-to-markdown" ? "markdown" : "wikilink";
  for (const file of files) {
    const note = await commands.readNote(file.path);
    let next = note.content;
    if (direction === "wikilink-to-markdown") {
      next = next.replace(/(!?)\[\[([^\]\n]+?)\]\]/g, (_match, embed, inner: string) => {
        const [target, alias] = inner.split("|").map((part) => part.trim());
        const resolved = `${target.split("#")[0]}.md`;
        return `${embed}${formatLink(resolved, "markdown", alias)}`;
      });
    } else {
      next = next.replace(/(!?)\[([^\]]+)\]\(([^)]+\.md)\)/g, (_match, embed, alias: string, target: string) => {
        return `${embed}${formatLink(target, "wikilink", alias)}`;
      });
    }
    if (next !== note.content) {
      await commands.writeNote(file.path, next);
      count += 1;
    }
  }
  void linkFormat;
  await useVaultStore.getState().refreshFiles();
  return count;
}

function uniqueId(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function collectMarkdownFiles(nodes: FileNode[]): FileNode[] {
  const out: FileNode[] = [];
  const visit = (items: FileNode[]) => {
    for (const item of items) {
      if (item.kind === "file" && item.isMarkdown) out.push(item);
      if (item.children) visit(item.children);
    }
  };
  visit(nodes);
  return out;
}

function renderTemplateTokens(template: string): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5);
  const title = useVaultStore.getState().activeNote?.title.replace(/\.md$/i, "") ?? "";
  return template
    .replace(/\{\{date(?::([^}]+))?\}\}/g, (_match, fmt: string | undefined) => (fmt ? formatDate(now, fmt) : date))
    .replace(/\{\{time(?::([^}]+))?\}\}/g, (_match, fmt: string | undefined) => (fmt ? formatTime(now, fmt) : time))
    .replace(/\{\{title\}\}/g, title);
}

function formatDate(date: Date, fmt: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return fmt
    .replace(/YYYY/g, String(date.getFullYear()))
    .replace(/MM/g, pad(date.getMonth() + 1))
    .replace(/DD/g, pad(date.getDate()));
}

function formatTime(date: Date, fmt: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return fmt.replace(/HH/g, pad(date.getHours())).replace(/mm/g, pad(date.getMinutes()));
}

// Settings reference (not yet used to vary behavior — placeholder for future).
void useSettingsStore;
