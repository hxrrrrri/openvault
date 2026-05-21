# Obsidian Deep Feature Gap Audit

Source reviewed: `C:\Users\haris\Downloads\OBSIDIAN_DEEP_FEATURE_BIBLE.md`

Repository snapshot reviewed: `lattice/` on 2026-05-21.

This audit compares the Obsidian feature bible against the current LATTICE implementation. It is intentionally product-facing: the goal is to identify which Obsidian features are present, partially present, or missing before building toward 1:1 parity.

## Legend

- Implemented: the repo has a working feature close to the Obsidian behavior.
- Partial: there is a related feature, but behavior, UI surface, file format, settings, or commands are incomplete.
- Missing: no meaningful implementation found.
- Stored only: settings/state exist but are not wired into the active user path.

## Executive Summary

LATTICE already has a solid local-first Markdown foundation:

- Vault open/create/bootstrap, file tree, note read/write/create, folder create.
- Markdown indexing for headings, wikilinks, embeds, tags, YAML/inline properties, tasks, content hashes.
- Search over SQLite FTS plus a partial advanced query parser.
- Backlinks, outgoing links, unresolved links, and unlinked mention conversion.
- Graph view with global/local modes, tag filtering, labels, pan/zoom, hover/select/open.
- Visual editor using TipTap plus Markdown preview with GFM, math, Mermaid, callouts, wikilinks, highlights, comments, and media embeds.
- A LATTICE canvas-like board and a collections/database-like view over Markdown properties.
- A permission-first plugin model, Obsidian manifest import, and a browser-worker Obsidian API shim.

It is not yet close to full Obsidian parity. The biggest gaps are:

- No true multi-tab, split-pane, stacked-pane, pop-out, or pinned-tab workspace.
- No left ribbon equivalent; current top CommandBar is app navigation, not Obsidian's ribbon.
- Active editor is visual-only plus raw source viewer; the CodeMirror Markdown editor exists but is not wired into the active workspace.
- Many editor/files/settings options are stored but not applied in active behavior.
- File explorer has no right-click context menus for rename/delete/duplicate/move/reveal/copy URI/bookmarks.
- Core plugins are not modeled as toggleable plugins with per-plugin settings.
- No Bookmarks, File Recovery, Note Composer, Random Note, Templates insertion, Unique Note Creator, Workspaces, Page Preview, or Format Converter.
- Canvas is a localStorage LATTICE board, not Obsidian `.canvas` file support.
- Bases/Collections are useful but do not implement Obsidian `.base` files, board/gallery/calendar/map views, or inline frontmatter editing.
- Community plugin support is install/load oriented; online browsing, updates, uninstall, real setting tabs, view/ribbon/status rendering, and broad Obsidian API coverage are missing.
- Mobile is only a mock preview, not a functional mobile app.

## Evidence Map

Key files reviewed:

- Shell/layout: `apps/desktop/src/app/App.tsx`, `components/layout/*`, `app/routes.tsx`, `stores/ui-store.ts`.
- Settings: `components/settings/SettingsScreen.tsx`, `stores/settings-store.ts`.
- Editor/rendering: `components/editor/EditorWorkspace.tsx`, `WysiwygEditor.tsx`, `MarkdownEditor.tsx`, `MarkdownPreview.tsx`, `live-preview.ts`, `InsertMenu.tsx`.
- Vault/files: `stores/vault-store.ts`, `lib/commands.ts`, `src-tauri/src/commands/note_commands.rs`, `crates/lattice-core/src/files/mod.rs`.
- Index/search/graph: `crates/lattice-indexer/*`, `crates/lattice-db/src/connection.rs`, `src-tauri/src/commands/search_commands.rs`, `features/graph/GraphView.tsx`.
- Canvas/Bases: `features/canvas/CanvasView.tsx`, `stores/canvas-store.ts`, `features/collections/CollectionsView.tsx`, `src-tauri/src/commands/collection_commands.rs`.
- Plugins: `components/plugins/PluginMarketplace.tsx`, `features/plugins/obsidian-runtime.ts`, `features/plugins/obsidian-host.ts`, `crates/lattice-plugin-runtime/*`.

## Section-by-section Gap Matrix

