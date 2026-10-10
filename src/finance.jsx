// finance.jsx — Family financial snapshot, password-protected
const FIN_LOCK_KEY = 'pdash.fin.unlocked';
const FIN_PASSWORD = '2011';
const FX_KEY = 'pdash.fin.usdRate';
const FIN_CACHE_KEY = 'pdash.fin.data';
const DEFAULT_USD_RATE = 3.7;

function loadRate() {
  try { const v = parseFloat(localStorage.getItem(FX_KEY)); return v > 0 ? v : DEFAULT_USD_RATE; }
  catch { return DEFAULT_USD_RATE; }
}
function saveRate(v) { try { localStorage.setItem(FX_KEY, String(v)); } catch {} }

// Sync availability comes from the store (apiFetch/IS_SYNC on window)

// ───── Empty/placeholder data structure ─────
const EMPTY_FIN = {
  updated: '—',
  cash: [], investments: [], deposits: [], pension: [], rsu: [],
};

function toILS(amt, ccy, rate) { return ccy === 'USD' ? amt * rate : amt; }
function fmtILS(n) {
  const s = Math.round(Math.abs(n)).toLocaleString('en-US');
  return (n < 0 ? '−' : '') + '₪' + s;
}
function fmtUSD(n) {
  const s = Math.round(Math.abs(n)).toLocaleString('en-US');
  return (n < 0 ? '−' : '') + '$' + s;
}
function fmtCcy(n, ccy) { return ccy === 'USD' ? fmtUSD(n) : fmtILS(n); }

// ───── Lock screen ─────
function FinanceLock({ onUnlock }) {
  const [pw, setPw] = React.useState('');
  const [err, setErr] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => { ref.current && ref.current.focus(); }, []);
  function submit(e) {
    e && e.preventDefault();
    if (pw === FIN_PASSWORD) onUnlock();
    else { setErr(true); setPw(''); setTimeout(() => setErr(false), 600); }
  }
  return (
    <div className="main-inner" style={{ display: 'grid', placeItems: 'center', minHeight: 'calc(100vh - 200px)' }}>
      <form onSubmit={submit} className={`fin-lock ${err ? 'shake' : ''}`}>
        <div className="fin-lock-art">
          <div className="fin-lock-shackle" />
          <div className="fin-lock-body">
            <div className="fin-lock-keyhole" />
          </div>
        </div>
        <h2>Finance</h2>
        <p>This tab is private. Enter your passcode to view family financials.</p>
        <input
          ref={ref}
          type="password"
          inputMode="numeric"
          placeholder="• • • •"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className={err ? 'err' : ''}
        />
        <button className="btn dark" type="submit">Unlock →</button>
        <div className="fin-lock-hint">Auto-locks when you leave the tab.</div>
      </form>
    </div>
  );
}

