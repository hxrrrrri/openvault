import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer, type Editor, type NodeViewProps } from "@tiptap/react";
import { ArrowDown, ArrowUp, ExternalLink, GripVertical, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { commands } from "@/lib/commands";

// ─── LatticeImage ─────────────────────────────────────────────────────────────
// Extends TipTap's Image to resolve lattice-asset:// URLs via Tauri and render
// audio / video / PDF local assets correctly inside the WYSIWYG editor.

type RichNodeAttrs = Record<string, string | number | boolean | null | undefined>;

interface RichNodeViewProps extends NodeViewProps {
  node: NodeViewProps["node"] & { attrs: RichNodeAttrs };
}

function LatticeImageView(props: RichNodeViewProps) {
  const { node } = props;
  const src = stringAttr(node.attrs.src);
  const alt = stringAttr(node.attrs.alt);
  const [resolved, setResolved] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!src) { setResolved(null); return; }
    if (!src.startsWith("lattice-asset://")) { setResolved(src); return; }
    let cancelled = false;
    setLoading(true);
    const target = decodeURIComponent(src.replace(/^lattice-asset:\/\//, "").split("?")[0]);
    commands.readAssetDataUrl(target, undefined)
      .then((dataUrl) => { if (!cancelled) { setResolved(dataUrl); setLoading(false); } })
      .catch(() => { if (!cancelled) { setResolved(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [src]);

  if (loading) {
    return (
      <RichBlockFrame {...props} label="Attachment" source={src}>
        <span className="inline-flex items-center gap-1.5 rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-3)]">
          Loading...
        </span>
      </RichBlockFrame>
    );
  }

  if (!resolved) {
    return (
      <RichBlockFrame {...props} label="Attachment" source={src}>
        <span className="inline-flex items-center gap-1.5 rounded border border-dashed border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-3)]">
          {alt || "Image not found"}
        </span>
      </RichBlockFrame>
    );
  }

  if (resolved.startsWith("data:audio/")) {
    return (
      <RichBlockFrame {...props} label="Audio" source={src}>
        <audio src={resolved} controls className="w-full" />
      </RichBlockFrame>
    );
  }

  if (resolved.startsWith("data:video/")) {
    return (
      <RichBlockFrame {...props} label="Video" source={src}>
        <video src={resolved} controls className="max-h-[480px] w-full rounded-lg" />
      </RichBlockFrame>
    );
  }

  if (resolved.startsWith("data:application/pdf")) {
    return (
      <RichBlockFrame {...props} label="PDF" source={src}>
        <object
          data={resolved}
          type="application/pdf"
          className="h-[520px] w-full rounded-lg border border-[var(--border)]"
          aria-label={alt || "PDF"}
        />
      </RichBlockFrame>
    );
  }

  return (
    <RichBlockFrame {...props} label="Image" source={src}>
      <img
        src={resolved}
        alt={alt}
        className="lp-image max-h-[520px] max-w-full rounded-lg object-contain"
        draggable={false}
      />
    </RichBlockFrame>
  );
}

export const LatticeImage = Image.extend({
  draggable: true,
  selectable: true,
  addNodeView() {
    return ReactNodeViewRenderer(LatticeImageView as Parameters<typeof ReactNodeViewRenderer>[0]);
  },
});

function LatticeEmbedView(props: RichNodeViewProps) {
  const { node } = props;
  const type = node.type.name;
  const src = stringAttr(node.attrs.src);
  const [failed, setFailed] = useState(false);
  const meta = useMemo(() => embedMeta(type, src), [src, type]);
  const title = stringAttr(node.attrs.title) || meta.label;

  let body: ReactNode = null;
  if (!src || failed) {
    body = (
      <div className="rounded-lg border border-dashed border-amber-300/25 bg-amber-400/5 px-3 py-4 text-xs text-amber-100/85">
        {src ? "This embed could not be loaded. You can delete or move the block from its toolbar." : "This embed is missing a source URL."}
      </div>
    );
  } else if (type === "latticeIframe") {
    body = (
      <iframe
        src={src}
        title={title}
        width={stringAttr(node.attrs.width) || "100%"}
        height={stringAttr(node.attrs.height) || "380"}
        allow={stringAttr(node.attrs.allow)}
        allowFullScreen={booleanAttr(node.attrs.allowfullscreen)}
        className="h-[min(420px,55vh)] w-full rounded-lg border-0 bg-black"
      />
    );
  } else if (type === "latticeVideo") {
    body = (
      <video
        src={src}
        controls
        poster={stringAttr(node.attrs.poster) || undefined}
        className="max-h-[520px] w-full rounded-lg bg-black"
        onError={() => setFailed(true)}
      />
    );
  } else if (type === "latticeAudio") {
    body = <audio src={src} controls className="w-full" onError={() => setFailed(true)} />;
  } else if (type === "latticeTweet") {
    body = (
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className="block rounded-lg border border-[#2f2a55] bg-[#11111a] px-4 py-3 text-sm text-[var(--violet-2)] no-underline hover:border-violet/45 hover:text-white"
      >
        {src}
      </a>
    );
  }

  return (
    <RichBlockFrame {...props} label={meta.label} source={src}>
      {body}
    </RichBlockFrame>
  );
}

function RichBlockFrame({
  children,
  deleteNode,
  editor,
  getPos,
  node,
  selected,
  label,
  source,
}: RichNodeViewProps & {
  children: ReactNode;
  label: string;
  source?: string;
}) {
  const shortSource = source ? source.replace(/^https?:\/\//, "") : "";
  return (
    <NodeViewWrapper
      className={`lattice-embed my-4 overflow-hidden rounded-xl border bg-[#0d0d14] shadow-[0_18px_46px_rgba(0,0,0,0.28)] ${
        selected ? "border-violet/55" : "border-[#2c2940]"
      }`}
      data-rich-node-type={node.type.name}
    >
      <div
        className="flex items-center gap-1 border-b border-[#28243c] bg-[#15151e] px-2 py-1.5"
        contentEditable={false}
      >
        <button
          type="button"
          className="grid size-7 cursor-grab place-items-center rounded-md text-[var(--text-3)] hover:bg-white/[0.06] hover:text-white"
          title="Drag block"
          aria-label="Drag block"
          data-drag-handle
        >
          <GripVertical size={14} />
        </button>
        <span className="pixel-label ml-1 text-[10px]">{label}</span>
        {shortSource && (
          <span className="mono min-w-0 flex-1 truncate px-2 text-[10px] text-[var(--text-4)]" title={source}>
            {shortSource}
          </span>
        )}
        {isExternalUrl(source) && (
          <a
            href={source}
            target="_blank"
            rel="noreferrer"
            className="grid size-7 place-items-center rounded-md text-[var(--text-3)] hover:bg-white/[0.06] hover:text-white"
            title="Open source"
          >
            <ExternalLink size={13} />
          </a>
        )}
        <FrameButton label="Move up" onClick={() => moveNode(editor, getPos, -1)}>
          <ArrowUp size={13} />
        </FrameButton>
        <FrameButton label="Move down" onClick={() => moveNode(editor, getPos, 1)}>
          <ArrowDown size={13} />
        </FrameButton>
        <FrameButton label="Delete block" onClick={deleteNode}>
          <Trash2 size={13} />
        </FrameButton>
      </div>
      <div className="bg-[#09090e] p-3" contentEditable={false}>
        {children}
      </div>
    </NodeViewWrapper>
  );
}

function FrameButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="grid size-7 place-items-center rounded-md text-[var(--text-3)] hover:bg-white/[0.06] hover:text-white"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function moveNode(
  editor: Editor,
  getPos: NodeViewProps["getPos"],
  direction: -1 | 1,
) {
  if (typeof getPos !== "function") return;
  const pos = getPos();
  if (typeof pos !== "number") return;
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return;
  const resolved = editor.state.doc.resolve(pos);
  const index = resolved.index();
  const parent = resolved.parent;
  const siblingIndex = direction === -1 ? index - 1 : index + 1;
  if (siblingIndex < 0 || siblingIndex >= parent.childCount) return;
  const sibling = parent.child(siblingIndex);
  const insertPos = direction === -1 ? pos - sibling.nodeSize : pos + sibling.nodeSize;
  const tr = editor.state.tr.delete(pos, pos + node.nodeSize).insert(insertPos, node);
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
}

function embedMeta(type: string, src: string) {
  if (type === "latticeVideo") return { label: "Video" };
  if (type === "latticeAudio") return { label: "Audio" };
  if (type === "latticeTweet") return { label: "Tweet" };
  if (/youtube\.com\/embed|youtu\.be|youtube\.com/i.test(src)) return { label: "YouTube" };
  if (/vimeo\.com/i.test(src)) return { label: "Vimeo" };
  return { label: "Iframe" };
}

function stringAttr(value: RichNodeAttrs[string]): string {
  return typeof value === "string" ? value : "";
}

function booleanAttr(value: RichNodeAttrs[string]): boolean {
  return value === true || value === "true" || value === "";
}

function isExternalUrl(value?: string) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function cleanHTMLAttributes(attrs: RichNodeAttrs) {
  const next: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    next[key] = value === true ? "" : value;
  }
  return next;
}

function textFromElement(element: HTMLElement) {
  return element.textContent?.trim() || "";
}

function sourceFromTweet(element: HTMLElement) {
  return element.querySelector("a")?.getAttribute("href") ?? textFromElement(element);
}

const iframeAttributes = {
  src: {
    default: null,
    parseHTML: (element: HTMLElement) => element.getAttribute("src"),
  },
  title: {
    default: null,
    parseHTML: (element: HTMLElement) => element.getAttribute("title"),
  },
  width: {
    default: "100%",
    parseHTML: (element: HTMLElement) => element.getAttribute("width") ?? "100%",
  },
  height: {
    default: "380",
    parseHTML: (element: HTMLElement) => element.getAttribute("height") ?? "380",
  },
  allow: {
    default: null,
    parseHTML: (element: HTMLElement) => element.getAttribute("allow"),
  },
  allowfullscreen: {
    default: null,
    parseHTML: (element: HTMLElement) => (element.hasAttribute("allowfullscreen") ? "true" : null),
    renderHTML: (attributes: RichNodeAttrs) => (booleanAttr(attributes.allowfullscreen) ? { allowfullscreen: "" } : {}),
  },
  style: {
    default: null,
    parseHTML: (element: HTMLElement) => element.getAttribute("style"),
  },
};

export const LatticeIframe = Image.extend({
  name: "latticeIframe",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return iframeAttributes;
  },
  parseHTML() {
    return [{ tag: "iframe[src]" }];
  },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: RichNodeAttrs }) {
    return [
      "iframe",
      cleanHTMLAttributes({
        width: "100%",
        height: "380",
        style: "border:0;border-radius:10px",
        ...HTMLAttributes,
        allowfullscreen: booleanAttr(HTMLAttributes.allowfullscreen) ? "" : null,
      }),
    ];
  },
  addCommands() {
    return {};
  },
  addInputRules() {
    return [];
  },
  addNodeView() {
    return ReactNodeViewRenderer(LatticeEmbedView as Parameters<typeof ReactNodeViewRenderer>[0]);
  },
});

export const LatticeVideo = Image.extend({
  name: "latticeVideo",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("src"),
      },
      poster: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("poster"),
      },
      style: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("style"),
      },
    };
  },
  parseHTML() {
    return [{ tag: "video[src]" }];
  },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: RichNodeAttrs }) {
    return ["video", cleanHTMLAttributes({ controls: "", style: "max-width:100%;border-radius:8px", ...HTMLAttributes })];
  },
  addCommands() {
    return {};
  },
  addInputRules() {
    return [];
  },
  addNodeView() {
    return ReactNodeViewRenderer(LatticeEmbedView as Parameters<typeof ReactNodeViewRenderer>[0]);
  },
});

export const LatticeAudio = Image.extend({
  name: "latticeAudio",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("src"),
      },
    };
  },
  parseHTML() {
    return [{ tag: "audio[src]" }];
  },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: RichNodeAttrs }) {
    return ["audio", cleanHTMLAttributes({ controls: "", ...HTMLAttributes })];
  },
  addCommands() {
    return {};
  },
  addInputRules() {
    return [];
  },
  addNodeView() {
    return ReactNodeViewRenderer(LatticeEmbedView as Parameters<typeof ReactNodeViewRenderer>[0]);
  },
});

export const LatticeTweet = Image.extend({
  name: "latticeTweet",
  priority: 1000,
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: sourceFromTweet,
      },
    };
  },
  parseHTML() {
    return [{ tag: "blockquote.twitter-tweet" }];
  },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: RichNodeAttrs }) {
    const src = stringAttr(HTMLAttributes.src);
    return ["blockquote", { class: "twitter-tweet" }, ["a", { href: src }, src]];
  },
  addCommands() {
    return {};
  },
  addInputRules() {
    return [];
  },
  addNodeView() {
    return ReactNodeViewRenderer(LatticeEmbedView as Parameters<typeof ReactNodeViewRenderer>[0]);
  },
});
