import { create } from "zustand";
import type { SerializedObsidianElement } from "@/features/plugins/obsidian-runtime";

export interface PluginRibbonContribution {
  id: string;
  pluginId: string;
  icon: string;
  title: string;
}

export interface PluginStatusContribution {
  id: string;
  pluginId: string;
  text: string;
  element?: SerializedObsidianElement;
  containerEl?: HTMLElement;
}

export interface PluginSettingContribution {
  id: string;
  pluginId: string;
  name: string;
  element?: SerializedObsidianElement;
  containerEl?: HTMLElement;
}

export interface PluginNoticeContribution {
  id: string;
  pluginId: string;
  message: string;
  timeout: number;
  createdAt: number;
}

interface PluginUIState {
  ribbonItems: PluginRibbonContribution[];
  statusItems: PluginStatusContribution[];
  settingTabs: PluginSettingContribution[];
  notices: PluginNoticeContribution[];
  registerRibbonItem: (item: PluginRibbonContribution) => void;
  removeRibbonItem: (id: string) => void;
  upsertStatusItem: (item: PluginStatusContribution) => void;
  removeStatusItem: (id: string) => void;
  upsertSettingTab: (item: PluginSettingContribution) => void;
  removeSettingTab: (id: string) => void;
  pushNotice: (notice: Omit<PluginNoticeContribution, "id" | "createdAt">) => string;
  dismissNotice: (id: string) => void;
  clearPluginContributions: (pluginId: string) => void;
}

export const usePluginUIStore = create<PluginUIState>((set) => ({
  ribbonItems: [],
  statusItems: [],
  settingTabs: [],
  notices: [],
  registerRibbonItem: (item) =>
    set((state) => ({
      ribbonItems: [...state.ribbonItems.filter((existing) => existing.id !== item.id), item],
    })),
  removeRibbonItem: (id) =>
    set((state) => ({
      ribbonItems: state.ribbonItems.filter((item) => item.id !== id),
    })),
  upsertStatusItem: (item) =>
    set((state) => ({
      statusItems: [...state.statusItems.filter((existing) => existing.id !== item.id), item],
    })),
  removeStatusItem: (id) =>
    set((state) => ({
      statusItems: state.statusItems.filter((item) => item.id !== id),
    })),
  upsertSettingTab: (item) =>
    set((state) => ({
      settingTabs: [...state.settingTabs.filter((existing) => existing.id !== item.id), item],
    })),
  removeSettingTab: (id) =>
    set((state) => ({
      settingTabs: state.settingTabs.filter((item) => item.id !== id),
    })),
  pushNotice: (notice) => {
    const id = `${notice.pluginId}:notice:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    set((state) => ({
      notices: [...state.notices, { ...notice, id, createdAt: Date.now() }].slice(-6),
    }));
    return id;
  },
  dismissNotice: (id) =>
    set((state) => ({
      notices: state.notices.filter((notice) => notice.id !== id),
    })),
  clearPluginContributions: (pluginId) =>
    set((state) => ({
      ribbonItems: state.ribbonItems.filter((item) => item.pluginId !== pluginId),
      statusItems: state.statusItems.filter((item) => item.pluginId !== pluginId),
      settingTabs: state.settingTabs.filter((item) => item.pluginId !== pluginId),
      notices: state.notices.filter((notice) => notice.pluginId !== pluginId),
    })),
}));
