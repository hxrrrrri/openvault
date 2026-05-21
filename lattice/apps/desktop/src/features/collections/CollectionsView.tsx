import { BookOpen, ExternalLink, ImageIcon, ListFilter, RefreshCcw, Search, Table2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { commands } from "@/lib/commands";
import { useUIStore } from "@/stores/ui-store";
import { useVaultStore } from "@/stores/vault-store";
import type { CollectionItem } from "@/types/domain";

type Layout = "cards" | "table";

interface OpenLibraryDoc {
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
  subject?: string[];
  key?: string;
}

export function CollectionsView() {
  const [folder, setFolder] = useState("Books");
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState<Layout>("cards");
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookQuery, setBookQuery] = useState("");
  const [bookResults, setBookResults] = useState<OpenLibraryDoc[]>([]);
  const [bookLoading, setBookLoading] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(310);
  const setActivePath = useVaultStore((state) => state.setActivePath);
  const createNote = useVaultStore((state) => state.createNote);
  const createFolder = useVaultStore((state) => state.createFolder);
  const refreshFiles = useVaultStore((state) => state.refreshFiles);
  const setView = useUIStore((state) => state.setView);
  const properties = useMemo(() => Array.from(new Set(items.flatMap((item) => Object.keys(item.properties)))).sort(), [items]);
  const imageProperty = properties.find((property) => /cover|image|thumbnail|poster/i.test(property)) ?? "coverUrl";

  async function loadItems() {
    setLoading(true);
    try {
      const next = await commands.listCollectionItems({ folder, text: query });
      setItems(next);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadItems(), 120);
    return () => window.clearTimeout(timer);
  }, [folder, query]);

  async function searchBooks() {
    if (!bookQuery.trim()) return;
    setBookLoading(true);
    try {
      const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(bookQuery)}&limit=8`);
      const data = (await response.json()) as { docs?: OpenLibraryDoc[] };
      setBookResults(data.docs ?? []);
    } finally {
      setBookLoading(false);
    }
  }

  async function importBook(book: OpenLibraryDoc) {
    const title = book.title?.trim() || "Untitled Book";
    const author = book.author_name?.[0] ?? "Unknown author";
    const coverUrl = book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg` : "";
    const isbn = book.isbn?.[0] ?? "";
    const categories = (book.subject ?? []).slice(0, 6);
    const safeTitle = title.replace(/[<>:"|?*]/g, "").trim() || "Untitled Book";
    const path = `${folder || "Books"}/${safeTitle}.md`;

    await createFolder(folder || "Books");
    await createNote(path, bookNoteTemplate({ title, author, coverUrl, isbn, year: book.first_publish_year, categories, source: book.key }));
    await refreshFiles();
    await loadItems();
  }

  async function openItem(path: string) {
    await setActivePath(path);
    setView("workspace");
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-gradient-to-b from-[#09090d] to-[#060609]">
      <aside
        className="relative shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[#0b0b10] p-4"
        style={{ width: sidebarWidth }}
      >
        <ResizeHandle onResize={(delta) => setSidebarWidth((width) => clamp(width + delta, 240, 520))} />
        <div className="pixel-label mb-3 flex items-center gap-2 text-[10px]">
          <ListFilter size={13} /> Collection source
        </div>
        <label className="block text-xs text-[var(--text-2)]">
          Folder
          <input
            value={folder}
            onChange={(event) => setFolder(event.target.value)}
            className="mt-2 w-full rounded-lg border border-[var(--border)] bg-white/[0.025] px-3 py-2 text-xs outline-none focus:border-violet/40"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--text-2)]">
          Search
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-2.5 text-[var(--text-3)]" size={13} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-white/[0.025] py-2 pl-8 pr-3 text-xs outline-none focus:border-violet/40"
            />
          </div>
        </label>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant={layout === "cards" ? "primary" : "ghost"} className="justify-center text-xs" onClick={() => setLayout("cards")}>
            <ImageIcon size={13} /> Cards
          </Button>
          <Button variant={layout === "table" ? "primary" : "ghost"} className="justify-center text-xs" onClick={() => setLayout("table")}>
            <Table2 size={13} /> Table
          </Button>
        </div>

        <div className="divider my-5" />
        <div className="pixel-label mb-3 flex items-center gap-2 text-[10px]">
          <BookOpen size={13} /> Book importer
        </div>
        <div className="flex gap-2">
          <input
            value={bookQuery}
            onChange={(event) => setBookQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void searchBooks();
            }}
            placeholder="ISBN, title, author"
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-white/[0.025] px-3 py-2 text-xs outline-none focus:border-violet/40"
          />
          <Button className="px-3" onClick={() => void searchBooks()} disabled={bookLoading}>
            <Search size={13} />
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {bookResults.map((book) => (
            <button
              key={`${book.key}-${book.cover_i}`}
              className="row w-full text-left"
              onClick={() => void importBook(book)}
              title="Create a Markdown note from this book"
            >
              <BookOpen size={13} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{book.title}</span>
                <span className="mono block truncate text-[10px] text-[var(--text-4)]">{book.author_name?.[0] ?? "Unknown author"}</span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-5">
        <div className="mb-5 flex items-center gap-3">
          <div>
            <div className="pixel-label text-[10px]">Lattice Collections</div>
            <h1 className="mt-1 text-xl font-semibold">Markdown files as visual databases</h1>
          </div>
          <div className="chip mono ml-auto">{items.length} notes</div>
          <Button variant="ghost" className="text-xs" onClick={() => void loadItems()}>
            <RefreshCcw size={13} /> {loading ? "Loading" : "Refresh"}
          </Button>
        </div>

        {layout === "cards" ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
            {items.map((item) => (
              <CollectionCard key={item.path} item={item} imageProperty={imageProperty} onOpen={() => void openItem(item.path)} />
            ))}
          </div>
        ) : (
          <CollectionTable items={items} properties={properties.slice(0, 6)} onOpen={openItem} />
        )}

        {!items.length && (
          <div className="grid min-h-[360px] place-items-center rounded-lg border border-dashed border-[var(--border)] text-center text-sm text-[var(--text-3)]">
            <div>
              <BookOpen className="mx-auto mb-3 text-[var(--violet-2)]" />
              Create notes with YAML properties or import a book to populate this collection.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function CollectionCard({ item, imageProperty, onOpen }: { item: CollectionItem; imageProperty: string; onOpen: () => void }) {
  const image = valueToString(item.properties[imageProperty] ?? item.properties.coverUrl ?? item.properties.image);
  const author = valueToString(item.properties.author);
  return (
    <article className="card overflow-hidden">
      <button className="block w-full text-left" onClick={onOpen}>
        <div className="grid aspect-[3/4] place-items-center bg-black/35">
          {image ? (
            <img src={image} alt="" className="h-full w-full object-contain" loading="lazy" />
          ) : (
            <ImageIcon className="text-[var(--text-4)]" size={28} />
          )}
        </div>
        <div className="p-3">
          <h2 className="line-clamp-2 text-sm font-semibold">{valueToString(item.properties.title) || item.title}</h2>
          {author && <p className="mt-1 truncate text-xs text-[var(--text-3)]">{author}</p>}
          <div className="mt-3 flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="chip mono px-1.5 py-0 text-[9px]">{tag.replace(/^#/, "")}</span>
            ))}
          </div>
        </div>
      </button>
    </article>
  );
}

function CollectionTable({ items, properties, onOpen }: { items: CollectionItem[]; properties: string[]; onOpen: (path: string) => void }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)]">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="bg-white/[0.03] text-[var(--text-3)]">
          <tr>
            <th className="px-3 py-2 font-medium">Note</th>
            {properties.map((property) => (
              <th key={property} className="px-3 py-2 font-medium">{property}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.path} className="border-t border-[var(--border)] hover:bg-white/[0.025]">
              <td className="px-3 py-2">
                <button className="flex items-center gap-2 text-[var(--violet-2)]" onClick={() => void onOpen(item.path)}>
                  <ExternalLink size={12} /> {item.title}
                </button>
              </td>
              {properties.map((property) => (
                <td key={property} className="max-w-[220px] truncate px-3 py-2 text-[var(--text-2)]">{valueToString(item.properties[property])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function valueToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(valueToString).filter(Boolean).join(", ");
  return "";
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function ResizeHandle({ onResize }: { onResize: (deltaX: number) => void }) {
  return (
    <button
      type="button"
      aria-label="Resize collections sidebar"
      className="absolute right-0 top-0 z-20 h-full w-2 cursor-col-resize bg-transparent transition hover:bg-violet/20"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        let lastX = event.clientX;
        const move = (moveEvent: PointerEvent) => {
          onResize(moveEvent.clientX - lastX);
          lastX = moveEvent.clientX;
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up, { once: true });
      }}
    />
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function bookNoteTemplate(book: { title: string; author: string; coverUrl: string; isbn: string; year?: number; categories: string[]; source?: string }) {
  const categories = book.categories.map((category) => `  - ${yamlString(category)}`).join("\n");
  return `---
title: ${yamlString(book.title)}
author: ${yamlString(book.author)}
coverUrl: ${yamlString(book.coverUrl)}
isbn: ${yamlString(book.isbn)}
published: ${book.year ?? ""}
categories:
${categories || "  - book"}
source: ${yamlString(book.source ? `https://openlibrary.org${book.source}` : "https://openlibrary.org")}
tags:
  - book
---

# ${book.title}

![Cover](${book.coverUrl})

## Notes

- 

## Links

- Author: [[${book.author}]]
`;
}
