import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EditorMode } from "@/types/domain";

export type PropertiesDisplay = "visible" | "hidden" | "source";
export type LinkFormat = "wikilink" | "markdown";
export type TrashStrategy = "system" | "app" | "permanent";
export type LabelMode = "auto" | "all" | "none";
export type ReleaseChannel = "stable" | "beta" | "nightly";

export interface EditorSettings {
  defaultMode: EditorMode;
  readableLineLength: boolean;
  lineNumbers: boolean;
  lineWrapping: boolean;
  spellCheck: boolean;
  autoPairMarkdown: boolean;
  smartListIndent: boolean;
  indentWithTabs: boolean;
  tabSize: number;
  propertiesDisplay: PropertiesDisplay;
}

export interface FilesSettings {
  confirmDelete: boolean;
  trashStrategy: TrashStrategy;
  updateLinksOnRename: boolean;
  defaultNoteLocation: "vault" | "same-folder" | "inbox";
  linkFormat: LinkFormat;
  attachmentFolder: string;
  excludedPatterns: string;
}

export interface AppearanceSettings {
  uiScale: number;
  accent: "violet" | "indigo" | "emerald" | "amber";
  density: "comfortable" | "compact";
}

export interface GraphSettings {
  labelMode: LabelMode;
  showArrows: boolean;
  nodeScale: number;
  edgeScale: number;
}

export interface SearchSettings {
  exactPhraseByQuotes: boolean;
  includeContext: boolean;
  semanticSearch: boolean;
  maxResults: number;
}

export interface AppSettings {
  autoUpdates: boolean;
  language: string;
  releaseChannel: ReleaseChannel;
  telemetry: boolean;
  portableMode: boolean;
}

interface SettingsState {
  app: AppSettings;
  appearance: AppearanceSettings;
  editor: EditorSettings;
  files: FilesSettings;
  graph: GraphSettings;
  search: SearchSettings;
  setApp: (settings: Partial<AppSettings>) => void;
  setAppearance: (settings: Partial<AppearanceSettings>) => void;
  setEditor: (settings: Partial<EditorSettings>) => void;
  setFiles: (settings: Partial<FilesSettings>) => void;
  setGraph: (settings: Partial<GraphSettings>) => void;
  setSearch: (settings: Partial<SearchSettings>) => void;
  resetSettings: () => void;
}

const defaults = {
  app: {
    autoUpdates: true,
    language: "en",
    releaseChannel: "nightly" as ReleaseChannel,
    telemetry: false,
    portableMode: false,
  },
  appearance: {
    uiScale: 100,
    accent: "violet" as const,
    density: "comfortable" as const,
  },
  editor: {
    defaultMode: "split" as EditorMode,
    readableLineLength: true,
    lineNumbers: true,
    lineWrapping: true,
    spellCheck: true,
    autoPairMarkdown: true,
    smartListIndent: true,
    indentWithTabs: false,
    tabSize: 2,
    propertiesDisplay: "visible" as PropertiesDisplay,
  },
  files: {
    confirmDelete: true,
    trashStrategy: "app" as TrashStrategy,
    updateLinksOnRename: true,
    defaultNoteLocation: "same-folder" as const,
    linkFormat: "wikilink" as LinkFormat,
    attachmentFolder: "Attachments",
    excludedPatterns: ".lattice/**, .obsidian/**, _Templates/**",
  },
  graph: {
    labelMode: "auto" as LabelMode,
    showArrows: true,
    nodeScale: 1,
    edgeScale: 1,
  },
  search: {
    exactPhraseByQuotes: true,
    includeContext: true,
    semanticSearch: false,
    maxResults: 50,
  },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      setApp: (settings) => set((state) => ({ app: { ...state.app, ...settings } })),
      setAppearance: (settings) => set((state) => ({ appearance: { ...state.appearance, ...settings } })),
      setEditor: (settings) => set((state) => ({ editor: { ...state.editor, ...settings } })),
      setFiles: (settings) => set((state) => ({ files: { ...state.files, ...settings } })),
      setGraph: (settings) => set((state) => ({ graph: { ...state.graph, ...settings } })),
      setSearch: (settings) => set((state) => ({ search: { ...state.search, ...settings } })),
      resetSettings: () => set(defaults),
    }),
    {
      name: "lattice-settings",
      version: 1,
    },
  ),
);
