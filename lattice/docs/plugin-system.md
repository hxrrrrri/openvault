# Plugin System

Plugins declare a manifest:

```json
{
  "id": "example-plugin",
  "name": "Example Plugin",
  "version": "0.1.0",
  "description": "Example plugin",
  "author": "Author",
  "main": "main.js",
  "permissions": {
    "vault": ["read"],
    "network": [],
    "editor": ["commands"],
    "workspace": ["views"],
    "ui": ["status-bar", "settings-tab"],
    "storage": ["plugin-data"],
    "secrets": []
  }
}
```

The plugin system validates manifests, stores installed plugin state, tracks granted permissions, and exposes permission review UI. Obsidian community plugins execute through an isolated browser worker that receives a compatibility API bridge rather than raw desktop internals.

Runtime execution is permission-first:

- The worker can `require("obsidian")` and receives only the shimmed API surface.
- Vault, workspace, editor, UI, plugin data, network, and desktop adapter calls are checked against explicit grants.
- Node-style `path` and `fs.promises` compatibility adapters are gated behind `system:node-api` and `system:filesystem`.
- Network helpers such as `requestUrl` require `network:http`; ambient worker network globals are blocked when that grant is absent.
- Styles are inserted through LATTICE's managed plugin style registry and removed on unload.
- Plugin data is stored under `.lattice/plugins/<plugin-id>/data.json`, with installed-folder `data.json` used as an initial fallback.

## Obsidian compatibility

LATTICE accepts both native LATTICE manifests and standard Obsidian plugin manifests. Obsidian manifests usually provide `id`, `name`, `version`, `minAppVersion`, `description`, `author`, `main`, and `isDesktopOnly` rather than a granular `permissions` block. When LATTICE detects that shape, it marks the plugin as `ecosystem: "obsidian"` and maps it to broad permission requests for review.

Installable Obsidian folder shape:

```text
plugin-id/
├── manifest.json
├── main.js
├── styles.css
└── data.json
```

Compatibility details live in [Obsidian Parity](obsidian-parity.md).

Current runtime surface:

- Worker isolation for `main.js`.
- Capability-scoped APIs for common Obsidian plugins.
- `Plugin` lifecycle helpers: `onload`, `onunload`, `addCommand`, `addRibbonIcon`, `addStatusBarItem`, `addSettingTab`, `register`, `registerEvent`, `registerInterval`.
- `app.vault`, `app.workspace`, and `app.metadataCache` basics.
- `TFile`, `TFolder`, `TAbstractFile`, `Notice`, `Modal`, `PluginSettingTab`, and `Setting` shims.
- Markdown post processor and code block processor registration.
- `loadData()` and `saveData()` persistence.

Remaining goals:

- Audit log for permission use.
- Secret storage broker.
- Broader Obsidian view, editor, and desktop API coverage.
