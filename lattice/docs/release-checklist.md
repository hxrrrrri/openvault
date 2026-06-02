# v0.1.0 Release Checklist

Run every command from the `lattice/` directory.

## 1. Code quality gates (must all pass)

```bash
cd lattice
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build

cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

- [ ] Frontend: typecheck, lint, test, build green
- [ ] Rust: fmt, clippy (`-D warnings`), test green
- [ ] CI (`ci.yml`) green on the release commit

## 2. Honesty review

- [ ] `../docs/status.md` reflects reality (no "complete" without source + tests)
- [ ] `obsidian-parity-matrix.md` reviewed and accurate
- [ ] No performance claim in README/docs that isn't backed by
      `performance-results.md`
- [ ] Screenshots either committed under `../docs/assets/screenshots/` or the
      README still marks them pending

## 3. Indexing & data safety

- [ ] Opening a large vault does not block the UI (background indexing)
- [ ] "Rebuild index" backs up the old DB and rebuilds from Markdown
- [ ] Delete/rename of notes is reflected in search and graph

## 4. Security

- [ ] Plugin permission denial/allow flows verified (and audited in the log)
- [ ] Secrets are not exposed to plugins without a `secrets:read` grant
- [ ] `requestUrl` denied without `network:http`
- [ ] Credential-like paths (`.env`, keys, `.ssh/`) blocked by default

## 5. Build & package

- [ ] `desktop-build.yml` produces bundles for Linux, Windows, macOS
- [ ] Each bundle launches and opens a vault
- [ ] See [installation.md](installation.md) for per-OS build steps

## 6. Tag & publish

- [ ] Update `CHANGELOG.md`
- [ ] Bump versions if needed (`package.json`, `Cargo.toml`, README badge)
- [ ] Create annotated tag `v0.1.0`
- [ ] Attach `desktop-build.yml` artifacts to the GitHub Release
- [ ] Verify README badges resolve on the released commit
