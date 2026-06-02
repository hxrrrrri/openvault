# Performance Results

Real, reproducible measurements of LATTICE's core indexing and search paths.
**No number on this page is hand-written** — every figure comes from the
benchmark below. Where a claim is not backed by a measurement, it is explicitly
called out as "not yet measured."

Last run: 2026-06-01.

## How to reproduce

The core benchmark exercises the real `lattice-indexer` parser and `lattice-db`
SQLite/FTS5 code over synthetic vaults of 100 / 1,000 / 10,000 notes (each note
has one wikilink and one tag):

```bash
cd lattice
cargo test -p lattice-db --release -- --ignored --nocapture core_indexing_benchmark
```

> Scope: this measures CPU-bound parsing + database work **in memory**. It
> deliberately excludes filesystem IO latency, the Tauri IPC boundary, and graph
> _rendering_ (canvas FPS). Treat it as a floor for backend cost, not an
> end-to-end figure. Numbers vary by machine.

## Results (in-memory core, developer workstation, Windows 11, release build)

| Notes | Full cold index | Incremental skip (re-hash all) | Avg search | Graph data query |
| ----: | --------------: | -----------------------------: | ---------: | ---------------: |
| 100    | ~23 ms    | 0.06 ms | 0.07 ms | 0.6 ms |
| 1,000  | ~239 ms   | 0.42 ms | 0.12 ms | 2.6 ms |
| 10,000 | ~8.5 s    | 4.4 ms  | 0.30 ms | 24.6 ms |

### What this shows (honestly)

- **Incremental re-index is the headline win.** After the first index, detecting
  that nothing changed across 10,000 notes takes ~4 ms. This is what makes
  re-opening a vault feel instant (Phase 3) — the cache is hash-checked, not
  re-parsed.
- **Search is sub-millisecond** at every tested size (FTS5 + bm25), well under
  any interactive threshold.
- **Graph data retrieval** (notes + links query that feeds the payload) is ~25 ms
  at 10k notes.
- **Full cold index does not scale linearly and is the slow path.** A from-scratch
  index of 10,000 notes takes ~8.5 s, dominated by one SQLite transaction per
  note. This only happens on first index or an explicit "Rebuild index"; normal
  usage hits the incremental path above.

### Optimization applied

The Markdown parser previously recompiled ~10 regular expressions on **every**
note. Hoisting them to `LazyLock` statics cut full-index time substantially in
this benchmark:

| Notes | Full index before | Full index after | Speedup |
| ----: | ----------------: | ---------------: | ------: |
| 100    | ~247 ms   | ~23 ms  | ~10× |
| 1,000  | ~1,885 ms | ~239 ms | ~8×  |
| 10,000 | ~23.8 s   | ~8.5 s  | ~2.8× |

## Not yet measured (do not claim)

- **End-to-end startup-to-visible time** under Tauri.
- **Graph render FPS** at large node counts. The README/docs must **not** claim
  "smooth at 2,000 nodes" until a render-FPS benchmark exists here.
- **On-disk full reindex** (this benchmark is in-memory; real disk IO adds cost).

## Roadmap

- Batch note upserts into fewer transactions to flatten the cold-index curve.
- Add a Tauri-level end-to-end timing harness for startup and on-disk reindex.
- Add a graph render-FPS probe before making any large-graph smoothness claim.
