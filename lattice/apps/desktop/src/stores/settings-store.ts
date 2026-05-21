import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EditorMode } from "@/types/domain";

export type PropertiesDisplay = "visible" | "hidden" | "source";
export type LinkFormat = "wikilink" | "markdown";
export type TrashStrategy = "system" | "app" | "permanent";
export type LabelMode = "auto" | "all" | "none";
export type ReleaseChannel = "stable" | "beta" | "nightly";
export type DefaultEditingMode = "live-preview" | "source";
export type AttachmentDeletePolicy = "ask" | "always" | "never";
export type DefaultNoteLocation = "vault" | "same-folder" | "inbox" | "custom";

export interface EditorSettings {
  defaultMode: EditorMode;
  defaultEditingMode: DefaultEditingMode;
  showInlineTitle: boolean;
  showEditorStatus: boolean;
  readableLineLength: boolean;
  strictLineBreaks: boolean;
  foldHeading: boolean;
  foldIndent: boolean;
  showIndentationGuides: boolean;
  rtl: boolean;
  lineNumbers: boolean;
  lineWrapping: boolean;
  spellCheck: boolean;
  spellcheckLanguages: string[];
  autoPairBrackets: boolean;
  autoPairMarkdown: boolean;
  smartListIndent: boolean;
  indentWithTabs: boolean;
  tabSize: number;
  autoConvertHtml: boolean;
  vimMode: boolean;
  propertiesDisplay: PropertiesDisplay;
}

export interface FilesSettings {
  confirmDelete: boolean;
  trashStrategy: TrashStrategy;
  attachmentDeletePolicy: AttachmentDeletePolicy;
  updateLinksOnRename: boolean;
  defaultNoteLocation: DefaultNoteLocation;
  newNoteFolder: string;
  linkFormat: LinkFormat;
  attachmentFolder: string;
  excludedPatterns: string;
  detectAllFileExtensions: boolean;
}

export interface AppearanceSettings {
  uiScale: number;
  accent: "violet" | "indigo" | "emerald" | "amber";
  density: "comfortable" | "compact";
  colorScheme: "auto" | "light" | "dark";
  showRibbon: boolean;
  showTabTitleBar: boolean;
  showViewHeader: boolean;
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
    colorScheme: "auto" as const,
    showRibbon: true,
    showTabTitleBar: true,
    showViewHeader: true,
  },
  editor: {
    defaultMode: "split" as EditorMode,
    defaultEditingMode: "live-preview" as DefaultEditingMode,
    showInlineTitle: true,
    showEditorStatus: true,
    readableLineLength: true,
    strictLineBreaks: false,
    foldHeading: true,
    foldIndent: true,
    showIndentationGuides: false,
    rtl: false,
    lineNumbers: true,
    lineWrapping: true,
    spellCheck: true,
    spellcheckLanguages: ["en"],
    autoPairBrackets: true,
    autoPairMarkdown: true,
    smartListIndent: true,
    indentWithTabs: false,
    tabSize: 2,
    autoConvertHtml: true,
    vimMode: false,
    propertiesDisplay: "visible" as PropertiesDisplay,
  },
  files: {
    confirmDelete: true,
    trashStrategy: "app" as TrashStrategy,
    attachmentDeletePolicy: "ask" as AttachmentDeletePolicy,
    updateLinksOnRename: true,
    defaultNoteLocation: "same-folder" as DefaultNoteLocation,
    newNoteFolder: "Inbox",
    linkFormat: "wikilink" as LinkFormat,
    attachmentFolder: "Attachments",
    excludedPatterns: ".lattice/**, .obsidian/**, _Templates/**",
    detectAllFileExtensions: false,
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
      version: 2,
      migrate: (persisted, version) => {
        if (!persisted || typeof persisted !== "object") return defaults;
        const incoming = persisted as Partial<typeof defaults>;
        const merged = {
          app: { ...defaults.app, ...(incoming.app ?? {}) },
          appearance: { ...defaults.appearance, ...(incoming.appearance ?? {}) },
          editor: { ...defaults.editor, ...(incoming.editor ?? {}) },
          files: { ...defaults.files, ...(incoming.files ?? {}) },
          graph: { ...defaults.graph, ...(incoming.graph ?? {}) },
          search: { ...defaults.search, ...(incoming.search ?? {}) },
        };
        void version;
        return merged as SettingsState;
      },
    },
  ),
);
