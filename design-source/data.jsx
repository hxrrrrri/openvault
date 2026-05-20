// LATTICE — dummy data

const FOLDERS = [
  { id: "f1", name: "Research", count: 28, icon: "folder" },
  { id: "f2", name: "Daily Notes", count: 31, icon: "calendar" },
  { id: "f3", name: "Projects", count: 19, icon: "layers" },
  { id: "f4", name: "Reading", count: 14, icon: "book" },
  { id: "f5", name: "Inbox", count: 8, icon: "inbox" },
  { id: "f6", name: "People", count: 9, icon: "user" },
  { id: "f7", name: "Meetings", count: 6, icon: "users" },
  { id: "f8", name: "Archive", count: 4, icon: "archive" },
  { id: "f9", name: "Templates", count: 1, icon: "template" },
];

const TAGS = [
  "#thesis", "#zettelkasten", "#machine-learning", "#systems-design",
  "#permanence", "#daily", "#weekly-review", "#book-notes",
  "#paper", "#idea", "#question", "#todo",
  "#meeting", "#person", "#project", "#draft",
  "#published", "#archived"
];

const NOTES = [
  { id: "n1", title: "Project Atlas", folder: "Projects", tags: ["#project","#systems-design"], words: 1840, backlinks: 12, mod: "2h ago", body: "Atlas is the working name for the unified knowledge graph engine. The goal is to render 100k+ nodes at 60fps using WebGPU with intelligent culling and semantic clustering." },
  { id: "n2", title: "Emergence in Distributed Systems", folder: "Research", tags: ["#systems-design","#paper"], words: 2204, backlinks: 8, mod: "1d ago" },
  { id: "n3", title: "On Permanent Notes", folder: "Research", tags: ["#zettelkasten","#permanence"], words: 1120, backlinks: 14, mod: "4h ago" },
  { id: "n4", title: "Reading — Thinking in Systems", folder: "Reading", tags: ["#book-notes"], words: 980, backlinks: 6, mod: "3d ago" },
  { id: "n5", title: "Weekly Review · W21", folder: "Daily Notes", tags: ["#weekly-review","#daily"], words: 640, backlinks: 4, mod: "1d ago" },
  { id: "n6", title: "Vector Embeddings — Intuition", folder: "Research", tags: ["#machine-learning","#idea"], words: 1380, backlinks: 9, mod: "5h ago" },
  { id: "n7", title: "Local-First Manifesto", folder: "Research", tags: ["#systems-design","#published"], words: 1700, backlinks: 11, mod: "2d ago" },
  { id: "n8", title: "Knowledge as Infrastructure", folder: "Projects", tags: ["#project","#idea"], words: 920, backlinks: 7, mod: "6h ago" },
  { id: "n9", title: "Meeting · Lin · graph perf", folder: "Meetings", tags: ["#meeting"], words: 410, backlinks: 2, mod: "3d ago" },
  { id: "n10", title: "Lin Wei", folder: "People", tags: ["#person"], words: 220, backlinks: 5, mod: "3d ago" },
  { id: "n11", title: "Open questions — graph layout", folder: "Inbox", tags: ["#question","#todo"], words: 180, backlinks: 1, mod: "9h ago" },
  { id: "n12", title: "2026-05-20", folder: "Daily Notes", tags: ["#daily"], words: 320, backlinks: 3, mod: "today" },
];

