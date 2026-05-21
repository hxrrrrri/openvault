# Obsidian Parity Roadmap

Concrete implementation plan derived from `obsidian-deep-feature-gap-audit.md`. Each phase ships independently and lands its own commit(s) so a partial completion still moves parity forward.

## Phase 1 — Active editor parity

Goal: make the active editor an Obsidian-class editor — settings actually apply, source mode is editable, find/replace works, fold + indent guides + RTL + strict line breaks land.

Files:

- `apps/desktop/src/stores/settings-store.ts`
  - Add fields: `defaultEditingMode` (`live-preview` | `source`), `showInlineTitle`, `showEditorStatus`, `strictLineBreaks`, `foldHeading`, `foldIndent`, `showIndentationGuides`, `rtl`, `vimMode`, `autoPairBrackets`, `autoConvertHtml`, `spellcheckLanguages` (string array), `attachmentDeletePolicy` (`ask` | `always` | `never`), `detectAllFileExtensions`.
- `apps/desktop/src/components/editor/MarkdownEditor.tsx`
  - Wire `@codemirror/language` `foldGutter`, `codeFolding`, `indentUnit`.
  - Wire `@codemirror/search` `search()` + `openSearchPanel` (Ctrl/Cmd+F, Ctrl/Cmd+H).
  - RTL via `EditorView.contentAttributes.of({ dir: 'rtl' })`.
  - Strict line breaks — pass through to markdown preview and tiptap-markdown `breaks: true`.
  - Indentation guides — add custom decoration plugin (lightweight, no dep).
- `apps/desktop/src/components/editor/EditorWorkspace.tsx`
  - Replace `SourcePanel` (read-only viewer) with `MarkdownEditor` instance bound to `updateActiveContent`.
  - Inline editable title above body when `showInlineTitle` on (renames file via `commands.renameNote`).
  - Add bottom-right per-pane editing mode toggle (Live Preview / Source) tied to `defaultEditingMode`.
- `apps/desktop/src/components/settings/SettingsScreen.tsx`
  - Surface every new editor setting in the Editor tab.

## Phase 2 — Workspace tabs + split panes

Goal: real Obsidian leaves, not single active note.

Files:

- `apps/desktop/src/stores/workspace-store.ts` — replace single `editorMode` with tree:
  ```ts
  interface Tab { id: string; path: string; pinned: boolean; scroll: number; mode: EditorMode }
  interface Leaf { id: string; tabs: Tab[]; activeTabId: string | null }
  interface SplitGroup { id: string; direction: 'row' | 'column'; sizes: number[]; children: Array<SplitGroup | Leaf> }
  ```
  - Actions: `openTab`, `closeTab`, `reopenLastTab`, `pinTab`, `splitRight`, `splitDown`, `moveTab`, `focusLeaf`, `saveWorkspace`, `loadWorkspace`.
- `apps/desktop/src/components/layout/TabBar.tsx` — new. Per-leaf tab strip.
- `apps/desktop/src/components/layout/EditorPanes.tsx` — new. Recursive renderer over `SplitGroup`.
- `EditorWorkspace.tsx` — refactor: take a `Leaf` prop, render active tab's note via `MarkdownEditor` / `MarkdownPreview`.
- `App.tsx` — replace direct `<EditorWorkspace/>` with `<EditorPanes root={workspace.root}/>`.

## Phase 3 — File explorer plumbing

Files:

- `apps/desktop/src/components/layout/FileTree.tsx`
  - Add `onContextMenu` per row.
  - Add `FileContextMenu` component (new file) with: open, open in new tab, open to right/below, new note, new folder, rename, delete, duplicate, move to, copy path, copy obsidian://, reveal in system explorer, add to bookmarks.
  - Drag-and-drop file → folder using HTML5 DnD.
- `apps/desktop/src/lib/commands.ts` — add `duplicateNote`, `moveNote`, `revealInExplorer`, `copyObsidianUri`.
- Rust side `src-tauri/src/commands/note_commands.rs` — implement above and respect:
  - `confirmDelete` → frontend modal gates delete.
  - `trashStrategy` → `system` (Tauri `trash` crate), `app` (move to `.lattice/.trash`), `permanent` (current behavior).
  - `updateLinksOnRename` → skip wikilink rewrite when false.
  - `defaultNoteLocation` → respect on `createNote`.
  - `linkFormat` → switch between `[[wiki]]` and `[md](path.md)` for `convertUnlinkedMention` and new-link autocompletion.

## Phase 4 — Properties first-class

Files:

