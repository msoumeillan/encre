/* ============================================================
   ENCRE — vue Carnets (collections thématiques)
   ============================================================ */
(function (A) {
  'use strict';
  const { el, uid } = A;
  const S = () => A.Store.state();

  function postsOf(id) { return S().posts.filter(p => p.coll === id); }

  function infos(c) {
    const ps = postsOf(c.id);
    const notes = ps.filter(p => p.rating).map(p => p.rating);
    const moy = notes.length ? (notes.reduce((a, b) => a + b, 0) / notes.length) : 0;
    const cover = c.cover || (ps.find(p => p.images && p.images.length) || {}).images?.[0]?.id || null;
    const imgs = ps.reduce((n, p) => n + (p.images || []).length, 0);
    return { ps, moy, cover, imgs, n: ps.length };
  }

  /* ---------- index ---------- */
  function render(main) {
    const st = S();
    main.innerHTML = '';
    const wrap = el('.wrap.wrap--wide.fade-in');

    wrap.append(el('.page-kicker', { text: 'Collections' }));
    wrap.append(el('h1.page-title', 'Mes ', el('em', { text: 'carnets' })));
    wrap.append(el('p.page-sub', { text: 'Un carnet par obsession : animes, films, lectures, cuisine… Chaque post s’y range.' }));

    const grid = el('.carnet-grid');
    st.collections.forEach(c => {
      const i = infos(c);
      const card = el('.carnet-card', { onclick: () => A.go('feed', { coll: c.id }) });
      const cov = el('.carnet-card__cover');
      if (i.cover) cov.append(A.Media.img(i.cover));
      else cov.append(el('.carnet-card__ph', { text: c.emoji || '📓' }));
      card.append(cov);
      const body = el('.carnet-card__body');
      body.append(el('h3', { text: (c.emoji ? c.emoji + ' ' : '') + c.nom }));
      if (c.desc) body.append(el('p', { text: c.desc }));
      const meta = el('.carnet-card__meta');
      meta.append(el('span', { text: i.n + (i.n > 1 ? ' entrées' : ' entrée') }));
      const nSeries = A.Feed.series(i.ps).length;
      if (nSeries) meta.append(el('span', { text: '· ' + nSeries + (nSeries > 1 ? ' séries' : ' série') }));
      else if (i.imgs) meta.append(el('span', { text: '· ' + i.imgs + ' img' }));
      if (i.moy) meta.append(el('span', { style: { marginLeft: 'auto', color: 'var(--accent)' }, text: '★ ' + i.moy.toFixed(1) }));
      body.append(meta);
      card.append(body);
      card.append(el('button.icon-btn', {
        style: { position: 'absolute', top: '8px', right: '8px', background: 'color-mix(in oklab,var(--surface) 80%,transparent)', backdropFilter: 'blur(6px)' },
        html: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>',
        onclick: (e) => { e.stopPropagation(); collMenu(c, e.currentTarget, () => render(main)); }
      }));
      grid.append(card);
    });

    grid.append(el('button.carnet-card', {
      style: { display: 'grid', placeItems: 'center', minHeight: '190px', borderStyle: 'dashed', color: 'var(--muted)' },
      onclick: () => editColl(null, () => render(main))
    }, el('div', { style: { textAlign: 'center' } },
      el('div', { text: '＋', style: { fontSize: '26px', marginBottom: '6px' } }),
      el('div', { text: 'Nouveau carnet', style: { fontSize: '13px' } }))));

    wrap.append(grid);

    /* — dernières entrées toutes collections — */
    const recents = st.posts.filter(p => p.coll).slice(0, 8);
    if (recents.length) {
      wrap.append(el('.section-head', el('h2', { text: 'Dernières entrées' }), el('.rule')));
      recents.forEach(p => {
        const c = A.Store.collection(p.coll);
        const row = el('.entry-row', { onclick: () => A.go('feed', { coll: p.coll }) });
        if (p.images && p.images.length) row.append(A.Media.img(p.images[0].id, { class: 'entry-row__img' }));
        const txt = el('.entry-row__txt');
        const titre = p.titre
          ? p.titre + (p.episode ? ' · ép. ' + p.episode : '')
          : (A.truncate(p.texte, 64) || (c ? c.nom : 'Entrée'));
        txt.append(el('h4', { text: titre }));
        txt.append(el('p', { text: A.truncate(p.texte, 160) }));
        const meta = el('.carnet-card__meta');
        meta.append(el('span', { text: (c ? c.emoji + ' ' + c.nom + ' · ' : '') + A.relDate(p.date) }));
        if (p.rating) meta.append(el('span', { style: { color: 'var(--accent)' }, text: '★ ' + A.Editor.noteTexte(p.rating) }));
        txt.append(meta);
        row.append(txt);
        wrap.append(row);
      });
    }

    main.append(wrap);
  }

  /* ---------- bandeau de stats affiché dans le fil ---------- */
  function statsStrip(collId) {
    const c = A.Store.collection(collId);
    if (!c) return null;
    const i = infos(c);
    if (!i.n) return null;
    const box = el('.stats', { style: { margin: '4px 0 22px' } });
    box.append(el('.stat', el('b', { text: String(i.n) }), el('small', { text: 'entrées' })));
    if (i.moy) box.append(el('.stat.stat--accent', el('b', { text: i.moy.toFixed(1) }), el('small', { text: 'note moyenne' })));
    box.append(el('.stat', el('b', { text: String(i.imgs) }), el('small', { text: 'images' })));
    const best = i.ps.filter(p => p.rating).sort((a, b) => b.rating - a.rating)[0];
    if (best) box.append(el('.stat', el('b', { text: '★ ' + A.Editor.noteTexte(best.rating), style: { fontSize: '20px', color: 'var(--accent)' } }),
      el('small', { text: A.truncate(best.titre || best.texte, 26) || 'meilleure note' })));
    return box;
  }

  /* ---------- menu / édition ---------- */
  function collMenu(c, anchor, refresh) {
    A.menu(anchor, [
      { icon: '✎', label: 'Modifier', run: () => editColl(c, refresh) },
      { icon: '🖼', label: 'Image de couverture', run: async () => {
        const got = await A.Media.pick(false);
        if (got[0]) { c.cover = got[0].id; A.Store.save(true); refresh(); }
      } },
      { icon: '→', label: 'Ouvrir', run: () => A.go('feed', { coll: c.id }) },
      '-',
      { icon: '🗑', label: 'Supprimer', run: () => A.confirmDlg('Supprimer « ' + c.nom + ' » ?',
        'Les entrées ne sont pas supprimées : elles perdent simplement leur carnet.',
        () => {
          const s = S();
          s.collections = s.collections.filter(x => x.id !== c.id);
          s.posts.forEach(p => { if (p.coll === c.id) p.coll = ''; });
          A.Store.save(); refresh(); A.refreshChrome();
        }) }
    ]);
  }

  function editColl(c, refresh) {
    const isNew = !c;
    const nom = el('input.input', { value: c ? c.nom : '', placeholder: 'Animes, Films, Recettes…', autofocus: true });
    const emoji = el('input.input', { value: c ? (c.emoji || '') : '📓', style: { width: '80px', textAlign: 'center', fontSize: '20px' } });
    const desc = el('input.input', { value: c ? (c.desc || '') : '', placeholder: 'Une phrase de description (facultatif)' });
    /* certains carnets suivent des épisodes (séries), d'autres non (films, livres) */
    let episodes = c ? c.episodes !== false : true;
    const sw = el('.switch' + (episodes ? '.is-on' : ''));
    const rowEp = el('.row-toggle', {
      style: { cursor: 'pointer', borderBottom: '0' },
      onclick: () => { episodes = !episodes; sw.classList.toggle('is-on', episodes); }
    }, el('.row-toggle__text',
      el('b', { text: 'Suivre des épisodes' }),
      el('small', { text: 'Ajoute le champ « ép. » — à couper pour les films ou les livres.' })), sw);

    const body = el('div',
      el('.field', el('.field__label', { text: 'Nom & icône' }),
        el('div', { style: { display: 'flex', gap: '8px' } },
          el('button.btn', { text: '😀', title: 'Choisir un emoji', onclick: (e) => A.emojiPicker(v => emoji.value = v, emoji.value, e.currentTarget) }),
          emoji, nom)),
      el('.field', el('.field__label', { text: 'Description' }), desc),
      rowEp);
    A.dialog({
      title: isNew ? 'Nouveau carnet' : 'Modifier le carnet',
      sub: 'Les carnets regroupent vos posts par thème.',
      body, ok: isNew ? 'Créer' : 'Enregistrer',
      onOk: () => {
        const n = nom.value.trim();
        if (!n) { nom.focus(); return false; }
        const champs = { nom: n, emoji: emoji.value.trim() || '📓', desc: desc.value.trim(), episodes };
        if (isNew) S().collections.push(Object.assign({ id: uid('c'), rating: true }, champs));
        else Object.assign(c, champs);
        A.Store.save(); refresh(); A.refreshChrome();
      }
    });
  }

  A.Carnets = { render, statsStrip, editColl, infos };
})(window.App);
