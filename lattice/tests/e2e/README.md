# E2E Tests

Full end-to-end tests that drive the **packaged Tauri binary** (via
WebDriver / `tauri-driver` + Playwright) are **roadmap** — they require the
desktop bundle to be built in CI first (see `.github/workflows/desktop-build.yml`).

## What is tested today instead

Until the packaged-binary harness lands, the equivalent user journeys are covered
at the integration level against the real command layer and a deterministic
backend:

- **`apps/desktop/src/lib/user-journey.test.ts`** — open vault → create note →
  add wikilink → graph updates → search finds note → backlink resolves.
- **`apps/desktop/src/lib/browser-mock.test.ts`** — command provider + search
  mutation behavior in browser preview mode.
- **`apps/desktop/src-tauri/src/state.rs`** (Rust) — incremental index
  create/update/delete and the plugin permission deny→allow flow with audit.

## Planned E2E scenarios (packaged binary)

1. Create vault.
2. Create note.
3. Add wikilink; confirm graph updates.
4. Search finds the note.
5. Install a mock plugin.
6. Deny, then allow, a plugin permission and assert the gated action.

When the desktop build is wired into CI, add a `playwright.config.ts` here and a
`@lattice/desktop e2e` script that launches `tauri-driver`.
