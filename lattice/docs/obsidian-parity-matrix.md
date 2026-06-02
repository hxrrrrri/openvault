# Obsidian Parity Matrix

Honest, source-backed comparison of LATTICE against Obsidian behavior for
`v0.1.0`. Status reflects what the code actually does today, not aspiration.

**Status legend:** ✅ complete & tested · 🟡 partial / untested · 🧪 experimental
· 🗺️ planned. "Test coverage" lists the automated test that exercises the
feature, or _none_ when only manual/visual verification exists. Last reviewed:
2026-06-01.

| Feature | Obsidian behavior | LATTICE status | Source file | Test coverage | Gap |
| --- | --- | --- | --- | --- | --- |
| Wikilinks | `[[Note]]`, `[[Note\|alias]]`, heading/block refs | ✅ parse + resolve | `crates/lattice-indexer/src/links.rs`, `markdown_parser.rs` | `markdown_parser.rs` (`parses_wikilinks_tags_frontmatter_and_tasks`) | Heading/block ref resolution not surfaced in graph |
| Embeds | `![[Note]]`, `![[image.png]]` | 🟡 parsed as embed link type | `crates/lattice-indexer/src/links.rs` | parser test asserts `Embed` type | Transclusion rendering of embedded notes is partial |
| Backlinks | Linked + unlinked mentions panel | ✅ linked; 🟡 unlinked | `crates/lattice-db/src/connection.rs` (`backlinks`), `features/backlinks` | `connection.rs` (`rename_via_delete_then_insert...`) | Unlinked-mention command exists; needs dedicated tests |
| Graph view | Interactive force graph, local/global | ✅ render; 🟡 perf-unproven | `crates/lattice-graph/`, `components/graph/GraphCanvas.tsx` | `graph.rs`, `GraphCanvas.test.tsx` | Large-graph FPS not benchmarked (see performance-results.md) |
| Tags | `#tag`, nested `#a/b`, tag pane | ✅ parse + list + filter | `crates/lattice-indexer/src/tags.rs` | parser test asserts nested tag | — |
| Frontmatter / Properties | YAML props, typed fields, Properties UI | ✅ parse; ✅ typed UI | `crates/lattice-indexer/src/frontmatter.rs`, `features/notes` | `markdown_parser.rs` asserts `title` property | Property editor edge cases (lists/dates) need tests |
| Tasks | `- [ ]` / `- [x]`, due/priority/block id | ✅ parse | `crates/lattice-indexer/src/tasks.rs` | parser test asserts 2 tasks + block id | No task query/dashboard view |
| Canvas | `.canvas` JSON, interactive board | 🟡 format I/O only | `features/canvas/canvas-file.ts`, `CanvasView.tsx` | _none_ | Bidirectional `.canvas` conversion exists; full editing UX incomplete |
| Command palette | Fuzzy `Mod+P`, groups, plugin cmds | ✅ | `components/command-palette/`, `lib/commands.ts` | `CommandPalette.test.tsx` | Recent-commands ranking still basic |
| Hotkeys | Rebindable, conflict detection | ✅ editor + registry | `features/hotkeys/hotkey-registry.ts`, `HotkeyEditor.tsx` | _none_ | Editor lacks automated tests |
| Plugin manifests | `manifest.json` schema, validation | ✅ | `crates/lattice-plugin-runtime/src/manifest.rs` | `manifest.rs` unit tests | — |
| Plugin lifecycle | enable/disable/load/unload, cleanup | 🟡 | `features/plugins/main-runtime.ts`, `obsidian.rs` | `obsidian-runtime.test.ts` | Unload-cleanup (styles/intervals) needs explicit tests |
| Plugin settings | `addSettingTab`, contributions | 🟡 | `components/plugins/PluginSettingsContributions.tsx` | _none_ | UI present; not test-covered |
| Plugin permissions | (LATTICE-specific) typed grants + audit | ✅ enforced + audited | `apps/desktop/src-tauri/src/state.rs` | `state.rs` (`network_permission_denied_then_allowed_is_audited`) | Secret-access review UI minimal |
| Themes | CSS themes, light/dark/system | 🟡 | `features/settings`, `obsidian-compat-harness.ts` | _none_ | Theme switching present; community theme install not complete |
| Daily notes | Date-templated daily note | ✅ command | `features/core-plugins/commands.ts` | _none_ | Templating options limited |
| Templates | Insert template from folder | ✅ command | `features/core-plugins/commands.ts` | _none_ | No template variables/date tokens |
| Random note | Open random note | ✅ command | `features/core-plugins/commands.ts` | _none_ | — |
| Unique note (Zettel) | Timestamp-id note | ✅ command | `features/core-plugins/commands.ts` | _none_ | — |
| Search operators | `line:` / `block:` / `section:` scopes | 🟡 implemented | `crates/lattice-search/`, `crates/lattice-db` (FTS5) | `connection.rs` (`fts_matches_filename_content_and_title`) | Scoped operators lack dedicated tests |
| Link rename rewriting | Rename note → update inbound links | 🟡 | `features/notes`, `note_commands.rs` | _none_ | Toggle exists; rewrite correctness untested |

## Honest summary

- **Solid & tested:** Markdown parsing (links/tags/tasks/frontmatter), graph
  generation, FTS search, plugin manifest validation, plugin permission
  enforcement + audit, command palette.
- **Works but under-tested:** canvas I/O, hotkey editor, plugin settings/lifecycle
  cleanup, themes, link-rename rewriting, scoped search operators.
- **Not yet proven:** large-graph rendering performance — see
  [performance-results.md](performance-results.md). Do not claim smoothness at
  thousands of nodes until benchmarks exist.

When a row's status changes, update both this matrix and
[../../docs/status.md](../../docs/status.md) in the same change.
