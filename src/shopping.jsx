// shopping.jsx — Shopping list, tap item name to Google search
const CAT_COLOR_BG = {
  mint: 'var(--mint)',
  sky: 'var(--sky)',
  peach: 'var(--peach)',
  butter: 'var(--butter)',
  lilac: 'var(--lilac)',
  coral: 'var(--coral)',
};

// Reinsert a reordered category subsequence back into the flat items array,
// preserving the position of every item NOT in this category. `nextCatItems`
// is the already-reordered list scoped to one category (from useReorder).
function reorderWithinCat(allItems, catId, nextCatItems) {
  let cursor = 0;
  return allItems.map(it => it.cat === catId ? nextCatItems[cursor++] : it);
}

function Shopping() {
  const [state, setState] = useStore();
  const undo = useUndo();
  const [editingQty, setEditingQty] = React.useState(null);
  const [editingName, setEditingName] = React.useState(null);
  const [editingCat, setEditingCat] = React.useState(null);
  const [showNewCat, setShowNewCat] = React.useState(false);

  const items = state.shopping.items;
  const cats  = state.shopping.cats;

  function addItem(catId, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    // New items go on top — since each category's row order is just this
    // array filtered by cat, prepending to the whole list puts it first
    // within its own category too.
    setState(s => ({
      ...s,
      shopping: { ...s.shopping, items: [{ id: uid(), cat: catId, name: trimmed, qty: null, done: false }, ...s.shopping.items] }
    }));
  }
  function toggle(id) {
    setState(s => {
      const idx = s.shopping.items.findIndex(i => i.id === id);
      if (idx === -1) return s;
      const item = s.shopping.items[idx];
      const updated = { ...item, done: !item.done };
      const items = [...s.shopping.items];
      items.splice(idx, 1);
      // Checking an item sinks it to the end (last within its category, same
      // reasoning as addItem above). Unchecking leaves it where it was.
      if (updated.done) items.push(updated);
      else items.splice(idx, 0, updated);
      return { ...s, shopping: { ...s.shopping, items } };
    });
  }
  function clearChecked(catId) {
    const toRemove = state.shopping.items.filter(i => i.cat === catId && i.done);
    if (toRemove.length === 0) return;
    const prevItems = state.shopping.items;
    setState(s => ({
      ...s,
      shopping: { ...s.shopping, items: s.shopping.items.filter(i => !(i.cat === catId && i.done)) }
    }));
    if (undo) {
      undo(`${toRemove.length} checked item${toRemove.length > 1 ? 's' : ''} cleared`,
        () => setState(s => ({ ...s, shopping: { ...s.shopping, items: prevItems } })));
    }
  }
  function remove(id) {
    const idx = state.shopping.items.findIndex(i => i.id === id);
    const removed = state.shopping.items[idx];
    setState(s => ({
      ...s,
      shopping: { ...s.shopping, items: s.shopping.items.filter(i => i.id !== id) }
    }));
    if (removed && undo) {
      undo(`"${removed.name}" removed`, () => setState(s => {
        const items = [...s.shopping.items];
        items.splice(Math.min(idx, items.length), 0, removed);
        return { ...s, shopping: { ...s.shopping, items } };
      }));
    }
  }
  function setName(id, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState(s => ({
      ...s,
      shopping: { ...s.shopping, items: s.shopping.items.map(i => i.id === id ? { ...i, name: trimmed } : i) }
    }));
  }
  function setQty(id, qty) {
    setState(s => ({
      ...s,
      shopping: { ...s.shopping, items: s.shopping.items.map(i => i.id === id ? { ...i, qty } : i) }
    }));
  }
  function setCatName(catId, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState(s => ({
      ...s,
      shopping: { ...s.shopping, cats: s.shopping.cats.map(c => c.id === catId ? { ...c, name: trimmed } : c) }
    }));
  }
  function addCategory(name, color) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState(s => ({
      ...s,
      shopping: { ...s.shopping, cats: [...s.shopping.cats, { id: uid(), name: trimmed, color }] }
    }));
    setShowNewCat(false);
  }
  function reorderCatItems(catId, nextCatItems) {
    setState(s => ({
      ...s,
      shopping: { ...s.shopping, items: reorderWithinCat(s.shopping.items, catId, nextCatItems) }
    }));
  }
  function reorderCats(nextCats) {
    setState(s => ({ ...s, shopping: { ...s.shopping, cats: nextCats } }));
  }
  function openSearch(name) {
    const url = `https://www.google.com/search?q=${encodeURIComponent(name)}`;
    window.open(url, '_blank', 'noreferrer');
  }

  const { getHandleProps: getCatHandleProps, dragState: catDragState } = useReorder(cats, reorderCats);

  return (
    <div className="main-inner">
      <div className="page-head">
        <div>
          <h2>Shopping</h2>
          <div className="sub">{items.filter(i => !i.done).length} open · tap item to search</div>
        </div>
        <button className="btn dark" onClick={() => setShowNewCat(true)}>+ New category</button>
      </div>

      <div className="shop-list">
        {cats.map(cat => {
          const catItems = items.filter(i => i.cat === cat.id);
          const open = catItems.filter(i => !i.done).length;
          const isCatDragging = catDragState.draggingId === cat.id;
          const isCatOver = catDragState.overId === cat.id && !isCatDragging;
          const catOverBelow = isCatOver && cats.findIndex(x => x.id === cat.id) > cats.findIndex(x => x.id === catDragState.draggingId);
          return (
            <CatBlock
              key={cat.id}
              cat={cat}
              catItems={catItems}
              open={open}
              isDragging={isCatDragging}
              isOver={isCatOver}
              overBelow={catOverBelow}
              catHandleProps={getCatHandleProps(cat.id)}
              editingCat={editingCat === cat.id}
              onStartEditCat={() => setEditingCat(cat.id)}
              onCommitCatName={(name) => { setCatName(cat.id, name); setEditingCat(null); }}
              onCancelEditCat={() => setEditingCat(null)}
              onReorder={(next) => reorderCatItems(cat.id, next)}
              editingQty={editingQty}
              editingName={editingName}
              onToggle={toggle}
              onRemove={remove}
              onStartEditName={setEditingName}
              onCommitName={(id, v) => { setName(id, v); setEditingName(null); }}
              onCancelEditName={() => setEditingName(null)}
              onStartEditQty={setEditingQty}
              onCommitQty={(id, v) => { setQty(id, v); setEditingQty(null); }}
              onOpenSearch={openSearch}
              onAddItem={(name) => addItem(cat.id, name)}
              onClearChecked={() => clearChecked(cat.id)}
            />
          );
        })}
      </div>

      {showNewCat && (
        <NewCategoryModal
          onCreate={addCategory}
          onClose={() => setShowNewCat(false)}
        />
      )}
    </div>
  );
}

