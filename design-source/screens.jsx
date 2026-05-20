// LATTICE — Editor / Workspace, Graph, Health, Plugins, Settings screens

const { useState: useStateS, useEffect: useEffectS, useMemo: useMemoS } = React;

// ─────────── MARKDOWN EDITOR ───────────
function EditorScreen({ activeNote, openNeighborhood, onOpenGraph }) {
  const note = NOTES.find(n => n.id === activeNote) || NOTES[0];
  const [splitPreview, setSplitPreview] = useStateS(true);
  const [focusMode, setFocusMode] = useStateS(false);
  const [showAISuggest, setShowAISuggest] = useStateS(true);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "linear-gradient(180deg, #0a0a0e 0%, #07070b 100%)" }}>
      {/* Note tabs */}
      <div style={{ height: 36, display: "flex", alignItems: "flex-end", paddingLeft: 12, gap: 1, borderBottom: "1px solid var(--border)", background: "rgba(8,8,12,0.7)" }}>
        {NOTES.slice(0, 4).map((n, i) => (
          <div key={n.id} style={{
            padding: "6px 14px 8px",
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 12,
            background: n.id === note.id ? "linear-gradient(180deg, #14141a, #0e0e13)" : "transparent",
            borderTopLeftRadius: 8, borderTopRightRadius: 8,
            border: n.id === note.id ? "1px solid var(--border)" : "1px solid transparent",
            borderBottom: "none",
            color: n.id === note.id ? "#ECECF4" : "var(--text-3)",
            position: "relative", top: 1,
            cursor: "pointer",
          }}>
            <Icon name="doc" size={11}/>
            <span>{n.title}</span>
            <Icon name="close" size={10} style={{ opacity: 0.5 }}/>
          </div>
        ))}
        <div style={{ flex: 1 }}/>
        <div style={{ display: "flex", gap: 4, padding: "0 10px 6px" }}>
          <button className="btn btn-ghost" style={{ padding: 5, fontSize: 11 }} onClick={() => setSplitPreview(s => !s)} title="Toggle preview">
            <Icon name={splitPreview ? "list" : "grid"} size={13}/>
          </button>
          <button className="btn btn-ghost" style={{ padding: 5, fontSize: 11 }} onClick={() => setFocusMode(f => !f)} title="Focus mode">
            <Icon name="focus" size={13}/>
          </button>
          <button className="btn btn-ghost" style={{ padding: 5, fontSize: 11 }} onClick={onOpenGraph} title="Open in graph">
            <Icon name="sphere" size={13}/>
          </button>
        </div>
      </div>

      {/* Editor body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* MD source */}
        <div style={{ flex: 1, overflowY: "auto", padding: focusMode ? "60px 18% 80px" : "32px 56px 80px" }}>
          <MarkdownSource note={note} showAISuggest={showAISuggest}/>
        </div>
        {/* Preview */}
        {splitPreview && !focusMode && (
          <div style={{ width: "44%", borderLeft: "1px solid var(--border)", overflowY: "auto", padding: "32px 36px 80px", background: "rgba(10,10,14,0.5)" }}>
            <MarkdownPreview note={note}/>
          </div>
        )}
      </div>

      {focusMode && (
        <div style={{ position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)", zIndex: 5 }}>
          <div className="glass pixel-label" style={{ padding: "6px 14px", borderRadius: 999, fontSize: 11, color: "var(--violet-2)" }}>
            <span className="pulse" style={{ display: "inline-block", width: 6, height: 6, borderRadius: 3, background: "var(--violet)", marginRight: 8 }}/>
            FOCUS MODE ACTIVE
          </div>
        </div>
      )}
    </div>
  );
}

