// sidebar.jsx — Brand, nav, profile
const NAV = [
{ id: 'home',     label: 'Home',     color: 'butter' },
{ id: 'shopping', label: 'Shopping', color: 'mint'   },
{ id: 'tasks',    label: 'Tasks',    color: 'sky'    },
{ id: 'notes',    label: 'Notes',    color: 'peach'  },
{ id: 'quotes',   label: 'Quotes',   color: 'lilac'  },
{ id: 'trips',    label: 'Trips',    color: 'sand'   },
{ id: 'finance',  label: 'Finance',  color: 'butter' }];

const COLOR_MAP = {
  butter: 'var(--butter)',
  mint:   'var(--mint)',
  sky:    'var(--sky)',
  peach:  'var(--peach)',
  lilac:  'var(--lilac)',
  coral:  'var(--coral)',
  sand:   'var(--sand)'
};

function Sidebar({ active, onNav }) {
  return (
    <aside className="sidebar">
      <nav className="nav">
        {NAV.map((n) =>
          <div
            key={n.id}
            className={`nav-item ${active === n.id ? 'active' : ''}`}
            onClick={() => onNav(n.id)}>
            <span className="nav-icon"><TabIcon id={n.id} active={active === n.id} /></span>
            <span>{n.label}</span>
          </div>
        )}
      </nav>
      <div style={{ marginTop: 'auto', padding: '10px 8px 4px' }}>
        <SyncStatusPill />
      </div>
    </aside>
  );
}

Object.assign(window, { Sidebar, COLOR_MAP });