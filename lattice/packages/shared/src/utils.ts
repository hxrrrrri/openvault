export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}

export function basename(path: string): string {
  const normalized = normalizePath(path);
  return normalized.split("/").filter(Boolean).at(-1) ?? normalized;
}

export function titleFromPath(path: string): string {
  return basename(path).replace(/\.md$/i, "");
}

export function wordCount(content: string): number {
  const words = content.trim().match(/\b[\p{L}\p{N}'-]+\b/gu);
  return words?.length ?? 0;
}
