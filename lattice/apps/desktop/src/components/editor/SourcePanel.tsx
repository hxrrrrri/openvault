import { Copy, FileCode2, PanelRightClose } from "lucide-react";
import { useMemo, useState } from "react";

interface SourcePanelProps {
  content: string;
  notePath: string;
  onCollapse?: () => void;
}

export function SourcePanel({ content, notePath, onCollapse }: SourcePanelProps) {
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => content.split("\n"), [content]);

  function copyAll() {
    void navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#08080c]/80">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[#0c0c12]/80 px-4 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-[rgba(139,124,255,0.12)] text-[var(--violet-2)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.08)]">
            <FileCode2 size={13} />
          </span>
          <div className="leading-tight">
            <div className="pixel-label text-[10px]">Markdown source</div>
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

      <div className="flex min-h-0 flex-1 overflow-auto font-mono text-[12.5px] leading-[1.65]">
        <pre className="m-0 select-none border-r border-[var(--border)] bg-[#06060a] px-3 py-4 text-right text-[11px] text-[var(--text-4)]">
          {lines.map((_, index) => (
            <div key={index} className="leading-[1.65]">
              {index + 1}
            </div>
          ))}
        </pre>
        <pre className="m-0 min-w-0 flex-1 whitespace-pre-wrap break-words px-4 py-4 text-[var(--text-2)]">
          {lines.map((line, index) => (
            <div key={index} className="leading-[1.65]">
              {colorize(line)}
            </div>
          ))}
        </pre>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[#0c0c12]/80 px-4 py-1.5 text-[10px] text-[var(--text-4)]">
        <span className="mono">{lines.length} lines</span>
        <span className="mono">{content.length.toLocaleString()} chars</span>
        <span className="mono uppercase tracking-[0.12em]">.md</span>
      </div>
    </div>
  );
}

function colorize(line: string): React.ReactNode {
  if (!line.trim()) return " ";
  // Frontmatter delim
  if (/^---\s*$/.test(line)) {
    return <span className="text-[var(--violet-2)]">{line}</span>;
  }
  // YAML key: value inside frontmatter (heuristic, applied everywhere — close enough for a viewer)
  const yamlMatch = line.match(/^(\s*)([\w-]+):(.*)$/);
  if (yamlMatch && !line.startsWith("#")) {
    return (
      <>
        {yamlMatch[1]}
        <span className="text-[#a99bff]">{yamlMatch[2]}</span>
        <span className="text-[var(--text-3)]">:</span>
        <span className="text-[#dccfff]">{yamlMatch[3]}</span>
      </>
    );
  }
  // Headings
  const headingMatch = line.match(/^(#{1,6})\s(.*)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const color =
      level === 1 ? "#ffffff" : level === 2 ? "#eee7ff" : level === 3 ? "#d8ccff" : "#b6abff";
    return (
      <>
        <span className="text-[var(--violet-2)]">{headingMatch[1]} </span>
        <span style={{ color, fontWeight: 700 }}>{headingMatch[2]}</span>
      </>
    );
  }
  // Blockquote / callout
  if (/^>\s/.test(line)) {
    return <span className="text-[#a99bff]">{line}</span>;
  }
  // List items
  const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s(.*)$/);
  if (listMatch) {
    return (
      <>
        {listMatch[1]}
        <span className="text-[var(--violet-2)]">{listMatch[2]} </span>
        {tokens(listMatch[3])}
      </>
    );
  }
  // Plain line with inline tokens
  return tokens(line);
}

function tokens(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const pattern =
    /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|==[^=\n]+==|!?\[\[[^\]\n]+\]\]|\[[^\]\n]+\]\([^)\n]+\)|#[\w/-]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const token = match[0];
    let cls = "";
    if (token.startsWith("`")) cls = "text-[#c9beff] bg-[rgba(139,124,255,0.12)] rounded-sm px-0.5";
    else if (token.startsWith("**")) cls = "text-white font-semibold";
    else if (token.startsWith("*")) cls = "text-[#e5dcff] italic";
    else if (token.startsWith("==")) cls = "text-[#fff6da] bg-[rgba(247,215,116,0.18)] rounded-sm";
    else if (token.startsWith("![[")) cls = "text-[#cbd4ff]";
    else if (token.startsWith("[[")) cls = "text-[var(--violet-2)]";
    else if (token.startsWith("[")) cls = "text-[var(--violet-2)] underline decoration-violet/30";
    else if (token.startsWith("#")) cls = "text-[#7ee0b4]";
    parts.push(
      <span key={`${key++}`} className={cls}>
        {token}
      </span>,
    );
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
