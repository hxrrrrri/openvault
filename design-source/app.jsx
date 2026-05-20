// LATTICE — Onboarding (first launch) + Main App entry

const { useState: useStateA, useEffect: useEffectA, useMemo: useMemoA, useRef: useRefA } = React;

// ─────────── ONBOARDING ───────────
function OnboardingScreen({ onEnter }) {
  const [step, setStep] = useStateA("welcome"); // welcome | indexing
  const [progress, setProgress] = useStateA(0);
  const [indexedCount, setIndexedCount] = useStateA(0);

  useEffectA(() => {
    if (step !== "indexing") return;
    const t = setInterval(() => {
      setProgress(p => {
        const next = Math.min(100, p + 1.4 + Math.random() * 0.8);
        if (next >= 100) {
          clearInterval(t);
          setTimeout(onEnter, 600);
        }
        return next;
      });
      setIndexedCount(c => Math.min(120, c + Math.floor(1 + Math.random() * 2)));
    }, 70);
    return () => clearInterval(t);
  }, [step]);

  return (
    <div className="bg-ambient" style={{ width: "100%", height: "100%", position: "relative", display: "grid", placeItems: "center", overflow: "hidden" }}>
      {/* Animated blurred constellation behind card */}
      <ConstellationBacking/>

      {/* Top corner label */}
      <div style={{ position: "absolute", top: 24, left: 28, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: "linear-gradient(135deg, #8B7CFF 0%, #4B36B8 100%)",
          display: "grid", placeItems: "center",
          boxShadow: "0 0 16px rgba(139,124,255,0.5)",
        }}>
          <LatticeMark size={16}/>
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.04em" }}>LATTICE</span>
        <span className="pixel-label" style={{ fontSize: 10, marginLeft: 4 }}>v0.4.2 · NIGHTLY</span>
      </div>

      <div style={{ position: "absolute", top: 24, right: 28 }}>
        <span className="pixel-label" style={{ fontSize: 10 }}>OPEN-SOURCE · LOCAL-FIRST</span>
      </div>

      {/* Main card */}
      {step === "welcome" && (
        <div className="anim-scale-in" style={{
          width: 620, padding: 36,
          background: "linear-gradient(180deg, rgba(28,28,36,0.86), rgba(17,17,22,0.86))",
          border: "1px solid rgba(139,124,255,0.2)",
          borderRadius: 24,
          backdropFilter: "blur(28px)",
          boxShadow: "var(--shadow-float), 0 0 80px rgba(75,54,184,0.3)",
          position: "relative",
          zIndex: 2,
        }}>
          <div className="pixel-label" style={{ fontSize: 11 }}>WELCOME TO LATTICE</div>
          <h1 style={{ fontSize: 36, fontWeight: 600, margin: "10px 0 8px", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            Your knowledge,<br/>as a <span style={{ background: "linear-gradient(90deg, #A99BFF, #6D8DFF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>luminous constellation</span>.
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-2)", margin: "10px 0 26px", lineHeight: 1.6, maxWidth: 480 }}>
            Open a vault to begin. Everything stays on this machine — Markdown files in folders you can read, version, and back up however you like.
          </p>

          {/* Options grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
            <OnbOption icon="plus"   title="Create new vault"      sub="Empty folder · with templates" featured onClick={() => setStep("indexing")}/>
            <OnbOption icon="folder" title="Open local folder"     sub="Use an existing folder of .md files" onClick={() => setStep("indexing")}/>
            <OnbOption icon="cube"   title="Import Obsidian vault" sub="Plugins migrate where possible" onClick={() => setStep("indexing")}/>
            <OnbOption icon="lock"   title="Restore encrypted sync" sub="Provide passphrase to decrypt" onClick={() => setStep("indexing")}/>
          </div>

          {/* Trust strip */}
          <div className="card-inner" style={{ padding: 12, display: "flex", alignItems: "center", justifyContent: "space-around" }}>
            {[
              { icon: "lock", text: "Markdown stays yours" },
              { icon: "wifi", text: "Local-first" },
              { icon: "code", text: "Open-source" },
              { icon: "shield", text: "Plugin permissions" },
            ].map(t => (
              <div key={t.text} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "var(--text-2)" }}>
                <Icon name={t.icon} size={12} style={{ color: "var(--violet-2)" }}/>
                <span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === "indexing" && (
        <div className="anim-scale-in" style={{
          width: 540, padding: 36,
          background: "linear-gradient(180deg, rgba(28,28,36,0.86), rgba(17,17,22,0.86))",
          border: "1px solid rgba(139,124,255,0.25)",
          borderRadius: 24,
          backdropFilter: "blur(28px)",
          boxShadow: "var(--shadow-float), 0 0 80px rgba(75,54,184,0.3)",
          position: "relative", zIndex: 2,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
            <div style={{ position: "relative", width: 50, height: 50 }}>
              <svg width="50" height="50" viewBox="0 0 50 50" style={{ position: "absolute", inset: 0, animation: "spin 2.4s linear infinite" }}>
                <circle cx="25" cy="25" r="20" stroke="rgba(255,255,255,0.06)" strokeWidth="3" fill="none"/>
                <circle cx="25" cy="25" r="20" stroke="url(#og)" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="40 90"
                  style={{ filter: "drop-shadow(0 0 6px rgba(139,124,255,0.6))" }}/>
                <defs><linearGradient id="og"><stop offset="0%" stopColor="#A99BFF"/><stop offset="100%" stopColor="#6D8DFF"/></linearGradient></defs>
              </svg>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                <Icon name="sparkle" size={20} style={{ color: "var(--violet-2)" }}/>
              </div>
            </div>
            <div>
              <div className="pixel-label" style={{ fontSize: 10 }}>INDEXING · LOCAL</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>Building your constellation…</div>
            </div>
          </div>

          {/* Progress + steps */}
          <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden", marginBottom: 4, position: "relative" }}>
            <div style={{
              width: `${progress}%`, height: "100%",
              background: "linear-gradient(90deg, #4B36B8, #8B7CFF, #A99BFF)",
              boxShadow: "0 0 12px rgba(139,124,255,0.6)",
              transition: "width 70ms linear",
            }}/>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 6, color: "var(--text-3)" }} className="mono">
            <span>{indexedCount} / 120 notes</span>
            <span>{Math.round(progress)}%</span>
          </div>

          <div className="divider" style={{ margin: "20px 0" }}/>

          {/* Step list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Step done={progress > 6}  label="Scan folder · 9 folders"/>
            <Step done={progress > 22} label="Parse Markdown · 120 files"/>
            <Step done={progress > 48} label="Resolve wikilinks · 42 backlinks"/>
            <Step done={progress > 72} label="Compute embeddings · local model"/>
            <Step done={progress > 92} label="Layout constellation"/>
          </div>

          <div style={{ marginTop: 22, fontSize: 11, color: "var(--text-3)", textAlign: "center" }}>
            <Icon name="lock" size={11} style={{ color: "var(--success)", verticalAlign: "-2px", marginRight: 4 }}/>
            Embeddings never leave this machine.
          </div>
        </div>
      )}

      <div style={{ position: "absolute", bottom: 22, left: 0, right: 0, textAlign: "center" }}>
        <span className="pixel-label" style={{ fontSize: 10 }}>100% LOCAL · ENCRYPTED · MIT LICENSED</span>
      </div>
    </div>
  );
}

function Step({ done, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: done ? "var(--text)" : "var(--text-3)" }}>
      <div style={{
        width: 16, height: 16, borderRadius: 8,
        border: "1px solid " + (done ? "transparent" : "var(--border)"),
        background: done ? "linear-gradient(135deg, #8B7CFF, #4B36B8)" : "transparent",
        display: "grid", placeItems: "center",
        boxShadow: done ? "0 0 10px rgba(139,124,255,0.4)" : "none",
        transition: "all 200ms",
      }}>
        {done && <Icon name="check" size={10} style={{ color: "white", strokeWidth: 2.5 }}/>}
      </div>
      {label}
    </div>
  );
}

function OnbOption({ icon, title, sub, featured, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: 14, textAlign: "left",
      border: "1px solid " + (featured ? "rgba(139,124,255,0.45)" : "var(--border)"),
      borderRadius: 14,
      background: featured ? "linear-gradient(135deg, rgba(139,124,255,0.16), rgba(75,54,184,0.06))" : "rgba(255,255,255,0.02)",
      color: "#ECECF4",
      cursor: "pointer", transition: "all 200ms",
      display: "flex", flexDirection: "column", gap: 10,
      boxShadow: featured ? "0 0 24px rgba(139,124,255,0.18)" : "none",
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(139,124,255,0.45)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = featured ? "rgba(139,124,255,0.45)" : "var(--border)"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", color: "var(--violet-2)", border: "1px solid rgba(139,124,255,0.25)" }}>
        <Icon name={icon} size={15}/>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{sub}</div>
      </div>
    </button>
  );
}

function ConstellationBacking() {
  // A decorative animated svg constellation
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 1, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: "10%", top: "20%", width: 380, height: 380, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(139,124,255,0.35), transparent 60%)",
        filter: "blur(40px)", animation: "blob-drift 18s ease-in-out infinite" }}/>
      <div style={{ position: "absolute", right: "8%", bottom: "10%", width: 480, height: 480, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(109,141,255,0.28), transparent 60%)",
        filter: "blur(50px)", animation: "blob-drift 22s ease-in-out infinite reverse" }}/>
      <div style={{ position: "absolute", left: "55%", top: "60%", width: 320, height: 320, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(75,54,184,0.4), transparent 60%)",
        filter: "blur(60px)", animation: "blob-drift 25s ease-in-out infinite" }}/>

      {/* Small floating particles */}
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 60 }).map((_, i) => {
          const x = (i * 73 + 12) % 100;
          const y = (i * 137 + 8) % 100;
          const r = (i % 4) + 1;
          const o = 0.2 + (i % 5) * 0.12;
          return <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill={i % 7 === 0 ? "#A99BFF" : "#ffffff"} opacity={o} style={{ animation: `float-y ${5 + (i%5)}s ease-in-out infinite`, transformOrigin: "center" }}/>;
        })}
      </svg>
    </div>
  );
}

// ─────────── MAIN APP ───────────
function App() {
  const [stage, setStage] = useStateA("onboarding"); // onboarding | desktop
  const [view, setView] = useStateA("workspace");    // workspace | graph | health | plugins | settings
  const [palette, setPalette] = useStateA(false);
  const [leftOpen, setLeftOpen] = useStateA(true);
  const [rightOpen, setRightOpen] = useStateA(true);
  const [activeNote, setActiveNote] = useStateA("n1");
  const [selectedNodeId, setSelectedNodeId] = useStateA("g0");
  const [hoverNodeId, setHoverNodeId] = useStateA(null);
  const [permModal, setPermModal] = useStateA(null); // plugin obj or null
  const [mobilePreview, setMobilePreview] = useStateA(false);
  const [syncState, setSyncState] = useStateA("SYNCED");

  // Keyboard: ⌘K / Ctrl+K opens palette
  useEffectA(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(p => !p);
      }
      if (e.key === "Escape") setPalette(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (stage === "onboarding") {
    return <OnboardingScreen onEnter={() => setStage("desktop")}/>;
  }

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg)", position: "relative" }}>
      {/* Top command bar */}
      <CommandBar
        vault={VAULT}
        onOpenPalette={() => setPalette(true)}
        view={view}
        setView={setView}
        syncState={syncState}
        onToggleMobile={() => setMobilePreview(m => !m)}
        isMobilePreview={mobilePreview}
      />

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {!mobilePreview && (
          <>
            {/* Left sidebar / rail */}
            {leftOpen ? (
              <LeftSidebar activeNote={activeNote} setActiveNote={setActiveNote} open={leftOpen} setOpen={setLeftOpen}/>
            ) : (
              <SidebarRail side="left" onClick={() => setLeftOpen(true)}/>
            )}

            {/* Center */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
              {view === "workspace" && (
                <EditorScreen activeNote={activeNote} onOpenGraph={() => setView("graph")}/>
              )}
              {view === "graph" && (
                <GraphScreen selectedId={selectedNodeId} setSelectedId={setSelectedNodeId} hoverId={hoverNodeId} setHoverId={setHoverNodeId}/>
              )}
              {view === "health" && <HealthScreen/>}
              {view === "plugins" && <PluginsScreen onOpenPermissions={p => setPermModal(p)}/>}
              {view === "settings" && <SettingsScreen onOpenPermissions={p => setPermModal(p)}/>}
            </div>

            {/* Right sidebar / rail (only for workspace + graph) */}
            {(view === "workspace") && (
              rightOpen
                ? <RightSidebar open={rightOpen} setOpen={setRightOpen} activeNote={activeNote}/>
                : <SidebarRail side="right" onClick={() => setRightOpen(true)}/>
            )}
          </>
        )}

        {mobilePreview && (
          <MobilePreviewStage onExit={() => setMobilePreview(false)}/>
        )}
      </div>

      {/* Status strip */}
      {!mobilePreview && <StatusStrip activeNote={activeNote}/>}

      {/* Floating overlays */}
      {palette && <CommandPalette onClose={() => setPalette(false)}/>}
      {permModal && <PermissionsModal plugin={permModal} onClose={() => setPermModal(null)}/>}

      {/* Toast: hint for command palette on first load */}
      <CommandPaletteHint/>
    </div>
  );
}

function CommandPaletteHint() {
  const [shown, setShown] = useStateA(true);
  useEffectA(() => {
    const t = setTimeout(() => setShown(false), 5800);
    return () => clearTimeout(t);
  }, []);
  if (!shown) return null;
  return (
    <div className="anim-fade-up" style={{
      position: "fixed", bottom: 38, left: "50%", transform: "translateX(-50%)",
      padding: "10px 18px", borderRadius: 12, zIndex: 30,
      background: "linear-gradient(180deg, rgba(28,28,36,0.95), rgba(17,17,22,0.95))",
      border: "1px solid rgba(139,124,255,0.3)",
      boxShadow: "var(--shadow-float), 0 0 24px rgba(139,124,255,0.25)",
      backdropFilter: "blur(20px)",
      display: "flex", alignItems: "center", gap: 14,
      fontSize: 12,
    }}>
      <Icon name="sparkle" size={14} style={{ color: "var(--violet-2)" }}/>
      <span>Press</span>
      <kbd className="mono" style={{ padding: "2px 7px", borderRadius: 4, fontSize: 11, background: "rgba(139,124,255,0.15)", border: "1px solid rgba(139,124,255,0.3)", color: "var(--violet-2)" }}>⌘</kbd>
      <kbd className="mono" style={{ padding: "2px 7px", borderRadius: 4, fontSize: 11, background: "rgba(139,124,255,0.15)", border: "1px solid rgba(139,124,255,0.3)", color: "var(--violet-2)" }}>K</kbd>
      <span>to open the command palette</span>
      <button onClick={() => setShown(false)} className="btn btn-ghost" style={{ padding: 2 }}><Icon name="close" size={11}/></button>
    </div>
  );
}

function MobilePreviewStage({ onExit }) {
  return (
    <div className="bg-ambient" style={{ flex: 1, position: "relative", display: "grid", placeItems: "center", overflow: "hidden" }}>
      <ConstellationBacking/>
      <div style={{ position: "absolute", top: 20, left: 24, zIndex: 5 }}>
        <button className="btn" onClick={onExit}><Icon name="arrowL" size={12}/> Back to desktop</button>
      </div>
      <div style={{ position: "absolute", top: 24, right: 28, zIndex: 5, textAlign: "right" }}>
        <div className="pixel-label" style={{ fontSize: 10 }}>MOBILE COMPANION</div>
        <div style={{ fontSize: 14, marginTop: 2 }}>LATTICE for iOS</div>
      </div>
      <div style={{ position: "relative", zIndex: 5 }}>
        <MobileApp/>
      </div>

      {/* Annotation callouts */}
      <Callout style={{ top: "18%", left: "10%" }} title="Quick capture" body="Voice → transcribed locally → saved into the daily note."/>
      <Callout style={{ top: "52%", left: "12%" }} title="Same constellation" body="Pinch to explore your vault graph on the go."/>
      <Callout style={{ top: "32%", right: "10%" }} title="Encrypted sync" body="3 captures queued, will sync end-to-end encrypted."/>
    </div>
  );
}

function Callout({ style, title, body }) {
  return (
    <div className="anim-fade-up" style={{
      position: "absolute", maxWidth: 200,
      padding: 12, borderRadius: 12,
      background: "linear-gradient(180deg, rgba(28,28,36,0.92), rgba(17,17,22,0.92))",
      border: "1px solid rgba(139,124,255,0.25)",
      backdropFilter: "blur(20px)",
      boxShadow: "var(--shadow-float)",
      ...style,
    }}>
      <div className="pixel-label" style={{ fontSize: 9, color: "var(--violet-2)" }}>NOTE</div>
      <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{title}</div>
      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

window.App = App;