function MarkdownSource({ note, showAISuggest }) {
  // Render Markdown source view with subtle syntax + active line glow
  const lines = [
    { type: "fm", text: "---" },
    { type: "fm", text: "title: " + note.title },
    { type: "fm", text: "tags: [" + note.tags.join(", ") + "]" },
    { type: "fm", text: "status: in-progress" },
    { type: "fm", text: "created: 2026-04-18" },
    { type: "fm", text: "---" },
    { type: "empty", text: "" },
    { type: "h1", text: "# " + note.title },
    { type: "empty", text: "" },
    { type: "p", text: "Atlas is the spine of LATTICE — a luminous, local-first knowledge graph that renders an entire vault as a [[constellation of nodes]] without ever leaving the machine." },
    { type: "empty", text: "" },
    { type: "h2", text: "## Goals" },
    { type: "li", text: "- Render 100k+ nodes at 60fps using a [[WebGPU Renderer]]" },
    { type: "li", text: "- Maintain a fully local [[Semantic Index]] backed by on-device embeddings" },
    { type: "li", text: "- Expose a sandboxed plugin surface for community extension" },
    { type: "empty", text: "" },
    { type: "h2", text: "## Architecture" },
    { type: "p", text: "The renderer owns a single GPU surface. The semantic layer is implemented as a worker pool consuming the file watcher's diff stream — see [[Vector Embeddings — Intuition]] for the math." },
    { type: "empty", text: "" },
    { type: "callout", text: "> ◉ A note is alive when it earns a backlink. Until then it is sediment." },
    { type: "empty", text: "" },
    { type: "h2", text: "## Open questions" },
    { type: "li", text: "- How do we cluster semantically without spinning up a per-edit reflow?" },
    { type: "li", text: "- Can #permanence be inferred from a note's [[Cluster Layout]] over time?" },
  ];

  const activeLine = 9;

  return (
    <div className="mono" style={{ fontSize: 14, lineHeight: 1.8, color: "var(--text-2)", maxWidth: 720, margin: "0 auto", fontFamily: "Geist, Inter, sans-serif" }}>
      {/* Note metadata header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {note.tags.slice(0, 3).map(t => <span key={t} className="chip chip-violet mono" style={{ fontSize: 10 }}>{t}</span>)}
        <span className="chip mono" style={{ fontSize: 10 }}>{note.folder}</span>
        <span className="pixel-label" style={{ fontSize: 10, marginLeft: "auto" }}>EDITED {note.mod.toUpperCase()}</span>
      </div>
      <div className="divider" style={{ margin: "14px 0 18px" }}/>

      {lines.map((l, i) => {
        const isActive = i === activeLine;
        const baseStyle = {
          position: "relative",
          padding: "2px 8px 2px 12px",
          borderRadius: 6,
          background: isActive ? "linear-gradient(90deg, rgba(139,124,255,0.08), transparent)" : "transparent",
          boxShadow: isActive ? "inset 2px 0 0 rgba(139,124,255,0.6)" : "none",
        };
        if (l.type === "fm") {
          return <div key={i} className="mono" style={{ ...baseStyle, fontSize: 12, color: "var(--text-3)" }}>{l.text}</div>;
        }
        if (l.type === "h1") {
          return <h1 key={i} style={{ ...baseStyle, fontSize: 32, fontWeight: 600, margin: "8px 0 4px", color: "#ECECF4", letterSpacing: "-0.01em" }}>{l.text.replace(/^# /, "")}</h1>;
        }
        if (l.type === "h2") {
          return (
            <h2 key={i} style={{ ...baseStyle, fontSize: 18, fontWeight: 600, margin: "20px 0 4px", color: "#ECECF4" }}>
              <span className="mono" style={{ color: "var(--violet-2)", marginRight: 6 }}>##</span>{l.text.replace(/^## /, "")}
            </h2>
          );
        }
        if (l.type === "li") {
          return (
            <div key={i} style={{ ...baseStyle, padding: "3px 8px 3px 28px", position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: 12, width: 5, height: 5, borderRadius: 3, background: "var(--violet)", boxShadow: "0 0 4px rgba(139,124,255,0.6)" }}/>
              {renderInline(l.text.replace(/^- /, ""))}
            </div>
          );
        }
        if (l.type === "callout") {
          return (
            <div key={i} style={{
              margin: "8px 8px 8px 12px",
              padding: "12px 16px",
              borderRadius: 10,
              background: "linear-gradient(90deg, rgba(139,124,255,0.08), rgba(139,124,255,0.02))",
              borderLeft: "2px solid var(--violet)",
              color: "#ECECF4", fontStyle: "italic", fontSize: 14,
            }}>
              {l.text.replace(/^> /, "")}
            </div>
          );
        }
        if (l.type === "empty") {
          return <div key={i} style={{ height: 8 }}/>;
        }
        return (
          <p key={i} style={{ ...baseStyle, margin: "4px 0" }}>
            {renderInline(l.text)}
          </p>
        );
      })}

      {/* Cursor / active line indicator */}
      {showAISuggest && (
        <div className="anim-fade-up" style={{
          marginTop: 16, marginLeft: 12,
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 12px", borderRadius: 999,
          background: "linear-gradient(90deg, rgba(139,124,255,0.15), rgba(109,141,255,0.08))",
          border: "1px solid rgba(139,124,255,0.3)",
          fontSize: 12,
        }}>
          <Icon name="sparkle" size={12} style={{ color: "var(--violet-2)" }}/>
          <span style={{ color: "var(--text-2)" }}>Local model suggests linking</span>
          <span style={{ color: "var(--violet-2)", borderBottom: "1px dashed rgba(139,124,255,0.4)" }}>[[Cluster Layout]]</span>
          <span className="mono" style={{ fontSize: 10, color: "var(--text-3)", padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.05)" }}>↹ accept</span>
        </div>
      )}
    </div>
  );
}

function renderInline(text) {
  // Render [[wikilinks]], **bold**, `code`, #tags
  const parts = text.split(/(\[\[[^\]]+\]\]|\*\*[^*]+\*\*|`[^`]+`|#[a-z0-9-]+)/i);
  return parts.map((p, j) => {
    if (p.startsWith("[[")) return <span key={j} style={{ color: "var(--violet-2)", borderBottom: "1px dashed rgba(139,124,255,0.4)", cursor: "pointer" }}>{p.replace(/\[\[|\]\]/g, "")}</span>;
    if (p.startsWith("**")) return <b key={j} style={{ color: "#ECECF4" }}>{p.replace(/\*\*/g, "")}</b>;
    if (p.startsWith("`")) return <code key={j} className="mono" style={{ background: "rgba(255,255,255,0.05)", padding: "1px 5px", borderRadius: 4, fontSize: 12, color: "var(--indigo)" }}>{p.replace(/`/g, "")}</code>;
    if (p.startsWith("#")) return <span key={j} className="chip chip-violet mono" style={{ fontSize: 10, padding: "1px 6px" }}>{p}</span>;
    return <span key={j}>{p}</span>;
  });
}