| Obsidian area | Current LATTICE status | Important gaps |
| --- | --- | --- |
| 1. Application shell | Partial | Has top CommandBar, left/right sidebars, status bar, resizable sidebars. Missing native/custom title bar behavior, Obsidian left ribbon, actual note tab bar, multi-pane split workspace, stacked panes, tab pop-outs, tab drag/drop, pane rearrangement. |
| 2. Notes creation/editing/actions | Partial | Can create notes from sidebar, shortcut, command palette, dialog templates, and unresolved wikilinks. Missing editable inline title rename, quick switcher create flow, visible note action menus, duplicate/move/open in new tab/open to side/open in window/pin/copy Obsidian URI/reveal/bookmark. Rename/delete commands exist but are not surfaced in FileTree UI. |
| 3. Settings: Editor | Partial / stored only | Settings UI includes default mode, properties display, readable line length, line numbers, line wrapping, spellcheck, auto-pair Markdown, smart indent, tabs, tab size. Most are not applied to the active TipTap editor; `MarkdownEditor` wires several settings but is not currently used by `EditorWorkspace`. Missing default editing mode Live Preview vs Source, show editor status, show inline title, strict line breaks, fold heading, fold indent, indentation guides, RTL, spellcheck language picker, auto-convert HTML, Vim mode. |
| 4. Settings: Files and Links | Partial / stored only | Settings exist for confirm delete, trash strategy, update links on rename, default note location, link format, attachment folder, excluded patterns. Attachment folder is used by import. Rename always rewrites wikilinks without checking the setting. Delete ignores trash strategy and removes files directly. New note location/link format/excluded patterns are not consistently applied. Missing attachment deletion policy, system trash integration, `.trash`, detect all file extensions. |
| 5. Settings: Appearance | Partial | Has UI zoom, accent, density. Missing light/dark/auto color scheme, theme browsing/install/manage, font controls, editor font size, title bar toggle, ribbon toggle, native menus, translucency, view header toggle, real CSS snippet listing/toggling, custom app icon. |
| 6. Settings: Hotkeys | Missing / hardcoded | Global shortcuts are hardcoded. Settings page only displays a few hotkeys. Missing searchable hotkey registry, assign/edit/remove, conflict handling, plugin command hotkey support. |
| 7. Core plugins | Partial overall | Several plugin-like features are native routes/panels, but there is no Obsidian-style core plugin settings list with toggles and gear icons. See detailed core plugin matrix below. |
| 8. Community plugins | Partial | Can install from folder, bulk import Obsidian plugin folders, review permissions, enable/disable, load Obsidian `main.js` in a worker, register commands, styles, data. Missing restricted mode toggle, online plugin browser, update checks, uninstall/delete UI, rendered plugin settings tabs, rendered plugin ribbon/status items, real plugin views, broad API coverage. |
| 9. About and Account | Partial / missing | About page shows static LATTICE info. Missing Obsidian account, license, Sync/Publish account management, update check, auto-update control behavior, sandbox vault. |
| 10. Left sidebar panels | Partial | File tree, file/tag filter, create note/folder, tag chips exist. Missing separate Search panel, Bookmarks panel, hierarchical Tags panel, custom plugin panels, panel drag/reorder, sort/collapse controls. |
| 11. Right sidebar panels | Partial | Backlinks, outline, properties, and AI insights panels exist. Missing standalone outgoing links panel, true properties editor, clickable outline navigation, backlinks controls, custom plugin panels. |
| 12. Tab bar and pane system | Missing | LATTICE has top app navigation tabs and one active note, not Obsidian note tabs/leaves. Missing close/reopen/pin/rename tab actions, multiple notes, split right/down, linked panes, stacked tabs, pop-outs. |
| 13. Ribbon | Missing | No vertical ribbon with app/plugin command icons. Current CommandBar is different and horizontal. |
| 14. Status bar | Partial | Shows saved/saving, word count, indexed percent, last save/version. Missing editor mode status per pane, cursor position, character count, backlink/sync/plugin status contributions, plugin-added status items. |
| 15. Note editor | Partial | Has TipTap visual editor, reading view, split visual + raw source viewer, toolbar, slash menu, insert menu. Missing true editable source mode in active workspace, true CodeMirror Live Preview path, find/replace, inline find, multi-cursor, move/duplicate lines, folding, spellcheck suggestions/languages, heading/block autocomplete, interactive image resizing. |
| 16. Markdown formatting | Partial | Preview supports GFM, math, raw HTML, Mermaid, highlights, comments, wikilinks, media assets, callouts. Missing true note/section/block transclusion, block reference navigation, full footnote UX validation, source editing parity, complete Obsidian-specific syntax behavior. |
| 17. Callouts | Partial | Basic callouts, collapse marker, titles, tones, and Markdown body rendering exist. Missing complete type/icon mapping, CSS-variable customization, robust nested callouts, Obsidian exact DOM/classes. |
| 18. Embeds/transclusion | Partial | Images, PDF, audio, and video local embeds render via asset data URLs. Missing note embeds, section embeds, block embeds, embedded-note live updates, embed edit/open controls. |
| 19. Properties/frontmatter | Partial | YAML and inline properties are parsed and indexed; right sidebar can show raw frontmatter; collections use properties. Missing top-of-note properties UI editor, property type controls, reserved properties behavior (`aliases`, `tags`, `cssclasses`), validation, inline edits writing back to Markdown. |
| 20. Graph view | Partial | Has global/local graph, visual renderer, labels, tag filtering, orphan toggle, node inspector, pan/zoom/fit, open node. Backend ignores depth/filter params except active path; frontend tag/orphan filter is client-side. Missing graph search query language, groups/color rules, attachment/existing-files toggles, display controls for arrows/text/fade, force controls, animation controls, exact local graph depth behavior. |
| 21. Canvas | Partial | Has text/note/web cards, groups, connections, drag, pan/zoom, fit, import/export JSON, duplicate/delete, snap grid. Missing Obsidian `.canvas` files, image/media cards, iframe web cards, card markdown rendering, live linked-note rendering, edge labels/directions/colors, 8 resize handles, lasso selection, bottom quick-add toolbar, right-click menu, drag files from vault to canvas. |
| 22. Bases | Partial | Collections and `lattice-query` code blocks provide a database-like layer over frontmatter. Missing `.base` files, source configuration UI, table column operations, inline cell/property editing, new row creates note, board/kanban, gallery, calendar, map view. |
| 23. Search | Partial | FTS search and partial advanced search exist; embedded `query` code block exists. Supports path/file/tag/content/task/task-todo/task-done/regex/quotes/exclusion/OR/property-like filters. Missing left Search panel, line/block/section operators, full parenthesized boolean logic, result sort controls, expand/collapse context, copy/export results, Obsidian exact query grammar. |
| 24. File explorer | Partial | Shows virtualized tree, folder expand/collapse, note open, create note/folder, text filter. Missing top sort/collapse-all/more menu, context menus, rename/delete/duplicate/move, open new tab/window/split, new canvas, copy path/URI, reveal, bookmarks, drag/drop reordering/move. |
| 25. Right-click context menus | Mostly missing | Graph has right-click pin/release. Missing editor/link/image/heading/file/folder/tab context menus. Browser default context menu is not Obsidian parity. |
| 26. Drag and drop | Partial | Canvas cards/groups drag; graph nodes drag; insert menu imports local attachments. Missing file explorer to editor/canvas, external file drag to editor/canvas, tab drag to split/popout, bookmark reorder, panel icon drag. |
| 27. Note color/customization | Partial | Has LATTICE-specific `bgPreset`, text/background HTML color toolbar, highlights, canvas group colors. Missing Obsidian-style CSS snippet system, `cssclasses` application, folder/file color plugins, callout CSS variables, full note/theme customization. |
| 28. Mobile | Missing / mock only | `MobilePreview` is a static companion preview. Missing actual iOS/Android app behavior, side swipes, mobile toolbar configuration, quick note widget, file permissions, camera insert, audio recording, pull to refresh, hide phone status bar. |

