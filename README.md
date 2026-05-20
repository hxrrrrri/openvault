# LATTICE

<p align="center">
  <img src="docs/assets/lattice-wordmark.png" alt="LATTICE - local-first Markdown knowledge graph" width="720" />
</p>

LATTICE is an open-source, local-first Markdown knowledge graph IDE. It keeps Markdown files as the source of truth, builds a rebuildable SQLite metadata cache, renders backlinks and graph relationships, and prepares a permission-first plugin system for a future ecosystem.

> Your files. Your graph. Your plugins. Your AI. No lock-in. No black box.

## Status

Version `0.1.0` is a local desktop workspace with a real vault bootstrap, Rust core modules for vault scanning, Markdown metadata extraction, graph/search foundations, plugin manifest validation, Collections, and CLI-based AI automation.

## Features

- Create or open a local vault folder.
- First launch creates a real local vault at `Documents/Lattice Vault` unless `LATTICE_VAULT_PATH` is set.
- Import existing Markdown vaults while leaving `.obsidian/` untouched.
- File explorer, note create/read/write/rename/delete, folder creation.
- CodeMirror Markdown editor with preview and split modes.
- Wikilinks, Markdown links, image/file embeds, callouts, tags, frontmatter, headings, tasks, and backlink extraction.
- Lattice Collections: Obsidian Bases-like table/card views over Markdown files with YAML properties and cover image fields.
- Book importer for creating structured book notes from Open Library metadata.
- AI console for real local CLI providers: Claude Code, Codex CLI, Gemini CLI, GitHub Copilot CLI, and Ollama.
- SQLite schema for file metadata, note metadata, links, tags, properties, tasks, graph edges, search, plugins, settings, and workspace state.
- Backlinks, outgoing links, unresolved links, search, graph payloads, and vault health reports from the index.
- Canvas-based luminous constellation graph renderer.
- Command palette, vault health dashboard, plugin marketplace, permission modal, settings, and mobile companion preview.
- Plugin manifest schema, permission model, and registry state.

## Screenshots

Screenshots are intentionally left as placeholders until the desktop bundle is captured in CI.

## Tech Stack

- Tauri v2, Rust, SQLite, `notify`, `rusqlite`
- React, TypeScript, Vite, Tailwind CSS
- CodeMirror 6, Zustand, TanStack Query, Framer Motion
- Canvas renderer for the graph MVP

## Development Setup

Prerequisites:

- Node.js 22+
- pnpm 10+
- Rust stable toolchain with Cargo
- Tauri v2 system prerequisites for your platform

```bash
pnpm install
pnpm dev
```

On Windows:

```powershell
.\scripts\setup.ps1
.\scripts\dev.ps1
```

## Commands

```bash
pnpm dev
pnpm desktop:web
pnpm desktop:dev
pnpm build
pnpm test
pnpm lint
pnpm typecheck
cargo test --workspace
cargo fmt --all
cargo clippy --workspace --all-targets -- -D warnings
```

## Architecture

The desktop shell is React + TypeScript inside Tauri. Rust owns vault access, indexing, SQLite, search, graph generation, health reports, local asset reads, Collections queries, plugin registry state, and CLI provider execution. The frontend talks to Rust through typed Tauri commands.

Markdown files remain the only durable source of note content. `.lattice/index.db` is a cache and can be rebuilt from files at any time.

See [docs/architecture.md](docs/architecture.md) for details.

## Security

No telemetry is enabled by default. Plugins are permissioned by design, AI providers are local-first, and external network access must be explicit. See [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
