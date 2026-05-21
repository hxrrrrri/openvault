import { BrainCircuit, FileText, Link2, Link2Off, ListTree, PanelRightClose } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Tabs } from "@/components/ui/Tabs";
import { commands } from "@/lib/commands";
import { useSettingsStore } from "@/stores/settings-store";
import { useUIStore } from "@/stores/ui-store";
import { useVaultStore } from "@/stores/vault-store";
import type { Backlink, OutgoingLink, UnlinkedMention, UnresolvedLink } from "@/types/domain";

type RightTab = "backlinks" | "outline" | "properties" | "insights";

const tabs = [
  { id: "backlinks" as const, label: "Backlinks", icon: <Link2 size={12} /> },
  { id: "outline" as const, label: "Outline", icon: <ListTree size={12} /> },
  { id: "properties" as const, label: "Props", icon: <FileText size={12} /> },
  { id: "insights" as const, label: "Insights", icon: <BrainCircuit size={12} /> },
];

interface RightSidebarProps {
  width?: number;
  onResize?: (deltaX: number) => void;
}

export function RightSidebar({ width = 330, onResize }: RightSidebarProps) {
  const setRightOpen = useUIStore((state) => state.setRightOpen);
  const activeNote = useVaultStore((state) => state.activeNote);
  const refreshFiles = useVaultStore((state) => state.refreshFiles);
  const [tab, setTab] = useState<RightTab>("backlinks");
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingLink[]>([]);
  const [unresolved, setUnresolved] = useState<UnresolvedLink[]>([]);
  const [unlinked, setUnlinked] = useState<UnlinkedMention[]>([]);

  async function refreshLinks(path: string) {
    const [nextBacklinks, nextOutgoing, nextUnresolved, nextUnlinked] = await Promise.all([
      commands.getBacklinks(path),
      commands.getOutgoingLinks(path),
      commands.getUnresolvedLinks(path),
      commands.getUnlinkedMentions(path),
    ]);
    setBacklinks(nextBacklinks);
    setOutgoing(nextOutgoing);
    setUnresolved(nextUnresolved);
    setUnlinked(nextUnlinked);
  }

  useEffect(() => {
    if (!activeNote) return;
    void refreshLinks(activeNote.path);
  }, [activeNote?.path]);

  async function convertMention(mention: UnlinkedMention) {
    if (!activeNote) return;
    await commands.convertUnlinkedMention(mention.sourcePath, activeNote.path, mention.line);
    await refreshFiles();
    await refreshLinks(activeNote.path);
  }

  return (
    <aside
      className="relative flex shrink-0 flex-col overflow-hidden border-l border-[var(--border)] bg-gradient-to-b from-[#0c0c11] to-[#0a0a0e]"
      style={{ width }}
    >
      <ResizeHandle side="left" label="Resize right sidebar" onResize={onResize} />
      <div className="flex items-center gap-2 px-3 py-2">
        <IconButton label="Collapse right panel" onClick={() => setRightOpen(false)}>
          <PanelRightClose size={14} />
        </IconButton>
        <Tabs items={tabs} value={tab} onChange={setTab} className="min-w-0 flex-1" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2">
        {tab === "backlinks" && (
          <Backlinks
            backlinks={backlinks}
            outgoing={outgoing}
            unresolved={unresolved}
            unlinked={unlinked}
            onConvert={convertMention}
          />
        )}
        {tab === "outline" && <Outline content={activeNote?.content ?? ""} />}
        {tab === "properties" && <Properties content={activeNote?.content ?? ""} />}
        {tab === "insights" && <Insights />}
      </div>
    </aside>
  );
}

function ResizeHandle({
  side,
  label,
  onResize,
}: {
  side: "left" | "right";
  label: string;
  onResize?: (deltaX: number) => void;
}) {
  if (!onResize) return null;
  return (
    <button
      type="button"
      aria-label={label}
      className={`absolute top-0 z-20 h-full w-2 cursor-col-resize bg-transparent transition hover:bg-violet/20 ${
        side === "left" ? "left-0" : "right-0"
      }`}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        let lastX = event.clientX;
        const move = (moveEvent: PointerEvent) => {
          onResize(moveEvent.clientX - lastX);
          lastX = moveEvent.clientX;
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up, { once: true });
      }}
    />
  );
}