// Graph nodes — central + neighbors
const GRAPH_NODES = [
  // Central
  { id: "g0",  label: "Project Atlas",          x:   0, y:   0, z: 0, r: 22, kind: "center" },
  // First-ring strong connections
  { id: "g1",  label: "Knowledge Graph Engine", x:-180, y:-110, z: 0.2, r: 14, kind: "linked" },
  { id: "g2",  label: "WebGPU Renderer",        x: 200, y:-130, z: 0.4, r: 13, kind: "linked" },
  { id: "g3",  label: "Semantic Index",         x:-220, y:  60, z:-0.1, r: 15, kind: "linked" },
  { id: "g4",  label: "Local-First Manifesto",  x: 230, y:  80, z: 0.3, r: 12, kind: "linked" },
  { id: "g5",  label: "Vector Embeddings",      x:  60, y:-220, z:-0.2, r: 11, kind: "linked" },
  { id: "g6",  label: "Permanent Notes",        x:-100, y: 220, z: 0.1, r: 12, kind: "linked" },
  { id: "g7",  label: "Plugin Sandbox",         x: 160, y: 220, z:-0.3, r: 10, kind: "linked" },
  { id: "g8",  label: "Encrypted Sync",         x:-300, y:-200, z: 0.5, r: 10, kind: "semantic" },
  { id: "g9",  label: "Cluster Layout",         x: 320, y:-220, z: 0.2, r:  9, kind: "semantic" },
  { id: "g10", label: "Knowledge Gaps",         x:-340, y: 180, z:-0.4, r:  9, kind: "semantic" },
  { id: "g11", label: "Markdown AST",           x: 340, y: 200, z: 0.0, r: 10, kind: "linked" },
  // Outer ring
  { id: "g12", label: "Emergence",              x:-420, y: -20, z: 0.4, r:  7, kind: "linked" },
  { id: "g13", label: "Citations",              x: 420, y:   0, z:-0.2, r:  7, kind: "linked" },
  { id: "g14", label: "Daily Note 05-20",       x: -60, y: 320, z: 0.1, r:  6, kind: "linked" },
  { id: "g15", label: "Lin Wei",                x:  60, y: 320, z: 0.3, r:  8, kind: "linked" },
  { id: "g16", label: "Reading: T.i.S.",        x:-260, y: 320, z:-0.3, r:  7, kind: "linked" },
  { id: "g17", label: "Open Questions",         x: 260, y: 320, z: 0.0, r:  6, kind: "semantic" },
  { id: "g18", label: "Inbox 02",               x:-440, y: 280, z: 0.2, r:  5, kind: "orphan" },
  { id: "g19", label: "Untitled 7",             x: 440, y: 280, z:-0.1, r:  5, kind: "orphan" },
  { id: "g20", label: "Sketch — UI",            x:-440, y:-280, z:-0.2, r:  5, kind: "orphan" },
  { id: "g21", label: "Draft · API",            x: 440, y:-280, z: 0.4, r:  5, kind: "orphan" },
  { id: "g22", label: "Old MoC",                x:   0, y:-360, z: 0.0, r:  6, kind: "linked" },
  { id: "g23", label: "Heatmap",                x:   0, y: 400, z: 0.2, r:  6, kind: "semantic" },
];

const GRAPH_EDGES = [
  ["g0","g1"],["g0","g2"],["g0","g3"],["g0","g4"],["g0","g5"],
  ["g0","g6"],["g0","g7"],["g0","g11"],["g0","g14"],["g0","g15"],
  ["g1","g2"],["g1","g3"],["g1","g12"],["g2","g9"],["g2","g11"],
  ["g3","g5"],["g3","g8"],["g3","g10"],["g4","g7"],["g4","g8"],
  ["g5","g6"],["g6","g14"],["g6","g16"],["g11","g13"],
  ["g15","g14"],["g15","g16"],["g0","g22"],["g0","g23",{semantic:true}],
  ["g3","g17",{semantic:true}],["g4","g10",{semantic:true}],
  ["g1","g9",{semantic:true}],["g6","g16",{semantic:true}],
];

const BACKLINKS = [
  { from: "Knowledge Graph Engine", excerpt: "...the spine of [[Project Atlas]] is a layered semantic index where..." },
  { from: "WebGPU Renderer",         excerpt: "renders into the surface owned by [[Project Atlas]] at 60fps..." },
  { from: "Local-First Manifesto",   excerpt: "this is why [[Project Atlas]] never reaches a remote server..." },
  { from: "Vector Embeddings",       excerpt: "embeddings flow into [[Project Atlas]] via a worker pool..." },
  { from: "Plugin Sandbox",          excerpt: "permissions are enforced before a plugin can read [[Project Atlas]]..." },
  { from: "Daily Note · 2026-05-20", excerpt: "moved 3 tasks into [[Project Atlas]] · paired with Lin on graph perf..." },
];

const SEMANTIC = [
  { title: "Cluster Layout",  score: 0.92 },
  { title: "Knowledge Gaps",  score: 0.88 },
  { title: "Emergence in Distributed Systems", score: 0.84 },
  { title: "Citations",       score: 0.79 },
  { title: "Heatmap",         score: 0.74 },
];

const PLUGINS = [
  { id: "p1", name: "Excalidraw", author: "obsidian-community", desc: "Hand-drawn diagrams inside any note — sketch ideas with a stylus or mouse.", trust: 96, verified: true, oss: true, installed: true, category: "Editor", perms: ["filesystem","editor","commands"], downloads: "1.2M" },
  { id: "p2", name: "Dataview", author: "blacksmith.gh", desc: "Query notes like a database. JS API, table views, inline DQL syntax.", trust: 98, verified: true, oss: true, installed: true, category: "Query", perms: ["filesystem","editor","commands"], downloads: "2.1M" },
  { id: "p3", name: "Kanban", author: "mara.lambda", desc: "Drag-and-drop boards stored as plain Markdown — no lock-in.", trust: 89, verified: true, oss: true, installed: false, category: "Productivity", perms: ["filesystem","editor"], downloads: "780k" },
  { id: "p4", name: "Embeddings · Local", author: "lattice.core", desc: "Run a tiny embedding model on-device for semantic search. No network.", trust: 99, verified: true, oss: true, installed: true, category: "AI", perms: ["filesystem","ai-access","secret-storage"], downloads: "640k" },
  { id: "p5", name: "Calendar+", author: "june.dev", desc: "Year heatmap + daily-note quick capture from your menu bar.", trust: 84, verified: true, oss: false, installed: false, category: "Productivity", perms: ["filesystem","editor","network"], downloads: "420k" },
  { id: "p6", name: "Style Settings", author: "lattice.core", desc: "Theme tokens, density, accent color — for theme authors and tweakers.", trust: 97, verified: true, oss: true, installed: true, category: "Theme", perms: ["editor","commands"], downloads: "1.8M" },
];