function MarkdownPreview({ note }) {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="pixel-label" style={{ fontSize: 10, marginBottom: 8 }}>PREVIEW</div>
      <h1 style={{ fontSize: 30, fontWeight: 600, margin: "0 0 6px", letterSpacing: "-0.01em" }}>{note.title}</h1>
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {note.tags.map(t => <span key={t} className="chip chip-violet mono" style={{ fontSize: 10 }}>{t}</span>)}
      </div>
      <p style={{ lineHeight: 1.7, color: "var(--text-2)", fontSize: 14 }}>
        Atlas is the spine of LATTICE — a luminous, local-first knowledge graph that renders an entire vault as a {wlink("constellation of nodes")} without ever leaving the machine.
      </p>
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: "24px 0 8px" }}>Goals</h2>
      <ul style={{ paddingLeft: 18, margin: 0, lineHeight: 1.9, color: "var(--text-2)", fontSize: 13 }}>
        <li>Render 100k+ nodes at 60fps using a {wlink("WebGPU Renderer")}</li>
        <li>Maintain a fully local {wlink("Semantic Index")} backed by on-device embeddings</li>
        <li>Expose a sandboxed plugin surface for community extension</li>
      </ul>
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: "24px 0 8px" }}>Architecture</h2>
      <p style={{ lineHeight: 1.7, color: "var(--text-2)", fontSize: 14 }}>
        The renderer owns a single GPU surface. The semantic layer is implemented as a worker pool consuming the file watcher's diff stream — see {wlink("Vector Embeddings — Intuition")} for the math.
      </p>
      <div style={{
        margin: "16px 0",
        padding: "14px 18px",
        borderRadius: 10,
        background: "linear-gradient(90deg, rgba(139,124,255,0.10), rgba(139,124,255,0.02))",
        borderLeft: "2px solid var(--violet)",
        color: "#ECECF4", fontStyle: "italic", fontSize: 14,
      }}>
        ◉ A note is alive when it earns a backlink. Until then it is sediment.
      </div>
    </div>
  );
}

function wlink(t) {
  return <span style={{ color: "var(--violet-2)", borderBottom: "1px dashed rgba(139,124,255,0.4)", cursor: "pointer" }}>{t}</span>;
}

