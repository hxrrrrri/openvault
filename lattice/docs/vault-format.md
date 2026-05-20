# Vault Format

A vault is any local folder containing Markdown files. LATTICE creates a `.lattice/` folder for app-owned metadata:

```text
.lattice/
  index.db
  workspace.json
  plugins/
  themes/
```

The app never modifies `.obsidian/` during import. Existing Markdown files are preserved and indexed in place.
