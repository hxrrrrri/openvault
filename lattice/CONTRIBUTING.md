# Contributing

LATTICE is designed as a modular local-first desktop app. Contributions should preserve these constraints:

- Markdown files are source of truth.
- SQLite is a rebuildable cache.
- No telemetry or hidden network calls.
- Plugins require explicit permissions.
- Performance-sensitive vault, index, graph, and search work belongs in Rust.
- UI changes should follow the design tokens in `apps/desktop/src/styles/tokens.css`.

Before opening a pull request:

```bash
pnpm install
pnpm typecheck
pnpm test
cargo fmt --all
cargo test --workspace
```
