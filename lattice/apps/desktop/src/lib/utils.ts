import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function debounce<T extends (...args: never[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function formatRelativeTime(value: string | number | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.round(diff / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function countWords(content: string): number {
  return content.trim().match(/\b[\p{L}\p{N}'-]+\b/gu)?.length ?? 0;
}

export function titleFromMarkdown(path: string, content: string): string {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;
  return path.split(/[\\/]/).pop()?.replace(/\.md$/i, "") ?? "Untitled";
}

export function formatLink(
  targetPath: string,
  format: "wikilink" | "markdown",
  alias?: string,
): string {
  const noteName = targetPath.split("/").pop()?.replace(/\.md$/i, "") ?? targetPath;
  if (format === "wikilink") {
    return alias ? `[[${noteName}|${alias}]]` : `[[${noteName}]]`;
  }
  const display = alias ?? noteName;
  return `[${display}](${encodeURI(targetPath)})`;
}
