# Performance

Targets:

- Shell visible quickly on startup.
- Editor input under a 16ms frame budget.
- Indexing never blocks the UI.
- Search under 100ms for normal vaults.
- File tree handles thousands of paths.
- Graph remains smooth around 2,000 nodes in the MVP.

Techniques:

- Rust background indexing.
- Content hashes to skip unchanged files.
- SQLite prepared queries and batched transactions.
- Virtualized lists in the frontend.
- Debounced autosave.
- Lazy graph and dashboard views.
- Label culling in the graph renderer.
- Progress events during long-running scans.
