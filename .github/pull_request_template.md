<!--
The app lives in `lattice/`. Run checks from there:
  cd lattice && pnpm typecheck && pnpm lint && pnpm test && pnpm build
  cd lattice && cargo fmt --all --check && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace
-->

## Summary

<!-- What does this change and why? -->

## Tests

<!-- REQUIRED. Describe the tests you added or updated, and paste the result.
     If this PR genuinely needs no tests, explain why. -->

- [ ] `cargo test --workspace` passes
- [ ] `pnpm test` passes
- [ ] New behavior is covered by an automated test

## Screenshots (required for UI changes)

<!-- Before/after images or a short clip. Write "N/A — no UI change" otherwise. -->

## Security impact

<!-- Does this touch plugin permissions, secrets, network, filesystem access, or
     the sandbox? Describe the impact, or write "None". -->

- [ ] No new permission, network, or filesystem capability is granted without a check
- [ ] Secrets are never exposed to plugin code without an explicit grant

## Performance impact

<!-- Indexing, search, graph, or editor hot paths? Note measurements or write "None". -->

## Docs / status

- [ ] Updated `docs/status.md` and/or `lattice/docs/obsidian-parity-matrix.md` if feature status changed
- [ ] No README claim says a feature is "complete" without source + tests to back it
