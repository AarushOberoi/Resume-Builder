/* Lightweight rich-text: **bold**, *italic*, plus typographic shortcuts
   ->  →     <-  ←     ---  —     --  –     */
(function () {
  'use strict';

  function typo(s) {
    return s
      .replace(/->/g, '→')
      .replace(/<-/g, '←')
      .replace(/---/g, '—')
      .replace(/--/g, '–');
  }

  /** @returns {{text:string,b:boolean,i:boolean}[]} */
  function parse(src) {
    src = String(src || '');
    const runs = [];
    const re = /\*\*([^*]+?)\*\*|\*([^*\s][^*]*?)\*/g;
    let last = 0, m;
    while ((m = re.exec(src))) {
      if (m.index > last) runs.push({ text: typo(src.slice(last, m.index)), b: false, i: false });
      if (m[1] !== undefined) runs.push({ text: typo(m[1]), b: true, i: false });
      else runs.push({ text: typo(m[2]), b: false, i: true });
      last = re.lastIndex;
    }
    if (last < src.length) runs.push({ text: typo(src.slice(last)), b: false, i: false });
    return runs.filter(r => r.text.length);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  const LOGO = '<span class="tex-logo">L<span class="tl-a">A</span>T<span class="tl-e">E</span>X</span>';
  function toHTML(src) {
    return parse(src).map(r => {
      const t = esc(r.text).replace(/\bLaTeX\b/g, LOGO).replace(/C\+\+/g, 'C<span class="tt">++</span>')
        // math-style symbols ($\rightarrow$, $\sim$): drawn thin like cmsy, real character kept for copy/ATS
        .replace(/→/g, '<span class="mx mx-r">→</span>')
        .replace(/←/g, '<span class="mx mx-l">←</span>')
        .replace(/∼/g, '<span class="mx mx-s">∼</span>');
      return r.b ? '<b>' + t + '</b>' : r.i ? '<i>' + t + '</i>' : t;
    }).join('');
  }

  function plain(src) { return parse(src).map(r => r.text).join(''); }

  window.Rich = { parse, toHTML, plain, esc, typo };
})();