## Core Plugin Matrix

| Core plugin from bible | Status in LATTICE | Gap |
| --- | --- | --- |
| Backlinks | Partial | Right sidebar lists linked/unlinked mentions and can convert an unlinked mention. Missing plugin toggle/settings, backlink-in-document mode, collapse controls, sort/filter behavior. |
| Bases | Partial | Collections/lattice-query are similar. Missing `.base` file support and Obsidian view/edit features. |
| Bookmarks | Missing | No bookmark data model or panel. |
| Canvas | Partial | Native LATTICE canvas exists but not Obsidian `.canvas`. |
| Command Palette | Partial | `Ctrl/Cmd+K` palette searches commands and notes. Missing Obsidian `Ctrl/Cmd+P` behavior, pinned commands, command explanations, full command registry/hotkeys integration. |
| Daily Notes | Partial | Shortcut and palette create/open `Daily Notes/YYYY-MM-DD.md`. Missing settings for date format, folder, template, open on startup. Existing command may overwrite if file already exists depending lower-level write behavior. |
| File Recovery | Missing | No snapshots, interval setting, history length, restore UI. |
| Format Converter | Missing | No commands for Markdown/HTML/tag/property conversion. |
| Graph View | Partial | See graph row above. |
| Note Composer | Missing | No merge/split/extract heading workflow. |
| Outline | Partial | Headings list exists. Missing click-to-scroll, collapse, active heading tracking. |
| Outgoing Links | Partial | Included inside backlinks tab. Missing standalone panel/settings and interaction model. |
| Page Preview | Missing | No hover preview popovers or delay settings. |
| Properties View | Partial | Raw frontmatter display only. Missing typed editable property panel. |
| Quick Switcher | Partial | Palette can open notes/search results. Missing quick-switcher-specific options and create-if-missing workflow. |
| Random Note | Missing | No random note command. |
| Search | Partial | Search engine exists; no full Obsidian search panel/result controls. |
| Slash Commands | Partial | TipTap slash menu and unused CodeMirror completions exist. Missing plugin toggle/settings and broader command set. |
| Tags View | Partial | Tag chips in left sidebar. Missing hierarchical tag view, counts, search-by-tag behavior. |
| Templates | Partial | New-note templates exist. Missing configured template folder, insert-template command, date/time formats. |
| Unique Note Creator | Missing | No unique timestamp note command/settings. |
| Web Viewer | Missing / indirect | Insert menu can add iframe HTML; no Obsidian Web Viewer plugin/view. |
| Word Count | Partial | Status bar shows active note word count. Missing character count, selection count, plugin toggle/status contribution. |
| Workspaces | Missing | No save/load workspace layouts. |

