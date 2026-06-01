import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { pluginSuggestCompletions } from "@/features/plugins/editor-suggest-bridge";

interface NoteHint {
  path: string;
  title: string;
  headings?: string[];
}

export interface CompletionDataSource {
  notes: () => NoteHint[];
  tags: () => string[];
}

const SLASH_COMMANDS: Completion[] = [
  { label: "/h1", detail: "Heading 1", apply: "# ", type: "heading", boost: 99 },
  { label: "/h2", detail: "Heading 2", apply: "## ", type: "heading", boost: 98 },
  { label: "/h3", detail: "Heading 3", apply: "### ", type: "heading", boost: 97 },
  { label: "/h4", detail: "Heading 4", apply: "#### ", type: "heading", boost: 96 },
  { label: "/h5", detail: "Heading 5", apply: "##### ", type: "heading", boost: 95 },
  { label: "/h6", detail: "Heading 6", apply: "###### ", type: "heading", boost: 94 },
  { label: "/quote", detail: "Block quote", apply: "> ", type: "text" },
  { label: "/bullet", detail: "Bullet list", apply: "- ", type: "text" },
  { label: "/numbered", detail: "Numbered list", apply: "1. ", type: "text" },
  { label: "/todo", detail: "Task", apply: "- [ ] ", type: "text" },
  {
    label: "/code",
    detail: "Code block",
    apply: "```\n\n```\n",
    type: "keyword",
  },
  {
    label: "/table",
    detail: "Table",
    apply: "| Column | Column |\n| --- | --- |\n| Cell | Cell |\n",
    type: "keyword",
  },
  {
    label: "/callout-note",
    detail: "Callout (note)",
    apply: "> [!NOTE] \n> \n",
    type: "namespace",
  },
  {
    label: "/callout-tip",
    detail: "Callout (tip)",
    apply: "> [!TIP] \n> \n",
    type: "namespace",
  },
  {
    label: "/callout-warning",
    detail: "Callout (warning)",
    apply: "> [!WARNING] \n> \n",
    type: "namespace",
  },
  {
    label: "/callout-danger",
    detail: "Callout (danger)",
    apply: "> [!DANGER] \n> \n",
    type: "namespace",
  },
  {
    label: "/callout-success",
    detail: "Callout (success)",
    apply: "> [!SUCCESS] \n> \n",
    type: "namespace",
  },
  {
    label: "/callout-question",
    detail: "Callout (question)",
    apply: "> [!QUESTION] \n> \n",
    type: "namespace",
  },
  {
    label: "/callout-quote",
    detail: "Callout (quote)",
    apply: "> [!QUOTE] \n> \n",
    type: "namespace",
  },
  { label: "/math", detail: "Math block", apply: "$$\n\n$$\n", type: "keyword" },
  { label: "/mermaid", detail: "Mermaid diagram", apply: "```mermaid\n\n```\n", type: "keyword" },
  { label: "/divider", detail: "Horizontal rule", apply: "\n---\n", type: "text" },
  { label: "/today", detail: "Today's date", apply: () => new Date().toISOString().slice(0, 10), type: "constant" },
  { label: "/now", detail: "Current timestamp", apply: () => new Date().toISOString(), type: "constant" },
  { label: "/frontmatter", detail: "YAML frontmatter", apply: "---\ntitle: \ntags: []\n---\n\n", type: "keyword" },
  { label: "/image", detail: "Image (URL)", apply: "![](https://)", type: "constant" },
  { label: "/gif", detail: "GIF (URL)", apply: "![gif](https://)", type: "constant" },
  {
    label: "/video",
    detail: "Video player",
    apply: '<video controls src="https://" style="max-width:100%;border-radius:8px"></video>\n',
    type: "constant",
  },
  {
    label: "/audio",
    detail: "Audio player",
    apply: '<audio controls src="https://"></audio>\n',
    type: "constant",
  },
  {
    label: "/youtube",
    detail: "YouTube embed",
    apply:
      '<iframe src="https://www.youtube.com/embed/VIDEO_ID" width="100%" height="380" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="border:0;border-radius:10px"></iframe>\n',
    type: "constant",
  },
  {
    label: "/vimeo",
    detail: "Vimeo embed",
    apply:
      '<iframe src="https://player.vimeo.com/video/ID" width="100%" height="380" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="border:0;border-radius:10px"></iframe>\n',
    type: "constant",
  },
  {
    label: "/iframe",
    detail: "Web page embed",
    apply:
      '<iframe src="https://" width="100%" height="420" style="border:0;border-radius:10px"></iframe>\n',
    type: "constant",
  },
  { label: "/emoji", detail: "Open emoji picker", apply: ":", type: "keyword" },
  { label: "/wikilink", detail: "Wikilink", apply: "[[]]", type: "variable" },
  { label: "/embed", detail: "Embed local note", apply: "![[]]", type: "variable" },
  { label: "/highlight", detail: "Highlight text", apply: "==highlighted text==", type: "text" },
];