function Backlinks({
  backlinks,
  outgoing,
  unresolved,
  unlinked,
  onConvert,
}: {
  backlinks: Backlink[];
  outgoing: OutgoingLink[];
  unresolved: UnresolvedLink[];
  unlinked: UnlinkedMention[];
  onConvert: (mention: UnlinkedMention) => void;
}) {
  return (
    <div className="space-y-4">
      <section>
        <div className="pixel-label mb-2 text-[10px]">Linked mentions - {backlinks.length}</div>
        <div className="space-y-2">
          {backlinks.map((link) => (
            <article key={`${link.sourcePath}-${link.line}`} className="card p-3">
              <div className="text-xs font-semibold">{link.sourceTitle}</div>
              <p className="mt-2 text-xs leading-5 text-[var(--text-3)]">{link.excerpt}</p>
              <div className="mono mt-2 text-[10px] text-[var(--text-4)]">line {link.line}</div>
            </article>
          ))}
          {backlinks.length === 0 && <EmptyPanel label="No linked mentions yet." />}
        </div>
      </section>

      <section>
        <div className="pixel-label mb-2 text-[10px]">Unlinked mentions - {unlinked.length}</div>
        <div className="space-y-2">
          {unlinked.map((mention) => (
            <article key={`${mention.sourcePath}-${mention.line}`} className="card p-3">
              <div className="text-xs font-semibold">{mention.sourceTitle}</div>
              <p className="mt-2 text-xs leading-5 text-[var(--text-3)]">{mention.excerpt}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="mono text-[10px] text-[var(--text-4)]">line {mention.line}</span>
                <Button className="ml-auto py-1 text-[11px]" onClick={() => onConvert(mention)}>
                  Link
                </Button>
              </div>
            </article>
          ))}
          {unlinked.length === 0 && <EmptyPanel label="No plain-text mentions found." />}
        </div>
      </section>

      <section>
        <div className="pixel-label mb-2 text-[10px]">Outgoing links - {outgoing.length}</div>
        <div className="space-y-1">
          {outgoing.map((link) => (
            <div key={`${link.targetText}-${link.line}`} className="row cursor-default">
              <Link2 size={12} />
              <span className="min-w-0 flex-1 truncate">{link.targetText}</span>
              <span className="mono text-[10px] text-[var(--text-4)]">L{link.line}</span>
            </div>
          ))}
          {outgoing.length === 0 && <EmptyPanel label="This note has no outgoing links." />}
        </div>
      </section>

      <section>
        <div className="pixel-label mb-2 text-[10px]">Unresolved links - {unresolved.length}</div>
        <div className="space-y-1">
          {unresolved.map((link) => (
            <div key={`${link.targetText}-${link.line}`} className="row cursor-default text-[var(--warning)]">
              <Link2Off size={12} />
              <span className="min-w-0 flex-1 truncate">{link.targetText}</span>
              <span className="mono text-[10px] text-[var(--text-4)]">L{link.line}</span>
            </div>
          ))}
          {unresolved.length === 0 && <EmptyPanel label="No broken note links." />}
        </div>
      </section>
    </div>
  );
}

function Outline({ content }: { content: string }) {
  const headings = content
    .split("\n")
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^#{1,6}\s+/.test(line));
  return (
    <div>
      <div className="pixel-label mb-2 text-[10px]">Outline</div>
      <div className="space-y-1">
        {headings.map(({ line, index }) => {
          const level = line.match(/^#+/)?.[0].length ?? 1;
          return (
            <div key={`${line}-${index}`} className="row" style={{ paddingLeft: 8 + level * 10 }}>
              {line.replace(/^#+\s+/, "")}
            </div>
          );
        })}
        {headings.length === 0 && <EmptyPanel label="No headings in this note." />}
      </div>
    </div>
  );
}

function Properties({ content }: { content: string }) {
  const mode = useSettingsStore((state) => state.editor.propertiesDisplay);
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  if (mode === "hidden") {
    return <EmptyPanel label="Properties are hidden by editor settings." />;
  }
  return (
    <div>
      <div className="pixel-label mb-2 text-[10px]">{mode === "source" ? "Frontmatter source" : "Properties"}</div>
      {frontmatter ? (
        <pre className="card-inner mono whitespace-pre-wrap p-3 text-[11px] leading-5 text-[var(--text-2)]">{frontmatter}</pre>
      ) : (
        <EmptyPanel label="No frontmatter detected." />
      )}
    </div>
  );
}

function Insights() {
  return (
    <div className="space-y-3">
      <section className="gradient-card p-4">
        <div className="pixel-label text-[10px] text-white/70">AI - local model</div>
        <h3 className="mt-2 text-sm font-semibold">Suggested connections</h3>
        <p className="mt-2 text-xs leading-5 text-white/70">Local embeddings can suggest links after indexing. No note content leaves this device.</p>
      </section>
      <section className="card p-3">
        <div className="pixel-label text-[10px]">Vault context</div>
        <p className="mt-2 text-xs leading-5 text-[var(--text-3)]">This note sits near graph infrastructure, local-first storage, and plugin sandbox topics.</p>
      </section>
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--text-3)]">{label}</div>;
}
