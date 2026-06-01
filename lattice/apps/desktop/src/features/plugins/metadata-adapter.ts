import type { LinkMetadata, NoteMetadata } from "@/types/domain";

interface Pos {
  line: number;
  col: number;
  offset: number;
}

interface PositionRange {
  start: Pos;
  end: Pos;
}

export interface ObsidianTagCache {
  tag: string;
  position: PositionRange;
}

export interface ObsidianLinkCache {
  link: string;
  original: string;
  displayText: string;
  position: PositionRange;
}

export interface ObsidianHeadingCache {
  heading: string;
  level: number;
  position: PositionRange;
}

export interface ObsidianFileCache {
  tags: ObsidianTagCache[];
  links: ObsidianLinkCache[];
  embeds: ObsidianLinkCache[];
  headings: ObsidianHeadingCache[];
  sections: PositionRange[];
  listItems: Array<{ position: PositionRange; parent: number; task?: string }>;
  blocks: Record<string, { id: string; position: PositionRange }>;
  frontmatter: Record<string, unknown>;
  frontmatterPosition: PositionRange | undefined;
  frontmatterLinks: ObsidianLinkCache[];
}

function pos(line: number, col = 0, offset = 0): Pos {
  return { line: Math.max(0, line | 0), col: col | 0, offset: offset | 0 };
}

function rangeForLine(line: number, length = 0): PositionRange {
  return { start: pos(line, 0, 0), end: pos(line, length, length) };
}

function linkLength(link: LinkMetadata): number {
  switch (link.linkType) {
    case "wikilink":
      return (link.displayText ?? link.targetText).length + 4;
    case "embed":
      return (link.displayText ?? link.targetText).length + 5;
    default:
      return (link.displayText ?? link.targetText).length + 4;
  }
}

function linkOriginal(link: LinkMetadata): string {
  const target = link.targetText ?? "";
  const display = link.displayText ?? "";
  if (link.linkType === "wikilink") {
    return display && display !== target ? `[[${target}|${display}]]` : `[[${target}]]`;
  }
  if (link.linkType === "embed") {
    return display && display !== target ? `![[${target}|${display}]]` : `![[${target}]]`;
  }
  return display ? `[${display}](${target})` : `[${target}](${target})`;
}

export function toObsidianFileCache(metadata: NoteMetadata | null | undefined): ObsidianFileCache {
  const headings: ObsidianHeadingCache[] = [];
  const tags: ObsidianTagCache[] = [];
  const links: ObsidianLinkCache[] = [];
  const embeds: ObsidianLinkCache[] = [];

  if (metadata) {
    for (const heading of metadata.headings ?? []) {
      headings.push({
        heading: heading.text,
        level: heading.level,
        position: {
          start: pos(heading.lineStart),
          end: pos(heading.lineEnd, heading.text.length, heading.text.length),
        },
      });
    }
    for (const tag of metadata.tags ?? []) {
      tags.push({ tag: tag.startsWith("#") ? tag : `#${tag}`, position: rangeForLine(0, tag.length) });
    }
    for (const link of metadata.links ?? []) {
      const cache: ObsidianLinkCache = {
        link: link.targetText,
        original: linkOriginal(link),
        displayText: link.displayText ?? link.targetText,
        position: {
          start: pos(link.line, link.column, link.column),
          end: pos(link.line, link.column + linkLength(link), link.column + linkLength(link)),
        },
      };
      if (link.linkType === "embed") embeds.push(cache);
      else links.push(cache);
    }
  }

  const fm = (metadata?.properties as Record<string, unknown> | undefined) ?? {};
  return {
    tags,
    links,
    embeds,
    headings,
    sections: [],
    listItems: [],
    blocks: {},
    frontmatter: fm,
    frontmatterPosition: Object.keys(fm).length ? { start: pos(0), end: pos(0) } : undefined,
    frontmatterLinks: [],
  };
}

export function buildResolvedLinks(
  metadatas: Array<{ path: string; metadata: NoteMetadata | null }>,
): {
  resolved: Record<string, Record<string, number>>;
  unresolved: Record<string, Record<string, number>>;
} {
  const resolved: Record<string, Record<string, number>> = {};
  const unresolved: Record<string, Record<string, number>> = {};
  for (const { path, metadata } of metadatas) {
    if (!metadata) continue;
    const r: Record<string, number> = {};
    const u: Record<string, number> = {};
    for (const link of metadata.links ?? []) {
      const target = link.resolvedPath;
      if (target) r[target] = (r[target] ?? 0) + 1;
      else if (link.targetText) u[link.targetText] = (u[link.targetText] ?? 0) + 1;
    }
    if (Object.keys(r).length) resolved[path] = r;
    if (Object.keys(u).length) unresolved[path] = u;
  }
  return { resolved, unresolved };
}
