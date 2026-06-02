# LATTICE — Feature Status

> Honest, source-backed status for `v0.1.0` (pre-release). This file is the
> authoritative answer to "does feature X actually work?" The README "Features"
> section describes intent and surface area; **this file describes reality.**
>
> A feature is only listed as **Completed** if there is shipping source code
> **and** automated test coverage. Everything else is **Partial**, **Roadmap**,
> or **Experimental**. Last reviewed: 2026-06-01.

Legend:
- ✅ **Completed** — implemented and covered by automated tests.
- 🟡 **Partial** — implemented but incomplete, untested, or with known gaps.
- 🧪 **Experimental** — present but unstable / depends on external tooling.
- 🗺️ **Roadmap** — planned, not yet built.

---

## ✅ Completed (source + tests)

| Feature | Source | Tests |
| --- | --- | --- |
| Markdown parsing (wikilinks, tags, frontmatter, tasks, headings) | `crates/lattice-indexer/src/markdown_parser.rs` | `markdown_parser.rs` unit tests |
| SQLite cache connection + schema/migrations | `crates/lattice-db/src/connection.rs`, `migrations.rs` | `connection.rs` unit tests |
| Graph generation (nodes/edges from links) | `crates/lattice-graph/src/graph.rs` | `graph.rs` unit tests |
| Plugin manifest validation | `crates/lattice-plugin-runtime/src/manifest.rs` | `manifest.rs` unit tests |
| Obsidian compatibility shims | `crates/lattice-plugin-runtime/src/obsidian.rs` | `obsidian.rs` unit tests |
| Collections (Bases) commands | `apps/desktop/src-tauri/src/commands/collection_commands.rs` | `collection_commands.rs` unit tests |
| Command palette (fuzzy search, keyboard nav) | `apps/desktop/src/components/command-palette/` | `CommandPalette.test.tsx` |
| File tree explorer | `apps/desktop/src/components/layout/FileTree.tsx` | `FileTree.test.tsx` |
| Graph canvas rendering | `apps/desktop/src/components/graph/GraphCanvas.tsx` | `GraphCanvas.test.tsx` |
| WYSIWYG editor (TipTap) | `apps/desktop/src/components/editor/` | `WysiwygEditor.test.tsx` |
| Obsidian plugin runtime host | `apps/desktop/src/features/plugins/` | `obsidian-runtime.test.ts`, `obsidian-compat-harness.test.ts` |
| Background + incremental + watcher indexing | `apps/desktop/src-tauri/src/state.rs`, `crates/lattice-indexer/src/incremental.rs` | `state.rs` (`incremental_indexing_tracks_create_update_delete`, …), `incremental.rs` unit tests |
| Schema versioning + indexes + rebuild | `crates/lattice-db/src/migrations.rs`, `connection.rs` | `connection.rs` (`migrate_records_schema_version`, …) |
| Plugin permission enforcement + audit log | `apps/desktop/src-tauri/src/state.rs` | `state.rs` (`network_permission_denied_then_allowed_is_audited`) |
| Scoped secret broker | `apps/desktop/src-tauri/src/state.rs` | `state.rs` (`secret_broker_enforces_permission_and_scopes_by_plugin`) |
| Path-traversal + credential-path denial | `apps/desktop/src-tauri/src/commands/vault_commands.rs` | `vault_commands.rs` (`rejects_path_traversal`, `blocks_credential_like_paths_by_default`) |
| Browser preview mode (no Tauri) | `apps/desktop/src/lib/browser-mock.ts`, `lib/tauri.ts` | `browser-mock.test.ts`, `user-journey.test.ts` |

## 🟡 Partial (implemented, gaps remain)

| Feature | State | Gap |
| --- | --- | --- |
| Full-text search (FTS5) | Implemented; filename/content/heading tested. | Scoped operators (`line:`/`block:`/`section:`) still need dedicated tests. |
| Vault file operations (create/rename/delete, link rewrite) | Implemented; path-traversal now tested. | Rename link-rewrite correctness still untested. |
| Plugin secret-access review UI | Backend audit log + secret broker shipped and tested; command wrappers exist. | No dedicated review panel UI yet (audit log powers it). |
| Frontend reliability polish | Per-route error boundary + browser mock done. | Per-panel empty/loading states, large-tree virtualization, and full a11y sweep are incomplete. |
| Backlinks panel | Implemented. | Needs explicit rename/delete correctness tests. |
| Full cold reindex performance | Works; benchmarked. | ~8.5 s for 10k notes (one txn/note) — batching is a roadmap optimization. See [lattice/docs/performance-results.md](../lattice/docs/performance-results.md). |

## 🧪 Experimental

| Feature | Notes |
| --- | --- |
| AI console / local CLI providers (Claude Code, Codex, Gemini, Copilot, Ollama) | Spawns external CLIs; only works if those tools are installed and authenticated. Not covered by automated tests. |
| Semantic search | `crates/lattice-search/src/semantic.rs` — present, not wired into a shipping UX. |
| Canvas (`.canvas`) | JSON Canvas read/write conversion exists; full interactive canvas editor is not complete. |

## 🗺️ Roadmap (not yet built / not yet proven)

- Full empty/error/loading states for every panel; large-tree virtualization;
  command-palette recent/fuzzy ranking polish; a11y sweep (Phase 6 remainder).
- Packaged-binary E2E tests via `tauri-driver`/Playwright. The user journey is
  covered today at the integration level (`apps/desktop/src/lib/user-journey.test.ts`).
- **Graph render FPS** at large node counts is **not yet measured** — do not claim
  "smooth at 2,000 nodes" until `lattice/docs/performance-results.md` has a render
  benchmark. Core indexing/search numbers there are real and reproducible.
- Cold-index batching optimization (fewer SQLite transactions).
- Packaged installers + committed screenshots.

---

### How to verify this file

```bash
cd lattice
pnpm install
pnpm typecheck && pnpm test          # TypeScript + Vitest
cargo test --workspace               # Rust unit/integration tests
```

If a row in the **Completed** table ever fails its referenced test, downgrade it
to **Partial** here in the same change.
