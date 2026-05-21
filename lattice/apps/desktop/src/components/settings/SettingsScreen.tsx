import {
  BrainCircuit,
  Database,
  FileCog,
  Info,
  Keyboard,
  Lock,
  Palette,
  RotateCcw,
  Search,
  Settings,
  Shield,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { GlowCard } from "@/components/ui/GlowCard";
import { PluginMarketplace } from "@/components/plugins/PluginMarketplace";
import { HotkeyEditor } from "@/features/hotkeys/HotkeyEditor";
import { useSettingsStore } from "@/stores/settings-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { EditorMode } from "@/types/domain";

type SettingsTab = "general" | "appearance" | "editor" | "files" | "graph" | "sync" | "permissions" | "ai" | "search" | "keyboard" | "about";

const tabs = [
  { id: "general" as const, label: "General", icon: <Settings size={13} /> },
  { id: "appearance" as const, label: "Appearance", icon: <Palette size={13} /> },
  { id: "editor" as const, label: "Editor", icon: <Keyboard size={13} /> },
  { id: "files" as const, label: "Files & Links", icon: <FileCog size={13} /> },
  { id: "graph" as const, label: "Graph", icon: <Database size={13} /> },
  { id: "sync" as const, label: "Encrypted Sync", icon: <Lock size={13} /> },
  { id: "permissions" as const, label: "Plugin Permissions", icon: <Shield size={13} /> },
  { id: "ai" as const, label: "AI Local Model", icon: <BrainCircuit size={13} /> },
  { id: "search" as const, label: "Index Search", icon: <Search size={13} /> },
  { id: "keyboard" as const, label: "Keyboard", icon: <Keyboard size={13} /> },
  { id: "about" as const, label: "About", icon: <Info size={13} /> },
];

export function SettingsScreen() {
  const resetSettings = useSettingsStore((state) => state.resetSettings);
  const [tab, setTab] = useSettingsTab();
  const [sidebarWidth, setSidebarWidth] = useState(240);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-gradient-to-b from-[#08080c] to-[#050507]">
      <aside
        className="relative shrink-0 border-r border-[var(--border)] bg-[#08080c]/60 p-4"
        style={{ width: sidebarWidth }}
      >
        <ResizeHandle onResize={(delta) => setSidebarWidth((width) => clamp(width + delta, 210, 420))} />
        <div className="pixel-label mb-3 px-2 text-[10px]">Settings</div>
        <div className="space-y-1">
          {tabs.map((item) => (
            <button key={item.id} className={`row w-full ${tab === item.id ? "active" : ""}`} onClick={() => setTab(item.id)}>
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" className="mt-4 w-full justify-start text-xs" onClick={resetSettings}>
          <RotateCcw size={13} /> Reset settings
        </Button>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-8">
        {tab === "general" && <GeneralSettings />}
        {tab === "appearance" && <AppearanceSettings />}
        {tab === "editor" && <EditorSettings />}
        {tab === "files" && <FilesSettings />}
        {tab === "graph" && <GraphSettings />}
        {tab === "sync" && <SyncSettings />}
        {tab === "permissions" && <PermissionsSettings />}
        {tab === "ai" && <AISettings />}
        {tab === "search" && <SearchSettings />}
        {tab === "keyboard" && <KeyboardSettings />}
        {tab === "about" && <AboutSettings />}
      </main>
    </div>
  );
}

function useSettingsTab(): [SettingsTab, (tab: SettingsTab) => void] {
  const defaultTab: SettingsTab = "general";
  const [tab, setTabState] = useState<SettingsTab>(() => {
    const state = window.history.state as { latticeSettingsTab?: SettingsTab } | null;
    return state?.latticeSettingsTab ?? defaultTab;
  });
  const setTab = (next: SettingsTab) => {
    setTabState(next);
    window.history.replaceState({ ...(window.history.state ?? {}), latticeSettingsTab: next }, "");
  };
  return [tab, setTab];
}

function GeneralSettings() {
  const app = useSettingsStore((state) => state.app);
  const setApp = useSettingsStore((state) => state.setApp);
  return (
    <SettingsSection eyebrow="General" title="Vault behavior and trust defaults">
      <SettingGrid>
        <SelectRow
          label="Release channel"
          value={app.releaseChannel}
          options={[
            ["stable", "Stable"],
            ["beta", "Beta"],
            ["nightly", "Nightly"],
          ]}
          onChange={(releaseChannel) => setApp({ releaseChannel })}
        />
        <SelectRow
          label="Language"
          value={app.language}
          options={[
            ["en", "English"],
            ["hi", "Hindi"],
            ["es", "Spanish"],
          ]}
          onChange={(language) => setApp({ language })}
        />
        <ToggleRow label="Automatic updates" description="Check for signed app updates on launch." checked={app.autoUpdates} onChange={(autoUpdates) => setApp({ autoUpdates })} />
        <ToggleRow label="Portable mode" description="Keep settings with the vault where possible." checked={app.portableMode} onChange={(portableMode) => setApp({ portableMode })} />
        <ToggleRow label="Telemetry" description="Disabled by default. No note content is sent." checked={app.telemetry} onChange={(telemetry) => setApp({ telemetry })} />
        <InfoRow label="Config folder" value=".lattice/ is used for cache, settings, plugins, and workspace state." />
      </SettingGrid>
    </SettingsSection>
  );
}

function AppearanceSettings() {
  const appearance = useSettingsStore((state) => state.appearance);
  const setAppearance = useSettingsStore((state) => state.setAppearance);
  return (
    <SettingsSection eyebrow="Appearance" title="Interface density and visual scale">
      <SettingGrid>
        <RangeRow label="UI zoom" min={80} max={130} step={5} value={appearance.uiScale} suffix="%" onChange={(uiScale) => setAppearance({ uiScale })} />
        <SelectRow
          label="Accent"
          value={appearance.accent}
          options={[
            ["violet", "Violet"],
            ["indigo", "Indigo"],
            ["emerald", "Emerald"],
            ["amber", "Amber"],
          ]}
          onChange={(accent) => setAppearance({ accent })}
        />
        <SelectRow
          label="Density"
          value={appearance.density}
          options={[
            ["comfortable", "Comfortable"],
            ["compact", "Compact"],
          ]}
          onChange={(density) => setAppearance({ density })}
        />
        <SelectRow
          label="Color scheme"
          value={appearance.colorScheme}
          options={[
            ["auto", "Adapt to system"],
            ["light", "Light"],
            ["dark", "Dark"],
          ]}
          onChange={(colorScheme) => setAppearance({ colorScheme })}
        />
        <ToggleRow label="Show ribbon" description="Show the vertical ribbon on the far left of the window." checked={appearance.showRibbon} onChange={(showRibbon) => setAppearance({ showRibbon })} />
        <ToggleRow label="Show tab title bar" description="Show the tab strip at the top of each editor pane." checked={appearance.showTabTitleBar} onChange={(showTabTitleBar) => setAppearance({ showTabTitleBar })} />
        <ToggleRow label="Show view header" description="Show the small per-pane action header (navigation arrows, three-dot menu)." checked={appearance.showViewHeader} onChange={(showViewHeader) => setAppearance({ showViewHeader })} />
        <InfoRow label="CSS snippets" value="Theme snippets are loaded from .lattice/themes in the desktop runtime." />
      </SettingGrid>
    </SettingsSection>
  );
}

function EditorSettings() {
  const editor = useSettingsStore((state) => state.editor);
  const setEditor = useSettingsStore((state) => state.setEditor);
  const setEditorMode = useWorkspaceStore((state) => state.setEditorMode);
  return (
    <SettingsSection eyebrow="Editor" title="Markdown editing">
      <SettingGrid>
        <SelectRow<EditorMode>
          label="Default view"
          value={editor.defaultMode}
          options={[
            ["edit", "Editing"],
            ["preview", "Reading"],
            ["split", "Split"],
          ]}
          onChange={(defaultMode) => {
            setEditor({ defaultMode });
            setEditorMode(defaultMode);
          }}
        />
        <SelectRow
          label="Default editing mode"
          value={editor.defaultEditingMode}
          options={[
            ["live-preview", "Live Preview"],
            ["source", "Source"],
          ]}
          onChange={(defaultEditingMode) => setEditor({ defaultEditingMode })}
        />
        <SelectRow
          label="Properties display"
          value={editor.propertiesDisplay}
          options={[
            ["visible", "Visible"],
            ["hidden", "Hidden"],
            ["source", "Source"],
          ]}
          onChange={(propertiesDisplay) => setEditor({ propertiesDisplay })}
        />
        <ToggleRow label="Show inline title" description="Show the filename as an editable H1 above the note body." checked={editor.showInlineTitle} onChange={(showInlineTitle) => setEditor({ showInlineTitle })} />
        <ToggleRow label="Show editor status" description="Show 'live preview / source' chip and autosave indicator above the editor." checked={editor.showEditorStatus} onChange={(showEditorStatus) => setEditor({ showEditorStatus })} />
        <ToggleRow label="Readable line length" description="Constrain editor width for long-form writing." checked={editor.readableLineLength} onChange={(readableLineLength) => setEditor({ readableLineLength })} />
        <ToggleRow label="Strict line breaks" description="Treat single newlines as hard breaks (matches GitHub-flavored Markdown)." checked={editor.strictLineBreaks} onChange={(strictLineBreaks) => setEditor({ strictLineBreaks })} />
        <ToggleRow label="Fold heading" description="Show fold controls in the gutter next to headings." checked={editor.foldHeading} onChange={(foldHeading) => setEditor({ foldHeading })} />
        <ToggleRow label="Fold indent" description="Allow collapsing indented blocks (nested lists)." checked={editor.foldIndent} onChange={(foldIndent) => setEditor({ foldIndent })} />
        <ToggleRow label="Indentation guides" description="Draw subtle vertical lines for each indentation level." checked={editor.showIndentationGuides} onChange={(showIndentationGuides) => setEditor({ showIndentationGuides })} />
        <ToggleRow label="Right-to-left" description="Render the editor in RTL for Arabic / Hebrew / Persian / Urdu." checked={editor.rtl} onChange={(rtl) => setEditor({ rtl })} />
        <ToggleRow label="Line numbers" description="Show editor gutter line numbers." checked={editor.lineNumbers} onChange={(lineNumbers) => setEditor({ lineNumbers })} />
        <ToggleRow label="Line wrapping" description="Wrap long Markdown lines inside the editor." checked={editor.lineWrapping} onChange={(lineWrapping) => setEditor({ lineWrapping })} />
        <ToggleRow label="Spell check" description="Ask the browser engine to spell-check note text." checked={editor.spellCheck} onChange={(spellCheck) => setEditor({ spellCheck })} />
        <TextRow label="Spellcheck languages (comma-separated)" value={editor.spellcheckLanguages.join(", ")} onChange={(value) => setEditor({ spellcheckLanguages: value.split(",").map((s) => s.trim()).filter(Boolean) })} />
        <ToggleRow label="Auto-pair brackets" description={`Close (), [], {}, '', "" automatically.`} checked={editor.autoPairBrackets} onChange={(autoPairBrackets) => setEditor({ autoPairBrackets })} />
        <ToggleRow label="Auto-pair Markdown" description="Close *, _, `, =, ~ automatically." checked={editor.autoPairMarkdown} onChange={(autoPairMarkdown) => setEditor({ autoPairMarkdown })} />
        <ToggleRow label="Smart list indent" description="Tab/Shift-Tab indent list items; Enter on empty item exits." checked={editor.smartListIndent} onChange={(smartListIndent) => setEditor({ smartListIndent })} />
        <ToggleRow label="Indent using tabs" description="Use tab characters instead of spaces." checked={editor.indentWithTabs} onChange={(indentWithTabs) => setEditor({ indentWithTabs })} />
        <RangeRow label="Tab size" min={2} max={8} step={1} value={editor.tabSize} onChange={(tabSize) => setEditor({ tabSize })} />
        <ToggleRow label="Auto-convert pasted HTML" description="Convert pasted HTML into Markdown when supported." checked={editor.autoConvertHtml} onChange={(autoConvertHtml) => setEditor({ autoConvertHtml })} />
        <ToggleRow label="Vim mode" description="Requires @replit/codemirror-vim package — install to activate." checked={editor.vimMode} onChange={(vimMode) => setEditor({ vimMode })} />
      </SettingGrid>
    </SettingsSection>
  );
}

function FilesSettings() {
  const files = useSettingsStore((state) => state.files);
  const setFiles = useSettingsStore((state) => state.setFiles);
  return (
    <SettingsSection eyebrow="Files & Links" title="Safe note and attachment handling">
      <SettingGrid>
        <ToggleRow label="Confirm delete" description="Ask before deleting notes from the file tree." checked={files.confirmDelete} onChange={(confirmDelete) => setFiles({ confirmDelete })} />
        <ToggleRow label="Update links on rename" description="Keep wikilinks valid when note paths change." checked={files.updateLinksOnRename} onChange={(updateLinksOnRename) => setFiles({ updateLinksOnRename })} />
        <SelectRow
          label="Delete behavior"
          value={files.trashStrategy}
          options={[
            ["app", "Move to .lattice trash"],
            ["system", "Move to system trash"],
            ["permanent", "Delete permanently"],
          ]}
          onChange={(trashStrategy) => setFiles({ trashStrategy })}
        />
        <SelectRow
          label="New note location"
          value={files.defaultNoteLocation}
          options={[
            ["same-folder", "Same folder"],
            ["inbox", "Inbox"],
            ["vault", "Vault root"],
            ["custom", "Custom folder"],
          ]}
          onChange={(defaultNoteLocation) => setFiles({ defaultNoteLocation })}
        />
        <TextRow label="New note folder (when custom)" value={files.newNoteFolder} onChange={(newNoteFolder) => setFiles({ newNoteFolder })} />
        <SelectRow
          label="Attachment deletion"
          value={files.attachmentDeletePolicy}
          options={[
            ["ask", "Ask every time"],
            ["always", "Always delete linked attachments"],
            ["never", "Never delete attachments"],
          ]}
          onChange={(attachmentDeletePolicy) => setFiles({ attachmentDeletePolicy })}
        />
        <SelectRow
          label="Link format"
          value={files.linkFormat}
          options={[
            ["wikilink", "[[Wikilinks]]"],
            ["markdown", "Markdown links"],
          ]}
          onChange={(linkFormat) => setFiles({ linkFormat })}
        />
        <TextRow label="Attachment folder" value={files.attachmentFolder} onChange={(attachmentFolder) => setFiles({ attachmentFolder })} />
        <ToggleRow label="Detect all file extensions" description="Show non-Markdown files (zip, docx, etc.) in the file tree." checked={files.detectAllFileExtensions} onChange={(detectAllFileExtensions) => setFiles({ detectAllFileExtensions })} />
      </SettingGrid>
      <GlowCard className="mt-4 p-5">
        <div className="pixel-label text-[10px]">Excluded files</div>
        <textarea
          value={files.excludedPatterns}
          onChange={(event) => setFiles({ excludedPatterns: event.target.value })}
          className="mt-3 min-h-24 w-full rounded-lg border border-[var(--border)] bg-black/25 p-3 text-sm text-[var(--text)] outline-none focus:border-violet/40"
        />
      </GlowCard>
    </SettingsSection>
  );
}

function GraphSettings() {
  const graph = useSettingsStore((state) => state.graph);
  const setGraph = useSettingsStore((state) => state.setGraph);
  return (
    <SettingsSection eyebrow="Graph" title="Graph display and navigation">
      <SettingGrid>
        <SelectRow
          label="Labels"
          value={graph.labelMode}
          options={[
            ["auto", "Automatic"],
            ["all", "Always show"],
            ["none", "Hide"],
          ]}
          onChange={(labelMode) => setGraph({ labelMode })}
        />
        <ToggleRow label="Direction arrows" description="Draw link direction hints when supported by the renderer." checked={graph.showArrows} onChange={(showArrows) => setGraph({ showArrows })} />
        <RangeRow label="Node size" min={0.7} max={1.6} step={0.1} value={graph.nodeScale} onChange={(nodeScale) => setGraph({ nodeScale })} />
        <RangeRow label="Line thickness" min={0.7} max={2} step={0.1} value={graph.edgeScale} onChange={(edgeScale) => setGraph({ edgeScale })} />
      </SettingGrid>
    </SettingsSection>
  );
}

function SyncSettings() {
  return (
    <SettingsSection eyebrow="Encrypted Sync" title="Open sync foundation">
      <SettingGrid>
        <InfoRow label="Status" value="Sync is intentionally off until an auditable self-hostable protocol is ready." />
        <InfoRow label="Default" value="No account is required. No cloud service is contacted." />
        <InfoRow label="Planned" value="End-to-end encryption, version history, and Git backup UI." />
      </SettingGrid>
    </SettingsSection>
  );
}

function PermissionsSettings() {
  return (
    <div>
      <div className="pixel-label text-[11px]">Plugin permissions</div>
      <h1 className="mt-1 text-2xl font-semibold tracking-normal">You're in control.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-3)]">
        Every plugin action should be attributable to an explicit grant. Obsidian plugins run through an isolated worker shim with gated vault, workspace, UI, storage, network, and desktop adapters.
      </p>
      <div className="mt-6">
        <PluginMarketplace />
      </div>
    </div>
  );
}

function AISettings() {
  return (
    <SettingsSection eyebrow="AI Local Model" title="Local intelligence">
      <SettingGrid>
        <InfoRow label="Provider" value="Ollama/local provider interfaces are present in the Rust crates." />
        <InfoRow label="Network default" value="No note content leaves this device unless a provider is explicitly configured." />
        <InfoRow label="Capabilities" value="Semantic search, suggested backlinks, summaries, and graph explanations are the intended AI layer." />
      </SettingGrid>
    </SettingsSection>
  );
}

function SearchSettings() {
  const search = useSettingsStore((state) => state.search);
  const setSearch = useSettingsStore((state) => state.setSearch);
  return (
    <SettingsSection eyebrow="Index Search" title="Full-text and semantic retrieval">
      <SettingGrid>
        <ToggleRow label="Exact phrases with quotes" description="Treat quoted search text as an exact phrase." checked={search.exactPhraseByQuotes} onChange={(exactPhraseByQuotes) => setSearch({ exactPhraseByQuotes })} />
        <ToggleRow label="Result context" description="Show matching snippets in search results." checked={search.includeContext} onChange={(includeContext) => setSearch({ includeContext })} />
        <ToggleRow label="Semantic search" description="Use local embeddings when an embeddings plugin is enabled." checked={search.semanticSearch} onChange={(semanticSearch) => setSearch({ semanticSearch })} />
        <RangeRow label="Maximum results" min={10} max={100} step={10} value={search.maxResults} onChange={(maxResults) => setSearch({ maxResults })} />
      </SettingGrid>
    </SettingsSection>
  );
}

function KeyboardSettings() {
  return (
    <SettingsSection eyebrow="Keyboard" title="Hotkeys">
      <HotkeyEditor />
    </SettingsSection>
  );
}

function AboutSettings() {
  return (
    <SettingsSection eyebrow="About" title="LATTICE v0.1.0">
      <SettingGrid>
        <InfoRow label="License" value="MIT" />
        <InfoRow label="Source of truth" value="Plain Markdown files in your vault." />
        <InfoRow label="Index" value=".lattice/index.db is a rebuildable SQLite cache." />
        <InfoRow label="Privacy" value="No telemetry by default; plugins and AI are permission-first." />
      </SettingGrid>
    </SettingsSection>
  );
}

function SettingsSection({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div>
      <div className="pixel-label text-[11px]">Settings / {eyebrow}</div>
      <h1 className="mt-1 text-2xl font-semibold tracking-normal">{title}</h1>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function SettingGrid({ children }: { children: ReactNode }) {
  return <div className="grid max-w-5xl grid-cols-1 gap-4 xl:grid-cols-2">{children}</div>;
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <GlowCard className="flex min-h-[104px] items-center justify-between gap-4 p-5">
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {description && <span className="mt-1 block text-xs leading-5 text-[var(--text-3)]">{description}</span>}
      </span>
      <button type="button" aria-pressed={checked} className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)} />
    </GlowCard>
  );
}

function SelectRow<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<[T, string]>; onChange: (value: T) => void }) {
  return (
    <GlowCard className="p-5">
      <label className="text-sm font-semibold">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="mt-3 w-full rounded-lg border border-[var(--border)] bg-black/25 px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-violet/40"
      >
        {options.map(([id, optionLabel]) => (
          <option key={id} value={id}>
            {optionLabel}
          </option>
        ))}
      </select>
    </GlowCard>
  );
}

function RangeRow({ label, value, min, max, step, suffix, onChange }: { label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (value: number) => void }) {
  return (
    <GlowCard className="p-5">
      <div className="mb-3 flex items-center justify-between text-sm font-semibold">
        {label}
        <span className="mono text-[var(--violet-2)]">
          {value}
          {suffix}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-[#8B7CFF]" />
    </GlowCard>
  );
}

function ResizeHandle({ onResize }: { onResize: (deltaX: number) => void }) {
  return (
    <button
      type="button"
      aria-label="Resize settings sidebar"
      className="absolute right-0 top-0 z-20 h-full w-2 cursor-col-resize bg-transparent transition hover:bg-violet/20"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        let lastX = event.clientX;
        const move = (moveEvent: PointerEvent) => {
          onResize(moveEvent.clientX - lastX);
          lastX = moveEvent.clientX;
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up, { once: true });
      }}
    />
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function TextRow({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <GlowCard className="p-5">
      <label className="text-sm font-semibold">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full rounded-lg border border-[var(--border)] bg-black/25 px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-violet/40"
      />
    </GlowCard>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <GlowCard className="p-5">
      <div className="pixel-label text-[10px]">{label}</div>
      <p className="mt-3 text-sm leading-6 text-[var(--text-2)]">{value}</p>
    </GlowCard>
  );
}
