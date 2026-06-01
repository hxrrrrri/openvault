import "katex/dist/katex.min.css";

import type { ReactNode } from "react";
import { isValidElement, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { commands } from "@/lib/commands";
import type { CollectionItem, CollectionQuery, SearchResult } from "@/types/domain";
import {
  getCodeBlockProcessor,
  listPostProcessors,
  runCodeBlockProcessor,
  runPostProcessors,
  subscribeProcessors,
  type MarkdownPostProcessorContext,
} from "@/features/plugins/processor-registry";
import { ensureObsidianDomShim } from "@/features/plugins/obsidian-dom";

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
    .replace(/%%[\s\S]*?%%/g, "")
    .replace(/==([\s\S]*?)==/g, "<mark>$1</mark>")
    .replace(
      /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_match, rawTarget: string, width?: string) => {
        const target = rawTarget.trim();
        const label = target.split("#")[0];
        const query = width ? `?width=${encodeURIComponent(width.trim())}` : "";
        return `![${label}](lattice-asset://${encodeURIComponent(target)}${query})`;
      },
    )
    .replace(
      /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_match, rawTarget: string, alias?: string) => {
        const target = rawTarget.trim();
        const label = alias || target.split("#")[0];
        return `[${label}](lattice://note/${encodeURIComponent(target)})`;
      },
    );
}

export function MarkdownPreview({
  content,
  notePath,
  onOpenNote,
}: MarkdownPreviewProps) {
  const segments = splitCallouts(content);
  const rootRef = useRef<HTMLElement | null>(null);
  const [processorVersion, setProcessorVersion] = useState(0);

  useEffect(() => subscribeProcessors(() => setProcessorVersion((v) => v + 1)), []);

  useEffect(() => {
    if (!rootRef.current) return;
    if (listPostProcessors().length === 0) return;
    ensureObsidianDomShim();
    const context: MarkdownPostProcessorContext = {
      sourcePath: notePath ?? "",
      frontmatter: null,
    };
    void runPostProcessors(rootRef.current, context);
  }, [content, notePath, processorVersion]);

  return (
    <article
      ref={rootRef}
      className="prose prose-invert max-w-none prose-headings:tracking-tight prose-a:text-[var(--violet-2)] prose-code:text-[var(--indigo)] lattice-prose"
      data-lattice-preview-root="true"
    >
      {segments.map((segment, index) =>
        segment.kind === "callout" && segment.callout ? (
          <Callout
            key={`${segment.kind}-${index}`}
            callout={segment.callout}
            notePath={notePath}
            onOpenNote={onOpenNote}
          />
        ) : (
          <MarkdownChunk
            key={`${segment.kind}-${index}`}
            content={segment.content}
            notePath={notePath}
            onOpenNote={onOpenNote}
          />
        ),
      )}
    </article>
  );
}

function PluginCodeBlock({ language, source, notePath }: { language: string; source: string; notePath?: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    ensureObsidianDomShim();
    host.replaceChildren();
    const context: MarkdownPostProcessorContext = {
      sourcePath: notePath ?? "",
      frontmatter: null,
    };
    void runCodeBlockProcessor(language, source, host, context);
  }, [language, source, notePath]);
  return <div ref={hostRef} className="lattice-plugin-codeblock" data-language={language} />;
}

