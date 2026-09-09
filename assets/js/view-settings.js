/* ============================================================
   ENCRE — vue Réglages (personnalisation)
   ============================================================ */
(function (A) {
  'use strict';
  const { el } = A;
  const S = () => A.Store.state();
  const set = (k, v) => A.Store.setSetting(k, v);

  let onglet = 'apparence';

  function render(main, params) {
    if (params && params.onglet) onglet = params.onglet;
    const s = S().settings;
    main.innerHTML = '';
    const wrap = el('.wrap.wrap--mid.fade-in');

    wrap.append(el('.page-kicker', { text: 'Réglages' }));
    wrap.append(el('h1.page-title', 'Faites-en ', el('em', { text: 'votre' }), ' lieu'));
    wrap.append(el('p.page-sub', { text: 'Tout est stocké sur votre machine. Rien ne part ailleurs.' }));

    const nav = el('.set-nav');
    [['apparence', 'Apparence'], ['typo', 'Typographie'], ['identite', 'Identité'], ['donnees', 'Données'], ['aide', 'Raccourcis']]
      .forEach(([id, lab]) => nav.append(el('button' + (onglet === id ? '.is-on' : ''), { text: lab, onclick: () => { onglet = id; render(main); } })));
    wrap.append(nav);

    const body = el('div');
    wrap.append(body);
    ({ apparence, typo, identite, donnees, aide })[onglet](body, main, s);
    main.append(wrap);
  }

  function head(t, sub) {
    return el('div', el('.section-head', { style: { marginTop: '10px' } }, el('h2', { text: t }), el('.rule')),
      sub ? el('p', { style: { color: 'var(--muted)', fontSize: '13px', margin: '-8px 0 16px' }, text: sub }) : '');
  }

  function toggle(label, sub, value, onSet) {
    const sw = el('.switch' + (value ? '.is-on' : ''));
    const row = el('.row-toggle', { onclick: () => { const v = !sw.classList.contains('is-on'); sw.classList.toggle('is-on', v); onSet(v); }, style: { cursor: 'pointer' } },
      el('.row-toggle__text', el('b', { text: label }), sub ? el('small', { text: sub }) : ''), sw);
    return row;
  }

  function slider(label, value, min, max, step, unit, onSet) {
    const out = el('span', { style: { fontVariantNumeric: 'tabular-nums', color: 'var(--muted)', fontSize: '13px' }, text: value + unit });
    const r = el('input.range', {
      type: 'range', min, max, step, value,
      oninput: e => { out.textContent = e.target.value + unit; onSet(parseFloat(e.target.value)); }
    });
    return el('.field',
      el('div', { style: { display: 'flex', justifyContent: 'space-between' } }, el('span.field__label', { text: label }), out), r);
  }

  /* ---------- APPARENCE ---------- */
  function apparence(body, main, s) {
    body.append(head('Ambiance', 'Sept ambiances complètes. Vous pouvez ensuite forcer votre propre couleur d’accent.'));
    const grid = el('.settings-grid');
    A.Store.THEMES.forEach(t => {
      const card = el('button.theme-card' + (s.theme === t.id ? '.is-on' : ''), {
        onclick: () => { set('theme', t.id); render(main); }
      });
      const prev = el('.theme-card__prev', { style: { background: t.bg } });
      prev.append(el('.theme-card__dot', { style: { background: t.accent } }));
      prev.append(el('i', { style: { background: t.ink, opacity: '.75' } }));
      prev.append(el('i', { style: { background: t.ink, opacity: '.4' } }));
      card.append(prev, el('.theme-card__name', { text: t.nom }));
      grid.append(card);
    });
    body.append(grid);

    body.append(head('Couleur d’accent'));
    const sw = el('.swatches');
    sw.append(el('button.swatch' + (!s.accent ? '.is-on' : ''), {
      title: 'Couleur du thème',
      style: { background: 'linear-gradient(135deg,var(--accent),var(--accent))', outline: '1px dashed var(--faint)' },
      onclick: () => { set('accent', ''); render(main); }
    }));
    A.Store.ACCENTS.forEach(c => sw.append(el('button.swatch' + (s.accent === c ? '.is-on' : ''), {
      style: { background: c }, title: c, onclick: () => { set('accent', c); render(main); }
    })));
    const custom = el('input', {
      type: 'color', value: s.accent || '#b3542a',
      style: { width: '34px', height: '30px', border: '0', background: 'none', cursor: 'pointer', padding: '0' },
      oninput: e => set('accent', e.target.value)
    });
    sw.append(custom);
    body.append(sw);

    body.append(head('Fond de page'));
    const pats = el('.toolbar');
    [['aucun', 'Aucun'], ['halo', 'Halo'], ['dots', 'Points'], ['grid', 'Quadrillage'], ['lines', 'Lignes']]
      .forEach(([id, lab]) => pats.append(el('button.chip' + (s.pattern === id ? '.is-on' : ''), { text: lab, onclick: () => { set('pattern', id); render(main); } })));
    body.append(pats);
    body.append(el('div', { style: { height: '10px' } }));
    body.append(toggle('Grain', 'Un léger bruit façon papier imprimé.', s.grain === 'on', v => set('grain', v ? 'on' : 'off')));

    body.append(head('Formes'));
    body.append(slider('Arrondi des cartes', s.radius, 0, 26, 1, ' px', v => set('radius', v)));
    body.append(slider('Hauteur des couvertures', s.coverHeight, 140, 460, 10, ' px', v => set('coverHeight', v)));
  }

  /* ---------- TYPOGRAPHIE ---------- */
  function typo(body, main, s) {
    body.append(head('Duo de polices', 'Le premier caractère sert aux titres, le second au corps de texte.'));
    const grid = el('.settings-grid', { style: { gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))' } });
    A.Store.FONTS.forEach(f => {
      const card = el('button.font-card' + (s.fonts === f.id ? '.is-on' : ''), { onclick: () => { set('fonts', f.id); render(main); } });
      card.append(el('b', { text: 'Aa', style: { fontFamily: f.display } }));
      card.append(el('div', { text: 'Le vif renard brun', style: { fontFamily: f.body, fontSize: '13px', color: 'var(--ink-soft)', marginBottom: '6px' } }));
      card.append(el('small', { text: f.nom }));
      grid.append(card);
    });
    body.append(grid);

    body.append(head('Confort de lecture'));
    body.append(slider('Taille du texte', s.fontSize, 14, 22, .5, ' px', v => set('fontSize', v)));
    body.append(slider('Interligne', s.lineHeight, 1.3, 2.2, .02, '', v => set('lineHeight', v)));
    body.append(slider('Largeur de colonne', s.measure, 46, 100, 1, ' car.', v => set('measure', v)));

    body.append(el('.card', { style: { padding: '22px 26px', marginTop: '20px' } },
      el('div', { style: { fontFamily: 'var(--f-display)', fontSize: '26px', marginBottom: '8px' }, text: 'Un aperçu' }),
      el('div', { style: { fontFamily: 'var(--f-body)', fontSize: 'var(--fs-read)', lineHeight: 'var(--lh-read)' },
        text: 'Le soir tombe doucement sur la ville. J’écris ces quelques lignes sans savoir où elles vont, et c’est très bien ainsi — le carnet ne demande rien, il attend.' })));
  }

  /* ---------- IDENTITÉ ---------- */
  function identite(body, main, s) {
    body.append(head('Votre carnet', 'Le nom affiché en haut à gauche.'));
    const field = (label, key, ph, width) => {
      const inp = el('input.input', { value: s[key] || '', placeholder: ph, oninput: e => set(key, e.target.value) });
      if (width) inp.style.width = width;
      return el('.field', el('.field__label', { text: label }), inp);
    };
    body.append(el('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-end' } },
      el('div', { style: { width: '76px' } },
        el('.field', el('.field__label', { text: 'Marque' }),
          el('button.btn', { text: s.brandMark || '✒', style: { fontSize: '19px', justifyContent: 'center' }, onclick: (e) => A.emojiPicker(v => { set('brandMark', v || '✒'); render(main); }, s.brandMark, e.currentTarget) }))),
      el('div', { style: { flex: '1' } }, field('Nom', 'brandName', 'Encre')),
      el('div', { style: { flex: '1' } }, field('Sous-titre', 'brandSub', 'carnet & agenda'))));

    body.append(head('Signature des posts'));
    body.append(el('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-end' } },
      el('div', { style: { width: '76px' } },
        el('.field', el('.field__label', { text: 'Avatar' }),
          el('button.btn', { text: s.initial || '✦', style: { fontSize: '19px', justifyContent: 'center' }, onclick: (e) => A.emojiPicker(v => { set('initial', v || '✦'); render(main); }, s.initial, e.currentTarget) }))),
      el('div', { style: { flex: '1' } }, field('Nom affiché', 'author', 'moi'))));

    body.append(head('Préférences'));
    const wk = el('.toolbar');
    [['lun', 'Lundi'], ['dim', 'Dimanche']].forEach(([id, lab]) =>
      wk.append(el('button.chip' + (s.weekStart === id ? '.is-on' : ''), { text: lab, onclick: () => { set('weekStart', id); render(main); } })));
    body.append(el('.field', el('.field__label', { text: 'La semaine commence le' }), wk));
    body.append(toggle('Correcteur orthographique', 'Souligne les fautes pendant que vous écrivez.', s.spellcheck, v => set('spellcheck', v)));
  }

  /* ---------- DONNÉES ---------- */
  function donnees(body, main, s) {
    const st = A.Store.stats();
    body.append(head('Ce que contient votre carnet'));
    const stats = el('.stats');
    stats.append(el('.stat', el('b', { text: String(st.jours) }), el('small', { text: 'jours' })));
    stats.append(el('.stat', el('b', { text: String(st.posts) }), el('small', { text: 'posts' })));
    stats.append(el('.stat', el('b', { text: String(st.notes) }), el('small', { text: 'notes' })));
    stats.append(el('.stat', el('b', { text: String(st.images) }), el('small', { text: 'images' })));
    body.append(stats);

    const usage = el('p', { style: { fontSize: '12.5px', color: 'var(--muted)' }, text: 'Calcul de l’espace utilisé…' });
    body.append(usage);
    A.Media.usage().then(u => {
      usage.textContent = u.quota
        ? `Espace utilisé : ${(u.used / 1048576).toFixed(1)} Mo sur ~${(u.quota / 1048576).toFixed(0)} Mo disponibles.`
        : 'Espace utilisé : information indisponible dans ce navigateur.';
    });

    body.append(head('Sauvegarde', 'Exportez régulièrement : les données vivent dans ce navigateur uniquement.'));
    const row = el('.toolbar');
    row.append(el('button.btn.btn--primary', {
      text: '↓ Sauvegarde complète (avec images)',
      onclick: async () => {
        A.toast('Préparation de la sauvegarde…');
        const json = await A.Store.exportJSON(true);
        A.download(`encre-sauvegarde-${A.today()}.json`, json);
      }
    }));
    row.append(el('button.btn', {
      text: '↓ Texte seul (.json)',
      onclick: async () => A.download(`encre-texte-${A.today()}.json`, await A.Store.exportJSON(false))
    }));
    row.append(el('button.btn', {
      text: '↓ Markdown',
      onclick: () => A.download(`encre-${A.today()}.md`, A.Store.exportMarkdown(), 'text/markdown')
    }));
    row.append(el('button.btn', { text: '🖨 Imprimer / PDF', onclick: () => window.print() }));
    body.append(row);

    body.append(head('Restauration'));
    const imp = el('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
    imp.addEventListener('change', async () => {
      const f = imp.files[0]; if (!f) return;
      const text = await f.text();
      A.dialog({
        title: 'Importer ces données ?', sub: f.name,
        body: el('p', { style: { fontSize: '13.5px', color: 'var(--muted)', lineHeight: '1.6' },
          text: 'Fusionner ajoute ce qui manque sans toucher à l’existant. Remplacer efface tout le contenu actuel.' }),
        ok: 'Fusionner',
        onOk: async () => { try { await A.Store.importJSON(text, 'fusion'); A.toast('Import terminé <b>✓</b>'); A.go('journal'); } catch (e) { A.toast(e.message, 'bad'); } }
      });
    });
    const rowImp = el('.toolbar');
    rowImp.append(el('button.btn', { text: '↑ Importer une sauvegarde', onclick: () => imp.click() }), imp);
    rowImp.append(el('button.btn', {
      text: '🧹 Nettoyer les images orphelines',
      onclick: async () => {
        const n = await A.Media.gc(A.Store.allImageIds());
        A.toast(n ? `${n} image(s) supprimée(s)` : 'Rien à nettoyer');
      }
    }));
    body.append(rowImp);

    body.append(head('Zone sensible'));
    body.append(el('button.btn.btn--danger', {
      text: 'Tout effacer et repartir de zéro',
      onclick: () => A.confirmDlg('Effacer tout le carnet ?', 'Jours, posts, notes et images seront supprimés. Pensez à exporter avant.',
        async () => { await A.Media.gc([]); A.Store.reset(); A.go('journal'); A.toast('Carnet réinitialisé'); }, 'Tout effacer')
    }));
  }

  /* ---------- AIDE ---------- */
  function aide(body) {
    const table = (titre, rows) => {
      const box = el('div');
      box.append(head(titre));
      rows.forEach(([k, v]) => box.append(el('div', {
        style: { display: 'flex', gap: '14px', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--line)' }
      }, el('div', { style: { width: '130px', flex: 'none', display: 'flex', gap: '4px', flexWrap: 'wrap' } },
        ...k.split(' ').map(x => el('kbd', { text: x }))),
        el('span', { style: { fontSize: '13.5px', color: 'var(--ink-soft)' }, text: v }))));
      return box;
    };
    body.append(table('Partout', [
      ['⌘K', 'Recherche et commandes'],
      ['⌘J', "Aller à aujourd'hui"],
      ['⌘B', 'Replier le menu latéral'],
      ['⌘,', 'Ouvrir les réglages'],
      ['← →', 'Jour précédent / suivant (dans le journal)'],
      ['⌘D', 'Basculer clair / sombre']
    ]));
    body.append(table('Dans l’éditeur', [
      ['/', 'Menu d’insertion de blocs'],
      ['⌘B ⌘I ⌘U', 'Gras, italique, souligné'],
      ['⌘K', 'Insérer un lien'],
      ['⌘E', 'Code en ligne'],
      ['Alt ↑ ↓', 'Déplacer le bloc'],
      ['⇧Entrée', 'Retour à la ligne dans le bloc']
    ]));
    body.append(table('Raccourcis d’écriture', [
      ['# ␣', 'Grand titre'],
      ['## ␣', 'Titre'],
      ['> ␣', 'Citation'],
      ['- ␣', 'Liste à puces'],
      ['1. ␣', 'Liste numérotée'],
      ['[] ␣', 'Case à cocher'],
      ['``` ', 'Bloc de code'],
      ['---', 'Filet de séparation']
    ]));
    body.append(head('Bon à savoir'));
    body.append(el('div', { style: { fontSize: '13.5px', color: 'var(--ink-soft)', lineHeight: '1.7' } },
      el('p', { text: '· Glissez des images directement dans une page : une galerie se crée toute seule.' }),
      el('p', { text: '· Collez un lien X, YouTube ou TikTok dans un bloc vide : il devient une intégration.' }),
      el('p', { text: '· Double-cliquez sur une image d’une galerie pour lui donner une légende.' }),
      el('p', { text: '· Glissez la couverture d’un jour vers le haut ou le bas pour la recadrer.' }),
      el('p', { text: '· Tout est enregistré localement, en continu. Exportez de temps en temps.' })));
  }

  A.Settings = { render };
})(window.App);
