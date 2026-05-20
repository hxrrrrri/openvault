# Architecture

LATTICE is a local-first desktop app with a Tauri shell. The frontend renders the workspace, editor, command palette, graph, health dashboard, plugin views, and settings. The Rust side owns filesystem access, indexing, SQLite, search, graph generation, vault health, and plugin registry state.

## Layers

- `apps/desktop`: Tauri application and React UI.
- `crates/lattice-core`: vault paths, file scanning, safe path handling, shared core types.
- `crates/lattice-indexer`: Markdown parsing and metadata extraction.
- `crates/lattice-db`: SQLite connection, schema migrations, repositories, FTS.
- `crates/lattice-graph`: graph payloads, backlinks, metrics.
- `crates/lattice-search`: full-text and semantic search abstractions.
- `crates/lattice-ai`: local-first AI provider interfaces.
- `crates/lattice-plugin-runtime`: manifest validation, permissions, registry, sandbox boundaries.
- `packages/plugin-api`: TypeScript plugin SDK types.

## Source Of Truth

Markdown files are the durable source of truth. `.lattice/index.db` is a metadata and search cache. If the database is deleted or corrupt, the app rebuilds it by scanning the vault.

## Frontend Communication

React uses typed wrappers in `src/lib/commands.ts`. In Tauri, wrappers call `invoke`. In browser development, they use deterministic sample data so UI work can continue without a Rust runtime.

## Indexing

The Rust indexer scans Markdown files off the UI thread, hashes content, skips unchanged files, extracts metadata, and writes SQLite updates in batches. Tauri emits indexing progress events to the UI.

## Graph

Graph data is derived from resolved Markdown and wikilinks. The frontend canvas renderer culls labels and keeps interactions on requestAnimationFrame. Larger future vaults can switch to clustering or WebGL without changing the command shape.
