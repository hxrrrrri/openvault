import { Pin, PinOff, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useVaultStore } from "@/stores/vault-store";
import { useWorkspaceStore, type WorkspaceTab } from "@/stores/workspace-store";

interface ContextMenuState {
  tab: WorkspaceTab;
  x: number;
  y: number;
}

export function TabBar() {
  const tabs = useWorkspaceStore((state) => state.tabs);
  const activeTabId = useWorkspaceStore((state) => state.activeTabId);
  const activateTab = useWorkspaceStore((state) => state.activateTab);
  const closeTab = useWorkspaceStore((state) => state.closeTab);
  const closeOtherTabs = useWorkspaceStore((state) => state.closeOtherTabs);
  const closeTabsToRight = useWorkspaceStore((state) => state.closeTabsToRight);
  const pinTab = useWorkspaceStore((state) => state.pinTab);
  const reorderTab = useWorkspaceStore((state) => state.reorderTab);
  const reopenLastClosed = useWorkspaceStore((state) => state.reopenLastClosed);
  const setActivePath = useVaultStore((state) => state.setActivePath);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (tab && useVaultStore.getState().activePath !== tab.path) {
      void setActivePath(tab.path);
    }
  }, [activeTabId, setActivePath, tabs]);

  function onClick(tab: WorkspaceTab) {
    if (tab.id !== activeTabId) {
      activateTab(tab.id);
      void setActivePath(tab.path);
    }
  }

  function onClose(tab: WorkspaceTab, event?: React.MouseEvent) {
    event?.stopPropagation();
    closeTab(tab.id);
    const next = useWorkspaceStore.getState().activeTabId;
    const nextPath = useWorkspaceStore.getState().tabs.find((t) => t.id === next)?.path ?? null;
    if (nextPath) void setActivePath(nextPath);
  }

  function onMiddleClick(tab: WorkspaceTab, event: React.MouseEvent) {
    if (event.button !== 1) return;
    event.preventDefault();
    onClose(tab);
  }

  function onContextMenu(tab: WorkspaceTab, event: React.MouseEvent) {
    event.preventDefault();
    setMenu({ tab, x: event.clientX, y: event.clientY });
  }

  if (tabs.length === 0) {
    return (
      <div className="flex h-9 items-end gap-px bg-[#08080c]/70 pl-3 pr-3 shadow-[inset_0_-1px_0_rgba(139,124,255,0.08)] backdrop-blur-xl">
        <div className="flex h-full items-center text-[10px] text-[var(--text-4)]">no open notes</div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={stripRef}
        className="flex h-9 items-end gap-px overflow-x-auto bg-[#08080c]/70 pl-3 shadow-[inset_0_-1px_0_rgba(139,124,255,0.08)] backdrop-blur-xl"
        onAuxClick={(event) => {
          if (event.button === 1 && (event.target as HTMLElement).closest("[data-tab-id]")) return;
          if (event.button === 1) {
            const path = reopenLastClosed();
            if (path) void setActivePath(path);
          }
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const title = tab.path.split("/").pop()?.replace(/\.md$/i, "") ?? tab.path;
          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              draggable
              onDragStart={() => setDragId(tab.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(event) => {
                if (dragId && dragId !== tab.id) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (!dragId || dragId === tab.id) return;
                const toIndex = tabs.findIndex((t) => t.id === tab.id);
                reorderTab(dragId, toIndex);
                setDragId(null);
              }}
              className={`group relative top-px flex max-w-[220px] cursor-pointer items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs transition ${
                isActive
                  ? "bg-gradient-to-b from-[#14141a] to-[#0e0e13] text-white shadow-[inset_0_1px_0_rgba(169,155,255,0.04),inset_0_0_0_1px_rgba(139,124,255,0.06)]"
                  : "text-[var(--text-3)] hover:bg-white/[0.025] hover:text-white"
              } ${dragId === tab.id ? "opacity-50" : ""}`}
              onClick={() => onClick(tab)}
              onMouseDown={(event) => onMiddleClick(tab, event)}
              onContextMenu={(event) => onContextMenu(tab, event)}
              title={tab.path}
            >
              {tab.pinned && <Pin size={10} className="text-[var(--violet-2)]" />}
              <span className="truncate">{title}</span>
              <button
                type="button"
                aria-label="Close tab"
                className="ml-1 grid size-4 place-items-center rounded text-[var(--text-4)] opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-white"
                onClick={(event) => onClose(tab, event)}
              >
                <X size={10} />
              </button>
            </div>
          );
        })}
        <div className="ml-1 flex items-center gap-1 px-2 pb-1">
          <button
            type="button"
            aria-label="New tab"
            className="grid size-6 place-items-center rounded text-[var(--text-3)] transition hover:bg-violet/15 hover:text-white"
            onClick={() => {
              const path = useVaultStore.getState().activePath;
              if (path) {
                useWorkspaceStore.getState().openTab(path, { activate: true });
              }
            }}
            title="Duplicate active tab"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
      {menu && (
        <TabContextMenu
          menu={menu}
          onClose={() => setMenu(null)}
          onAction={(action) => {
            const { tab } = menu;
            setMenu(null);
            switch (action) {
              case "close":
                onClose(tab);
                break;
              case "close-others":
                closeOtherTabs(tab.id);
                break;
              case "close-right":
                closeTabsToRight(tab.id);
                break;
              case "pin":
                pinTab(tab.id, !tab.pinned);
                break;
              case "copy-path":
                void navigator.clipboard.writeText(tab.path);
                break;
            }
          }}
        />
      )}
    </>
  );
}

function TabContextMenu({
  menu,
  onClose,
  onAction,
}: {
  menu: ContextMenuState;
  onClose: () => void;
  onAction: (action: "close" | "close-others" | "close-right" | "pin" | "copy-path") => void;
}) {
  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close menu"
        className="fixed inset-0 z-[1100] cursor-default bg-transparent"
        onClick={onClose}
      />
      <div
        className="fixed z-[1110] min-w-[180px] rounded-lg border border-[var(--border)] bg-[#0c0c12]/95 py-1 text-xs shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-md"
        style={{ top: menu.y, left: menu.x }}
      >
        <MenuItem onClick={() => onAction("close")}>Close</MenuItem>
        <MenuItem onClick={() => onAction("close-others")}>Close others</MenuItem>
        <MenuItem onClick={() => onAction("close-right")}>Close to the right</MenuItem>
        <div className="my-1 h-px bg-[var(--border)]" />
        <MenuItem onClick={() => onAction("pin")}>
          {menu.tab.pinned ? (
            <>
              <PinOff size={11} /> Unpin
            </>
          ) : (
            <>
              <Pin size={11} /> Pin
            </>
          )}
        </MenuItem>
        <div className="my-1 h-px bg-[var(--border)]" />
        <MenuItem onClick={() => onAction("copy-path")}>Copy file path</MenuItem>
      </div>
    </>,
    document.body,
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[var(--text-2)] transition hover:bg-violet/15 hover:text-white"
    >
      {children}
    </button>
  );
}
