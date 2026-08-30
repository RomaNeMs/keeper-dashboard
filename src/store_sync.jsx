// store_sync.jsx — state + localStorage cache + Google Sheets sync
// Drop-in replacement for store.jsx in the production bundle (make_bundle.py uses this).

const STORE_KEY = 'pdash.v1';

const TODAY = new Date();
// Local date, not UTC — toISOString() would shift "today" by a day between
// midnight and ~03:00 in Asia/Jerusalem.
function iso(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}
function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); }

const SEED = {
  shopping: {
    cats: [
      { id: 'c1', name: 'Produce',   color: 'mint'   },
      { id: 'c2', name: 'Household', color: 'sky'    },
      { id: 'c3', name: 'Pantry',    color: 'butter' },
    ],
    items: [
      { id: 's1', cat: 'c1', name: 'Avocados',                qty: 4,    done: false },
      { id: 's2', cat: 'c1', name: 'Cilantro',                qty: null, done: false },
      { id: 's3', cat: 'c1', name: 'Lemons',                  qty: 6,    done: true  },
      { id: 's4', cat: 'c2', name: 'Anipet — 10/11 Cat bags', qty: 1,    done: false },
      { id: 's5', cat: 'c2', name: 'Dishwasher tablets',      qty: null, done: false },
      { id: 's6', cat: 'c3', name: 'נוזל קירור G12',          qty: null, done: false },
      { id: 's7', cat: 'c3', name: 'Olive oil',               qty: 1,    done: false },
    ],
  },
  tasks: [
    { id: 't1', text: 'Renew driver\u2019s license',                        due: iso(TODAY), done: false },
    { id: 't2', text: 'Schedule annual check-up — call clinic before noon', due: iso(TODAY), done: false },
    { id: 't3', text: 'Reply to landlord about the lease renewal',          due: addDays(2), done: false },
    { id: 't4', text: 'Birthday gift for Mom (think: ceramics, books?)',    due: addDays(5), done: false },
    { id: 't5', text: 'Re-read The Culture Map ch. 4',                     due: null,       done: false },
    { id: 't6', text: 'Plan winter ski trip',                               due: null,       done: false },
    { id: 't7', text: 'Pick up dry cleaning',                               due: addDays(-1),done: false },
  ],
  notes: [
    {
      id: 'n1', title: 'Reading & Watching', color: 'peach',
      updated: Date.now() - 86400000,
      lines: [
        { id: 'l1', type: 'h',  text: 'Books' },
        { id: 'l2', type: 'sh', text: 'Currently' },
        { id: 'l3', type: 'b',  text: 'The Hard Thing About Hard Things' },
        { id: 'l4', type: 'b',  text: 'The Culture Map' },
        { id: 'l5', type: 'b',  text: 'החיים כחלום, אם אתם קוראים את המילים האלו' },
        { id: 'l6', type: 'sh', text: 'Queue' },
        { id: 'l7', type: 'b',  text: 'The Road Less Traveled' },
        { id: 'l8', type: 'b',  text: 'Gabriel García Márquez — any' },
        { id: 'l9', type: 'b',  text: 'Ken Follett, Antony Beevor' },
        { id: 'l10', type: 'h', text: 'Movies & Shows' },
        { id: 'l11', type: 'b', text: 'Sugar Man' },
        { id: 'l12', type: 'b', text: 'Mare of Easttown' },
        { id: 'l13', type: 'b', text: 'Long Bright River' },
      ],
    },
    {
      id: 'n2', title: 'Codes & numbers', color: 'sky',
      updated: Date.now() - 2 * 86400000,
      lines: [
        { id: 'm1', type: 'sh', text: 'Home' },
        { id: 'm2', type: 'p',  text: 'Entrance: #0000 · Parking: #0000 · Yard: 0000#' },
        { id: 'm3', type: 'sh', text: 'Car' },
        { id: 'm4', type: 'p',  text: 'Code 0000 · Park 000, 000' },
        { id: 'm5', type: 'sh', text: 'Banking' },
        { id: 'm6', type: 'p',  text: 'Minimum ₪00K · Caspit ₪00K' },
      ],
    },
    {
      id: 'n3', title: 'Coffee preferences', color: 'coral',
      updated: Date.now() - 5 * 86400000,
      lines: [
        { id: 'k1', type: 'p',  text: '100% Arabica, medium-to-dark roast.' },
        { id: 'k2', type: 'p',  text: 'Full body, strong crema.' },
        { id: 'k3', type: 'sh', text: 'Notes I like' },
        { id: 'k4', type: 'b',  text: 'Chocolate / cocoa' },
        { id: 'k5', type: 'b',  text: 'Caramel / honey' },
        { id: 'k6', type: 'b',  text: 'Roasted nuts' },
        { id: 'k7', type: 'p',  text: 'Avoid: berry / forest fruit dominant. Citrus or dark fruit hints are fine.' },
      ],
    },
    {
      id: 'n4', title: 'Whiskey shortlist', color: 'butter',
      updated: Date.now() - 12 * 86400000,
      lines: [
        { id: 'w1', type: 'b', text: 'Kavalan' },
        { id: 'w2', type: 'b', text: 'Kilchoman Sanaig' },
        { id: 'w3', type: 'b', text: 'Ardbeg' },
        { id: 'w4', type: 'p', text: 'Indica — Kush for the evenings.' },
      ],
    },
  ],
  quotes: [
    { id: 'q1', text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Will Durant' },
    { id: 'q2', text: 'The cave you fear to enter holds the treasure you seek.', author: 'Joseph Campbell' },
    { id: 'q3', text: 'It is never too late to be what you might have been.', author: 'George Eliot' },
    { id: 'q4', text: 'Do not go where the path may lead; go instead where there is no path and leave a trail.', author: 'Ralph Waldo Emerson' },
    { id: 'q5', text: 'Between stimulus and response there is a space. In that space is our power to choose our response.', author: 'Viktor Frankl' },
  ],
  homeOrder: ['today', 'quote', 'shopping'],
  trips: [],
};

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw);
    const { financeData: _fd, ...clean } = parsed;
    // Preserve trips from stored state — never let SEED's empty array overwrite real data
    return { ...SEED, ...clean, trips: clean.trips || [], tripsCollapsed: clean.tripsCollapsed || {}, homeHidden: clean.homeHidden || [], mobilePinned: clean.mobilePinned || null };
  } catch { return SEED; }
}
function save(s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch {}
}

