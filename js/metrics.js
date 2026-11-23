/* Font metrics + text measurement.
   Everything is expressed in PDF points (CSS pt). */
(function () {
  'use strict';

  const TPT = 72 / 72.27;          // one TeX point in PDF points
  const MM = 72 / 25.4;            // one millimetre in PDF points

  const PAGE = { w: 595.276, h: 841.89, textW: 515.906 };

  /* Text styles of the template (size / baselineskip in pt). */
  const STYLES = {
    sec:     { family: 'LMCaps',  weight: 400, style: 'normal', size: 14 * TPT,    L: 17 * TPT },
    // optical-size corrections (cmbx12 is narrower than bx10 scaled, cmti9 wider);
    // `track` must equal the CSS letter-spacing (in em) of the matching class.
    title:   { family: 'LMR',     weight: 700, style: 'normal', size: 12 * TPT,    L: 14 * TPT, track: -0.0125 },
    date:    { family: 'LMR',     weight: 400, style: 'italic', size: 9 * TPT,     L: 11 * TPT, track: 0.0127 },
    sub:     { family: 'LMSlant', weight: 400, style: 'normal', size: 10 * TPT,    L: 12.5 * TPT },
    body:    { family: 'LMR',     weight: 400, style: 'normal', size: 10 * TPT,    L: 12 * TPT },
    name:    { family: 'LMR',     weight: 700, style: 'normal', size: 20.74 * TPT, L: 25.5 * TPT },
  };

  const BULLET_INDENT = 14 * TPT;          // enumitem leftmargin=14pt
  const TABLE_LABEL_COL = 100.06;          // measured: 0.17\linewidth + 2\tabcolsep + rule
  const TABLE_VALUE_W = PAGE.textW - TABLE_LABEL_COL - 2 * 5.98 - 0.4;
  // cmr10 interword shrink is 1.11pt; a little extra absorbs the small width
  // differences between Latin Modern and the cm-super fonts in the PDF.
  const SPACE_SHRINK = 1.11 * TPT * 1.2;

  const ratios = {};                       // family|weight|style -> {a, d}
  let canvas, ctx;

  function fontKey(f, w, s) { return f + '|' + w + '|' + s; }
  function cssFont(st, weight, style, family) {
    return (style || st.style) + ' ' + (weight || st.weight) + ' ' + st.size + 'pt ' + (family || st.family);
  }

  function measureRatios(family, weight, style) {
    const k = fontKey(family, weight, style);
    if (ratios[k]) return ratios[k];
    ctx.font = style + ' ' + weight + ' 100px ' + family;
    const m = ctx.measureText('Hxg');
    let a = m.fontBoundingBoxAscent, d = m.fontBoundingBoxDescent;
    if (!(a > 0)) { a = 80.6; d = 19.4; }   // very old browsers: LM hhea defaults
    return (ratios[k] = { a: a / 100, d: d / 100 });
  }

  async function init() {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
    const loads = [];
    const faces = [
      ['LMR', 400, 'normal'], ['LMR', 700, 'normal'], ['LMR', 400, 'italic'], ['LMR', 700, 'italic'],
      ['LMSlant', 400, 'normal'], ['LMSlant', 700, 'normal'], ['LMCaps', 400, 'normal'], ['LMMono', 400, 'normal'],
    ];
    for (const [f, w, s] of faces) loads.push(document.fonts.load(s + ' ' + w + ' 10pt ' + f, 'Ab'));
    try { await Promise.all(loads); } catch (e) { /* fall back to whatever is available */ }
    await document.fonts.ready;
    for (const [f, w, s] of faces) measureRatios(f, w, s);
  }

  /** baseline offset from top of a line box, and depth below the baseline */
  function lineBox(styleName) {
    const st = STYLES[styleName];
    const r = measureRatios(st.family, st.weight, st.style);
    const A = r.a * st.size, D = r.d * st.size;
    const b = (st.L - (A + D)) / 2 + A;
    return { b, d: st.L - b, L: st.L };
  }

  /** natural width (pt) of rich text set in a given style */
  function width(src, styleName) {
    const st = STYLES[styleName];
    const runs = Rich.parse(src);
    let w = 0;
    for (const r of runs) {
      let family = st.family, weight = st.weight, style = st.style;
      if (r.b) weight = 700;
      if (r.i) { if (family === 'LMSlant') family = 'LMR'; style = 'italic'; }
      ctx.font = style + ' ' + weight + ' ' + st.size + 'pt ' + family;
      // the LaTeX logo is typeset as a kerned logo (~2.5em wide), see Rich.toHTML
      let text = r.text;
      const logos = (text.match(/\bLaTeX\b/g) || []).length;
      if (logos) { text = text.replace(/\bLaTeX\b/g, ''); w += logos * 2.5 * st.size; }
      // math symbols have fixed widths (see .mx in resume.css)
      const arrows = (text.match(/[→←]/g) || []).length, sims = (text.match(/∼/g) || []).length;
      if (arrows || sims) { text = text.replace(/[→←∼]/g, ''); w += (arrows + sims * 0.778) * st.size; }
      // C\texttt{++}: two 0.525em typewriter glyphs instead of roman '+'
      const cpp = (text.match(/C\+\+/g) || []).length;
      if (cpp) {
        text = text.replace(/C\+\+/g, 'C');
        ctx.font = '400 ' + st.size + 'pt LMMono';
        w += cpp * ctx.measureText('++').width * 0.75;
        ctx.font = style + ' ' + weight + ' ' + st.size + 'pt ' + family;
      }
      w += ctx.measureText(text).width * 0.75;     // px -> pt (canvas resolves pt to px)
      if (st.track) w += [...text].length * st.track * st.size;
    }
    return w;
  }

  /* Reference average glyph width for short inputs: typical resume prose. */
  const REF_TEXT = 'Built and deployed a production pipeline that reduced latency for real-time customer calls by 40% using';
  const refCache = {};
  function refAvg(styleName) {
    if (refCache[styleName]) return refCache[styleName];
    return (refCache[styleName] = width(REF_TEXT, styleName) / REF_TEXT.length);
  }

  window.Metrics = {
    TPT, MM, PAGE, STYLES, BULLET_INDENT, TABLE_LABEL_COL, TABLE_VALUE_W, SPACE_SHRINK,
    init, lineBox, width, refAvg, cssFont,
  };
})();
