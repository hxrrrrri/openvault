import { ChevronDown, ChevronRight, Copy, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { commands } from "@/lib/commands";
import { useVaultStore } from "@/stores/vault-store";
import type { SearchResult } from "@/types/domain";

type SortMode = "relevance" | "name" | "modified";

interface ResolvedQuery {
  baseQuery: string;
  line?: string;
  block?: string;
  section?: string;
}

const SCOPED_OPERATORS = ["line:", "block:", "section:"] as const;

function parseQuery(input: string): ResolvedQuery {
  let baseQuery = input;
  const resolved: ResolvedQuery = { baseQuery };
  for (const operator of SCOPED_OPERATORS) {
    const pattern = new RegExp(`${operator}\\(([^)]+)\\)`, "i");
    const match = baseQuery.match(pattern);
    if (match) {
      const key = operator.slice(0, -1) as "line" | "block" | "section";
      resolved[key] = match[1].trim();
      baseQuery = baseQuery.replace(pattern, "").trim();
    }
  }
  resolved.baseQuery = baseQuery;
  return resolved;
}

function applyScopedFilters(results: SearchResult[], query: ResolvedQuery): SearchResult[] {
  if (!query.line && !query.block && !query.section) return results;
  return results.filter((result) => {
    const excerpt = result.excerpt ?? "";
    if (query.line && !excerpt.toLowerCase().includes(query.line.toLowerCase())) return false;
    if (query.block) {
      const blocks = excerpt.split(/\n\s*\n/);
      if (!blocks.some((block) => block.toLowerCase().includes(query.block!.toLowerCase()))) return false;
    }
    if (query.section) {
      if (!excerpt.toLowerCase().includes(query.section.toLowerCase())) return false;
    }
    return true;
  });
}

export function SearchPanel() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortMode>("relevance");
  const [busy, setBusy] = useState(false);
  const setActivePath = useVaultStore((state) => state.setActivePath);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (!input.trim()) {
      setResults([]);
      return;
    }
    timer.current = window.setTimeout(() => {
      const parsed = parseQuery(input);
      setBusy(true);
      commands
        .search(parsed.baseQuery || input)
        .then((raw) => setResults(applyScopedFilters(raw, parsed)))
        .catch(() => setResults([]))
        .finally(() => setBusy(false));
    }, 180);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [input]);

  const sorted = useMemo(() => {
    const copy = [...results];
    if (sort === "name") copy.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "modified") copy.sort((a, b) => a.path.localeCompare(b.path));
    return copy;
  }, [results, sort]);

  function toggleCollapsed(path: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function copyResults() {
    const text = sorted
      .map((result) => `- [[${result.title}]] — ${result.excerpt?.replace(/\s+/g, " ").slice(0, 120) ?? ""}`)
      .join("\n");
    void navigator.clipboard.writeText(text);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-3 pb-2 pt-3">
        <div className="pixel-label mb-2 text-[10px]">Search</div>
        <div className="relative">
          <Search className="absolute left-2 top-1.5 text-[var(--text-3)]" size={13} />
          <input
            value={input}
            onChange={(event) => setInput(event.currentTarget.value)}
            placeholder="Type query, path:foo, tag:#x, line:(…)"
            className="w-full rounded-md border border-[var(--border)] bg-black/25 pl-7 pr-2 py-1.5 text-xs text-[var(--text)] outline-none focus:border-violet/40"
          />
        </div>
        <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--text-3)]">
          <select
            value={sort}
            onChange={(event) => setSort(event.currentTarget.value as SortMode)}
            className="rounded border border-[var(--border)] bg-black/25 px-1.5 py-0.5 text-[10px]"
          >
            <option value="relevance">Relevance</option>
            <option value="name">Name</option>
            <option value="modified">Modified</option>
          </select>
          <span className="ml-auto">{busy ? "searching…" : `${sorted.length} result${sorted.length === 1 ? "" : "s"}`}</span>
          <button
            type="button"
            onClick={copyResults}
            className="flex items-center gap-1 rounded border border-[var(--border)] bg-white/[0.025] px-1.5 py-0.5 hover:text-white"
            disabled={sorted.length === 0}
            title="Copy results"
          >
            <Copy size={10} /> Copy
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {sorted.map((result) => {
          const isCollapsed = collapsed.has(result.path);
          return (
            <div key={result.path} className="mb-1">
              <button
                type="button"
                onClick={() => void setActivePath(result.path)}
                onDoubleClick={() => toggleCollapsed(result.path)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs text-[var(--text-2)] hover:bg-violet/10 hover:text-white"
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleCollapsed(result.path);
                  }}
                  className="text-[var(--text-4)] hover:text-white"
                >
                  {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                </button>
                <span className="truncate font-medium">{result.title}</span>
                {typeof result.score === "number" && (
                  <span className="mono ml-auto text-[10px] text-[var(--violet-2)]">{result.score.toFixed(2)}</span>
                )}
              </button>
              {!isCollapsed && result.excerpt && (
                <pre className="mx-2 mb-1 max-h-32 overflow-hidden whitespace-pre-wrap rounded border border-[var(--border)] bg-black/30 p-2 text-[10.5px] leading-snug text-[var(--text-3)]">
                  {result.excerpt}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
