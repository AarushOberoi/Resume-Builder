/* Preview renderer: builds template blocks, applies LaTeX-calibrated spacing,
   paginates with keep-together rules and reports fill / line statistics. */
(function () {
  'use strict';
  const M = window.Metrics;
  const R = window.Rich;

  /* Baseline-to-baseline distances (pt) between consecutive blocks, measured
     from reusme.pdf.  TARGET[nextKind][prevKey].  'table' is measured from / to
     its outer rule instead of a baseline. */
  const TARGET = {
    sec:    { top: 11.86, sec: 15.5, head: 15.5, headsub: 15.5, bullet: 15.5, text: 15.5, table: 17.5, hdr: 21 },
    head:   { top: 10.5, sec: 14.04, head: 13.45, headsub: 13.45, bullet: 13.45, text: 13.45, table: 15, hdr: 21 },
    bullet: { top: 9.5, sec: 14.48, head: 13.2, headsub: 12.45, bullet: 11.955, text: 12.5, table: 14, hdr: 19 },
    text:   { top: 9.5, sec: 14.48, head: 13.2, headsub: 12.45, bullet: 12.5, text: 12.5, table: 14, hdr: 19 },
    table:  { top: 0, sec: 4.36, head: 5, headsub: 5, bullet: 5, text: 5, table: 3, hdr: 10 },
    hdr:    { top: 18 },
  };

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  const nonEmpty = (s) => String(s || '').trim().length > 0;

  /* Emulate TeX's interword shrink: a line LaTeX would squeeze onto one line
     (spaces may shrink by 1.11pt each) must not be wrapped by the browser.
     Measured on the real DOM, so it works for any font/markup. */
  function fitTight(node) {
    node.style.wordSpacing = '';
    const spaces = (node.textContent.match(/ /g) || []).length;
    if (!spaces) return;
    node.style.whiteSpace = 'nowrap';
    const cs = getComputedStyle(node);
    const box = node.getBoundingClientRect();
    const avail = pt(box.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth));
    const rg = document.createRange();
    rg.selectNodeContents(node);
    if (node.firstChild && node.firstChild.classList && node.firstChild.classList.contains('dot')) rg.setStartAfter(node.firstChild);
    const w = pt(rg.getBoundingClientRect().width);
    node.style.whiteSpace = '';
    if (w > avail + 0.01 && w <= avail + spaces * M.SPACE_SHRINK) {
      node.style.wordSpacing = (-((w - avail) / spaces) - 0.03).toFixed(3) + 'pt';
    }
  }

  function buildBlocks(state) {
    const blocks = [];
    const s = state.settings;
    const W = M.PAGE.textW;

    if (s.topMode === 'header') {
      const h = state.header || {};
      const contacts = (h.contacts || []).filter(c => nonEmpty(c.text));
      if (nonEmpty(h.name) || contacts.length) {
        const b = el('div', 'blk r-hdr');
        if (nonEmpty(h.name)) b.appendChild(el('div', 'r-name rt', R.toHTML(h.name)));
        if (contacts.length) {
          b.appendChild(el('div', 'r-contact rt', contacts.map(c => R.toHTML(c.text)).join('<span class="sep">|</span>')));
        }
        blocks.push({ kind: 'hdr', key: 'hdr', el: b, first: nonEmpty(h.name) ? 'name' : 'body', last: contacts.length ? 'body' : 'name', keepWithNext: true, mids: [] });
      }
    }

    for (const sec of state.sections) {
      if (!sec.visible) continue;
      const secBlk = el('div', 'blk r-sec');
      const line = el('div', 'r-sec-line');
      line.appendChild(el('span', 'rule'));
      line.appendChild(el('span', 'r-sec-t rt', R.toHTML(sec.title || ' ')));
      line.appendChild(el('span', 'rule'));
      secBlk.appendChild(line);
      blocks.push({ kind: 'sec', key: 'sec', el: secBlk, first: 'sec', last: 'sec', keepWithNext: true, sectionId: sec.id, mids: [{ id: sec.id + ':title', node: line.children[1], style: 'sec' }] });

      if (sec.type === 'entries') {
        for (const en of sec.entries) {
          if (en.visible === false) continue;
          const bullets = en.bullets.filter(b => nonEmpty(b.text));
          const hasTitle = nonEmpty(en.title) || nonEmpty(en.extra) || nonEmpty(en.date);
          const hasSub = nonEmpty(en.subtitle);
          if (!hasTitle && !hasSub && !bullets.length) continue;
          const mids = [];
          if (hasTitle || hasSub) {
            const hb = el('div', 'blk r-head');
            if (hasTitle) {
              const tl = el('div', 'r-tl');
              const t = el('div', 'r-title rt', R.toHTML(en.title) + (nonEmpty(en.extra) ? ' <span class="extra">' + R.toHTML(en.extra) + '</span>' : ''));
              tl.appendChild(t);
              if (nonEmpty(en.date)) tl.appendChild(el('div', 'r-date rt', '(' + R.toHTML(en.date) + ')'));
              hb.appendChild(tl);
              mids.push({ id: en.id + ':title', node: t, style: 'title', tight: true });
            }
            if (hasSub) {
              const sb = el('div', 'r-sub rt', R.toHTML(en.subtitle));
              hb.appendChild(sb);
              mids.push({ id: en.id + ':subtitle', node: sb, style: 'sub', tight: true });
            }
            blocks.push({ kind: 'head', key: hasSub ? 'headsub' : 'head', el: hb, first: hasTitle ? 'title' : 'sub', last: hasSub ? 'sub' : 'title', keepWithNext: bullets.length > 0, mids });
          }
          bullets.forEach((bl, i) => {
            const blk = bulletBlock(bl);
            if (bullets.length >= 3 && i === 0) blk.keepWithNext = true;
            if (bullets.length >= 3 && i === bullets.length - 1) blk.keepWithPrev = true;
            blocks.push(blk);
          });
        }
      } else if (sec.type === 'bullets') {
        const bullets = sec.bullets.filter(b => nonEmpty(b.text));
        bullets.forEach((bl, i) => {
          const blk = bulletBlock(bl);
          if (bullets.length >= 3 && i === bullets.length - 1) blk.keepWithPrev = true;
          blocks.push(blk);
        });
      } else if (sec.type === 'table') {
        const rows = sec.rows.filter(r => nonEmpty(r.label) || nonEmpty(r.value));
        if (rows.length) {
          const tb = el('div', 'blk r-table');
          const table = el('table');
          const mids = [];
          for (const r of rows) {
            const tr = el('tr');
            tr.appendChild(el('td', 'l rt', R.toHTML(r.label)));
            const v = el('td', 'v rt', R.toHTML(r.value));
            tr.appendChild(v);
            table.appendChild(tr);
            mids.push({ id: r.id + ':value', node: v, style: 'body', pad: true, tight: true });
          }
          tb.appendChild(table);
          blocks.push({ kind: 'table', key: 'table', el: tb, edge: true, mids });
        }
      } else if (sec.type === 'text') {
        if (nonEmpty(sec.text)) {
          const tb = el('div', 'blk');
          const t = el('div', 'r-text rt', R.toHTML(sec.text));
          tb.appendChild(t);
          blocks.push({ kind: 'text', key: 'text', el: tb, first: 'body', last: 'body', mids: [{ id: sec.id + ':text', node: t, style: 'body' }] });
        }
      }
    }
    return blocks;
  }

  function bulletBlock(bl) {
    const b = el('div', 'blk r-bul');
    const t = el('div', 'r-bt rt', '<span class="dot"></span>' + R.toHTML(bl.text));
    b.appendChild(t);
    return { kind: 'bullet', key: 'bullet', el: b, first: 'body', last: 'body', mids: [{ id: bl.id, node: t, style: 'body', tight: true }] };
  }

  function gapFor(prev, cur, spacing, extra) {
    const row = TARGET[cur.kind];
    const prevKey = prev ? prev.key : 'top';
    let target = row[prevKey] != null ? row[prevKey] : row.sec || 12;
    if (prev && (cur.kind === 'sec' || (cur.kind === 'head' && prev.kind !== 'sec'))) {
      if (spacing === 'compact') target -= cur.kind === 'sec' ? 2 : 1.5;
      target += extra;
    }
    const dPrev = prev ? (prev.edge ? 0 : M.lineBox(prev.last).d) : 0;
    const bCur = cur.edge ? 0 : M.lineBox(cur.first).b;
    return target - dPrev - bCur;
  }

  const pt = (px) => px * 0.75;

  function makePage(state, index, root) {
    const s = state.settings;
    const wrap = el('div', 'page-wrap');
    const tag = el('div', 'page-tag', 'Page ' + (index + 1));
    const page = el('div', 'page');
    const body = M.lineBox('body');
    page.style.setProperty('--accent', s.accent || '#4169E1');
    page.style.setProperty('--b-body', body.b.toFixed(3) + 'pt');
    const padT = Math.max(0, 9.6 - 0.398 - body.b);
    page.style.setProperty('--td-pt', padT.toFixed(3) + 'pt');
    page.style.setProperty('--td-pb', Math.max(0, 13.152 - body.L - padT).toFixed(3) + 'pt');

    let top;
    if (index === 0) top = (s.topMode === 'reserved' ? s.reservedTopMm : s.headerTopMm) * M.MM;
    else top = s.contTopMm * M.MM;
    const bottom = s.bottomMm * M.MM;
    const cap = M.PAGE.h - top - bottom;

    if (s.guides && index === 0 && s.topMode === 'reserved') {
      const g = el('div', 'reserved-guide', 'Reserved for institute header · ' + s.reservedTopMm + ' mm<br><small>(blank in the PDF)</small>');
      g.style.height = Math.max(0, top - 14 - 8) + 'pt';
      page.appendChild(g);
    }
    if (s.guides) {
      const gb = el('div', 'margin-guide');
      gb.style.top = (M.PAGE.h - bottom) + 'pt';
      gb.title = 'Bottom margin';
      page.appendChild(gb);
    }
    const content = el('div', 'page-content');
    content.style.top = top + 'pt';
    page.appendChild(content);
    wrap.appendChild(tag);
    wrap.appendChild(page);
    root.appendChild(wrap);
    return { wrap, page, tag, content, cap, blocks: [] };
  }

  function lastBaseline(pg) {
    const b = pg.blocks[pg.blocks.length - 1];
    if (!b) return 0;
    const top = pg.content.getBoundingClientRect().top;
    const r = b.el.getBoundingClientRect();
    return pt(r.bottom - top) - (b.edge ? 0 : M.lineBox(b.last).d);
  }

  function paginate(state, blocks, root, extra) {
    const s = state.settings;
    root.innerHTML = '';
    const pages = [makePage(state, 0, root)];
    let pg = pages[0];

    const place = (b) => {
      b.el.style.marginTop = gapFor(pg.blocks[pg.blocks.length - 1], b, s.spacing, extra).toFixed(3) + 'pt';
      pg.content.appendChild(b.el);
      pg.blocks.push(b);
      if (!b.fitted) { b.mids.forEach(m => m.tight && fitTight(m.node)); b.fitted = true; }
    };

    for (const b of blocks) {
      place(b);
      if (pg.blocks.length > 1 && lastBaseline(pg) > pg.cap + 0.5) {
        const carry = [pg.blocks.pop()];
        b.el.remove();
        let needPrev = b.keepWithPrev;
        while (pg.blocks.length > 1 && (pg.blocks[pg.blocks.length - 1].keepWithNext || needPrev)) {
          const p = pg.blocks.pop();
          p.el.remove();
          carry.unshift(p);
          needPrev = p.keepWithPrev;
        }
        pg = makePage(state, pages.length, root);
        pages.push(pg);
        carry.forEach(place);
      }
    }
    return pages;
  }

  /** Render state into `target`; returns layout statistics. */
  function render(state, target, measureRoot) {
    const s = state.settings;
    let blocks = buildBlocks(state);
    let pages = paginate(state, blocks, measureRoot, 0);
    let extra = 0;
    const bodyL0 = M.lineBox('body').L;
    const lim0 = Math.max(1, s.maxPages | 0);
    // free room at template spacing (before any auto-fill stretching) — what new content can really use
    const baseFree = pages.length <= lim0 ? Math.floor((pages[pages.length - 1].cap - lastBaseline(pages[pages.length - 1])) / bodyL0) : 0;

    if (s.spacing === 'fill' && pages.length === 1 && blocks.length > 1) {
      const free = pages[0].cap - lastBaseline(pages[0]) - 2;
      const n = blocks.filter((b, i) => i > 0 && (b.kind === 'sec' || (b.kind === 'head' && blocks[i - 1].kind !== 'sec'))).length;
      if (free > 1 && n) {
        extra = Math.min(4, free / n);
        blocks = buildBlocks(state);
        pages = paginate(state, blocks, measureRoot, extra);
        if (pages.length > 1) { blocks = buildBlocks(state); pages = paginate(state, blocks, measureRoot, 0); extra = 0; }
      }
    }

    // ---- statistics (measured while still unscaled) ----
    const lines = {};
    const bodyL = M.lineBox('body').L;
    for (const pg of pages) {
      for (const b of pg.blocks) {
        for (const m of b.mids) {
          let h = pt(m.node.getBoundingClientRect().height);
          if (m.pad) {
            const cs = getComputedStyle(m.node);
            h -= pt(parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom));
          }
          lines[m.id] = Math.max(1, Math.round(h / M.STYLES[m.style].L));
        }
      }
    }
    const perPage = pages.map(pg => ({ used: lastBaseline(pg), cap: pg.cap }));
    const limit = Math.max(1, s.maxPages | 0);
    let overPt = 0;
    pages.forEach((pg, i) => {
      if (i >= limit) {
        pg.wrap.classList.add('over-limit');
        pg.tag.innerHTML = 'Page ' + (i + 1) + ' <span class="overflow-flag">exceeds the ' + limit + '-page limit</span>';
        overPt += Math.max(0, perPage[i].used - 10) + bodyL;   // first baseline sits ~10pt below the top
      }
    });
    if (!blocks.length) {
      pages[0].content.appendChild(el('div', 'r-empty', 'Your resume preview appears here.<br>Add a section on the left to begin.'));
    }

    target.replaceChildren(...pages.map(p => p.wrap));
    return {
      pages: pages.length,
      limit,
      perPage,
      lines,
      extra,
      overLines: Math.max(1, Math.round(overPt / bodyL)),
      freeLines: pages.length <= limit ? Math.floor((perPage[pages.length - 1].cap - perPage[pages.length - 1].used) / bodyL) : 0,
      baseFree,
      empty: !blocks.length,
    };
  }

  window.Render = { render, TARGET };
})();
