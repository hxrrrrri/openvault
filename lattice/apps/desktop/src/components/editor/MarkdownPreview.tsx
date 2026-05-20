import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { commands } from "@/lib/commands";

interface MarkdownPreviewProps {
  content: string;
  notePath?: string;
  onOpenNote?: (target: string) => void;
}

interface Segment {
  kind: "markdown" | "callout";
  content: string;
  callout?: {
    type: string;
    title: string;
    collapsed: boolean;
    body: string;
  };
}

function preprocess(content: string): string {
  return content
    .replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, rawTarget: string, width?: string) => {
      const target = rawTarget.trim();
      const label = target.split("#")[0];
      const query = width ? `?width=${encodeURIComponent(width.trim())}` : "";
      return `![${label}](lattice-asset://${encodeURIComponent(target)}${query})`;
    })
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, rawTarget: string, alias?: string) => {
      const target = rawTarget.trim();
      const label = alias || target.split("#")[0];
      return `[${label}](lattice://note/${encodeURIComponent(target)})`;
    });
}

export function MarkdownPreview({ content, notePath, onOpenNote }: MarkdownPreviewProps) {
  const segments = splitCallouts(content);
  return (
    <article className="prose prose-invert max-w-none prose-headings:tracking-normal prose-a:text-[var(--violet-2)] prose-code:text-[var(--indigo)]">
      {segments.map((segment, index) =>
        segment.kind === "callout" && segment.callout ? (
          <Callout key={`${segment.kind}-${index}`} callout={segment.callout} notePath={notePath} onOpenNote={onOpenNote} />
        ) : (
          <MarkdownChunk key={`${segment.kind}-${index}`} content={segment.content} notePath={notePath} onOpenNote={onOpenNote} />
        ),
      )}
    </article>
  );
}

function MarkdownChunk({ content, notePath, onOpenNote }: { content: string; notePath?: string; onOpenNote?: (target: string) => void }) {
  if (!content.trim()) return null;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => <PreviewLink href={href} onOpenNote={onOpenNote}>{children}</PreviewLink>,
        img: ({ src, alt }) => <PreviewImage src={src} alt={alt ?? ""} notePath={notePath} />,
      }}
    >
      {preprocess(content)}
    </ReactMarkdown>
  );
}

