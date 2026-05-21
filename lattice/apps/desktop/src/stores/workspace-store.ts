import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EditorMode } from "@/types/domain";

export interface WorkspaceTab {
  id: string;
  path: string;
  pinned: boolean;
}

interface WorkspaceState {
  editorMode: EditorMode;
  focusMode: boolean;
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  recentlyClosed: Array<{ path: string; pinned: boolean }>;
  setEditorMode: (mode: EditorMode) => void;
  setFocusMode: (enabled: boolean) => void;
  openTab: (path: string, options?: { activate?: boolean; pinned?: boolean }) => void;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeTabsToRight: (id: string) => void;
  activateTab: (id: string) => void;
  pinTab: (id: string, pinned: boolean) => void;
  reorderTab: (id: string, toIndex: number) => void;
  reopenLastClosed: () => string | null;
  closeAllTabs: () => void;
  activeTabPath: () => string | null;
}

function nextId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      editorMode: "split",
      focusMode: false,
      tabs: [],
      activeTabId: null,
      recentlyClosed: [],
      setEditorMode: (editorMode) => set({ editorMode }),
      setFocusMode: (focusMode) => set({ focusMode }),
      openTab: (path, options) => {
        const activate = options?.activate !== false;
        const pinned = options?.pinned ?? false;
        const existing = get().tabs.find((tab) => tab.path === path);
        if (existing) {
          if (activate) set({ activeTabId: existing.id });
          return;
        }
        const tab: WorkspaceTab = { id: nextId(), path, pinned };
        set((state) => ({
          tabs: [...state.tabs, tab],
          activeTabId: activate ? tab.id : state.activeTabId,
        }));
      },
      closeTab: (id) => {
        const state = get();
        const idx = state.tabs.findIndex((tab) => tab.id === id);
        if (idx < 0) return;
        const closed = state.tabs[idx];
        const remaining = state.tabs.filter((tab) => tab.id !== id);
        let activeTabId = state.activeTabId;
        if (activeTabId === id) {
          const next = remaining[idx] ?? remaining[idx - 1] ?? null;
          activeTabId = next?.id ?? null;
        }
        set({
          tabs: remaining,
          activeTabId,
          recentlyClosed: [
            { path: closed.path, pinned: closed.pinned },
            ...state.recentlyClosed.slice(0, 9),
          ],
        });
      },
      closeOtherTabs: (id) => {
        const state = get();
        const keep = state.tabs.find((tab) => tab.id === id);
        if (!keep) return;
        const pinned = state.tabs.filter((tab) => tab.pinned && tab.id !== id);
        const toClose = state.tabs.filter((tab) => !tab.pinned && tab.id !== id);
        set({
          tabs: [...pinned, keep],
          activeTabId: id,
          recentlyClosed: [
            ...toClose.map((tab) => ({ path: tab.path, pinned: tab.pinned })),
            ...state.recentlyClosed,
          ].slice(0, 20),
        });
      },
      closeTabsToRight: (id) => {
        const state = get();
        const idx = state.tabs.findIndex((tab) => tab.id === id);
        if (idx < 0) return;
        const remaining = state.tabs.slice(0, idx + 1);
        const closed = state.tabs.slice(idx + 1);
        set({
          tabs: remaining,
          activeTabId: state.activeTabId && remaining.some((t) => t.id === state.activeTabId)
            ? state.activeTabId
            : id,
          recentlyClosed: [
            ...closed.map((tab) => ({ path: tab.path, pinned: tab.pinned })),
            ...state.recentlyClosed,
          ].slice(0, 20),
        });
      },
      activateTab: (id) => set({ activeTabId: id }),
      pinTab: (id, pinned) =>
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, pinned } : tab)),
        })),
      reorderTab: (id, toIndex) =>
        set((state) => {
          const fromIndex = state.tabs.findIndex((tab) => tab.id === id);
          if (fromIndex < 0) return state;
          const next = [...state.tabs];
          const [moved] = next.splice(fromIndex, 1);
          next.splice(Math.max(0, Math.min(next.length, toIndex)), 0, moved);
          return { tabs: next };
        }),
      reopenLastClosed: () => {
        const state = get();
        const [first, ...rest] = state.recentlyClosed;
        if (!first) return null;
        const tab: WorkspaceTab = { id: nextId(), path: first.path, pinned: first.pinned };
        set({
          tabs: [...state.tabs, tab],
          activeTabId: tab.id,
          recentlyClosed: rest,
        });
        return first.path;
      },
      closeAllTabs: () =>
        set((state) => ({
          tabs: state.tabs.filter((tab) => tab.pinned),
          activeTabId: state.tabs.find((tab) => tab.pinned)?.id ?? null,
          recentlyClosed: [
            ...state.tabs
              .filter((tab) => !tab.pinned)
              .map((tab) => ({ path: tab.path, pinned: tab.pinned })),
            ...state.recentlyClosed,
          ].slice(0, 20),
        })),
      activeTabPath: () => {
        const state = get();
        return state.tabs.find((tab) => tab.id === state.activeTabId)?.path ?? null;
      },
    }),
    {
      name: "lattice-workspace",
      version: 1,
      partialize: (state) => ({
        editorMode: state.editorMode,
        focusMode: state.focusMode,
        tabs: state.tabs,
        activeTabId: state.activeTabId,
      }),
    },
  ),
);
