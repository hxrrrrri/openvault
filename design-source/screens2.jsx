// LATTICE — Plugins, Settings, Command Palette, Mobile, Onboarding

const { useState: useStateE, useEffect: useEffectE, useRef: useRefE } = React;

// ─────────── PLUGIN MARKETPLACE ───────────
function PluginsScreen({ onOpenPermissions }) {
  const [filter, setFilter] = useStateE("All");
  const [pluginState, setPluginState] = useStateE(() => Object.fromEntries(PLUGINS.map(p => [p.id, p.installed])));
  const cats = ["All", "Editor", "Query", "Productivity", "AI", "Theme"];
  const list = PLUGINS.filter(p => filter === "All" || p.category === filter);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "26px 32px 60px", background: "linear-gradient(180deg, #08080c 0%, #050507 100%)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div className="pixel-label" style={{ fontSize: 11 }}>PLUGIN MARKETPLACE</div>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: "6px 0 0", letterSpacing: "-0.01em" }}>Extend your vault, safely.</h1>
          <p style={{ fontSize: 13, color: "var(--text-3)", margin: "6px 0 0", maxWidth: 540 }}>
            Every plugin runs sandboxed. Each permission is explicit. You can revoke access at any time without breaking your notes.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="chip chip-success mono"><Icon name="check" size={10}/> COMPATIBLE WITH OBSIDIAN PLUGINS</div>
          <button className="btn">Submit a plugin</button>
        </div>
      </div>

      {/* Featured hero card */}
      <div className="gradient-card" style={{ padding: 26, marginBottom: 22, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 28, minHeight: 180 }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.3, background: "radial-gradient(circle at 80% 50%, rgba(139,124,255,0.6), transparent 60%)", animation: "blob-drift 14s ease-in-out infinite" }}/>
        <div style={{ width: 110, height: 110, borderRadius: 22, background: "linear-gradient(135deg, #1a1530, #0e0e1a)", display: "grid", placeItems: "center", border: "1px solid rgba(255,255,255,0.15)", flexShrink: 0, position: "relative", boxShadow: "0 0 24px rgba(139,124,255,0.3)" }}>
          <Icon name="sparkle" size={48} style={{ color: "#A99BFF" }}/>
        </div>
        <div style={{ flex: 1, position: "relative" }}>
          <div className="pixel-label" style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>FEATURED · OFFICIAL</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Embeddings · Local</h2>
            <span className="chip chip-violet mono" style={{ fontSize: 10 }}>VERIFIED</span>
            <span className="chip chip-success mono" style={{ fontSize: 10 }}>OSS</span>
          </div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", margin: "8px 0 0", maxWidth: 540, lineHeight: 1.55 }}>
            Run a tiny embedding model entirely on-device. Powers semantic search and similarity suggestions across your vault — without ever touching the network.
          </p>
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <span className="chip mono" style={{ fontSize: 10 }}><Icon name="file" size={9}/> filesystem</span>
            <span className="chip mono" style={{ fontSize: 10 }}><Icon name="sparkle" size={9}/> ai-access</span>
            <span className="chip mono" style={{ fontSize: 10 }}><Icon name="lock" size={9}/> secret-storage</span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-3)" }} className="mono">640k installs · 4.9★</span>
          </div>
        </div>
        <button className="btn btn-primary" style={{ alignSelf: "flex-end" }}>Already installed</button>
      </div>

      {/* Category filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        {cats.map(c => (
          <button key={c} onClick={() => setFilter(c)} style={{
            padding: "5px 12px", borderRadius: 999, fontSize: 12,
            border: "1px solid " + (filter === c ? "rgba(139,124,255,0.5)" : "var(--border)"),
            background: filter === c ? "linear-gradient(180deg, rgba(139,124,255,0.2), rgba(139,124,255,0.06))" : "rgba(255,255,255,0.02)",
            color: filter === c ? "#ECECF4" : "var(--text-2)",
            boxShadow: filter === c ? "0 0 12px rgba(139,124,255,0.3)" : "none",
            cursor: "pointer", transition: "all 160ms",
          }}>{c}</button>
        ))}
        <div style={{ flex: 1 }}/>
        <span className="pixel-label" style={{ fontSize: 10 }}>{list.length} PLUGINS</span>
      </div>

      {/* Plugin grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
        {list.map(p => {
          const installed = pluginState[p.id];
          return (
            <div key={p.id} className="card" style={{ padding: 18, transition: "all 200ms", display: "flex", flexDirection: "column", minHeight: 200 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(139,124,255,0.4)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #1a1530, #0e0e1a)", display: "grid", placeItems: "center", border: "1px solid var(--border)", flexShrink: 0 }}>
                  <PluginGlyph cat={p.category}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                    {p.verified && <Icon name="check" size={11} style={{ color: "var(--violet-2)" }}/>}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>by {p.author}</div>
                </div>
                <div className="chip mono" style={{ fontSize: 10 }}>{p.downloads}</div>
              </div>

              <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5, margin: "0 0 12px", flex: 1 }}>{p.desc}</p>

              {/* Permissions */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                {p.perms.map(perm => (
                  <span key={perm} className="chip mono" style={{ fontSize: 9, padding: "1px 6px", color: "var(--text-3)" }}>
                    {permIcon(perm)} {perm}
                  </span>
                ))}
              </div>

              {/* Trust + actions */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "auto", paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                <TrustMeter score={p.trust}/>
                <div style={{ flex: 1, display: "flex", gap: 4 }}>
                  {p.oss && <span className="chip chip-success mono" style={{ fontSize: 9 }}>OSS</span>}
                  {p.verified && <span className="chip chip-violet mono" style={{ fontSize: 9 }}>VERIFIED</span>}
                </div>
                {installed ? (
                  <>
                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => onOpenPermissions(p)}>
                      <Icon name="shield" size={11}/> Permissions
                    </button>
                    <button className="btn" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setPluginState(s => ({ ...s, [p.id]: false }))}>Remove</button>
                  </>
                ) : (
                  <button className="btn btn-primary" style={{ fontSize: 11, padding: "4px 12px" }} onClick={() => onOpenPermissions(p)}>Install</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PluginGlyph({ cat }) {
  const map = {
    Editor: <Icon name="edit" size={20} style={{ color: "var(--violet-2)" }}/>,
    Query: <Icon name="code" size={20} style={{ color: "var(--indigo)" }}/>,
    Productivity: <Icon name="layers" size={20} style={{ color: "var(--success)" }}/>,
    AI: <Icon name="sparkle" size={20} style={{ color: "var(--violet)" }}/>,
    Theme: <Icon name="palette" size={20} style={{ color: "var(--warning)" }}/>,
  };
  return map[cat] || <Icon name="plug" size={20}/>;
}

function permIcon(perm) {
  const map = { filesystem: "📁", editor: "✎", commands: "▤", "ai-access": "✦", network: "○", "secret-storage": "◉" };
  return <span style={{ marginRight: 2, opacity: 0.7 }}>{map[perm] || "·"}</span>;
}

function TrustMeter({ score }) {
  return (
    <div title={`Trust score ${score}`} style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ position: "relative", width: 28, height: 28 }}>
        <svg width="28" height="28" viewBox="0 0 28 28">
          <circle cx="14" cy="14" r="11" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" fill="none"/>
          <circle cx="14" cy="14" r="11" stroke="url(#tm-grad)" strokeWidth="2.5" fill="none" strokeLinecap="round"
                  strokeDasharray={69} strokeDashoffset={69 - (score/100) * 69}
                  transform="rotate(-90 14 14)"
                  style={{ filter: "drop-shadow(0 0 4px rgba(139,124,255,0.6))" }}/>
          <defs>
            <linearGradient id="tm-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A99BFF"/><stop offset="100%" stopColor="#65F2A8"/>
            </linearGradient>
          </defs>
        </svg>
        <div className="mono" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 9, color: "var(--text)" }}>{score}</div>
      </div>
    </div>
  );
}

