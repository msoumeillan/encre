/* ============================================================
   ENCRE — vue Fil (posts courts façon tweets)
   Un post peut porter un TITRE (la série : « My Hero Academia »)
   et un NUMÉRO D'ÉPISODE. Le titre devient automatiquement un
   mot-clé, ce qui permet de retrouver toute la série et de la
   relire dans l'ordre des épisodes.
   ============================================================ */
(function (A) {
  'use strict';
  const { el, uid } = A;
  const S = () => A.Store.state();

  let filtre = { coll: '', tag: '', serie: '', q: '' };
  let draft = null;

  function newDraft(date) {
    return { titre: '', episode: '', texte: '', images: [], layout: 'auto', url: '', rating: 0, coll: '', date: date || A.today() };
  }

  /** Complète une intégration via le relais local, une seule fois par lien. */
  function chercherEmbed(objet, apres) {
    chercherFilm(objet, apres);
    chercherTweet(objet, apres);
  }

  function chercherTweet(objet, apres) {
    if (!objet.url || objet.tweetEnCours === objet.url) return;
    if (A.Embed.tweetAJour(objet.tweet, objet.url)) return;
    const info = A.Embed.parse(objet.url);
    if (!info || info.kind !== 'x') return;
    objet.tweetEnCours = objet.url;
    A.Embed.enrichirTweet(objet.url).then(tweet => {
      objet.tweetEnCours = null;
      if (!tweet) return;              // relais absent : on garde l'iframe
      tweet.pourUrl = objet.url;
      objet.tweet = tweet;
      A.Store.save(true);
      apres && apres();
    });
  }

  function chercherFilm(objet, apres) {
    if (!objet.url || objet.filmEnCours === objet.url) return;
    if (objet.film && objet.film.pourUrl === objet.url) return;
    const info = A.Embed.parse(objet.url);
    if (!info || info.kind !== 'film') return;
    objet.filmEnCours = objet.url;
    A.Embed.enrichirFilm(objet.url).then(film => {
      objet.filmEnCours = null;
      if (!film) return;                 // relais absent : la fiche reste manuelle
      /* une affiche choisie à la main l'emporte sur celle de Letterboxd */
      if (objet.film && objet.film.afficheManuelle && objet.film.posterId) {
        film.posterId = objet.film.posterId;
        film.afficheManuelle = true;
      }
      film.pourUrl = objet.url;
      objet.film = film;
      if (!objet.rating && film.note) objet.rating = film.note;
      A.Store.save(true);
      apres && apres();
    });
  }

  /* numéro d'épisode exploitable pour le tri */
  function epNum(p) {
    const n = parseFloat(String(p.episode || '').replace(',', '.'));
    return isNaN(n) ? Infinity : n;
  }

  /** séries présentes dans un ensemble de posts */
  function series(posts) {
    const m = new Map();
    posts.forEach(p => {
      if (!p.titre) return;
      let s = m.get(p.titre);
      if (!s) m.set(p.titre, s = { titre: p.titre, n: 0, notes: [], cover: null, dernier: '', coll: p.coll });
      s.n++;
      if (p.rating) s.notes.push(p.rating);
      if (!s.cover && p.images && p.images.length) s.cover = p.images[0].id;
      if (p.date > s.dernier) s.dernier = p.date;
    });
    return Array.from(m.values()).map(s => Object.assign(s, {
      moy: s.notes.length ? s.notes.reduce((a, b) => a + b, 0) / s.notes.length : 0
    })).sort((a, b) => b.dernier.localeCompare(a.dernier));
  }

  /* ============================================================
     Rendu principal
     ============================================================ */
  function render(main, params) {
    const st = S();
    params = params || {};
    if (params.coll !== undefined) filtre.coll = params.coll || '';
    if (params.tag) filtre.tag = params.tag;
    if (params.serie !== undefined) filtre.serie = params.serie || '';
    if (!draft) draft = newDraft(params.date);
    if (params.date) draft.date = params.date;
    /* dans l'onglet d'un carnet, le nouveau post y va d'office */
    if (filtre.coll) draft.coll = filtre.coll;

    main.innerHTML = '';
    const wrap = el('.wrap.wrap--mid.fade-in');

    const coll = filtre.coll ? A.Store.collection(filtre.coll) : null;

    if (filtre.serie) {
      wrap.append(enteteSerie(main));
    } else {
      wrap.append(el('.page-kicker', { text: coll ? 'Carnet' : 'Le fil' }));
      wrap.append(el('h1.page-title', coll ? (coll.emoji + ' ' + coll.nom) : 'Ce qui me passe ', coll ? '' : el('em', { text: 'par la tête' })));
      wrap.append(el('p.page-sub', { text: coll ? (coll.desc || '') : 'Des notes courtes, des images, des liens. Comme un carnet ouvert.' }));
      if (coll) {
        const strip = A.Carnets.statsStrip(coll.id);
        if (strip) wrap.append(strip);
      }
    }

    wrap.append(composer(main));

    /* — séries du carnet courant — */
    const bassin = filtre.coll ? st.posts.filter(p => p.coll === filtre.coll) : st.posts;
    const listeSeries = series(bassin);
    if (listeSeries.length && !filtre.serie) {
      wrap.append(el('.section-head', el('h2', { text: 'Séries' }), el('.rule'), el('.count', { text: listeSeries.length })));
      const row = el('.serie-row');
      listeSeries.forEach(s => {
        const c = el('button.serie-chip', { onclick: () => { filtre.serie = s.titre; render(main); } });
        if (s.cover) c.append(A.Media.img(s.cover, { class: 'serie-chip__img' }));
        c.append(el('.serie-chip__txt',
          el('b', { text: s.titre }),
          el('small', { text: s.n + (s.n > 1 ? ' épisodes' : ' épisode') + (s.moy ? ' · ★ ' + s.moy.toFixed(1) : '') })));
        row.append(c);
      });
      wrap.append(row);
    }

    /* — filtres — */
    const bar = el('.toolbar', { style: { margin: '26px 0 8px' } });
    bar.append(el('button.chip' + (!filtre.coll ? '.is-on' : ''), { text: 'Tout', onclick: () => { filtre.coll = ''; filtre.serie = ''; render(main); } }));
    st.collections.forEach(c => bar.append(el('button.chip' + (filtre.coll === c.id ? '.is-on' : ''), {
      text: c.emoji + ' ' + c.nom, onclick: () => { filtre.coll = filtre.coll === c.id ? '' : c.id; filtre.serie = ''; render(main); }
    })));
    if (filtre.tag) bar.append(el('button.chip.is-on', { text: '#' + filtre.tag + ' ✕', onclick: () => { filtre.tag = ''; render(main); } }));
    bar.append(el('div', { style: { flex: '1' } }));
    bar.append(el('input.input', {
      placeholder: 'Filtrer…', value: filtre.q,
      style: { width: '150px', padding: '5px 10px', fontSize: '13px' },
      oninput: A.debounce(e => { filtre.q = e.target.value; paintList(); }, 200)
    }));
    wrap.append(bar);

    const list = el('div');
    wrap.append(list);
    main.append(wrap);

    function paintList() {
      list.innerHTML = '';
      let posts = st.posts.slice();
      if (filtre.coll) posts = posts.filter(p => p.coll === filtre.coll);
      if (filtre.serie) posts = posts.filter(p => p.titre === filtre.serie);
      if (filtre.tag) posts = posts.filter(p => (p.tags || []).includes(filtre.tag));
      if (filtre.q) {
        const q = A.plain(filtre.q);
        posts = posts.filter(p => A.plain([p.titre, p.episode, p.texte, (p.tags || []).join(' ')].join(' ')).includes(q));
      }

      /* dans une série : ordre des épisodes.
         sinon : par DATE d'abord — c'est elle qui fait les groupes de jour,
         donc changer la date d'un post le replace au bon endroit. */
      if (filtre.serie) posts.sort((a, b) => epNum(a) - epNum(b) || a.createdAt - b.createdAt);
      else posts.sort((a, b) =>
        (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
        String(b.date).localeCompare(String(a.date)) ||
        b.createdAt - a.createdAt);

      if (!posts.length) {
        list.append(el('.empty',
          el('.empty__mark', { text: '❧' }),
          el('h3', { text: 'Rien ici pour l’instant' }),
          el('p', { text: 'Écrivez quelques mots au-dessus — une impression, une review, une image.' })));
        return;
      }
      let jour = '';
      posts.forEach(p => {
        if (!filtre.serie && !p.pinned && p.date !== jour) {
          jour = p.date;
          list.append(el('.feed-day', el('b', { text: A.relDate(p.date) }), el('span', { text: A.midDate(p.date) })));
        }
        list.append(postCard(p, () => render(main)));
      });
    }
    paintList();
  }

  /* ---------- en-tête quand une série est ouverte ---------- */
  function enteteSerie(main) {
    const st = S();
    const posts = st.posts.filter(p => p.titre === filtre.serie && (!filtre.coll || p.coll === filtre.coll));
    const s = series(posts)[0] || { n: 0, moy: 0 };
    const box = el('div');
    box.append(el('button.btn.btn--ghost.btn--sm', { text: '‹ Toutes les séries', style: { marginBottom: '12px' }, onclick: () => { filtre.serie = ''; render(main); } }));
    box.append(el('.page-kicker', { text: 'Série · dans l’ordre des épisodes' }));
    box.append(el('h1.page-title', { text: filtre.serie }));
    const meta = el('.stats', { style: { margin: '10px 0 22px' } });
    meta.append(el('.stat', el('b', { text: String(s.n) }), el('small', { text: s.n > 1 ? 'épisodes' : 'épisode' })));
    if (s.moy) meta.append(el('.stat.stat--accent', el('b', { text: s.moy.toFixed(1) }), el('small', { text: 'note moyenne' })));
    const nums = posts.map(epNum).filter(n => isFinite(n));
    if (nums.length) meta.append(el('.stat', el('b', { text: String(Math.max.apply(null, nums)), style: { fontSize: '22px' } }), el('small', { text: 'dernier épisode' })));
    box.append(meta);
    return box;
  }

  /* ============================================================
     Composeur
     ============================================================ */
  function composer(main) {
    const st = S();
    const box = el('.composer');

    /* — ligne titre / épisode — */
    const dl = el('datalist', { id: 'series-connues' });
    Array.from(new Set(st.posts.map(p => p.titre).filter(Boolean))).forEach(t => dl.append(el('option', { value: t })));

    const titreInp = el('input.composer__titre', {
      placeholder: 'Titre — série, film, livre…', value: draft.titre, list: 'series-connues',
      oninput: e => draft.titre = e.target.value
    });
    const epInp = el('input.composer__ep', {
      placeholder: 'Ép.', value: draft.episode,
      oninput: e => draft.episode = e.target.value
    });
    const epBoite = el('span.composer__epwrap', epInp);
    /* un carnet sans épisodes (Films, Livres…) n'affiche pas ce champ */
    const majEpisodes = () => {
      const c = draft.coll ? A.Store.collection(draft.coll) : null;
      const montre = !c || c.episodes !== false;
      epBoite.classList.toggle('is-hidden', !montre);
      if (!montre) { draft.episode = ''; epInp.value = ''; }
    };
    box.append(el('.composer__meta', dl, titreInp, epBoite));

    const area = el('.composer__area', {
      contenteditable: 'true', 'data-ph': 'Votre review, une impression… (# pour un mot-clé)',
      spellcheck: st.settings.spellcheck ? 'true' : 'false',
      oninput: e => { draft.texte = e.target.innerText; count.textContent = draft.texte.length ? draft.texte.length + ' car.' : ''; },
      onfocus: () => box.classList.add('is-focus'),
      onpaste: e => {
        const files = Array.from((e.clipboardData && e.clipboardData.files) || []).filter(f => /^(image|video)\//.test(f.type));
        if (files.length) { e.preventDefault(); addImages(files); return; }
        const t = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
        if (A.Embed.looksEmbeddable(t) && !draft.url) { e.preventDefault(); draft.url = t.trim(); repaint(); return; }
        e.preventDefault(); document.execCommand('insertText', false, t); draft.texte = area.innerText;
      },
      onkeydown: e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); publish(); } }
    });
    area.textContent = draft.texte;

    box.append(el('.composer__top', el('.composer__ava', { text: st.settings.initial || '✦' }), area));

    const media = el('div', { style: { marginTop: '10px' } });
    const count = el('.composer__count', { text: draft.texte.length ? draft.texte.length + ' car.' : '' });

    function repaint() {
      media.innerHTML = '';
      if (draft.images.length) {
        media.append(A.Gallery.render({
          images: draft.images, layout: draft.layout, editable: true, keepLayout: true,
          onChange: (imgs, lay) => { draft.images = imgs; if (lay) draft.layout = lay; repaint(); }
        }));
      }
      if (draft.url) {
        const infoUrl = A.Embed.parse(draft.url);
        media.append(el('div', { style: { marginTop: '10px' } }, A.Embed.render(draft.url, {
          film: draft.film, tweet: draft.tweet,
          reglages: draft.reglages,
          onReglages: (r) => { draft.reglages = r; repaint(); },
          onAffiche: infoUrl && infoUrl.kind === 'film' ? () => A.Embed.choisirAffiche(draft, repaint) : null,
          extra: el('button', { text: 'retirer', style: { fontSize: '11.5px', color: 'var(--muted)' }, onclick: () => { draft.url = ''; draft.film = null; repaint(); } })
        })));
        chercherEmbed(draft, repaint);
      }
      if (draft.rating) {
        const val = el('.b-rating__val', { text: A.Editor.noteTexte(draft.rating) + '/5' });
        media.append(el('div', { style: { marginTop: '10px' } },
          el('.b-rating', el('.b-rating__label', { text: 'Ma note' }),
            A.Editor.starsWidget(draft.rating, v => { draft.rating = v; val.textContent = A.Editor.noteTexte(v) + '/5'; }),
            val)));
      }
    }

    async function addImages(files) {
      const got = files ? await A.Media.putMany(files) : await A.Media.pick(true);
      if (!got.length) return;
      draft.images = draft.images.concat(got.map(m => ({ id: m.id, kind: m.kind, w: m.w, h: m.h })));
      if (draft.images.length > 1 && draft.layout === 'une') draft.layout = 'grille';
      repaint();
    }

    const foot = el('.composer__foot');
    foot.append(el('button.icon-btn', { title: 'Images', html: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M3 16l5-4 4 3 3-2 6 5"/></svg>', onclick: () => addImages(null) }));
    foot.append(el('button.icon-btn', {
      title: 'Intégrer un lien (X, YouTube, TikTok…)',
      html: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.5.5l2-2a5 5 0 00-7-7l-1 1"/><path d="M14 11a5 5 0 00-7.5-.5l-2 2a5 5 0 007 7l1-1"/></svg>',
      onclick: () => A.promptDlg('Intégrer un lien', draft.url || '', v => { draft.url = v; repaint(); },
        { sub: 'X, YouTube, TikTok, Instagram, Spotify, SoundCloud, Twitch, Vimeo…', placeholder: 'https://…', allowEmpty: true })
    }));
    foot.append(el('button.icon-btn', { title: 'Note /5', html: '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/></svg>', onclick: () => { draft.rating = draft.rating ? 0 : 4; repaint(); } }));

    const sel = el('select.select', {
      style: { width: 'auto', padding: '5px 28px 5px 10px', fontSize: '12.5px' },
      onchange: e => { draft.coll = e.target.value; majEpisodes(); }
    });
    sel.append(el('option', { value: '', text: 'Sans carnet' }));
    st.collections.forEach(c => sel.append(el('option', { value: c.id, text: c.emoji + ' ' + c.nom, selected: draft.coll === c.id })));
    if (!draft.coll && filtre.coll) { draft.coll = filtre.coll; sel.value = filtre.coll; }
    majEpisodes();
    foot.append(sel);

    const dateBtn = el('button.chip', {
      text: '📅 ' + A.relDate(draft.date),
      onclick: () => {
        const inp = el('input.input', { type: 'date', value: draft.date });
        A.dialog({ title: 'Date du post', body: el('.field', inp),
          onOk: () => { if (inp.value) { draft.date = inp.value; dateBtn.textContent = '📅 ' + A.relDate(draft.date); } } });
      }
    });
    foot.append(dateBtn);
    foot.append(el('.toolbar__spacer'));
    foot.append(count);
    foot.append(el('button.btn.btn--primary', { text: 'Publier', onclick: () => publish() }));

    function publish() {
      const texte = (draft.texte || '').trim();
      const titre = (draft.titre || '').trim();
      if (!texte && !draft.images.length && !draft.url && !titre) { A.toast('Rien à publier.'); return; }

      /* le titre de série devient un mot-clé, pour retrouver la série */
      const tags = new Set((texte.match(/#([\p{L}\p{N}_-]{1,32})/gu) || []).map(t => t.slice(1)));
      if (titre) tags.add(titre);

      S().posts.unshift({
        id: uid('p'), date: draft.date,
        titre, episode: (draft.episode || '').trim(),
        texte, images: draft.images, layout: draft.layout,
        url: draft.url, film: draft.film || null, tweet: draft.tweet || null, reglages: draft.reglages || null, rating: draft.rating, coll: draft.coll,
        tags: Array.from(tags), pinned: false, createdAt: Date.now(), updatedAt: Date.now()
      });
      A.Store.save(true);
      /* on repart d'un composeur vierge : seuls le carnet et la date restent */
      const gardeColl = draft.coll, gardeDate = draft.date;
      draft = newDraft(gardeDate);
      draft.coll = gardeColl;
      A.toast(titre ? `Publié dans <b>${A.esc(titre)}</b>` : 'Publié <b>✓</b>');
      render(main);
      A.refreshChrome();
    }

    box.append(media);
    box.append(foot);
    repaint();
    return box;
  }

  /* ============================================================
     Carte d'un post
     ============================================================ */
  function postCard(p, refresh) {
    const card = el('.post', { 'data-id': p.id });
    let edition = false;
    const dessine = () => {
      card.className = 'post' + (p.pinned ? ' is-pinned' : '') + (edition ? ' is-edit' : '');
      card.innerHTML = '';
      (edition ? construireEdition : construireLecture)(p, card, refresh, () => { edition = !edition; dessine(); }, dessine);
    };
    dessine();
    return card;
  }

  /* ---------- affichage normal ---------- */
  function construireLecture(p, card, refresh, basculer) {
    const st = S();
    const coll = p.coll ? A.Store.collection(p.coll) : null;
    if (p.pinned) card.append(el('.post__pin', { text: '📌', title: 'Épinglé' }));

    card.append(el('.post__head',
      el('.post__ava', { text: st.settings.initial || '✦' }),
      el('span.post__who', { text: st.settings.author || 'moi' }),
      el('span.post__when', { text: '· ' + A.relDate(p.date) }),
      coll ? el('span.post__coll', { text: coll.emoji + ' ' + coll.nom, onclick: () => A.go('feed', { coll: coll.id }), style: { cursor: 'pointer' } }) : '',
      el('.post__menu',
        el('button.icon-btn', {
          title: 'Options', html: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>',
          onclick: (e) => A.menu(e.currentTarget, [
            { icon: '✎', label: 'Modifier', run: basculer },
            { icon: '📌', label: p.pinned ? 'Désépingler' : 'Épingler', run: () => { p.pinned = !p.pinned; A.Store.save(true); refresh(); } },
            { icon: '📅', label: 'Ouvrir le jour', run: () => A.go('journal', { day: p.date }) },
            { icon: '⧉', label: 'Copier le texte', run: () => { navigator.clipboard && navigator.clipboard.writeText(p.texte); A.toast('Copié'); } },
            '-',
            { icon: '🗑', label: 'Supprimer', run: () => A.confirmDlg('Supprimer ce post ?', 'Cette action est définitive.', () => {
              (p.images || []).forEach(im => A.Media.del(im.id));
              const s = S(); s.posts = s.posts.filter(x => x.id !== p.id);
              A.Store.save(true); refresh(); A.refreshChrome();
            }) }
          ])
        }))));

    /* — titre de série + épisode — */
    if (p.titre || p.episode) {
      const t = el('.post__serie');
      if (p.titre) t.append(el('button.post__titre', { text: p.titre, title: 'Voir toute la série', onclick: () => A.go('feed', { serie: p.titre, coll: p.coll || '' }) }));
      if (p.episode) t.append(el('span.post__ep', { text: /^\d+([.,]\d+)?$/.test(p.episode) ? 'Ép. ' + p.episode : p.episode }));
      card.append(t);
    }

    if (p.texte) card.append(el('.post__body', { html: A.richText(p.texte) }));

    /* fiche film : elle porte déjà l'affiche et la note, on ne les répète pas */
    const info = p.url ? A.Embed.parse(p.url) : null;
    const estFilm = !!info && info.kind === 'film';
    const posterId = estFilm && p.images && p.images.length === 1 ? p.images[0].id : null;

    if (p.rating && !estFilm) {
      card.append(el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' } },
        A.Editor.stars(p.rating),
        el('span', { style: { fontSize: '12px', color: 'var(--faint)' }, text: A.Editor.noteTexte(p.rating) + '/5' })));
    }

    /* en lecture, les images sont figées : on les réarrange via « Modifier » */
    if (p.images && p.images.length && !posterId) {
      card.append(el('.post__media', A.Gallery.render({ images: p.images, layout: p.layout || 'auto', keepLayout: true })));
    }
    if (p.url) {
      card.append(el('.post__media', A.Embed.render(p.url, { film: p.film, tweet: p.tweet, reglages: p.reglages, poster: posterId, note: p.rating })));
      chercherEmbed(p, refresh);
    }

    const autres = (p.tags || []).filter(t => t !== p.titre);
    if (autres.length) {
      const row = el('.tag-row', { style: { marginTop: '12px' } });
      autres.forEach(t => row.append(el('button.chip.chip--tag', { text: t, onclick: () => A.go('feed', { tag: t }) })));
      card.append(row);
    }
  }

  /* ---------- mode modification, sur la carte elle-même ---------- */
  function construireEdition(p, card, refresh, basculer, redessine) {
    const st = S();
    const enregistre = () => { p.updatedAt = Date.now(); A.Store.save(true); };

    card.append(el('.post__head',
      el('.post__ava', { text: st.settings.initial || '✦' }),
      el('span.post__who', { text: 'Modification' }),
      el('span.post__when', { text: '· ' + A.midDate(p.date) })));

    /* titre & épisode */
    const dl = el('datalist', { id: 'series-edit-' + p.id });
    Array.from(new Set(st.posts.map(x => x.titre).filter(Boolean))).forEach(t => dl.append(el('option', { value: t })));
    const titreInp = el('input.composer__titre', {
      placeholder: 'Titre — série, film, livre…', value: p.titre || '', list: dl.id,
      oninput: e => { retitre(p, e.target.value); enregistre(); }
    });
    const epInp = el('input.composer__ep', {
      placeholder: 'Ép.', value: p.episode || '',
      oninput: e => { p.episode = e.target.value.trim(); enregistre(); }
    });
    const epBoite = el('span.composer__epwrap', epInp);
    const majEpisodes = () => {
      const c = p.coll ? A.Store.collection(p.coll) : null;
      const montre = !c || c.episodes !== false;
      epBoite.classList.toggle('is-hidden', !montre);
      if (!montre && p.episode) { p.episode = ''; epInp.value = ''; enregistre(); }
    };
    card.append(el('.composer__meta', dl, titreInp, epBoite));

    /* carnet & date, modifiables ici aussi */
    const selColl = el('select.select', {
      style: { width: 'auto', padding: '5px 28px 5px 10px', fontSize: '12.5px' },
      /* pas de refresh ici : il sortirait du mode modification en pleine
         saisie. Le fil se réordonne à la fermeture (« Terminé »). */
      onchange: e => { p.coll = e.target.value; majEpisodes(); enregistre(); }
    });
    selColl.append(el('option', { value: '', text: 'Sans carnet' }));
    st.collections.forEach(c => selColl.append(el('option', { value: c.id, text: c.emoji + ' ' + c.nom, selected: p.coll === c.id })));
    const dateInp = el('input.input', {
      type: 'date', value: p.date,
      style: { width: 'auto', padding: '5px 10px', fontSize: '12.5px' },
      onchange: e => { if (e.target.value) { p.date = e.target.value; enregistre(); } }
    });
    card.append(el('.toolbar', { style: { marginTop: '10px' } }, selColl, dateInp));
    majEpisodes();

    /* texte */
    const ta = el('textarea.textarea', {
      style: { minHeight: '110px', fontSize: '16px' },
      oninput: e => {
        p.texte = e.target.value;
        retitre(p, p.titre);
        enregistre();
      }
    });
    ta.value = p.texte || '';
    card.append(ta);

    /* note */
    const valNote = el('.b-rating__val', { text: A.Editor.noteTexte(p.rating) + '/5' });
    card.append(el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' } },
      el('.b-rating__label', { text: 'Ma note' }),
      A.Editor.starsWidget(p.rating || 0, v => { p.rating = v; valNote.textContent = A.Editor.noteTexte(v) + '/5'; enregistre(); }),
      valNote));

    /* images : réarrangeables, et déplaçables vers un autre post */
    const media = el('.post__media');
    const dessineMedia = () => {
      media.innerHTML = '';
      if (!p.images || !p.images.length) {
        media.append(el('.dropzone', {
          html: '<b>Ajouter des images</b>',
          onclick: async () => {
            const got = await A.Media.pick(true);
            if (got.length) { p.images = got.map(m => ({ id: m.id, kind: m.kind, w: m.w, h: m.h })); enregistre(); dessineMedia(); }
          }
        }));
        return;
      }
      media.append(A.Gallery.render({
        images: p.images, layout: p.layout || 'auto', editable: true, keepLayout: true,
        onChange: (imgs, lay, raison) => {
          if (raison === 'suppression') (p.images || []).filter(x => !imgs.includes(x)).forEach(x => A.Media.del(x.id));
          p.images = imgs;
          if (lay) p.layout = lay;
          enregistre();
          dessineMedia();
        }
      }));
    };
    dessineMedia();
    card.append(media);

    /* intégration */
    const embed = el('.post__media');
    const dessineEmbed = () => {
      embed.innerHTML = '';
      if (p.url) {
        const infoUrl = A.Embed.parse(p.url);
        embed.append(A.Embed.render(p.url, {
          film: p.film, tweet: p.tweet, note: p.rating,
          reglages: p.reglages,
          onReglages: (r) => { p.reglages = r; enregistre(); dessineEmbed(); },
          onAffiche: infoUrl && infoUrl.kind === 'film'
            ? () => A.Embed.choisirAffiche(p, () => { enregistre(); dessineEmbed(); })
            : null,
          extra: el('button', { text: 'retirer', style: { fontSize: '11.5px', color: 'var(--muted)' },
            onclick: () => { p.url = ''; p.film = null; enregistre(); dessineEmbed(); } })
        }));
        chercherEmbed(p, dessineEmbed);
      } else {
        embed.append(el('button.btn.btn--ghost.btn--sm', {
          text: '⧉ Ajouter une intégration',
          onclick: () => A.promptDlg('Intégrer un lien', '', v => { p.url = v; enregistre(); dessineEmbed(); },
            { sub: 'Un lien, ou le code d’intégration copié depuis X, Spotify, TikTok…', placeholder: 'https://… ou <blockquote…>', multiline: true })
        }));
      }
    };
    dessineEmbed();
    card.append(embed);

    card.append(el('.post__foot', { style: { justifyContent: 'flex-end' } },
      el('button.btn.btn--ghost.btn--sm', { text: 'Supprimer le post', onclick: () => A.confirmDlg('Supprimer ce post ?', 'Cette action est définitive.', () => {
        (p.images || []).forEach(im => A.Media.del(im.id));
        const s = S(); s.posts = s.posts.filter(x => x.id !== p.id);
        A.Store.save(true); refresh(); A.refreshChrome();
      }) }),
      el('div', { style: { flex: '1' } }),
      /* c'est ici que le post reprend sa place : date, carnet, tri */
      el('button.btn.btn--primary', { text: 'Terminé', onclick: () => { enregistre(); refresh(); } })));
  }

  /** met à jour le titre et les mots-clés qui en dépendent */
  function retitre(p, nouveau) {
    const ancien = p.titre;
    p.titre = String(nouveau || '').trim();
    const tags = new Set((String(p.texte || '').match(/#([\p{L}\p{N}_-]{1,32})/gu) || []).map(t => t.slice(1)));
    (p.tags || []).forEach(t => { if (t !== ancien) tags.add(t); });
    if (p.titre) tags.add(p.titre);
    p.tags = Array.from(tags);
  }

  A.Feed = { render, postCard, series, setFilter: (f) => Object.assign(filtre, f) };
})(window.App);