function slashCompletions(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const before = context.state.doc.sliceString(line.from, context.pos);
  const match = /(^|\s)(\/[\w-]*)$/.exec(before);
  if (!match) return null;
  const start = context.pos - match[2].length;
  return {
    from: start,
    to: context.pos,
    options: SLASH_COMMANDS,
    filter: true,
    validFor: /^\/[\w-]*$/,
  };
}

function wikilinkCompletions(source: CompletionDataSource) {
  return (context: CompletionContext): CompletionResult | null => {
    const before = context.state.doc.sliceString(Math.max(0, context.pos - 200), context.pos);
    const wikiMatch = /\[\[([^\[\]\n]*)$/.exec(before);
    if (!wikiMatch) return null;
    const typed = wikiMatch[1];
    const hashIdx = typed.indexOf("#");
    const fromOffset = before.length - wikiMatch[1].length;
    const from = context.pos - (before.length - fromOffset);
    if (hashIdx >= 0) {
      const targetPart = typed.slice(0, hashIdx);
      const note = source
        .notes()
        .find((n) => n.title.toLowerCase() === targetPart.toLowerCase() || n.path.toLowerCase().endsWith(`${targetPart.toLowerCase()}.md`));
      if (!note?.headings?.length) return null;
      const options: Completion[] = note.headings.map((heading) => ({
        label: `${targetPart}#${heading}`,
        displayLabel: heading,
        type: "property",
        apply: `${targetPart}#${heading}]] `,
      }));
      return {
        from: from,
        to: context.pos,
        options,
        validFor: /[^\[\]\n]*$/,
      };
    }
    const options: Completion[] = source.notes().slice(0, 200).map((note) => ({
      label: note.title,
      detail: note.path,
      type: "variable",
      apply: `${note.title}]] `,
    }));
    return {
      from,
      to: context.pos,
      options,
      validFor: /[^\[\]\n]*$/,
    };
  };
}

function tagCompletions(source: CompletionDataSource) {
  return (context: CompletionContext): CompletionResult | null => {
    const before = context.state.doc.sliceString(Math.max(0, context.pos - 80), context.pos);
    const match = /(^|\s)#([\w/-]*)$/.exec(before);
    if (!match) return null;
    const typed = match[2];
    const from = context.pos - typed.length - 1; // include #
    const options: Completion[] = source.tags().map((tag) => ({
      label: tag.startsWith("#") ? tag : `#${tag}`,
      type: "type",
      apply: tag.startsWith("#") ? `${tag} ` : `#${tag} `,
    }));
    return { from, to: context.pos, options, validFor: /[\w/-]*$/ };
  };
}

export function latticeCompletions(source: CompletionDataSource) {
  return autocompletion({
    override: [
      pluginSuggestCompletions,
      slashCompletions,
      wikilinkCompletions(source),
      tagCompletions(source),
    ],
    activateOnTyping: true,
    closeOnBlur: true,
    icons: false,
    optionClass: () => "cm-lp-completion",
    maxRenderedOptions: 30,
    tooltipClass: () => "cm-lp-completion-tip",
  });
}