// ─────────── PLUGIN PERMISSIONS MODAL ───────────
function PermissionsModal({ plugin, onClose }) {
  const allPerms = [
    { id: "filesystem", label: "Filesystem", desc: "Read & write Markdown files in your vault.", icon: "file" },
    { id: "editor", label: "Editor", desc: "Insert text, modify selection, register editor commands.", icon: "edit" },
    { id: "commands", label: "Commands", desc: "Register entries in the command palette.", icon: "bolt" },
    { id: "ai-access", label: "AI Access", desc: "Use the on-device embedding model and local inference.", icon: "sparkle" },
    { id: "network", label: "Network", desc: "Make HTTP requests to external services. ⚠ leaves the device.", icon: "wifi" },
    { id: "secret-storage", label: "Secret Storage", desc: "Read & write encrypted keys (API tokens, etc).", icon: "lock" },
  ];
  const [granted, setGranted] = useStateE(() => Object.fromEntries(allPerms.map(p => [p.id, plugin.perms.includes(p.id)])));

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(5,5,7,0.75)",
      backdropFilter: "blur(8px)",
      display: "grid", placeItems: "center",
      animation: "scale-in 220ms var(--ease-spring)",
    }}>
      <div onClick={e => e.stopPropagation()} className="anim-scale-in" style={{
        width: 560, maxHeight: "84vh",
        background: "linear-gradient(180deg, #1a1a22 0%, #0e0e13 100%)",
        border: "1px solid rgba(139,124,255,0.3)",
        borderRadius: 18,
        boxShadow: "var(--shadow-float), 0 0 60px rgba(139,124,255,0.2)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #1a1530, #0e0e1a)", display: "grid", placeItems: "center", border: "1px solid var(--border)" }}>
            <PluginGlyph cat={plugin.category}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="pixel-label" style={{ fontSize: 10 }}>REVIEW PERMISSIONS</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{plugin.name}</div>
          </div>
          <button className="btn btn-ghost" style={{ padding: 6 }} onClick={onClose}><Icon name="close"/></button>
        </div>
        <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
          <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55, margin: "0 0 16px" }}>
            This plugin requests the following access. You can revoke any permission later from <span style={{ color: "var(--violet-2)" }}>Settings → Plugin Permissions</span>.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {allPerms.map(p => {
              const isRequested = plugin.perms.includes(p.id);
              return (
                <div key={p.id} style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: isRequested ? "rgba(139,124,255,0.05)" : "rgba(255,255,255,0.015)",
                  border: "1px solid " + (isRequested ? "rgba(139,124,255,0.25)" : "var(--border)"),
                  display: "flex", alignItems: "center", gap: 12,
                  opacity: isRequested ? 1 : 0.5,
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", border: "1px solid var(--border)" }}>
                    <Icon name={p.icon} size={14} style={{ color: p.id === "network" ? "var(--warning)" : "var(--violet-2)" }}/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                      {p.label}
                      {!isRequested && <span className="mono" style={{ fontSize: 9, color: "var(--text-4)" }}>NOT REQUESTED</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{p.desc}</div>
                  </div>
                  {isRequested && (
                    <div className={`toggle ${granted[p.id] ? "on" : ""}`} onClick={() => setGranted(g => ({ ...g, [p.id]: !g[p.id] }))}/>
                  )}
                </div>
              );
            })}
          </div>

          <div className="card-inner" style={{ marginTop: 16, padding: 12, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <Icon name="info" size={14} style={{ color: "var(--violet-2)", marginTop: 1 }}/>
            <div style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.6 }}>
              <b style={{ color: "#ECECF4" }}>Sandboxed.</b> Plugins run in an isolated worker. They cannot access files, the network, or other plugins' data unless you explicitly grant it here.
            </div>
          </div>
        </div>
        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onClose}>{plugin.installed ? "Save permissions" : "Install with these permissions"}</button>
        </div>
      </div>
    </div>
  );
}

