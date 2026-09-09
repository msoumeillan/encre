/* ============================================================
   ENCRE — vue Agenda (mois, année, statistiques)
   ============================================================ */
(function (A) {
  'use strict';
  const { el } = A;
  const S = () => A.Store.state();

  let cursor = null;   // {y, m}
  let mode = 'mois';

  function render(main, params) {
    const st = S();
    if (params && params.mois) { const [y, m] = params.mois.split('-').map(Number); cursor = { y, m: m - 1 }; }
    if (!cursor) { const t = new Date(); cursor = { y: t.getFullYear(), m: t.getMonth() }; }
    if (params && params.mode) mode = params.mode;

    main.innerHTML = '';
    const wrap = el('.wrap.wrap--wide.fade-in');

    /* — en-tête — */
    const head = el('.cal-head');
    head.append(el('h2', { text: mode === 'annee' ? String(cursor.y) : A.MOIS[cursor.m] }, mode === 'annee' ? '' : el('span', { text: ' ' + cursor.y })));
    const nav = el('.cal-nav');
    nav.append(el('button.icon-btn', { html: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>', title: 'Précédent', onclick: () => { shift(-1); render(main); } }));
    nav.append(el('button.btn.btn--sm', { text: "Aujourd'hui", onclick: () => { const t = new Date(); cursor = { y: t.getFullYear(), m: t.getMonth() }; render(main); } }));
    nav.append(el('button.icon-btn', { html: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>', title: 'Suivant', onclick: () => { shift(1); render(main); } }));
    head.append(nav);
    head.append(el('div', { style: { flex: '1' } }));
    const seg = el('.toolbar');
    ['mois', 'annee'].forEach(mo => seg.append(el('button.chip' + (mode === mo ? '.is-on' : ''), {
      text: mo === 'mois' ? 'Mois' : 'Année', onclick: () => { mode = mo; render(main); }
    })));
    head.append(seg);
    wrap.append(head);

    if (mode === 'mois') wrap.append(monthGrid(main));
    else wrap.append(yearGrid(main));

    /* — statistiques — */
    const s = A.Store.stats();
    const box = el('.stats');
    box.append(stat(s.jours, 'jours écrits'));
    box.append(stat(s.mots.toLocaleString('fr-FR'), 'mots'));
    box.append(stat(s.posts, 'posts'));
    box.append(stat(s.images, 'images'));
    box.append(stat(s.serie, 'jours de suite', true));
    wrap.append(el('.section-head', el('h2', { text: 'Le compte' }), el('.rule')));
    wrap.append(box);

    /* — mots-clés — */
    const tags = A.Store.allTags();
    if (tags.length) {
      wrap.append(el('.section-head', el('h2', { text: 'Mots-clés' }), el('.rule'), el('.count', { text: tags.length })));
      const row = el('.tag-row');
      tags.slice(0, 40).forEach(([t, n]) => row.append(el('button.chip.chip--tag', {
        text: `${t} ${n}`, onclick: () => A.go('feed', { tag: t })
      })));
      wrap.append(row);
    }

    main.append(wrap);
  }

  function stat(v, label, accent) {
    return el('.stat' + (accent ? '.stat--accent' : ''), el('b', { text: String(v) }), el('small', { text: label }));
  }

  function shift(n) {
    if (mode === 'annee') { cursor.y += n; return; }
    cursor.m += n;
    if (cursor.m < 0) { cursor.m = 11; cursor.y--; }
    if (cursor.m > 11) { cursor.m = 0; cursor.y++; }
  }

  /* ---------- grille mensuelle ---------- */
  function monthGrid(main) {
    const st = S();
    const grid = el('.cal');
    A.dowLabels(st.settings.weekStart).forEach(l => grid.append(el('.cal__dow', { text: l })));
    A.monthMatrix(cursor.y, cursor.m, st.settings.weekStart).forEach(c => {
      const d = st.days[c.k];
      const posts = A.Store.postsOf(c.k);
      const has = A.Store.dayHasContent(d);
      const cell = el('button.cal__cell' +
        (c.out ? '.is-out' : '') +
        (c.k === A.today() ? '.is-today' : '') +
        (!has && !posts.length ? '.is-empty' : '') +
        (d && d.cover ? '.has-cover' : ''), {
        onclick: () => A.go('journal', { day: c.k }),
        title: A.longDate(c.k)
      });
      if (d && d.cover) {
        cell.append(A.Media.img(d.cover, { class: 'cal__img' }));
        cell.append(el('.cal__scrim'));
      }
      cell.append(el('.cal__n', { text: c.d.getDate() }));
      const label = d && d.titre ? d.titre : (has ? A.truncate(A.Store.dayText(d), 60) : (posts.length ? A.truncate(posts[0].texte, 60) : ''));
      if (label) cell.append(el('.cal__t', { text: label }));
      const dots = el('.cal__dots');
      const nImg = (d ? (d.blocks || []).reduce((n, b) => n + ((b.images || []).length), 0) : 0) + posts.reduce((n, p) => n + (p.images || []).length, 0);
      if (has) dots.append(el('i'));
      posts.slice(0, 3).forEach(() => dots.append(el('i', { style: { opacity: '.45' } })));
      if (nImg) dots.append(el('span', { text: '❏ ' + nImg, style: { fontSize: '10px', color: 'inherit', opacity: '.7' } }));
      cell.append(dots);
      grid.append(cell);
    });
    return grid;
  }

  /* ---------- vue année (carte de chaleur) ---------- */
  function yearGrid(main) {
    const st = S();
    const box = el('.year');
    for (let m = 0; m < 12; m++) {
      const mb = el('.year__month');
      mb.append(el('h4', { text: A.MOIS[m], onclick: () => { cursor.m = m; mode = 'mois'; render(main); }, style: { cursor: 'pointer' } }));
      const g = el('.year__grid');
      A.monthMatrix(cursor.y, m, st.settings.weekStart).forEach(c => {
        if (c.out) { g.append(el('.year__d.is-out')); return; }
        const d = st.days[c.k];
        const n = (A.Store.dayHasContent(d) ? A.words(A.Store.dayText(d)) : 0) + A.Store.postsOf(c.k).length * 60;
        const lvl = n === 0 ? 0 : n < 60 ? 1 : n < 220 ? 2 : 3;
        g.append(el('.year__d', {
          'data-lvl': lvl, title: A.longDate(c.k) + (n ? ` — ${n} mots` : ''),
          onclick: () => A.go('journal', { day: c.k })
        }));
      });
      mb.append(g);
      box.append(mb);
    }
    return box;
  }

  A.Agenda = { render };
})(window.App);
