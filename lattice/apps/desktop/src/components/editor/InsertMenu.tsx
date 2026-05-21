import {
  Code2,
  FileText,
  Film,
  Hash,
  Image as ImageIcon,
  Link,
  ListChecks,
  Minus,
  Music,
  Paperclip,
  Quote,
  Search,
  Smile,
  Sparkles,
  Table2,
  Twitter,
  Youtube,
} from "lucide-react";
import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { EmojiPicker } from "@/components/editor/EmojiPicker";

interface InsertMenuProps {
  onInsert: (text: string) => void;
  onPickLocalFiles?: (files: FileList) => void;
  onClose: () => void;
  maxHeight?: number;
  width?: number;
}

type Mode =
  | "root"
  | "emoji"
  | "image-url"
  | "gif-url"
  | "video-url"
  | "audio-url"
  | "youtube-url"
  | "vimeo-url"
  | "twitter-url"
  | "iframe-url"
  | "file-url";

const LOCAL_MEDIA_ACCEPT = [
  "image/*",
  "audio/*",
  "video/*",
  "application/pdf",
  ".gif",
  ".webp",
  ".svg",
  ".md",
  ".txt",
  ".csv",
  ".json",
].join(",");

const RICH_SNIPPETS = {
  studyPanel: `> [!note] Study block
> **Key idea:** 
>
> **Why it matters:** 
>
> **Evidence / source:** 
>
> **Active recall:** 
> - Question:
> - Answer:

`,
  toggle: `> [!question]- Toggle question
> Prompt or question goes here.
>
> Hidden answer, worked example, or explanation.

`,
  cornell: `| Cue | Notes |
| --- | --- |
| Key question | Main notes, diagram references, formulas, or links |
| Recall prompt | Answer in your own words |

> [!summary] Summary
> Write the compressed takeaway after review.

`,
  kanban: `| Backlog | Doing | Done |
| --- | --- | --- |
| - [ ] Idea | - [ ] Current task | - [x] Finished task |
| - [ ] Follow-up |  |  |

`,
  mediaGrid: `| Reference | Notes |
| --- | --- |
| ![[Attachments/example-image.png\\|260]] | Observation, label, or link |
| ![[Attachments/second-image.png\\|260]] | Comparison or evidence |

`,
  mermaid: "```mermaid\nflowchart LR\n  A[Idea] --> B{Evidence}\n  B --> C[Note]\n  B --> D[Action]\n```\n",
  query: "```lattice-query\nfrom notes\nwhere type = \"project\"\nsort modifiedAt desc\ncolumns title, status, tags, modifiedAt\nlimit 20\n```\n",
};

