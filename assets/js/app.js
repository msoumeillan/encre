/* ============================================================
   ENCRE — routeur, palette de commandes, raccourcis
   ============================================================ */
(function (A) {
  'use strict';
  const { el, $, $$ } = A;
  const S = () => A.Store.state();

  const VIEWS = {
    journal:  (m, p) => A.Journal.render(m, p),
    agenda:   (m, p) => A.Agenda.render(m, p),
    feed:     (m, p) => A.Feed.render(m, p),
    carnets:  (m, p) => A.Carnets.render(m, p),
    notes:    (m, p) => A.Notes.render(m, p),
    coffre:   (m, p) => A.CoffreVue.render(m, p),
    settings: (m, p) => A.Settings.render(m, p)
  };

  let route = 'journal', params = {};

  /* ---------- navigation ---------- */
  const isNarrow = () => matchMedia('(max-width:720px)').matches;

  function go(r, p, replace) {
    if (!VIEWS[r]) r = 'journal';
    route = r; params = p || {};
    if (isNarrow() && S().settings.sidebar !== 'hidden') A.Store.setSetting('sidebar', 'hidden');
    const qs = new URLSearchParams(params).toString();
    const hash = '#' + r + (qs ? '?' + qs : '');
    if (location.hash !== hash) {
      if (replace) history.replaceState(null, '', hash);
      else history.pushState(null, '', hash);
    }
    paint();
  }

  function readHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) return { r: S().ui.lastRoute || 'journal', p: {} };
    const [r, qs] = h.split('?');
    const p = {};
    new URLSearchParams(qs || '').forEach((v, k) => p[k] = v);
    return { r, p };
  }

  function paint() {
    const main = $('#main');
    S().ui.lastRoute = route;
    A.Store.prune(route === 'journal' ? (params.day || S().ui.lastDay) : null);
    /* dans le coffre, les médias ajoutés sont chiffrés avant d'être rangés */
    A.Media.secret = (route === 'coffre');
    A.Store.save(true);
    try {
      VIEWS[route](main, params);
    } catch (e) {
      console.error(e);
      main.innerHTML = '';
      main.append(el('.wrap', el('.empty', el('.empty__mark', { text: '✕' }),
        el('h3', { text: 'Un souci d’affichage' }),
        el('p', { text: String(e && e.message || e) }),
        el('button.btn', { text: 'Retour au journal', onclick: () => go('journal') }))));
    }
    main.scrollTop = 0;
    refreshChrome();
  }

  /* ---------- barre latérale ---------- */
  function refreshChrome() {
    $$('.nav__item').forEach(n => n.classList.toggle('is-active', n.dataset.route === route));
    const st = S();
    const coffreOuvert = A.Coffre.estConfigure() && A.Coffre.estOuvert();
    const hc = $('#hintCoffre');
    if (hc) hc.textContent = A.Coffre.estConfigure() ? (coffreOuvert ? '🔓' : '🔒') : '';
    $('#hintToday').textContent = A.parseKey(A.today()).getDate();
    $('#hintPosts').textContent = st.posts.length || '';
    $('#streakN').textContent = A.Store.streak();

    const list = $('#collectionList');
    list.innerHTML = '';
    st.collections.forEach((c, i) => {
      const n = st.posts.filter(p => p.coll === c.id).length;
      list.append(el('a.coll-item' + (route === 'feed' && params.coll === c.id ? '.is-active' : ''), {
        draggable: 'true', 'data-i': i, title: c.nom + ' — glissez pour réordonner',
        onclick: () => go('feed', { coll: c.id })
      }, el('.coll-item__emoji', { text: c.emoji || '📓' }), el('span', { text: c.nom }), el('i', { text: n || '' })));
    });
    if (!st.collections.length) list.append(el('div', { style: { padding: '6px 10px', fontSize: '12px', color: 'var(--faint)' }, text: 'Aucun carnet' }));
  }

  /* ---------- réordonner les carnets par glisser-déposer ---------- */
  function bindCollectionDnD() {
    const list = $('#collectionList');
    let from = -1;
    const nettoie = () => list.querySelectorAll('.coll-item').forEach(n => n.classList.remove('drop-t', 'drop-b', 'is-drag'));

    list.addEventListener('dragstart', e => {
      const it = e.target.closest('.coll-item');
      if (!it) return;
      from = +it.dataset.i;
      it.classList.add('is-drag');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', 'coll:' + from); } catch (x) {}
    });
    list.addEventListener('dragend', nettoie);
    list.addEventListener('dragover', e => {
      if (from < 0) return;
      e.preventDefault();
      const it = e.target.closest('.coll-item');
      list.querySelectorAll('.coll-item').forEach(n => n.classList.remove('drop-t', 'drop-b'));
      if (!it || +it.dataset.i === from) return;
      const r = it.getBoundingClientRect();
      it.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-t' : 'drop-b');
    });
    list.addEventListener('drop', e => {
      if (from < 0) return;
      const it = e.target.closest('.coll-item');
      if (!it) return;
      e.preventDefault();
      const r = it.getBoundingClientRect();
      const avant = e.clientY < r.top + r.height / 2;
      let to = +it.dataset.i;
      const cols = S().collections;
      const [pris] = cols.splice(from, 1);
      if (!avant) to++;
      if (from < to) to--;
      cols.splice(A.clamp(to, 0, cols.length), 0, pris);
      from = -1;
      nettoie();
      A.Store.save(true);
      refreshChrome();
      if (route === 'carnets') paint();
    });
  }

  /* ============================================================
     Palette de commandes (⌘K)
     ============================================================ */
  let pal = { open: false, sel: 0, items: [] };

  function openPalette(prefill) {
    const host = $('#palette'), input = $('#paletteInput');
    host.hidden = false; pal.open = true;
    input.value = prefill || '';
    buildPalette(input.value);
    setTimeout(() => input.focus(), 30);
  }
  function closePalette() { $('#palette').hidden = true; pal.open = false; }

  function commands() {
    return [
      { grp: 'Aller à', ico: '✒', t: "Aujourd'hui", s: A.longDate(A.today()), run: () => go('journal', { day: A.today() }) },
      { grp: 'Aller à', ico: '📅', t: 'Agenda', s: 'Vue mensuelle et annuelle', run: () => go('agenda') },
      { grp: 'Aller à', ico: '❋', t: 'Le fil', s: 'Posts courts', run: () => go('feed') },
      { grp: 'Aller à', ico: '📚', t: 'Carnets', s: 'Collections thématiques', run: () => go('carnets') },
      { grp: 'Aller à', ico: '📄', t: 'Notes', s: 'Pages libres', run: () => go('notes') },
      { grp: 'Aller à', ico: '🔒', t: 'Coffre secret', s: 'Pages chiffrées', run: () => go('coffre') },
      { grp: 'Aller à', ico: '⚙', t: 'Réglages', s: 'Thème, polices, données', run: () => go('settings') },
      { grp: 'Créer', ico: '＋', t: 'Nouvelle note', s: 'Page libre', run: () => { const n = A.Notes.create(); go('notes', { id: n.id }); } },
      { grp: 'Créer', ico: '❋', t: 'Nouveau post', s: 'Écrire dans le fil', run: () => go('feed') },
      { grp: 'Créer', ico: '📓', t: 'Nouveau carnet', s: 'Collection', run: () => { go('carnets'); setTimeout(() => A.Carnets.editColl(null, () => go('carnets')), 60); } },
      { grp: 'Créer', ico: '🖼', t: 'Couverture du jour', s: 'Ajouter une image', run: async () => {
        const got = await A.Media.pick(false);
        if (got[0]) { const d = A.Store.day(params.day || A.today(), true); d.cover = got[0].id; d.coverPos = 50; A.Store.save(true); go('journal', { day: d.date }); }
      } },
      { grp: 'Affichage', ico: '◐', t: 'Clair / sombre', s: 'Basculer le thème', run: toggleDark },
      { grp: 'Affichage', ico: '▤', t: 'Replier le menu', s: 'Mode concentration', run: toggleSidebar },
      { grp: 'Données', ico: '↓', t: 'Exporter une sauvegarde', s: 'JSON avec images', run: async () => { A.toast('Préparation…'); A.download(`encre-sauvegarde-${A.today()}.json`, await A.Store.exportJSON(true)); } },
      { grp: 'Données', ico: '↓', t: 'Exporter en Markdown', s: 'Texte brut', run: () => A.download(`encre-${A.today()}.md`, A.Store.exportMarkdown(), 'text/markdown') }
    ];
  }

  function buildPalette(q) {
    const box = $('#paletteResults');
    const st = S();
    box.innerHTML = '';
    const query = q.trim();
    let items = [];

    /* saut vers une date : "12/03", "2026-03-12", "hier" */
    const dk = parseDateQuery(query);
    if (dk) items.push({ grp: 'Date', ico: '📅', t: A.longDate(dk), s: 'Ouvrir cette journée', score: 200, run: () => go('journal', { day: dk }) });

    commands().forEach(c => {
      const sc = query ? Math.max(A.fuzzy(query, c.t), A.fuzzy(query, c.s)) : 50;
      if (sc >= 0) items.push(Object.assign({ score: sc + (query ? 0 : 10) }, c));
    });

    if (query) {
      Object.keys(st.days).forEach(k => {
        const d = st.days[k];
        if (!A.Store.dayHasContent(d)) return;
        const txt = A.Store.dayText(d);
        const sc = Math.max(A.fuzzy(query, d.titre || ''), A.fuzzy(query, txt), A.fuzzy(query, A.longDate(k)));
        if (sc > 8) items.push({ grp: 'Journal', ico: '✒', t: d.titre || A.longDate(k), s: A.truncate(txt, 70), meta: A.midDate(k), score: sc, run: () => go('journal', { day: k }) });
      });
      st.posts.forEach(p => {
        const sc = Math.max(A.fuzzy(query, p.texte), p.titre ? A.fuzzy(query, p.titre) + 10 : -1);
        if (sc > 8) items.push({
          grp: 'Fil', ico: '❋',
          t: p.titre ? p.titre + (p.episode ? ' · ép. ' + p.episode : '') : (A.truncate(p.texte, 54) || 'Post'),
          s: A.truncate(p.texte, 70), meta: A.midDate(p.date), score: sc,
          run: () => p.titre ? go('feed', { serie: p.titre, coll: p.coll || '' }) : go('feed', { date: p.date })
        });
      });
      Array.from(new Set(st.posts.map(p => p.titre).filter(Boolean))).forEach(t => {
        const sc = A.fuzzy(query, t);
        if (sc > 20) items.push({ grp: 'Séries', ico: '▤', t, s: 'Ouvrir la série dans l’ordre des épisodes', score: sc + 20, run: () => go('feed', { serie: t }) });
      });
      st.notes.forEach(n => {
        const txt = (n.blocks || []).map(b => (b.html || '').replace(/<[^>]*>/g, ' ')).join(' ');
        const sc = Math.max(A.fuzzy(query, n.titre || ''), A.fuzzy(query, txt));
        if (sc > 8) items.push({ grp: 'Notes', ico: n.icon || '📄', t: n.titre || 'Sans titre', s: A.truncate(txt, 70), score: sc, run: () => go('notes', { id: n.id }) });
      });
      st.collections.forEach(c => {
        const sc = A.fuzzy(query, c.nom);
        if (sc > 8) items.push({ grp: 'Carnets', ico: c.emoji || '📓', t: c.nom, s: c.desc || '', score: sc, run: () => go('feed', { coll: c.id }) });
      });
      A.Store.allTags().forEach(([t, n]) => {
        const sc = A.fuzzy(query.replace(/^#/, ''), t);
        if (sc > 20) items.push({ grp: 'Mots-clés', ico: '#', t, s: n + ' occurrence' + (n > 1 ? 's' : ''), score: sc, run: () => go('feed', { tag: t }) });
      });
    }

    items.sort((a, b) => b.score - a.score);
    items = items.slice(0, 40);
    pal.items = items;
    pal.sel = A.clamp(pal.sel, 0, Math.max(0, items.length - 1));

    if (!items.length) {
      box.append(el('.pal-group', { text: 'Aucun résultat' }));
      return;
    }
    let grp = '';
    items.forEach((it, i) => {
      if (it.grp !== grp) { grp = it.grp; box.append(el('.pal-group', { text: grp })); }
      box.append(el('.pal-item' + (i === pal.sel ? '.is-sel' : ''), {
        onmouseenter: () => { pal.sel = i; paintSel(); },
        onclick: () => { closePalette(); it.run(); }
      },
        el('.pal-item__ico', { text: it.ico }),
        el('.pal-item__txt', el('b', { text: it.t }), it.s ? el('small', { text: it.s }) : ''),
        it.meta ? el('.pal-item__meta', { text: it.meta }) : ''));
    });
  }

  function paintSel() {
    $$('#paletteResults .pal-item').forEach((n, i) => n.classList.toggle('is-sel', i === pal.sel));
    const cur = $('#paletteResults .is-sel');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }

  function parseDateQuery(q) {
    q = q.trim().toLowerCase();
    if (!q) return null;
    if (q === "aujourd'hui" || q === 'aujourdhui' || q === 'today') return A.today();
    if (q === 'hier') return A.addDays(A.today(), -1);
    if (q === 'demain') return A.addDays(A.today(), 1);
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(q);
    if (m) return A.key(new Date(+m[1], +m[2] - 1, +m[3]));
    m = /^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/.exec(q);
    if (m) {
      const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear();
      return A.key(new Date(y, +m[2] - 1, +m[1]));
    }
    return null;
  }

  /* ---------- thème clair/sombre ---------- */
  const PAIRS = { papier: 'encre', lin: 'foret', sakura: 'nuit', brume: 'nuit', encre: 'papier', foret: 'lin', nuit: 'brume' };
  function toggleDark() {
    const cur = S().settings.theme;
    A.Store.setSetting('theme', PAIRS[cur] || (A.Store.DARK.has(cur) ? 'papier' : 'encre'));
    if (route === 'settings') paint();
  }
  function toggleSidebar() {
    const s = S().settings;
    A.Store.setSetting('sidebar', s.sidebar === 'hidden' ? 'shown' : 'hidden');
  }

  /* ============================================================
     Raccourcis clavier
     ============================================================ */
  function bindKeys() {
    document.addEventListener('keydown', (e) => {
      const mod = e.metaKey || e.ctrlKey;
      const typing = /^(INPUT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable;

      if (pal.open) {
        if (e.key === 'Escape') { e.preventDefault(); closePalette(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); pal.sel = Math.min(pal.sel + 1, pal.items.length - 1); paintSel(); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); pal.sel = Math.max(pal.sel - 1, 0); paintSel(); return; }
        if (e.key === 'Enter') { e.preventDefault(); const it = pal.items[pal.sel]; if (it) { closePalette(); it.run(); } return; }
        return;
      }

      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
      if (mod && e.key.toLowerCase() === 'j') { e.preventDefault(); go('journal', { day: A.today() }); return; }
      if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleSidebar(); return; }
      if (mod && e.key === ',') { e.preventDefault(); go('settings'); return; }
      if (mod && e.key.toLowerCase() === 'd' && !typing) { e.preventDefault(); toggleDark(); return; }

      if (typing) return;
      if (route === 'journal' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const k = params.day || S().ui.lastDay || A.today();
        go('journal', { day: A.addDays(k, e.key === 'ArrowLeft' ? -1 : 1) });
      }
    });
  }

  /* ============================================================
     Démarrage
     ============================================================ */
  function init() {
    A.Store.load();
    A.Store.applyTheme();
    A.Gallery.bindLightbox();

    /* barre latérale */
    $('#brandBtn').onclick = () => go('journal', { day: A.today() });
    $('#searchBtn').onclick = () => openPalette();
    $('#collapseBtn').onclick = toggleSidebar;
    $('#sidebarPeek').onclick = toggleSidebar;
    $('#themeToggle').onclick = toggleDark;
    $('#settingsBtn').onclick = () => go('settings');
    $('#addCollectionBtn').onclick = () => A.Carnets.editColl(null, () => { refreshChrome(); if (route === 'carnets') paint(); });
    $('#streakBox').onclick = () => go('agenda');
    $$('.nav__item').forEach(n => n.onclick = () => go(n.dataset.route));

    /* palette */
    $('#paletteInput').addEventListener('input', e => { pal.sel = 0; buildPalette(e.target.value); });
    $('#palette').addEventListener('mousedown', e => { if (e.target.id === 'palette') closePalette(); });

    /* sur mobile, le menu est un tiroir : replié par défaut, refermé au clic */
    if (isNarrow()) A.Store.setSetting('sidebar', 'hidden');
    $('#main').addEventListener('pointerdown', () => {
      if (isNarrow() && S().settings.sidebar !== 'hidden') A.Store.setSetting('sidebar', 'hidden');
    }, true);

    A.Coffre.surveiller();
    bindCollectionDnD();
    bindKeys();
    window.addEventListener('hashchange', () => { const { r, p } = readHash(); route = r; params = p; paint(); });
    window.addEventListener('beforeunload', () => A.Store.flush());
    document.addEventListener('visibilitychange', () => { if (document.hidden) A.Store.flush(); });

    /* premier rendu */
    const { r, p } = readHash();
    if (!location.hash) {
      const st = S();
      go(st.ui.lastRoute || 'journal', st.ui.lastRoute === 'journal' ? { day: A.today() } : {}, true);
    } else {
      route = VIEWS[r] ? r : 'journal'; params = p; paint();
    }

    /* le jour change pendant que l'onglet est ouvert */
    let jour = A.today();
    setInterval(() => {
      const t = A.today();
      if (t !== jour) { jour = t; refreshChrome(); }
    }, 60000);
  }

  Object.assign(A, { go, paint, refreshChrome, openPalette, toggleDark, toggleSidebar, route: () => route });
  document.addEventListener('DOMContentLoaded', init);
})(window.App);
