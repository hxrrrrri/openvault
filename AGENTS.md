# LATTICE Automation Skill

Use this guide when an AI CLI is launched from the LATTICE terminal to inspect, modify, test, or automate this repository.

## Workspace

- Treat `LATTICE_WORKSPACE_ROOT` as the project root when it is set.
- Treat `LATTICE_VAULT_ROOT` as the active Markdown vault, not necessarily the codebase root.
- Prefer project-local commands from `lattice/package.json` and `lattice/Cargo.toml`.
- Read existing source before editing. Preserve unrelated user changes.

## Permission Gates

Ask the user for explicit approval before:

- Deleting, moving, or overwriting broad sets of files.
- Running dependency installs, package upgrades, migrations, or networked write operations.
- Reading secrets, tokens, private keys, `.env` values, browser profiles, or credential stores.
- Running `git reset`, force pushes, history rewrites, or branch deletion.
- Launching production deployments or commands that affect external services.

Safe work that can proceed without extra approval:

- Reading files, searching code, and inspecting git status or diffs.
- Narrow edits inside the requested feature area.
- Typechecks, unit tests, formatting, and local build commands.

## Implementation Workflow

1. Locate the relevant code with `rg` and read the smallest useful set of files.
2. Make scoped changes that follow existing project patterns.
3. Add or update tests when the behavior is user-facing or regression-prone.
4. Run the narrowest meaningful verification first, then broader checks when needed.
5. Summarize changed files, verification, and any remaining risk.

## Project Commands

Run from `lattice/` unless a task specifically requires another directory:

- `pnpm --filter @lattice/desktop typecheck`
- `pnpm --filter @lattice/desktop test`
- `pnpm --filter @lattice/desktop dev`
- `cargo test --workspace`
- `cargo fmt --all`

## Product Principles

- LATTICE is local-first; Markdown files remain the source of truth.
- Obsidian-compatible syntax matters: `[[wikilinks]]`, `![[embeds]]`, frontmatter, tasks, tags, and callouts.
- Plugin and AI features must remain permission-first.
- UI should be dense, polished, and operational rather than marketing-style.
