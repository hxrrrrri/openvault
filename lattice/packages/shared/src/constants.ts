export const APP_NAME = "LATTICE";
export const LATTICE_DIR = ".lattice";
export const WORKSPACE_FILE = "workspace.json";
export const INDEX_DB_FILE = "index.db";

export const COMMAND_IDS = {
  newNote: "note.new",
  openDaily: "note.openDaily",
  togglePalette: "command.palette.toggle",
  openGraph: "graph.open",
  reindexVault: "vault.reindex",
} as const;