const COMMANDS = [
  { group: "Quick Actions",  items: [
    { kind: "cmd",  label: "New note",                     hint: "⌘ N",    icon: "plus" },
    { kind: "cmd",  label: "Open daily note",              hint: "⌘ ⇧ D",  icon: "calendar" },
    { kind: "cmd",  label: "Toggle focus mode",            hint: "⌘ .",    icon: "focus" },
    { kind: "cmd",  label: "Open graph",                   hint: "⌘ G",    icon: "graph" },
  ]},
  { group: "Notes · Semantic", items: [
    { kind: "note", label: "Knowledge Graph Engine",  hint: "0.92", icon: "doc", folder: "Projects" },
    { kind: "note", label: "Vector Embeddings — Intuition", hint: "0.88", icon: "doc", folder: "Research" },
    { kind: "note", label: "Cluster Layout",          hint: "0.84", icon: "doc", folder: "Research" },
    { kind: "note", label: "Local-First Manifesto",   hint: "0.79", icon: "doc", folder: "Research" },
  ]},
  { group: "Plugins",         items: [
    { kind: "plug", label: "Dataview — run query…",   hint: "DQL",  icon: "plug" },
    { kind: "plug", label: "Embeddings · re-index",   hint: "AI",   icon: "plug" },
  ]},
  { group: "Settings",        items: [
    { kind: "set",  label: "Plugin permissions",      hint: "",     icon: "shield" },
    { kind: "set",  label: "Switch vault",            hint: "⌘ ⇧ O", icon: "vault" },
    { kind: "set",  label: "Appearance",              hint: "",     icon: "sun" },
  ]},
];

const HEALTH = {
  score: 92,
  orphans: 12,
  broken: 7,
  stale: 18,
  duplicates: 4,
  noTags: 9,
  gaps: 5,
  merges: 6,
  topConnected: [
    { title: "Project Atlas", links: 42 },
    { title: "Local-First Manifesto", links: 31 },
    { title: "Permanent Notes", links: 28 },
    { title: "Knowledge Graph Engine", links: 24 },
    { title: "Vector Embeddings — Intuition", links: 21 },
  ],
  orphanList: [
    "Sketch — UI",
    "Untitled 7",
    "Draft · API",
    "Inbox 02",
    "Misc snippets",
    "Old MoC",
    "Untitled 4",
    "Conf notes — 2024",
    "Reading list (raw)",
    "Quotes (unsorted)",
    "Wires v2",
    "Untitled 11",
  ],
  brokenList: [
    { from: "Project Atlas",          to: "[[Atlas Renderer v0]]" },
    { from: "Weekly Review · W21",    to: "[[Weekly W20]]" },
    { from: "Reading — T.i.S.",       to: "[[Donella Meadows · Bio]]" },
    { from: "Vector Embeddings",      to: "[[ANN benchmarks 2023]]" },
    { from: "Knowledge as Infra",     to: "[[Atlas v0.1]]" },
    { from: "Permanent Notes",        to: "[[Folgezettel]]" },
    { from: "Local-First Manifesto",  to: "[[CRDT primer]]" },
  ],
  suggested: [
    { a: "Vector Embeddings — Intuition", b: "Knowledge Graph Engine", score: 0.91 },
    { a: "Permanent Notes",                b: "On Permanent Notes",     score: 0.96, merge: true },
    { a: "Local-First Manifesto",          b: "Encrypted Sync",         score: 0.83 },
  ]
};

const VAULT = {
  name: "Research Vault",
  path: "~/vaults/research",
  notes: 120,
  tags: 18,
  folders: 9,
  backlinks: 42,
  orphans: 12,
  broken: 7,
  indexed: 100,
  encrypted: true,
};

// expose
Object.assign(window, {
  FOLDERS, TAGS, NOTES, GRAPH_NODES, GRAPH_EDGES,
  BACKLINKS, SEMANTIC, PLUGINS, COMMANDS, HEALTH, VAULT,
});
