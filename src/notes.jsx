// notes.jsx — Document-feel notes with line types + RTL auto-detect
const NOTE_COLORS = ['peach', 'sky', 'mint', 'butter', 'lilac', 'coral'];
const LINE_TYPES = [
  { id: 'h', label: 'H1', tip: 'Heading' },
  { id: 'sh', label: 'H2', tip: 'Subheading' },
  { id: 'p', label: '¶', tip: 'Paragraph' },
  { id: 'b', label: '•', tip: 'Bullet' },
  { id: 't', label: '☐', tip: 'Task' },
];
const PLACEHOLDER = {
  h: 'Heading',
  sh: 'Subheading',
  p: 'Type something…',
  b: 'List item',
  t: 'To do',
};

function Notes({ focusId }) {
  const [state, setState] = useStore();
  const undo = useUndo();
  // On mobile, start with nothing selected so the list is visible first.
  // On desktop, pre-select the first note as before.
  const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth <= 680;
  const [activeId, setActiveId] = React.useState(
    focusId || (IS_MOBILE ? null : state.notes[0]?.id)
  );
  const [query, setQuery] = React.useState('');

  React.useEffect(() => { if (focusId) setActiveId(focusId); }, [focusId]);

  const active = state.notes.find(n => n.id === activeId);

  const filtered = state.notes.filter(n => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.lines.some(l => l.text.toLowerCase().includes(q));
  });

  function update(noteId, mutator) {
    setState(s => ({
      ...s,
      notes: s.notes.map(n => n.id === noteId ? { ...mutator(n), updated: Date.now() } : n)
    }));
  }
  function newNote() {
    const n = { id: uid(), title: 'Untitled', color: 'peach', updated: Date.now(),
      lines: [{ id: uid(), type: 'p', text: '' }] };
    setState(s => ({ ...s, notes: [n, ...s.notes] }));
    setActiveId(n.id);
  }
  function removeNote(id) {
    const idx = state.notes.findIndex(n => n.id === id);
    const removed = state.notes[idx];
    setState(s => ({ ...s, notes: s.notes.filter(n => n.id !== id) }));
    if (activeId === id) setActiveId(null);
    if (removed && undo) {
      undo(`Note "${removed.title}" deleted`, () => setState(s => {
        const notes = [...s.notes];
        notes.splice(Math.min(idx, notes.length), 0, removed);
        return { ...s, notes };
      }));
    }
  }
  function reorderNotes(next) {
    setState(s => ({ ...s, notes: next }));
  }

  const { getHandleProps: getNoteHandleProps, dragState: noteDragState } = useReorder(state.notes, reorderNotes);

  // On mobile: if a note is active, show only the doc panel (full screen).
  // The back button clears activeId to return to the list.
  const showDoc  = !!active;
  const showList = !showDoc || !IS_MOBILE;  // desktop always shows both

  return (
    <div className="main-inner">
      {/* Mobile: show page-head only on the list screen */}
      {(!IS_MOBILE || !showDoc) && (
        <div className="page-head">
          <div>
            <h2>Notes</h2>
            <div className="sub">{state.notes.length} notes · document-style, not card-grid</div>
          </div>
          <button className="btn dark" onClick={newNote}>+ New note</button>
        </div>
      )}

      {/* Mobile: back button when inside a note */}
      {IS_MOBILE && showDoc && (
        <div className="notes-mobile-back">
          <button className="btn" onClick={() => setActiveId(null)}>← Notes</button>
          <span className="notes-mobile-title">{active.title}</span>
        </div>
      )}

      <div className={`notes-layout ${IS_MOBILE && showDoc ? 'notes-layout-doc' : ''}`}>
        {showList && (
          <div className="notes-list">
            <div className="note-search">
              <input placeholder="Search notes…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            {filtered.map(n => {
              const snip = n.lines.find(l => l.text && l.type !== 'h' && l.type !== 'sh')?.text || '';
              const isDragging = noteDragState.draggingId === n.id;
              const isOver = noteDragState.overId === n.id && !isDragging;
              const overBelow = isOver && state.notes.findIndex(x => x.id === n.id) > state.notes.findIndex(x => x.id === noteDragState.draggingId);
              return (
                <div key={n.id}
                  data-reorder-id={n.id}
                  className={[
                    'note-tab',
                    activeId === n.id ? 'active' : '',
                    isDragging ? 'reorder-dragging' : '',
                    isOver ? `reorder-over ${overBelow ? 'reorder-over-below' : ''}` : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setActiveId(n.id)}
                >
                  <span className="reorder-handle note-list-handle" {...getNoteHandleProps(n.id)}>⠿</span>
                  <div className="note-swatch" style={{ background: CAT_COLOR_BG[n.color] }} />
                  <div className="note-tab-inner">
                    <div className="note-tab-title" dir={isRTL(n.title) ? 'rtl' : 'ltr'}>{n.title}</div>
                    <div className="note-tab-snip" dir={isRTL(snip) ? 'rtl' : 'ltr'}>{snip}</div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && <div className="empty">No matches</div>}
          </div>
        )}

        {showDoc ? (
          <NoteDoc note={active} onUpdate={(m) => update(active.id, m)} onDelete={() => { removeNote(active.id); setActiveId(null); }} />
        ) : (
          !IS_MOBILE && <div className="empty">Select a note</div>
        )}
      </div>
    </div>
  );
}