## Settings Coverage Detail

### Editor settings

Implemented or partly present:

- Default view mode: stored and can switch workspace mode.
- Properties display: visible/hidden/source, but only affects right sidebar raw frontmatter display.
- Readable line length: setting exists, but active editor does not consistently use it.
- Line numbers, line wrapping, spellcheck, auto-pair Markdown, tab size: implemented in `MarkdownEditor`, but that component is not wired into `EditorWorkspace`.
- Visual editor has formatting toolbar, slash menu, task list, table, links, images, and autosave.

Missing or not wired:

- Live Preview vs Source mode as Obsidian defines it.
- Editable source mode in the active workspace.
- Show editor status.
- Show inline title and inline title rename.
- Strict line breaks.
- Heading/list folding.
- Indentation guides.
- RTL.
- Spellcheck languages and suggestion menu.
- Auto-pair brackets separate from Markdown syntax.
- Smart indent lists in active editor setting behavior.
- Use tabs behavior in active editor.
- Auto-convert HTML paste setting.
- Vim key bindings.

### Files and links settings

Implemented or partly present:

- Attachment folder is used by local attachment import.
- Rename command rewrites wikilinks.
- New note/folder commands exist.
- Wikilink open creates unresolved target notes.

Missing or not wired:

- Confirm delete behavior in file UI.
- Trash strategy/system trash/app trash.
- Attachment deletion handling.
- `updateLinksOnRename` setting respected at runtime.
- Link format setting when creating/inserting links.
- Default new note location respected across all create paths.
- Detect all file extensions.
- Excluded patterns applied by the backend scanner.

### Appearance settings

Implemented:

- UI zoom.
- Accent color.
- Density setting storage.

Missing:

- Light/dark/auto theme mode.
- Theme browser/installer/manager.
- Interface/text/monospace font settings.
- Font size.
- Show tab title bar.
- Show ribbon.
- Native menus.
- macOS translucency.
- Show view header.
- CSS snippet list/toggle/reload.
- Custom app icon.

### Hotkeys

Missing as a configurable feature. Existing shortcuts are hardcoded in `useGlobalShortcuts`.

### Account/about

LATTICE is local-first and does not need an Obsidian-style account by default. If targeting 1:1 UI parity, the About/Account screens still need:

- Version and update checks tied to real update code.
- Auto-update control behavior.
- Sandbox vault/open demo vault.
- Account/license placeholder or LATTICE-specific equivalent.
- Sync/Publish management if those features are added.

## Markdown and Rendering Coverage

Supported in preview:

- Paragraphs, headings, bold, italic, strikethrough, inline code, fenced code.
- GFM lists, tasks, and tables.
- Blockquotes.
- Raw HTML via `rehype-raw`.
- Math via KaTeX.
- Mermaid code blocks.
- Hidden comments removed from preview.
- `==highlight==`.
- Wikilinks converted to clickable note links.
- Local image/PDF/audio/video embeds through `lattice-asset://`.
- Embedded search via `query` code blocks.
- LATTICE embedded collections via `lattice-query` and `lattice-database`.

Important missing Obsidian behavior:

