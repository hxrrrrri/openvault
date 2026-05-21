import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MarkdownPreview } from "@/components/editor/MarkdownPreview";
import { commands } from "@/lib/commands";
import { useVaultStore } from "@/stores/vault-store";

interface HoverState {
  target: string;
  x: number;
  y: number;
}

const DELAY_MS = 280;

export function PagePreview() {
  const [hover, setHover] = useState<HoverState | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [resolvedPath, setResolvedPath] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const openLinkedNote = useVaultStore((state) => state.openLinkedNote);

  useEffect(() => {
    function onMove(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const link = target?.closest<HTMLElement>(
        "[data-target], .cm-lp-wikilink, .cm-lp-embed",
      );
      if (!link) {
        if (timer.current) {
          window.clearTimeout(timer.current);
          timer.current = null;
        }
        if (hover) setHover(null);
        return;
      }
      const wikiTarget = link.dataset.target ?? link.textContent ?? "";
      if (!wikiTarget) return;
      if (timer.current) window.clearTimeout(timer.current);
      const rect = link.getBoundingClientRect();
      timer.current = window.setTimeout(() => {
        setHover({ target: wikiTarget, x: rect.left, y: rect.bottom + 6 });
      }, DELAY_MS);
    }

    function onLeave(event: MouseEvent) {
      const related = event.relatedTarget as HTMLElement | null;
      if (related?.closest("[data-preview-popover]")) return;
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      setHover(null);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [hover]);

  useEffect(() => {
    if (!hover) {
      setContent(null);
      setResolvedPath(null);
      return;
    }
    const cleanTarget = hover.target.split("#")[0].split("|")[0].trim();
    if (!cleanTarget) return;
    const files = useVaultStore.getState().files;
    const path = findNotePath(files, cleanTarget);
    if (!path) {
      setContent("*Note does not exist yet.*");
      setResolvedPath(null);
      return;
    }
    setResolvedPath(path);
    commands
      .readNote(path)
      .then((note) => setContent(note.content))
      .catch(() => setContent("Could not load preview."));
  }, [hover]);

  if (!hover) return null;

  return createPortal(
    <div
      data-preview-popover
      className="fixed z-[1200] max-h-[360px] w-[420px] overflow-hidden rounded-lg border border-violet/30 bg-[#0c0c12]/95 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-md"
      style={{
        top: clamp(hover.y, 8, window.innerHeight - 380),
        left: clamp(hover.x, 8, window.innerWidth - 440),
      }}
      onMouseEnter={() => {
        if (timer.current) {
          window.clearTimeout(timer.current);
          timer.current = null;
        }
      }}
      onMouseLeave={() => setHover(null)}
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-1.5 text-[10px] text-[var(--text-3)]">
        <span className="mono truncate">{resolvedPath ?? hover.target}</span>
        {resolvedPath && (
          <button
            type="button"
            className="text-[var(--violet-2)] hover:text-white"
            onClick={() => {
              setHover(null);
              void openLinkedNote(hover.target);
            }}
          >
            Open
          </button>
        )}
      </div>
      <div className="max-h-[320px] overflow-y-auto px-4 py-3 text-xs">
        {content === null ? (
          <span className="text-[var(--text-3)]">Loading…</span>
        ) : resolvedPath ? (
          <MarkdownPreview
            content={content}
            notePath={resolvedPath}
            onOpenNote={(target) => {
              setHover(null);
              void openLinkedNote(target);
            }}
          />
        ) : (
          <span className="text-[var(--text-3)]">{content}</span>
        )}
      </div>
    </div>,
    document.body,
  );
}

function findNotePath(
  nodes: Array<{ kind: string; isMarkdown?: boolean; path: string; name: string; children?: unknown[] }>,
  target: string,
): string | null {
  const normalized = target.replace(/\\/g, "/").replace(/\.md$/i, "").toLowerCase();
  const queue = [...nodes];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.kind === "file" && node.isMarkdown) {
      const path = node.path.replace(/\.md$/i, "").toLowerCase();
      const basename = node.name.replace(/\.md$/i, "").toLowerCase();
      if (path === normalized || basename === normalized) return node.path;
    }
    if (node.children) queue.push(...(node.children as typeof queue));
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
