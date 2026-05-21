// Minimal frontmatter parser/serializer. Does not aim for full YAML compliance —
// supports scalars, inline lists, block lists, and the property types we render
// in the UI (text, list, number, checkbox, date, datetime).

export type PropertyValue = string | number | boolean | string[] | null;

export interface PropertyEntry {
  key: string;
  value: PropertyValue;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  const match = content.match(FRONTMATTER);
  if (!match) return { frontmatter: "", body: content };
  return { frontmatter: match[1], body: content.slice(match[0].length) };
}

export function parseProperties(content: string): { properties: PropertyEntry[]; body: string } {
  const { frontmatter, body } = splitFrontmatter(content);
  if (!frontmatter.trim()) return { properties: [], body };
  return { properties: parseYamlBlock(frontmatter), body };
}

export function serializeProperties(properties: PropertyEntry[], body: string): string {
  if (properties.length === 0) return body;
  const lines: string[] = ["---"];
  for (const entry of properties) {
    if (Array.isArray(entry.value)) {
      if (entry.value.length === 0) {
        lines.push(`${entry.key}: []`);
      } else {
        lines.push(`${entry.key}:`);
        for (const item of entry.value) lines.push(`  - ${serializeScalar(item)}`);
      }
    } else if (entry.value === null) {
      lines.push(`${entry.key}:`);
    } else {
      lines.push(`${entry.key}: ${serializeScalar(entry.value)}`);
    }
  }
  lines.push("---");
  const prefix = lines.join("\n");
  const bodyStart = body.startsWith("\n") ? body : `\n${body}`;
  return `${prefix}${bodyStart}`;
}

export function inferType(value: PropertyValue): "text" | "list" | "number" | "checkbox" | "date" | "datetime" {
  if (Array.isArray(value)) return "list";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "checkbox";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return "datetime";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "date";
  }
  return "text";
}

function parseYamlBlock(block: string): PropertyEntry[] {
  const lines = block.split(/\r?\n/);
  const entries: PropertyEntry[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) {
      i += 1;
      continue;
    }
    const match = line.match(/^([\w.-]+)\s*:\s*(.*)$/);
    if (!match) {
      i += 1;
      continue;
    }
    const key = match[1];
    const rest = match[2];
    if (rest === "") {
      // Could be block list or empty value
      const list: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
        const item = next.match(/^\s+-\s*(.*)$/);
        if (!item) break;
        list.push(parseScalar(item[1]) as string);
        j += 1;
      }
      if (list.length > 0) {
        entries.push({ key, value: list });
        i = j;
        continue;
      }
      entries.push({ key, value: null });
      i += 1;
      continue;
    }
    if (rest.startsWith("[")) {
      const inner = rest.replace(/^\[|\]$/g, "").trim();
      const items = inner
        ? inner.split(",").map((part) => String(parseScalar(part.trim())))
        : [];
      entries.push({ key, value: items });
      i += 1;
      continue;
    }
    entries.push({ key, value: parseScalar(rest) });
    i += 1;
  }
  return entries;
}

function parseScalar(value: string): PropertyValue {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^['"].*['"]$/.test(trimmed)) return trimmed.slice(1, -1);
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null" || trimmed === "~") return null;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  if (/^-?\d+\.\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function serializeScalar(value: PropertyValue | string): string {
  if (value === null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  const text = String(value);
  if (/[:#\n]|^\s|\s$/.test(text)) return JSON.stringify(text);
  return text;
}
