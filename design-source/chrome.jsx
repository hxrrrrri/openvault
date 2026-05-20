// LATTICE — reusable UI building blocks

const { useState: useStateUI, useEffect: useEffectUI, useRef: useRefUI } = React;

// ─────────── COMMAND BAR (top) ───────────
function CommandBar({ vault, onOpenPalette, view, setView, syncState, onToggleMobile, isMobilePreview }) {
  return (
    <div style={{
      height: 52, padding: "0 14px",
      display: "flex", alignItems: "center", gap: 12,
      borderBottom: "1px solid var(--border)",
      background: "linear-gradient(180deg, rgba(17,17,22,0.95), rgba(10,10,15,0.95))",
      backdropFilter: "blur(20px)",
      position: "relative", zIndex: 4,
    }}>
      {/* Vault badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 14, borderRight: "1px solid var(--border)" }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8,
          background: "linear-gradient(135deg, #8B7CFF 0%, #4B36B8 100%)",
          display: "grid", placeItems: "center",
          boxShadow: "0 0 12px rgba(139,124,255,0.5), inset 0 1px 0 rgba(255,255,255,0.2)",
          position: "relative",
        }}>
          <LatticeMark size={14}/>
        </div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{vault.name}</span>
          <span className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>{vault.path}</span>
        </div>
        <Icon name="chevronD" style={{ color: "var(--text-3)" }}/>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, padding: 3, background: "rgba(255,255,255,0.025)", borderRadius: 10, border: "1px solid var(--border)" }}>
        {[
          { id: "workspace", label: "Editor", icon: "edit" },
          { id: "graph",     label: "Graph",  icon: "sphere" },
          { id: "health",    label: "Health", icon: "shield" },
          { id: "plugins",   label: "Plugins",icon: "plug" },
          { id: "settings",  label: "Settings", icon: "settings" },
        ].map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 10px", borderRadius: 7,
            fontSize: 12, fontWeight: 500,
            border: "1px solid transparent",
            background: view === t.id ? "linear-gradient(180deg, rgba(139,124,255,0.18), rgba(139,124,255,0.06))" : "transparent",
            color: view === t.id ? "#ECECF4" : "var(--text-3)",
            boxShadow: view === t.id ? "0 0 0 1px rgba(139,124,255,0.35), inset 0 1px 0 rgba(255,255,255,0.05)" : "none",
            cursor: "pointer", transition: "all 160ms",
          }}>
            <Icon name={t.icon} size={13}/>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <button onClick={onOpenPalette} style={{
        flex: 1, maxWidth: 540,
        display: "flex", alignItems: "center", gap: 10,
        padding: "7px 12px", borderRadius: 10,
        background: "rgba(255,255,255,0.025)",
        border: "1px solid var(--border)",
        color: "var(--text-3)", fontSize: 12,
        cursor: "pointer", transition: "all 160ms",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(139,124,255,0.4)"; e.currentTarget.style.boxShadow = "0 0 0 1px rgba(139,124,255,0.15)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
      >
        <Icon name="search" size={14}/>
        <span>Search notes, commands, plugins…</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <kbd className="mono" style={{ padding: "1px 5px", borderRadius: 4, fontSize: 10, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}>⌘</kbd>
          <kbd className="mono" style={{ padding: "1px 5px", borderRadius: 4, fontSize: 10, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}>K</kbd>
        </div>
      </button>

      {/* Sync + status */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onToggleMobile} title="Toggle mobile preview" className="btn btn-ghost" style={{ padding: "6px 8px" }}>
          <Icon name={isMobilePreview ? "desktop" : "mobile"}/>
        </button>
        <div className="chip chip-violet">
          <span style={{ width: 6, height: 6, borderRadius: 3, background: "#65F2A8", boxShadow: "0 0 6px #65F2A8" }}/>
          <span className="mono" style={{ fontSize: 10 }}>INDEXED · {syncState}</span>
        </div>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #8B7CFF, #4B36B8)", display: "grid", placeItems: "center", color: "white", fontSize: 11, fontWeight: 600, border: "1px solid rgba(255,255,255,0.2)" }}>RC</div>
      </div>
    </div>
  );
}

// ─────────── LATTICE LOGO MARK ───────────
function LatticeMark({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <path d="M12 2L4 7v10l8 5 8-5V7l-8-5z" stroke="white" strokeWidth="1.4" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="2" fill="white"/>
      <path d="M12 4v8M12 12l-6.5-3.5M12 12l6.5-3.5M12 12v8M12 12l-6.5 3.5M12 12l6.5 3.5" stroke="white" strokeWidth="1" opacity="0.5"/>
    </svg>
  );
}