- `![[Note]]` note transclusion.
- `![[Note#Heading]]` section transclusion.
- `![[Note^block-id]]` block transclusion.
- Click/scroll behavior for heading and block anchors.
- Full Obsidian callout DOM/type/icon customization.
- Real property editor rendering above the note body.
- CSS class application from `cssclasses`.
- Complete file embed behavior for arbitrary attachments.

## Search Query Gap

Current advanced search supports useful pieces:

- `path:`, `file:`, `tag:`, `content:`.
- `task:`, `task-todo:`, `task-done:`.
- Quoted phrases.
- `-excluded` terms.
- `OR` split.
- `/regex/`.
- Basic property filters through `property:key` and `[key:value]`.

Missing relative to Obsidian:

- `line:(...)`.
- `block:(...)`.
- `section:(...)`.
- Full parenthesis grouping and nested boolean logic.
- Exact result sorting controls.
- Expand/collapse match context.
- Copy/export results.
- Search panel UX separate from command palette.

## Plugin Compatibility Gap

Implemented:

- Standard Obsidian plugin manifest detection.
- Bulk import from `.obsidian/plugins`.
- Broad permission grants for Obsidian plugins.
- Worker execution of `main.js`.
- CommonJS `require("obsidian")` shim.
- `Plugin`, `App`, `Vault`, `Workspace`, `MetadataCache`, `TFile`, `TFolder`, `Notice`, `Modal`, `PluginSettingTab`, `Setting` basics.
- Command registration and palette integration.
- Ribbon/status/settings registration events.
- Markdown processor registration events.
- Plugin data read/write.
- Gated `path`, `fs.promises`, and `requestUrl`.

Missing or very limited:

- Rendered ribbon icons and status bar items in the real UI.
- Rendered plugin setting tabs with functional controls.
- Custom views/ItemView/workspace leaf APIs.
- Editor APIs beyond command registration.
- DOM conventions many Obsidian plugins rely on.
- Desktop/Electron APIs except minimal gated warnings/shims.
- Plugin update checks and uninstall.
- Online community plugin browsing.
- API compatibility report beyond heuristic warnings.
- Per-action audit log and secret broker, both listed as remaining goals in docs.

## Recommended Implementation Order

1. Wire the active editor correctly.
   - Decide whether active edit mode is TipTap, CodeMirror, or both.
   - Make source mode editable.
   - Apply editor settings to the active editor.
   - Add find/replace, folding, line numbers, spellcheck, Vim, strict breaks, RTL.

2. Build the Obsidian workspace model.
   - Introduce note tabs/leaves.
   - Split right/down, tab close/rename/pin, stacked panes, active leaf state.
   - Persist workspaces.
   - Add tab/file context menus.

3. Complete files and links behavior.
   - File explorer context menus.
   - Rename/delete/duplicate/move/reveal/copy path/copy URI/bookmark.
   - Respect Files and Links settings.
   - Implement trash behavior and attachment cleanup policy.

4. Make properties first-class.
   - Typed top-of-note properties UI.
   - Editable right sidebar properties.
   - Reserved property behavior for tags, aliases, cssclasses.
   - Write changes back to YAML safely.

5. Add missing core plugin surfaces.
   - Core plugin toggle/settings page.
   - Bookmarks, Templates, File Recovery, Note Composer, Random Note, Unique Note Creator, Page Preview, Workspaces.
   - Move existing graph/backlinks/search/canvas/bases into that model.

6. Implement Obsidian file formats for Canvas and Bases.
   - `.canvas` read/write with Obsidian-compatible schema.
   - `.base` read/write/configuration.
   - Board/gallery/calendar/map views and inline edits for Bases.

7. Expand search to Obsidian grammar and UI.
   - Add Search panel.
   - Add line/block/section operators and boolean grouping.
   - Add sort, context expansion, copy/export.

8. Expand plugin compatibility.
   - Render plugin UI contributions.
   - Broaden workspace/editor APIs.
   - Add update/uninstall flows and compatibility diagnostics.

9. Treat mobile as a separate product.
   - The current preview should remain a design preview until real vault access, editing, toolbar, gestures, camera/audio, and sync/local storage are implemented.

## Bottom Line

LATTICE has the right architectural direction for an Obsidian-compatible local-first Markdown IDE, especially around vault indexing, backlinks, search, graph, and permission-first plugins. However, most Obsidian parity gaps are in application behavior and UI completeness rather than raw Markdown parsing. The project should not market itself as 1:1 Obsidian-compatible yet; it is currently best described as an Obsidian-compatible vault foundation with partial Obsidian feature parity and an early Obsidian plugin compatibility layer.