// ─────────── SETTINGS / PERMISSIONS DASHBOARD ───────────
function SettingsScreen({ onOpenPermissions }) {
  const [tab, setTab] = useStateE("perms");
  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", background: "linear-gradient(180deg, #08080c 0%, #050507 100%)" }}>
      <div style={{ width: 220, flexShrink: 0, borderRight: "1px solid var(--border)", padding: "20px 14px", background: "rgba(8,8,12,0.6)" }}>
        <div className="pixel-label" style={{ fontSize: 10, padding: "0 8px 10px" }}>SETTINGS</div>
        {[
          { id: "general", label: "General", icon: "settings" },
          { id: "appearance", label: "Appearance", icon: "palette" },
          { id: "editor", label: "Editor", icon: "edit" },
          { id: "graph", label: "Graph", icon: "sphere" },
          { id: "sync", label: "Encrypted Sync", icon: "lock" },
          { id: "perms", label: "Plugin Permissions", icon: "shield" },
          { id: "ai", label: "AI · Local Model", icon: "sparkle" },
          { id: "keys", label: "Keyboard", icon: "code" },
          { id: "about", label: "About", icon: "info" },
        ].map(s => (
          <div key={s.id} onClick={() => setTab(s.id)} className={`row ${tab === s.id ? "active" : ""}`}>
            <Icon name={s.icon} size={13}/>
            {s.label}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "26px 32px 60px" }}>
        {tab === "perms" && <PermissionsDash onOpenPermissions={onOpenPermissions}/>}
        {tab !== "perms" && <ComingSoon label={tab}/>}
      </div>
    </div>
  );
}

function ComingSoon({ label }) {
  return (
    <div>
      <div className="pixel-label" style={{ fontSize: 11 }}>SETTINGS · {label.toUpperCase()}</div>
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: "6px 0 24px" }}>Wired up in this prototype: Plugin Permissions.</h1>
      <div className="striped" style={{ padding: 36, minHeight: 200, display: "grid", placeItems: "center", color: "var(--text-3)" }}>
        <div className="mono" style={{ fontSize: 12, textAlign: "center" }}>
          <Icon name="settings" size={28} style={{ color: "var(--text-4)" }}/>
          <div style={{ marginTop: 8 }}>SECTION · {label.toUpperCase()}</div>
          <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-4)" }}>Open the Permissions tab to see the wired-up flow →</div>
        </div>
      </div>
    </div>
  );
}