function PreviewImage({ src, alt, notePath }: { src?: string; alt: string; notePath?: string }) {
  const [resolved, setResolved] = useState<string | null>(src ?? null);
  const localAsset = src?.startsWith("lattice-asset://");
  const width = localAsset && src ? widthFromAssetUrl(src) : null;

  useEffect(() => {
    if (!src || !localAsset) {
      setResolved(src ?? null);
      return;
    }
    let cancelled = false;
    const target = decodeURIComponent(src.replace(/^lattice-asset:\/\//, "").split("?")[0]);
    void commands
      .readAssetDataUrl(target, notePath)
      .then((dataUrl) => {
        if (!cancelled) setResolved(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setResolved(null);
      });
    return () => {
      cancelled = true;
    };
  }, [localAsset, notePath, src]);

  if (!resolved) {
    return <span className="my-3 block rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--text-3)]">Missing image: {alt}</span>;
  }

  if (resolved.startsWith("data:application/pdf")) {
    return <object data={resolved} type="application/pdf" className="my-4 h-[520px] w-full rounded-lg border border-[var(--border)]" aria-label={alt} />;
  }

  if (resolved.startsWith("data:audio/")) {
    return <audio src={resolved} controls className="my-4 w-full" />;
  }

  if (resolved.startsWith("data:video/")) {
    return <video src={resolved} controls className="my-4 max-h-[520px] w-full rounded-lg border border-[var(--border)]" />;
  }

  return (
    <img
      src={resolved}
      alt={alt}
      className="my-4 max-h-[520px] rounded-lg border border-[var(--border)] object-contain"
      style={{ width: width ?? undefined, maxWidth: "100%" }}
      loading="lazy"
    />
  );
}

function PreviewLink({ href, children, onOpenNote }: { href?: string; children: ReactNode; onOpenNote?: (target: string) => void }) {
  const isNote = href?.startsWith("lattice://note/");
  const isEmbed = href?.startsWith("lattice://embed/");
  if (!isNote && !isEmbed) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  const target = decodeURIComponent((href ?? "").replace(/^lattice:\/\/(?:note|embed)\//, ""));
  return (
    <button
      type="button"
      className="inline rounded border border-violet/25 bg-violet/10 px-1.5 py-0.5 text-left text-[var(--violet-2)] transition hover:border-violet/50 hover:bg-violet/15"
      onClick={() => onOpenNote?.(target)}
      title={target}
    >
      {children}
    </button>
  );
}

function Callout({ callout, notePath, onOpenNote }: { callout: NonNullable<Segment["callout"]>; notePath?: string; onOpenNote?: (target: string) => void }) {
  const tone = toneFor(callout.type);
  return (
    <details
      open={!callout.collapsed}
      className={`my-4 rounded-lg border p-0 ${tone.border} ${tone.bg}`}
    >
      <summary className={`cursor-pointer select-none px-4 py-3 text-sm font-semibold ${tone.text}`}>
        <span className="mono mr-2 text-[10px] uppercase">{callout.type}</span>
        {callout.title}
      </summary>
      {callout.body.trim() && (
        <div className="border-t border-white/10 px-4 py-3">
          <MarkdownChunk content={callout.body} notePath={notePath} onOpenNote={onOpenNote} />
        </div>
      )}
    </details>
  );
}

function widthFromAssetUrl(src: string): number | null {
  const raw = new URLSearchParams(src.split("?")[1] ?? "").get("width");
  const number = Number(raw?.replace(/[^\d.]/g, ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function splitCallouts(content: string): Segment[] {
  const lines = content.split("\n");
  const segments: Segment[] = [];
  let markdown: string[] = [];
  let index = 0;

  function flushMarkdown() {
    if (!markdown.length) return;
    segments.push({ kind: "markdown", content: markdown.join("\n") });
    markdown = [];
  }

  while (index < lines.length) {
    const line = lines[index];
    const header = line.match(/^>\s*\[!([A-Za-z][\w-]*)\]([+-]?)(?:\s+(.*))?$/);
    if (!header) {
      markdown.push(line);
      index += 1;
      continue;
    }

    flushMarkdown();
    const [, type, marker, title] = header;
    const body: string[] = [];
    index += 1;
    while (index < lines.length && lines[index].startsWith(">")) {
      body.push(lines[index].replace(/^>\s?/, ""));
      index += 1;
    }
    segments.push({
      kind: "callout",
      content: "",
      callout: {
        type: type.toLowerCase(),
        title: title?.trim() || titleFor(type),
        collapsed: marker === "-",
        body: body.join("\n"),
      },
    });
  }

  flushMarkdown();
  return segments;
}

function toneFor(type: string) {
  if (["warning", "caution", "attention"].includes(type)) {
    return { border: "border-amber-300/25", bg: "bg-amber-400/5", text: "text-[var(--warning)]" };
  }
  if (["danger", "error", "failure", "bug"].includes(type)) {
    return { border: "border-red-400/25", bg: "bg-red-500/5", text: "text-[var(--danger)]" };
  }
  if (["success", "check", "done"].includes(type)) {
    return { border: "border-emerald-300/25", bg: "bg-emerald-400/5", text: "text-[var(--success)]" };
  }
  if (["quote", "cite"].includes(type)) {
    return { border: "border-white/15", bg: "bg-white/[0.03]", text: "text-[var(--text-2)]" };
  }
  return { border: "border-violet/25", bg: "bg-violet/10", text: "text-[var(--violet-2)]" };
}

function titleFor(type: string) {
  return type
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