function CatBlock({
  cat, catItems, open, isDragging, isOver, overBelow, catHandleProps,
  editingCat, onStartEditCat, onCommitCatName, onCancelEditCat,
  onReorder, editingQty, editingName, onToggle, onRemove, onStartEditName, onCommitName,
  onCancelEditName, onStartEditQty, onCommitQty, onOpenSearch, onAddItem, onClearChecked,
}) {
  const checkedCount = catItems.length - open;
  const { getHandleProps, dragState } = useReorder(catItems, onReorder);

  const blockCls = [
    'cat-block',
    isDragging ? 'reorder-dragging' : '',
    isOver ? `reorder-over ${overBelow ? 'reorder-over-below' : ''}` : '',
  ].filter(Boolean).join(' ');

  const [showAddModal, setShowAddModal] = React.useState(false);
  const [addDraft, setAddDraft] = React.useState('');

  function submitAdd() {
    const name = addDraft.trim();
    if (!name) return;
    onAddItem(name);
    setAddDraft('');
    setShowAddModal(false);
  }

  return (
    <div className={blockCls} data-reorder-id={cat.id} style={{ background: CAT_COLOR_BG[cat.color] }}>
      <div className="cat-head">
        <span className="reorder-handle cat-drag-handle" {...catHandleProps} title="Drag to reorder category">⠿</span>
        {editingCat ? (
          <input
            autoFocus
            className="cat-name-input"
            defaultValue={cat.name}
            dir={isRTL(cat.name) ? 'rtl' : 'ltr'}
            onBlur={(e) => onCommitCatName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.target.blur();
              if (e.key === 'Escape') onCancelEditCat();
            }}
          />
        ) : (
          <div className="cat-name" dir={isRTL(cat.name) ? 'rtl' : 'ltr'} onClick={onStartEditCat} title="Tap to rename">
            {cat.name}
            <svg className="cat-name-pencil" width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M8.5 1.5l2 2-6.5 6.5-2.3.3.3-2.3 6.5-6.5z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        <div className="cat-head-right">
          {checkedCount > 0 && (
            <button className="cat-clear-btn" onClick={onClearChecked} title="Remove all checked items">
              Clear<span className="cat-clear-word"> checked</span> · {checkedCount}
            </button>
          )}
          <div className="cat-count">{open}/{catItems.length}</div>
        </div>
      </div>

      {catItems.map(it => {
        const overBelow = dragState.overId === it.id &&
          catItems.findIndex(x => x.id === it.id) > catItems.findIndex(x => x.id === dragState.draggingId);
        return (
          <ShopItemRow
            key={it.id}
            item={it}
            isDragging={dragState.draggingId === it.id}
            isOver={dragState.overId === it.id && dragState.draggingId !== it.id}
            overBelow={overBelow}
            handleProps={getHandleProps(it.id)}
            editingName={editingName === it.id}
            editingQty={editingQty === it.id}
            onToggle={() => onToggle(it.id)}
            onRemove={() => onRemove(it.id)}
            onStartEditName={() => onStartEditName(it.id)}
            onCommitName={(v) => onCommitName(it.id, v)}
            onCancelEditName={onCancelEditName}
            onStartEditQty={() => onStartEditQty(it.id)}
            onCommitQty={(v) => onCommitQty(it.id, v)}
            onOpenSearch={() => onOpenSearch(it.name)}
          />
        );
      })}

      <div className="add-col-btn-row">
        <button className="add-col-btn" onClick={() => setShowAddModal(true)}>+ Add item</button>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Add to {cat.name}</h3>
            <input
              autoFocus
              className="input"
              placeholder="Item name…"
              value={addDraft}
              dir={isRTL(addDraft) ? 'rtl' : 'ltr'}
              onChange={(e) => setAddDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitAdd(); if (e.key === 'Escape') setShowAddModal(false); }}
            />
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn dark" disabled={!addDraft.trim()} onClick={submitAdd}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Swipe-to-reveal on mobile (touch drag on the row body, not the handle).
// Desktop: edit/delete buttons are always visible, no hover-reveal.
const SWIPE_OPEN_X = -156; // 3 buttons × 52px: search + edit + delete
const SWIPE_THRESHOLD = -36;

function ShopItemRow({
  item, isDragging, isOver, overBelow, handleProps,
  editingName, editingQty, onToggle, onRemove,
  onStartEditName, onCommitName, onCancelEditName,
  onStartEditQty, onCommitQty, onOpenSearch,
}) {
  const [swipeX, setSwipeX] = React.useState(0);
  const swiping = React.useRef(null);

  function onTouchStart(e) {
    if (editingName) return;
    if (e.target.closest('[data-reorder-handle]')) return; // let the drag handle own this touch
    const t = e.touches[0];
    swiping.current = { startX: t.clientX, startY: t.clientY, openAt: swipeX, locked: null };
  }
  function onTouchMove(e) {
    const st = swiping.current;
    if (!st) return;
    const t = e.touches[0];
    const dx = t.clientX - st.startX;
    const dy = t.clientY - st.startY;
    if (st.locked === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      st.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (st.locked !== 'x') return;
    e.preventDefault();
    const next = Math.min(0, Math.max(SWIPE_OPEN_X, st.openAt + dx));
    setSwipeX(next);
  }
  function onTouchEnd() {
    const st = swiping.current;
    swiping.current = null;
    if (!st || st.locked !== 'x') return;
    setSwipeX(swipeX <= SWIPE_THRESHOLD ? SWIPE_OPEN_X : 0);
  }
  function closeSwipe() { setSwipeX(0); }

  const rowCls = [
    'item-row',
    item.done ? 'done' : '',
    isDragging ? 'reorder-dragging' : '',
    isOver ? `reorder-over ${overBelow ? 'reorder-over-below' : ''}` : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rowCls} data-reorder-id={item.id}>
      {/* 3 buttons × 52px — must match SWIPE_OPEN_X so no gap shows behind the row */}
      <div className="item-swipe-actions" style={{ width: 156 }}>
        <button className="item-swipe-btn search" onClick={() => { onOpenSearch(); closeSwipe(); }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
        <button className="item-swipe-btn edit" onClick={() => { onStartEditName(); closeSwipe(); }}>
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
            <path d="M8.5 1.5l2 2-6.5 6.5-2.3.3.3-2.3 6.5-6.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="item-swipe-btn delete" onClick={() => { onRemove(); closeSwipe(); }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div
        className="item-swipe-body"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <span className="reorder-handle" {...handleProps} title="Drag to reorder">⠿</span>
        <Checkbox checked={item.done} onClick={onToggle} />
        {editingName ? (
          <input
            autoFocus
            defaultValue={item.name}
            dir={isRTL(item.name) ? 'rtl' : 'ltr'}
            style={{ flex: 1, border: '1px solid var(--accent)', borderRadius: 6, padding: '2px 8px', font: 'inherit', fontSize: 14, outline: 'none', background: 'white', boxShadow: '0 0 0 3px rgba(0,102,204,0.12)' }}
            onBlur={e => onCommitName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') onCancelEditName(); }}
          />
        ) : (
          <div
            className="item-name"
            dir={isRTL(item.name) ? 'rtl' : 'ltr'}
            onClick={() => swipeX !== 0 && closeSwipe()}
          >
            {item.name}
          </div>
        )}
        {editingQty ? (
          <input
            autoFocus
            type="number"
            defaultValue={item.qty || ''}
            style={{ width: 50, fontFamily: 'var(--font-mono)', fontSize: 12, padding: '2px 6px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.2)' }}
            onBlur={(e) => onCommitQty(e.target.value ? Number(e.target.value) : null)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
          />
        ) : item.qty != null ? (
          <span className="item-qty" onClick={onStartEditQty}>×{item.qty}</span>
        ) : (
          <span className="item-qty add" onClick={onStartEditQty}>+qty</span>
        )}
        <button className="item-action-btn search" onClick={onOpenSearch} title="Search online">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
        <button className="item-action-btn edit" onClick={onStartEditName} title="Rename">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8.5 1.5l2 2-6.5 6.5-2.3.3.3-2.3 6.5-6.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="item-action-btn delete" onClick={onRemove} title="Remove">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function NewCategoryModal({ onCreate, onClose }) {
  const [name, setNameVal] = React.useState('');
  const [color, setColor] = React.useState('mint');
  const colors = Object.keys(CAT_COLOR_BG);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>New category</h3>
        <input
          autoFocus
          className="input"
          placeholder="Category name…"
          value={name}
          dir={isRTL(name) ? 'rtl' : 'ltr'}
          onChange={(e) => setNameVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onCreate(name, color); }}
        />
        <div className="modal-color-grid">
          {colors.map(c => (
            <div
              key={c}
              className={`modal-color-swatch ${color === c ? 'active' : ''}`}
              style={{ background: CAT_COLOR_BG[c] }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn dark" disabled={!name.trim()} onClick={() => onCreate(name, color)}>Create</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Shopping });
