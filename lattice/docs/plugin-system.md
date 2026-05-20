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
    "commands": ["register"],
    "ui": ["status-bar", "view"],
    "secrets": []
  }
}
```

The MVP validates manifests, stores installed plugin state, tracks granted permissions, and exposes permission review UI. Runtime execution is intentionally constrained until the sandbox worker boundary is complete.

Future runtime goals:

- Worker isolation.
- Capability-scoped APIs.
- Audit log for permission use.
- Secret storage broker.
- Compatibility shim for migrated community plugins.
