/* Editor UI, state management, meters, persistence. */
(function () {
  'use strict';
  const M = window.Metrics, R = window.Rich, S = window.Sample;
  const STORE = 'resumeBuilder.v1';

  // ------------------------------------------------------------------ state
  let state = load() || S.sample();
  let lastInfo = null;
  let meters = [];                      // {id, kind, el, src(), extraW()}

  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) return null;
      const st = JSON.parse(raw);
      if (!st || !Array.isArray(st.sections)) return null;
      st.settings = Object.assign(S.defaultSettings(), st.settings || {});
      st.header = st.header || { name: '', contacts: [] };
      return st;
    } catch (e) { return null; }
  }
  let saveT;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* ignore */ } }, 250);
  }

  // ---------------------------------------------------------------- helpers
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v;
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
    return e;
  }
  const ICON = {
    drag: '<svg viewBox="0 0 16 16" width="14" height="14"><g fill="currentColor"><circle cx="5" cy="3" r="1.3"/><circle cx="11" cy="3" r="1.3"/><circle cx="5" cy="8" r="1.3"/><circle cx="11" cy="8" r="1.3"/><circle cx="5" cy="13" r="1.3"/><circle cx="11" cy="13" r="1.3"/></g></svg>',
    eye: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.9 17.9A10.4 10.4 0 0 1 12 19c-7 0-11-7-11-7a19.8 19.8 0 0 1 5.1-5.9M9.9 5.2A9.6 9.6 0 0 1 12 5c7 0 11 7 11 7a19.6 19.6 0 0 1-2.2 3.2"/><path d="M1 1l22 22"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>',
  };
  const iconBtn = (icon, title, onclick, cls) => h('button', { class: 'icon-btn ' + (cls || ''), type: 'button', title, 'aria-label': title, html: ICON[icon], onclick });

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function reId(o) {           // fresh ids for duplicates
    if (Array.isArray(o)) return o.forEach(reId);
    if (o && typeof o === 'object') {
      if (o.id) o.id = S.uid(o.id[0]);
      Object.values(o).forEach(v => typeof v === 'object' && reId(v));
    }
  }

  function findOwner(id) {
    for (const s of state.sections) {
      if (s.id === id) return s;
      for (const e of s.entries) if (e.id === id) return e;
    }
    return null;
  }

  // ------------------------------------------------------------ toast/undo
  let toastT;
  function toast(msg, undoSnapshot) {
    const t = document.getElementById('toast');
    t.innerHTML = '';
    t.append(h('span', null, msg));
    if (undoSnapshot) {
      t.append(h('button', { type: 'button', onclick: () => { t.hidden = true; if (typeof undoSnapshot === 'function') undoSnapshot(); else { state = undoSnapshot; full(); } } }, 'Undo'));
    }
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => (t.hidden = true), 6000);
  }
  // ------------------------------------------------- recently deleted (persists)
  const TRASH = 'resumeBuilder.trash';
  let trash = [];
  try { trash = JSON.parse(localStorage.getItem(TRASH)) || []; } catch (e) { trash = []; }
  function saveTrash() { try { localStorage.setItem(TRASH, JSON.stringify(trash.slice(0, 60))); } catch (e) { /* ignore */ } }

  function locate(arr) {
    if (arr === state.sections) return { ownerId: null, key: 'sections' };
    if (state.header && arr === state.header.contacts) return { ownerId: 'header', key: 'contacts' };
    for (const sc of state.sections) {
      for (const k of ['entries', 'bullets', 'rows']) if (sc[k] === arr) return { ownerId: sc.id, key: k, ownerTitle: sc.title };
      for (const en of sc.entries || []) if (en.bullets === arr) return { ownerId: en.id, key: 'bullets', ownerTitle: R.plain(en.title || '') || sc.title };
    }
    return null;
  }
  function preview(t) {
    const it = t.item;
    const txt = t.key === 'sections' ? it.title : t.key === 'entries' ? R.plain(it.title || '') : t.key === 'rows' ? it.label : it.text;
    return (R.plain(txt || '') || 'Untitled').trim();
  }
  function removeWithUndo(arr, item, label) {
    const loc = locate(arr);
    const index = arr.indexOf(item);
    arr.splice(index, 1);
    const isEmpty = !JSON.stringify(item).replace(/"(id|collapsed|visible|type)":("[^"]*"|true|false)/g, '').match(/"[^"]+":"[^"]+"/);
    let tid = null;
    if (loc && !isEmpty) {
      tid = S.uid('t');
      trash.unshift(Object.assign({ tid, label, item, index, at: Date.now() }, loc));
      saveTrash();
    }
    full();
    if (tid) toast(label + ' moved to Recently deleted', () => restore(tid));
    else toast(label + ' deleted');
  }
  function restore(tid) {
    const t = trash.find(x => x.tid === tid); if (!t) return;
    let arr;
    if (t.ownerId === null) arr = state.sections;
    else if (t.ownerId === 'header') arr = state.header.contacts;
    else { const o = findOwner(t.ownerId); arr = o && o[t.key]; }
    if (!arr) return toast('Restore “' + (t.ownerTitle || 'its parent') + '” first — it was deleted too');
    arr.splice(Math.min(t.index, arr.length), 0, t.item);
    trash = trash.filter(x => x !== t); saveTrash();
    document.getElementById('toast').hidden = true;
    full();
    const el = editor.querySelector('[data-id="' + t.item.id + '"]');
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash-card'); setTimeout(() => el.classList.remove('flash-card'), 1200); }
  }
  function trashCard() {
    if (!trash.length) return null;
    const ago = (ms) => { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
    const card = h('div', { class: 'card trash' + (state.settings._trashOpen ? '' : ' collapsed'), id: 'trashCard' });
    const head = h('div', { class: 'card-head', onclick: () => { state.settings._trashOpen = !state.settings._trashOpen; card.classList.toggle('collapsed'); save(); } },
      h('div', { class: 'card-title' }, 'Recently deleted'),
      h('div', { class: 'card-sub' }, trash.length + ' item' + (trash.length > 1 ? 's' : '') + ' · kept after refresh until you restore or remove them'),
      h('span', { class: 'chev', html: ICON.chev }));
    const body = h('div', { class: 'card-body' });
    trash.forEach(t => body.append(h('div', { class: 'trash-row' },
      h('div', { class: 'tr-main' },
        h('div', { class: 'tr-t' }, preview(t)),
        h('div', { class: 'tr-s' }, t.label.replace(/ “.*”$/, '') + (t.ownerTitle && t.key !== 'sections' ? ' in ' + R.plain(t.ownerTitle) : '') + ' · ' + ago(t.at))),
      h('button', { class: 'btn small', type: 'button', onclick: () => restore(t.tid) }, 'Restore'),
      iconBtn('x', 'Remove permanently', () => {
        if (!confirm('Permanently remove “' + preview(t).slice(0, 60) + '”? This cannot be undone.')) return;
        trash = trash.filter(x => x !== t); saveTrash(); full();
      }))));
    body.append(h('button', { class: 'btn small ghost', type: 'button', onclick: () => {
      if (!confirm('Permanently remove all ' + trash.length + ' deleted items? This cannot be undone.')) return;
      trash = []; saveTrash(); full();
    } }, 'Empty Recently deleted'));
    card.append(head, body);
    return card;
  }

  // ------------------------------------------------------------- rich input
  function wrapSel(ta, kind) {
    const mark = kind === 'b' ? '**' : '*';
    const { selectionStart: a, selectionEnd: b, value: v } = ta;
    const sel = v.slice(a, b) || (kind === 'b' ? 'bold' : 'italic');
    ta.value = v.slice(0, a) + mark + sel + mark + v.slice(b);
    ta.focus();
    ta.selectionStart = a + mark.length; ta.selectionEnd = a + mark.length + sel.length;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function insertAt(ta, str) {
    const { selectionStart: a, selectionEnd: b, value: v } = ta;
    ta.value = v.slice(0, a) + str + v.slice(b);
    ta.focus();
    ta.selectionStart = ta.selectionEnd = a + str.length;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function richKeys(e, ta) {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && (e.key === 'b' || e.key === 'i')) { e.preventDefault(); wrapSel(ta, e.key); }
  }
  function noEnter(e) { if (e.key === 'Enter') e.preventDefault(); }   // single-line fields that wrap visually
  function autoGrow(ta) {
    if (!ta.clientWidth) return;                 // hidden (collapsed): measure when it becomes visible
    ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px';
  }
  // re-measure whenever a text box is shown (entry expanded) or its width changes (pane resized)
  const growObs = new ResizeObserver((list) => {
    for (const e of list) { const ta = e.target; if (ta._w !== ta.clientWidth) { ta._w = ta.clientWidth; autoGrow(ta); } }
  });

  /** text input bound to obj[key]; optional meter */
  function field(obj, key, opts) {
    opts = opts || {};
    const multi = !!opts.multi;
    const inp = h(multi ? 'textarea' : 'input', {
      class: 'inp' + (opts.rich ? ' rich' : '') + (opts.cls ? ' ' + opts.cls : ''),
      placeholder: opts.ph || '', value: obj[key] || '', rows: multi ? (opts.rows || 1) : null,
      spellcheck: 'true', 'aria-label': opts.label || opts.ph || key,
    });
    inp.addEventListener('input', () => {
      obj[key] = inp.value;
      if (multi) autoGrow(inp);
      if (opts.onInput) opts.onInput(inp.value);
      update();
    });
    if (opts.rich) inp.addEventListener('keydown', (e) => richKeys(e, inp));
    if (opts.keydown) inp.addEventListener('keydown', (e) => opts.keydown(e, inp));
    if (multi) { growObs.observe(inp); requestAnimationFrame(() => autoGrow(inp)); }
    const wrap = h('div', { class: 'field' + (opts.grow ? ' grow' : '') });
    if (opts.label) wrap.append(h('label', { class: 'lbl' }, opts.label));
    wrap.append(inp);
    if (opts.meter && opts.meter.kind === 'bullet') {     // character meter only on bullet lines
      const m = h('div', { class: 'meter' });
      wrap.append(m);
      meters.push({ id: opts.meter.id, kind: opts.meter.kind, el: m, src: () => obj[key] || '', ctx: opts.meter.ctx, input: inp });
    }
    return wrap;
  }

  // ------------------------------------------------------------- the editor
  const editor = document.getElementById('editor');

  function full() {           // rebuild editor + preview
    const scroll = editor.scrollTop;
    buildEditor();
    editor.scrollTop = scroll;
    update(true);
  }

  function buildEditor() {
    meters = [];
    editor.innerHTML = '';
    editor.append(setupCard());
    const list = h('div', { class: 'sec-list', id: 'secList' });
    state.sections.forEach(sec => list.append(sectionCard(sec)));
    editor.append(list);
    editor.append(addSectionBar());
    const tc = trashCard(); if (tc) editor.append(tc);
    Sortable.create(list, {
      handle: '.sec-head .drag', animation: 160, ghostClass: 'drag-ghost',
      onEnd: (ev) => { const [it] = state.sections.splice(ev.oldIndex, 1); state.sections.splice(ev.newIndex, 0, it); update(); },
    });
  }

  // ---- page setup
  function setupCard() {
    const s = state.settings;
    const card = h('div', { class: 'card setup' + (s._setupOpen ? '' : ' collapsed'), id: 'setupCard' });
    const head = h('div', { class: 'card-head', onclick: () => { s._setupOpen = !s._setupOpen; card.classList.toggle('collapsed'); save(); } },
      h('div', { class: 'card-title' }, 'Page & header'),
      h('div', { class: 'card-sub' }, s.topMode === 'reserved' ? 'Institute header space · ' + s.reservedTopMm + ' mm' : 'Personal header'),
      h('span', { class: 'chev', html: ICON.chev }));
    const body = h('div', { class: 'card-body' });

    const radio = (val, title, sub) => h('label', { class: 'radio-card' + (s.topMode === val ? ' on' : '') },
      h('input', { type: 'radio', name: 'topMode', value: val, checked: s.topMode === val, onchange: () => { s.topMode = val; full(); } }),
      h('div', null, h('div', { class: 'rc-t' }, title), h('div', { class: 'rc-s' }, sub)));
    body.append(h('div', { class: 'lbl' }, 'Top of page 1'),
      h('div', { class: 'radio-row' },
        radio('reserved', 'Reserve blank space', 'For a pre-printed institute / placement-office header (53.09 mm)'),
        radio('header', 'Name & contact header', 'Print your name and contact details at the top')));

    if (s.topMode === 'reserved') {
      body.append(h('div', { class: 'row' }, numField(s, 'reservedTopMm', 'Reserved height (mm)', 0, 120, 0.01)));
    } else {
      const hd = state.header;
      body.append(h('div', { class: 'row' },
        field(hd, 'name', { label: 'Full name', ph: 'e.g. Priya Sharma', grow: true, rich: true }),
        numField(s, 'headerTopMm', 'Top margin (mm)', 4, 60, 0.5)));
      const cl = h('div', { class: 'contacts' });
      hd.contacts.forEach(c => cl.append(h('div', { class: 'contact-row' },
        field(c, 'text', { ph: 'email · phone · link', grow: true }),
        iconBtn('x', 'Remove', () => removeWithUndo(hd.contacts, c, 'Contact')))));
      body.append(h('div', { class: 'lbl' }, 'Contact items (shown on one line, separated by |)'), cl,
        h('button', { class: 'btn small ghost', type: 'button', html: ICON.plus + ' Add contact item', onclick: () => { hd.contacts.push({ id: S.uid('c'), text: '' }); full(); } }));
    }

    body.append(
      h('div', { class: 'row' },
        selField('Page limit', s.maxPages, [[1, '1 page'], [2, '2 pages'], [3, '3 pages']], v => (s.maxPages = +v)),
        selField('Target lines per bullet', s.bulletLines, [[1, '1 line (template)'], [2, 'Up to 2 lines']], v => (s.bulletLines = +v)),
        selField('Max bullets per entry', s.maxBullets | 0, [[3, '3'], [4, '4 (recommended)'], [5, '5'], [6, '6'], [0, 'No limit']], v => (s.maxBullets = +v))),
      h('div', { class: 'row' },
        numField(s, 'bottomMm', 'Bottom margin (mm)', 2, 40, 0.5),
        numField(s, 'contTopMm', 'Top margin, page 2+ (mm)', 4, 60, 0.5),
        h('div', { class: 'field' }, h('label', { class: 'lbl' }, 'Heading colour'),
          h('div', { class: 'color-row' },
            h('input', { type: 'color', value: s.accent, oninput: (e) => { s.accent = e.target.value; update(); } }),
            h('button', { class: 'btn small ghost', type: 'button', onclick: () => { s.accent = '#4169E1'; full(); } }, 'RoyalBlue')))),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.guides, onchange: (e) => { s.guides = e.target.checked; update(); } }), ' Show margin guides in preview (never printed)'));
    card.append(head, body);
    return card;
  }
  function numField(obj, key, label, min, max, step) {
    return h('div', { class: 'field num' }, h('label', { class: 'lbl' }, label),
      h('input', { class: 'inp', type: 'number', min, max, step, value: obj[key], oninput: (e) => {
        const v = parseFloat(e.target.value); if (!isNaN(v)) { obj[key] = Math.min(max, Math.max(min, v)); update(); }
      } }));
  }
  function selField(label, val, opts, set) {
    return h('div', { class: 'field' }, h('label', { class: 'lbl' }, label),
      h('select', { class: 'inp', onchange: (e) => { set(e.target.value); update(); } },
        opts.map(([v, t]) => h('option', { value: v, selected: String(v) === String(val) }, t))));
  }

  // ---- sections
  function sectionCard(sec) {
    const card = h('div', { class: 'card sec' + (sec.collapsed ? ' collapsed' : '') + (sec.visible ? '' : ' hidden-sec'), 'data-id': sec.id });
    const titleField = field(sec, 'title', { ph: 'Section heading', cls: 'sec-title', rich: false, meter: { id: sec.id + ':title', kind: 'sec' } });
    const eye = iconBtn(sec.visible ? 'eye' : 'eyeOff', sec.visible ? 'Hide from resume' : 'Show in resume', () => {
      sec.visible = !sec.visible; full();
    });
    const typeSel = h('select', { class: 'type-sel', title: 'Section layout', onchange: (e) => {
      sec.type = e.target.value;
      if (sec.type === 'entries' && !sec.entries.length) sec.entries.push(S.newEntry());
      if (sec.type === 'bullets' && !sec.bullets.length) sec.bullets.push(S.newBullet());
      if (sec.type === 'table' && !sec.rows.length) sec.rows.push({ id: S.uid('r'), label: '', value: '' });
      full();
    } }, Object.entries(S.TYPES).map(([k, t]) => h('option', { value: k, selected: k === sec.type, title: t.hint }, t.label)));

    const head = h('div', { class: 'sec-head' },
      h('span', { class: 'drag', title: 'Drag to reorder', html: ICON.drag }),
      titleField,
      typeSel,
      eye,
      iconBtn('copy', 'Duplicate section', () => {
        const c = clone(sec); reId(c); c.title += ' (copy)';
        state.sections.splice(state.sections.indexOf(sec) + 1, 0, c); full();
      }),
      iconBtn('trash', 'Delete section', () => removeWithUndo(state.sections, sec, 'Section “' + (sec.title || 'Untitled') + '”')),
      h('button', { class: 'icon-btn chev', type: 'button', title: 'Collapse', html: ICON.chev, onclick: () => { sec.collapsed = !sec.collapsed; card.classList.toggle('collapsed'); save(); } }));
    const body = h('div', { class: 'sec-body' });

    if (sec.type === 'entries') {
      const list = h('div', { class: 'entry-list', 'data-owner': sec.id });
      sec.entries.forEach(en => list.append(entryCard(sec, en)));
      body.append(list, h('button', { class: 'btn small ghost add', type: 'button', html: ICON.plus + ' Add entry', onclick: () => {
        sec.entries.push(S.newEntry()); full();
      } }));
      Sortable.create(list, { group: 'entries', handle: '.entry-head .drag', animation: 160, ghostClass: 'drag-ghost', onEnd: moveBetween('entries') });
    } else if (sec.type === 'bullets') {
      body.append(bulletList(sec));
    } else if (sec.type === 'table') {
      const list = h('div', { class: 'row-list', 'data-owner': sec.id });
      sec.rows.forEach(r => list.append(h('div', { class: 'table-row' },
        h('span', { class: 'drag', title: 'Drag to reorder', html: ICON.drag }),
        field(r, 'label', { ph: 'Label (e.g. Languages)', cls: 'tbl-label', rich: true, multi: true, keydown: noEnter }),
        field(r, 'value', { ph: 'Comma-separated items', grow: true, rich: true, multi: true, meter: { id: r.id + ':value', kind: 'table' } }),
        iconBtn('x', 'Remove row', () => removeWithUndo(sec.rows, r, 'Row')))));
      body.append(list, h('button', { class: 'btn small ghost add', type: 'button', html: ICON.plus + ' Add row', onclick: () => {
        sec.rows.push({ id: S.uid('r'), label: '', value: '' }); full();
      } }));
      Sortable.create(list, { group: 'rows', handle: '.drag', animation: 160, ghostClass: 'drag-ghost', onEnd: moveBetween('rows') });
    } else if (sec.type === 'text') {
      body.append(field(sec, 'text', { ph: 'A short paragraph…', multi: true, rows: 3, rich: true, meter: { id: sec.id + ':text', kind: 'text' } }));
    }
    card.append(head, body);
    return card;
  }

  function moveBetween(kind) {
    return (ev) => {
      const from = findOwner(ev.from.dataset.owner), to = findOwner(ev.to.dataset.owner);
      if (!from || !to) return full();
      const [it] = from[kind].splice(ev.oldIndex, 1);
      to[kind].splice(ev.newIndex, 0, it);
      if (from !== to) full(); else update();
    };
  }

  function entryCard(sec, en) {
    const summary = h('div', { class: 'entry-sum' });
    const setSum = () => {
      summary.innerHTML = '';
      summary.append(h('span', { class: 'es-t' }, R.plain(en.title) || 'Untitled entry'), en.date ? h('span', { class: 'es-d' }, en.date) : '');
    };
    setSum();
    const card = h('div', { class: 'entry' + (en.collapsed ? ' collapsed' : '') + (en.visible === false ? ' hidden-sec' : ''), 'data-id': en.id });
    const head = h('div', { class: 'entry-head' },
      h('span', { class: 'drag', title: 'Drag to reorder', html: ICON.drag }),
      h('button', { class: 'entry-toggle', type: 'button', onclick: () => { en.collapsed = !en.collapsed; card.classList.toggle('collapsed'); save(); } }, summary,
        h('span', { class: 'chev', html: ICON.chev })),
      iconBtn(en.visible === false ? 'eyeOff' : 'eye', en.visible === false ? 'Show in resume' : 'Hide from resume', () => { en.visible = en.visible === false; full(); }),
      iconBtn('copy', 'Duplicate entry', () => { const c = clone(en); reId(c); sec.entries.splice(sec.entries.indexOf(en) + 1, 0, c); full(); }),
      iconBtn('trash', 'Delete entry', () => removeWithUndo(sec.entries, en, 'Entry')));
    const body = h('div', { class: 'entry-body' },
      h('div', { class: 'row' },
        field(en, 'title', { label: 'Title (bold)', ph: 'Role, Organisation  ·  or project name', grow: true, rich: true, multi: true, keydown: noEnter, onInput: setSum, meter: { id: en.id + ':title', kind: 'title', ctx: en } }),
        field(en, 'date', { label: 'Date', ph: 'May 2026 - Jul 2026', cls: 'date-inp', onInput: () => { setSum(); } })),
      field(en, 'extra', { label: 'Extra detail after title (normal weight, optional)', ph: 'e.g. , Bengaluru', rich: true, multi: true, keydown: noEnter }),
      field(en, 'subtitle', { label: 'Sub-line (slanted, optional)', ph: 'One-line context: team, guide, course, tech stack…', rich: true, multi: true, keydown: noEnter, meter: { id: en.id + ':subtitle', kind: 'sub' } }),
      h('div', { class: 'lbl' }, 'Bullet points'),
      bulletList(en));
    card.append(head, body);
    return card;
  }

  // ---- keep bullets to what the page can hold cleanly
  function isEntry(owner) { return state.sections.some(sc => (sc.entries || []).includes(owner)); }
  function bulletGate(owner) {
    const s = state.settings, n = owner.bullets.filter(b => R.plain(b.text).trim()).length;
    const cap = isEntry(owner) ? (s.maxBullets | 0) : 0;
    if (cap && n >= cap) return { ok: false, n, cap, why: 'This entry already has ' + n + ' bullets (limit ' + cap + '). Keep the strongest ones — or change the limit in Format → Max bullets per entry.' };
    const info = lastInfo;
    if (info && !info.empty) {
      if (info.pages > info.limit) return { ok: false, n, cap, why: 'The resume is already over the ' + info.limit + '-page limit. Trim or hide something before adding more bullets.' };
      if (info.baseFree < 1) return { ok: false, n, cap, why: 'The page is full — another bullet would push content onto page ' + (info.pages + 1) + '. Replace a weaker bullet instead.' };
    }
    return { ok: true, n, cap };
  }
  function flashGate(id) {
    const el = editor.querySelector('[data-gate="' + id + '"]');
    if (el) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
  }
  function updateGates() {
    editor.querySelectorAll('.add-bullet').forEach(btn => {
      const owner = findOwner(btn.dataset.owner); if (!owner) return;
      const g = bulletGate(owner);
      const note = editor.querySelector('[data-gate="' + owner.id + '"]');
      btn.classList.toggle('blocked', !g.ok);
      btn.title = g.ok ? 'Add a bullet (Enter in a bullet also adds one)' : g.why;
      let txt = '', cls = 'gate-note';
      if (g.cap) { txt = g.n + ' / ' + g.cap + ' bullets'; if (g.n > g.cap) { cls += ' over'; txt += ' — remove ' + (g.n - g.cap) + ' to keep it clean'; } }
      if (!g.ok && !(g.cap && g.n >= g.cap)) { txt = (txt ? txt + ' · ' : '') + (lastInfo.pages > lastInfo.limit ? 'over page limit' : 'page full'); cls += ' full'; }
      else if (g.ok && lastInfo && lastInfo.baseFree <= 2 && !lastInfo.empty) { txt = (txt ? txt + ' · ' : '') + 'room for ' + lastInfo.baseFree + ' more line' + (lastInfo.baseFree === 1 ? '' : 's'); cls += ' low'; }
      if (note) { note.className = cls; note.textContent = txt; }
    });
  }

  function bulletList(owner) {
    const wrap = h('div', { class: 'bullets' });
    const list = h('div', { class: 'bullet-list', 'data-owner': owner.id });
    const addAfter = (b, focus) => {
      const blank = owner.bullets.find(x => !R.plain(x.text).trim() && x !== b);
      if (blank) { focusBullet(blank.id); return; }          // reuse an empty bullet instead of stacking blanks
      const g = bulletGate(owner);
      if (!g.ok) { toast(g.why); flashGate(owner.id); return; }
      const nb = S.newBullet();
      owner.bullets.splice(b ? owner.bullets.indexOf(b) + 1 : owner.bullets.length, 0, nb);
      full();
      if (focus) focusBullet(nb.id);
    };
    owner.bullets.forEach(b => {
      const row = h('div', { class: 'bullet-row', 'data-id': b.id },
        h('span', { class: 'drag', title: 'Drag to reorder', html: ICON.drag }),
        h('span', { class: 'bdot' }, '•'),
        field(b, 'text', { ph: 'Action verb + what you did + measurable result', multi: true, grow: true, rich: true, meter: { id: b.id, kind: 'bullet' },
          keydown: (e, ta) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addAfter(b, true); }
            else if (e.key === 'Backspace' && ta.value === '' && owner.bullets.length > 1) {
              e.preventDefault();
              const i = owner.bullets.indexOf(b);
              owner.bullets.splice(i, 1);
              const prev = owner.bullets[Math.max(0, i - 1)];
              full();
              focusBullet(prev.id, true);
            }
          } }),
        iconBtn('x', 'Remove bullet', () => removeWithUndo(owner.bullets, b, 'Bullet')));
      list.append(row);
    });
    Sortable.create(list, { group: 'bullets', handle: '.drag', animation: 160, ghostClass: 'drag-ghost', onEnd: moveBetween('bullets') });
    wrap.append(list, h('div', { class: 'add-row' },
      h('button', { class: 'btn small ghost add add-bullet', type: 'button', 'data-owner': owner.id, html: ICON.plus + ' Add bullet', onclick: () => addAfter(null, true) }),
      h('span', { class: 'gate-note', 'data-gate': owner.id })));
    return wrap;
  }

  function focusBullet(id, end) {
    const ta = editor.querySelector('.bullet-row[data-id="' + id + '"] textarea');
    if (ta) { ta.focus(); if (end) ta.selectionStart = ta.selectionEnd = ta.value.length; }
  }

  function addSectionBar() {
    const menu = h('div', { class: 'preset-menu', hidden: true },
      h('div', { class: 'pm-title' }, 'Common sections — rename freely'),
      h('div', { class: 'pm-grid' }, S.PRESETS.map(p => h('button', { type: 'button', onclick: () => addSection(p.title, p.type) },
        h('span', null, p.title), h('small', null, S.TYPES[p.type].label)))),
      h('div', { class: 'pm-title' }, 'Custom section'),
      h('div', { class: 'pm-grid' }, Object.entries(S.TYPES).map(([k, t]) => h('button', { type: 'button', onclick: () => addSection('New Section', k) },
        h('span', null, t.label), h('small', null, t.hint)))));
    const btn = h('button', { class: 'btn add-sec', type: 'button', html: ICON.plus + ' Add section', onclick: () => { menu.hidden = !menu.hidden; } });
    return h('div', { class: 'add-sec-wrap', id: 'addSecWrap' }, btn, menu);
  }
  function addSection(title, type) {
    const sec = S.newSection(title, type);
    if (type === 'entries') sec.entries.push(S.newEntry());
    if (type === 'bullets') sec.bullets.push(S.newBullet());
    if (type === 'table') sec.rows.push({ id: S.uid('r'), label: '', value: '' });
    state.sections.push(sec);
    if (pane === 'preview') setPane('split');
    full();
    const card = editor.querySelector('.card.sec[data-id="' + sec.id + '"]');
    if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); const i = card.querySelector('.sec-title'); if (i) { i.focus(); i.select(); } }
  }

  // ---------------------------------------------------------------- meters
  function availWidth(m) {
    const W = M.PAGE.textW;
    switch (m.kind) {
      case 'bullet': return { style: 'body', A: W - M.BULLET_INDENT, target: state.settings.bulletLines };
      case 'title': {
        const d = m.ctx && m.ctx.date ? M.width('(' + m.ctx.date + ')', 'date') + 11.955 + 4.23 : 0;
        const ex = m.ctx && m.ctx.extra ? M.width(' ' + m.ctx.extra, 'title') * 0.92 : 0;
        return { style: 'title', A: W - d - ex, target: 1 };
      }
      case 'sub': return { style: 'sub', A: W, target: 1 };
      case 'sec': return { style: 'sec', A: W - 2 * (11.955 + 18), target: 1 };
      case 'table': return { style: 'body', A: M.TABLE_VALUE_W, target: 1 };
      default: return { style: 'body', A: W, target: 0 };
    }
  }

  function measure(m) {
    const src = m.src();
    const text = R.plain(src);
    const C = [...text].length;
    const { style, A, target } = availWidth(m);
    const W = C ? M.width(src, style) : 0;
    const ref = M.refAvg(style);
    const avg = C >= 24 ? W / C : (W + ref * (24 - C)) / 24;   // blend for short inputs
    const perLine = A / avg;
    const lines = lastInfo && lastInfo.lines[m.id] != null ? lastInfo.lines[m.id] : Math.max(1, Math.ceil(W / A));
    const tgt = target || Math.max(1, lines);
    const rec = Math.floor(perLine * tgt);
    const lastChars = lines > 1 ? Math.max(0, C - Math.floor(perLine * (lines - 1))) : C;
    return { C, W, A, perLine, lines, rec, remain: rec - C, lastChars, target };
  }

  function updateMeters() {
    for (const m of meters) {
      if (!m.el.isConnected) continue;
      const r = measure(m);
      let cls = 'ok', note = '';
      if (r.C === 0) { cls = 'empty'; }
      else if (r.target && r.lines > r.target) {
        cls = 'over';
        note = m.kind === 'bullet'
          ? (r.lastChars <= r.perLine * 0.35 ? 'Spills ~' + r.lastChars + ' chars onto line ' + r.lines + ' — trim ' + (r.C - r.rec) + ' to fit' : 'Runs to ' + r.lines + ' lines — trim ' + (r.C - r.rec) + ' chars')
          : 'Wraps to ' + r.lines + ' lines — trim ' + (r.C - r.rec) + ' chars';
      } else if (r.lines > 1 && r.lastChars < r.perLine * 0.3) {
        cls = 'warn'; note = 'Last line holds only ~' + r.lastChars + ' chars — trim them to save a line';
      } else if (r.remain < 0) {
        cls = 'tight'; note = 'Fits on one line by tightening word spacing slightly, as LaTeX does';
      } else if (m.kind === 'bullet' && r.target === 1 && r.remain > r.perLine * 0.45) {
        cls = 'short'; note = 'Room for ~' + r.remain + ' more chars on this line';
      }
      const pct = r.rec ? Math.min(100, Math.round((r.C / r.rec) * 100)) : 0;
      m.el.className = 'meter ' + cls;
      if (m.kind === 'text') {
        m.el.innerHTML = '<span class="mt">' + r.C + ' chars · ≈' + r.lines + ' line' + (r.lines > 1 ? 's' : '') + ' · ~' + Math.floor(r.perLine) + ' chars per line</span>';
        continue;
      }
      m.el.innerHTML =
        '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
        '<span class="mt">Recommended <b>' + r.rec + '</b> · Current <b>' + r.C + '</b> · ' +
        (r.remain >= 0 ? 'Remaining <b>' + r.remain + '</b>' : '<b>' + (-r.remain) + '</b> over') +
        ' · ≈' + r.lines + ' line' + (r.lines > 1 ? 's' : '') + '</span>' +
        (note ? '<span class="mn">' + note + '</span>' : '');
      m.el.title = 'Available width ' + r.A.toFixed(1) + 'pt · this text averages ' + (r.C ? (r.W / r.C).toFixed(2) : '–') + 'pt per character → ~' + r.perLine.toFixed(0) + ' characters per line';
    }
  }

  // ---------------------------------------------------------- fit / advice
  function updateFit(info) {
    const fit = document.getElementById('fitStatus');
    const adv = document.getElementById('advice');
    const s = state.settings;
    const last = info.perPage[info.perPage.length - 1];
    const fillPct = Math.round(Math.min(1, Math.max(0, last.used / last.cap)) * 100);
    adv.innerHTML = ''; adv.hidden = true;
    if (info.empty) { fit.className = 'fit'; fit.textContent = 'Empty resume'; return; }

    if (info.pages > info.limit) {
      fit.className = 'fit bad';
      fit.innerHTML = '<b>Over the ' + info.limit + '-page limit</b> · ≈' + info.overLines + ' line' + (info.overLines > 1 ? 's' : '') + ' spill onto page ' + (info.limit + 1);
      const sugg = [];
      const cands = meters.filter(m => m.kind === 'bullet' && m.el.isConnected).map(m => ({ m, r: measure(m) }))
        .filter(x => x.r.lines > 1).sort((a, b) => a.r.lastChars - b.r.lastChars).slice(0, 5);
      cands.forEach(({ m, r }) => sugg.push(h('li', null, h('button', { type: 'button', class: 'link', onclick: () => jump(m) },
        'Trim ~' + (r.lastChars + 1) + ' chars from “' + R.plain(m.src()).slice(0, 48) + '…”'), ' saves 1 line')));
      const heavy = [];
      state.sections.forEach(sc => sc.visible && (sc.entries || []).forEach(en => {
        const n = en.visible === false ? 0 : en.bullets.filter(b => R.plain(b.text).trim()).length;
        if (n > 3) heavy.push({ en, n });
      }));
      heavy.sort((a, b) => b.n - a.n).slice(0, 2).forEach(({ en, n }) => sugg.push(h('li', null,
        h('button', { type: 'button', class: 'link', onclick: () => { en.collapsed = false; full(); const el = editor.querySelector('.entry[data-id="' + en.id + '"]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } },
          '“' + (R.plain(en.title) || 'Untitled').slice(0, 40) + '” has ' + n + ' bullets'), ' — drop the weakest one (saves a line)')));
      sugg.push(h('li', null, 'Hide less relevant entries or sections with the eye icon — they stay saved for other applications.'));
      if (info.limit < 3) sugg.push(h('li', null, h('button', { type: 'button', class: 'link', onclick: () => { s.maxPages = info.limit + 1; full(); } }, 'Allow ' + (info.limit + 1) + ' pages'), ' if a longer resume is acceptable.'));
      adv.append(h('div', { class: 'adv-t' }, 'How to get back to ' + info.limit + ' page' + (info.limit > 1 ? 's' : '') + ' without shrinking the text:'), h('ul', null, sugg));
      adv.className = 'advice bad'; adv.hidden = false;
    } else {
      fit.className = 'fit ' + (info.freeLines > 6 ? 'warn' : 'good');
      fit.innerHTML = '<b>' + info.pages + ' of ' + info.limit + ' page' + (info.limit > 1 ? 's' : '') + '</b> · last page ' + fillPct + '% full · ≈' + info.freeLines + ' line' + (info.freeLines === 1 ? '' : 's') + ' free' +
        (info.extra ? ' · gaps +' + info.extra.toFixed(1) + 'pt' : '');
      if (info.freeLines > 6) {
        adv.append(h('div', { class: 'adv-t' }, 'There is room for about ' + info.freeLines + ' more single-line bullets.'),
          h('ul', null, h('li', null, 'Add a bullet or entry to use the space.')));
        adv.className = 'advice warn'; adv.hidden = false;
      }
    }
  }
  function jump(m) {
    const card = m.el.closest('.entry'); if (card && card.classList.contains('collapsed')) card.classList.remove('collapsed');
    const sc = m.el.closest('.card.sec'); if (sc && sc.classList.contains('collapsed')) sc.classList.remove('collapsed');
    m.input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    m.input.focus();
    m.input.classList.add('flash'); setTimeout(() => m.input.classList.remove('flash'), 1200);
  }

  // ---------------------------------------------------------------- preview
  const pagesEl = document.getElementById('pages');
  const scaler = document.getElementById('pagesScaler');
  const scrollEl = document.getElementById('previewScroll');
  const measureRoot = document.getElementById('measureRoot');
  const zoomSel = document.getElementById('zoomSel');

  let raf = 0, ready = false, curZoom = 1;
  function update(now) {
    save();
    if (!ready) return;
    if (now === true) { cancelAnimationFrame(raf); raf = 0; return renderNow(); }
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; renderNow(); });
  }
  function renderNow() {
    state.settings.spacing = 'template';          // only the exact template spacing is offered
    lastInfo = Render.render(state, pagesEl, measureRoot);
    applyZoom();
    updateMeters();
    updateFit(lastInfo);
    syncChrome();
    syncPager();
    updateGates();
  }
  function applyZoom() {
    const pageW = 595.276 / 0.75;               // px
    let z = zoomSel.value === 'fit' ? Math.min(1.4, (scrollEl.clientWidth - 48) / pageW) : parseFloat(zoomSel.value);
    z = Math.max(0.3, z);
    curZoom = z;
    scaler.style.transform = 'scale(' + z + ')';
    scaler.style.width = pagesEl.offsetWidth * z + 'px';
    scaler.style.height = pagesEl.offsetHeight * z + 'px';
  }
  zoomSel.addEventListener('change', applyZoom);
  window.addEventListener('resize', () => { if (ready) applyZoom(); });

  // ------------------------------------------------------------ menus
  const pop = document.getElementById('menuPop');
  let popOwner = null;
  const ZOOMS = [['fit', 'Fit width'], ['0.5', '50%'], ['0.75', '75%'], ['1', '100%'], ['1.25', '125%'], ['1.5', '150%'], ['2', '200%']];

  function menuItems(name) {
    const s = state.settings, it = (label, run, o) => Object.assign({ label, run }, o || {});
    const set = (k, v) => () => { s[k] = v; full(); };
    switch (name) {
      case 'file': return [
        it('Load example resume', () => act('sample')),
        it('Start from blank', () => act('blank')),
        '-',
        it('Open JSON file…', () => act('import-json')),
        it('Save as JSON file', () => act('export-json')),
        '-',
        it('Download .tex', () => act('tex')),
        it('Download PDF', () => act('pdf'), { kbd: '⌘P' }),
        '-',
        it('Recently deleted', () => openTrash(), { small: trash.length ? String(trash.length) : 'empty' }),
      ];
      case 'export': return [
        it('Download PDF', () => act('pdf'), { small: 'print → Save as PDF' }),
        it('Download .tex', () => act('tex'), { small: 'LaTeX source' }),
        it('Save as JSON file', () => act('export-json'), { small: 'backup' }),
      ];
      case 'insert': return [
        { head: 'Common sections' },
        ...S.PRESETS.map(p => it(p.title, () => addSection(p.title, p.type), { small: S.TYPES[p.type].label })),
        ...(() => {
          const have = new Set(state.sections.map(x => R.plain(x.title).trim().toLowerCase()));
          const miss = S.sample().sections.map((x, i) => ({ x, i })).filter(o => !have.has(R.plain(o.x.title).trim().toLowerCase()));
          return miss.length ? ['-', { head: 'From example resume (with its content)' },
            ...miss.map(o => it(o.x.title, () => addExample(o.x, o.i), { small: S.TYPES[o.x.type].label }))] : [];
        })(),
        '-', { head: 'Custom section' },
        ...Object.entries(S.TYPES).map(([k, t]) => it(t.label, () => addSection('New Section', k))),
      ];
      case 'view': return [
        { head: 'Zoom' },
        ...ZOOMS.map(([v, t]) => it(t, () => { zoomSel.value = v; applyZoom(); }, { checked: zoomSel.value === v })),
        '-', { head: 'Panels' },
        it('Editor & preview', () => setPane('split'), { checked: pane === 'split' }),
        it('Editor only', () => setPane('editor'), { checked: pane === 'editor' }),
        it('Preview only', () => setPane('preview'), { checked: pane === 'preview' }),
        '-',
        it('Show margin guides', () => { s.guides = !s.guides; full(); }, { checked: s.guides }),
      ];
      case 'layout': return [
        it('Editor & preview', () => setPane('split'), { checked: pane === 'split' }),
        it('Editor only', () => setPane('editor'), { checked: pane === 'editor' }),
        it('Preview only', () => setPane('preview'), { checked: pane === 'preview' }),
      ];
      case 'format': return [
        it('Bold', () => fmt('b'), { kbd: '⌘B' }),
        it('Italic', () => fmt('i'), { kbd: '⌘I' }),
        it('Arrow →', () => fmt('arrow'), { kbd: '->' }),
        it('En dash –', () => fmt('dash'), { kbd: '--' }),
        '-', { head: 'Target lines per bullet' },
        it('1 line (template)', set('bulletLines', 1), { checked: s.bulletLines === 1 }),
        it('Up to 2 lines', set('bulletLines', 2), { checked: s.bulletLines === 2 }),
        '-', { head: 'Max bullets per entry' },
        ...[3, 4, 5, 6, 0].map(n => it(n ? n + ' bullets' : 'No limit', set('maxBullets', n), { checked: (s.maxBullets | 0) === n })),
        '-', { head: 'Page limit' },
        ...[1, 2, 3].map(n => it(n + (n > 1 ? ' pages' : ' page'), set('maxPages', n), { checked: s.maxPages === n })),
        '-',
        it('Page & header settings…', () => rail('setup')),
      ];
      case 'help': return [
        { head: 'Formatting' },
        { info: 'Bold', code: '**text**' },
        { info: 'Italic', code: '*text*' },
        { info: 'Arrow →', code: '->' },
        { info: 'En / em dash', code: '-- / ---' },
        '-', { head: 'Keyboard' },
        { info: 'Bold / italic selection', code: '⌘/Ctrl B · I' },
        { info: 'Next bullet', code: 'Enter' },
        { info: 'Delete empty bullet', code: 'Backspace' },
        '-', { head: 'Editing' },
        { info: 'Reorder: drag the ⋮⋮ handle' },
        { info: 'Hide without deleting: eye icon' },
      ];
    }
    return [];
  }

  function openMenu(name, anchor) {
    if (popOwner === anchor && !pop.hidden) return closeMenu();
    closeMenu();
    pop.innerHTML = '';
    for (const m of menuItems(name)) {
      if (m === '-') { pop.append(h('hr')); continue; }
      if (m.head) { pop.append(h('div', { class: 'm-head' }, m.head)); continue; }
      if (m.info) { pop.append(h('div', { class: 'm-info' }, h('span', null, m.info), m.code ? h('code', null, m.code) : '')); continue; }
      pop.append(h('button', { type: 'button', class: m.checked ? 'checked' : null, onclick: () => { closeMenu(); m.run(); } },
        h('span', null, m.label), m.kbd ? h('span', { class: 'kbd' }, m.kbd) : '', m.small ? h('small', null, m.small) : ''));
    }
    pop.hidden = false;
    popOwner = anchor; anchor.classList.add('open');
    const r = anchor.getBoundingClientRect();
    const side = anchor.closest('.rail');
    let x = side ? r.right + 6 : r.left, y = side ? Math.max(8, r.bottom - pop.offsetHeight) : r.bottom + 4;
    x = Math.max(6, Math.min(x, window.innerWidth - pop.offsetWidth - 6));
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  }
  function closeMenu() {
    pop.hidden = true;
    if (popOwner) popOwner.classList.remove('open');
    popOwner = null;
  }
  document.querySelectorAll('[data-menu]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); openMenu(b.dataset.menu, b); }));
  document.querySelectorAll('.mb-btn').forEach(b => b.addEventListener('mouseenter', () => { if (!pop.hidden && popOwner && popOwner.classList.contains('mb-btn') && popOwner !== b) openMenu(b.dataset.menu, b); }));
  document.addEventListener('click', (e) => {
    if (!pop.hidden && !pop.contains(e.target)) closeMenu();
    const pm = editor.querySelector('.preset-menu');
    if (pm && !pm.hidden && !e.target.closest('.add-sec-wrap') && !e.target.closest('[data-rail="add"]')) pm.hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
    if ((e.metaKey || e.ctrlKey) && e.key === 'p') { e.preventDefault(); act('pdf'); }
  });
  window.addEventListener('resize', closeMenu);

  function openTrash() {
    if (!trash.length) return toast('Nothing in Recently deleted');
    if (pane === 'preview') setPane('split');
    state.settings._trashOpen = true; full();
    const c = document.getElementById('trashCard'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function addExample(sec, i) {
    const c = clone(sec); reId(c);
    state.sections.splice(Math.min(i, state.sections.length), 0, c);
    if (pane === 'preview') setPane('split');
    full();
    const el = editor.querySelector('[data-id="' + c.id + '"]');
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash-card'); setTimeout(() => el.classList.remove('flash-card'), 1200); }
  }
  function act(a) {
    const snap = clone(state);
    if (a === 'sample') { state = S.sample(); full(); toast('Example resume loaded', snap); }
    if (a === 'blank') { state = S.blank(); full(); toast('Started a blank resume', snap); }
    if (a === 'export-json') download('resume.json', JSON.stringify(state, null, 2), 'application/json');
    if (a === 'import-json') document.getElementById('fileJson').click();
    if (a === 'tex') download('resume.tex', Latex.build(state), 'application/x-tex');
    if (a === 'pdf') {
      const old = document.title;
      const nm = state.settings.topMode === 'header' && R.plain(state.header.name).trim();
      document.title = nm ? nm.replace(/\s+/g, '_') + '_Resume' : 'Resume';
      renderNow();
      window.print();
      setTimeout(() => (document.title = old), 500);
    }
  }
  document.getElementById('fileJson').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const st = JSON.parse(await f.text());
      if (!st || !Array.isArray(st.sections)) throw new Error('not a resume file');
      st.settings = Object.assign(S.defaultSettings(), st.settings || {});
      st.header = st.header || { name: '', contacts: [] };
      const snap = clone(state); state = st; full(); toast('Resume loaded from ' + f.name, snap);
    } catch (err) { toast('Could not read that file: ' + err.message); }
    e.target.value = '';
  });
  document.getElementById('btnTex').addEventListener('click', () => act('tex'));
  document.getElementById('btnPdf').addEventListener('click', () => act('pdf'));

  // ------------------------------------------------------ editor toolbar
  let lastField = null;
  editor.addEventListener('focusin', (e) => { if (e.target.matches('.inp.rich')) lastField = e.target; });
  function fmt(kind) {
    const ta = lastField && lastField.isConnected ? lastField : null;
    if (!ta) return toast('Click into a text field first');
    if (kind === 'b' || kind === 'i') wrapSel(ta, kind);
    else insertAt(ta, kind === 'arrow' ? ' -> ' : '--');
  }
  document.querySelectorAll('[data-fmt]').forEach(b => {
    b.addEventListener('mousedown', (e) => e.preventDefault());     // keep focus in the field
    b.addEventListener('click', () => fmt(b.dataset.fmt));
  });
  function syncChrome() {
    const nm = state.settings.topMode === 'header' && R.plain(state.header.name || '').trim();
    document.getElementById('docTitle').textContent = nm || 'Resume';
  }

  // ------------------------------------------------------------- side rail
  function rail(which, btn) {
    if (which === 'help') return openMenu('help', btn || document.querySelector('.rail [data-rail="help"]'));
    if (pane === 'preview') setPane('split');
    if (which === 'content') { editor.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (which === 'setup') {
      const c = document.getElementById('setupCard');
      if (!state.settings._setupOpen) { state.settings._setupOpen = true; c.classList.remove('collapsed'); save(); }
      c.scrollIntoView({ behavior: 'smooth', block: 'start' });
      c.classList.add('flash-card'); setTimeout(() => c.classList.remove('flash-card'), 900);
    }
    if (which === 'add') {
      const w = document.getElementById('addSecWrap'), m = w.querySelector('.preset-menu');
      m.hidden = false;
      w.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  document.querySelectorAll('[data-rail]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); rail(b.dataset.rail, b); }));

  // --------------------------------------------------------- panes/splitter
  const layoutEl = document.getElementById('layout');
  const UI = 'resumeBuilder.ui';
  let ui = {};
  try { ui = JSON.parse(localStorage.getItem(UI)) || {}; } catch (e) { ui = {}; }
  let pane = ui.pane || 'split';
  function saveUi() { try { localStorage.setItem(UI, JSON.stringify(ui)); } catch (e) { /* ignore */ } }
  function setPane(p) {
    pane = p; ui.pane = p; saveUi();
    layoutEl.classList.toggle('only-editor', p === 'editor');
    layoutEl.classList.toggle('only-preview', p === 'preview');
    if (ready) applyZoom();
  }
  if (ui.split) layoutEl.style.setProperty('--split', ui.split + 'px');
  setPane(pane);
  document.querySelectorAll('.split-arrow').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const grow = b.dataset.pane;                       // which side the arrow expands
    setPane(pane === 'split' ? grow : 'split');
  }));
  const splitter = document.getElementById('splitter');
  splitter.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.split-arrow') || pane !== 'split') return;
    e.preventDefault();
    splitter.setPointerCapture(e.pointerId);
    layoutEl.classList.add('dragging');
    const left = layoutEl.getBoundingClientRect().left + 48;
    const move = (ev) => {
      const w = Math.max(360, Math.min(ev.clientX - left, layoutEl.clientWidth - 48 - 10 - 320));
      layoutEl.style.setProperty('--split', w + 'px'); ui.split = Math.round(w);
      applyZoom();
    };
    const up = () => {
      layoutEl.classList.remove('dragging'); saveUi();
      splitter.removeEventListener('pointermove', move); splitter.removeEventListener('pointerup', up);
    };
    splitter.addEventListener('pointermove', move); splitter.addEventListener('pointerup', up);
  });

  // ------------------------------------------------------ pager and zoom
  const pgCur = document.getElementById('pgCur'), pgTotal = document.getElementById('pgTotal');
  const pgPrev = document.getElementById('pgPrev'), pgNext = document.getElementById('pgNext');
  const wraps = () => [...pagesEl.querySelectorAll('.page-wrap')];
  function curPage() {
    const top = scrollEl.getBoundingClientRect().top + scrollEl.clientHeight * 0.35;
    let i = 0;
    wraps().forEach((w, k) => { if (w.getBoundingClientRect().top <= top) i = k; });
    return i;
  }
  function syncPager() {
    const n = wraps().length || 1, i = Math.min(curPage(), n - 1);
    pgCur.textContent = i + 1; pgTotal.textContent = '/ ' + n;
    pgPrev.disabled = i <= 0; pgNext.disabled = i >= n - 1;
  }
  function goPage(d) {
    const ws = wraps(), i = Math.max(0, Math.min(ws.length - 1, curPage() + d));
    if (!ws[i]) return;
    scrollEl.scrollBy({ top: ws[i].getBoundingClientRect().top - scrollEl.getBoundingClientRect().top - 12, behavior: 'smooth' });
  }
  pgPrev.addEventListener('click', () => goPage(-1));
  pgNext.addEventListener('click', () => goPage(1));
  scrollEl.addEventListener('scroll', syncPager, { passive: true });
  function stepZoom(dir) {
    const steps = ZOOMS.slice(1).map(z => +z[0]);
    const next = dir > 0 ? steps.find(z => z > curZoom + 0.01) : [...steps].reverse().find(z => z < curZoom - 0.01);
    if (next) { zoomSel.value = String(next); applyZoom(); }
  }
  document.getElementById('zoomIn').addEventListener('click', () => stepZoom(1));
  document.getElementById('zoomOut').addEventListener('click', () => stepZoom(-1));

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ------------------------------------------------------------------ boot
  buildEditor();
  M.init().then(() => { ready = true; renderNow(); });
  window.__rb = { get state() { return state; }, get info() { return lastInfo; }, renderNow };
})();
