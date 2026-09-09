/* ============================================================
   ENCRE — vue Journal (une page par jour)
   ============================================================ */
(function (A) {
  'use strict';
  const { el, $ } = A;
  const S = () => A.Store.state();

  /* ============================================================
     Composant couverture (partagé journal / notes / carnets)
     obj doit exposer .cover (id image) et .coverPos (0-100)
     ============================================================ */
  function cover(obj, save) {
    const box = el('.cover' + (obj.cover ? '' : '.cover--none'));
    if (obj.cover) {
      const im = A.Media.img(obj.cover, { alt: 'Couverture' });
      box.style.setProperty('--cover-pos', (obj.coverPos == null ? 50 : obj.coverPos) + '%');
      box.append(im);

      /* repositionner en glissant — les écouteurs ne vivent que le temps du geste */
      im.addEventListener('mousedown', e => {
        e.preventDefault();
        const drag = { y: e.clientY, start: obj.coverPos == null ? 50 : obj.coverPos };
        box.classList.add('is-dragging');
        const onMove = ev => {
          const d = (ev.clientY - drag.y) / box.offsetHeight * 100;
          obj.coverPos = A.clamp(Math.round(drag.start - d * 1.4), 0, 100);
          box.style.setProperty('--cover-pos', obj.coverPos + '%');
        };
        const onUp = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
          box.classList.remove('is-dragging');
          save();
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });

      box.append(el('.cover__tools',
        el('button.btn.btn--sm', { text: 'Repositionner', title: 'Glissez l’image pour la recadrer' }),
        el('button.btn.btn--sm', { text: 'Changer', onclick: async () => {
          const got = await A.Media.pick(false);
          if (got[0]) { if (obj.cover) A.Media.del(obj.cover); obj.cover = got[0].id; obj.coverPos = 50; save(true); }
        } }),
        el('button.btn.btn--sm', { text: 'Retirer', onclick: () => {
          if (obj.cover) A.Media.del(obj.cover);
          obj.cover = null; save(true);
        } })
      ));
    }
    return box;
  }

  function addCoverBtn(obj, save) {
    return el('button.btn.btn--ghost.btn--sm', {
      html: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 15l5-4 4 3 3-2 6 5"/></svg> Couverture',
      onclick: async () => {
        const got = await A.Media.pick(false);
        if (got[0]) { obj.cover = got[0].id; obj.coverPos = 50; save(true); }
      }
    });
  }

  /* ---------- éditeur de tags ---------- */
  function tagEditor(obj, save) {
    const row = el('.tag-row');
    const paint = () => {
      row.innerHTML = '';
      (obj.tags || []).forEach(t => {
        row.append(el('button.chip.chip--tag', {
          text: t, title: 'Retirer',
          onclick: () => { obj.tags = obj.tags.filter(x => x !== t); save(true); }
        }));
      });
      row.append(el('button.chip', {
        text: '+ mot-clé',
        onclick: () => A.promptDlg('Mot-clé', '', v => {
          obj.tags = obj.tags || [];
          v.split(/[,\s]+/).filter(Boolean).forEach(x => { const t = x.replace(/^#/, ''); if (t && !obj.tags.includes(t)) obj.tags.push(t); });
          save(true);
        }, { placeholder: 'anime, soir, idée…' })
      }));
    };
    paint();
    return row;
  }

  /* ============================================================
     Vue
     ============================================================ */
  function render(main, params) {
    const st = S();
    const k = (params && params.day) || st.ui.lastDay || A.today();
    st.ui.lastDay = k;
    const d = A.Store.day(k, true);
    const save = (full) => { d.updatedAt = Date.now(); A.Store.save(true); if (full) render(main, { day: k }); A.refreshChrome(); };

    main.innerHTML = '';
    main.append(cover(d, save));

    const wrap = el('.wrap.fade-in');
    if (d.cover) wrap.style.paddingTop = '18px';

    /* — bandeau de semaine — */
    wrap.append(weekStrip(k, main));

    /* — en-tête — */
    const head = el('.doc-head');
    const dt = A.parseKey(k);
    const isToday = k === A.today();

    head.append(el('.page-kicker',
      el('span', { text: A.JOURS[dt.getDay()] }),
      el('span', { text: '·' }),
      el('span', { text: A.relDate(k) })
    ));

    const titleRow = el('div', { style: { display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' } });
    const bigDate = el('h1.doc-title', { style: { margin: 0 } },
      el('span', { text: dt.getDate() + ' ' + A.MOIS[dt.getMonth()] }),
      el('span', { style: { color: 'var(--faint)' }, text: ' ' + dt.getFullYear() }));
    titleRow.append(bigDate);
    if (isToday) titleRow.append(el('span.chip.is-on', { text: "aujourd'hui" }));
    head.append(titleRow);

    const titre = el('.doc-title', {
      contenteditable: 'true', 'data-ph': 'Un titre pour ce jour…', text: d.titre || '',
      style: { fontSize: '26px', color: 'var(--ink-soft)', marginTop: '6px' },
      oninput: e => { d.titre = e.target.textContent; A.Store.save(true); },
      onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); const b = main.querySelector('.editor .block__body'); b && A.Editor.focusEnd(b); } }
    });
    head.append(titre);

    /* — actions — */
    const actions = el('.doc-actions');
    if (!d.cover) actions.append(addCoverBtn(d, save));
    actions.append(el('div', { style: { flex: '1' } }));
    actions.append(el('button.btn.btn--ghost.btn--sm', {
      html: '‹ ' + A.MOIS_C[A.parseKey(A.addDays(k, -1)).getMonth()] + ' ' + A.parseKey(A.addDays(k, -1)).getDate(),
      title: 'Jour précédent', onclick: () => A.go('journal', { day: A.addDays(k, -1) })
    }));
    actions.append(el('button.btn.btn--ghost.btn--sm', {
      html: A.parseKey(A.addDays(k, 1)).getDate() + ' ' + A.MOIS_C[A.parseKey(A.addDays(k, 1)).getMonth()] + ' ›',
      title: 'Jour suivant', onclick: () => A.go('journal', { day: A.addDays(k, 1) })
    }));
    head.append(actions);
    head.append(tagEditor(d, save));
    wrap.append(head);

    /* — éditeur — */
    const edHost = el('div', { style: { marginTop: '22px' } });
    wrap.append(edHost);
    A.Editor.mount(edHost, d, () => { A.Store.save(true); A.refreshChrome(); });

    /* — posts du jour — */
    const posts = A.Store.postsOf(k);
    if (posts.length) {
      const sec = el('div');
      sec.append(el('.section-head', el('h2', { text: 'Publié ce jour' }), el('.rule'), el('.count', { text: posts.length })));
      posts.forEach(p => sec.append(A.Feed.postCard(p, () => render(main, { day: k }))));
      wrap.append(sec);
    }
    wrap.append(el('div', { style: { marginTop: '30px' } },
      el('button.btn.btn--ghost.btn--sm', {
        html: '＋ Ajouter un post à ce jour',
        onclick: () => A.go('feed', { date: k })
      })));

    main.append(wrap);
  }

  /* ---------- bandeau de semaine ---------- */
  function weekStrip(k, main) {
    const st = S();
    const week = A.weekOf(k, st.settings.weekStart);
    const strip = el('.weekstrip');
    strip.append(el('button.weekstrip__nav', { text: '‹', title: 'Semaine précédente', onclick: () => A.go('journal', { day: A.addDays(k, -7) }) }));
    week.forEach(dk => {
      const d = st.days[dk];
      const has = A.Store.dayHasContent(d) || A.Store.postsOf(dk).length > 0;
      const dt = A.parseKey(dk);
      const cell = el('button.weekstrip__day' +
        (dk === A.today() ? '.is-today' : '') +
        (dk === k ? '.is-sel' : '') +
        (has ? '.has-content' : ''), {
        onclick: () => A.go('journal', { day: dk })
      });
      cell.append(el('.weekstrip__dow', { text: A.JOURS_C[dt.getDay()] }));
      cell.append(el('.weekstrip__n', { text: dt.getDate() }));
      cell.append(el('.weekstrip__mark'));
      strip.append(cell);
    });
    strip.append(el('button.weekstrip__nav', { text: '›', title: 'Semaine suivante', onclick: () => A.go('journal', { day: A.addDays(k, 7) }) }));
    return strip;
  }

  A.Journal = { render, cover, addCoverBtn, tagEditor };
})(window.App);
