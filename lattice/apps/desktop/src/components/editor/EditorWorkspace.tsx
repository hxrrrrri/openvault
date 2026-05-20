import { Columns2, Eye, FilePenLine, Focus, GitBranch } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { MarkdownPreview } from "@/components/editor/MarkdownPreview";
import { countWords } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";
import { useUIStore } from "@/stores/ui-store";
import { useVaultStore } from "@/stores/vault-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

export function EditorWorkspace() {
  const activeNote = useVaultStore((state) => state.activeNote);
  const updateActiveContent = useVaultStore((state) => state.updateActiveContent);
  const saveActiveNote = useVaultStore((state) => state.saveActiveNote);
  const openLinkedNote = useVaultStore((state) => state.openLinkedNote);
  const saving = useVaultStore((state) => state.saving);
  const editorSettings = useSettingsStore((state) => state.editor);
  const editorMode = useWorkspaceStore((state) => state.editorMode);
  const setEditorMode = useWorkspaceStore((state) => state.setEditorMode);
  const focusMode = useWorkspaceStore((state) => state.focusMode);
  const setFocusMode = useWorkspaceStore((state) => state.setFocusMode);
  const setView = useUIStore((state) => state.setView);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (activeNote) void saveActiveNote();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [activeNote?.content, activeNote, saveActiveNote]);

  const stats = useMemo(() => {
    const content = activeNote?.content ?? "";
    return {
      words: countWords(content),
      lines: content.split("\n").length,
    };
  }, [activeNote?.content]);

  if (!activeNote) {
    return <div className="grid flex-1 place-items-center text-[var(--text-3)]">Open or create a note.</div>;
  }

  const showEditor = editorMode === "edit" || editorMode === "split";
  const showPreview = editorMode === "preview" || editorMode === "split";

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-gradient-to-b from-[#0a0a0e] to-[#07070b]">
      <div className="flex h-9 items-end gap-px border-b border-[var(--border)] bg-[#08080c]/70 pl-3">
        <div className="relative top-px flex items-center gap-2 rounded-t-lg border border-b-0 border-[var(--border)] bg-gradient-to-b from-[#14141a] to-[#0e0e13] px-3.5 py-2 text-xs">
          <FilePenLine size={12} />
          <span>{activeNote.title}</span>
        </div>
        <div className="ml-auto flex gap-1 px-3 pb-1.5">
          <Button variant={editorMode === "edit" ? "primary" : "ghost"} className="px-2 py-1 text-[11px]" onClick={() => setEditorMode("edit")}>
            <FilePenLine size={13} />
          </Button>
          <Button variant={editorMode === "preview" ? "primary" : "ghost"} className="px-2 py-1 text-[11px]" onClick={() => setEditorMode("preview")}>
            <Eye size={13} />
          </Button>
          <Button variant={editorMode === "split" ? "primary" : "ghost"} className="px-2 py-1 text-[11px]" onClick={() => setEditorMode("split")}>
            <Columns2 size={13} />
          </Button>
          <Button variant="ghost" className="px-2 py-1 text-[11px]" onClick={() => setFocusMode(!focusMode)}>
            <Focus size={13} />
          </Button>
          <Button variant="ghost" className="px-2 py-1 text-[11px]" onClick={() => setView("graph")}>
            <GitBranch size={13} />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {showEditor && (
          <section className={focusMode ? "min-w-0 flex-1 overflow-auto px-[18%] py-8" : "min-w-0 flex-1 overflow-auto px-10 py-6"}>
            <div className="mx-auto flex max-w-3xl items-center gap-2 pb-4">
              {extractTags(activeNote.content).slice(0, 4).map((tag) => (
                <span key={tag} className="chip chip-violet mono text-[10px]">
                  {tag}
                </span>
              ))}
              <span className="pixel-label ml-auto text-[10px]">{saving ? "saving" : "autosaved"}</span>
            </div>
            <div className={`mx-auto h-[calc(100%-42px)] ${editorSettings.readableLineLength ? "max-w-3xl" : "max-w-none"}`}>
              <MarkdownEditor value={activeNote.content} onChange={updateActiveContent} />
            </div>
          </section>
        )}

        {showPreview && !focusMode && (
          <section className="min-w-0 flex-1 overflow-y-auto border-l border-[var(--border)] bg-[#0a0a0e]/60 px-9 py-8">
            <div className="pixel-label mb-3 text-[10px]">Preview</div>
            <MarkdownPreview content={activeNote.content} notePath={activeNote.path} onOpenNote={(target) => void openLinkedNote(target)} />
          </section>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-3 rounded-full border border-[var(--border)] bg-[#111116]/85 px-4 py-1.5 text-[11px] text-[var(--text-3)] backdrop-blur-md">
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
