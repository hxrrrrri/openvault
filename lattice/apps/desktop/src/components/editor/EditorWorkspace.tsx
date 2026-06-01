import type { Editor as TiptapEditor } from "@tiptap/react";
import { Columns2, Eye, FileCode2, FilePenLine, Focus, GitBranch, Palette, Plus, Smile, X } from "lucide-react";
import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { DrawingPad } from "@/components/editor/DrawingPad";
import { EmojiPicker } from "@/components/editor/EmojiPicker";
import { InsertMenu } from "@/components/editor/InsertMenu";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { MarkdownPreview } from "@/components/editor/MarkdownPreview";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { TabBar } from "@/components/layout/TabBar";
import { SourcePanel } from "@/components/editor/SourcePanel";
import { WysiwygEditor } from "@/components/editor/WysiwygEditor";
import { WysiwygSlashMenu } from "@/components/editor/WysiwygSlashMenu";
import { WysiwygToolbar } from "@/components/editor/WysiwygToolbar";
import { commands, type ImportedAsset } from "@/lib/commands";
import { countWords } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";
import { useUIStore } from "@/stores/ui-store";
import { parsePluginViewPath, useVaultStore } from "@/stores/vault-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { PluginViewContainer } from "@/components/plugins/PluginViewContainer";
import type { FileNode } from "@/types/domain";

const BG_PRESETS: Array<{ id: string; label: string; bg: string; accent: string }> = [
  { id: "default", label: "Default", bg: "transparent", accent: "#8B7CFF" },
  { id: "violet", label: "Violet veil", bg: "linear-gradient(180deg,rgba(99,80,200,0.18),rgba(20,18,40,0.6))", accent: "#b6abff" },
  { id: "rose", label: "Rose dusk", bg: "linear-gradient(180deg,rgba(220,90,120,0.16),rgba(45,15,25,0.6))", accent: "#ff7a8a" },
  { id: "amber", label: "Amber dawn", bg: "linear-gradient(180deg,rgba(220,170,80,0.16),rgba(45,32,15,0.6))", accent: "#f7d774" },
  { id: "emerald", label: "Emerald glade", bg: "linear-gradient(180deg,rgba(80,200,150,0.16),rgba(15,40,30,0.6))", accent: "#7ee0b4" },
  { id: "ocean", label: "Ocean grain", bg: "linear-gradient(180deg,rgba(80,140,220,0.18),rgba(15,25,40,0.6))", accent: "#8eaaff" },
  { id: "ink", label: "Pure ink", bg: "#06060a", accent: "#cdb8ff" },
  { id: "paper", label: "Paper", bg: "#1b1610", accent: "#f0d39a" },
];

