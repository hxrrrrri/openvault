import { Bookmark, FolderPlus, Hash, Lock, PanelLeftClose, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { NewNoteDialog } from "@/components/editor/NewNoteDialog";
import { FileTree } from "@/components/layout/FileTree";
import { BookmarksPanel } from "@/features/core-plugins/bookmarks/BookmarksPanel";
import { SearchPanel } from "@/features/search/SearchPanel";
import { useUIStore } from "@/stores/ui-store";
import { useVaultStore } from "@/stores/vault-store";

interface LeftSidebarProps {
  width?: number;
  onResize?: (deltaX: number) => void;
}

type SidebarTab = "files" | "bookmarks" | "search";

export function LeftSidebar({ width = 270, onResize }: LeftSidebarProps) {
  const setLeftOpen = useUIStore((state) => state.setLeftOpen);
  const createNote = useVaultStore((state) => state.createNote);
  const createFolder = useVaultStore((state) => state.createFolder);
  const vault = useVaultStore((state) => state.vault);
  const tags = useVaultStore((state) => state.tags);
  const [tab, setTab] = useState<SidebarTab>("files");
  const [filter, setFilter] = useState("");
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const filteredTags = useMemo(() => tags.filter((tag) => tag.toLowerCase().includes(filter.toLowerCase().replace(/^#/, ""))), [filter, tags]);

  function promptNotePath() {
    setNewNoteOpen(true);
  }

  function promptFolderPath() {
    const path = window.prompt("New folder path", "Inbox");
    if (path) void createFolder(path);
  }

  return (
    <aside
      className="relative flex shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-gradient-to-b from-[#0c0c11] to-[#0a0a0e]"
      style={{ width }}
    >
      <ResizeHandle side="right" label="Resize file explorer" onResize={onResize} />
      <div className="flex items-center justify-between px-3.5 py-3">
        <div className="flex items-center gap-1 text-[10px]">
          <button
            type="button"
            onClick={() => setTab("files")}
            className={`rounded px-2 py-1 transition ${tab === "files" ? "bg-violet/15 text-white" : "text-[var(--text-3)] hover:text-white"}`}
          >
            Files
          </button>
          <button
            type="button"
            onClick={() => setTab("bookmarks")}
            className={`flex items-center gap-1 rounded px-2 py-1 transition ${tab === "bookmarks" ? "bg-violet/15 text-white" : "text-[var(--text-3)] hover:text-white"}`}
          >
            <Bookmark size={10} /> Bookmarks
          </button>
          <button
            type="button"
            onClick={() => setTab("search")}
            className={`flex items-center gap-1 rounded px-2 py-1 transition ${tab === "search" ? "bg-violet/15 text-white" : "text-[var(--text-3)] hover:text-white"}`}
          >
            <Search size={10} /> Search
          </button>
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="Create note" onClick={promptNotePath}>
            <Plus size={14} />
          </IconButton>
          <IconButton label="Create folder" onClick={promptFolderPath}>
            <FolderPlus size={14} />
          </IconButton>
          <IconButton label="Collapse left panel" onClick={() => setLeftOpen(false)}>
            <PanelLeftClose size={14} />
          </IconButton>
        </div>
      </div>

      {tab === "files" ? (
        <>
          <div className="px-3 pb-3">
            <div className="relative">
              <Search className="absolute left-2 top-1.5 text-[var(--text-3)]" size={13} />
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Find files or tags"
                className="w-full rounded-lg border border-[var(--border)] bg-white/[0.025] py-1.5 pl-7 pr-2 text-xs text-[var(--text)] outline-none focus:border-violet/40"
              />
            </div>
          </div>
          <div className="pixel-label px-3 pb-2 text-[10px]">Files</div>
          <FileTree filter={filter} />
          <div className="border-t border-[var(--border)] px-3 py-3">
            <div className="pixel-label mb-2 text-[10px]">Tags</div>
            <div className="flex max-h-24 flex-wrap gap-1 overflow-hidden">
              {filteredTags.slice(0, 12).map((tag) => (
                <button key={tag} className="chip mono px-2 py-0.5 text-[10px]" onClick={() => setFilter(tag)}>
                  <Hash size={10} />
                  {tag.replace(/^#/, "")}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : tab === "bookmarks" ? (
        <BookmarksPanel />
      ) : (
        <SearchPanel />
      )}

      <div className="border-t border-[var(--border)] bg-black/30 px-3 py-3">
        <div className="flex items-center gap-2">
          <Lock size={13} className="text-[var(--success)]" />
          <span className="mono text-[10px] text-[var(--text-3)]">LOCAL VAULT</span>
          <span className="mono ml-auto text-[10px] text-[var(--text-3)]">{vault?.noteCount ?? 0} NOTES</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full bg-gradient-to-r from-[#4B36B8] to-[#8B7CFF]" style={{ width: `${vault?.indexedPercent ?? 0}%` }} />
        </div>
      </div>
      {newNoteOpen && (
        <NewNoteDialog
          onClose={() => setNewNoteOpen(false)}
          onCreate={(path, content) => void createNote(path, content)}
        />
      )}
    </aside>
  );
}

function ResizeHandle({
  side,
  label,
  onResize,
}: {
  side: "left" | "right";
  label: string;
  onResize?: (deltaX: number) => void;
}) {
  if (!onResize) return null;
  return (
    <button
      type="button"
      aria-label={label}
      className={`absolute top-0 z-20 h-full w-2 cursor-col-resize bg-transparent transition hover:bg-violet/20 ${
        side === "left" ? "left-0" : "right-0"
      }`}
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
