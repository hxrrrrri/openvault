import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BookmarkTarget =
  | { kind: "note"; path: string; alias?: string }
  | { kind: "heading"; path: string; heading: string }
  | { kind: "block"; path: string; blockId: string }
  | { kind: "search"; query: string; alias?: string }
  | { kind: "folder"; path: string };

export interface BookmarkEntry {
  id: string;
  target: BookmarkTarget;
  group?: string;
  addedAt: string;
}

interface BookmarksState {
  entries: BookmarkEntry[];
  groups: string[];
  add: (target: BookmarkTarget, group?: string) => void;
  remove: (id: string) => void;
  rename: (id: string, alias: string) => void;
  moveToGroup: (id: string, group: string | undefined) => void;
  reorder: (id: string, toIndex: number) => void;
  createGroup: (name: string) => void;
  deleteGroup: (name: string) => void;
}

function bookmarkId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function legacyEntries(): BookmarkEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("lattice.bookmarks");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{ path?: string }>;
    return parsed
      .filter((entry): entry is { path: string } => Boolean(entry.path))
      .map((entry) => ({
        id: bookmarkId(),
        addedAt: new Date().toISOString(),
        target: { kind: "note", path: entry.path } as BookmarkTarget,
      }));
  } catch {
    return [];
  }
}

export const useBookmarksStore = create<BookmarksState>()(
  persist(
    (set, get) => ({
      entries: legacyEntries(),
      groups: [],
      add: (target, group) => {
        const exists = get().entries.some((entry) => sameTarget(entry.target, target));
        if (exists) return;
        const entry: BookmarkEntry = {
          id: bookmarkId(),
          target,
          group,
          addedAt: new Date().toISOString(),
        };
        set((state) => ({ entries: [...state.entries, entry] }));
      },
      remove: (id) => set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) })),
      rename: (id, alias) =>
        set((state) => ({
          entries: state.entries.map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  target:
                    entry.target.kind === "note" || entry.target.kind === "search"
                      ? { ...entry.target, alias }
                      : entry.target,
                }
              : entry,
          ),
        })),
      moveToGroup: (id, group) =>
        set((state) => ({
          entries: state.entries.map((entry) => (entry.id === id ? { ...entry, group } : entry)),
        })),
      reorder: (id, toIndex) =>
        set((state) => {
          const fromIndex = state.entries.findIndex((entry) => entry.id === id);
          if (fromIndex < 0) return state;
          const next = [...state.entries];
          const [moved] = next.splice(fromIndex, 1);
          next.splice(Math.max(0, Math.min(next.length, toIndex)), 0, moved);
          return { entries: next };
        }),
      createGroup: (name) =>
        set((state) => (state.groups.includes(name) ? state : { groups: [...state.groups, name] })),
      deleteGroup: (name) =>
        set((state) => ({
          groups: state.groups.filter((g) => g !== name),
          entries: state.entries.map((entry) =>
            entry.group === name ? { ...entry, group: undefined } : entry,
          ),
        })),
    }),
    {
      name: "lattice-bookmarks",
      version: 1,
    },
  ),
);

function sameTarget(a: BookmarkTarget, b: BookmarkTarget): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "note" && b.kind === "note") return a.path === b.path;
  if (a.kind === "folder" && b.kind === "folder") return a.path === b.path;
  if (a.kind === "search" && b.kind === "search") return a.query === b.query;
  if (a.kind === "heading" && b.kind === "heading") return a.path === b.path && a.heading === b.heading;
  if (a.kind === "block" && b.kind === "block") return a.path === b.path && a.blockId === b.blockId;
  return false;
}

export function bookmarkLabel(entry: BookmarkEntry): string {
  const t = entry.target;
  if (t.kind === "note") return t.alias ?? t.path.split("/").pop()?.replace(/\.md$/i, "") ?? t.path;
  if (t.kind === "folder") return t.path.split("/").pop() ?? t.path;
  if (t.kind === "heading") return `${t.path.split("/").pop()?.replace(/\.md$/i, "")} # ${t.heading}`;
  if (t.kind === "block") return `${t.path.split("/").pop()?.replace(/\.md$/i, "")} ^${t.blockId}`;
  return t.alias ?? `🔎 ${t.query}`;
}