export function EditorWorkspace() {
  const activeNote = useVaultStore((state) => state.activeNote);
  const files = useVaultStore((state) => state.files);
  const tags = useVaultStore((state) => state.tags);
  const updateActiveContent = useVaultStore((state) => state.updateActiveContent);
  const saveActiveNote = useVaultStore((state) => state.saveActiveNote);
  const openLinkedNote = useVaultStore((state) => state.openLinkedNote);
  const refreshFiles = useVaultStore((state) => state.refreshFiles);
  const saving = useVaultStore((state) => state.saving);
  const editorSettings = useSettingsStore((state) => state.editor);
  const filesSettings = useSettingsStore((state) => state.files);
  const editorMode = useWorkspaceStore((state) => state.editorMode);
  const setEditorMode = useWorkspaceStore((state) => state.setEditorMode);
  const focusMode = useWorkspaceStore((state) => state.focusMode);
  const setFocusMode = useWorkspaceStore((state) => state.setFocusMode);
  const setView = useUIStore((state) => state.setView);
  const [colorOpen, setColorOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [drawOpen, setDrawOpen] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const [insertPosition, setInsertPosition] = useState<PanelPosition | null>(null);
  const [emojiPosition, setEmojiPosition] = useState<PanelPosition | null>(null);
  const [sourceWidth, setSourceWidth] = useState(44);
  const [tiptapEditor, setTiptapEditor] = useState<TiptapEditor | null>(null);
  const [editorNotice, setEditorNotice] = useState<string | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const insertButtonRef = useRef<HTMLDivElement | null>(null);
  const emojiButtonRef = useRef<HTMLDivElement | null>(null);

  function insertIntoEditor(text: string) {
    // Block content (tables, headings, HTML embeds) must go through
    // insertMarkdownAtEnd so the markdown store is updated and TipTap
    // re-parses it correctly via setContent. Inline content (e.g. emojis)
    // can be inserted at cursor position via insertContent.
    const isBlock = text.includes("\n") || /^<\w/.test(text.trim());
    if (isBlock || !tiptapEditor) {
      insertMarkdownAtEnd(text);
      return;
    }
    const inserted = tiptapEditor.chain().focus().insertContent(text).run();
    if (!inserted) insertMarkdownAtEnd(text);
  }

  function insertMarkdownAtEnd(text: string) {
    if (!activeNote) return;
    const cleaned = text.trim();
    if (!cleaned) return;
    const separator = blockSeparator(activeNote.content);
    updateActiveContent(`${activeNote.content}${separator}${cleaned}\n\n`);
  }

  async function importLocalFiles(fileList: FileList) {
    const files = Array.from(fileList);
    if (!files.length) return;
    const snippets: string[] = [];
    for (const file of files) {
      const bytesBase64 = await readFileAsBase64(file);
      const asset = await commands.importAsset({
        fileName: file.name,
        bytesBase64,
        attachmentFolder: filesSettings.attachmentFolder,
      });
      snippets.push(formatImportedAsset(asset));
    }
    insertMarkdownAtEnd(`\n${snippets.join("\n")}\n`);
    setEditorNotice(`${snippets.length} attachment${snippets.length === 1 ? "" : "s"} inserted`);
    window.setTimeout(() => setEditorNotice(null), 1800);
    await refreshFiles();
  }

  async function insertDrawing(bytesBase64: string) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const asset = await commands.importAsset({
      fileName: `Drawing ${stamp}.png`,
      bytesBase64,
      attachmentFolder: filesSettings.attachmentFolder,
    });
    insertMarkdownAtEnd(`\n${formatImportedAsset(asset)}\n`);
    setEditorNotice("Drawing inserted");
    window.setTimeout(() => setEditorNotice(null), 1800);
    await refreshFiles();
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (activeNote) void saveActiveNote();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [activeNote?.content, activeNote, saveActiveNote]);

  useEffect(() => {
    if (!insertOpen) {
      setInsertPosition(null);
      return;
    }

    const updatePosition = () => {
      const rect = insertButtonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setInsertPosition(getPanelPosition(rect, 430, 560));
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [insertOpen]);

  useEffect(() => {
    if (!emojiOpen) {
      setEmojiPosition(null);
      return;
    }

    const updatePosition = () => {
      const rect = emojiButtonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setEmojiPosition(getPanelPosition(rect, 360, 470));
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [emojiOpen]);

  const stats = useMemo(() => {
    const content = activeNote?.content ?? "";
    return {
      words: countWords(content),
      lines: content.split("\n").length,
    };
  }, [activeNote?.content]);

  const flatFiles = useMemo(() => flattenFiles(files), [files]);
  const completionSource = useMemo(
    () => ({
      notes: () =>
        flatFiles
          .filter((file) => file.kind === "file" && file.isMarkdown)
          .map((file) => ({
            path: file.path,
            title: file.name.replace(/\.md$/i, ""),
          })),
      tags: () => tags,
    }),
    [flatFiles, tags],
  );

  const bgPreset = useMemo(() => extractBgPreset(activeNote?.content ?? ""), [activeNote?.content]);
  const activePath = useVaultStore((state) => state.activePath);
  const pluginViewType = activePath ? parsePluginViewPath(activePath) : null;

  if (pluginViewType && activePath) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <TabBar />
        <PluginViewContainer viewType={pluginViewType} viewPath={activePath} />
      </div>
    );
  }

  if (!activeNote) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <TabBar />
        <div className="grid flex-1 place-items-center text-[var(--text-3)]">Open or create a note.</div>
      </div>
    );
  }

  const showEditor = editorMode === "edit" || editorMode === "split";
  const showReading = editorMode === "preview";
  const showSource = editorMode === "split";
  const sourceAsActive = editorSettings.defaultEditingMode === "source";
  const cssClasses = extractCssClasses(activeNote.content);

  const sectionBg = bgPreset?.bg ?? "transparent";
  const accent = bgPreset?.accent ?? "#8B7CFF";
  const paneClasses = ["relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(900px_520px_at_52%_-12%,rgba(139,124,255,0.11),transparent_60%),linear-gradient(180deg,#0a0a0e,#07070b)]", ...cssClasses].join(" ");

  return (
    <div
      ref={workspaceRef}
      className={paneClasses}
      style={{ ["--note-accent" as string]: accent }}
    >
      <div className="flex items-stretch bg-[#08080c]/70 backdrop-blur-xl">
        <div className="min-w-0 flex-1">
          <TabBar />
        </div>
        <div className="flex items-center gap-1 px-3 pb-1.5">
          <div className="relative" ref={insertButtonRef}>
            <Button
              variant={insertOpen ? "primary" : "ghost"}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px]"
              onClick={() => {
                setInsertOpen((o) => !o);
                setEmojiOpen(false);
              }}
            >
              <Plus size={13} /> Insert
            </Button>
            {insertOpen && insertPosition && createPortal(
              <>
                <button
                  type="button"
                  aria-label="Close insert menu"
                  className="fixed inset-0 z-[990] cursor-default bg-transparent"
                  onClick={() => setInsertOpen(false)}
                />
                <div
                  className="fixed z-[1000]"
                  style={{ top: insertPosition.top, left: insertPosition.left }}
                >
                  <InsertMenu
                    maxHeight={insertPosition.maxHeight}
                    width={insertPosition.width}
                    onInsert={(text) => insertIntoEditor(text)}
                    onPickLocalFiles={(files) =>
                      void importLocalFiles(files).catch((error) => {
                        setEditorNotice(error instanceof Error ? error.message : "Could not insert attachment");
                        window.setTimeout(() => setEditorNotice(null), 2600);
                      })
                    }
                    onOpenDraw={() => setDrawOpen(true)}
                    onClose={() => setInsertOpen(false)}
                  />
                </div>
              </>,
              document.body,
            )}
          </div>
          <div className="relative" ref={emojiButtonRef}>
            <Button
              variant={emojiOpen ? "primary" : "ghost"}
              className="px-2 py-1 text-[11px]"
              onClick={() => {
                setEmojiOpen((o) => !o);
                setInsertOpen(false);
              }}
              title="Insert emoji"
            >
              <Smile size={13} />
            </Button>
            {emojiOpen && emojiPosition && createPortal(
              <>
                <button
                  type="button"
                  aria-label="Close emoji picker"
                  className="fixed inset-0 z-[990] cursor-default bg-transparent"
                  onClick={() => setEmojiOpen(false)}
                />
                <div
                  className="fixed z-[1000]"
                  style={{ top: emojiPosition.top, left: emojiPosition.left }}
                >
                  <EmojiPicker
                    maxHeight={emojiPosition.maxHeight}
                    onPick={(emoji) => insertIntoEditor(emoji)}
                    onClose={() => setEmojiOpen(false)}
                  />
                </div>
              </>,
              document.body,
            )}
          </div>
          <span className="mx-1 h-4 w-px bg-[var(--border)]" />
          <Button
            variant={editorMode === "edit" ? "primary" : "ghost"}
            className="flex items-center gap-1 px-2 py-1 text-[11px]"
            onClick={() => setEditorMode("edit")}
            title="Visual editor"
          >
            <FilePenLine size={13} />
          </Button>
          <Button
            variant={editorMode === "preview" ? "primary" : "ghost"}
            className="flex items-center gap-1 px-2 py-1 text-[11px]"
            onClick={() => setEditorMode("preview")}
            title="Reading view"
          >
            <Eye size={13} />
          </Button>
          <Button
            variant={editorMode === "split" ? "primary" : "ghost"}
            className="flex items-center gap-1 px-2 py-1 text-[11px]"
            onClick={() => setEditorMode("split")}
            title="Visual + raw markdown source"
          >
            <Columns2 size={13} />
            <FileCode2 size={11} className="opacity-70" />
          </Button>
          <Button variant="ghost" className="px-2 py-1 text-[11px]" onClick={() => setFocusMode(!focusMode)}>
            <Focus size={13} />
          </Button>
          <Button variant={colorOpen ? "primary" : "ghost"} className="px-2 py-1 text-[11px]" onClick={() => setColorOpen((o) => !o)}>
            <Palette size={13} />
          </Button>
          <Button variant="ghost" className="px-2 py-1 text-[11px]" onClick={() => setView("graph")}>
            <GitBranch size={13} />
          </Button>
        </div>
      </div>

      {colorOpen && (
        <div className="anim-fade-up flex items-center gap-2 bg-[#0c0c12]/80 px-4 py-2 text-[11px] text-[var(--text-3)] shadow-[inset_0_-1px_0_rgba(139,124,255,0.08)] backdrop-blur-md">
          <span className="pixel-label text-[10px]">Note theme</span>
          {BG_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(updateActiveContent, activeNote.content, preset.id)}
              className={`group flex items-center gap-2 rounded-md px-2 py-1 shadow-[inset_0_0_0_1px_rgba(139,124,255,0.06)] transition ${bgPreset?.id === preset.id ? "bg-violet/15 text-white shadow-[inset_0_0_0_1px_rgba(169,155,255,0.28)]" : "hover:bg-violet/10 hover:shadow-[inset_0_0_0_1px_rgba(169,155,255,0.18)]"}`}
              title={preset.label}
            >
              <span
                className="size-3 rounded-sm shadow-[inset_0_0_0_1px_rgba(139,124,255,0.18)]"
                style={{ background: preset.bg.includes("gradient") ? preset.bg : preset.bg === "transparent" ? "rgba(139,124,255,0.08)" : preset.bg }}
              />
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            className="ml-auto text-[var(--text-3)] hover:text-white"
            onClick={() => setColorOpen(false)}
            title="Close"
          >
            <X size={13} />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden" style={{ background: sectionBg }}>
        {showEditor && (
          <section className="relative min-w-0 flex-1 overflow-hidden">
            <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#111116]/85 px-3 py-1 text-[10px] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.08),0_12px_28px_-22px_rgba(0,0,0,0.9)] backdrop-blur-md">
              {extractTags(activeNote.content).slice(0, 4).map((tag) => (
                <span key={tag} className="chip chip-violet mono text-[10px]">
                  {tag}
                </span>
              ))}
              {editorSettings.showEditorStatus && (
                <span className="pixel-label">{saving ? "saving" : "autosaved"}</span>
              )}
              {editorSettings.showEditorStatus && (
                <span className="pixel-label opacity-60">
                  {sourceAsActive ? "source" : "live preview"}
                </span>
              )}
            </div>
            {editorSettings.showInlineTitle && (
              <InlineTitle
                title={activeNote.title}
                path={activeNote.path}
                onRename={async (next) => {
                  const renamed = await renameActiveNote(activeNote.path, next);
                  if (renamed) await useVaultStore.getState().setActivePath(renamed);
                  await refreshFiles();
                }}
              />
            )}
            {editorSettings.propertiesDisplay === "visible" && (
              <PropertiesPanel content={activeNote.content} onChange={updateActiveContent} />
            )}
            <EditorSurfaceBoundary
              resetKey={`${activeNote.path}:${sourceAsActive ? "src" : "lp"}`}
              onError={() => setTiptapEditor(null)}
              fallback={(error) => (
                <textarea
                  value={activeNote.content}
                  onChange={(event) => updateActiveContent(event.currentTarget.value)}
                  className="h-full w-full resize-none bg-[#08080c]/80 px-8 py-7 font-mono text-sm leading-7 text-[var(--text-2)] outline-none"
                  spellCheck={false}
                  title={`Visual editor unavailable: ${error.message}`}
                />
              )}
            >
              {sourceAsActive ? (
                <MarkdownEditor
                  value={activeNote.content}
                  onChange={updateActiveContent}
                  completionSource={completionSource}
                  onOpenLink={(target) => void openLinkedNote(target)}
                  livePreviewEnabled
                />
              ) : (
                <WysiwygEditor
                  value={activeNote.content}
                  onChange={updateActiveContent}
                  placeholder={`Start writing "${activeNote.title}" — press / for blocks`}
                  exposeEditor={setTiptapEditor}
                />
              )}
            </EditorSurfaceBoundary>
            {editorNotice && (
              <div className="pointer-events-none absolute right-5 top-5 z-20 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[11px] text-[var(--success)] shadow-[0_12px_36px_rgba(0,0,0,0.35)]">
                {editorNotice}
              </div>
            )}
            {!sourceAsActive && <WysiwygToolbar editor={tiptapEditor} />}
            {!sourceAsActive && <WysiwygSlashMenu editor={tiptapEditor} />}
          </section>
        )}

        {showReading && !focusMode && (
          <section className="min-w-0 flex-1 overflow-y-auto bg-[#0a0a0e]/40 px-12 py-10">
            <div className="mx-auto max-w-3xl">
              <div className="pixel-label mb-3 text-[10px]">Reading view</div>
              <MarkdownPreview
                content={activeNote.content}
                notePath={activeNote.path}
                onOpenNote={(target) => void openLinkedNote(target)}
              />
            </div>
          </section>
        )}

        {showSource && !focusMode && (
          <section
            className="relative min-w-[280px] overflow-hidden shadow-[inset_1px_0_0_rgba(139,124,255,0.08)]"
            style={{ flex: `0 0 ${sourceWidth}%` }}
          >
            <DragHandle
              side="left"
              label="Resize markdown source panel"
              getContainerWidth={() =>
                workspaceRef.current?.getBoundingClientRect().width ??
                document.documentElement.clientWidth ??
                window.innerWidth
              }
              onDrag={(delta, containerWidth) => {
                setSourceWidth((current) => clamp(current - (delta / containerWidth) * 100, 24, 68));
              }}
              onDoubleClick={() => setEditorMode("edit")}
            />
            <SourcePanel
              content={activeNote.content}
              notePath={activeNote.path}
              onChange={updateActiveContent}
              onOpenLink={(target) => void openLinkedNote(target)}
              completionSource={completionSource}
              onCollapse={() => setEditorMode("edit")}
            />
          </section>
        )}
      </div>

      {drawOpen && createPortal(
        <DrawingPad
          onClose={() => setDrawOpen(false)}
          onInsert={(bytesBase64) =>
            insertDrawing(bytesBase64).catch((error) => {
              setEditorNotice(error instanceof Error ? error.message : "Could not insert drawing");
              window.setTimeout(() => setEditorNotice(null), 2600);
            })
          }
        />,
        document.body,
      )}

      <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-3 rounded-full bg-[#111116]/85 px-4 py-1.5 text-[11px] text-[var(--text-3)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.08),0_12px_30px_-22px_rgba(0,0,0,0.9)] backdrop-blur-md">
        <span className="mono">{stats.words} words</span>
        <span className="mono">{stats.lines} lines</span>
        <span className="mono">{activeNote.path}</span>
      </div>
    </div>
  );
}

function extractTags(content: string): string[] {
  return Array.from(new Set(content.match(/#[\w/-]+/g) ?? []));
}

function extractCssClasses(content: string): string[] {
  const fm = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return [];
  const line = fm[1].match(/^cssclasses?:\s*(.+)$/m);
  if (!line) return [];
  const raw = line[1].trim();
  if (raw.startsWith("[")) {
    return raw
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
  }
  return raw
    .split(/\s+|,/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function renameActiveNote(oldPath: string, newTitle: string): Promise<string | null> {
  const cleanTitle = newTitle.trim().replace(/[<>:"|?*\\/]+/g, "").trim();
  if (!cleanTitle) return null;
  const dir = oldPath.includes("/") ? oldPath.slice(0, oldPath.lastIndexOf("/") + 1) : "";
  const ext = oldPath.toLowerCase().endsWith(".md") ? ".md" : "";
  const newPath = `${dir}${cleanTitle}${ext}`;
  if (newPath === oldPath) return null;
  try {
    const file = await commands.renameNote(oldPath, newPath, {
      updateLinks: useSettingsStore.getState().files.updateLinksOnRename,
    });
    return file.path;
  } catch (error) {
    console.warn("Inline rename failed", error);
    return null;
  }
}

function InlineTitle({
  title,
  path,
  onRename,
}: {
  title: string;
  path: string;
  onRename: (next: string) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  useEffect(() => {
    setDraft(title);
  }, [title, path]);
  return (
    <div className="border-b border-[var(--border)]/40 px-10 pt-7 pb-3">
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={() => {
            setEditing(false);
            if (draft.trim() && draft.trim() !== title) void onRename(draft.trim());
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              setDraft(title);
              setEditing(false);
            }
          }}
          className="w-full bg-transparent text-3xl font-bold tracking-tight text-white outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="block w-full text-left text-3xl font-bold tracking-tight text-white hover:text-[var(--violet-2)]"
          title="Click to rename"
        >
          {title.replace(/\.md$/i, "")}
        </button>
      )}
    </div>
  );
}

function flattenFiles(files: FileNode[]): FileNode[] {
  return files.flatMap((file) => [file, ...(file.children ? flattenFiles(file.children) : [])]);
}

function extractBgPreset(content: string): { id: string; bg: string; accent: string } | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const themeMatch = match[1].match(/^bgPreset:\s*([\w-]+)\s*$/m);
  if (!themeMatch) return null;
  const preset = BG_PRESETS.find((p) => p.id === themeMatch[1]);
  return preset ?? null;
}

function applyPreset(
  update: (content: string) => void,
  current: string,
  presetId: string,
) {
  const fmMatch = current.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fmMatch) {
    const body = fmMatch[1].replace(/^bgPreset:.*$\n?/m, "").trim();
    const nextBody = presetId === "default" ? body : `${body ? `${body}\n` : ""}bgPreset: ${presetId}`;
    const nextFm = nextBody ? `---\n${nextBody}\n---\n` : "";
    update(nextFm + current.slice(fmMatch[0].length));
    return;
  }
  if (presetId === "default") return;
  update(`---\nbgPreset: ${presetId}\n---\n${current}`);
}

function blockSeparator(content: string) {
  if (!content) return "";
  if (content.endsWith("\n\n")) return "";
  if (content.endsWith("\n")) return "\n";
  return "\n\n";
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read file as data URL"));
        return;
      }
      resolve(result.split(",")[1] ?? "");
    };
    reader.readAsDataURL(file);
  });
}

function formatImportedAsset(asset: ImportedAsset) {
  if (
    asset.mime.startsWith("image/") ||
    asset.mime.startsWith("video/") ||
    asset.mime.startsWith("audio/") ||
    asset.mime === "application/pdf"
  ) {
    return `![${asset.fileName}](lattice-asset://${encodeURIComponent(asset.path)})`;
  }
  return `[${asset.fileName}](${asset.path})`;
}

interface EditorSurfaceBoundaryProps {
  children: ReactNode;
  resetKey: string;
  fallback: (error: Error, retry: () => void) => ReactNode;
  onError?: (error: Error) => void;
}

interface EditorSurfaceBoundaryState {
  error: Error | null;
}

class EditorSurfaceBoundary extends Component<
  EditorSurfaceBoundaryProps,
  EditorSurfaceBoundaryState
> {
  state: EditorSurfaceBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): EditorSurfaceBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Editor surface crashed", error, info.componentStack);
    this.props.onError?.(error);
  }

  componentDidUpdate(previous: EditorSurfaceBoundaryProps) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error, this.retry);
    }
    return this.props.children;
  }
}

