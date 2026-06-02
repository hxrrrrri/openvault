# Installation & Build

LATTICE is a Tauri v2 desktop app. The application lives in the `lattice/`
directory of this repository — run all commands from there.

> No prebuilt installers are published yet for `v0.1.0`. Build from source using
> the steps below, or download artifacts from a successful
> [Desktop Build](../../.github/workflows/desktop-build.yml) CI run.

## Prerequisites (all platforms)

- **Node.js 22+**
- **pnpm 10.33.2** (pinned via `packageManager` in `package.json`; `corepack enable`
  will provision it automatically)
- **Rust stable** toolchain with Cargo
- Tauri v2 system dependencies (per-OS, below)

```bash
cd lattice
pnpm install
```

## Run in development

```bash
pnpm desktop:dev   # full Tauri desktop app
# or
pnpm desktop:web   # frontend only, in a browser (uses the deterministic mock backend)
```

## Build a distributable bundle

```bash
pnpm desktop:build   # tauri build -> installers/bundles in target/release/bundle/
```

## Platform notes

### Windows
- Install the **Microsoft C++ Build Tools** and **WebView2 Runtime** (preinstalled
  on Windows 11).
- Output: `.msi` / `.exe` (NSIS) under `target/release/bundle/`.

### macOS
- Install Xcode Command Line Tools: `xcode-select --install`.
- Output: `.app` and `.dmg`. Unsigned builds require right-click → Open on first
  launch (no Apple Developer signing is configured yet).

### Linux
- Install Tauri's WebKitGTK dependencies, e.g. on Debian/Ubuntu:
  ```bash
  sudo apt-get update
  sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev \
      librsvg2-dev patchelf libgtk-3-dev
  ```
- Output: `.AppImage` and `.deb` under `target/release/bundle/`.

## First launch

On first run LATTICE opens (or creates) a vault at `~/Documents/Lattice Vault`
unless `LATTICE_VAULT_PATH` is set. See [`.env.example`](../.env.example) for all
optional environment variables. Markdown files are the durable source of truth;
`.lattice/index.db` is a rebuildable cache (use "Rebuild index" anytime).
