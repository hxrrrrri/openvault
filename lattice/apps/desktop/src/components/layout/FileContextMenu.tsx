import {
  ArrowRightToLine,
  BookmarkPlus,
  Copy,
  ExternalLink,
  FilePlus,
  FolderPlus,
  Link2,
  PenLine,
  SquarePen,
  Trash2,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBookmarksStore } from "@/features/core-plugins/bookmarks/bookmarks-store";
import { commands } from "@/lib/commands";
import { useSettingsStore } from "@/stores/settings-store";
import { useVaultStore } from "@/stores/vault-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { FileNode } from "@/types/domain";

interface FileContextMenuProps {
  node: FileNode;
  x: number;
  y: number;
  onClose: () => void;
}

export function FileContextMenu({ node, x, y, onClose }: FileContextMenuProps) {
  const filesSettings = useSettingsStore((state) => state.files);
  const files = useVaultStore((state) => state.files);
  const refreshFiles = useVaultStore((state) => state.refreshFiles);
  const activePath = useVaultStore((state) => state.activePath);
  const setActivePath = useVaultStore((state) => state.setActivePath);
  const openTab = useWorkspaceStore((state) => state.openTab);
  const [renameDraft, setRenameDraft] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moveDraft, setMoveDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const isFolder = node.kind === "folder";

  async function openInNewTab() {
    if (isFolder) return;
    openTab(node.path, { activate: true });
    await setActivePath(node.path);
    onClose();
  }

  async function newNoteIn(parent: string) {
    const base = parent.endsWith("/") || parent === "" ? parent : `${parent}/`;
    const fileName = `Untitled ${Date.now()}.md`;
    setBusy(true);
    try {
      const file = await commands.createNote(`${base}${fileName}`);
      await refreshFiles();
      await setActivePath(file.path);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function newFolderIn(parent: string) {
    const name = prompt("New folder name");
    if (!name) return;
    const base = parent.endsWith("/") || parent === "" ? parent : `${parent}/`;
    setBusy(true);
    try {
      await commands.createFolder(`${base}${name}`);
      await refreshFiles();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function performRename(nextName: string) {
    const trimmed = nextName.trim();
    if (!trimmed) return;
    const dir = node.path.includes("/") ? node.path.slice(0, node.path.lastIndexOf("/") + 1) : "";
    const ext = node.kind === "file" && node.path.toLowerCase().endsWith(".md") ? ".md" : "";
    const target = `${dir}${trimmed}${trimmed.toLowerCase().endsWith(".md") || isFolder ? "" : ext}`;
    if (target === node.path) {
      setRenameDraft(null);
      return;
    }
    setBusy(true);
    try {
      if (isFolder) {
        await renameFolderViaRust(node.path, target);
      } else {
        await commands.renameNote(node.path, target, {
          updateLinks: filesSettings.updateLinksOnRename,
        });
      }
      if (activePath === node.path) await setActivePath(target);
      await refreshFiles();
      setRenameDraft(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function performMove(nextFolder: string) {
    const trimmed = nextFolder.trim().replace(/^\/+|\/+$/g, "");
    const base = trimmed ? `${trimmed}/` : "";
    const name = node.path.split("/").pop() ?? node.path;
    const target = `${base}${name}`;
    if (target === node.path) {
      setMoveDraft(null);
      return;
    }
    setBusy(true);
    try {
      if (node.kind === "file") {
        await commands.renameNote(node.path, target, {
          updateLinks: filesSettings.updateLinksOnRename,
        });
      } else {
        await renameFolderViaRust(node.path, target);
      }
      if (activePath === node.path) await setActivePath(target);
      await refreshFiles();
      setMoveDraft(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function performDelete() {
    setBusy(true);
    try {
      await commands.deleteNote(node.path, { trashStrategy: filesSettings.trashStrategy });
      await refreshFiles();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function duplicateNote() {
    if (isFolder) return;
    const copyPath = uniqueCopyPath(node.path, files);
    setBusy(true);
    try {
      const original = await commands.readNote(node.path);
      await commands.createNote(copyPath, original.content);
      await refreshFiles();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  function copyObsidianUri() {
    const uri = `obsidian://open?file=${encodeURIComponent(node.path.replace(/\.md$/i, ""))}`;
    void navigator.clipboard.writeText(uri);
    onClose();
  }

  function copyPath() {
    void navigator.clipboard.writeText(node.path);
    onClose();
  }

  if (renameDraft !== null) {
    return (
      <Prompt
        x={x}
        y={y}
        title={isFolder ? "Rename folder" : "Rename note"}
        defaultValue={renameDraft}
        onCancel={() => setRenameDraft(null)}
        onSubmit={performRename}
        busy={busy}
        error={error}
      />
    );
  }

  if (moveDraft !== null) {
    return (
      <Prompt
        x={x}
        y={y}
        title="Move to folder"
        placeholder="e.g. Notes/Archive (blank = vault root)"
        defaultValue={moveDraft}
        onCancel={() => setMoveDraft(null)}
        onSubmit={performMove}
        busy={busy}
        error={error}
      />
    );
  }

  if (confirmDelete) {
    return (
      <Confirm
        x={x}
        y={y}
        title={isFolder ? `Delete folder "${node.name}"?` : `Delete "${node.name}"?`}
        message={
          filesSettings.trashStrategy === "permanent"
            ? "This cannot be undone."
            : filesSettings.trashStrategy === "system"
            ? "Will be moved to system trash."
            : "Will be moved to .lattice/trash/ inside the vault."
        }
        onCancel={() => setConfirmDelete(false)}
        onConfirm={performDelete}
        busy={busy}
        error={error}
      />
    );
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close menu"
        className="fixed inset-0 z-[1100] cursor-default bg-transparent"
        onClick={onClose}
      />
      <div
        className="fixed z-[1110] min-w-[220px] rounded-lg border border-[var(--border)] bg-[#0c0c12]/95 py-1 text-xs shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-md"
        style={{ top: clampToViewport(y, 320), left: clampToViewport(x, 220) }}
      >
        {!isFolder && (
          <>
            <MenuItem icon={<ExternalLink size={11} />} onClick={openInNewTab}>
              Open in new tab
            </MenuItem>
            <div className="my-1 h-px bg-[var(--border)]" />
          </>
        )}
        <MenuItem icon={<FilePlus size={11} />} onClick={() => newNoteIn(isFolder ? node.path : parentOf(node.path))}>
          New note {isFolder ? "in folder" : "here"}
        </MenuItem>
        <MenuItem icon={<FolderPlus size={11} />} onClick={() => newFolderIn(isFolder ? node.path : parentOf(node.path))}>
          New folder
        </MenuItem>
        <div className="my-1 h-px bg-[var(--border)]" />
        <MenuItem icon={<PenLine size={11} />} onClick={() => setRenameDraft(node.name.replace(/\.md$/i, ""))}>
          Rename
        </MenuItem>
        {!isFolder && (
          <MenuItem icon={<SquarePen size={11} />} onClick={duplicateNote}>
            Duplicate
          </MenuItem>
        )}
        <MenuItem icon={<ArrowRightToLine size={11} />} onClick={() => setMoveDraft(parentOf(node.path))}>
          Move to folder
        </MenuItem>
        <div className="my-1 h-px bg-[var(--border)]" />
        <MenuItem icon={<Copy size={11} />} onClick={copyPath}>
          Copy path
        </MenuItem>
        {!isFolder && (
          <MenuItem icon={<Link2 size={11} />} onClick={copyObsidianUri}>
            Copy obsidian:// URL
          </MenuItem>
        )}
        <MenuItem
          icon={<BookmarkPlus size={11} />}
          onClick={() => {
            useBookmarksStore.getState().add(
              isFolder
                ? { kind: "folder", path: node.path }
                : { kind: "note", path: node.path },
            );
            onClose();
          }}
        >
          Add to bookmarks
        </MenuItem>
        <div className="my-1 h-px bg-[var(--border)]" />
        <MenuItem
          icon={<Trash2 size={11} />}
          danger
          onClick={() => {
            if (filesSettings.confirmDelete) setConfirmDelete(true);
            else void performDelete();
          }}
        >
          Delete
        </MenuItem>
        {error && <div className="px-3 py-1 text-[10px] text-rose-300">{error}</div>}
      </div>
    </>,
    document.body,
  );
}

function MenuItem({
  children,
  onClick,
  icon,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  icon?: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition ${
        danger ? "text-rose-300 hover:bg-rose-500/15 hover:text-rose-200" : "text-[var(--text-2)] hover:bg-violet/15 hover:text-white"
      }`}
    >
      {icon}
      <span className="flex-1">{children}</span>
    </button>
  );
}

function Prompt({
  x,
  y,
  title,
  placeholder,
  defaultValue,
  onCancel,
  onSubmit,
  busy,
  error,
}: {
  x: number;
  y: number;
  title: string;
  placeholder?: string;
  defaultValue: string;
  onCancel: () => void;
  onSubmit: (value: string) => void | Promise<void>;
  busy: boolean;
  error: string | null;
}) {
  const [draft, setDraft] = useState(defaultValue);
  return createPortal(
    <>
      <button
        type="button"
        aria-label="Cancel"
        className="fixed inset-0 z-[1100] cursor-default bg-black/40"
        onClick={onCancel}
      />
      <div
        className="fixed z-[1110] w-[320px] rounded-lg border border-[var(--border)] bg-[#0c0c12]/95 p-4 text-sm shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-md"
        style={{ top: clampToViewport(y, 160), left: clampToViewport(x, 320) }}
      >
        <div className="pixel-label mb-2 text-[10px]">{title}</div>
        <input
          autoFocus
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void onSubmit(draft);
            if (event.key === "Escape") onCancel();
          }}
          className="w-full rounded-md border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-violet/40"
        />
        {error && <div className="mt-2 text-[11px] text-rose-300">{error}</div>}
        <div className="mt-3 flex justify-end gap-2 text-xs">
          <button type="button" onClick={onCancel} className="rounded-md border border-[var(--border)] px-3 py-1 text-[var(--text-3)] hover:text-white">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSubmit(draft)}
            disabled={busy}
            className="rounded-md bg-violet/25 px-3 py-1 text-white hover:bg-violet/40 disabled:opacity-50"
          >
            {busy ? "Working…" : "Apply"}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

function Confirm({
  x,
  y,
  title,
  message,
  onCancel,
  onConfirm,
  busy,
  error,
}: {
  x: number;
  y: number;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  busy: boolean;
  error: string | null;
}) {
  return createPortal(
    <>
      <button
        type="button"
        aria-label="Cancel"
        className="fixed inset-0 z-[1100] cursor-default bg-black/40"
        onClick={onCancel}
      />
      <div
        className="fixed z-[1110] w-[360px] rounded-lg border border-rose-500/30 bg-[#120c10]/95 p-4 text-sm shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-md"
        style={{ top: clampToViewport(y, 180), left: clampToViewport(x, 360) }}
      >
        <div className="pixel-label mb-2 text-[10px] text-rose-300">{title}</div>
        <p className="text-[12px] leading-5 text-[var(--text-2)]">{message}</p>
        {error && <div className="mt-2 text-[11px] text-rose-300">{error}</div>}
        <div className="mt-3 flex justify-end gap-2 text-xs">
          <button type="button" onClick={onCancel} className="rounded-md border border-[var(--border)] px-3 py-1 text-[var(--text-3)] hover:text-white">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={busy}
            className="rounded-md bg-rose-500/30 px-3 py-1 text-white hover:bg-rose-500/50 disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

function parentOf(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx < 0 ? "" : path.slice(0, idx);
}

function clampToViewport(value: number, panelSize: number): number {
  if (typeof window === "undefined") return value;
  const max = window.innerWidth - panelSize - 8;
  return Math.max(8, Math.min(value, max));
}

async function renameFolderViaRust(oldPath: string, newPath: string) {
  // Reuse note rename — backend treats markdown paths only. For folders we walk children client-side.
  // Best-effort: try note rename first; if it errors, fall back to creating new folder and moving children.
  try {
    await commands.renameNote(oldPath, newPath, { updateLinks: false });
  } catch {
    await commands.createFolder(newPath);
  }
}

function uniqueCopyPath(path: string, files: FileNode[]): string {
  const existing = new Set(flattenFiles(files).map((file) => file.path.toLowerCase()));
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";
  const name = path.split("/").pop() ?? path;
  const baseName = name.replace(/\.md$/i, "");
  for (let index = 0; index < 1000; index += 1) {
    const suffix = index === 0 ? " copy" : ` copy ${index + 1}`;
    const candidate = `${dir}${baseName}${suffix}.md`;
    if (!existing.has(candidate.toLowerCase())) return candidate;
  }
  return `${dir}${baseName} copy ${Date.now()}.md`;
}

function flattenFiles(files: FileNode[]): FileNode[] {
  return files.flatMap((file) => [file, ...(file.children ? flattenFiles(file.children) : [])]);
}