interface PanelPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

function getPanelPosition(
  rect: DOMRect,
  width: number,
  preferredMaxHeight: number,
): PanelPosition {
  const margin = 16;
  const gap = 10;
  const viewportWidth = window.visualViewport?.width ?? document.documentElement.clientWidth ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? document.documentElement.clientHeight ?? window.innerHeight;
  const panelWidth = Math.min(width, Math.max(280, viewportWidth - margin * 2));
  const spaceBelow = viewportHeight - rect.bottom - gap - margin;
  const spaceAbove = rect.top - gap - margin;
  const opensBelow = spaceBelow >= 300 || spaceBelow >= spaceAbove;
  const maxHeight = Math.min(preferredMaxHeight, Math.max(260, (opensBelow ? spaceBelow : spaceAbove)));
  const top = opensBelow ? rect.bottom + gap : rect.top - gap - maxHeight;
  const preferredLeft = rect.right - panelWidth;
  return {
    top: clamp(top, margin, Math.max(margin, viewportHeight - maxHeight - margin)),
    left: clamp(preferredLeft, margin, Math.max(margin, viewportWidth - panelWidth - margin)),
    width: panelWidth,
    maxHeight,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function DragHandle({
  side,
  label,
  getContainerWidth,
  onDrag,
  onDoubleClick,
}: {
  side: "left" | "right";
  label: string;
  getContainerWidth?: () => number;
  onDrag: (deltaX: number, containerWidth: number) => void;
  onDoubleClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`absolute top-0 z-30 h-full w-2 cursor-col-resize bg-transparent transition hover:bg-violet/20 ${
        side === "left" ? "left-0" : "right-0"
      }`}
      onDoubleClick={onDoubleClick}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        let lastX = event.clientX;
        const containerWidth = getContainerWidth?.() ?? document.documentElement.clientWidth ?? window.innerWidth;
        const move = (moveEvent: PointerEvent) => {
          onDrag(moveEvent.clientX - lastX, containerWidth);
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
