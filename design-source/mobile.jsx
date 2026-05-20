// LATTICE — Mobile companion + onboarding

const { useState: useStateM, useEffect: useEffectM } = React;

// ─────────── MOBILE COMPANION ───────────
function MobileApp() {
  const [tab, setTab] = useStateM("home");
  const [recording, setRecording] = useStateM(false);
  const [recDuration, setRecDuration] = useStateM(0);

  useEffectM(() => {
    if (!recording) return;
    const t = setInterval(() => setRecDuration(d => d + 0.1), 100);
    return () => clearInterval(t);
  }, [recording]);

  // Phone frame
  return (
    <div style={{
      width: 320, height: 660,
      borderRadius: 44,
      background: "linear-gradient(180deg, #1a1a22, #0a0a0e)",
      padding: 10,
      border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "0 50px 100px -20px rgba(0,0,0,0.8), 0 0 60px rgba(139,124,255,0.15), inset 0 1px 0 rgba(255,255,255,0.08)",
      position: "relative",
    }}>
      <div style={{
        width: "100%", height: "100%",
        borderRadius: 36,
        background: "#050507",
        overflow: "hidden",
        position: "relative",
        border: "1px solid rgba(255,255,255,0.05)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Status bar */}
        <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", fontSize: 11, color: "#ECECF4", flexShrink: 0 }} className="mono">
          <span>9:41</span>
          <div style={{ position: "absolute", left: "50%", top: 4, transform: "translateX(-50%)", width: 80, height: 20, borderRadius: 20, background: "#000" }}/>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <Icon name="wifi" size={11}/>
            <Icon name="lock" size={11} style={{ color: "var(--success)" }}/>
            <span style={{ width: 18, height: 9, borderRadius: 2, border: "1px solid rgba(255,255,255,0.5)", position: "relative", padding: 1 }}>
              <span style={{ position: "absolute", inset: 1, background: "white", width: "80%", borderRadius: 1 }}/>
            </span>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          {tab === "home" && <MobileHome onCapture={() => setTab("capture")}/>}
          {tab === "capture" && <MobileCapture recording={recording} setRecording={setRecording} recDuration={recDuration} setRecDuration={setRecDuration} onClose={() => { setTab("home"); setRecording(false); setRecDuration(0); }}/>}
          {tab === "search" && <MobileSearch/>}
          {tab === "graph" && <MobileGraph/>}
          {tab === "inbox" && <MobileInbox/>}
        </div>

        {/* Bottom nav */}
        <div style={{
          height: 70, flexShrink: 0,
          borderTop: "1px solid var(--border)",
          background: "rgba(8,8,12,0.95)",
          backdropFilter: "blur(20px)",
          display: "flex", alignItems: "center",
          padding: "0 8px 14px",
        }}>
          {[
            { id: "home",   icon: "home",   label: "Home" },
            { id: "search", icon: "search", label: "Search" },
            { id: "capture",icon: "plus",   label: "Capture", primary: true },
            { id: "graph",  icon: "sphere", label: "Graph" },
            { id: "inbox",  icon: "inbox",  label: "Inbox" },
          ].map(n => {
            const active = tab === n.id;
            if (n.primary) {
              return (
                <button key={n.id} onClick={() => setTab(n.id)} style={{
                  flex: 1, display: "grid", placeItems: "center",
                  border: "none", background: "transparent", cursor: "pointer",
                }}>
                  <div className="pulse" style={{
                    width: 48, height: 48, borderRadius: 24,
                    background: "linear-gradient(135deg, #8B7CFF 0%, #4B36B8 100%)",
                    display: "grid", placeItems: "center",
                    boxShadow: "0 0 20px rgba(139,124,255,0.6), inset 0 1px 0 rgba(255,255,255,0.3)",
                    color: "white",
                  }}>
                    <Icon name="plus" size={20} style={{ color: "white", strokeWidth: 2 }}/>
                  </div>
                </button>
              );
            }
            return (
              <button key={n.id} onClick={() => setTab(n.id)} style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                border: "none", background: "transparent", cursor: "pointer",
                color: active ? "var(--violet-2)" : "var(--text-3)",
                transition: "color 160ms",
              }}>
                <Icon name={n.icon} size={18}/>
                <span style={{ fontSize: 9, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 500 }}>{n.label}</span>
              </button>
            );
          })}
        </div>

        {/* Home indicator */}
        <div style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", width: 100, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.4)" }}/>
      </div>
    </div>
  );
}

