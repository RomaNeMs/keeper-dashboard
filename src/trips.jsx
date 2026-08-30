// trips.jsx — Vacation & trip expense tracker
const TRIP_CATEGORIES = [
  { id: 'flight',    label: 'Flight',    icon: '✈️' },
  { id: 'hotel',     label: 'Hotel',     icon: '🏨' },
  { id: 'insurance', label: 'Insurance', icon: '🛡️' },
  { id: 'car',       label: 'Car',       icon: '🚗' },
  { id: 'train',     label: 'Train',     icon: '🚂' },
  { id: 'food',      label: 'Food',      icon: '🍽️' },
  { id: 'shopping',  label: 'Shopping',  icon: '🛍️' },
  { id: 'other',     label: 'Other',     icon: '📦' },
];
const TRIP_CURRENCIES = ['USD', 'EUR', 'ILS'];

// Category accent colors — deep tones from the app palette
const TRIP_CAT_COLORS = {
  flight:    '#0066CC',
  hotel:     '#7A57C0',
  insurance: '#46708E',
  car:       '#7a5c3a',
  train:     '#B5622B',
  food:      '#2E7D52',
  shopping:  '#B94040',
  other:     '#8a7060',
};

function tripDays(trip) {
  if (!trip.startDate || !trip.endDate) return 0;
  const d = Math.round((new Date(trip.endDate) - new Date(trip.startDate)) / 86400000) + 1;
  return d > 0 ? d : 0;
}

// Aggregate expenses of one or more trips into per-category ILS totals
function catTotalsILS(trips) {
  const totals = {};
  let grand = 0;
  trips.forEach(t => (t.expenses || []).forEach(e => {
    const ils = toILSamt(e, t);
    const c = TRIP_CAT_COLORS[e.category] ? e.category : 'other';
    if (!totals[c]) totals[c] = { amount: 0, count: 0 };
    totals[c].amount += ils;
    totals[c].count += 1;
    grand += ils;
  }));
  return { totals, grand };
}

