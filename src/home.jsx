// home.jsx — Overview screen with reorderable widgets
const ALL_WIDGETS = [
  { id: 'today',    label: 'Tasks today',     color: 'sky'    },
  { id: 'quote',    label: "Today's quote",   color: 'peach'  },
  { id: 'shopping', label: 'Shopping list',   color: 'mint'   },
  { id: 'notes',    label: 'Recent notes',    color: 'peach'  },
  { id: 'upcoming', label: 'Upcoming tasks',  color: 'lilac'  },
  { id: 'trips',    label: 'Active trips',    color: 'sand'   },
  { id: 'finance',  label: 'Finance snapshot',color: 'butter' },
];

function Home({ go }) {
  const [state, setState] = useStore();
  const [showSettings, setShowSettings] = React.useState(false);

  const rawOrder = state.homeOrder  || ['today', 'quote', 'shopping'];
  const hidden   = state.homeHidden || [];

  // Clean order: keep only known widget ids, then append any new ones not yet in order
  const knownIds = ALL_WIDGETS.map(w => w.id);
  const cleanOrder = [
    ...rawOrder.filter(k => knownIds.includes(k)),
    ...knownIds.filter(k => !rawOrder.includes(k)),
  ];
  const order = cleanOrder.filter(k => !hidden.includes(k));

  function setOrder(next) { setState(s => ({ ...s, homeOrder: next })); }
  function toggleHide(id) {
    setState(s => {
      const h = s.homeHidden || [];
      return { ...s, homeHidden: h.includes(id) ? h.filter(x => x !== id) : [...h, id] };
    });
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const todaysTasks   = state.tasks.filter(t => !t.done && daysUntil(t.due) === 0);
  const overdue       = state.tasks.filter(t => !t.done && daysUntil(t.due) !== null && daysUntil(t.due) < 0);
  const upcomingTasks = state.tasks.filter(t => !t.done && daysUntil(t.due) !== null && daysUntil(t.due) > 0 && daysUntil(t.due) <= 7);
  // Daily quote — deterministic per day, but the ↻ button can shuffle it for this session
  const [quoteIdx, setQuoteIdx] = React.useState(null);
  const dailyQuote    = state.quotes[(quoteIdx ?? new Date().getDate()) % state.quotes.length];
  function refreshQuote() {
    if (state.quotes.length < 2) return;
    const cur = (quoteIdx ?? new Date().getDate()) % state.quotes.length;
    let next = Math.floor(Math.random() * state.quotes.length);
    if (next === cur) next = (next + 1) % state.quotes.length;
    setQuoteIdx(next);
  }
  const shopActive    = state.shopping.items
    .filter(i => !i.done)
    .sort((a, b) => {
      const cats = state.shopping.cats.map(c => c.id);
      return cats.indexOf(a.cat) - cats.indexOf(b.cat);
    })
    .slice(0, 5);
  const recentNotes = [...(state.notes || [])]
    .sort((a, b) => (b.updated || 0) - (a.updated || 0))
    .slice(0, 3);

  function toggleTask(id) {
    setState(s => ({ ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t) }));
  }

  // useReorder for drag-to-reorder widgets
  const { getHandleProps, dragState } = useReorder(
    order.map(id => ({ id })),
    (next) => setOrder(next.map(x => x.id))
  );

  const widgets = {
    today: (
      <div className="block sky" key="today">
        <div className="block-label">Tasks · {todaysTasks.length + overdue.length} due today</div>
        {overdue.length === 0 && todaysTasks.length === 0 && (
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1.3 }}>
            Nothing due today. <em style={{ color: 'rgba(0,0,0,0.5)' }}>Breathe in.</em>
          </div>
        )}
        {[...overdue, ...todaysTasks].slice(0, 5).map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px dashed rgba(0,0,0,0.12)' }}>
            <Checkbox checked={t.done} onClick={() => toggleTask(t.id)} />
            <div style={{ flex: 1, fontSize: 14 }} dir={isRTL(t.text) ? 'rtl' : 'ltr'}>{t.text}</div>
            {t.due && <DueChip due={t.due} />}
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <button className="btn tiny" onClick={() => go('tasks')}>Open Tasks →</button>
        </div>
      </div>
    ),
    quote: (
      <div className="block peach" key="quote">
        <button className="quote-refresh-btn" onClick={refreshQuote} title="Show another quote">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M13.5 8a5.5 5.5 0 11-1.6-3.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <path d="M13.7 1.6v2.8h-2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="block-label">Today's quote</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, lineHeight: 1.3, letterSpacing: '-0.3px' }}>
          "{dailyQuote.text}"
        </div>
        <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', opacity: 0.65 }}>
          — {dailyQuote.author}
        </div>
      </div>
    ),
    shopping: (
      <div className="block mint" key="shopping">
        <div className="block-label">Shopping · {shopActive.length} open</div>
        {shopActive.length === 0
          ? <div style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>List is clear.</div>
          : shopActive.map(i => (
            <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }} dir={isRTL(i.name) ? 'rtl' : 'ltr'}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ink)', flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 14 }}>{i.name}</div>
              {i.qty != null && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.6 }}>×{i.qty}</span>}
            </div>
          ))
        }
        <div style={{ marginTop: 12 }}>
          <button className="btn tiny" onClick={() => go('shopping')}>Open List →</button>
        </div>
      </div>
    ),
    notes: (
      <div className="block peach" key="notes">
        <div className="block-label">Recent notes</div>
        {recentNotes.length === 0
          ? <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, opacity: 0.6 }}>No notes yet.</div>
          : recentNotes.map(n => (
            <div key={n.id} onClick={() => go('notes', n.id)}
              style={{ padding: '7px 0', borderBottom: '1px dashed rgba(0,0,0,0.12)', cursor: 'pointer' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{n.title}</div>
              {n.lines?.[0] && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {n.lines[0].text}
                </div>
              )}
            </div>
          ))
        }
        <div style={{ marginTop: 12 }}>
          <button className="btn tiny" onClick={() => go('notes')}>Open Notes →</button>
        </div>
      </div>
    ),
    upcoming: (
      <div className="block lilac" key="upcoming">
        <div className="block-label">Upcoming · next 7 days</div>
        {upcomingTasks.length === 0
          ? <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, opacity: 0.6 }}>Nothing coming up.</div>
          : upcomingTasks.slice(0, 5).map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px dashed rgba(0,0,0,0.12)' }}>
              <Checkbox checked={t.done} onClick={() => toggleTask(t.id)} />
              <div style={{ flex: 1, fontSize: 14 }} dir={isRTL(t.text) ? 'rtl' : 'ltr'}>{t.text}</div>
              {t.due && <DueChip due={t.due} />}
            </div>
          ))
        }
        <div style={{ marginTop: 12 }}>
          <button className="btn tiny" onClick={() => go('tasks')}>Open Tasks →</button>
        </div>
      </div>
    ),
    trips: (() => {
      const activeTrips = (state.trips || []).filter(t => t.active);
      return (
        <div className="block sand" key="trips">
          <div className="block-label">Active trips · {activeTrips.length}</div>
          {activeTrips.length === 0
            ? <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, opacity: 0.6 }}>No active trips.</div>
            : activeTrips.slice(0, 3).map(t => {
                const total = (t.expenses || []).reduce((sum, e) => {
                  if (e.currency === 'ILS') return sum + e.amount;
                  if (e.currency === 'USD') return sum + e.amount * (t.usdRate || 3.7);
                  if (e.currency === 'EUR') return sum + e.amount * (t.eurRate || 3.9);
                  return sum;
                }, 0);
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed rgba(0,0,0,0.12)' }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{t.name}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      ₪{Math.round(total).toLocaleString('en-US')}
                    </div>
                  </div>
                );
              })
          }
          <div style={{ marginTop: 12 }}>
            <button className="btn tiny" onClick={() => go('trips')}>Open Trips →</button>
          </div>
        </div>
      );
    })(),
    finance: (
      <div className="block butter" key="finance">
        <div className="block-label">Finance</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, opacity: 0.7 }}>
          Open Finance for the full snapshot.
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn tiny" onClick={() => go('finance')}>Open Finance →</button>
        </div>
      </div>
    ),
  };

  return (
    <div className="main-inner">
      <div className="h-greet">
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{greeting}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="h-date">{fmtDate()}</div>
          <button
            className="home-settings-btn"
            onClick={() => setShowSettings(s => !s)}
            title="Customize widgets"
            style={{ background: showSettings ? 'var(--accent)' : undefined, color: showSettings ? '#fff' : undefined }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.42 1.42M11.54 11.54l1.41 1.41M11.54 3.05l1.41 1.42M3.05 11.54l1.42 1.41" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="card" style={{ marginBottom: 14, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Home widgets — drag to reorder, toggle to show/hide
          </div>
          {ALL_WIDGETS.map(w => (
            <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: `var(--${w.color})`, flexShrink: 0 }}/>
              <span style={{ flex: 1, fontSize: 13 }}>{w.label}</span>
              <button
                className={`pill-btn ${hidden.includes(w.id) ? 'neutral' : 'accent'}`}
                onClick={() => toggleHide(w.id)}>
                {hidden.includes(w.id) ? 'Show' : 'Hide'}
              </button>
            </div>
          ))}
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
            Drag the ⠿ handle on each widget to reorder. Changes sync across devices.
          </div>
        </div>
      )}

      <div className="home-grid">
        {order.map(k => {
          if (!widgets[k]) return null;
          const isDragging = dragState.draggingId === k;
          const isOver     = dragState.overId === k && !isDragging;
          const overBelow  = isOver && order.indexOf(k) > order.indexOf(dragState.draggingId);
          const handleProps = getHandleProps(k);
          return (
            <div
              key={k}
              data-reorder-id={k}
              className={[
                'home-widget-wrap',
                isDragging ? 'reorder-dragging' : '',
                isOver ? `reorder-over ${overBelow ? 'reorder-over-below' : ''}` : '',
              ].filter(Boolean).join(' ')}
            >
              {/* Drag handle — overlaid top-left of widget */}
              <span className="home-drag-handle reorder-handle" {...handleProps} title="Drag to reorder">⠿</span>
              {widgets[k]}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Checkbox({ checked, onClick }) {
  return (
    <div className={`checkbox ${checked ? 'checked' : ''}`} onClick={e => { e.stopPropagation(); onClick && onClick(); }}>
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
        <path d="M2 6l2.5 2.5L9 3" stroke="#fbf9f4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function DueChip({ due }) {
  const n = daysUntil(due);
  let cls = '';
  if (n < 0) cls = 'overdue';
  else if (n === 0) cls = 'today';
  return <span className={`task-due ${cls}`}>{dueLabel(due)}</span>;
}

Object.assign(window, { Home, Checkbox, DueChip });