// ── Remote sync API ───────────────────────────────────────────────────────
// The app is served from GitHub Pages; Apps Script is only its JSON API.
// The keyed API URL is decrypted by the passcode gate on first unlock and
// stored in localStorage — until then the app runs in local-only mode.
const API_URL = (() => {
  try { return localStorage.getItem('studio.exec.url') || ''; } catch { return ''; }
})();
const IS_SYNC = !!API_URL;

async function apiFetch(action, body) {
  const url = API_URL + '&action=' + action;
  // POST uses text/plain so the request stays "simple" (no CORS preflight,
  // which Apps Script cannot answer).
  const opts = body === undefined
    ? { method: 'GET' }
    : { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body };
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

// ── Sync context ──────────────────────────────────────────────────────────
const StoreCtx = React.createContext(null);
const SyncCtx  = React.createContext('synced'); // 'synced' | 'saving' | 'loading' | 'error' | 'local'

function StoreProvider({ children }) {
  const [state,      setStateRaw]  = React.useState(() => load());
  const [syncStatus, setSyncStatus] = React.useState(IS_SYNC ? 'loading' : 'local');
  const debounceRef  = React.useRef(null);
  const latestState  = React.useRef(state);
  latestState.current = state;

  // Push to Google Sheet (debounced 1.2 s)
  function scheduleSync(data) {
    if (!IS_SYNC) return;
    clearTimeout(debounceRef.current);
    setSyncStatus('saving');
    debounceRef.current = setTimeout(() => {
      apiFetch('saveState', JSON.stringify(data))
        .then(res => setSyncStatus(res === 'ok' ? 'synced' : 'error'))
        .catch(() => setSyncStatus('error'));
    }, 1200);
  }

  // Pull latest from Google Sheet
  function fetchFromSheet() {
    if (!IS_SYNC) return;
    setSyncStatus('loading');
    apiFetch('getState')
      .then(json => {
        if (!json) { setSyncStatus('synced'); return; } // no remote state yet
        const remote = JSON.parse(json);
        const { financeData: _fd, ...cleanRemote } = remote;
        setStateRaw(() => {
          const merged = { ...SEED, ...cleanRemote, trips: cleanRemote.trips || [], tripsCollapsed: cleanRemote.tripsCollapsed || {}, homeHidden: cleanRemote.homeHidden || [], mobilePinned: cleanRemote.mobilePinned || null };
          save(merged);
          return merged;
        });
        setSyncStatus('synced');
      })
      .catch(() => setSyncStatus('error'));
  }

  // On mount: fetch from sheet, then re-fetch on tab focus
  React.useEffect(() => {
    if (!IS_SYNC) return;
    fetchFromSheet();
    const onVisible = () => { if (!document.hidden) fetchFromSheet(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const setState = React.useCallback((updater) => {
    setStateRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      save(next);
      scheduleSync(next);
      return next;
    });
  }, []);

  return (
    <StoreCtx.Provider value={[state, setState]}>
      <SyncCtx.Provider value={syncStatus}>
        {children}
      </SyncCtx.Provider>
    </StoreCtx.Provider>
  );
}

function useStore()  { return React.useContext(StoreCtx); }
function useSyncStatus() { return React.useContext(SyncCtx); }

// ── Undo toast ────────────────────────────────────────────────────────────
// undo(label, restoreFn) shows a 6s toast; tapping Undo runs restoreFn.
const UndoCtx = React.createContext(null);

function UndoProvider({ children }) {
  const [undoState, setUndoState] = React.useState(null); // { label, restore }
  const timerRef = React.useRef(null);

  const show = React.useCallback((label, restore) => {
    clearTimeout(timerRef.current);
    setUndoState({ label, restore });
    timerRef.current = setTimeout(() => setUndoState(null), 6000);
  }, []);

  function doUndo() {
    clearTimeout(timerRef.current);
    if (undoState) undoState.restore();
    setUndoState(null);
  }

  return (
    <UndoCtx.Provider value={show}>
      {children}
      {undoState && (
        <div className="toast undo-toast">
          <span dir={isRTL(undoState.label) ? 'rtl' : 'ltr'}>{undoState.label}</span>
          <button onClick={doUndo}>Undo</button>
        </div>
      )}
    </UndoCtx.Provider>
  );
}

function useUndo() { return React.useContext(UndoCtx); }

// ── SyncStatusPill ────────────────────────────────────────────────────────
// Small dot shown in the sidebar footer. Green = synced, orange = saving,
// red = error, grey = local-only (no GAS env).
function SyncStatusPill() {
  const status = useSyncStatus();
  const cfg = {
    synced:  { color: '#34C759', label: 'Synced' },
    saving:  { color: '#FF9500', label: 'Saving…' },
    loading: { color: '#FF9500', label: 'Loading…' },
    error:   { color: '#FF3B30', label: 'Sync error' },
    local:   { color: '#aeaeb2', label: 'Local' },
  }[status] || { color: '#aeaeb2', label: status };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                  fontFamily: 'var(--font-mono)', color: 'var(--muted)',
                  letterSpacing: 0.3 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%',
                     background: cfg.color, flexShrink: 0,
                     boxShadow: status === 'saving' || status === 'loading'
                       ? `0 0 0 3px ${cfg.color}33` : 'none' }} />
      {cfg.label}
    </div>
  );
}

