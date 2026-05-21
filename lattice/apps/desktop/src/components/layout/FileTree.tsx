import { FileText, Folder, FolderOpen } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FileContextMenu } from "@/components/layout/FileContextMenu";
import { cn } from "@/lib/utils";
import { useVaultStore } from "@/stores/vault-store";
import type { FileNode } from "@/types/domain";

interface MenuState {
  node: FileNode;
  x: number;
  y: number;
}

interface FlatNode {
  node: FileNode;
  depth: number;
}

function flatten(nodes: FileNode[], openFolders: Set<string>, depth = 0): FlatNode[] {
  return nodes.flatMap((node) => {
    const row = { node, depth };
    if (node.kind === "folder" && openFolders.has(node.path)) {
      return [row, ...flatten(node.children ?? [], openFolders, depth + 1)];
    }
    return [row];
  });
}

function filterNodes(nodes: FileNode[], filter: string): FileNode[] {
  const query = filter.trim().replace(/^#/, "").toLowerCase();
  if (!query) return nodes;
  return nodes.flatMap((node) => {
    const children = node.children ? filterNodes(node.children, filter) : [];
    const matches = node.name.toLowerCase().includes(query) || node.path.toLowerCase().includes(query);
    if (matches || children.length > 0) {
      return [{ ...node, children }];
    }
    return [];
  });
}

export function FileTree({ filter = "" }: { filter?: string }) {
  const files = useVaultStore((state) => state.files);
  const activePath = useVaultStore((state) => state.activePath);
  const setActivePath = useVaultStore((state) => state.setActivePath);
  const [openFolders, setOpenFolders] = useState(() => new Set<string>());
  const [menu, setMenu] = useState<MenuState | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const visibleFiles = useMemo(() => filterNodes(files, filter), [files, filter]);
  const rows = useMemo(() => flatten(visibleFiles, filter.trim() ? allFolderPaths(visibleFiles) : openFolders), [filter, visibleFiles, openFolders]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 30,
    overscan: 12,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const renderedItems =
    virtualItems.length > 0
      ? virtualItems.map((item) => ({ index: item.index, start: item.start, size: item.size }))
      : rows.slice(0, 80).map((_, index) => ({ index, start: index * 30, size: 30 }));

  function toggleFolder(path: string) {
    setOpenFolders((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-auto px-2">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {renderedItems.map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) return null;
          const { node, depth } = row;
          const isFolder = node.kind === "folder";
          const isMarkdown = node.kind === "file" && node.isMarkdown;
          const isOpen = openFolders.has(node.path);
          const active = node.path === activePath;
          return (
            <div
              key={node.path}
              className={cn("absolute left-0 right-0 top-0 px-1")}
              style={{ height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
            >
              <button
                className={cn("row h-7 w-full text-left", active && "active")}
                style={{ paddingLeft: 8 + depth * 14 }}
                title={isFolder || isMarkdown ? node.path : `${node.path} is an attachment`}
                onClick={() => {
                  if (isFolder) toggleFolder(node.path);
                  else if (isMarkdown) void setActivePath(node.path);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMenu({ node, x: event.clientX, y: event.clientY });
                }}
              >
                {isFolder ? (
                  isOpen ? (
                    <FolderOpen size={13} className="text-[var(--violet-2)]" />
                  ) : (
                    <Folder size={13} className="text-[var(--text-3)]" />
                  )
                ) : (
                  <FileText size={13} className="text-[var(--text-3)]" />
                )}
                <span className="truncate">{node.name.replace(/\.md$/i, "")}</span>
              </button>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="px-3 py-4 text-xs text-[var(--text-3)]">
            No files match "{filter}".
          </div>
        )}
      </div>
      {menu && (
        <FileContextMenu
          node={menu.node}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

function allFolderPaths(nodes: FileNode[]): Set<string> {
  const paths = new Set<string>();
  for (const node of nodes) {
    if (node.kind === "folder") {
      paths.add(node.path);
      for (const child of allFolderPaths(node.children ?? [])) {
        paths.add(child);
      }
    }
  }
  return paths;
}