function NoteDoc({ note, onUpdate, onDelete }) {
  const [openMenu, setOpenMenu] = React.useState(null);
  // Read mode by default — no contentEditable, so opening a note never pops
  // the keyboard on iOS. Editing is an explicit choice.
  const [editing, setEditing] = React.useState(false);
  React.useEffect(() => {
    // Fresh empty notes open in edit mode; existing notes open read-only.
    const isEmpty = note.lines.length === 1 && !note.lines[0].text;
    setEditing(isEmpty);
    setOpenMenu(null);
  }, [note.id]);

  function setTitle(t) { onUpdate(n => ({ ...n, title: t })); }
  function setColor(c) { onUpdate(n => ({ ...n, color: c })); }
  function setLineText(id, text) {
    onUpdate(n => ({ ...n, lines: n.lines.map(l => l.id === id ? { ...l, text } : l) }));
  }
  function setLineType(id, type) {
    onUpdate(n => ({ ...n, lines: n.lines.map(l => l.id === id ? { ...l, type } : l) }));
  }
  function toggleTaskLine(id) {
    onUpdate(n => ({ ...n, lines: n.lines.map(l => l.id === id ? { ...l, done: !l.done } : l) }));
  }
  function addLineAfter(id, type = 'p') {
    const newL = { id: uid(), type, text: '' };
    onUpdate(n => {
      const idx = n.lines.findIndex(l => l.id === id);
      const lines = [...n.lines];
      lines.splice(idx + 1, 0, newL);
      return { ...n, lines };
    });
    // focus next line
    setTimeout(() => {
      const el = document.querySelector(`[data-line-id="${newL.id}"] .line-text`);
      el && el.focus();
    }, 30);
  }
  function removeLine(id) {
    onUpdate(n => ({ ...n, lines: n.lines.length > 1 ? n.lines.filter(l => l.id !== id) : n.lines }));
  }
  function setLines(nextLines) {
    onUpdate(n => ({ ...n, lines: nextLines }));
  }
  const { getHandleProps, dragState } = useReorder(note.lines, setLines);

  return (
    <div className="note-doc" style={{ background: CAT_COLOR_BG[note.color] }}>
      <div className="note-doc-head">
        {editing ? (
          <input
            className="note-title-input"
            value={note.title}
            onChange={(e) => setTitle(e.target.value)}
            dir={isRTL(note.title) ? 'rtl' : 'ltr'}
          />
        ) : (
          <h1 className="note-title-read" dir={isRTL(note.title) ? 'rtl' : 'ltr'}>{note.title}</h1>
        )}
        <button
          className={`btn tiny ${editing ? 'dark' : ''}`}
          onClick={() => { setEditing(v => !v); setOpenMenu(null); }}
        >
          {editing ? 'Done' : (
            <>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M8.5 1.5l2 2-6.5 6.5-2.3.3.3-2.3 6.5-6.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
              </svg>
              Edit
            </>
          )}
        </button>
      </div>
      <div className="note-meta">
        <span>Updated {relTime(note.updated)}</span>
        <span>·</span>
        <span>{note.lines.length} lines</span>
        {editing && (
          <div className="color-pick">
            {NOTE_COLORS.map(c => (
              <div key={c}
                className={`color-dot ${note.color === c ? 'active' : ''}`}
                style={{ background: CAT_COLOR_BG[c] }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="note-body">
        {editing ? note.lines.map((l, i) => {
          const isDragging = dragState.draggingId === l.id;
          const isOver = dragState.overId === l.id && !isDragging;
          const overBelow = isOver && note.lines.findIndex(x => x.id === l.id) > note.lines.findIndex(x => x.id === dragState.draggingId);
          return (
          <div key={l.id}
            className={[
              'note-line',
              l.done ? 'done' : '',
              isDragging ? 'reorder-dragging' : '',
              isOver ? `reorder-over ${overBelow ? 'reorder-over-below' : ''}` : '',
            ].filter(Boolean).join(' ')}
            data-type={l.type}
            data-line-id={l.id}
            data-reorder-id={l.id}
          >
            <span className="line-handle" {...getHandleProps(l.id)}>⠿</span>
            {l.type === 't' && (
              <div className="task-tick" onClick={() => toggleTaskLine(l.id)}>
                {l.done && <svg width="10" height="10" viewBox="0 0 11 11"><path d="M2 6l2.5 2.5L9 3" stroke="#fbf9f4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
              </div>
            )}
            <div
              className={`line-text ${isRTL(l.text) ? 'rtl' : ''}`}
              contentEditable
              suppressContentEditableWarning
              data-ph={PLACEHOLDER[l.type] || 'Type…'}
              onBlur={(e) => setLineText(l.id, e.currentTarget.textContent)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setLineText(l.id, e.currentTarget.textContent);
                  addLineAfter(l.id, l.type === 'h' ? 'p' : l.type);
                } else if (e.key === 'Backspace' && e.currentTarget.textContent === '') {
                  e.preventDefault();
                  removeLine(l.id);
                }
              }}
              dangerouslySetInnerHTML={{ __html: l.text }}
            />
            <div className="line-menu" onClick={() => setOpenMenu(openMenu === l.id ? null : l.id)}>⋯</div>
            {openMenu === l.id && (
              <div style={{ position: 'absolute', left: -8, top: 28, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 10, padding: 6, display: 'flex', gap: 4, zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                {LINE_TYPES.map(t => (
                  <button key={t.id}
                    className="tool-btn"
                    title={t.tip}
                    style={{ background: l.type === t.id ? 'var(--ink)' : 'rgba(0,0,0,0.04)', color: l.type === t.id ? 'var(--paper)' : 'var(--ink)' }}
                    onClick={() => { setLineType(l.id, t.id); setOpenMenu(null); }}
                  >{t.label}</button>
                ))}
                <button className="tool-btn" onClick={() => { removeLine(l.id); setOpenMenu(null); }} style={{ color: '#a00' }}>✕</button>
              </div>
            )}
          </div>
          );
        }) : note.lines.map(l => (
          <div key={l.id}
            className={`note-line read ${l.done ? 'done' : ''}`}
            data-type={l.type}
          >
            {l.type === 't' && (
              <div className="task-tick" onClick={() => toggleTaskLine(l.id)}>
                {l.done && <svg width="10" height="10" viewBox="0 0 11 11"><path d="M2 6l2.5 2.5L9 3" stroke="#fbf9f4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
              </div>
            )}
            <div
              className={`line-text ${isRTL(l.text) ? 'rtl' : ''}`}
              dangerouslySetInnerHTML={{ __html: l.text || '&nbsp;' }}
            />
          </div>
        ))}
      </div>

      {editing && (
      <div className="note-toolbar">
        {LINE_TYPES.map(t => (
          <button key={t.id} className="tool-btn" title={t.tip}
            onClick={() => {
              const last = note.lines[note.lines.length - 1];
              if (last.text === '') setLineType(last.id, t.id);
              else addLineAfter(last.id, t.id);
            }}>
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="tool-btn" onClick={onDelete} style={{ color: '#a00' }}>Delete note</button>
      </div>
      )}
    </div>
  );
}

Object.assign(window, { Notes });