export function InsertMenu({ onInsert, onPickLocalFiles, onClose, maxHeight = 520, width = 390 }: InsertMenuProps) {
  const [mode, setMode] = useState<Mode>("root");
  const [query, setQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function insert(text: string) {
    onInsert(text);
    onClose();
  }

  function pickLocalFiles(files: FileList | null) {
    if (!files?.length || !onPickLocalFiles) return;
    onPickLocalFiles(files);
    onClose();
  }

  if (mode === "emoji") {
    return (
      <div onMouseDown={preventEditorBlur}>
        <EmojiPicker maxHeight={maxHeight} onPick={(emoji) => insert(emoji)} onClose={onClose} />
      </div>
    );
  }

  if (mode !== "root") {
    return (
      <div onMouseDown={preventEditorBlur}>
        <UrlPrompt
          mode={mode}
          maxHeight={maxHeight}
          width={Math.min(width, 390)}
          onCancel={() => setMode("root")}
          onSubmit={(payload) => {
            insert(payload);
          }}
        />
      </div>
    );
  }

  const sections = [
    {
      title: "Rich notes",
      items: [
        {
          icon: <Sparkles size={14} />,
          label: "Study panel",
          hint: "key idea, evidence, recall",
          onClick: () => insert(RICH_SNIPPETS.studyPanel),
        },
        {
          icon: <Quote size={14} />,
          label: "Toggle block",
          hint: "collapsible Obsidian callout",
          onClick: () => insert(RICH_SNIPPETS.toggle),
        },
        {
          icon: <Table2 size={14} />,
          label: "Cornell notes",
          hint: "cue, notes, summary",
          onClick: () => insert(RICH_SNIPPETS.cornell),
        },
        {
          icon: <ListChecks size={14} />,
          label: "Kanban board",
          hint: "tasks by state",
          onClick: () => insert(RICH_SNIPPETS.kanban),
        },
        {
          icon: <ImageIcon size={14} />,
          label: "Media grid",
          hint: "image-heavy note layout",
          onClick: () => insert(RICH_SNIPPETS.mediaGrid),
        },
        {
          icon: <Code2 size={14} />,
          label: "Mermaid diagram",
          hint: "flowchart block",
          onClick: () => insert(RICH_SNIPPETS.mermaid),
        },
        {
          icon: <Table2 size={14} />,
          label: "Database query",
          hint: "live Markdown table",
          onClick: () => insert(RICH_SNIPPETS.query),
        },
      ],
    },
    {
      title: "Write",
      items: [
        { icon: <Hash size={14} />, label: "Heading 1", hint: "# Section title", onClick: () => insert("# ") },
        { icon: <Hash size={14} />, label: "Heading 2", hint: "## Subsection", onClick: () => insert("## ") },
        { icon: <ListChecks size={14} />, label: "Task list", hint: "- [ ] actionable item", onClick: () => insert("- [ ] ") },
        { icon: <Quote size={14} />, label: "Quote / callout", hint: "> [!note]", onClick: () => insert("> [!note] Note\n> ") },
        { icon: <Code2 size={14} />, label: "Code block", hint: "fenced block", onClick: () => insert("```\n\n```\n") },
        { icon: <Table2 size={14} />, label: "Table", hint: "2 columns", onClick: () => insert("| Column | Column |\n| --- | --- |\n| Cell | Cell |\n") },
        { icon: <Minus size={14} />, label: "Divider", hint: "horizontal rule", onClick: () => insert("\n---\n") },
        { icon: <Smile size={14} />, label: "Emoji", hint: "emoji picker", onClick: () => setMode("emoji") },
      ],
    },
    {
      title: "Media",
      items: [
        ...(onPickLocalFiles
          ? [
              {
                icon: <Paperclip size={14} />,
                label: "Local attachment",
                hint: "image, PDF, audio, video",
                onClick: () => fileInputRef.current?.click(),
              },
            ]
          : []),
        { icon: <ImageIcon size={14} />, label: "Image URL", hint: "remote image", onClick: () => setMode("image-url") },
        { icon: <Sparkles size={14} />, label: "GIF URL", hint: "Giphy, Tenor, direct GIF", onClick: () => setMode("gif-url") },
        { icon: <Film size={14} />, label: "Video URL", hint: "mp4 or webm", onClick: () => setMode("video-url") },
        { icon: <Music size={14} />, label: "Audio URL", hint: "mp3, wav, ogg", onClick: () => setMode("audio-url") },
        { icon: <FileText size={14} />, label: "File link", hint: "PDF or document URL", onClick: () => setMode("file-url") },
      ],
    },
    {
      title: "Embed",
      items: [
        { icon: <Youtube size={14} />, label: "YouTube", hint: "video player", onClick: () => setMode("youtube-url") },
        { icon: <Film size={14} />, label: "Vimeo", hint: "video player", onClick: () => setMode("vimeo-url") },
        { icon: <Twitter size={14} />, label: "Tweet", hint: "linked quote", onClick: () => setMode("twitter-url") },
        { icon: <Link size={14} />, label: "Iframe / web page", hint: "embedded page", onClick: () => setMode("iframe-url") },
      ],
    },
  ].map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      const normalized = query.trim().toLowerCase();
      return !normalized || `${item.label} ${item.hint}`.toLowerCase().includes(normalized);
    }),
  }));

  return (
    <div
      onMouseDown={preventEditorBlur}
      className="anim-fade-up flex max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl bg-[#0b0b12] shadow-[0_28px_90px_rgba(0,0,0,0.78),inset_0_0_0_1px_rgba(139,124,255,0.18)]"
      style={{ width, maxHeight }}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={LOCAL_MEDIA_ACCEPT}
        className="hidden"
        onChange={(event) => {
          pickLocalFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <div className="border-b border-[#28243c] bg-[#15151e] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-violet/10 text-[var(--violet-2)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.14)]">
            <Sparkles size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold">Insert block</div>
            <div className="mono mt-0.5 text-[10px] text-[var(--text-4)]">markdown, media, embeds</div>
          </div>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2 text-[var(--text-4)]" size={13} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search insert actions"
            className="w-full rounded-lg border-transparent bg-[#0b0b10] py-1.5 pl-8 pr-2 text-xs text-[var(--text)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.1)] outline-none placeholder:text-[var(--text-4)] focus:shadow-[inset_0_0_0_1px_rgba(169,155,255,0.32)]"
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
            }}
          />
        </div>
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#0b0b12] p-2"
      >
        {sections.map((section) =>
          section.items.length > 0 ? (
            <Section key={section.title} title={section.title}>
              {section.items.map((item) => (
                <Item key={item.label} {...item} />
              ))}
            </Section>
          ) : null,
        )}
        {sections.every((section) => section.items.length === 0) && (
          <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--text-3)]">
            No insert actions found.
          </div>
        )}
      </div>
    </div>
  );
}

