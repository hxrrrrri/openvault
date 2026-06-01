import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

import {
  getCodeBlockProcessor,
  runCodeBlockProcessor,
  runPostProcessors,
  type MarkdownPostProcessorContext,
} from "@/features/plugins/processor-registry";

type MarkdownProcessor = ReturnType<typeof buildProcessor>;

function buildProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeKatex)
    .use(rehypeStringify, { allowDangerousHtml: true });
}

let processor: MarkdownProcessor | null = null;

function getProcessor(): MarkdownProcessor {
  if (!processor) processor = buildProcessor();
  return processor;
}

export async function renderMarkdownInto(
  markdown: string,
  el: HTMLElement,
  context: MarkdownPostProcessorContext,
): Promise<void> {
  if (!markdown.trim()) {
    el.replaceChildren();
    return;
  }
  const preprocessed = preprocess(markdown);
  const file = await getProcessor().process(preprocessed);
  el.innerHTML = String(file);
  await applyCodeBlockProcessors(el, context);
  await runPostProcessors(el, context);
}

function preprocess(content: string): string {
  return content
    .replace(/%%[\s\S]*?%%/g, "")
    .replace(/==([\s\S]*?)==/g, "<mark>$1</mark>")
    .replace(
      /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_match, rawTarget: string, alias?: string) => {
        const target = rawTarget.trim();
        const label = alias || target.split("#")[0];
        return `[${label}](lattice://note/${encodeURIComponent(target)})`;
      },
    );
}

async function applyCodeBlockProcessors(
  el: HTMLElement,
  context: MarkdownPostProcessorContext,
): Promise<void> {
  const blocks = el.querySelectorAll<HTMLPreElement>("pre > code[class*=language-]");
  for (const block of Array.from(blocks)) {
    const match = block.className.match(/language-([\w-]+)/);
    if (!match) continue;
    const language = match[1];
    if (!getCodeBlockProcessor(language)) continue;
    const pre = block.parentElement;
    if (!pre) continue;
    const host = document.createElement("div");
    host.className = "lattice-plugin-codeblock";
    host.dataset.language = language;
    const source = block.textContent ?? "";
    pre.replaceWith(host);
    await runCodeBlockProcessor(language, source, host, context);
  }
}
