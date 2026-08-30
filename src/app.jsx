// app.jsx — Main shell + tweaks
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "peach",
  "showSidebarCounts": true,
  "density": "comfortable"
}/*EDITMODE-END*/;

function TabIcon({ id, active }) {
  // active: use accent blue (visible on white bar). inactive: use currentColor (inherits muted grey)
  const c = active ? 'var(--accent)' : 'currentColor';
  const icons = {
    home: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke={c} strokeWidth="1.5" strokeLinejoin="round"/><path d="M7.5 18V12h5v6" stroke={c} strokeWidth="1.5" strokeLinejoin="round"/></svg>,
    shopping: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M6 2L3 6v11a1 1 0 001 1h12a1 1 0 001-1V6l-3-4H6z" stroke={c} strokeWidth="1.5" strokeLinejoin="round"/><path d="M3 6h14M13 10a3 3 0 01-6 0" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></svg>,
    tasks: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" stroke={c} strokeWidth="1.5"/><path d="M7 10l2.5 2.5L13 8" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    notes: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="4" y="2" width="12" height="16" rx="2" stroke={c} strokeWidth="1.5"/><path d="M7 7h6M7 10h6M7 13h4" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></svg>,
    quotes: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 9V6a2 2 0 012-2h1M5 9a2 2 0 002 2v1a2 2 0 01-2 2M5 9h2a2 2 0 002-2V6M12 9V6a2 2 0 012-2h1M12 9a2 2 0 002 2v1a2 2 0 01-2 2M12 9h2a2 2 0 002-2V6" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    trips:   <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 13l2-5 5 2 3-5 2 1-2 5-5-2-2 4H3z" stroke={c} strokeWidth="1.4" strokeLinejoin="round"/><path d="M17 4l-2 2" stroke={c} strokeWidth="1.4" strokeLinecap="round"/></svg>,
    finance: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke={c} strokeWidth="1.5"/><path d="M10 6v1.5M10 12.5V14M8 9.5c0-.83.67-1.5 1.5-1.5h1a1.5 1.5 0 010 3h-1a1.5 1.5 0 000 3h1c.83 0 1.5-.67 1.5-1.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></svg>,
  };
  return icons[id] || null;
}

// Expose for sidebar.jsx (loads before this file, but only renders after)
Object.assign(window, { TabIcon });

const ALL_TABS = [
  { id: 'home',     label: 'Home'     },
  { id: 'shopping', label: 'Shopping' },
  { id: 'tasks',    label: 'Tasks'    },
  { id: 'notes',    label: 'Notes'    },
  { id: 'quotes',   label: 'Quotes'   },
  { id: 'trips',    label: 'Trips'    },
  { id: 'finance',  label: 'Finance'  },
];