function preventEditorBlur(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (target.closest("input, textarea, button")) return;
  event.preventDefault();
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-1">
      <div className="pixel-label px-2 py-1 text-[9px]">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-1.5">{children}</div>
    </div>
  );
}

function Item({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint ? `${label}: ${hint}` : label}
      className="group flex min-h-12 items-center gap-2 rounded-lg bg-[#171721] p-2 text-left shadow-[inset_0_0_0_1px_rgba(139,124,255,0.075)] transition hover:bg-[#211c36] hover:text-white hover:shadow-[inset_0_0_0_1px_rgba(169,155,255,0.24)]"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[#0a0a10] text-[var(--violet-2)] group-hover:border-violet/30 group-hover:text-white">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium leading-tight">{label}</span>
        {hint && <span className="mt-0.5 block truncate text-[10px] text-[var(--text-4)]">{hint}</span>}
      </span>
    </button>
  );
}

function UrlPrompt({
  mode,
  maxHeight,
  width,
  onCancel,
  onSubmit,
}: {
  mode: Exclude<Mode, "root" | "emoji">;
  maxHeight: number;
  width: number;
  onCancel: () => void;
  onSubmit: (text: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const meta = METADATA[mode];

  function handle() {
    const trimmed = url.trim();
    if (!trimmed) return;
    onSubmit(meta.format(trimmed, alt.trim()));
  }

  return (
    <div
      className="max-w-[calc(100vw-32px)] overflow-y-auto overscroll-contain rounded-xl bg-[#0b0b12] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.7),inset_0_0_0_1px_rgba(139,124,255,0.16)]"
      style={{ width, maxHeight }}
    >
      <div className="flex items-center gap-2 text-xs text-[var(--text-2)]">
        <span className="grid size-6 place-items-center rounded-md bg-violet/10 text-[var(--violet-2)] shadow-[inset_0_0_0_1px_rgba(169,155,255,0.12)]">
          {meta.icon}
        </span>
        <span className="font-semibold">{meta.title}</span>
        <button
          type="button"
          onClick={onCancel}
          className="ml-auto text-[var(--text-3)] transition hover:text-white"
        >
          ←
        </button>
      </div>
      <div className="mt-2 text-[10px] text-[var(--text-3)]">{meta.hint}</div>
      <input
        autoFocus
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder={meta.placeholder}
        className="mt-3 w-full rounded-lg border-transparent bg-[#0a0a10] px-3 py-2 text-xs text-[var(--text-2)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.1)] placeholder:text-[var(--text-4)] focus:outline-none focus:shadow-[inset_0_0_0_1px_rgba(169,155,255,0.35)]"
        onKeyDown={(event) => {
          if (event.key === "Enter") handle();
          else if (event.key === "Escape") onCancel();
        }}
      />
      {meta.altLabel && (
        <input
          value={alt}
          onChange={(event) => setAlt(event.target.value)}
          placeholder={meta.altLabel}
          className="mt-2 w-full rounded-lg border-transparent bg-[#0a0a10] px-3 py-2 text-xs text-[var(--text-2)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.1)] placeholder:text-[var(--text-4)] focus:outline-none focus:shadow-[inset_0_0_0_1px_rgba(169,155,255,0.35)]"
          onKeyDown={(event) => {
            if (event.key === "Enter") handle();
            else if (event.key === "Escape") onCancel();
          }}
        />
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-[11px] text-[var(--text-3)] hover:text-white"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handle}
          className="rounded-md bg-violet/15 px-3 py-1.5 text-[11px] text-white shadow-[inset_0_0_0_1px_rgba(169,155,255,0.18)] hover:bg-violet/25"
        >
          Insert
        </button>
      </div>
    </div>
  );
}

interface UrlMeta {
  title: string;
  hint: string;
  placeholder: string;
  icon: ReactNode;
  altLabel?: string;
  format: (url: string, alt: string) => string;
}

const METADATA: Record<Exclude<Mode, "root" | "emoji">, UrlMeta> = {
  "image-url": {
    title: "Insert image",
    hint: "Paste a direct image URL (jpg, png, webp). Markdown image renders inline.",
    placeholder: "https://example.com/picture.png",
    icon: <ImageIcon size={13} />,
    altLabel: "Alt text (optional)",
    format: (url, alt) => `![${alt || "image"}](${url})\n`,
  },
  "gif-url": {
    title: "Insert GIF",
    hint: "Paste a Giphy / Tenor share URL or a direct .gif URL.",
    placeholder: "https://media.giphy.com/...gif",
    icon: <Sparkles size={13} />,
    altLabel: "Caption (optional)",
    format: (url, alt) => {
      const giphyMatch = url.match(/giphy\.com\/(?:gifs|media)\/[^/]*-?([a-zA-Z0-9]+)$/);
      if (giphyMatch) {
        return `![${alt || "gif"}](https://media.giphy.com/media/${giphyMatch[1]}/giphy.gif)\n`;
      }
      return `![${alt || "gif"}](${url})\n`;
    },
  },
  "video-url": {
    title: "Insert video",
    hint: "Direct .mp4 / .webm / .ogv URL. Renders an HTML5 video player.",
    placeholder: "https://example.com/clip.mp4",
    icon: <Film size={13} />,
    altLabel: "Caption (optional)",
    format: (url, alt) =>
      `<video controls src="${escapeAttr(url)}" style="max-width:100%;border-radius:8px"></video>\n${
        alt ? `*${alt}*\n` : ""
      }`,
  },
  "audio-url": {
    title: "Insert audio",
    hint: "Direct .mp3 / .wav / .ogg URL. Renders an audio player.",
    placeholder: "https://example.com/song.mp3",
    icon: <Music size={13} />,
    format: (url) => `<audio controls src="${escapeAttr(url)}"></audio>\n`,
  },
  "youtube-url": {
    title: "Embed YouTube",
    hint: "Full YouTube URL. Inserts a responsive iframe player.",
    placeholder: "https://youtube.com/watch?v=...",
    icon: <Youtube size={13} />,
    format: (url) => {
      const id = parseYouTubeId(url);
      const src = id ? `https://www.youtube.com/embed/${id}` : url;
      return `<iframe src="${escapeAttr(src)}" width="100%" height="380" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="border:0;border-radius:10px"></iframe>\n`;
    },
  },
  "vimeo-url": {
    title: "Embed Vimeo",
    hint: "Full Vimeo URL.",
    placeholder: "https://vimeo.com/123456789",
    icon: <Film size={13} />,
    format: (url) => {
      const id = parseVimeoId(url);
      const src = id ? `https://player.vimeo.com/video/${id}` : url;
      return `<iframe src="${escapeAttr(src)}" width="100%" height="380" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="border:0;border-radius:10px"></iframe>\n`;
    },
  },
  "twitter-url": {
    title: "Embed Tweet",
    hint: "X / Twitter status URL. Renders a quote link.",
    placeholder: "https://x.com/user/status/...",
    icon: <Twitter size={13} />,
    format: (url) => `<blockquote class="twitter-tweet"><a href="${escapeAttr(url)}">${escapeAttr(url)}</a></blockquote>\n`,
  },
  "iframe-url": {
    title: "Embed web page",
    hint: "Any URL. Some sites block iframe embedding via X-Frame-Options.",
    placeholder: "https://example.com",
    icon: <Link size={13} />,
    format: (url) =>
      `<iframe src="${escapeAttr(url)}" width="100%" height="420" style="border:0;border-radius:10px"></iframe>\n`,
  },
  "file-url": {
    title: "Insert file link",
    hint: "Any file URL — renders as a link. For PDFs, preview embeds in reading view.",
    placeholder: "https://example.com/doc.pdf",
    icon: <FileText size={13} />,
    altLabel: "Label (optional)",
    format: (url, alt) => `[${alt || urlBasename(url)}](${url})\n`,
  },
};

function escapeAttr(value: string) {
  return value.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function parseYouTubeId(url: string): string | null {
  const direct = url.match(/[?&]v=([\w-]{6,})/);
  if (direct) return direct[1];
  const short = url.match(/youtu\.be\/([\w-]{6,})/);
  if (short) return short[1];
  const embed = url.match(/youtube\.com\/embed\/([\w-]{6,})/);
  if (embed) return embed[1];
  return null;
}

function parseVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d{5,})/);
  return match?.[1] ?? null;
}

function urlBasename(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() || "file");
  } catch {
    return "file";
  }
}