function PermissionsDash({ onOpenPermissions }) {
  const installed = PLUGINS.filter(p => p.installed);
  const [grants, setGrants] = useStateE(() => {
    const o = {};
    PLUGINS.forEach(p => { o[p.id] = Object.fromEntries(p.perms.map(perm => [perm, true])); });
    return o;
  });
  const recent = [
    { time: "12s ago",  plugin: "Embeddings · Local", action: "read 3 notes (semantic index update)", perm: "filesystem", tone: "ok" },
    { time: "1m ago",   plugin: "Dataview",            action: "registered DQL command",               perm: "commands",   tone: "ok" },
    { time: "4m ago",   plugin: "Style Settings",      action: "wrote theme.css",                       perm: "editor",     tone: "ok" },
    { time: "23m ago",  plugin: "Embeddings · Local", action: "read secret: embedding-model-path",     perm: "secret-storage", tone: "ok" },
    { time: "1h ago",   plugin: "Calendar+",           action: "requested network access — DENIED",     perm: "network",    tone: "danger" },
    { time: "3h ago",   plugin: "Dataview",            action: "read 41 notes (query)",                 perm: "filesystem", tone: "ok" },
  ];
  return (
    <div>
      <div className="pixel-label" style={{ fontSize: 11 }}>PLUGIN PERMISSIONS</div>
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: "6px 0 4px", letterSpacing: "-0.01em" }}>You're in control.</h1>
      <p style={{ fontSize: 13, color: "var(--text-3)", margin: "0 0 22px", maxWidth: 620 }}>
        Every action a plugin takes is logged. Revoke access instantly — your notes will keep working, the plugin will simply stop.
      </p>

      {/* Per-plugin permission rows */}
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 22 }}>
        <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
          <div className="pixel-label" style={{ fontSize: 10 }}>INSTALLED PLUGINS · {installed.length}</div>
          <div style={{ flex: 1 }}/>
          <span className="chip chip-success mono" style={{ fontSize: 10 }}><Icon name="check" size={10}/> ALL SANDBOXED</span>
        </div>
        {installed.map((p, i) => (
          <div key={p.id} style={{ padding: "14px 18px", borderTop: i ? "1px solid var(--border)" : "none", display: "grid", gridTemplateColumns: "40px 1fr auto", gap: 14, alignItems: "center" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #1a1530, #0e0e1a)", display: "grid", placeItems: "center", border: "1px solid var(--border)" }}>
              <PluginGlyph cat={p.category}/>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                <span className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>by {p.author}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {p.perms.map(perm => (
                  <span key={perm} className="chip mono" style={{ fontSize: 10, color: grants[p.id][perm] ? "var(--violet-2)" : "var(--text-4)", borderColor: grants[p.id][perm] ? "rgba(139,124,255,0.3)" : "var(--border)" }}
                    onClick={() => setGrants(g => ({ ...g, [p.id]: { ...g[p.id], [perm]: !g[p.id][perm] } }))}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: grants[p.id][perm] ? "var(--success)" : "var(--text-4)", marginRight: 4 }}/>
                    {perm}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => onOpenPermissions(p)}>Manage</button>
              <button className="btn" style={{ fontSize: 11, padding: "4px 10px", color: "var(--danger)", borderColor: "rgba(255,77,94,0.25)" }}>Revoke all</button>
            </div>
          </div>
        ))}
      </div>

      {/* Security timeline */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div className="pixel-label" style={{ fontSize: 10 }}>SECURITY TIMELINE · RECENT</div>
          <button className="btn btn-ghost" style={{ fontSize: 11 }}>Export log</button>
        </div>
        <div style={{ position: "relative", paddingLeft: 18 }}>
          <div style={{ position: "absolute", left: 4, top: 4, bottom: 4, width: 1, background: "linear-gradient(180deg, rgba(139,124,255,0.3), transparent)" }}/>
          {recent.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: "10px 0", position: "relative" }}>
              <span style={{ position: "absolute", left: -18, top: 14, width: 9, height: 9, borderRadius: 5, background: r.tone === "danger" ? "var(--danger)" : "var(--violet-2)", boxShadow: `0 0 8px ${r.tone === "danger" ? "rgba(255,77,94,0.6)" : "rgba(139,124,255,0.6)"}`, border: "2px solid #0e0e13" }}/>
              <span className="mono" style={{ fontSize: 11, color: "var(--text-3)", width: 70, flexShrink: 0 }}>{r.time}</span>
              <span style={{ fontSize: 12, fontWeight: 500, width: 160, flexShrink: 0 }}>{r.plugin}</span>
              <span style={{ fontSize: 12, color: r.tone === "danger" ? "var(--danger)" : "var(--text-2)", flex: 1 }}>{r.action}</span>
              <span className="chip mono" style={{ fontSize: 10 }}>{r.perm}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────── COMMAND PALETTE ───────────
function CommandPalette({ onClose }) {
  const [q, setQ] = useStateE("");
  const [idx, setIdx] = useStateE(0);
  const inputRef = useRefE(null);
  useEffectE(() => { inputRef.current && inputRef.current.focus(); }, []);

  const all = COMMANDS.flatMap(g => g.items.map(it => ({ ...it, group: g.group })));
  const filtered = q
    ? all.filter(it => it.label.toLowerCase().includes(q.toLowerCase()))
    : all;
  // Re-group
  const grouped = COMMANDS.map(g => ({
    group: g.group,
    items: filtered.filter(it => it.group === g.group),
  })).filter(g => g.items.length > 0);

  useEffectE(() => { setIdx(0); }, [q]);

  const flat = grouped.flatMap(g => g.items);
  const onKey = (e) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") { setIdx(i => Math.min(flat.length - 1, i + 1)); e.preventDefault(); }
    if (e.key === "ArrowUp") { setIdx(i => Math.max(0, i - 1)); e.preventDefault(); }
    if (e.key === "Enter") onClose();
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(5,5,7,0.6)",
      backdropFilter: "blur(12px)",
      display: "grid", placeItems: "start center",
      paddingTop: "12vh",
    }}>
      <div onClick={e => e.stopPropagation()} className="anim-scale-in" style={{
        width: 640,
        background: "linear-gradient(180deg, rgba(28,28,36,0.95) 0%, rgba(17,17,22,0.95) 100%)",
        border: "1px solid rgba(139,124,255,0.35)",
        borderRadius: 18,
        boxShadow: "var(--shadow-float), 0 0 60px rgba(139,124,255,0.3)",
        backdropFilter: "blur(20px)",
        overflow: "hidden",
      }}>
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border)" }}>
          <Icon name="search" size={15} style={{ color: "var(--violet-2)" }}/>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search notes semantically, run a command, install a plugin…"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "var(--text)", fontSize: 15, padding: 4,
              fontFamily: "inherit",
            }}
          />
          <span className="chip mono" style={{ fontSize: 10 }}>{flat.length} RESULTS</span>
          <kbd className="mono" style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)" }}>ESC</kbd>
        </div>

        <div style={{ maxHeight: 420, overflowY: "auto", padding: "8px 8px 12px" }}>
          {grouped.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
              <Icon name="search" size={24} style={{ color: "var(--text-4)" }}/>
              <div style={{ marginTop: 8 }}>No matches for "{q}"</div>
            </div>
          )}
          {grouped.map(g => (
            <div key={g.group} style={{ marginTop: 6 }}>
              <div className="pixel-label" style={{ fontSize: 9, padding: "6px 10px 4px" }}>{g.group}</div>
              {g.items.map((it, i) => {
                const flatIndex = flat.indexOf(it);
                const isActive = flatIndex === idx;
                return (
                  <div key={i} onMouseEnter={() => setIdx(flatIndex)} onClick={onClose} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 12px", margin: "0 2px",
                    borderRadius: 8,
                    background: isActive ? "linear-gradient(90deg, rgba(139,124,255,0.18), rgba(139,124,255,0.04))" : "transparent",
                    boxShadow: isActive ? "inset 0 0 0 1px rgba(139,124,255,0.3)" : "none",
                    cursor: "pointer", transition: "all 120ms",
                  }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,0.04)", display: "grid", placeItems: "center", color: isActive ? "var(--violet-2)" : "var(--text-3)" }}>
                      <Icon name={it.icon} size={13}/>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13 }}>{it.label}</div>
                      {it.folder && <div className="mono" style={{ fontSize: 10, color: "var(--text-4)" }}>~/{it.folder.toLowerCase()}/</div>}
                    </div>
                    {it.kind === "note" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span className="pixel-label" style={{ fontSize: 9 }}>SIM</span>
                        <div style={{ width: 60, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                          <div style={{ width: `${parseFloat(it.hint) * 100}%`, height: "100%", background: "linear-gradient(90deg, #6D8DFF, #8B7CFF)" }}/>
                        </div>
                        <span className="mono" style={{ fontSize: 10, color: "var(--violet-2)" }}>{it.hint}</span>
                      </div>
                    )}
                    {it.kind !== "note" && it.hint && (
                      <kbd className="mono" style={{ padding: "1px 6px", borderRadius: 4, fontSize: 10, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text-3)" }}>{it.hint}</kbd>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14, fontSize: 11, color: "var(--text-3)" }}>
          <span className="mono"><kbd style={{ marginRight: 4 }}>↑↓</kbd> navigate</span>
          <span className="mono"><kbd style={{ marginRight: 4 }}>↵</kbd> open</span>
          <span className="mono"><kbd style={{ marginRight: 4 }}>⌘</kbd>K · toggle</span>
          <div style={{ flex: 1 }}/>
          <span className="mono" style={{ color: "var(--violet-2)" }}>semantic · local</span>
        </div>
      </div>
    </div>
  );
}

window.PluginsScreen = PluginsScreen;
window.PermissionsModal = PermissionsModal;
window.SettingsScreen = SettingsScreen;
window.CommandPalette = CommandPalette;
window.PluginGlyph = PluginGlyph;
