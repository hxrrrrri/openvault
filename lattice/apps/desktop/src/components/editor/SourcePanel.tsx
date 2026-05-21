import { Copy, FileCode2, PanelRightClose } from "lucide-react";
import { useMemo, useState } from "react";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import type { CompletionDataSource } from "@/components/editor/completions";

interface SourcePanelProps {
  content: string;
  notePath: string;
  onChange?: (next: string) => void;
  onCollapse?: () => void;
  onOpenLink?: (target: string) => void;
  completionSource?: CompletionDataSource;
}

export function SourcePanel({
  content,
  notePath,
  onChange,
  onCollapse,
  onOpenLink,
  completionSource,
}: SourcePanelProps) {
  const [copied, setCopied] = useState(false);
  const stats = useMemo(() => ({
    lines: content.split("\n").length,
    chars: content.length,
  }), [content]);

  function copyAll() {
    void navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  }

  const editable = typeof onChange === "function";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#08080c]/80">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[#0c0c12]/80 px-4 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-[rgba(139,124,255,0.12)] text-[var(--violet-2)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.08)]">
            <FileCode2 size={13} />
          </span>
          <div className="leading-tight">
            <div className="pixel-label text-[10px]">{editable ? "Markdown source · editable" : "Markdown source"}</div>
            <div className="mono truncate text-[11px] text-[var(--text-3)]" title={notePath}>
              {notePath}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copyAll}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-white/[0.025] px-2.5 py-1 text-[10px] text-[var(--text-3)] transition hover:border-violet/40 hover:text-white"
            title="Copy raw markdown"
          >
            <Copy size={11} />
            {copied ? "copied" : "copy"}
          </button>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="grid size-7 place-items-center rounded-md bg-white/[0.025] text-[var(--text-3)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.08)] transition hover:bg-violet/10 hover:text-white"
              title="Collapse markdown source"
            >
              <PanelRightClose size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <MarkdownEditor
          value={content}
          onChange={(next) => onChange?.(next)}
          livePreviewEnabled={false}
          completionSource={completionSource}
          onOpenLink={onOpenLink}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[#0c0c12]/80 px-4 py-1.5 text-[10px] text-[var(--text-4)]">
        <span className="mono">{stats.lines} lines</span>
        <span className="mono">{stats.chars.toLocaleString()} chars</span>
        <span className="mono uppercase tracking-[0.12em]">.md · ctrl+f find · ctrl+h replace</span>
      </div>
    </div>
  );
}