function MarkdownChunk({
  content,
  notePath,
  onOpenNote,
}: {
  content: string;
  notePath?: string;
  onOpenNote?: (target: string) => void;
}) {
  if (!content.trim()) return null;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeRaw, rehypeKatex]}
      components={{
        a: ({ href, children }) => (
          <PreviewLink href={href} onOpenNote={onOpenNote}>
            {children}
          </PreviewLink>
        ),
        code: ({ className, children, ...props }) => {
          const language = /language-([\w-]+)/
            .exec(className ?? "")?.[1]
            ?.toLowerCase();
          const source = String(children).replace(/\n$/, "");
          if (language === "mermaid") {
            return <MermaidDiagram chart={source} />;
          }
          if (language === "query") {
            return <EmbeddedSearch query={source} onOpenNote={onOpenNote} />;
          }
          if (language === "lattice-query" || language === "lattice-database") {
            return <EmbeddedCollection source={source} onOpenNote={onOpenNote} />;
          }
          if (language && getCodeBlockProcessor(language)) {
            return <PluginCodeBlock language={language} source={source} notePath={notePath} />;
          }
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        img: ({ src, alt }) => (
          <PreviewImage src={src} alt={alt ?? ""} notePath={notePath} />
        ),
        iframe: ({ src, title, width, height, allow }) => (
          <PreviewIframe
            src={src}
            title={title}
            width={width}
            height={height}
            allow={allow}
          />
        ),
        video: ({ src, poster }) => <PreviewVideo src={src} poster={poster} />,
        audio: ({ src }) => <PreviewAudio src={src} />,
        blockquote: ({ className, children }) =>
          className?.includes("twitter-tweet") ? (
            <div className="my-4 rounded-lg border border-[#2f2a55] bg-[#11111a] px-4 py-3 text-sm shadow-[0_18px_46px_rgba(0,0,0,0.24)]">
              <div className="pixel-label mb-2 text-[10px]">Tweet</div>
              <div className="text-[var(--violet-2)]">{children}</div>
            </div>
          ) : (
            <blockquote className={className}>{children}</blockquote>
          ),
        mark: ({ children }) => (
          <mark className="rounded bg-amber-300/25 px-1 text-amber-100">
            {children}
          </mark>
        ),
        pre: ({ children }) =>
          isValidElement(children) && typeof children.type !== "string" ? (
            <>{children}</>
          ) : (
            <pre>{children}</pre>
          ),
      }}
    >
      {preprocess(content)}
    </ReactMarkdown>
  );
}

