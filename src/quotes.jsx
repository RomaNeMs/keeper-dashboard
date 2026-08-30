// quotes.jsx — Inspirational quotes, daily rotation
function Quotes() {
  const [state, setState] = useStore();
  const undo = useUndo();
  const [draftText, setDraftText] = React.useState('');
  const [draftAuthor, setDraftAuthor] = React.useState('');
  const [showAdd, setShowAdd] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const initialIdx = new Date().getDate() % (state.quotes.length || 1);
  const [focusId, setFocusId] = React.useState(state.quotes[initialIdx]?.id || state.quotes[0]?.id);

  const featured = state.quotes.find(q => q.id === focusId) || state.quotes[0];

  function startEdit(q) {
    setDraftText(q.text);
    setDraftAuthor(q.author);
    setEditingId(q.id);
    setShowAdd(true);
  }
  function closeModal() {
    setShowAdd(false);
    setEditingId(null);
    setDraftText('');
    setDraftAuthor('');
  }
  function add() {
    const text = draftText.trim();
    if (!text) return;
    const author = draftAuthor.trim() || 'Unknown';
    if (editingId) {
      setState(s => ({ ...s, quotes: s.quotes.map(q => q.id === editingId ? { ...q, text, author } : q) }));
      setFocusId(editingId);
    } else {
      const q = { id: uid(), text, author };
      setState(s => ({ ...s, quotes: [q, ...s.quotes] }));
      setFocusId(q.id);
    }
    closeModal();
  }
  function remove(id) {
    const idx = state.quotes.findIndex(q => q.id === id);
    const removed = state.quotes[idx];
    setState(s => ({ ...s, quotes: s.quotes.filter(q => q.id !== id) }));
    if (removed && undo) {
      undo('Quote deleted', () => setState(s => {
        const quotes = [...s.quotes];
        quotes.splice(Math.min(idx, quotes.length), 0, removed);
        return { ...s, quotes };
      }));
    }
  }
  function next() {
    const idx = state.quotes.findIndex(q => q.id === focusId);
    setFocusId(state.quotes[(idx + 1) % state.quotes.length]?.id);
  }
  function shuffle() {
    setFocusId(state.quotes[Math.floor(Math.random() * state.quotes.length)]?.id);
  }
  function reorder(next) {
    setState(s => ({ ...s, quotes: next }));
  }

  const { getHandleProps, dragState } = useReorder(state.quotes, reorder);

  return (
    <div className="main-inner">
      <div className="page-head">
        <div>
          <h2>Quotes</h2>
          <div className="sub">{state.quotes.length} saved · one rotates daily on home</div>
        </div>
        <button className="btn dark" onClick={() => setShowAdd(true)}>+ Add a Quote</button>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? 'Edit quote' : 'Add a quote'}</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              <textarea
                autoFocus
                className="input"
                placeholder="The quote…"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) add(); }}
                style={{ minHeight: 80, fontFamily: 'var(--font-display)', fontSize: 18, resize: 'vertical' }}
              />
              <input
                className="input"
                placeholder="Author"
                value={draftAuthor}
                onChange={(e) => setDraftAuthor(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
              />
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={closeModal}>Cancel</button>
              <button className="btn dark" disabled={!draftText.trim()} onClick={add}>Save</button>
            </div>
          </div>
        </div>
      )}

      {featured && (
        <div className="quotes-stage">
          <span className="quote-mark">"</span>
          <span className="quote-mark r">"</span>
          <div className="quote-text" dir={isRTL(featured.text) ? 'rtl' : 'ltr'}>
            {featured.text}
          </div>
          <div className="quote-attrib">— {featured.author}</div>
          <div className="quote-bar">
            <button className="btn" onClick={shuffle}>↺ Shuffle</button>
            <button className="btn" onClick={next}>Next →</button>
            <button className="btn" onClick={() => startEdit(featured)}>✎ Edit</button>
          </div>
        </div>
      )}

      <div className="quote-list">
        {state.quotes.map((q, i) => {
          const isDragging = dragState.draggingId === q.id;
          const isOver = dragState.overId === q.id && !isDragging;
          const overBelow = isOver && state.quotes.findIndex(x => x.id === q.id) > state.quotes.findIndex(x => x.id === dragState.draggingId);
          return (
            <div
              key={q.id}
              data-reorder-id={q.id}
              className={[
                'quote-chip',
                isDragging ? 'reorder-dragging' : '',
                isOver ? `reorder-over ${overBelow ? 'reorder-over-below' : ''}` : '',
              ].filter(Boolean).join(' ')}
              style={{ background: CAT_COLOR_BG[NOTE_COLORS[i % NOTE_COLORS.length]] }}
              onClick={() => setFocusId(q.id)}
            >
              <span className="reorder-handle quote-chip-handle" {...getHandleProps(q.id)} title="Drag to reorder">⠿</span>
              <span dir={isRTL(q.text) ? 'rtl' : 'ltr'}>"{q.text}"</span>
              <span className="qa">— {q.author}
                <span style={{ float: 'right', cursor: 'pointer', fontSize: 13, lineHeight: 1 }} title="Delete"
                  onClick={(e) => { e.stopPropagation(); remove(q.id); }}>×</span>
                <span style={{ float: 'right', cursor: 'pointer', marginRight: 12 }} title="Edit"
                  onClick={(e) => { e.stopPropagation(); startEdit(q); }}>✎</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { Quotes });
