// tasks.jsx — Today / Upcoming / Someday columns
function orderedBucket(tasks) {
  return [...tasks].sort((a, b) => {
    const ai = a.sortIdx, bi = b.sortIdx;
    if (ai != null && bi != null) return ai - bi;
    if (ai != null) return -1;
    if (bi != null) return 1;
    return (daysUntil(a.due) ?? 99) - (daysUntil(b.due) ?? 99);
  });
}

function Tasks() {
  const [state, setState] = useStore();
  const undo = useUndo();
  const [editingTask, setEditingTask] = React.useState(null); // { id, text, due }

  const bucketed = { today: [], upcoming: [], someday: [] };
  state.tasks.forEach(t => bucketed[dueBucket(t.due)].push(t));
  bucketed.today    = orderedBucket(bucketed.today);
  bucketed.upcoming = orderedBucket(bucketed.upcoming);
  bucketed.someday  = orderedBucket(bucketed.someday);

  function add(text, due) {
    setState(s => ({ ...s, tasks: [...s.tasks, { id: uid(), text, due, done: false }] }));
  }
  function toggle(id) {
    setState(s => ({ ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t) }));
  }
  function remove(id) {
    const removed = state.tasks.find(t => t.id === id);
    setState(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== id) }));
    if (removed && undo) {
      undo('Task deleted', () => setState(s => ({ ...s, tasks: [...s.tasks, removed] })));
    }
  }
  function saveEdit() {
    if (!editingTask) return;
    const text = editingTask.text.trim();
    if (!text) return;
    setState(s => ({ ...s, tasks: s.tasks.map(t => t.id === editingTask.id ? { ...t, text, due: editingTask.due } : t) }));
    setEditingTask(null);
  }
  function moveTask(id, bucket) {
    let due = null;
    if (bucket === 'today') due = today();
    else if (bucket === 'upcoming') due = addDaysIso(3);
    setState(s => ({ ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, due, sortIdx: null } : t) }));
  }
  function reorderBucket(nextBucketTasks) {
    const idxById = new Map(nextBucketTasks.map((t, i) => [t.id, i]));
    setState(s => ({
      ...s,
      tasks: s.tasks.map(t => idxById.has(t.id) ? { ...t, sortIdx: idxById.get(t.id) } : t)
    }));
  }

  const editBucket = editingTask ? dueBucket(editingTask.due) : null;

  return (
    <div className="main-inner">
      <div className="page-head">
        <div>
          <h2>Tasks</h2>
          <div className="sub">{state.tasks.filter(t => !t.done).length} open · {bucketed.today.filter(t => !t.done).length} due today</div>
        </div>
      </div>
      <div className="tasks-grid">
        <TaskCol color="coral" title="Today" sub="due now"
          tasks={bucketed.today} bucketId="today" showDate
          onAdd={add} onToggle={toggle} onRemove={remove}
          onEdit={(t) => setEditingTask({ id: t.id, text: t.text, due: t.due })}
          onMove={moveTask} onReorder={reorderBucket} />
        <TaskCol color="sky" title="Upcoming" sub="this week"
          tasks={bucketed.upcoming} bucketId="upcoming" showDate
          onAdd={add} onToggle={toggle} onRemove={remove}
          onEdit={(t) => setEditingTask({ id: t.id, text: t.text, due: t.due })}
          onMove={moveTask} onReorder={reorderBucket} />
        <TaskCol color="butter" title="Someday" sub="no rush"
          tasks={bucketed.someday} bucketId="someday" showDate={false}
          onAdd={add} onToggle={toggle} onRemove={remove}
          onEdit={(t) => setEditingTask({ id: t.id, text: t.text, due: t.due })}
          onMove={moveTask} onReorder={reorderBucket} />
      </div>

      {editingTask && (
        <div className="modal-overlay" onClick={() => setEditingTask(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Edit task</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              <textarea
                autoFocus
                className="input"
                value={editingTask.text}
                onChange={(e) => setEditingTask(et => ({ ...et, text: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); } }}
                style={{ minHeight: 70, resize: 'vertical', font: 'inherit', fontSize: 14 }}
              />
              {(editBucket === 'today' || editBucket === 'upcoming') && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Due date</div>
                  <input
                    type="date"
                    className="input"
                    value={editingTask.due || ''}
                    onChange={(e) => setEditingTask(et => ({ ...et, due: e.target.value }))}
                  />
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setEditingTask(null)}>Cancel</button>
              <button className="btn dark" disabled={!editingTask.text.trim()} onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function addDaysIso(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const TASK_SWIPE_OPEN_X = -104;
const TASK_SWIPE_THRESHOLD = -36;

function TaskCard({ task, handleProps, isDragging, isOver, overBelow, onToggle, onRemove, onEdit, hideTodayChip }) {
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
    const dx = t.clientX - st.startX;
    const dy = t.clientY - st.startY;
    if (st.locked === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      st.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (st.locked !== 'x') return;
    e.preventDefault();
    setSwipeX(Math.min(0, Math.max(TASK_SWIPE_OPEN_X, st.openAt + dx)));
  }
  function onTouchEnd() {
    const st = swiping.current;
    swiping.current = null;
    if (!st || st.locked !== 'x') return;
    setSwipeX(swipeX <= TASK_SWIPE_THRESHOLD ? TASK_SWIPE_OPEN_X : 0);
  }
  function closeSwipe() { setSwipeX(0); }

  const rowCls = [
    'item-row task-card',
    task.done ? 'done' : '',
    isDragging ? 'reorder-dragging' : '',
    isOver ? `reorder-over ${overBelow ? 'reorder-over-below' : ''}` : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rowCls} data-reorder-id={task.id}>
      <div className="item-swipe-actions">
        <button className="item-swipe-btn edit" onClick={() => { onEdit(); closeSwipe(); }}>
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
            <path d="M8.5 1.5l2 2-6.5 6.5-2.3.3.3-2.3 6.5-6.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
          </svg>
        </button>
        <button className="item-swipe-btn delete" onClick={() => { onRemove(); closeSwipe(); }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      <div
        className="item-swipe-body"
        style={{ transform: `translateX(${swipeX}px)`, alignItems: 'flex-start' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <span className="reorder-handle" draggable="false" {...handleProps} title="Drag to reorder">⠿</span>
        <Checkbox checked={task.done} onClick={onToggle} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="task-text" dir={isRTL(task.text) ? 'rtl' : 'ltr'}>{task.text}</div>
          {task.due && !hideTodayChip && <DueChip due={task.due} />}
        </div>
        <button className="item-action-btn edit" onClick={onEdit} title="Edit">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8.5 1.5l2 2-6.5 6.5-2.3.3.3-2.3 6.5-6.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
          </svg>
        </button>
        <button className="item-action-btn delete" onClick={onRemove} title="Delete">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

function TaskCol({ color, title, sub, tasks, bucketId, showDate, onAdd, onToggle, onRemove, onEdit, onMove, onReorder }) {
  const [hover, setHover] = React.useState(false);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [draftText, setDraftText] = React.useState('');
  const [draftDue, setDraftDue] = React.useState('');
  const { getHandleProps, dragState } = useReorder(tasks, onReorder);

  function submit() {
    const text = draftText.trim();
    if (!text) return;
    let due = null;
    if (showDate) due = draftDue || (bucketId === 'today' ? today() : addDaysIso(3));
    onAdd(text, due);
    setDraftText('');
    setDraftDue('');
    setShowAddModal(false);
  }

  return (
    <div
      className="task-col"
      style={{ background: CAT_COLOR_BG[color], outline: hover ? '2px dashed rgba(0,0,0,0.3)' : 'none' }}
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        setHover(false);
        const id = e.dataTransfer.getData('text/task-id');
        if (id) onMove(id, bucketId);
      }}
    >
      <div className="task-col-head">
        <div className="task-col-title">{title}</div>
        <div className="task-col-sub">{tasks.filter(t => !t.done).length} · {sub}</div>
      </div>

      <div className="task-col-body">
        {tasks.length === 0 && <div className="empty" style={{ opacity: 0.5 }}>—</div>}
        {tasks.map(t => {
          const isDragging = dragState.draggingId === t.id;
          const isOver = dragState.overId === t.id && !isDragging;
          const overBelow = isOver && tasks.findIndex(x => x.id === t.id) > tasks.findIndex(x => x.id === dragState.draggingId);
          return (
            <TaskCard
              key={t.id}
              task={t}
              handleProps={getHandleProps(t.id)}
              isDragging={isDragging}
              isOver={isOver}
              overBelow={overBelow}
              hideTodayChip={bucketId === 'today'}
              onToggle={() => onToggle(t.id)}
              onRemove={() => onRemove(t.id)}
              onEdit={() => onEdit(t)}
            />
          );
        })}
      </div>

      <div className="add-col-btn-row">
        <button className="add-col-btn" onClick={() => setShowAddModal(true)}>+ Add task</button>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Add to {title}</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              <textarea
                autoFocus
                className="input"
                placeholder="What needs doing?"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                style={{ minHeight: 70, resize: 'vertical', font: 'inherit', fontSize: 14 }}
              />
              {showDate && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                    Due date {bucketId === 'today' ? '(empty = today)' : '(empty = in 3 days)'}
                  </div>
                  <input type="date" className="input" value={draftDue} onChange={(e) => setDraftDue(e.target.value)} />
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn dark" disabled={!draftText.trim()} onClick={submit}>+ Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Tasks });
