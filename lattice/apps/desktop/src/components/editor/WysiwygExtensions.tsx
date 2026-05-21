import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { useEffect, useState } from "react";
import { commands } from "@/lib/commands";

// ─── LatticeImage ─────────────────────────────────────────────────────────────
// Extends TipTap's Image to resolve lattice-asset:// URLs via Tauri and render
// audio / video / PDF local assets correctly inside the WYSIWYG editor.

function LatticeImageView({ node }: { node: { attrs: Record<string, string> } }) {
  const src: string = node.attrs.src ?? "";
  const alt: string = node.attrs.alt ?? "";
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
      <NodeViewWrapper>
        <span className="my-3 inline-flex items-center gap-1.5 rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-3)]">
          Loading…
        </span>
      </NodeViewWrapper>
    );
  }

  if (!resolved) {
    return (
      <NodeViewWrapper>
        <span className="my-3 inline-flex items-center gap-1.5 rounded border border-dashed border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-3)]">
          {alt || "Image not found"}
        </span>
      </NodeViewWrapper>
    );
  }

  if (resolved.startsWith("data:audio/")) {
    return (
      <NodeViewWrapper>
        <audio src={resolved} controls className="my-3 w-full" />
      </NodeViewWrapper>
    );
  }

  if (resolved.startsWith("data:video/")) {
    return (
      <NodeViewWrapper>
        <video src={resolved} controls className="my-3 max-h-[480px] w-full rounded-lg" />
      </NodeViewWrapper>
    );
  }

  if (resolved.startsWith("data:application/pdf")) {
    return (
      <NodeViewWrapper>
        <object
          data={resolved}
          type="application/pdf"
          className="my-3 h-[520px] w-full rounded-lg border border-[var(--border)]"
          aria-label={alt || "PDF"}
        />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <img
        src={resolved}
        alt={alt}
        className="lp-image my-3 max-h-[520px] max-w-full rounded-lg object-contain"
        draggable={false}
      />
    </NodeViewWrapper>
  );
}

export const LatticeImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(LatticeImageView as Parameters<typeof ReactNodeViewRenderer>[0]);
  },
});