// ───── Main view ─────
function Finance() {
  const [state, setState] = useStore();
  const [hide, setHide] = React.useState(false);
  // Rate stored in state.usdRate so it syncs via Sheet to all devices
  const rate = state.usdRate || 3.7;
  const [editingRate, setEditingRate] = React.useState(false);
  const [draftRate, setDraftRate] = React.useState(String(rate));
  const [finData, setFinData] = React.useState(() => {
    try {
      const cached = localStorage.getItem(FIN_CACHE_KEY);
      return cached ? JSON.parse(cached) : EMPTY_FIN;
    } catch { return EMPTY_FIN; }
  });
  const [syncStatus, setSyncStatus] = React.useState('idle');

  function commitRate() {
    const v = parseFloat(draftRate);
    if (v > 0 && v < 100) {
      setState(s => ({ ...s, usdRate: v }));
    } else {
      setDraftRate(String(rate));
    }
    setEditingRate(false);
  }

  function syncFromSheet() {
    if (!window.IS_SYNC) {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 2000);
      return;
    }
    setSyncStatus('loading');
    apiFetch('getFinanceData')
      .then(json => {
        const data = json && json !== 'null' ? JSON.parse(json) : null;
        if (!data) { setSyncStatus('error'); return; }
        setFinData(data);
        localStorage.setItem(FIN_CACHE_KEY, JSON.stringify(data));
        setSyncStatus('idle');
      })
      .catch(() => setSyncStatus('error'));
  }

  // Auto-sync on first load when the API is unlocked
  React.useEffect(() => {
    if (window.IS_SYNC) syncFromSheet();
  }, []);

  const FIN = finData;
  const hasData = FIN.cash.length > 0 || FIN.investments.length > 0;

  const cashTotalILS     = FIN.cash.reduce((a, x) => a + toILS(x.amount, x.currency, rate), 0);
  const investTotalILS   = FIN.investments.reduce((a, x) => a + x.amount, 0);
  const depositsTotalILS = FIN.deposits.reduce((a, x) => a + x.amount, 0);
  const pensionTotalILS  = FIN.pension.reduce((a, x) => a + x.amount, 0);
  const liquidTotalILS   = FIN.cash.filter(c => c.amount > 0).reduce((a, x) => a + toILS(x.amount, x.currency, rate), 0);
  const liabilitiesILS   = FIN.cash.filter(c => c.amount < 0).reduce((a, x) => a + toILS(x.amount, x.currency, rate), 0);
  const netWorth         = cashTotalILS + investTotalILS + depositsTotalILS + pensionTotalILS;

  const buckets = [
    { label: 'Liquid',      value: Math.max(liquidTotalILS, 0), color: 'var(--mint-deep)'  },
    { label: 'Investments', value: investTotalILS,              color: 'var(--peach-deep)' },
    { label: 'Pension',     value: pensionTotalILS,             color: 'var(--lilac-deep)' },
  ];
  const denom = buckets.reduce((a, b) => a + b.value, 0) || 1;

  return (
    <div className="main-inner">
      <div className="page-head">
        <div>
          <h2>Finance</h2>
          <div className="sub">Family snapshot · last updated {FIN.updated}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="fx-pill" title="USD → ILS conversion rate">
            <span className="fx-label">$→₪</span>
            {editingRate ? (
              <input
                autoFocus
                type="number"
                step="0.01"
                value={draftRate}
                onChange={(e) => setDraftRate(e.target.value)}
                onBlur={commitRate}
                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setDraftRate(String(rate)); setEditingRate(false); } }}
              />
            ) : (
              <span className="fx-val" onClick={() => { setDraftRate(String(rate)); setEditingRate(true); }}>
                {rate.toFixed(2)}
              </span>
            )}
          </div>
          <button className="btn" onClick={() => setHide(h => !h)}>
            {hide ? '○ Show' : '● Hide'}
          </button>
          <button className="btn dark" onClick={syncFromSheet} disabled={syncStatus === 'loading'}>
            {syncStatus === 'loading' ? '↻ Syncing…' : syncStatus === 'error' ? '⚠ Error' : '↻ Sync'}
          </button>
        </div>
      </div>

      {!hasData && syncStatus !== 'loading' && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>₪</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No data yet</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Click Sync to load your financial data from the Sheet.</div>
          <button className="btn dark" onClick={syncFromSheet}>↻ Sync from Sheet</button>
        </div>
      )}

      {syncStatus === 'loading' && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: 13 }}>Loading from Sheet…</div>
        </div>
      )}

      {hasData && (
        <>
        {/* Hero */}
        <div className="fin-hero">
          <div className="block" style={{ background: 'var(--ink)', color: 'var(--paper)', position: 'relative' }}>
            <div className="block-label" style={{ color: '#bfb8a4', opacity: 1 }}>Net worth</div>
            <div className="fin-big" data-hide={hide}>{fmtILS(netWorth)}</div>
            <div className="fin-sub">
              <span className="dot mint" /> Liquid {fmtILS(liquidTotalILS)}
              <span className="dot peach" /> Investments {fmtILS(investTotalILS)}
              <span className="dot lilac" /> Pension {fmtILS(pensionTotalILS)}
            </div>
            {liabilitiesILS < 0 && (
              <div className="fin-debt">Owed on cards · <b>{fmtILS(liabilitiesILS)}</b></div>
            )}
          </div>
          <div className="block butter">
            <div className="block-label">Composition</div>
            <FinDonut buckets={buckets} hide={hide} total={denom} />
          </div>
        </div>

        {/* Bank — single row, no sub-total in header since amount shown in row */}
        {FIN.cash.length > 0 && (
          <FinSection title="Bank" sub="">
            <div className="fin-table">
              {FIN.cash.map(a => (
                <div key={a.id} className="fin-row-2col">
                  <div className="fin-row-main">
                    <div className="fin-row-name">{a.name}</div>
                  </div>
                  <div className="fin-row-amt" data-hide={hide}>{fmtILS(a.amount)}</div>
                </div>
              ))}
            </div>
          </FinSection>
        )}

        {/* Investments — 3-col with %, IBI+IBKR show USD inline */}
        {FIN.investments.length > 0 && (
          <FinSection title="Investments" sub={`${FIN.investments.length} positions · ${fmtILS(investTotalILS)} total`}>
            <div className="fin-table">
              {FIN.investments.map(it => {
                const pct = investTotalILS > 0 ? (it.amount / investTotalILS) * 100 : 0;
                const usdAmt = it.amountUSD != null
                  ? it.amountUSD
                  : it.convertToUSD ? Math.round(it.amount / rate) : null;
                return (
                  <div key={it.id} className={`fin-row ${it.frozen ? 'frozen' : ''}`}>
                    <div className="fin-row-bar" style={{ width: `${pct}%` }} />
                    <div className="fin-row-main">
                      <div className="fin-row-name">{it.name}</div>
                      {it.note && it.note !== it.updated && <div className="fin-row-note">{it.note}</div>}
                    </div>
                    <div className="fin-row-pct">{pct.toFixed(1)}%</div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="fin-row-amt" data-hide={hide}>{fmtILS(it.amount)}</div>
                      {usdAmt != null && (
                        <div className="fin-row-usd" data-hide={hide}>
                          {fmtUSD(usdAmt)}{it.convertToUSD ? <span style={{opacity:0.6}}> ÷{rate.toFixed(2)}</span> : ''}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="fin-row total">
                <div className="fin-row-main"><div className="fin-row-name">Total</div></div>
                <div className="fin-row-pct">100%</div>
                <div className="fin-row-amt" data-hide={hide}>{fmtILS(investTotalILS)}</div>
              </div>
            </div>
          </FinSection>
        )}

        {/* Pension — 2-col, full width */}
        {FIN.pension.length > 0 && (
          <FinSection title="Pension" sub={fmtILS(pensionTotalILS)}>
            <div className="fin-table">
              {FIN.pension.map(p => (
                <div key={p.id} className="fin-row-2col">
                  <div className="fin-row-main">
                    <div className="fin-row-name">{p.name}</div>
                    {p.note && <div className="fin-row-note">{p.note}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="fin-row-amt" data-hide={hide}>{fmtILS(p.amount)}</div>
                    <div className="fin-row-usd">{p.updated}</div>
                  </div>
                </div>
              ))}
              <div className="fin-row-2col total" style={{ background: 'var(--bg)', fontWeight: 700 }}>
                <div className="fin-row-main"><div className="fin-row-name">Total</div></div>
                <div className="fin-row-amt" data-hide={hide}>{fmtILS(pensionTotalILS)}</div>
              </div>
            </div>
          </FinSection>
        )}

        {/* RSU / Stock comp — 2-col */}
        {FIN.rsu && FIN.rsu.length > 0 && (
          <FinSection title="Stock-based comp" sub="RSUs / equity grants · not in net worth">
            <div className="fin-table">
              {FIN.rsu.map(r => {
                // Sheet column A reads like "Coupa - Vesting start date …": the part
                // before " - " is the company, the rest is the grant detail.
                // Column C is the grant's USD value when it's a bare number.
                const [company, ...rest] = String(r.name || '').split(' - ');
                const detail = rest.join(' - ').trim();
                const usdValue = /^\d+(\.\d+)?$/.test(String(r.note || '').trim()) ? Number(r.note) : null;
                return (
                  <div key={r.id} className="fin-row-2col">
                    <div className="fin-row-main">
                      <div className="fin-row-name">{company.trim()}</div>
                      {detail && <div className="fin-row-note">{detail}</div>}
                      {!detail && usdValue == null && r.note && <div className="fin-row-note">{r.note}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="fin-row-amt" data-hide={hide}>{Number(r.shares).toLocaleString()} units</div>
                      {usdValue != null && (
                        <div className="fin-row-usd" data-hide={hide}>
                          {fmtUSD(usdValue)} · ≈{fmtILS(usdValue * rate)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </FinSection>
        )}
        </>
      )}
    </div>
  );
}

function FinSection({ title, sub, compact, children }) {
  return (
    <section className={`fin-section ${compact ? 'compact' : ''}`}>
      <div className="fin-section-head">
        <div className="fin-section-title">{title}</div>
        <div className="fin-section-sub">{sub}</div>
      </div>
      {children}
    </section>
  );
}

function FinDonut({ buckets, hide, total }) {
  const R = 44, C = 2 * Math.PI * R, CX = 56, CY = 56;
  let off = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg width="112" height="112" viewBox="0 0 112 112" style={{ flexShrink: 0 }}>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="16" />
        {buckets.map((b, i) => {
          const frac = b.value / total;
          const len = frac * C;
          const seg = (
            <circle
              key={i}
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={b.color}
              strokeWidth="16"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-off}
              transform={`rotate(-90 ${CX} ${CY})`}
            />
          );
          off += len;
          return seg;
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        {buckets.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: b.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{b.label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginLeft: 'auto', paddingLeft: 6 }}>
              {((b.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Finance, FinanceLock, FIN_PASSWORD });
