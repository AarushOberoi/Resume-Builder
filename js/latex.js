/* Export to LaTeX using the exact macros of the original main.tex. */
(function () {
  'use strict';
  const R = window.Rich;

  const MAP = {
    '\\': '\\textbackslash{}', '&': '\\&', '%': '\\%', '$': '\\$', '#': '\\#', '_': '\\_',
    '{': '\\{', '}': '\\}', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}',
    '→': '$\\rightarrow$', '←': '$\\leftarrow$', '×': '$\\times$', '∼': '$\\sim$',
    '≈': '$\\approx$', '≤': '$\\leq$', '≥': '$\\geq$', '±': '$\\pm$',
    '–': '--', '—': '---', '|': '$|$', '<': '\\textless{}', '>': '\\textgreater{}',
    '•': '$\\bullet$', '’': "'", '‘': '`', '“': '``', '”': "''",
  };
  function escText(s) {
    let out = '';
    for (const ch of s) out += MAP[ch] !== undefined ? MAP[ch] : ch;
    return out.replace(/C\+\+/g, 'C\\texttt{++}').replace(/\bLaTeX\b/g, '\\LaTeX{}');
  }
  function tex(src) {
    return R.parse(src).map(r => {
      const t = escText(r.text);
      return r.b ? '\\textbf{' + t + '}' : r.i ? '\\textit{' + t + '}' : t;
    }).join('');
  }
  const has = (s) => String(s || '').trim().length > 0;
  const mm = (v) => (Math.round(v * 100) / 100) + 'mm';

  function build(state) {
    const s = state.settings;
    const top = s.topMode === 'reserved' ? s.reservedTopMm : s.headerTopMm;
    const rgb = (s.accent || '#4169E1').replace('#', '').toUpperCase();
    const L = [];
    L.push(
      '\\documentclass[10pt]{article}',
      '',
      '\\usepackage[T1]{fontenc}',
      '\\usepackage{enumitem}',
      '\\usepackage[a4paper, bottom=' + mm(s.bottomMm) + ', left=14mm, right=14mm, top=' + mm(top) + ']{geometry}',
      '\\usepackage{titlesec}',
      '\\usepackage{tabularx}',
      '\\usepackage[table, svgnames]{xcolor}',
      '\\usepackage{hyphenat}',
      '\\usepackage{anyfontsize}',
      '\\usepackage[pdftex, hidelinks]{hyperref}',
      '',
      '\\definecolor{SectionColor}{HTML}{' + rgb + '}',
      '\\setlength{\\parindent}{0pt}',
      '\\hyphenpenalty 10000',
      '',
      '\\renewcommand{\\section}[1]{',
      '    \\vspace{0pt}',
      '    \\noindent',
      '    {\\color{SectionColor}',
      '    \\fontsize{14}{17}\\selectfont',
      '    \\scshape',
      '    \\begin{tabularx}{\\textwidth}{@{}XcX@{}}',
      '        \\rule{\\linewidth}{0.5pt} & #1 & \\rule{\\linewidth}{0.5pt}',
      '    \\end{tabularx}',
      '    }',
      '    \\vspace{-11pt}',
      '}',
      '',
      '\\renewcommand{\\subsection}[4]{ \\def\\temp{#4}',
      '\\vspace{1pt}',
      '{ \\large {\\textbf{#1}} {\\rm #2} \\filldate{#3} \\ifx\\temp\\empty \\else { \\\\[0.05em] \\fontsize{10}{12.5}\\selectfont \\sl #4 } \\fi }',
      '}',
      '',
      '% prints nothing when the date is empty',
      '\\newcommand{\\filldate}[1]{\\def\\tempd{#1}\\strut\\hfill \\ifx\\tempd\\empty\\else{\\small \\textit{(#1)}}\\fi}',
      '',
      '\\renewcommand{\\labelitemi}{\\small$\\bullet$}',
      '\\setlist[itemize]{itemsep=-1.15mm, topsep=0.5pt, leftmargin=14pt, after=\\vspace{0pt}}',
      '',
      '\\begin{document}',
      ''
    );

    if (s.topMode === 'reserved') {
      L.push('%  NOTE: the ' + s.reservedTopMm + 'mm top margin is reserved for the institute header.', '');
    } else {
      const h = state.header || {};
      const contacts = (h.contacts || []).filter(c => has(c.text)).map(c => tex(c.text));
      if (has(h.name) || contacts.length) {
        L.push('\\begin{center}');
        if (has(h.name)) L.push('  {\\huge \\textbf{' + tex(h.name) + '}}' + (contacts.length ? ' \\\\[4pt]' : ''));
        if (contacts.length) L.push('  ' + contacts.join(' \\hspace{4pt}$|$\\hspace{4pt} '));
        L.push('\\end{center}', '\\vspace{-6pt}', '');
      }
    }

    for (const sec of state.sections) {
      if (!sec.visible) continue;
      L.push('%%%%%%%%%%%%% ' + (sec.title || '').replace(/\n/g, ' ') + ' %%%%%%%%%%%%%', '\\section{' + tex(sec.title) + '}', '');
      if (sec.type === 'entries') {
        for (const en of sec.entries) {
          if (en.visible === false) continue;
          const bullets = en.bullets.filter(b => has(b.text));
          if (!has(en.title) && !has(en.date) && !has(en.subtitle) && !bullets.length) continue;
          L.push('\\subsection{' + tex(en.title) + '}{' + tex(en.extra) + '}{' + tex(en.date) + '}{' + tex(en.subtitle) + '}');
          if (bullets.length) {
            L.push('\\begin{itemize}');
            bullets.forEach(b => L.push('\\item ' + tex(b.text)));
            L.push('\\end{itemize}');
          }
          L.push('');
        }
      } else if (sec.type === 'bullets') {
        const bullets = sec.bullets.filter(b => has(b.text));
        if (bullets.length) {
          L.push('\\begin{itemize}');
          bullets.forEach(b => L.push('\\item ' + tex(b.text)));
          L.push('\\end{itemize}', '');
        }
      } else if (sec.type === 'table') {
        const rows = sec.rows.filter(r => has(r.label) || has(r.value));
        if (rows.length) {
          L.push('\\vspace{0.8mm}', '\\renewcommand{\\arraystretch}{1.1}', '\\begin{tabularx}',
            '  {\\textwidth}{|>{\\centering\\arraybackslash}m{0.17\\linewidth}|X|} \\hline');
          rows.forEach(r => L.push('  \\textbf{' + tex(r.label) + '} & ' + tex(r.value) + ' \\\\ \\hline'));
          L.push('\\end{tabularx}', '\\vspace{0.8mm}', '');
        }
      } else if (sec.type === 'text') {
        if (has(sec.text)) L.push('\\vspace{2pt}', tex(sec.text), '', '');
      }
    }
    L.push('\\end{document}', '');
    return L.join('\n');
  }

  window.Latex = { build };
})();
