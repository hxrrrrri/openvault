import { BookOpen, CalendarDays, FileText, FlaskConical, Layers3, ListChecks, NotebookPen, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

interface NewNoteDialogProps {
  onClose: () => void;
  onCreate: (path: string, content: string) => void;
}

interface NoteTemplate {
  id: string;
  title: string;
  hint: string;
  icon: ReactNode;
  folder: string;
  render: (input: TemplateInput) => string;
}

interface TemplateInput {
  title: string;
  tags: string[];
  accent: string;
  created: string;
}

const templates: NoteTemplate[] = [
  {
    id: "study",
    title: "Study note",
    hint: "Cornell layout with prompts",
    icon: <FlaskConical size={15} />,
    folder: "Study",
    render: ({ title, tags, accent, created }) => frontmatter(title, tags, accent, created, "study") + `# ${title}

> [!summary] Cues and questions
> - Key term:
> - Why it matters:
> - Exam angle:

## Notes

### Concept

- 

### Evidence / diagram

![[Attachments/]]

## Recall

- [ ] Explain this from memory
- [ ] Link to a related note

## Summary

`,
  },
  {
    id: "cornell",
    title: "Cornell note",
    hint: "Questions, notes, summary",
    icon: <NotebookPen size={15} />,
    folder: "Class Notes",
    render: ({ title, tags, accent, created }) => frontmatter(title, tags, accent, created, "cornell") + `# ${title}

| Cues / Questions | Notes |
| --- | --- |
| What is the main idea? |  |
| Which examples matter? |  |
| What should I review? |  |

## Summary

`,
  },
  {
    id: "meeting",
    title: "Meeting",
    hint: "Agenda, decisions, actions",
    icon: <CalendarDays size={15} />,
    folder: "Meetings",
    render: ({ title, tags, accent, created }) => frontmatter(title, tags, accent, created, "meeting") + `# ${title}

Date:: ${created}
Status:: active

## Agenda

- 

## Notes

- 

## Decisions

- 

## Action items

- [ ] 
`,
  },
  {
    id: "project",
    title: "Project card",
    hint: "Properties and gallery-ready fields",
    icon: <Layers3 size={15} />,
    folder: "Projects",
    render: ({ title, tags, accent, created }) => frontmatter(title, tags, accent, created, "project") + `# ${title}

Status:: active
Owner:: 
Due:: 
Cover:: 

## Brief


## Milestones

- [ ] 

## Links

- 
`,
  },
  {
    id: "literature",
    title: "Literature note",
    hint: "Source, claims, links",
    icon: <BookOpen size={15} />,
    folder: "Literature Notes",
    render: ({ title, tags, accent, created }) => frontmatter(title, tags, accent, created, "literature") + `# ${title}

Source:: 
Authors:: 
Year:: 

## Core claim


## Evidence

- 

## My interpretation


## Links

- 
`,
  },
  {
    id: "blank",
    title: "Blank",
    hint: "Clean Markdown page",
    icon: <FileText size={15} />,
    folder: "Notes",
    render: ({ title, tags, accent, created }) => frontmatter(title, tags, accent, created, "note") + `# ${title}

`,
  },
];

export function NewNoteDialog({ onClose, onCreate }: NewNoteDialogProps) {
  const [title, setTitle] = useState("Untitled note");
  const [folder, setFolder] = useState("Study");
  const [templateId, setTemplateId] = useState("study");
  const [tagText, setTagText] = useState("notes");
  const [accent, setAccent] = useState("default");

  const template = templates.find((item) => item.id === templateId) ?? templates[0];
  const tags = useMemo(
    () =>
      tagText
        .split(/[,\s]+/)
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean),
    [tagText],
  );
  const path = useMemo(() => notePath(folder, title), [folder, title]);

  function create() {
    const created = new Date().toISOString().slice(0, 10);
    onCreate(path, template.render({ title: cleanTitle(title), tags, accent, created }));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#050507]/75 p-6 backdrop-blur-md" onMouseDown={onClose}>
      <section
        className="anim-scale-in flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-gradient-to-b from-[#181820] to-[#0d0d12] shadow-[var(--shadow-float),0_0_60px_rgba(139,124,255,0.18),inset_0_0_0_1px_rgba(139,124,255,0.16)]"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Create note"
      >
        <header className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
          <span className="grid size-10 place-items-center rounded-lg bg-violet/10 text-[var(--violet-2)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.14)]">
            <NotebookPen size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="pixel-label text-[10px]">New note</div>
            <h2 className="truncate text-base font-semibold">{path}</h2>
          </div>
          <button type="button" className="rounded-lg p-2 text-[var(--text-3)] hover:bg-white/[0.04] hover:text-white" onClick={onClose}>
            <X size={16} />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[1fr_280px] overflow-hidden">
          <div className="min-h-0 overflow-y-auto p-5">
            <label className="block">
              <span className="pixel-label text-[10px]">Title</span>
              <input
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 w-full rounded-lg border-transparent bg-black/25 px-3 py-2 text-sm text-[var(--text)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.12)] outline-none focus:shadow-[inset_0_0_0_1px_rgba(169,155,255,0.32)]"
              />
            </label>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="pixel-label text-[10px]">Folder</span>
                <input
                  value={folder}
                  onChange={(event) => setFolder(event.target.value)}
                  className="mt-2 w-full rounded-lg border-transparent bg-black/25 px-3 py-2 text-sm text-[var(--text)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.12)] outline-none focus:shadow-[inset_0_0_0_1px_rgba(169,155,255,0.32)]"
                />
              </label>
              <label className="block">
                <span className="pixel-label text-[10px]">Tags</span>
                <input
                  value={tagText}
                  onChange={(event) => setTagText(event.target.value)}
                  className="mt-2 w-full rounded-lg border-transparent bg-black/25 px-3 py-2 text-sm text-[var(--text)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.12)] outline-none focus:shadow-[inset_0_0_0_1px_rgba(169,155,255,0.32)]"
                />
              </label>
            </div>

            <div className="mt-5">
              <div className="pixel-label mb-2 text-[10px]">Template</div>
              <div className="grid grid-cols-2 gap-2">
                {templates.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTemplateId(item.id);
                      setFolder(item.folder);
                    }}
                    className={`flex items-center gap-3 rounded-lg p-3 text-left transition ${
                      item.id === templateId
                        ? "bg-violet/10 text-white shadow-[inset_0_0_0_1px_rgba(169,155,255,0.24)]"
                        : "bg-white/[0.025] text-[var(--text-2)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.12)] hover:bg-violet/10 hover:shadow-[inset_0_0_0_1px_rgba(169,155,255,0.22)]"
                    }`}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-black/25 text-[var(--violet-2)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.12)]">
                      {item.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-[var(--text-3)]">{item.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="border-l border-[var(--border)] bg-black/20 p-4">
            <div className="pixel-label mb-2 text-[10px]">Theme</div>
            <div className="grid grid-cols-2 gap-2">
              {["default", "violet", "ocean", "paper"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setAccent(item)}
                  className={`rounded-lg px-3 py-2 text-left text-xs capitalize transition ${
                    accent === item
                      ? "bg-violet/15 text-white shadow-[inset_0_0_0_1px_rgba(169,155,255,0.24)]"
                      : "bg-white/[0.025] text-[var(--text-2)] shadow-[inset_0_0_0_1px_rgba(139,124,255,0.12)] hover:shadow-[inset_0_0_0_1px_rgba(169,155,255,0.22)]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-lg bg-[#0b0b10] p-3 shadow-[inset_0_0_0_1px_rgba(139,124,255,0.12)]">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
                <ListChecks size={13} className="text-[var(--violet-2)]" />
                Preview
              </div>
              <div className="mono truncate text-[11px] text-[var(--text-3)]">{path}</div>
              <div className="mt-3 flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <span key={tag} className="chip chip-violet mono text-[9px]">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={create}>
            Create note
          </Button>
        </footer>
      </section>
    </div>
  );
}

function frontmatter(title: string, tags: string[], accent: string, created: string, type: string): string {
  const cleanTags = tags.length ? tags.map((tag) => `  - ${tag}`).join("\n") : "  - notes";
  const bgPreset = accent === "default" ? "" : `bgPreset: ${accent}\n`;
  return `---
title: "${escapeYaml(title)}"
type: ${type}
created: ${created}
tags:
${cleanTags}
${bgPreset}---

`;
}

function notePath(folder: string, title: string): string {
  const cleanFolder = folder
    .replace(/\\/g, "/")
    .split("/")
    .map(sanitizePathPart)
    .filter(Boolean)
    .join("/");
  const fileName = `${sanitizePathPart(cleanTitle(title)) || `Untitled ${Date.now()}`}.md`;
  return cleanFolder ? `${cleanFolder}/${fileName}` : fileName;
}

function cleanTitle(value: string): string {
  return value.trim() || "Untitled note";
}

function sanitizePathPart(value: string): string {
  return value.replace(/[<>:"|?*]/g, "").replace(/\s+/g, " ").trim();
}

function escapeYaml(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