// ─────────── GRAPH SCREEN ───────────
function GraphScreen({ selectedId, setSelectedId, hoverId, setHoverId }) {
  const [filter, setFilter] = useStateS({ tags: true, semantic: true, orphans: true, depth: 2 });
  const node = GRAPH_NODES.find(n => n.id === selectedId) || GRAPH_NODES[0];

  return (
    <div style={{ flex: 1, position: "relative", display: "flex", overflow: "hidden", background: "radial-gradient(ellipse at center, #0a0a14 0%, #050507 80%)" }}>
      {/* Filter panel */}
      <div style={{ width: 240, flexShrink: 0, borderRight: "1px solid var(--border)", padding: "16px 14px", background: "rgba(8,8,12,0.6)", backdropFilter: "blur(20px)", overflowY: "auto" }}>
        <div className="pixel-label" style={{ fontSize: 10, marginBottom: 12 }}>GRAPH FILTERS</div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-2)" }}>Show semantic edges</span>
            <div className={`toggle ${filter.semantic ? "on" : ""}`} onClick={() => setFilter(f => ({ ...f, semantic: !f.semantic }))}/>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-2)" }}>Show orphan notes</span>
            <div className={`toggle ${filter.orphans ? "on" : ""}`} onClick={() => setFilter(f => ({ ...f, orphans: !f.orphans }))}/>
          </div>
        </div>

        <div className="divider" style={{ margin: "10px 0 14px" }}/>

        <div className="pixel-label" style={{ fontSize: 10, marginBottom: 8 }}>LINK DEPTH · {filter.depth}</div>
        <input type="range" min="1" max="5" value={filter.depth} onChange={e => setFilter(f => ({ ...f, depth: +e.target.value }))} style={{ width: "100%", accentColor: "#8B7CFF" }}/>

        <div className="pixel-label" style={{ fontSize: 10, margin: "16px 0 8px" }}>CLUSTER LEGEND</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { c: "#ffffff", l: "Active node" },
            { c: "#A99BFF", l: "Linked" },
            { c: "#8eaaff", l: "Semantic similarity" },
            { c: "#5d5d70", l: "Orphan / disconnected" },
          ].map(s => (
            <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-2)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: s.c, boxShadow: `0 0 6px ${s.c}80` }}/>
              {s.l}
            </div>
          ))}
        </div>

        <div className="pixel-label" style={{ fontSize: 10, margin: "16px 0 8px" }}>FILTER BY TAG</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {TAGS.slice(0, 9).map(t => (
            <span key={t} className="chip mono" style={{ fontSize: 10, padding: "2px 7px", cursor: "pointer" }}>{t}</span>
          ))}
        </div>

        <div className="divider" style={{ margin: "16px 0 14px" }}/>

        {/* Selected node inspector */}
        <div className="pixel-label" style={{ fontSize: 10, marginBottom: 8 }}>NODE INSPECTOR</div>
        <div className="card" style={{ padding: 12, borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="pulse" style={{ width: 10, height: 10, borderRadius: 5, background: "#fff", boxShadow: "0 0 10px #fff" }}/>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{node.label}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
            <Stat label="LINKS" value={42} tone="violet"/>
            <Stat label="DEPTH" value={2} tone="muted"/>
          </div>
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 10, fontSize: 12, padding: "6px 10px" }}>Open in editor</button>
        </div>
      </div>

      {/* Graph canvas */}
      <div style={{ flex: 1, position: "relative" }}>
        <KnowledgeGraph
          selectedId={selectedId}
          onSelect={setSelectedId}
          hoverId={hoverId}
          setHoverId={setHoverId}
          filter={filter}
        />
        {/* Top heading overlay */}
        <div style={{ position: "absolute", top: 14, right: 14, textAlign: "right" }}>
          <div className="pixel-label" style={{ fontSize: 10 }}>VAULT CONSTELLATION</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>Research Vault — full graph</div>
        </div>
      </div>
    </div>
  );
}