- `apps/desktop/src/components/editor/PropertiesPanel.tsx` — new top-of-note typed editor.
  - Parse current YAML; render rows with per-type controls (text, list (chip input), number, checkbox, date, datetime, link with note autocomplete).
  - Add/remove/rename keys; reorder; reserved-key behavior for `tags`, `aliases`, `cssclasses`, `bgPreset` (already used).
  - Writes back through `updateActiveContent`.
- `apps/desktop/src/lib/markdown-properties.ts` — new. Pure YAML serializer/parser using a tiny inline parser (no new dep), exposing `parseProperties(content) → { properties, body }` and `serializeProperties(properties, body)`.
- `EditorWorkspace.tsx` — render `PropertiesPanel` above body when `editor.propertiesDisplay === 'visible'`.
- `RightSidebar.tsx` — replace raw-YAML view with `PropertiesPanel` in compact mode.
- Apply `cssclasses` as classNames on the note pane wrapper.

## Phase 5 — Core plugin surfaces

New modules under `apps/desktop/src/features/core-plugins/`:

- `bookmarks/` — `bookmarks-store.ts` (zustand persist), `BookmarksPanel.tsx`, sidebar tab integration.
- `templates/` — settings (folder, date/time format), `insertTemplate` command, palette entry; respect `_Templates/`.
- `random-note.ts` — command + palette entry.
- `unique-note.ts` — Zettelkasten ID generator + command.
- `page-preview/` — `HoverPreview.tsx` listens on wikilink hover, renders `MarkdownPreview` in popover.
- `workspaces/` — `workspaces-store.ts` (saves Phase 2 layout), modal manager.
- `note-composer/` — extract-heading-to-new-note, merge-notes commands.
- `file-recovery/` — interval snapshotter (in-browser via plugin data API + Tauri write to `.lattice/snapshots/`), restore UI.
- `format-converter/` — wikilink↔markdown link conversion across vault.

`SettingsScreen.tsx` — new "Core plugins" tab listing each with toggle and per-plugin config sub-pane.

## Phase 6 — `.canvas` and `.base` file formats

Files:

- `apps/desktop/src/features/canvas/canvas-file.ts` — new. Read/write Obsidian-compatible `.canvas` JSON schema (`nodes[]` with `id,type,x,y,width,height,color,text,file,subpath,url`; `edges[]` with `id,fromNode,fromSide,toNode,toSide,color,label`).
- `canvas-store.ts` — refactor to load from `.canvas` files via `commands.readNote` / `writeNote`.
- `apps/desktop/src/features/bases/` — new. `base-file.ts` (`.base` YAML schema), `BasesView.tsx` with tabs for table / board / gallery / calendar.
- Rust side: ensure `.canvas` and `.base` extensions are indexed; treat as regular files for read/write.

## Phase 7 — Search panel + grammar

Files:

- `apps/desktop/src/features/search/SearchPanel.tsx` — sidebar panel with query input, sort dropdown (name/created/modified), expand/collapse context, copy/export.
- `apps/desktop/src/features/search/query-parser.ts` — extend to support `line:(…)`, `block:(…)`, `section:(…)`, parenthesis grouping, nested boolean logic.
- Rust side `crates/lattice-indexer/src/search.rs` — add line/block/section matchers; return match context with offsets so frontend can render snippets.

## Phase 8 — Hotkeys + plugin compatibility

Files:

- `apps/desktop/src/features/hotkeys/hotkey-registry.ts` — new central registry mapping command id → key combo, plus persistence in settings.
- `apps/desktop/src/features/hotkeys/HotkeyEditor.tsx` — searchable table, assign/clear; conflict detection.
- `useGlobalShortcuts` — switch to registry-driven.
- `features/plugins/obsidian-runtime.ts` — render plugin UI contributions:
  - Surface ribbon icons in new `<RibbonBar/>` component.
  - Surface plugin status items in status bar.
  - Mount plugin `PluginSettingTab` instances as real settings sub-pages.
  - Expose `Workspace.getLeaf`, `Workspace.openLinkText`, `Editor` (CodeMirror-backed) for broader API coverage.
- Plugin marketplace: add online browser stub + uninstall flow + update check.

## Phase 9 — Mobile (deferred)

Out of scope this session. Treat current `MobilePreview` as design-only; full mobile app is a separate product track that needs Tauri Mobile (Android/iOS) wiring, vault permission handling, on-screen toolbar config, camera/audio insert, gesture nav. Tracked here for completeness but not started.

## Sequencing notes

1, 2, 4 are foundational — every later phase assumes them.
3 unblocks day-to-day vault management; ship early.
5 is mostly additive; can land plugin-by-plugin.
6 + 7 need backend (Rust) changes — schedule with the indexer crate.
8 is mostly frontend; can interleave with 5.

The audit's section-by-section gap matrix remains the canonical checklist. This roadmap is the *how*; the audit is the *what*.