function PreviewIframe({
  src,
  title,
  width,
  height,
  allow,
}: {
  src?: string;
  title?: string;
  width?: string | number;
  height?: string | number;
  allow?: string;
}) {
  if (!src) {
    return (
      <div className="my-4 rounded-lg border border-dashed border-amber-300/25 bg-amber-400/5 px-3 py-4 text-xs text-amber-100/85">
        Missing iframe source.
      </div>
    );
  }
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-[#2c2940] bg-[#09090e] shadow-[0_18px_46px_rgba(0,0,0,0.28)]">
      <div className="flex items-center gap-2 border-b border-[#28243c] bg-[#15151e] px-3 py-2">
        <span className="pixel-label text-[10px]">{embedLabel(src)}</span>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="mono ml-auto max-w-[70%] truncate text-[10px] text-[var(--text-4)] no-underline hover:text-white"
        >
          {src.replace(/^https?:\/\//, "")}
        </a>
      </div>
      <iframe
        src={src}
        title={title || embedLabel(src)}
        allow={allow}
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="block border-0 bg-black"
        style={{
          width: cssSize(width, "100%"),
          height: cssSize(height, "420px"),
          maxWidth: "100%",
        }}
      />
    </div>
  );
}

function PreviewVideo({ src, poster }: { src?: string; poster?: string }) {
  if (!src) {
    return (
      <div className="my-4 rounded-lg border border-dashed border-amber-300/25 bg-amber-400/5 px-3 py-4 text-xs text-amber-100/85">
        Missing video source.
      </div>
    );
  }
  return (
    <video
      src={src}
      poster={poster}
      controls
      className="my-4 max-h-[520px] w-full rounded-xl border border-[#2c2940] bg-black shadow-[0_18px_46px_rgba(0,0,0,0.28)]"
    />
  );
}

function PreviewAudio({ src }: { src?: string }) {
  if (!src) {
    return (
      <div className="my-4 rounded-lg border border-dashed border-amber-300/25 bg-amber-400/5 px-3 py-4 text-xs text-amber-100/85">
        Missing audio source.
      </div>
    );
  }
  return <audio src={src} controls className="my-4 w-full" />;
}

function MermaidDiagram({ chart }: { chart: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useMemo(() => `lattice-mermaid-${hashString(chart)}`, [chart]);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(null);
    void import("mermaid")
      .then(async (module) => {
        const mermaid = module.default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "strict",
          fontFamily: "Inter, ui-sans-serif, system-ui",
        });
        const result = await mermaid.render(id, chart);
        if (!cancelled) setSvg(result.svg);
      })
      .catch((error) => {
        if (!cancelled)
          setError(
            error instanceof Error
              ? error.message
              : "Could not render Mermaid diagram",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <pre className="my-4 overflow-auto rounded-lg border border-red-400/25 bg-red-500/5 p-3 text-xs text-[var(--danger)]">
        {error}
        {"\n\n"}
        {chart}
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className="my-4 rounded-lg border border-[var(--border)] bg-white/[0.025] px-3 py-2 text-xs text-[var(--text-3)]">
        Rendering diagram...
      </div>
    );
  }

  return (
    <div
      className="my-4 overflow-auto rounded-lg border border-[var(--border)] bg-[#08080c] p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function EmbeddedSearch({
  query,
  onOpenNote,
}: {
  query: string;
  onOpenNote?: (target: string) => void;
}) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void commands
      .search(query)
      .then((next) => {
        if (!cancelled) setResults(next.slice(0, 12));
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-[var(--border)] bg-white/[0.025]">
      <div className="border-b border-[var(--border)] px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-3)]">
        Query {loading ? "..." : `- ${results.length} results`}
      </div>
      <div className="divide-y divide-[var(--border)]">
        {results.map((result) => (
          <button
            key={result.path}
            type="button"
            className="block w-full px-3 py-2 text-left hover:bg-white/[0.03]"
            onClick={() => onOpenNote?.(result.path)}
          >
            <span className="block text-sm text-[var(--violet-2)]">
              {result.title}
            </span>
            <span className="mt-1 block text-xs leading-5 text-[var(--text-3)]">
              {result.excerpt}
            </span>
            <span className="mono mt-1 block text-[10px] text-[var(--text-4)]">
              {result.path}
            </span>
          </button>
        ))}
        {!results.length && (
          <div className="px-3 py-3 text-xs text-[var(--text-3)]">
            {loading ? "Searching..." : "No results."}
          </div>
        )}
      </div>
    </div>
  );
}

function EmbeddedCollection({
  source,
  onOpenNote,
}: {
  source: string;
  onOpenNote?: (target: string) => void;
}) {
  const spec = useMemo(() => parseCollectionQuery(source), [source]);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void commands
      .listCollectionItems(spec.query)
      .then((next) => {
        if (!cancelled) setItems(next);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [spec.query]);

  const columns = spec.columns.length
    ? spec.columns
    : inferCollectionColumns(items).slice(0, 5);

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-[#2f2a55] bg-[#0d0d14] shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
      <div className="flex items-center gap-2 border-b border-[#28243c] bg-[#15151e] px-3 py-2">
        <span className="pixel-label text-[10px]">Lattice query</span>
        <span className="mono ml-auto text-[10px] text-[var(--text-3)]">
          {loading ? "loading" : `${items.length} notes`}
        </span>
      </div>
      <div className="overflow-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-xs">
          <thead className="text-[var(--text-3)]">
            <tr>
              {columns.map((column) => (
                <th key={column} className="border-b border-[#28243c] px-3 py-2 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.path} className="border-b border-[#211f31] last:border-b-0 hover:bg-violet/5">
                {columns.map((column) => (
                  <td key={column} className="max-w-[260px] truncate px-3 py-2 text-[var(--text-2)]">
                    {column === "title" ? (
                      <button
                        type="button"
                        className="text-left font-medium text-[var(--violet-2)] hover:text-white"
                        onClick={() => onOpenNote?.(item.path)}
                        title={item.path}
                      >
                        {item.title}
                      </button>
                    ) : (
                      collectionValue(item, column)
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td className="px-3 py-4 text-[var(--text-3)]" colSpan={Math.max(1, columns.length)}>
                  {loading ? "Loading collection..." : "No matching notes."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PreviewImage({
  src,
  alt,
  notePath,
}: {
  src?: string;
  alt: string;
  notePath?: string;
}) {
  const [resolved, setResolved] = useState<string | null>(src ?? null);
  const localAsset = src?.startsWith("lattice-asset://");
  const width = localAsset && src ? widthFromAssetUrl(src) : null;

  useEffect(() => {
    if (!src || !localAsset) {
      setResolved(src ?? null);
      return;
    }
    let cancelled = false;
    const target = decodeURIComponent(
      src.replace(/^lattice-asset:\/\//, "").split("?")[0],
    );
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
    return (
      <span className="my-3 block rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--text-3)]">
        Missing image: {alt}
      </span>
    );
  }

  if (resolved.startsWith("data:application/pdf")) {
    return (
      <object
        data={resolved}
        type="application/pdf"
        className="my-4 h-[520px] w-full rounded-lg border border-[var(--border)]"
        aria-label={alt}
      />
    );
  }

  if (resolved.startsWith("data:audio/")) {
    return <audio src={resolved} controls className="my-4 w-full" />;
  }

  if (resolved.startsWith("data:video/")) {
    return (
      <video
        src={resolved}
        controls
        className="my-4 max-h-[520px] w-full rounded-lg border border-[var(--border)]"
      />
    );
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

function PreviewLink({
  href,
  children,
  onOpenNote,
}: {
  href?: string;
  children: ReactNode;
  onOpenNote?: (target: string) => void;
}) {
  const isNote = href?.startsWith("lattice://note/");
  const isEmbed = href?.startsWith("lattice://embed/");
  if (!isNote && !isEmbed) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  const target = decodeURIComponent(
    (href ?? "").replace(/^lattice:\/\/(?:note|embed)\//, ""),
  );
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

function Callout({
  callout,
  notePath,
  onOpenNote,
}: {
  callout: NonNullable<Segment["callout"]>;
  notePath?: string;
  onOpenNote?: (target: string) => void;
}) {
  const tone = toneFor(callout.type);
  return (
    <details
      open={!callout.collapsed}
      className={`my-4 rounded-lg border p-0 ${tone.border} ${tone.bg}`}
    >
      <summary
        className={`cursor-pointer select-none px-4 py-3 text-sm font-semibold ${tone.text}`}
      >
        <span className="mono mr-2 text-[10px] uppercase">{callout.type}</span>
        {callout.title}
      </summary>
      {callout.body.trim() && (
        <div className="border-t border-[#28243c] px-4 py-3">
          <MarkdownChunk
            content={callout.body}
            notePath={notePath}
            onOpenNote={onOpenNote}
          />
        </div>
      )}
    </details>
  );
}

function parseCollectionQuery(source: string): {
  query: CollectionQuery;
  columns: string[];
} {
  const query: CollectionQuery = { limit: 50 };
  const columns = ["title"];
  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    const from = line.match(/^from\s+(.+)$/i);
    if (from) {
      const value = stripQuotes(from[1].trim());
      query.folder = value && value.toLowerCase() !== "notes" ? value : null;
      continue;
    }

    const where = line.match(/^where\s+(.+)$/i);
    if (where) {
      query.propertyFilters = where[1]
        .split(/\s+and\s+/i)
        .map(parseCollectionFilter)
        .filter(Boolean) as NonNullable<CollectionQuery["propertyFilters"]>;
      continue;
    }

    const sort = line.match(/^sort\s+([A-Za-z][\w-]*)(?:\s+(asc|desc))?$/i);
    if (sort) {
      query.sort = {
        field: sort[1],
        direction: (sort[2]?.toLowerCase() as "asc" | "desc" | undefined) ?? "desc",
      };
      continue;
    }

    const limit = line.match(/^limit\s+(\d+)$/i);
    if (limit) {
      query.limit = Number(limit[1]);
      continue;
    }

    const text = line.match(/^(?:text|search)\s+(.+)$/i);
    if (text) {
      query.text = stripQuotes(text[1].trim());
      continue;
    }

    const columnLine = line.match(/^columns?\s+(.+)$/i);
    if (columnLine) {
      columns.splice(
        0,
        columns.length,
        ...columnLine[1]
          .split(",")
          .map((column) => column.trim())
          .filter(Boolean),
      );
    }
  }
  if (!columns.includes("title")) columns.unshift("title");
  return { query, columns };
}

function parseCollectionFilter(input: string): NonNullable<CollectionQuery["propertyFilters"]>[number] | null {
  const exists = input.match(/^([A-Za-z][\w-]*)\s+exists$/i);
  if (exists) {
    return { key: exists[1], op: "exists" };
  }

  const match = input.match(/^([A-Za-z][\w-]*)\s*(==|=|!=|>=|<=|>|<|contains)\s*(.+)$/i);
  if (!match) return null;
  const [, key, operator, rawValue] = match;
  return {
    key,
    op: operatorToFilter(operator),
    value: parseQueryValue(rawValue.trim()),
  };
}

function operatorToFilter(operator: string): NonNullable<CollectionQuery["propertyFilters"]>[number]["op"] {
  if (operator === "!=") return "neq";
  if (operator === ">") return "gt";
  if (operator === ">=") return "gte";
  if (operator === "<") return "lt";
  if (operator === "<=") return "lte";
  if (operator.toLowerCase() === "contains") return "contains";
  return "eq";
}

function parseQueryValue(value: string): unknown {
  const stripped = stripQuotes(value);
  if (stripped.toLowerCase() === "true") return true;
  if (stripped.toLowerCase() === "false") return false;
  const number = Number(stripped);
  if (Number.isFinite(number) && stripped.trim() !== "") return number;
  return stripped;
}

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

function inferCollectionColumns(items: CollectionItem[]): string[] {
  const properties = Array.from(new Set(items.flatMap((item) => Object.keys(item.properties)))).sort();
  return ["title", ...properties, "tags", "modifiedAt"];
}

function collectionValue(item: CollectionItem, column: string): string {
  if (column === "path") return item.path;
  if (column === "tags") return item.tags.join(", ");
  if (column === "modifiedAt") return item.modifiedAt;
  if (column === "wordCount") return String(item.wordCount);
  return valueToDisplay(item.properties[column]);
}

function valueToDisplay(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(valueToDisplay).filter(Boolean).join(", ");
  return "";
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
    return {
      border: "border-amber-300/25",
      bg: "bg-amber-400/5",
      text: "text-[var(--warning)]",
    };
  }
  if (["danger", "error", "failure", "bug"].includes(type)) {
    return {
      border: "border-red-400/25",
      bg: "bg-red-500/5",
      text: "text-[var(--danger)]",
    };
  }
  if (["success", "check", "done"].includes(type)) {
    return {
      border: "border-emerald-300/25",
      bg: "bg-emerald-400/5",
      text: "text-[var(--success)]",
    };
  }
  if (["quote", "cite"].includes(type)) {
    return {
      border: "border-[#312a4d]",
      bg: "bg-white/[0.03]",
      text: "text-[var(--text-2)]",
    };
  }
  return {
    border: "border-violet/25",
    bg: "bg-violet/10",
    text: "text-[var(--violet-2)]",
  };
}

function titleFor(type: string) {
  return type
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function cssSize(value: string | number | undefined, fallback: string) {
  if (typeof value === "number") return `${value}px`;
  if (!value) return fallback;
  return /^\d+(\.\d+)?$/.test(value) ? `${value}px` : value;
}

function embedLabel(src: string) {
  if (/youtube\.com\/embed|youtu\.be|youtube\.com/i.test(src)) return "YouTube";
  if (/vimeo\.com/i.test(src)) return "Vimeo";
  return "Iframe";
}