// ─────────── LEFT SIDEBAR ───────────
function LeftSidebar({ activeNote, setActiveNote, open, setOpen }) {
  const [search, setSearch] = useStateUI("");
  const filtered = NOTES.filter(n => n.title.toLowerCase().includes(search.toLowerCase()));
  return (
    <aside style={{
      width: open ? 260 : 0,
      flexShrink: 0,
      borderRight: "1px solid var(--border)",
      background: "linear-gradient(180deg, #0c0c11 0%, #0a0a0e 100%)",
      transition: "width 280ms var(--ease-spring)",
      overflow: "hidden",
      position: "relative",
    }}>
      <div style={{ width: 260, height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 14px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="pixel-label" style={{ fontSize: 10 }}>VAULT</div>
          <button className="btn btn-ghost" style={{ padding: 4 }} onClick={() => setOpen(false)} title="Collapse">
            <Icon name="arrowL" size={13}/>
          </button>
        </div>

        <div style={{ padding: "0 10px 10px" }}>
          <div style={{ position: "relative" }}>
            <Icon name="search" size={13} style={{ position: "absolute", left: 8, top: 7, color: "var(--text-3)" }}/>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Find in vault"
              style={{
                width: "100%", padding: "5px 8px 5px 26px",
                fontSize: 12,
                background: "rgba(255,255,255,0.025)",
                border: "1px solid var(--border)", borderRadius: 8,
                color: "var(--text)", outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>

        <div style={{ padding: "4px 10px", overflowY: "auto", flex: 1 }}>
          <div className="pixel-label" style={{ fontSize: 10, padding: "6px 4px" }}>FOLDERS</div>
          {FOLDERS.map(f => (
            <div key={f.id} className="row">
              <Icon name={f.icon} size={13} style={{ color: "var(--text-3)" }}/>
              <span style={{ flex: 1 }}>{f.name}</span>
              <span className="mono" style={{ fontSize: 10, color: "var(--text-4)" }}>{f.count}</span>
            </div>
          ))}

          <div className="pixel-label" style={{ fontSize: 10, padding: "14px 4px 6px" }}>RECENT NOTES</div>
          {filtered.slice(0, 8).map(n => (
            <div key={n.id}
              className={`row ${activeNote === n.id ? "active" : ""}`}
              onClick={() => setActiveNote(n.id)}>
              <Icon name="doc" size={12} style={{ color: n.tags.includes("#published") ? "var(--violet-2)" : "var(--text-3)" }}/>
              <span className="truncate" style={{ flex: 1 }}>{n.title}</span>
            </div>
          ))}

          <div className="pixel-label" style={{ fontSize: 10, padding: "14px 4px 6px" }}>TAGS · 18</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "2px 4px 8px" }}>
            {TAGS.slice(0, 10).map(t => (
              <span key={t} className="chip mono" style={{ fontSize: 10, padding: "2px 7px" }}>{t}</span>
            ))}
          </div>
        </div>

        {/* Bottom: vault meta */}
        <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", background: "rgba(0,0,0,0.4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="lock" size={12} style={{ color: "var(--success)" }}/>
            <span className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>ENCRYPTED · LOCAL</span>
          </div>
          <div style={{ height: 4, marginTop: 8, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{ width: "82%", height: "100%", background: "linear-gradient(90deg, #4B36B8, #8B7CFF)", boxShadow: "0 0 8px rgba(139,124,255,0.6)" }}/>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>120 NOTES</span>
            <span className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>82% INDEXED</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

// Collapsed expand strip
function SidebarRail({ side = "left", onClick }) {
  return (
    <button onClick={onClick} style={{
      width: 18, alignSelf: "stretch",
      background: "transparent", border: "none",
      cursor: "pointer", color: "var(--text-3)",
      borderRight: side === "left" ? "1px solid var(--border)" : "none",
      borderLeft: side === "right" ? "1px solid var(--border)" : "none",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} title={`Open ${side} panel`}>
      <Icon name={side === "left" ? "arrowR" : "arrowL"} size={12}/>
    </button>
  );
}

// ─────────── RIGHT SIDEBAR ───────────
function RightSidebar({ open, setOpen, activeNote }) {
  const note = NOTES.find(n => n.id === activeNote) || NOTES[0];
  const [tab, setTab] = useStateUI("backlinks");
  return (
    <aside style={{
      width: open ? 320 : 0,
      flexShrink: 0,
      borderLeft: "1px solid var(--border)",
      background: "linear-gradient(180deg, #0c0c11 0%, #0a0a0e 100%)",
      transition: "width 280ms var(--ease-spring)",
      overflow: "hidden",
    }}>
      <div style={{ width: 320, height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "10px 10px 6px", display: "flex", alignItems: "center", gap: 4 }}>
          <button className="btn btn-ghost" style={{ padding: 4 }} onClick={() => setOpen(false)}>
            <Icon name="arrowR" size={13}/>
          </button>
          <div style={{ display: "flex", flex: 1, gap: 2, padding: 3, background: "rgba(255,255,255,0.025)", borderRadius: 8, border: "1px solid var(--border)" }}>
            {[
              { id: "backlinks", label: "Backlinks", count: 12 },
              { id: "outline",   label: "Outline" },
              { id: "props",     label: "Properties" },
              { id: "ai",        label: "Insights" },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, padding: "4px 6px", borderRadius: 6,
                fontSize: 11, fontWeight: 500,
                border: "none",
                background: tab === t.id ? "rgba(139,124,255,0.15)" : "transparent",
                color: tab === t.id ? "#ECECF4" : "var(--text-3)",
                cursor: "pointer",
              }}>{t.label}{t.count && tab === t.id ? <span className="mono" style={{ marginLeft: 4, color: "var(--violet-2)" }}>{t.count}</span> : null}</button>
            ))}
          </div>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "8px 12px 14px" }}>
          {tab === "backlinks" && <BacklinksTab/>}
          {tab === "outline" && <OutlineTab/>}
          {tab === "props" && <PropsTab note={note}/>}
          {tab === "ai" && <InsightsTab/>}
        </div>
      </div>
    </aside>
  );
}

function BacklinksTab() {
  return (
    <div>
      <div className="pixel-label" style={{ fontSize: 10, padding: "4px 0 8px" }}>LINKED MENTIONS · {BACKLINKS.length}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {BACKLINKS.map((b, i) => (
          <div key={i} className="card" style={{ padding: 12, borderRadius: 12, transition: "all 200ms" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(139,124,255,0.4)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Icon name="doc" size={11} style={{ color: "var(--violet-2)" }}/>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{b.from}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>
              {b.excerpt.split(/(\[\[[^\]]+\]\])/).map((p, j) =>
                p.startsWith("[[") ? <span key={j} style={{ color: "var(--violet-2)", borderBottom: "1px dashed rgba(139,124,255,0.4)" }}>{p.replace(/\[\[|\]\]/g, "")}</span> : <span key={j}>{p}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="pixel-label" style={{ fontSize: 10, padding: "16px 0 8px" }}>SEMANTIC SIMILARITY</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {SEMANTIC.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
            <Icon name="sparkle" size={11} style={{ color: "var(--indigo)" }}/>
            <span style={{ fontSize: 12, flex: 1 }}>{s.title}</span>
            <span className="mono" style={{ fontSize: 10, color: "var(--indigo)" }}>{s.score.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OutlineTab() {
  const outline = [
    { level: 1, text: "Project Atlas" },
    { level: 2, text: "Goals & non-goals" },
    { level: 2, text: "Architecture" },
    { level: 3, text: "Renderer (WebGPU)" },
    { level: 3, text: "Semantic index" },
    { level: 3, text: "Plugin sandbox" },
    { level: 2, text: "Performance budget" },
    { level: 2, text: "Open questions" },
  ];
  return (
    <div>
      <div className="pixel-label" style={{ fontSize: 10, padding: "4px 0 10px" }}>OUTLINE</div>
      {outline.map((h, i) => (
        <div key={i} style={{ padding: "5px 0 5px " + (8 + h.level * 12) + "px", fontSize: 12 + (h.level === 1 ? 1 : 0), color: h.level === 1 ? "#ECECF4" : "var(--text-2)", fontWeight: h.level === 1 ? 600 : 400, cursor: "pointer", borderRadius: 6, position: "relative" }}>
          <span style={{ position: "absolute", left: h.level * 12 - 2, top: "50%", transform: "translateY(-50%)", width: 4, height: 4, borderRadius: 2, background: h.level === 1 ? "var(--violet)" : "var(--text-4)" }}/>
          {h.text}
        </div>
      ))}
    </div>
  );
}

function PropsTab({ note }) {
  return (
    <div>
      <div className="pixel-label" style={{ fontSize: 10, padding: "4px 0 10px" }}>FRONTMATTER</div>
      <div className="card-inner mono" style={{ padding: 12, fontSize: 11, lineHeight: 1.7, color: "var(--text-2)" }}>
        <div><span style={{ color: "var(--violet-2)" }}>title:</span> {note.title}</div>
        <div><span style={{ color: "var(--violet-2)" }}>tags:</span> [{note.tags.join(", ")}]</div>
        <div><span style={{ color: "var(--violet-2)" }}>created:</span> 2026-04-18</div>
        <div><span style={{ color: "var(--violet-2)" }}>modified:</span> 2026-05-20</div>
        <div><span style={{ color: "var(--violet-2)" }}>links:</span> 12</div>
        <div><span style={{ color: "var(--violet-2)" }}>status:</span> in-progress</div>
      </div>

      <div className="pixel-label" style={{ fontSize: 10, padding: "16px 0 10px" }}>STATS</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          { l: "WORDS", v: note.words.toLocaleString() },
          { l: "BACKLINKS", v: note.backlinks },
          { l: "OUTGOING", v: 9 },
          { l: "READING", v: "7 min" },
        ].map(s => (
          <div key={s.l} className="card-inner" style={{ padding: 10 }}>
            <div className="pixel-label" style={{ fontSize: 9 }}>{s.l}</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightsTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="gradient-card" style={{ padding: 14 }}>
        <div className="pixel-label" style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>AI · LOCAL MODEL</div>
        <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5, color: "rgba(255,255,255,0.9)" }}>
          You frequently link <b>Atlas</b> with <b>Embeddings</b> and <b>WebGPU</b>. Three notes (<i>Cluster Layout</i>, <i>Heatmap</i>, <i>Knowledge Gaps</i>) appear conceptually adjacent but lack explicit links.
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button className="btn" style={{ fontSize: 11, padding: "4px 8px", background: "rgba(255,255,255,0.1)" }}>Suggest links</button>
          <button className="btn" style={{ fontSize: 11, padding: "4px 8px", background: "rgba(255,255,255,0.1)" }}>Summarize</button>
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div className="pixel-label" style={{ fontSize: 10 }}>VAULT CONTEXT</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
          <Stat label="HEALTH" value="92" suffix="%" tone="violet"/>
          <Stat label="ORPHANS" value="12" tone="warn"/>
          <Stat label="STALE" value="18" tone="muted"/>
          <Stat label="BROKEN" value="7" tone="danger"/>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, suffix = "", tone }) {
  const colors = {
    violet: "var(--violet-2)",
    warn: "var(--warning)",
    danger: "var(--danger)",
    muted: "var(--text-2)",
    success: "var(--success)",
  };
  return (
    <div className="card-inner" style={{ padding: 10 }}>
      <div className="pixel-label" style={{ fontSize: 9 }}>{label}</div>
      <div style={{ marginTop: 2, display: "flex", alignItems: "baseline", gap: 2 }}>
        <span style={{ fontSize: 22, fontWeight: 600, color: colors[tone] || "#ECECF4" }}>{value}</span>
        {suffix && <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>{suffix}</span>}
      </div>
    </div>
  );
}

// ─────────── STATUS STRIP ───────────
function StatusStrip({ activeNote }) {
  const note = NOTES.find(n => n.id === activeNote) || NOTES[0];
  return (
    <div style={{
      height: 26, padding: "0 12px",
      borderTop: "1px solid var(--border)",
      background: "rgba(8,8,12,0.95)",
      display: "flex", alignItems: "center", gap: 16,
      fontSize: 11, color: "var(--text-3)",
    }}>
      <span className="mono" style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: "#65F2A8", boxShadow: "0 0 6px #65F2A8" }}/>
        LOCAL · ENCRYPTED · OPEN-SOURCE
      </span>
      <span style={{ width: 1, height: 12, background: "var(--border)" }}/>
      <span className="mono">{note.words.toLocaleString()} words</span>
      <span className="mono">{note.backlinks} backlinks</span>
      <span className="mono">{note.tags.length} tags</span>
      <div style={{ flex: 1 }}/>
      <span className="mono">VAULT 82% INDEXED</span>
      <span className="mono">120 / 120 NOTES</span>
      <span className="mono" style={{ color: "var(--violet-2)" }}>LATTICE v0.4.2 · CHANNEL: nightly</span>
    </div>
  );
}

window.CommandBar = CommandBar;
window.LeftSidebar = LeftSidebar;
window.RightSidebar = RightSidebar;
window.SidebarRail = SidebarRail;
window.StatusStrip = StatusStrip;
window.LatticeMark = LatticeMark;
window.Stat = Stat;
