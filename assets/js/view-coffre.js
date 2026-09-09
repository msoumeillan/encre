/* ============================================================
   ENCRE — vue Coffre secret
   Trois états : à créer, verrouillé, ouvert.
   ============================================================ */
(function (A) {
  'use strict';
  const { el } = A;
  const C = () => A.Coffre;

  function render(main, params) {
    main.innerHTML = '';
    if (!C().dispo()) return main.append(indisponible());
    if (!C().estConfigure()) return main.append(creation(main));
    if (!C().estOuvert()) return main.append(verrou(main));
    if (params && params.note) return unNote(main, params.note);
    main.append(liste(main));
  }

  /* ---------- chiffrement absent (ouverture en file://) ---------- */
  function indisponible() {
    const wrap = el('.wrap.wrap--mid.fade-in');
    wrap.append(el('.page-kicker', { text: 'Coffre' }));
    wrap.append(el('h1.page-title', 'Chiffrement ', el('em', { text: 'indisponible' })));
    wrap.append(el('.b-callout', { 'data-tone': 'alerte' },
      el('.b-callout__emoji', { text: '⚠' }),
      el('div', { html: 'Le navigateur ne donne accès au chiffrement que sur une page servie par un serveur. Ouvrez le carnet avec <b>demarrer.cmd</b> plutôt qu’en double-cliquant sur <b>index.html</b>.' })));
    return wrap;
  }

  /* ---------- création du coffre ---------- */
  function creation(main) {
    const wrap = el('.wrap.wrap--mid.fade-in');
    wrap.append(el('.page-kicker', { text: 'Coffre secret' }));
    wrap.append(el('h1.page-title', 'Ce qui ne regarde ', el('em', { text: 'que vous' })));
    wrap.append(el('p.page-sub', { text: 'Des pages chiffrées avec un code. Sans ce code, leur contenu est illisible — même en fouillant le stockage du navigateur.' }));

    const code = el('input.input', { type: 'password', placeholder: 'Votre code', autocomplete: 'new-password' });
    const code2 = el('input.input', { type: 'password', placeholder: 'Le même, pour confirmer', autocomplete: 'new-password' });
    const indice = el('input.input', { placeholder: 'Indice, facultatif — visible sans le code' });
    const erreur = el('.coffre__erreur');

    const valider = async () => {
      erreur.textContent = '';
      if (code.value !== code2.value) { erreur.textContent = 'Les deux codes ne correspondent pas.'; return; }
      try {
        await C().configurer(code.value, indice.value.trim());
        A.toast('Coffre créé <b>✓</b>');
        A.paint();
      } catch (e) { erreur.textContent = e.message; }
    };

    const carte = el('.coffre__carte');
    carte.append(el('.field', el('.field__label', { text: 'Code' }), code));
    carte.append(el('.field', el('.field__label', { text: 'Confirmation' }), code2));
    carte.append(el('.field', el('.field__label', { text: 'Indice' }), indice,
      el('.field__hint', { text: 'Pour vous rafraîchir la mémoire. Ne mettez pas le code dedans.' })));
    carte.append(erreur);
    carte.append(el('button.btn.btn--primary', { text: 'Créer le coffre', onclick: valider }));
    [code, code2, indice].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') valider(); }));
    wrap.append(carte);

    wrap.append(el('.b-callout', { 'data-tone': 'alerte', style: { marginTop: '24px' } },
      el('.b-callout__emoji', { text: '⚠' }),
      el('div', { html: '<b>Le code ne peut pas être récupéré.</b> Il n’est stocké nulle part : c’est lui qui fabrique la clé de déchiffrement. Si vous l’oubliez, le contenu du coffre est définitivement perdu.' })));
    return wrap;
  }

  /* ---------- coffre verrouillé ---------- */
  function verrou(main) {
    const wrap = el('.wrap.wrap--mid.fade-in');
    const code = el('input.input.coffre__code', { type: 'password', placeholder: '••••••', autocomplete: 'current-password', autofocus: true });
    const erreur = el('.coffre__erreur');

    const ouvrir = async () => {
      erreur.textContent = '';
      const bouton = wrap.querySelector('.btn--primary');
      bouton.disabled = true; bouton.textContent = 'Ouverture…';
      try {
        await C().ouvrir(code.value);
        A.paint();
      } catch (e) {
        erreur.textContent = e.message;
        code.value = ''; code.focus();
        bouton.disabled = false; bouton.textContent = 'Ouvrir';
      }
    };
    code.addEventListener('keydown', e => { if (e.key === 'Enter') ouvrir(); });

    const carte = el('.coffre__carte.coffre__carte--verrou');
    carte.append(el('.coffre__cadenas', { text: '🔒' }));
    carte.append(el('h2', { text: 'Coffre verrouillé' }));
    const ind = A.Store.state().coffre.indice;
    if (ind) carte.append(el('p.coffre__indice', { text: 'Indice : ' + ind }));
    carte.append(code);
    carte.append(erreur);
    carte.append(el('button.btn.btn--primary', { text: 'Ouvrir', onclick: ouvrir }));
    wrap.append(carte);
    setTimeout(() => code.focus(), 60);
    return wrap;
  }

  /* ---------- liste des pages ---------- */
  function liste(main) {
    const wrap = el('.wrap.wrap--wide.fade-in');
    const notes = C().lesNotes();

    const tete = el('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' } });
    tete.append(el('div',
      el('.page-kicker', { text: '🔓  Coffre ouvert' }),
      el('h1.page-title', { style: { marginBottom: '4px' } }, 'Pages ', el('em', { text: 'secrètes' })),
      el('p.page-sub', { style: { marginBottom: 0 }, text: 'Verrouillage automatique après 10 minutes sans activité, et à la fermeture de l’onglet.' })));
    tete.append(el('div', { style: { flex: '1' } }));
    tete.append(el('button.btn', { text: '🔒 Verrouiller', onclick: () => { C().fermer(); A.paint(); } }));
    tete.append(el('button.btn.btn--primary', { text: '＋ Nouvelle page', onclick: () => { const n = C().creerNote(); A.go('coffre', { note: n.id }); } }));
    wrap.append(tete);
    wrap.append(el('div', { style: { height: '26px' } }));

    if (!notes.length) {
      wrap.append(el('.empty', el('.empty__mark', { text: '❧' }), el('h3', { text: 'Le coffre est vide' }),
        el('p', { text: 'Tout ce que vous écrirez ici sera chiffré avant d’être enregistré.' }),
        el('button.btn.btn--primary', { text: 'Créer une page', onclick: () => { const n = C().creerNote(); A.go('coffre', { note: n.id }); } })));
    } else {
      const grid = el('.note-grid');
      notes.slice().sort((a, b) => b.updatedAt - a.updatedAt).forEach(n => {
        const card = el('.note-card', { onclick: () => A.go('coffre', { note: n.id }) });
        card.append(el('.note-card__strip'));
        card.append(el('.note-card__ico', { text: n.icon || '🔒' }));
        card.append(el('h3', { text: n.titre || 'Sans titre' }));
        const txt = (n.blocks || []).map(b => (b.html || '').replace(/<[^>]*>/g, ' ')).join(' ').replace(/\s+/g, ' ').trim();
        card.append(el('p', { text: txt || '—' }));
        card.append(el('.note-card__foot', el('span', { text: A.relTime(n.updatedAt) })));
        grid.append(card);
      });
      wrap.append(grid);
    }

    wrap.append(el('.section-head', el('h2', { text: 'Le code' }), el('.rule')));
    wrap.append(el('button.btn', { text: 'Changer le code', onclick: () => changerCode() }));
    return wrap;
  }

  function changerCode() {
    const ancien = el('input.input', { type: 'password', placeholder: 'Code actuel' });
    const neuf = el('input.input', { type: 'password', placeholder: 'Nouveau code' });
    const indice = el('input.input', { value: A.Store.state().coffre.indice || '', placeholder: 'Indice' });
    A.dialog({
      title: 'Changer le code',
      sub: 'Tout le contenu du coffre est rechiffré avec le nouveau code.',
      body: el('div',
        el('.field', el('.field__label', { text: 'Code actuel' }), ancien),
        el('.field', el('.field__label', { text: 'Nouveau code' }), neuf),
        el('.field', el('.field__label', { text: 'Indice' }), indice)),
      ok: 'Changer',
      onOk: () => {
        if (neuf.value.length < 4) { A.toast('Code trop court.', 'bad'); return false; }
        C().changerCode(ancien.value, neuf.value, indice.value.trim())
          .then(() => { A.toast('Code changé <b>✓</b>'); A.paint(); })
          .catch(e => A.toast(e.message, 'bad'));
      }
    });
  }

  /* ---------- une page du coffre ---------- */
  function unNote(main, id) {
    const n = C().lesNotes().find(x => x.id === id);
    if (!n) { main.append(liste(main)); return; }
    const save = (full) => { n.updatedAt = Date.now(); C().sauverPlusTard(); if (full) render(main, { note: id }); };

    main.innerHTML = '';
    main.append(A.Journal.cover(n, save));
    const wrap = el('.wrap.fade-in');
    if (n.cover) wrap.style.paddingTop = '18px';

    const tete = el('.doc-head');
    tete.append(el('div', { style: { display: 'flex', gap: '6px', marginBottom: '14px' } },
      el('button.btn.btn--ghost.btn--sm', { text: '‹ Le coffre', onclick: () => A.go('coffre') }),
      el('button.btn.btn--ghost.btn--sm', { text: '🔒 Verrouiller', onclick: () => { C().fermer(); A.go('coffre'); } })));
    tete.append(el('.doc-icon', { text: n.icon || '🔒', title: 'Changer l’icône',
      onclick: (e) => A.emojiPicker(v => { n.icon = v || '🔒'; save(true); }, n.icon, e.currentTarget) }));
    tete.append(el('h1.doc-title', {
      contenteditable: 'true', 'data-ph': 'Sans titre', text: n.titre || '',
      oninput: e => { n.titre = e.target.textContent; save(); },
      onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); const b = main.querySelector('.editor .block__body'); b && A.Editor.focusEnd(b); } }
    }));
    tete.append(el('.doc-meta', el('span', { text: '🔒 chiffré' }), el('span', { text: '·' }),
      el('span', { text: 'Modifiée ' + A.relTime(n.updatedAt) })));

    const actions = el('.doc-actions');
    if (!n.cover) actions.append(A.Journal.addCoverBtn(n, save));
    actions.append(el('div', { style: { flex: '1' } }));
    actions.append(el('button.btn.btn--ghost.btn--sm', {
      text: '🗑', title: 'Supprimer',
      onclick: () => A.confirmDlg('Supprimer cette page ?', n.titre || 'Sans titre',
        () => C().supprimerNote(id).then(() => A.go('coffre')))
    }));
    tete.append(actions);
    tete.append(A.Journal.tagEditor(n, save));
    wrap.append(tete);

    const hote = el('div', { style: { marginTop: '22px' } });
    wrap.append(hote);
    A.Editor.mount(hote, n, () => { n.updatedAt = Date.now(); C().sauverPlusTard(); });
    main.append(wrap);
  }

  A.CoffreVue = { render };
})(window.App);
