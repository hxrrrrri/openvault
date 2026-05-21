# Obsidian Parity

LATTICE targets Obsidian-compatible vault content and a progressive compatibility layer for Obsidian community plugins.

## Plugin Compatibility Target

LATTICE accepts standard Obsidian plugin folders with:

- `manifest.json`
- `main.js` or the manifest `main` entry
- optional `styles.css`
- optional plugin data files

Obsidian manifests are detected by `minAppVersion`, `isDesktopOnly`, or by the absence of a LATTICE permission block. They are normalized into LATTICE plugin metadata and assigned reviewable permission requests.

The desktop marketplace can import one plugin folder or bulk-scan an Obsidian vault's `.obsidian/plugins` directory, registering every valid community plugin through the same permission review path.

## Runtime Shim

LATTICE now loads Obsidian `main.js` files inside an isolated browser worker. The worker exposes a CommonJS `require("obsidian")` shim with these API groups:

- `Plugin`, lifecycle, events, intervals, disposables
- `App`, `Vault`, `Workspace`, `MetadataCache`
- `TFile`, `TFolder`, `TAbstractFile`
- `MarkdownView`, workspace leaves, active file basics
- command registration and command palette integration
- ribbon icons, status bar, settings tab, modals, notices
- plugin data storage with `loadData()` and `saveData()`
- Markdown post processors and code block processors

The shim is intentionally measurable rather than pretending to be complete. Unsupported APIs emit compatibility warnings in plugin metadata, worker logs, or both.

## Permission Model

Obsidian plugins do not declare granular permissions. LATTICE maps them to broad requested grants and keeps them disabled until the user reviews permissions.

Default Obsidian plugin permissions:

- `vault:read`
- `vault:write`
- `workspace:read`
- `workspace:layout`
- `workspace:views`
- `editor:read`
- `editor:write`
- `editor:commands`
- `ui:ribbon`
- `ui:status-bar`
- `ui:settings-tab`
- `ui:modal`
- `storage:plugin-data`

Desktop-only plugins also request:

- `system:node-api`
- `system:filesystem`

Network and secret access remain off unless a plugin or compatibility adapter explicitly requests them. `requestUrl` maps to `network:http`; ambient worker `fetch`, `XMLHttpRequest`, `WebSocket`, and `EventSource` are blocked when that permission is not granted.

Plugin data writes go to:

```text
.lattice/plugins/<plugin-id>/data.json
```

If an installed Obsidian plugin folder contains `data.json`, LATTICE can use it as the initial read fallback before the managed data file exists.

## Compatibility Levels

1. **Installable**: LATTICE can read and display the Obsidian plugin manifest.
2. **Loadable**: LATTICE can execute `main.js` in a sandbox with an `obsidian` shim.
3. **Functional**: the plugin's primary commands and UI work.
4. **Native Quality**: settings, views, persistence, style injection, and cleanup behave like Obsidian.

The marketplace displays ecosystem, compatibility level, desktop-only status, missing API warnings, and requested permissions. Enabling an Obsidian plugin only marks it functional after the worker successfully loads it.

## Known Limits

No app can guarantee every Obsidian plugin works without implementing Obsidian's public API, enough DOM conventions, and safe substitutes for desktop-only Node/Electron behavior. Plugins that use private Obsidian internals, raw Electron APIs, or arbitrary Node filesystem access must be supported case-by-case through explicit permissions and shim extensions.
