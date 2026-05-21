import { Bookmark, FileText, Folder, Hash, Search as SearchIcon, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useVaultStore } from "@/stores/vault-store";
import { bookmarkLabel, useBookmarksStore, type BookmarkEntry } from "./bookmarks-store";

export function BookmarksPanel() {
  const entries = useBookmarksStore((state) => state.entries);
  const remove = useBookmarksStore((state) => state.remove);
  const setActivePath = useVaultStore((state) => state.setActivePath);
  const [filter, setFilter] = useState("");

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) => bookmarkLabel(entry).toLowerCase().includes(q));
  }, [entries, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, BookmarkEntry[]>();
    for (const entry of visible) {
      const key = entry.group ?? "";
      const bucket = map.get(key) ?? [];
      bucket.push(entry);
      map.set(key, bucket);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] || "").localeCompare(b[0] || ""));
  }, [visible]);

  function activate(entry: BookmarkEntry) {
    const target = entry.target;
    if (target.kind === "note" || target.kind === "heading" || target.kind === "block") {
      void setActivePath(target.path);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-3 pb-2 pt-3">
        <div className="pixel-label mb-2 text-[10px]">Bookmarks</div>
        <input
          value={filter}
          onChange={(event) => setFilter(event.currentTarget.value)}
          placeholder="Filter…"
          className="w-full rounded-md border border-[var(--border)] bg-black/25 px-2 py-1 text-xs text-[var(--text)] outline-none focus:border-violet/40"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {entries.length === 0 && (
          <div className="px-3 py-4 text-xs text-[var(--text-3)]">
            Nothing bookmarked yet. Right-click any note in the file tree to add one.
          </div>
        )}
        {grouped.map(([group, items]) => (
          <div key={group || "default"} className="mb-2">
            {group && (
              <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-[var(--text-4)]">{group}</div>
            )}
            {items.map((entry) => (
              <div
                key={entry.id}
                className="group flex items-center gap-2 rounded-md px-2 py-1 text-xs text-[var(--text-2)] transition hover:bg-violet/10 hover:text-white"
              >
                <button
                  type="button"
                  className="flex flex-1 items-center gap-2 truncate text-left"
                  onClick={() => activate(entry)}
                  title={JSON.stringify(entry.target)}
                >
                  <IconFor entry={entry} />
                  <span className="truncate">{bookmarkLabel(entry)}</span>
                </button>
                <button
                  type="button"
                  className="opacity-0 transition group-hover:opacity-100 hover:text-rose-300"
                  onClick={() => remove(entry.id)}
                  title="Remove bookmark"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function IconFor({ entry }: { entry: BookmarkEntry }) {
  switch (entry.target.kind) {
    case "folder":
      return <Folder size={11} className="text-[var(--text-3)]" />;
    case "heading":
      return <Hash size={11} className="text-[var(--violet-2)]" />;
    case "search":
      return <SearchIcon size={11} className="text-[var(--violet-2)]" />;
    case "block":
      return <Bookmark size={11} className="text-[var(--violet-2)]" />;
    default:
      return <FileText size={11} className="text-[var(--text-3)]" />;
  }
}