// Stacked bar + per-category rows (icon · label · count · % · ₪)
function CatBreakdown({ trips }) {
  const { totals, grand } = catTotalsILS(trips);
  if (!grand) return null;
  const cats = TRIP_CATEGORIES
    .filter(c => totals[c.id])
    .sort((a, b) => totals[b.id].amount - totals[a.id].amount);
  return (
    <div className="cat-breakdown">
      <div className="cat-bar">
        {cats.map(c => (
          <div key={c.id} className="cat-bar-seg"
            style={{ width: `${(totals[c.id].amount / grand) * 100}%`, background: TRIP_CAT_COLORS[c.id] }} />
        ))}
      </div>
      <div className="cat-rows">
        {cats.map(c => {
          const t = totals[c.id];
          return (
            <div key={c.id} className="cat-row">
              <span className="cat-row-dot" style={{ background: TRIP_CAT_COLORS[c.id] }} />
              <span className="cat-row-icon">{c.icon}</span>
              <span className="cat-row-label">{c.label}</span>
              <span className="cat-row-count">
                ×{t.count}{t.count > 1 ? ` · avg ${fmtILS(t.amount / t.count)}` : ''}
              </span>
              <span className="cat-row-pct">{Math.round((t.amount / grand) * 100)}%</span>
              <span className="cat-row-amt">{fmtILS(t.amount)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Lifetime summary across all trips + statistics
function TripsOverview({ trips, open, onToggle }) {
  const { grand } = catTotalsILS(trips);
  if (!grand) return null;

  const nExp = trips.reduce((n, t) => n + (t.expenses || []).length, 0);
  const ranked = trips.map(t => ({ t, total: totalILS(t) })).sort((a, b) => b.total - a.total);
  const top = ranked[0];
  const avg = grand / trips.length;

  let biggest = null;
  trips.forEach(t => (t.expenses || []).forEach(e => {
    const ils = toILSamt(e, t);
    if (!biggest || ils > biggest.ils) biggest = { e, ils, trip: t };
  }));
  const biggestCat = biggest && TRIP_CATEGORIES.find(c => c.id === biggest.e.category);

  return (
    <div className="trips-overview">
      <div className="trips-overview-head" onClick={onToggle}>
        <div>
          <div className="block-label">All trips · lifetime</div>
          <div className="trips-overview-total">{fmtILS(grand)}</div>
          <div className="trips-overview-sub">
            {trips.length} trips · {nExp} expenses · avg {fmtILS(avg)} per trip
          </div>
        </div>
        <button className="trip-collapse-btn">{open ? '▲' : '▼'}</button>
      </div>
      {open && (
        <>
          <CatBreakdown trips={trips} />
          <div className="trips-overview-stats">
            <div className="tstat">
              <span>Most expensive trip</span>
              <b>{top.t.name} · {fmtILS(top.total)}</b>
            </div>
            {biggest && (
              <div className="tstat">
                <span>Biggest single expense</span>
                <b>{biggest.e.description || biggestCat?.label || 'Expense'} · {fmtILS(biggest.ils)}</b>
              </div>
            )}
            <div className="tstat">
              <span>Average per trip</span>
              <b>{fmtILS(avg)}</b>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function totalILS(trip) {
  return trip.expenses.reduce((sum, e) => {
    if (e.currency === 'ILS') return sum + e.amount;
    if (e.currency === 'USD') return sum + e.amount * (trip.usdRate || 3.7);
    if (e.currency === 'EUR') return sum + e.amount * (trip.eurRate || 3.9);
    return sum + e.amount;
  }, 0);
}

function toILSamt(e, trip) {
  if (e.currency === 'ILS') return e.amount;
  if (e.currency === 'USD') return e.amount * (trip.usdRate || 3.7);
  if (e.currency === 'EUR') return e.amount * (trip.eurRate || 3.9);
  return e.amount;
}

function fmtILS(n) {
  return '₪' + Math.round(n).toLocaleString('en-US');
}

function fmtAmt(n, ccy) {
  const s = Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  if (ccy === 'USD') return '$' + s;
  if (ccy === 'EUR') return '€' + s;
  return '₪' + s;
}

function exportCSV(trip) {
  const header = 'Date,Category,Description,Amount,Currency,ILS Equivalent';
  const rows = [...trip.expenses]
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .map(e => {
      const cat = TRIP_CATEGORIES.find(c => c.id === e.category)?.label || e.category;
      return [e.date || '', cat, e.description || '', e.amount, e.currency, Math.round(toILSamt(e, trip))].join(',');
    });
  navigator.clipboard.writeText([header, ...rows].join('\n'))
    .then(() => alert('CSV copied!'))
    .catch(() => alert('Copy failed'));
}

// ── Trip actions popover (⋯ menu) ──────────────────────────────────────────
function TripMenu({ trip, onEdit, onDelete, onToggleActive, onExport, onClose }) {
  React.useEffect(() => {
    const handler = (e) => { if (!e.target.closest('.trip-menu-wrap')) onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, [onClose]);

  return (
    <div className="trip-menu-wrap">
      <div className="trip-menu-pop">
        <button className="trip-menu-item" onClick={() => { onEdit(); onClose(); }}>✎ Edit trip</button>
        <button className="trip-menu-item" onClick={() => { onToggleActive(); onClose(); }}>
          {trip.active ? '📦 Mark as past' : '✈️ Set as active'}
        </button>
        <button className="trip-menu-item" onClick={() => { onExport(); onClose(); }}>↗ Export CSV</button>
        <button className="trip-menu-item danger" onClick={() => {
          if (confirm(`Delete "${trip.name}" and all expenses?`)) { onDelete(); onClose(); }
        }}>✕ Delete trip</button>
      </div>
    </div>
  );
}

// ── Swipe-to-reveal expense row ────────────────────────────────────────────
const EXP_SWIPE_OPEN = -104;
const EXP_SWIPE_THRESH = -36;

function ExpenseRow({ expense, trip, handleProps, isDragging, isOver, overBelow, onEdit, onDelete }) {
  const [swipeX, setSwipeX] = React.useState(0);
  const swiping = React.useRef(null);

  function onTouchStart(e) {
    if (e.target.closest('[data-reorder-handle]')) return;
    const t = e.touches[0];
    swiping.current = { startX: t.clientX, startY: t.clientY, openAt: swipeX, locked: null };
  }
  function onTouchMove(e) {
    const st = swiping.current;
    if (!st) return;
    const t = e.touches[0];
    const dx = t.clientX - st.startX, dy = t.clientY - st.startY;
    if (st.locked === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      st.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (st.locked !== 'x') return;
    e.preventDefault();
    setSwipeX(Math.min(0, Math.max(EXP_SWIPE_OPEN, st.openAt + dx)));
  }
  function onTouchEnd() {
    const st = swiping.current; swiping.current = null;
    if (!st || st.locked !== 'x') return;
    setSwipeX(swipeX <= EXP_SWIPE_THRESH ? EXP_SWIPE_OPEN : 0);
  }
  function close() { setSwipeX(0); }

  const cat = TRIP_CATEGORIES.find(c => c.id === expense.category);
  const ils = toILSamt(expense, trip);

  const rowCls = [
    'trip-expense-row-wrap',
    isDragging ? 'reorder-dragging' : '',
    isOver ? `reorder-over ${overBelow ? 'reorder-over-below' : ''}` : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rowCls} data-reorder-id={expense.id}>
      <div className="item-swipe-actions">
        <button className="item-swipe-btn edit" onClick={() => { onEdit(); close(); }}>
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
            <path d="M8.5 1.5l2 2-6.5 6.5-2.3.3.3-2.3 6.5-6.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
          </svg>
        </button>
        <button className="item-swipe-btn delete" onClick={() => { onDelete(); close(); }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      <div
        className="trip-expense-body"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <span className="reorder-handle" {...handleProps} title="Drag to reorder">⠿</span>
        <span className="trip-exp-icon">{cat?.icon || '📦'}</span>
        <div className="trip-exp-main">
          <div className="trip-exp-name">{expense.description || cat?.label || 'Expense'}</div>
          {expense.date && <div className="trip-exp-date">{expense.date}</div>}
        </div>
        <div className="trip-exp-amts">
          <div className="trip-exp-orig">{fmtAmt(expense.amount, expense.currency)}</div>
          {expense.currency !== 'ILS' && <div className="trip-exp-ils">{fmtILS(ils)}</div>}
        </div>
        <button className="item-action-btn edit" onClick={onEdit} title="Edit">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8.5 1.5l2 2-6.5 6.5-2.3.3.3-2.3 6.5-6.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
          </svg>
        </button>
        <button className="item-action-btn delete" onClick={onDelete} title="Delete">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Main Trips component ───────────────────────────────────────────────────
function Trips() {
  const [state, setState] = useStore();
  const trips = state.trips || [];
  const [showNew, setShowNew] = React.useState(false);
  const collapsed = state.tripsCollapsed || {};
  // Default open (true) until the user explicitly collapses it — then remembered
  // across app restarts/devices just like everything else in the synced store.
  const overviewOpen = state.tripsOverviewOpen !== false;

  function toggleCollapse(id) {
    setState(s => ({
      ...s,
      tripsCollapsed: { ...(s.tripsCollapsed || {}), [id]: !(s.tripsCollapsed || {})[id] }
    }));
  }

  function toggleOverviewOpen() {
    setState(s => ({ ...s, tripsOverviewOpen: !(s.tripsOverviewOpen !== false) }));
  }

  function createTrip(name, startDate, endDate, usdRate, eurRate) {
    // Don't auto-archive existing trips — user controls active/past manually
    const trip = {
      id: uid(), name, startDate, endDate,
      usdRate: parseFloat(usdRate) || (state.usdRate || 3.7),
      eurRate: parseFloat(eurRate) || 3.9,
      active: true,
      expenses: [],
      sortIdx: 0,
      createdAt: Date.now(),
    };
    // Shift existing sortIdx down
    setState(s => ({
      ...s,
      trips: [trip, ...(s.trips || []).map((t, i) => ({ ...t, sortIdx: i + 1 }))],
    }));
    setShowNew(false);
  }

  function editTrip(id, name, startDate, endDate) {
    setState(s => ({
      ...s,
      trips: (s.trips || []).map(t => t.id === id ? { ...t, name, startDate, endDate } : t),
    }));
  }

  function toggleActive(id) {
    setState(s => ({
      ...s,
      trips: (s.trips || []).map(t => t.id === id ? { ...t, active: !t.active } : t),
    }));
  }

  function deleteTrip(id) {
    setState(s => ({ ...s, trips: (s.trips || []).filter(t => t.id !== id) }));
  }

  function addExpense(tripId, expense) {
    setState(s => ({
      ...s,
      trips: (s.trips || []).map(t =>
        t.id === tripId ? { ...t, expenses: [...t.expenses, { id: uid(), ...expense, sortIdx: t.expenses.length, createdAt: Date.now() }] } : t
      ),
    }));
  }

  function updateExpense(tripId, expenseId, updates) {
    setState(s => ({
      ...s,
      trips: (s.trips || []).map(t =>
        t.id === tripId ? { ...t, expenses: t.expenses.map(e => e.id === expenseId ? { ...e, ...updates } : e) } : t
      ),
    }));
  }

  function deleteExpense(tripId, expenseId) {
    setState(s => ({
      ...s,
      trips: (s.trips || []).map(t =>
        t.id === tripId ? { ...t, expenses: t.expenses.filter(e => e.id !== expenseId) } : t
      ),
    }));
  }

  function updateRates(tripId, usdRate, eurRate) {
    setState(s => ({
      ...s,
      trips: (s.trips || []).map(t =>
        t.id === tripId ? { ...t, usdRate: parseFloat(usdRate) || t.usdRate, eurRate: parseFloat(eurRate) || t.eurRate } : t
      ),
    }));
  }

  function reorderTrips(next) {
    setState(s => ({ ...s, trips: next.map((t, i) => ({ ...t, sortIdx: i })) }));
  }

  function reorderExpenses(tripId, nextExpenses) {
    setState(s => ({
      ...s,
      trips: (s.trips || []).map(t =>
        t.id === tripId ? { ...t, expenses: nextExpenses.map((e, i) => ({ ...e, sortIdx: i })) } : t
      ),
    }));
  }

  // Sort trips by sortIdx (manual order)
  const sorted = [...trips].sort((a, b) => (a.sortIdx ?? 0) - (b.sortIdx ?? 0));
  const { getHandleProps: getTripHandle, dragState: tripDrag } = useReorder(sorted, reorderTrips);

  const activeCount = trips.filter(t => t.active).length;

  return (
    <div className="main-inner">
      <div className="page-head">
        <div>
          <h2>Trips</h2>
          <div className="sub">{trips.length} trip{trips.length !== 1 ? 's' : ''} · {activeCount} active</div>
        </div>
        <button className="btn dark" onClick={() => setShowNew(true)}>+ New trip</button>
      </div>

      {trips.length >= 2 && (
        <TripsOverview trips={trips} open={overviewOpen} onToggle={toggleOverviewOpen} />
      )}

      {showNew && (
        <NewTripModal
          defaultUsdRate={state.usdRate || 3.7}
          onCreate={createTrip}
          onClose={() => setShowNew(false)}
        />
      )}

      {trips.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✈️</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No trips yet</div>
          <div style={{ fontSize: 13 }}>Tap + New trip to start tracking expenses.</div>
        </div>
      )}

      <div className="trip-list">
        {sorted.map(t => {
          const isDragging = tripDrag.draggingId === t.id;
          const isOver = tripDrag.overId === t.id && !isDragging;
          const overBelow = isOver && sorted.findIndex(x => x.id === t.id) > sorted.findIndex(x => x.id === tripDrag.draggingId);
          return (
            <TripCard
              key={t.id}
              trip={t}
              collapsed={!!collapsed[t.id]}
              onToggleCollapse={() => toggleCollapse(t.id)}
              tripHandleProps={getTripHandle(t.id)}
              isDragging={isDragging}
              isOver={isOver}
              overBelow={overBelow}
              onEdit={(name, s, e) => editTrip(t.id, name, s, e)}
              onToggleActive={() => toggleActive(t.id)}
              onDelete={() => deleteTrip(t.id)}
              onAddExpense={(e) => addExpense(t.id, e)}
              onUpdateExpense={(eid, u) => updateExpense(t.id, eid, u)}
              onDeleteExpense={(eid) => deleteExpense(t.id, eid)}
              onReorderExpenses={(next) => reorderExpenses(t.id, next)}
              onUpdateRates={(u, ev) => updateRates(t.id, u, ev)}
            />
          );
        })}
      </div>
    </div>
  );
}

function TripCard({
  trip, collapsed, onToggleCollapse, tripHandleProps,
  isDragging, isOver, overBelow,
  onEdit, onToggleActive, onDelete,
  onAddExpense, onUpdateExpense, onDeleteExpense, onReorderExpenses, onUpdateRates,
}) {
  const [showAdd, setShowAdd] = React.useState(false);
  const [editingExpense, setEditingExpense] = React.useState(null);
  const [showEditTrip, setShowEditTrip] = React.useState(false);
  const [showMenu, setShowMenu] = React.useState(false);
  const [editRates, setEditRates] = React.useState(false);
  const [draftUSD, setDraftUSD] = React.useState(String(trip.usdRate));
  const [draftEUR, setDraftEUR] = React.useState(String(trip.eurRate));

  const total = totalILS(trip);
  const byCcy = TRIP_CURRENCIES.map(c => ({
    ccy: c,
    amt: trip.expenses.filter(e => e.currency === c).reduce((s, e) => s + e.amount, 0),
  })).filter(x => x.amt > 0);

  // Sort expenses by sortIdx then createdAt
  const sortedExpenses = [...trip.expenses].sort((a, b) =>
    (a.sortIdx ?? 0) - (b.sortIdx ?? 0) || (a.createdAt || 0) - (b.createdAt || 0)
  );
  const { getHandleProps: getExpHandle, dragState: expDrag } = useReorder(sortedExpenses, onReorderExpenses);

  function saveRates() {
    onUpdateRates && onUpdateRates(draftUSD, draftEUR);
    setEditRates(false);
  }

  const cardCls = [
    'trip-card',
    !trip.active ? 'trip-card-past' : '',
    isDragging ? 'reorder-dragging' : '',
    isOver ? `reorder-over ${overBelow ? 'reorder-over-below' : ''}` : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cardCls} data-reorder-id={trip.id}>
      {/* Header row — always visible */}
      <div className="trip-card-head">
        <span className="reorder-handle trip-drag-handle" {...tripHandleProps} title="Drag to reorder">⠿</span>
        <div className="trip-head-info" onClick={onToggleCollapse} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="trip-name">{trip.name}</span>
            {!trip.active && <span className="trip-badge-past">past</span>}
          </div>
          {(trip.startDate || trip.endDate) && (
            <div className="trip-dates">{trip.startDate}{trip.endDate ? ` - ${trip.endDate}` : ''}</div>
          )}
        </div>
        {/* Compact total always visible */}
        <div className="trip-head-total" onClick={onToggleCollapse} style={{ cursor: 'pointer' }}>
          <span className="trip-head-ils">{fmtILS(total)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}>
          {!collapsed && (
            <>
              <button className="trip-menu-btn" onClick={() => setShowMenu(m => !m)}>⋯</button>
              {showMenu && (
                <TripMenu
                  trip={trip}
                  onEdit={() => setShowEditTrip(true)}
                  onDelete={onDelete}
                  onToggleActive={onToggleActive}
                  onExport={() => exportCSV(trip)}
                  onClose={() => setShowMenu(false)}
                />
              )}
            </>
          )}
        </div>
        <button className="trip-collapse-btn" onClick={onToggleCollapse}>{collapsed ? '▼' : '▲'}</button>
      </div>

      {!collapsed && (
        <>
          {/* Slim summary bar */}
          <div className="trip-totals">
            <div className="trip-totals-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                <span className="trip-total-big">{fmtILS(total)}</span>
                {byCcy.map(x => (
                  <span key={x.ccy} className="trip-ccy-pill">{fmtAmt(x.amt, x.ccy)}</span>
                ))}
                {tripDays(trip) > 0 && total > 0 && (
                  <span className="trip-ccy-pill" title="Average per day">
                    {fmtILS(total / tripDays(trip))}/day · {tripDays(trip)}d
                  </span>
                )}
              </div>
              <div className="trip-rates-inline">
                {editRates ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, opacity: 0.6 }}>$</span>
                    <input type="number" value={draftUSD} onChange={e => setDraftUSD(e.target.value)}
                      style={{ width: 44, fontSize: 11, padding: '2px 4px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: 'inherit', outline: 'none' }}/>
                    <span style={{ fontSize: 10, opacity: 0.6 }}>€</span>
                    <input type="number" value={draftEUR} onChange={e => setDraftEUR(e.target.value)}
                      style={{ width: 44, fontSize: 11, padding: '2px 4px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: 'inherit', outline: 'none' }}/>
                    <button onClick={saveRates} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, border: 'none', background: 'rgba(255,255,255,0.25)', cursor: 'pointer', color: 'inherit' }}>✓</button>
                  </div>
                ) : (
                  <span className="trip-rate-label" onClick={() => { setDraftUSD(String(trip.usdRate)); setDraftEUR(String(trip.eurRate)); setEditRates(true); }}>
                    $→₪{trip.usdRate} · €→₪{trip.eurRate} ✎
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Per-category breakdown */}
          {sortedExpenses.length > 1 && (
            <div className="trip-cats">
              <CatBreakdown trips={[trip]} />
            </div>
          )}

          {/* Add expense button */}
          <div className="add-col-btn-row">
            <button className="add-col-btn" onClick={() => setShowAdd(true)}>+ Add expense</button>
          </div>

          {/* Expense list */}
          {sortedExpenses.length === 0 ? (
            <div style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: 13 }}>No expenses yet.</div>
          ) : (
            <div className="trip-expenses">
              {sortedExpenses.map(e => {
                const expIsDragging = expDrag.draggingId === e.id;
                const expIsOver = expDrag.overId === e.id && !expIsDragging;
                const expOverBelow = expIsOver && sortedExpenses.findIndex(x => x.id === e.id) > sortedExpenses.findIndex(x => x.id === expDrag.draggingId);
                return (
                  <ExpenseRow
                    key={e.id}
                    expense={e}
                    trip={trip}
                    handleProps={getExpHandle(e.id)}
                    isDragging={expIsDragging}
                    isOver={expIsOver}
                    overBelow={expOverBelow}
                    onEdit={() => setEditingExpense(e)}
                    onDelete={() => onDeleteExpense(e.id)}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {showAdd && (
        <AddExpenseModal
          onSave={(exp) => { onAddExpense(exp); setShowAdd(false); }}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editingExpense && (
        <AddExpenseModal
          initial={editingExpense}
          onSave={(updates) => { onUpdateExpense(editingExpense.id, updates); setEditingExpense(null); }}
          onClose={() => setEditingExpense(null)}
        />
      )}
      {showEditTrip && (
        <EditTripModal
          trip={trip}
          onSave={(name, s, e) => { onEdit(name, s, e); setShowEditTrip(false); }}
          onClose={() => setShowEditTrip(false)}
        />
      )}
    </div>
  );
}

function NewTripModal({ defaultUsdRate, onCreate, onClose }) {
  const [name, setName] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [usdRate, setUsdRate] = React.useState(String(defaultUsdRate));
  const [eurRate, setEurRate] = React.useState('3.9');

  function submit() {
    if (!name.trim()) return;
    onCreate(name.trim(), startDate, endDate, usdRate, eurRate);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h3>New trip</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          <input autoFocus className="input" placeholder="e.g. Crete July 2026"
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}/>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Start</div>
              <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)}/>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>End</div>
              <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)}/>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>$ → ₪</div>
              <input type="number" inputMode="decimal" className="input" step="0.01" value={usdRate} onChange={e => setUsdRate(e.target.value)}/>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>€ → ₪</div>
              <input type="number" inputMode="decimal" className="input" step="0.01" value={eurRate} onChange={e => setEurRate(e.target.value)}/>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn dark" disabled={!name.trim()} onClick={submit}>Create</button>
        </div>
      </div>
    </div>
  );
}

function EditTripModal({ trip, onSave, onClose }) {
  const [name, setName] = React.useState(trip.name);
  const [startDate, setStartDate] = React.useState(trip.startDate || '');
  const [endDate, setEndDate] = React.useState(trip.endDate || '');

  function submit() {
    if (!name.trim()) return;
    onSave(name.trim(), startDate, endDate);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h3>Edit trip</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          <input autoFocus className="input" value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}/>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Start</div>
              <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)}/>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>End</div>
              <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)}/>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn dark" disabled={!name.trim()} onClick={submit}>Save</button>
        </div>
      </div>
    </div>
  );
}

function AddExpenseModal({ initial, onSave, onClose }) {
  const [step, setStep] = React.useState(initial ? 2 : 1);
  const [category, setCategory] = React.useState(initial?.category || '');
  const [description, setDescription] = React.useState(initial?.description || '');
  const [amountStr, setAmountStr] = React.useState(() => {
    if (!initial?.amount) return '';
    return Number(initial.amount).toLocaleString('en-US', { maximumFractionDigits: 2 });
  });

  function handleAmountChange(e) {
    const raw = e.target.value;
    // Allow typing: strip commas for parsing, keep decimals
    const stripped = raw.replace(/,/g, '');
    // Only reformat if it's a clean number (no trailing dot)
    if (stripped === '' || stripped === '-') { setAmountStr(raw); return; }
    if (stripped.endsWith('.')) { setAmountStr(stripped); return; }
    const n = parseFloat(stripped);
    if (isNaN(n)) { setAmountStr(raw); return; }
    // Format integer part with commas, preserve decimal if present
    const parts = stripped.split('.');
    const intPart = parseInt(parts[0], 10).toLocaleString('en-US');
    const formatted = parts.length > 1 ? intPart + '.' + parts[1] : intPart;
    setAmountStr(formatted);
  }
  const [currency, setCurrency] = React.useState(initial?.currency || 'USD');
  const [date, setDate] = React.useState(initial?.date || today());

  function submit() {
    // Parse amount — strip commas, spaces
    const amt = parseFloat(amountStr.replace(/,/g, '').replace(/\s/g, ''));
    if (!amt || amt <= 0) return;
    onSave({ category, description: description.trim(), amount: amt, currency, date });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        {step === 1 ? (
          <>
            <h3>Category</h3>
            <div className="trip-cat-grid">
              {TRIP_CATEGORIES.map(c => (
                <button key={c.id} className={`trip-cat-btn ${category === c.id ? 'active' : ''}`}
                  onClick={() => { setCategory(c.id); setStep(2); }}>
                  <span className="trip-cat-icon">{c.icon}</span>
                  <span className="trip-cat-label">{c.label}</span>
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => initial ? setStep(2) : onClose()}>
                {initial ? '← Back' : 'Cancel'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <button className="exp-cat-chip" onClick={() => setStep(1)} title="Change category">
                <span style={{ fontSize: 17 }}>{TRIP_CATEGORIES.find(c => c.id === category)?.icon || '📦'}</span>
                <span>{TRIP_CATEGORIES.find(c => c.id === category)?.label || 'Category'}</span>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M8.5 1.5l2 2-6.5 6.5-2.3.3.3-2.3 6.5-6.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
                </svg>
              </button>
              {initial && <span style={{ fontWeight: 600, fontSize: 14 }}>Edit expense</span>}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Amount</div>
                <div className="trip-amount-row">
                  <input
                    autoFocus
                    type="text"
                    inputMode="decimal"
                    className="input input-sm"
                    placeholder="0"
                    value={amountStr}
                    onChange={handleAmountChange}
                    onKeyDown={e => { if (e.key === 'Enter') submit(); }}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <div className="trip-ccy-toggle">
                    {TRIP_CURRENCIES.map(c => (
                      <button key={c} className={`trip-ccy-btn ${currency === c ? 'active' : ''}`}
                        onClick={() => setCurrency(c)}>{c}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Description (optional)</div>
                <input className="input input-sm" placeholder="e.g. El Al TLV-HER"
                  value={description} onChange={e => setDescription(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submit(); }}/>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Date</div>
                <input type="date" className="input input-sm" value={date} onChange={e => setDate(e.target.value)}
                  style={{ fontSize: 12, padding: '5px 8px' }}/>
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: 12 }}>
              <button className="btn ghost" onClick={onClose}>Cancel</button>
              <button className="btn dark"
                disabled={!amountStr || parseFloat(amountStr.replace(/,/g, '')) <= 0}
                onClick={submit}>
                {initial ? 'Save' : 'Add'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { Trips });