function MobileHome({ onCapture }) {
  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "8px 18px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, marginBottom: 18 }}>
        <div>
          <div className="pixel-label" style={{ fontSize: 9 }}>GOOD EVENING, RC</div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", marginTop: 2 }}>Research Vault</div>
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 17, background: "linear-gradient(135deg, #8B7CFF, #4B36B8)", display: "grid", placeItems: "center", color: "white", fontSize: 12, fontWeight: 600 }}>RC</div>
      </div>

      {/* Today card */}
      <div className="gradient-card" style={{ padding: 16, marginBottom: 14, position: "relative", overflow: "hidden", minHeight: 130 }}>
        <div style={{ position: "absolute", right: -30, top: -30, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,124,255,0.4), transparent 70%)", filter: "blur(10px)" }}/>
        <div className="pixel-label" style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", position: "relative" }}>TODAY · 2026-05-20</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginTop: 6, color: "rgba(255,255,255,0.95)" }}>Daily note ready</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 4, lineHeight: 1.5 }}>3 unprocessed captures · 1 task carried over from yesterday</div>
        <button className="btn" style={{ marginTop: 12, fontSize: 11, padding: "5px 11px", background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.22)" }}>Open daily note →</button>
      </div>

      {/* Quick actions */}
      <div className="pixel-label" style={{ fontSize: 9, marginBottom: 8 }}>QUICK ACTIONS</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
        <QA icon="voice" label="Voice note" sub="Transcribed locally" onClick={onCapture}/>
        <QA icon="edit"  label="New note"   sub="Markdown" />
        <QA icon="mic"   label="Audio memo" sub="Save raw"  />
        <QA icon="bolt"  label="Task"       sub="Adds to inbox" />
      </div>

      {/* Recent */}
      <div className="pixel-label" style={{ fontSize: 9, marginBottom: 8 }}>RECENT</div>
      {NOTES.slice(0, 4).map(n => (
        <div key={n.id} className="card" style={{ padding: 12, marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="doc" size={13} style={{ color: "var(--violet-2)" }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="truncate" style={{ fontSize: 13, fontWeight: 500 }}>{n.title}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>{n.folder} · {n.mod}</div>
          </div>
          <Icon name="chevron" size={12} style={{ color: "var(--text-3)" }}/>
        </div>
      ))}

      {/* Sync */}
      <div style={{
        marginTop: 14, padding: 12, borderRadius: 12,
        background: "rgba(101,242,168,0.05)",
        border: "1px solid rgba(101,242,168,0.2)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <Icon name="lock" size={14} style={{ color: "var(--success)" }}/>
        <div style={{ flex: 1 }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--success)" }}>OFFLINE · ENCRYPTED SYNC READY</div>
          <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 2 }}>3 captures will sync when online</div>
        </div>
      </div>
    </div>
  );
}

function QA({ icon, label, sub, onClick }) {
  return (
    <button onClick={onClick} className="card" style={{
      padding: 12, textAlign: "left",
      cursor: "pointer", color: "#ECECF4",
      display: "flex", flexDirection: "column", gap: 8,
      minHeight: 86,
      background: "linear-gradient(180deg, #1a1a22 0%, #14141a 100%)",
    }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(139,124,255,0.12)", display: "grid", placeItems: "center", color: "var(--violet-2)", border: "1px solid rgba(139,124,255,0.25)" }}>
        <Icon name={icon} size={14}/>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div className="mono" style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>{sub}</div>
      </div>
    </button>
  );
}

function MobileCapture({ recording, setRecording, recDuration, setRecDuration, onClose }) {
  const bars = 28;
  return (
    <div style={{ height: "100%", padding: "12px 20px", display: "flex", flexDirection: "column", background: "radial-gradient(ellipse at top, rgba(139,124,255,0.15), transparent 50%)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <button onClick={onClose} className="btn btn-ghost" style={{ padding: 6 }}><Icon name="close"/></button>
        <div className="pixel-label" style={{ fontSize: 10 }}>QUICK CAPTURE</div>
        <button className="btn btn-ghost" style={{ padding: 6, opacity: 0.5 }}><Icon name="settings"/></button>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {/* Big mic with halos */}
        <div style={{ position: "relative", width: 160, height: 160, display: "grid", placeItems: "center" }}>
          {recording && [0, 1, 2].map(i => (
            <div key={i} style={{
              position: "absolute", inset: 0,
              borderRadius: "50%",
              border: "1px solid rgba(139,124,255,0.4)",
              animation: `pulse-halo 2.2s ease-out infinite ${i * 0.7}s`,
            }}/>
          ))}
          <style>{`
            @keyframes pulse-halo {
              0% { transform: scale(0.5); opacity: 1; }
              100% { transform: scale(1.6); opacity: 0; }
            }
          `}</style>
          <button onClick={() => setRecording(r => !r)} style={{
            width: 110, height: 110, borderRadius: 55,
            border: "1px solid rgba(255,255,255,0.18)",
            background: recording ? "linear-gradient(135deg, #FF4D5E, #B82A3A)" : "linear-gradient(135deg, #8B7CFF, #4B36B8)",
            boxShadow: recording ? "0 0 40px rgba(255,77,94,0.5), inset 0 1px 0 rgba(255,255,255,0.3)" : "0 0 40px rgba(139,124,255,0.5), inset 0 1px 0 rgba(255,255,255,0.3)",
            cursor: "pointer",
            display: "grid", placeItems: "center",
          }}>
            <Icon name={recording ? "pause" : "mic"} size={40} style={{ color: "white", strokeWidth: 2 }}/>
          </button>
        </div>

        <div className="mono" style={{ marginTop: 30, fontSize: 24, fontWeight: 500, color: recording ? "var(--danger)" : "var(--text-2)" }}>
          {Math.floor(recDuration / 60).toString().padStart(2, "0")}:{(recDuration % 60).toFixed(1).padStart(4, "0")}
        </div>

        {/* Waveform */}
        <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 3, height: 40 }}>
          {Array.from({ length: bars }).map((_, i) => {
            const h = recording ? 6 + Math.abs(Math.sin(i * 0.6 + recDuration * 5)) * 30 : 4;
            return <div key={i} style={{ width: 3, height: h, borderRadius: 2, background: recording ? "var(--violet-2)" : "var(--text-4)", boxShadow: recording ? "0 0 6px rgba(139,124,255,0.4)" : "none", transition: "height 120ms" }}/>;
          })}
        </div>

        {recording && (
          <div className="anim-fade-up" style={{ marginTop: 22, padding: 14, borderRadius: 12, background: "rgba(139,124,255,0.06)", border: "1px solid rgba(139,124,255,0.2)", width: "100%" }}>
            <div className="pixel-label" style={{ fontSize: 9, color: "var(--violet-2)" }}>TRANSCRIBING · ON-DEVICE</div>
            <div style={{ fontSize: 12, color: "var(--text)", marginTop: 6, lineHeight: 1.5, fontStyle: "italic" }}>
              "Atlas should treat orphan notes as a feature, not a bug — they're the<span style={{ background: "rgba(139,124,255,0.3)", padding: "0 2px" }}> compost</span><span className="mono" style={{ color: "var(--violet-2)", animation: "blink 1s infinite" }}>▌</span>"
            </div>
            <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" style={{ flex: 1 }}>Cancel</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={onClose}>{recording ? "Save to daily note" : "Type instead"}</button>
      </div>
    </div>
  );
}

function MobileSearch() {
  return (
    <div style={{ height: "100%", padding: "12px 18px", overflowY: "auto" }}>
      <div style={{ position: "relative", marginBottom: 14 }}>
        <Icon name="search" size={14} style={{ position: "absolute", left: 12, top: 11, color: "var(--text-3)" }}/>
        <input placeholder="Semantic search…" autoFocus style={{ width: "100%", padding: "9px 12px 9px 34px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13, outline: "none", fontFamily: "inherit" }}/>
      </div>
      <div className="pixel-label" style={{ fontSize: 9, marginBottom: 8 }}>SEMANTIC MATCHES</div>
      {SEMANTIC.map((s, i) => (
        <div key={i} className="card" style={{ padding: 12, marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="sparkle" size={12} style={{ color: "var(--indigo)" }}/>
          <span style={{ flex: 1, fontSize: 13 }}>{s.title}</span>
          <span className="mono" style={{ fontSize: 10, color: "var(--violet-2)" }}>{s.score.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

function MobileGraph() {
  return (
    <div style={{ height: "100%", position: "relative" }}>
      <KnowledgeGraph selectedId="g0" onSelect={() => {}} hoverId={null} setHoverId={() => {}} filter={{ tags: true, semantic: true, orphans: false, depth: 2 }} compact/>
      <div style={{ position: "absolute", top: 12, left: 14, right: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="pixel-label" style={{ fontSize: 10 }}>YOUR CONSTELLATION</div>
        <span className="chip mono" style={{ fontSize: 9 }}>120 · 42</span>
      </div>
    </div>
  );
}

function MobileInbox() {
  return (
    <div style={{ height: "100%", padding: "12px 18px", overflowY: "auto" }}>
      <div className="pixel-label" style={{ fontSize: 10, marginBottom: 10 }}>INBOX · 3 UNPROCESSED</div>
      {[
        { icon: "voice", label: "Voice memo · 38s", sub: "Captured 2h ago · transcribed", tone: "violet" },
        { icon: "edit",  label: "Idea: orphan compost", sub: "Quick capture · today", tone: "violet" },
        { icon: "bolt",  label: "Task: review Lin's PR",  sub: "Carried from yesterday", tone: "warn" },
      ].map((it, i) => (
        <div key={i} className="card" style={{ padding: 12, marginBottom: 8, display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: it.tone === "warn" ? "rgba(255,180,94,0.1)" : "rgba(139,124,255,0.1)", display: "grid", placeItems: "center", color: it.tone === "warn" ? "var(--warning)" : "var(--violet-2)" }}>
            <Icon name={it.icon} size={13}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{it.label}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>{it.sub}</div>
          </div>
          <button className="btn btn-ghost" style={{ padding: 4 }}><Icon name="check" size={12}/></button>
        </div>
      ))}
    </div>
  );
}

window.MobileApp = MobileApp;