function MobileTabBar({ active, onNav }) {
  const [state, setState] = useStore();
  const syncStatus = useSyncStatus();
  const [showDrawer, setShowDrawer] = React.useState(false);
  const [editMode, setEditMode] = React.useState(false);

  const pinned = state.mobilePinned || ['home', 'shopping', 'tasks', 'notes'];
  const overflow = ALL_TABS.filter(t => !pinned.includes(t.id));

  function setPinned(next) { setState(s => ({ ...s, mobilePinned: next })); }

  function togglePin(id) {
    if (pinned.includes(id)) {
      if (pinned.length <= 1) return; // keep at least 1
      setPinned(pinned.filter(x => x !== id));
    } else {
      setPinned([...pinned, id]);
    }
  }

  // Drag-to-reorder pinned tabs in edit mode
  const pinnedObjs = pinned.map(id => ({ id }));
  const { getHandleProps: getPinnedHandle, dragState: pinnedDrag } = useReorder(
    pinnedObjs,
    (next) => setPinned(next.map(x => x.id))
  );

  const dotColor = { synced: '#34C759', saving: '#FF9500', loading: '#FF9500', error: '#FF3B30', local: '#aeaeb2' }[syncStatus] || '#aeaeb2';

  function navAndClose(id) { onNav(id); setShowDrawer(false); setEditMode(false); }

  const hasOverflow = overflow.length > 0;
  const isOverflowActive = overflow.some(t => t.id === active);

  return (
    <>
      {showDrawer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 98 }}
          onClick={() => { setShowDrawer(false); setEditMode(false); }}>
          <div className="mobile-drawer" onClick={e => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {editMode ? 'Edit tabs' : 'All tabs'}
              </span>
              <button className="mobile-drawer-edit" onClick={() => setEditMode(e => !e)}>
                {editMode ? 'Done' : 'Edit'}
              </button>
            </div>

            {editMode ? (
              <>
                <div style={{ fontSize: 11, color: 'var(--muted)', padding: '0 4px 8px', textAlign: 'center' }}>
                  Pinned tabs ({pinned.length}) · tap to unpin · ⠿ drag to reorder
                </div>
                {/* Pinned tabs — draggable */}
                <div style={{ marginBottom: 8 }}>
                  {pinned.map(id => {
                    const t = ALL_TABS.find(x => x.id === id);
                    if (!t) return null;
                    const isDragging = pinnedDrag.draggingId === id;
                    const isOver = pinnedDrag.overId === id && !isDragging;
                    return (
                      <div key={id} data-reorder-id={id}
                        className={['mobile-edit-row', isDragging ? 'reorder-dragging' : '', isOver ? 'reorder-over' : ''].filter(Boolean).join(' ')}>
                        <span className="reorder-handle" {...getPinnedHandle(id)} style={{ padding: '4px 8px', color: 'var(--muted)', cursor: 'grab', fontSize: 16 }}>⠿</span>
                        <div className="mobile-tab-icon" style={{ flexShrink: 0 }}><TabIcon id={t.id} active={false} /></div>
                        <span style={{ flex: 1, fontSize: 13, marginLeft: 8 }}>{t.label}</span>
                        <button className="pill-btn red" onClick={() => togglePin(id)}>Unpin</button>
                      </div>
                    );
                  })}
                </div>
                {overflow.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--muted)', padding: '0 4px 8px', textAlign: 'center' }}>
                      Not pinned · tap to pin
                    </div>
                    {overflow.map(t => (
                      <div key={t.id} className="mobile-edit-row">
                        <div style={{ width: 32 }} />
                        <div className="mobile-tab-icon" style={{ flexShrink: 0, opacity: 0.5 }}><TabIcon id={t.id} active={false} /></div>
                        <span style={{ flex: 1, fontSize: 13, marginLeft: 8, color: 'var(--muted)' }}>{t.label}</span>
                        <button className="pill-btn accent" onClick={() => togglePin(t.id)}>Pin</button>
                      </div>
                    ))}
                  </>
                )}
              </>
            ) : (
              <div className="mobile-drawer-grid">
                {ALL_TABS.map(t => (
                  <button key={t.id} className={`mobile-drawer-tab ${active === t.id ? 'active' : ''}`}
                    onClick={() => navAndClose(t.id)}>
                    <TabIcon id={t.id} active={active === t.id} />
                    <span className="mobile-drawer-label">{t.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab bar — centered pinned tabs */}
      <div className="mobile-tab-bar">
        <div style={{ position: 'absolute', top: 7, right: 12, width: 6, height: 6, borderRadius: '50%', background: dotColor, zIndex: 1,
          boxShadow: (syncStatus === 'loading' || syncStatus === 'saving') ? `0 0 0 3px ${dotColor}33` : 'none' }} />
        <div className="mobile-tab-inner">
          {pinned.map(id => {
            const t = ALL_TABS.find(x => x.id === id);
            if (!t) return null;
            return (
              <button key={t.id} className={`mobile-tab ${active === t.id ? 'active' : ''}`} onClick={() => onNav(t.id)}>
                <div className="mobile-tab-icon"><TabIcon id={t.id} active={active === t.id} /></div>
                <span className="mobile-tab-label">{t.label}</span>
              </button>
            );
          })}
          {/* More button — only when there are overflow tabs */}
          {hasOverflow && (
            <button className={`mobile-tab ${isOverflowActive ? 'active' : ''}`} onClick={() => setShowDrawer(d => !d)}>
              <div className="mobile-tab-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="4"  cy="10" r="1.8" fill={isOverflowActive ? 'var(--accent)' : 'currentColor'}/>
                  <circle cx="10" cy="10" r="1.8" fill={isOverflowActive ? 'var(--accent)' : 'currentColor'}/>
                  <circle cx="16" cy="10" r="1.8" fill={isOverflowActive ? 'var(--accent)' : 'currentColor'}/>
                </svg>
              </div>
              <span className="mobile-tab-label">{isOverflowActive ? overflow.find(t => t.id === active)?.label : 'More'}</span>
            </button>
          )}
          {/* If all tabs pinned — show edit button instead of More */}
          {!hasOverflow && (
            <button className="mobile-tab" onClick={() => { setShowDrawer(true); setEditMode(true); }}>
              <div className="mobile-tab-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="mobile-tab-label">Edit</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// Finance PIN persistence is DESKTOP-ONLY: on the Mac, reopening the app
// within a week skips the PIN (that convenience was explicitly asked for).
// Phones are shared/glanceable, so any touch device asks for the PIN on
// every visit — and wipes any stamp left over from before this rule.
// Switching away from the Finance tab mid-session re-locks it immediately
// on all platforms (see onNav below), unchanged from before.
const FIN_UNLOCK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FIN_PERSIST = typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) === 0;

function loadFinanceUnlocked() {
  try {
    if (!FIN_PERSIST) { localStorage.removeItem(FIN_LOCK_KEY); return false; }
    const ts = parseInt(localStorage.getItem(FIN_LOCK_KEY), 10);
    return ts > 0 && (Date.now() - ts) < FIN_UNLOCK_TTL_MS;
  } catch { return false; }
}

function App() {
  const [tab, setTab] = React.useState('home');
  const [focusNote, setFocusNote] = React.useState(null);
  const [financeUnlocked, setFinanceUnlocked] = React.useState(loadFinanceUnlocked);
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  function go(t, payload) {
    setTab(t);
    if (t === 'notes' && payload) setFocusNote(payload);
  }

  function onNav(t) {
    if (tab === 'finance' && t !== 'finance') setFinanceUnlocked(false);
    setTab(t);
    setFocusNote(null);
  }

  const screens = {
    home: <Home go={go} />,
    shopping: <Shopping />,
    tasks: <Tasks />,
    notes: <Notes focusId={focusNote} />,
    quotes: <Quotes />,
    trips: <Trips />,
    finance: financeUnlocked
      ? <Finance />
      : <FinanceLock onUnlock={() => {
          try { if (FIN_PERSIST) localStorage.setItem(FIN_LOCK_KEY, String(Date.now())); } catch {}
          setFinanceUnlocked(true);
        }} />,
  };

  return (
    <div className="mac-shell" data-screen-label="Desktop · macOS">
      <div className="mac-titlebar">
        <div className="tl-dot red" />
        <div className="tl-dot yellow" />
        <div className="tl-dot green" />
        <div className="mac-title"><b>Keeper</b> · Personal Dashboard</div>
        <div style={{ width: 56 }} />
      </div>
      <div className="mac-body">
        <Sidebar active={tab} onNav={onNav} />
        <main className="main">{screens[tab]}</main>
      </div>
      <MobileTabBar active={tab} onNav={onNav} />

      <TweaksPanel title="Tweaks">
        <TweakSection title="Look">
          <TweakRadio
            label="Density"
            value={tweaks.density}
            onChange={(v) => setTweak('density', v)}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
          />
        </TweakSection>
        <TweakSection title="Home widget order">
          <HomeOrderTweak />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

function HomeOrderTweak() {
  const [state, setState] = useStore();
  const order = state.homeOrder || ['today', 'quote', 'shopping'];
  const LABELS = { today: 'Today', quote: 'Quote', shopping: 'Shopping' };

  function move(idx, dir) {
    const next = [...order];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setState(s => ({ ...s, homeOrder: next }));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {order.map((k, i) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(0,0,0,0.04)', borderRadius: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>{i+1}</span>
          <span style={{ flex: 1, fontSize: 13 }}>{LABELS[k]}</span>
          <button className="btn tiny" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
          <button className="btn tiny" onClick={() => move(i, 1)} disabled={i === order.length - 1}>↓</button>
        </div>
      ))}
    </div>
  );
}

function Root() {
  return (
    <StoreProvider>
      <UndoProvider>
        <App />
      </UndoProvider>
    </StoreProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