// ───── RTL detection ─────
const HEB_RE = /[\u0590-\u05FF\u0600-\u06FF]/;
function isRTL(str) {
  if (!str) return false;
  const m = str.match(/[\u0590-\u06FF\u0041-\u007AA-Za-z]/g);
  if (!m) return false;
  let rtl = 0, ltr = 0;
  for (let i = 0; i < Math.min(m.length, 8); i++) {
    if (HEB_RE.test(m[i])) rtl++; else ltr++;
  }
  return rtl > ltr;
}

// ───── Date helpers ─────
function today() { return iso(new Date()); }
function daysUntil(dueIso) {
  if (!dueIso) return null;
  const d = new Date(dueIso + 'T00:00:00');
  const t = new Date(); t.setHours(0,0,0,0);
  return Math.round((d - t) / 86400000);
}
function dueLabel(due) {
  const n = daysUntil(due);
  if (n === null) return null;
  if (n < 0) return n === -1 ? 'Yesterday' : `${-n}d overdue`;
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n < 7) return `In ${n}d`;
  const d = new Date(due + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function dueBucket(due) {
  const n = daysUntil(due);
  if (n === null) return 'someday';
  if (n <= 0) return 'today';
  return 'upcoming';
}

// ───── Drag-to-reorder — touch + pointer dual path ─────
// Pointer events alone don't fire reliably on iOS Safari for drag gestures.
// We use touch events directly for iOS and pointer events for desktop/mouse.
function useReorder(list, onReorder) {
  const [draggingId, setDraggingId] = React.useState(null);
  const [overId, setOverId] = React.useState(null);

  const listRef    = React.useRef(list);
  const overIdRef  = React.useRef(null);
  const reorderRef = React.useRef(onReorder);
  const stateRef   = React.useRef({ id: null, startY: 0, startX: 0, rows: [] });

  listRef.current    = list;
  reorderRef.current = onReorder;
  overIdRef.current  = overId;

  const measure = React.useCallback(() => {
    const rows = [];
    listRef.current.forEach((item) => {
      const el = document.querySelector(`[data-reorder-id="${item.id}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        rows.push({ id: item.id, mid: r.top + r.height / 2 });
      }
    });
    stateRef.current.rows = rows;
  }, []);

  const updateOver = React.useCallback((clientY) => {
    const st = stateRef.current;
    if (!st.id) return;
    let closest = null, closestDist = Infinity;
    for (const row of st.rows) {
      const d = Math.abs(clientY - row.mid);
      if (d < closestDist) { closestDist = d; closest = row.id; }
    }
    if (closest && closest !== overIdRef.current) {
      overIdRef.current = closest;
      setOverId(closest);
    }
  }, []);

  const commit = React.useCallback(() => {
    const st   = stateRef.current;
    const over = overIdRef.current;
    if (st.id && over && over !== st.id) {
      const from = listRef.current.findIndex((x) => x.id === st.id);
      const to   = listRef.current.findIndex((x) => x.id === over);
      if (from !== -1 && to !== -1) {
        const next = [...listRef.current];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        reorderRef.current(next);
      }
    }
    st.id = null;
    overIdRef.current = null;
    setDraggingId(null);
    setOverId(null);
    document.body.style.userSelect = '';
  }, []);

  // ── Desktop: pointer events (mouse, pen) ──
  const onPointerMove = React.useCallback((e) => {
    const st = stateRef.current;
    if (!st.id) return;
    if (Math.abs(e.clientY - st.startY) < 4 && Math.abs(e.clientX - st.startX) < 4) return;
    e.preventDefault();
    updateOver(e.clientY);
  }, [updateOver]);

  const onPointerUp = React.useCallback(() => {
    commit();
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }, [commit, onPointerMove]);

  // ── iOS Safari: touch events ──
  const onTouchMoveDoc = React.useCallback((e) => {
    const st = stateRef.current;
    if (!st.id) return;
    const t = e.touches[0];
    if (Math.abs(t.clientY - st.startY) < 4 && Math.abs(t.clientX - st.startX) < 4) return;
    e.preventDefault();
    updateOver(t.clientY);
  }, [updateOver]);

  const onTouchEndDoc = React.useCallback(() => {
    commit();
    document.removeEventListener('touchmove', onTouchMoveDoc);
    document.removeEventListener('touchend', onTouchEndDoc);
  }, [commit, onTouchMoveDoc]);

  const getHandleProps = React.useCallback((id) => ({
    'data-reorder-handle': true,
    // Desktop path
    onPointerDown: (e) => {
      if (e.pointerType === 'touch') return; // handled by onTouchStart below
      e.preventDefault();
      e.stopPropagation();
      stateRef.current = { id, startY: e.clientY, startX: e.clientX, rows: [] };
      overIdRef.current = null;
      setDraggingId(id);
      setOverId(null);
      measure();
      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp);
    },
    // iOS path
    onTouchStart: (e) => {
      e.stopPropagation();
      const t = e.touches[0];
      stateRef.current = { id, startY: t.clientY, startX: t.clientX, rows: [] };
      overIdRef.current = null;
      setDraggingId(id);
      setOverId(null);
      measure();
      document.body.style.userSelect = 'none';
      document.addEventListener('touchmove', onTouchMoveDoc, { passive: false });
      document.addEventListener('touchend', onTouchEndDoc);
    },
  }), [measure, onPointerMove, onPointerUp, onTouchMoveDoc, onTouchEndDoc]);

  return { getHandleProps, dragState: { draggingId, overId } };
}

// ───── Misc helpers ─────
function uid() { return Math.random().toString(36).slice(2, 9); }
function fmtDate(d = new Date()) {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}
function relTime(ts) {
  const diff = (Date.now() - ts) / 86400000;
  if (diff < 1) return 'today';
  if (diff < 2) return 'yesterday';
  if (diff < 7) return `${Math.floor(diff)}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

Object.assign(window, {
  StoreProvider, useStore, useSyncStatus, SyncStatusPill, useReorder,
  UndoProvider, useUndo, apiFetch, IS_SYNC,
  isRTL, today, daysUntil, dueLabel, dueBucket,
  uid, fmtDate, relTime,
});
