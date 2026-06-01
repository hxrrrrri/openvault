export type MarkdownPostProcessor = (
  element: HTMLElement,
  context: MarkdownPostProcessorContext,
) => void | Promise<void>;

export interface MarkdownPostProcessorContext {
  sourcePath: string;
  frontmatter: Record<string, unknown> | null;
  addChild?: (child: unknown) => void;
  getSectionInfo?: (el: HTMLElement) => null;
}

export type MarkdownCodeBlockProcessor = (
  source: string,
  element: HTMLElement,
  context: MarkdownPostProcessorContext,
) => void | Promise<void>;

interface PostProcessorEntry {
  pluginId: string;
  processor: MarkdownPostProcessor;
  sortOrder: number;
}

interface CodeBlockEntry {
  pluginId: string;
  language: string;
  processor: MarkdownCodeBlockProcessor;
}

const postProcessors: PostProcessorEntry[] = [];
const codeBlockProcessors = new Map<string, CodeBlockEntry>();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeProcessors(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function registerMarkdownPostProcessor(
  pluginId: string,
  processor: MarkdownPostProcessor,
  sortOrder = 0,
): () => void {
  const entry: PostProcessorEntry = { pluginId, processor, sortOrder };
  postProcessors.push(entry);
  postProcessors.sort((a, b) => a.sortOrder - b.sortOrder);
  notify();
  return () => {
    const index = postProcessors.indexOf(entry);
    if (index >= 0) postProcessors.splice(index, 1);
    notify();
  };
}

export function registerMarkdownCodeBlockProcessor(
  pluginId: string,
  language: string,
  processor: MarkdownCodeBlockProcessor,
): () => void {
  const key = language.toLowerCase();
  const entry: CodeBlockEntry = { pluginId, language: key, processor };
  codeBlockProcessors.set(key, entry);
  notify();
  return () => {
    if (codeBlockProcessors.get(key) === entry) {
      codeBlockProcessors.delete(key);
      notify();
    }
  };
}

export function clearProcessorsForPlugin(pluginId: string): void {
  let changed = false;
  for (let index = postProcessors.length - 1; index >= 0; index -= 1) {
    if (postProcessors[index].pluginId === pluginId) {
      postProcessors.splice(index, 1);
      changed = true;
    }
  }
  for (const [key, value] of [...codeBlockProcessors.entries()]) {
    if (value.pluginId === pluginId) {
      codeBlockProcessors.delete(key);
      changed = true;
    }
  }
  if (changed) notify();
}

export function listPostProcessors(): ReadonlyArray<PostProcessorEntry> {
  return postProcessors;
}

export function getCodeBlockProcessor(language: string): CodeBlockEntry | undefined {
  return codeBlockProcessors.get(language.toLowerCase());
}

export function listRegisteredCodeBlockLanguages(): string[] {
  return Array.from(codeBlockProcessors.keys());
}

export async function runPostProcessors(
  element: HTMLElement,
  context: MarkdownPostProcessorContext,
): Promise<void> {
  const snapshot = [...postProcessors];
  for (const entry of snapshot) {
    try {
      await entry.processor(element, context);
    } catch (error) {
      console.warn(`[plugin:${entry.pluginId}] markdown post-processor failed`, error);
    }
  }
}

export async function runCodeBlockProcessor(
  language: string,
  source: string,
  element: HTMLElement,
  context: MarkdownPostProcessorContext,
): Promise<boolean> {
  const entry = codeBlockProcessors.get(language.toLowerCase());
  if (!entry) return false;
  try {
    await entry.processor(source, element, context);
    return true;
  } catch (error) {
    console.warn(`[plugin:${entry.pluginId}] code block processor "${language}" failed`, error);
    return false;
  }
}