// ─────────── HEALTH DASHBOARD ───────────
function HealthScreen() {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "26px 32px 60px", background: "linear-gradient(180deg, #08080c 0%, #050507 100%)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div className="pixel-label" style={{ fontSize: 11 }}>VAULT HEALTH · RESEARCH VAULT</div>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: "6px 0 0", letterSpacing: "-0.01em" }}>How is your knowledge?</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn"><Icon name="refresh" size={13}/> Re-index</button>
          <button className="btn btn-primary"><Icon name="sparkle" size={13}/> Run audit</button>
        </div>
      </div>

      {/* Top row: Score + ring + KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div className="gradient-card" style={{ padding: 22, position: "relative", overflow: "hidden", minHeight: 200 }}>
          <div style={{
            position: "absolute", right: -60, top: -60, width: 280, height: 280, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139,124,255,0.4), transparent 70%)", filter: "blur(20px)", animation: "blob-drift 12s ease-in-out infinite"
          }}/>
          <div className="pixel-label" style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", position: "relative" }}>VAULT HEALTH SCORE</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginTop: 14, position: "relative" }}>
            <HealthRing score={HEALTH.score} size={130}/>
            <div style={{ paddingBottom: 12, color: "rgba(255,255,255,0.85)" }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Strong & growing</div>
              <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7, maxWidth: 220, lineHeight: 1.5 }}>+4 since last week. Connect 3 orphans and resolve 2 broken links to reach 95%.</div>
              <button className="btn" style={{ marginTop: 10, fontSize: 11, padding: "5px 9px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>Open suggestions →</button>
            </div>
          </div>
        </div>

        <KPICard label="ORPHANED NOTES" value={HEALTH.orphans} delta="-3" icon="diamond" tone="warn"/>
        <KPICard label="BROKEN LINKS" value={HEALTH.broken} delta="-1" icon="broken" tone="danger"/>
        <KPICard label="STALE NOTES" value={HEALTH.stale} delta="+2" icon="moon" tone="muted"/>
      </div>

      {/* Two-column body */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Most connected */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div className="pixel-label" style={{ fontSize: 10 }}>MOST CONNECTED NOTES</div>
            <span className="chip chip-violet mono" style={{ fontSize: 10 }}>TOP 5</span>
          </div>
          {HEALTH.topConnected.map((n, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < 4 ? "1px solid var(--border)" : "none" }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--text-4)", width: 18 }}>{String(i+1).padStart(2,"0")}</span>
              <span style={{ flex: 1, fontSize: 13 }}>{n.title}</span>
              <div style={{ width: 100, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                <div style={{ width: `${(n.links / 42) * 100}%`, height: "100%", background: "linear-gradient(90deg, #4B36B8, #8B7CFF)", boxShadow: "0 0 6px rgba(139,124,255,0.5)" }}/>
              </div>
              <span className="mono" style={{ fontSize: 11, color: "var(--violet-2)", width: 30, textAlign: "right" }}>{n.links}</span>
            </div>
          ))}
        </div>

        {/* Suggested merges */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div className="pixel-label" style={{ fontSize: 10 }}>SUGGESTED CONNECTIONS</div>
            <span className="chip chip-violet mono" style={{ fontSize: 10 }}>AI · LOCAL</span>
          </div>
          {HEALTH.suggested.map((s, i) => (
            <div key={i} style={{ padding: "12px 0", borderBottom: i < HEALTH.suggested.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Icon name="doc" size={11} style={{ color: "var(--violet-2)" }}/>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{s.a}</span>
                <Icon name={s.merge ? "arrow" : "link"} size={11} style={{ color: s.merge ? "var(--warning)" : "var(--text-3)" }}/>
                <Icon name="doc" size={11} style={{ color: "var(--violet-2)" }}/>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{s.b}</span>
                <span style={{ marginLeft: "auto" }} className="mono">
                  <span className="chip chip-violet" style={{ fontSize: 10 }}>{s.score.toFixed(2)}</span>
                </span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {s.merge ? (
                  <>
                    <button className="btn" style={{ fontSize: 11, padding: "3px 8px" }}>Merge</button>
                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 8px" }}>Keep separate</button>
                  </>
                ) : (
                  <>
                    <button className="btn" style={{ fontSize: 11, padding: "3px 8px" }}>Add link</button>
                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 8px" }}>Dismiss</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Orphans + Broken side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div className="pixel-label" style={{ fontSize: 10 }}>ORPHANED NOTES · {HEALTH.orphans}</div>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>Notes with zero incoming or outgoing links</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {HEALTH.orphanList.map((n, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: "var(--text-4)", border: "1px solid var(--text-3)" }}/>
                <span style={{ fontSize: 12, color: "var(--text-2)", flex: 1 }}>{n}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div className="pixel-label" style={{ fontSize: 10, marginBottom: 14 }}>BROKEN LINKS · {HEALTH.broken}</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th className="pixel-label" style={{ fontSize: 9, padding: "0 0 8px", color: "var(--text-4)" }}>FROM</th>
                <th className="pixel-label" style={{ fontSize: 9, padding: "0 0 8px", color: "var(--text-4)" }}>TARGET</th>
                <th style={{ padding: "0 0 8px" }}/>
              </tr>
            </thead>
            <tbody>
              {HEALTH.brokenList.map((b, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 4px 8px 0", fontSize: 12 }}>{b.from}</td>
                  <td style={{ padding: "8px 0", fontSize: 12, color: "var(--danger)" }} className="mono">{b.to}</td>
                  <td style={{ padding: "8px 0", textAlign: "right" }}>
                    <button className="btn btn-ghost" style={{ fontSize: 10, padding: "2px 6px" }}>Fix</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Smaller cards row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <MetricCard label="DUPLICATE CONCEPTS" value={HEALTH.duplicates} hint="Run dedupe →"/>
        <MetricCard label="NOTES WITHOUT TAGS" value={HEALTH.noTags} hint="Suggest tags →"/>
        <MetricCard label="KNOWLEDGE GAPS" value={HEALTH.gaps} hint="Expand →"/>
        <MetricCard label="SUGGESTED MERGES" value={HEALTH.merges} hint="Review →"/>
      </div>
    </div>
  );
}

function HealthRing({ score, size = 120 }) {
  const r = (size - 12) / 2, c = 2 * Math.PI * r;
  const off = c - (score / 100) * c;
  return (
    <svg width={size} height={size} style={{ filter: "drop-shadow(0 0 16px rgba(139,124,255,0.5))" }}>
      <defs>
        <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A99BFF"/>
          <stop offset="100%" stopColor="#6D8DFF"/>
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="none"/>
      <circle cx={size/2} cy={size/2} r={r} stroke="url(#ring-grad)" strokeWidth="6" fill="none"
              strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
              transform={`rotate(-90 ${size/2} ${size/2})`}/>
      <text x={size/2} y={size/2 + 4} textAnchor="middle" fill="white" fontSize="34" fontWeight="600" fontFamily="Geist, Inter">
        {score}
      </text>
      <text x={size/2} y={size/2 + 22} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="9" fontFamily="JetBrains Mono" letterSpacing="2">
        /100
      </text>
    </svg>
  );
}

function KPICard({ label, value, delta, icon, tone = "muted" }) {
  const tones = {
    warn: { bg: "rgba(255,180,94,0.05)", border: "rgba(255,180,94,0.25)", c: "var(--warning)" },
    danger: { bg: "rgba(255,77,94,0.05)", border: "rgba(255,77,94,0.25)", c: "var(--danger)" },
    muted: { bg: "rgba(255,255,255,0.02)", border: "var(--border)", c: "var(--text-2)" },
    violet: { bg: "rgba(139,124,255,0.05)", border: "rgba(139,124,255,0.25)", c: "var(--violet-2)" },
  };
  const t = tones[tone];
  const deltaNeg = delta.startsWith("-");
  return (
    <div className="card" style={{ padding: 18, background: t.bg, borderColor: t.border, minHeight: 200, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", right: -10, top: -10, opacity: 0.3 }}>
        <Icon name={icon} size={56} style={{ color: t.c }}/>
      </div>
      <div className="pixel-label" style={{ fontSize: 10 }}>{label}</div>
      <div style={{ fontSize: 48, fontWeight: 600, marginTop: 18, color: t.c, lineHeight: 1, position: "relative" }}>{value}</div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, position: "relative" }}>
        <span className={`chip mono ${deltaNeg ? "chip-success" : "chip-warning"}`} style={{ fontSize: 10 }}>{deltaNeg ? "↓" : "↑"} {delta.replace("-","")}</span>
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>since last week</span>
      </div>
    </div>
  );
}

function MetricCard({ label, value, hint }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="pixel-label" style={{ fontSize: 10 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 600 }}>{value}</span>
        <span style={{ fontSize: 11, color: "var(--violet-2)", cursor: "pointer" }}>{hint}</span>
      </div>
    </div>
  );
}

window.EditorScreen = EditorScreen;
window.GraphScreen = GraphScreen;
window.HealthScreen = HealthScreen;
window.HealthRing = HealthRing;
window.KPICard = KPICard;
window.MetricCard = MetricCard;
