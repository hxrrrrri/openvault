# Security Policy

LATTICE treats local notes as private user data.

## Principles

- No telemetry by default.
- No hidden network calls.
- Local AI providers are preferred.
- Cloud providers must be explicit opt-in.
- Plugins are permissioned by default.
- SQLite indexes are rebuildable caches, not authoritative storage.

## Plugin Safety

The MVP implements manifest validation, permission declarations, permission storage, and UI for review/revocation. It does not execute arbitrary third-party plugin code as trusted application code. Runtime execution is intentionally limited until the worker/sandbox boundary is completed.

## Reporting Vulnerabilities

Please open a private security advisory when the repository is hosted, or email the maintainers listed by the project owner. Include reproduction steps, affected versions, and expected impact.
