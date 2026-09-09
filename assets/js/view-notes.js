/* ============================================================
   ENCRE — vue Notes (pages libres)
   ============================================================ */
(function (A) {
  'use strict';
  const { el, uid } = A;
  const S = () => A.Store.state();

  function create() {
    const n = {
      id: uid('n'), titre: '', icon: '📄', cover: null, coverPos: 50,
      blocks: [{ id: uid('b'), type: 'text', html: '' }],
      tags: [], pinned: false, createdAt: Date.now(), updatedAt: Date.now()
    };
    S().notes.unshift(n);
    A.Store.save(true);
    return n;
  }

  function render(main, params) {
    if (params && params.id) return one(main, params.id);
    index(main);
  }

  /* ---------- index ---------- */
  function index(main) {
    const st = S();
    main.innerHTML = '';
    const wrap = el('.wrap.wrap--wide.fade-in');
    wrap.append(el('.page-kicker', { text: 'Pages libres' }));
    const head = el('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' } });
    head.append(el('div', el('h1.page-title', 'Mes ', el('em', { text: 'notes' })),
      el('p.page-sub', { style: { marginBottom: 0 }, text: 'Tout ce qui ne tient pas dans une journée.' })));
    head.append(el('div', { style: { flex: '1' } }));
    head.append(el('button.btn.btn--primary', { text: '＋ Nouvelle note', onclick: () => { const n = create(); A.go('notes', { id: n.id }); } }));
    wrap.append(head);
    wrap.append(el('div', { style: { height: '26px' } }));

    const notes = st.notes.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt);
    if (!notes.length) {
      wrap.append(el('.empty', el('.empty__mark', { text: '❧' }), el('h3', { text: 'Aucune note' }),
        el('p', { text: 'Créez une page pour vos listes, vos idées, vos brouillons.' }),
        el('button.btn.btn--primary', { text: 'Créer ma première note', onclick: () => { const n = create(); A.go('notes', { id: n.id }); } })));
      main.append(wrap); return;
    }

    const grid = el('.note-grid');
    notes.forEach(n => {
      const card = el('.note-card', { onclick: () => A.go('notes', { id: n.id }) });
      card.append(el('.note-card__strip'));
      card.append(el('.note-card__ico', { text: n.icon || '📄' }));
      card.append(el('h3', { text: n.titre || 'Sans titre' }));
      const txt = (n.blocks || []).map(b => (b.html || '').replace(/<[^>]*>/g, ' ')).join(' ').replace(/\s+/g, ' ').trim();
      card.append(el('p', { text: txt || '—' }));
      const foot = el('.note-card__foot');
      if (n.pinned) foot.append(el('span', { text: '📌' }));
      foot.append(el('span', { text: A.relTime(n.updatedAt) }));
      foot.append(el('span', { style: { marginLeft: 'auto' } }, el('button.icon-btn', {
        html: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>',
        onclick: (e) => { e.stopPropagation(); noteMenu(n, e.currentTarget, () => index(main)); }
      })));
      card.append(foot);
      grid.append(card);
    });
    wrap.append(grid);
    main.append(wrap);
  }

  function noteMenu(n, anchor, refresh) {
    A.menu(anchor, [
      { icon: '📌', label: n.pinned ? 'Désépingler' : 'Épingler', run: () => { n.pinned = !n.pinned; A.Store.save(true); refresh(); } },
      { icon: '😀', label: 'Changer l’icône', run: () => A.emojiPicker(v => { n.icon = v || '📄'; A.Store.save(true); refresh(); }, n.icon, anchor) },
      { icon: '⧉', label: 'Dupliquer', run: () => {
        const c = JSON.parse(JSON.stringify(n));
        c.id = uid('n'); c.titre = (c.titre || 'Sans titre') + ' (copie)'; c.createdAt = c.updatedAt = Date.now();
        c.blocks.forEach(b => b.id = uid('b'));
        S().notes.unshift(c); A.Store.save(true); refresh();
      } },
      '-',
      { icon: '🗑', label: 'Supprimer', run: () => A.confirmDlg('Supprimer cette note ?', n.titre || 'Sans titre', () => {
        if (n.cover) A.Media.del(n.cover);
        (n.blocks || []).forEach(b => (b.images || []).forEach(im => A.Media.del(im.id)));
        const s = S(); s.notes = s.notes.filter(x => x.id !== n.id);
        A.Store.save(); A.go('notes');
      }) }
    ]);
  }

  /* ---------- page d'une note ---------- */
  function one(main, id) {
    const n = S().notes.find(x => x.id === id);
    if (!n) return index(main);
    const save = (full) => { n.updatedAt = Date.now(); A.Store.save(true); if (full) one(main, id); A.refreshChrome(); };

    main.innerHTML = '';
    main.append(A.Journal.cover(n, save));

    const wrap = el('.wrap.fade-in');
    if (n.cover) wrap.style.paddingTop = '18px';

    const head = el('.doc-head');
    head.append(el('button.btn.btn--ghost.btn--sm', { text: '‹ Toutes les notes', style: { marginBottom: '14px' }, onclick: () => A.go('notes') }));
    head.append(el('.doc-icon', { text: n.icon || '📄', title: 'Changer l’icône', onclick: (e) => A.emojiPicker(v => { n.icon = v || '📄'; save(true); }, n.icon, e.currentTarget) }));
    head.append(el('h1.doc-title', {
      contenteditable: 'true', 'data-ph': 'Sans titre', text: n.titre || '',
      oninput: e => { n.titre = e.target.textContent; A.Store.save(true); },
      onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); const b = main.querySelector('.editor .block__body'); b && A.Editor.focusEnd(b); } }
    }));
    head.append(el('.doc-meta',
      el('span', { text: 'Modifiée ' + A.relTime(n.updatedAt) }),
      el('span', { text: '·' }),
      el('span', { text: A.words((n.blocks || []).map(b => (b.html || '').replace(/<[^>]*>/g, ' ')).join(' ')) + ' mots' })));

    const actions = el('.doc-actions');
    if (!n.cover) actions.append(A.Journal.addCoverBtn(n, save));
    actions.append(el('button.btn.btn--ghost.btn--sm', { text: n.pinned ? '📌 Épinglée' : '📌 Épingler', onclick: () => { n.pinned = !n.pinned; save(true); } }));
    actions.append(el('div', { style: { flex: '1' } }));
    actions.append(el('button.btn.btn--ghost.btn--sm', {
      text: '🗑', title: 'Supprimer',
      onclick: () => A.confirmDlg('Supprimer cette note ?', n.titre || 'Sans titre', () => {
        const s = S(); s.notes = s.notes.filter(x => x.id !== n.id); A.Store.save(); A.go('notes');
      })
    }));
    head.append(actions);
    head.append(A.Journal.tagEditor(n, save));
    wrap.append(head);

    const edHost = el('div', { style: { marginTop: '22px' } });
    wrap.append(edHost);
    A.Editor.mount(edHost, n, () => { n.updatedAt = Date.now(); A.Store.save(true); });

    main.append(wrap);
  }

  A.Notes = { render, create };
})(window.App);
