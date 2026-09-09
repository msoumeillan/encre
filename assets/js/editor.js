/* ============================================================
   ENCRE — éditeur par blocs
   Blocs : texte, titres, citation, code, liste, tâche, filet,
           encart, note /5, galerie, intégration.
   ============================================================ */
(function (A) {
  'use strict';
  const { el, $, uid } = A;

  const TYPES = [
    { t: 'text',    nom: 'Texte',        ico: '¶',  desc: 'Un paragraphe.',            grp: 'Écrire', kw: 'paragraphe texte' },
    { t: 'h1',      nom: 'Grand titre',  ico: 'H1', desc: 'Titre de section.',          grp: 'Écrire', kw: 'titre h1' },
    { t: 'h2',      nom: 'Titre',        ico: 'H2', desc: 'Sous-titre.',                grp: 'Écrire', kw: 'titre h2' },
    { t: 'h3',      nom: 'Petit titre',  ico: 'H3', desc: 'Intertitre discret.',        grp: 'Écrire', kw: 'titre h3' },
    { t: 'quote',   nom: 'Citation',     ico: '❝',  desc: 'Une phrase mise en avant.',  grp: 'Écrire', kw: 'citation quote' },
    { t: 'list',    nom: 'Liste',        ico: '•',  desc: 'Puces.',                     grp: 'Écrire', kw: 'liste puce bullet' },
    { t: 'listo',   nom: 'Liste numérotée', ico: '1.', desc: 'Étapes numérotées.',      grp: 'Écrire', kw: 'liste numero ordonnee' },
    { t: 'todo',    nom: 'Tâche',        ico: '☑',  desc: 'Case à cocher.',             grp: 'Écrire', kw: 'tache todo case' },
    { t: 'callout', nom: 'Encart',       ico: '💡', desc: 'Bloc coloré avec emoji.',    grp: 'Écrire', kw: 'encart callout note' },
    { t: 'code',    nom: 'Code',         ico: '{}', desc: 'Bloc monospace.',            grp: 'Écrire', kw: 'code mono' },
    { t: 'divider', nom: 'Filet',        ico: '—',  desc: 'Séparateur.',                grp: 'Écrire', kw: 'separateur ligne filet' },
    { t: 'gallery', nom: 'Images',       ico: '🖼', desc: '9 agencements possibles.',   grp: 'Média',  kw: 'image photo galerie' },
    { t: 'video',   nom: 'Vidéo',        ico: '▶',  desc: 'Un fichier vidéo, lu sur place.', grp: 'Média', kw: 'video film clip mp4 mov webm' },
    { t: 'embed',   nom: 'Intégration',  ico: '⧉',  desc: 'X, YouTube, TikTok, Spotify…', grp: 'Média', kw: 'embed video youtube x twitter tiktok spotify instagram' },
    { t: 'rating',  nom: 'Note /5',      ico: '★',  desc: 'Étoiles pour une review.',   grp: 'Média',  kw: 'note etoile rating review' }
  ];

  /* ---------- helpers de caret ---------- */
  function caretAtStart(node) {
    const s = getSelection();
    if (!s.rangeCount) return false;
    const r = s.getRangeAt(0).cloneRange();
    r.selectNodeContents(node); r.setEnd(s.getRangeAt(0).startContainer, s.getRangeAt(0).startOffset);
    return r.toString().length === 0;
  }
  function caretAtEnd(node) {
    const s = getSelection();
    if (!s.rangeCount) return false;
    const r = s.getRangeAt(0).cloneRange();
    r.selectNodeContents(node); r.setStart(s.getRangeAt(0).endContainer, s.getRangeAt(0).endOffset);
    return r.toString().length === 0;
  }
  function focusEnd(node) {
    if (!node) return;
    node.focus();
    const r = document.createRange(); r.selectNodeContents(node); r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function focusStart(node) {
    if (!node) return;
    node.focus();
    const r = document.createRange(); r.selectNodeContents(node); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function textBefore(node) {
    const s = getSelection();
    if (!s.rangeCount) return '';
    const r = s.getRangeAt(0).cloneRange();
    r.selectNodeContents(node); r.setEnd(s.getRangeAt(0).startContainer, s.getRangeAt(0).startOffset);
    return r.toString();
  }

  /* ============================================================
     Editor
     ============================================================ */
  function mount(host, doc, onChange) {
    const ed = {
      host, doc, onChange,
      save: A.debounce(() => { doc.updatedAt = Date.now(); onChange && onChange(); }, 400)
    };
    host.classList.add('editor');
    if (!doc.blocks || !doc.blocks.length) doc.blocks = [{ id: uid('b'), type: 'text', html: '' }];
    peindre(ed);
    bindDnD(ed);
    bindDrop(ed);
    return ed;
  }

  /** Les blocs qui partagent la même valeur `row` s'affichent côte à côte. */
  function normaliseRows(blocks) {
    let i = 0;
    while (i < blocks.length) {
      const row = blocks[i].row;
      if (!row) { i++; continue; }
      let j = i;
      while (j < blocks.length && blocks[j].row === row) j++;
      if (j - i < 2) blocks[i].row = '';   // une colonne seule n'en est pas une
      i = j;
    }
  }

  /** bornes [debut, fin[ du groupe de colonnes contenant l'indice i */
  function bornesRow(blocks, i) {
    const row = blocks[i] && blocks[i].row;
    if (!row) return [i, i + 1];
    let a = i, b = i;
    while (a > 0 && blocks[a - 1].row === row) a--;
    while (b < blocks.length - 1 && blocks[b + 1].row === row) b++;
    return [a, b + 1];
  }

  function peindre(ed) {
    const blocks = ed.doc.blocks;
    normaliseRows(blocks);
    ed.host.innerHTML = '';
    let i = 0;
    while (i < blocks.length) {
      const row = blocks[i].row;
      if (row) {
        const groupe = [];
        while (i < blocks.length && blocks[i].row === row) groupe.push(blocks[i++]);
        const rowEl = el('.block-row', { 'data-row': row });
        groupe.forEach(b => {
          const n = buildBlock(ed, b);
          n.classList.add('block--col');
          rowEl.append(n);
        });
        ed.host.append(rowEl);
      } else {
        ed.host.append(buildBlock(ed, blocks[i]));
        i++;
      }
    }
    ed.host.append(tailZone(ed));
  }

  function rerender(ed) {
    const scroll = ed.host.closest('.main');
    const y = scroll ? scroll.scrollTop : 0;
    peindre(ed);
    if (scroll) scroll.scrollTop = y;
  }

  /** zone cliquable en bas pour ajouter un paragraphe */
  function tailZone(ed) {
    return el('div', {
      style: { minHeight: '28vh', cursor: 'text' },
      onclick: (e) => {
        if (e.target !== e.currentTarget) return;
        const last = ed.doc.blocks[ed.doc.blocks.length - 1];
        if (last && last.type === 'text' && !stripHtml(last.html)) {
          focusEnd(bodyOf(ed, last.id));
        } else {
          insertAfter(ed, last ? last.id : null, { type: 'text', html: '' });
        }
      }
    });
  }

  const stripHtml = (h) => String(h || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  const bodyOf = (ed, id) => ed.host.querySelector(`[data-id="${id}"] .block__body`);
  const idx = (ed, id) => ed.doc.blocks.findIndex(b => b.id === id);

  /* ---------- construction d'un bloc ---------- */
  function buildBlock(ed, b) {
    const node = el('.block', { 'data-id': b.id, 'data-type': b.type });

    /* poignée */
    const handle = el('.block__handle',
      el('button', { text: '＋', title: 'Insérer en dessous', onclick: () => openSlash(ed, b.id, null, true) }),
      el('button.grip', { text: '⠿', title: 'Glisser / options', draggable: 'true', onclick: (e) => blockMenu(ed, b, e.currentTarget) })
    );
    node.append(handle);

    const s = A.Store.settings();

    const editable = (cls, ph, extraAttrs) => {
      const body = el('.block__body' + (cls ? '.' + cls : ''), Object.assign({
        contenteditable: 'true', 'data-ph': ph || '', spellcheck: s.spellcheck ? 'true' : 'false', html: b.html || ''
      }, extraAttrs || {}));
      wireEditable(ed, b, body);
      return body;
    };

    switch (b.type) {
      case 'h1': node.append(editable('b-h1', 'Grand titre')); break;
      case 'h2': node.append(editable('b-h2', 'Titre')); break;
      case 'h3': node.append(editable('b-h3', 'Petit titre')); break;
      case 'quote': node.append(editable('b-quote', 'Une phrase qui reste…')); break;
      case 'code': node.append(editable('b-code', 'code…')); break;

      case 'text': node.append(editable('', 'Écrivez, ou tapez / pour insérer')); break;

      case 'list': case 'listo': {
        const row = el('.b-list');
        const n = listNumber(ed, b);
        row.append(el('.b-list__bullet', { text: b.type === 'listo' ? n + '.' : '•' }));
        row.append(editable('', 'Élément'));
        node.append(row);
        break;
      }

      case 'todo': {
        const row = el('.b-todo' + (b.done ? '.is-done' : ''));
        const box = el('.b-todo__box', { onclick: () => { b.done = !b.done; row.classList.toggle('is-done', !!b.done); ed.save(); } });
        box.append(el('span', { html: '<svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg>' }));
        row.append(box, editable('', 'À faire…'));
        node.append(row);
        break;
      }

      case 'callout': {
        const box = el('.b-callout', { 'data-tone': b.tone || 'accent' });
        box.append(el('.b-callout__emoji', {
          text: b.emoji || '💡', title: 'Changer l’emoji',
          onclick: (e) => { A.emojiPicker(v => { b.emoji = v || '💡'; e.target.textContent = b.emoji; ed.save(); }, b.emoji, e.currentTarget); }
        }));
        box.append(editable('', 'Une remarque…'));
        node.append(box);
        break;
      }

      case 'divider': {
        const d = el('.b-divider', { 'data-style': b.style || 'ligne', onclick: () => {
          const order = ['ligne', 'dots', 'mark'];
          b.style = order[(order.indexOf(b.style || 'ligne') + 1) % order.length];
          ed.save(); rerender(ed);
        } });
        d.append(b.style === 'mark' ? el('div', { text: '✦ ✦ ✦' }) : el('hr'));
        node.append(d);
        break;
      }

      case 'rating': {
        const row = el('.b-rating');
        const label = el('.b-rating__label', {
          contenteditable: 'true', text: b.label || 'Note', style: { outline: 'none' },
          oninput: e => { b.label = e.target.textContent; ed.save(); }
        });
        const val = el('.b-rating__val', { text: noteTexte(b.value) + '/5' });
        row.append(label, starsWidget(b.value || 0, v => { b.value = v; val.textContent = noteTexte(v) + '/5'; ed.save(); }));
        row.append(val);
        node.append(row);
        break;
      }

      case 'gallery': {
        const box = el('.b-gallery');
        if (!b.images || !b.images.length) {
          box.append(el('.dropzone', {
            html: '<b>Déposez des images</b><br>ou cliquez pour parcourir',
            onclick: async () => {
              const got = await A.Media.pick(true);
              if (got.length) { b.images = got.map(m => ({ id: m.id, kind: m.kind, w: m.w, h: m.h })); ed.save(); rerender(ed); }
            }
          }));
        } else {
          box.append(A.Gallery.render({
            images: b.images, layout: b.layout || 'grille', editable: true, keepLayout: !!b.layout,
            onChange: (imgs, lay, raison) => {
              /* on ne supprime le fichier que sur un vrai retrait :
                 un déplacement vers une autre galerie doit le conserver */
              if (raison === 'suppression') {
                (b.images || []).filter(x => !imgs.includes(x)).forEach(x => A.Media.del(x.id));
              }
              b.images = imgs;
              if (lay) b.layout = lay;
              ed.save();
              rerender(ed);
            }
          }));
        }
        node.append(box);
        break;
      }

      case 'embed': {
        const box = el('.b-embed');
        if (!b.url) {
          const inp = el('input.input', { placeholder: 'Collez un lien X, YouTube, TikTok, Spotify, Instagram…' });
          const go = () => { const v = inp.value.trim(); if (!v) return; b.url = v; ed.save(); rerender(ed); };
          inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
          inp.addEventListener('paste', () => setTimeout(go, 30));
          box.append(el('.card', { style: { padding: '14px' } }, inp,
            el('div', { style: { marginTop: '8px', fontSize: '12px', color: 'var(--muted)' }, text: 'X · YouTube · TikTok · Instagram · Spotify · SoundCloud · Twitch · Vimeo · Dailymotion · Maps' })));
        } else {
          const info = A.Embed.parse(b.url);
          box.append(A.Embed.render(b.url, {
            film: b.film, tweet: b.tweet,
            reglages: b.reglages,
            onReglages: (r) => { b.reglages = r; ed.save(); rerender(ed); },
            onAffiche: info && info.kind === 'film'
              ? () => A.Embed.choisirAffiche(b, () => { ed.save(); rerender(ed); })
              : null,
            extra: el('button', {
              text: 'changer', style: { fontSize: '11.5px', color: 'var(--muted)' },
              onclick: () => { b.url = ''; b.film = null; ed.save(); rerender(ed); }
            })
          }));
          /* on interroge le relais local une seule fois par lien */
          if (info && info.kind === 'film' && !(b.film && b.film.pourUrl === b.url) && !b.filmEnCours) {
            b.filmEnCours = true;
            A.Embed.enrichirFilm(b.url).then(film => {
              b.filmEnCours = false;
              if (!film) return;
              film.pourUrl = b.url;
              b.film = film;
              ed.save(); rerender(ed);
            });
          }
          if (info && info.kind === 'x' && !A.Embed.tweetAJour(b.tweet, b.url) && !b.tweetEnCours) {
            b.tweetEnCours = true;
            A.Embed.enrichirTweet(b.url).then(tweet => {
              b.tweetEnCours = false;
              if (!tweet) return;
              tweet.pourUrl = b.url;
              b.tweet = tweet;
              ed.save(); rerender(ed);
            });
          }
        }
        node.append(box);
        break;
      }

      default: node.append(editable('', 'Écrivez…'));
    }
    return node;
  }

  function listNumber(ed, b) {
    let n = 1;
    const i = idx(ed, b.id);
    for (let j = i - 1; j >= 0; j--) {
      if (ed.doc.blocks[j].type === 'listo') n++; else break;
    }
    return n;
  }

  /** Affichage seul — accepte les demies (3.5 → trois étoiles et demie) */
  function stars(value) {
    const v = A.clamp(Number(value) || 0, 0, 5);
    return el('.stars.stars--ro',
      el('.stars__fond', { text: '★★★★★' }),
      el('.stars__plein', { text: '★★★★★', style: { width: (v / 5 * 100) + '%' } }));
  }

  /** Étoiles cliquables, au demi-point : moitié gauche = .5, moitié droite = entier */
  function starsWidget(value, onSet) {
    const box = el('.stars');
    const fond = el('.stars__fond', { text: '★★★★★' });
    const plein = el('.stars__plein', { text: '★★★★★' });
    let courant = A.clamp(Number(value) || 0, 0, 5);
    const peindre = v => plein.style.width = (v / 5 * 100) + '%';
    peindre(courant);
    box.append(fond, plein);

    const lire = (e) => {
      const r = box.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * 5;
      return A.clamp(Math.ceil(x * 2) / 2, 0.5, 5);
    };
    box.addEventListener('mousemove', e => peindre(lire(e)));
    box.addEventListener('mouseleave', () => peindre(courant));
    box.addEventListener('click', e => {
      const v = lire(e);
      courant = (v === courant) ? 0 : v;   // recliquer la même note l'efface
      peindre(courant);
      onSet(courant);
    });
    return box;
  }

  /** « 3,5 » plutôt que « 3.5 » */
  const noteTexte = (v) => String(Number(v) || 0).replace('.', ',');

  /* ---------- interactions clavier ---------- */
  function wireEditable(ed, b, body) {
    body.addEventListener('input', () => {
      b.html = body.innerHTML;
      ed.save();
      maybeMarkdown(ed, b, body);
    });

    body.addEventListener('keydown', (e) => {
      const i = idx(ed, b.id);

      /* raccourcis de mise en forme */
      if ((e.metaKey || e.ctrlKey) && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'b') { e.preventDefault(); document.execCommand('bold'); b.html = body.innerHTML; ed.save(); return; }
        if (k === 'i') { e.preventDefault(); document.execCommand('italic'); b.html = body.innerHTML; ed.save(); return; }
        if (k === 'u') { e.preventDefault(); document.execCommand('underline'); b.html = body.innerHTML; ed.save(); return; }
        if (k === 'e') { e.preventDefault(); wrapCode(body); b.html = body.innerHTML; ed.save(); return; }
        if (k === 'k') { e.preventDefault(); makeLink(body, () => { b.html = body.innerHTML; ed.save(); }); return; }
        if (k === 'enter' || e.key === 'Enter') {
          if (b.type === 'todo') { e.preventDefault(); b.done = !b.done; rerender(ed); ed.save(); return; }
        }
      }

      /* Entrée */
      if (e.key === 'Enter' && !e.shiftKey) {
        if (b.type === 'code') return;  // saut de ligne dans le code
        e.preventDefault();
        const empty = !stripHtml(body.innerHTML);
        if ((b.type === 'list' || b.type === 'listo' || b.type === 'todo') && empty) {
          b.type = 'text'; b.done = false; rerender(ed); focusEnd(bodyOf(ed, b.id)); ed.save(); return;
        }
        // scinde le bloc au niveau du caret
        const rest = splitAtCaret(body);
        b.html = body.innerHTML;
        const nextType = ['list', 'listo', 'todo'].includes(b.type) ? b.type : (['h1','h2','h3','quote'].includes(b.type) ? 'text' : b.type === 'callout' ? 'text' : 'text');
        insertAfter(ed, b.id, { type: nextType, html: rest, done: false, row: b.row || '' });
        return;
      }

      /* Retour arrière en début de bloc */
      if (e.key === 'Backspace' && caretAtStart(body)) {
        if (b.type !== 'text') {
          e.preventDefault();
          if (b.type === 'list' || b.type === 'listo' || b.type === 'todo' || b.type === 'callout' || b.type === 'quote') {
            b.type = 'text'; rerender(ed); focusStart(bodyOf(ed, b.id)); ed.save(); return;
          }
          b.type = 'text'; rerender(ed); focusStart(bodyOf(ed, b.id)); ed.save(); return;
        }
        if (i > 0) {
          const prev = ed.doc.blocks[i - 1];
          const prevBody = bodyOf(ed, prev.id);
          if (!prevBody) {  // bloc média au-dessus
            if (!stripHtml(body.innerHTML)) { e.preventDefault(); removeBlock(ed, b.id); }
            return;
          }
          e.preventDefault();
          const len = prevBody.textContent.length;
          prev.html = (prev.html || '') + (body.innerHTML || '');
          ed.doc.blocks.splice(i, 1);
          rerender(ed); ed.save();
          const nb = bodyOf(ed, prev.id);
          placeCaret(nb, len);
        }
        return;
      }

      /* Suppr en fin de bloc : fusionne le suivant */
      if (e.key === 'Delete' && caretAtEnd(body)) {
        const next = ed.doc.blocks[i + 1];
        if (next && bodyOf(ed, next.id)) {
          e.preventDefault();
          const len = body.textContent.length;
          b.html = (body.innerHTML || '') + (next.html || '');
          ed.doc.blocks.splice(i + 1, 1);
          rerender(ed); ed.save();
          placeCaret(bodyOf(ed, b.id), len);
        }
        return;
      }

      /* Navigation verticale */
      if (e.key === 'ArrowUp' && caretAtStart(body)) {
        const prev = prevEditable(ed, i);
        if (prev) { e.preventDefault(); focusEnd(prev); }
      }
      if (e.key === 'ArrowDown' && caretAtEnd(body)) {
        const next = nextEditable(ed, i);
        if (next) { e.preventDefault(); focusStart(next); }
      }

      /* Déplacement du bloc : Alt+↑ / Alt+↓ */
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        move(ed, b.id, e.key === 'ArrowUp' ? -1 : 1);
        focusEnd(bodyOf(ed, b.id));
        return;
      }

      /* menu / */
      if (e.key === '/' ) {
        setTimeout(() => {
          const before = textBefore(body);
          if (/(^|\s)\/$/.test(before)) openSlash(ed, b.id, body);
        }, 0);
      }

      /* Échap : ferme le menu */
      if (e.key === 'Escape') closeSlash();
    });

    /* collage intelligent */
    body.addEventListener('paste', (e) => {
      const dt = e.clipboardData;
      if (!dt) return;
      const files = Array.from(dt.files || []).filter(f => /^(image|video)\//.test(f.type));
      if (files.length) {
        e.preventDefault();
        A.Media.putMany(files).then(got => {
          if (!got.length) return;
          insertAfter(ed, b.id, { type: 'gallery', images: got.map(m => ({ id: m.id, kind: m.kind, w: m.w, h: m.h })), layout: got.length > 1 ? 'grille' : 'une' });
        });
        return;
      }
      const txt = (dt.getData('text/plain') || '').trim();
      if (A.Embed.looksEmbeddable(txt) && !stripHtml(body.innerHTML)) {
        e.preventDefault();
        b.type = 'embed'; b.url = txt; b.html = '';
        rerender(ed); ed.save();
        return;
      }
      // collage en texte brut, multi-lignes → plusieurs blocs
      e.preventDefault();
      const lines = txt.split(/\n{1,}/).map(l => l.trim()).filter(Boolean);
      if (lines.length <= 1) {
        document.execCommand('insertText', false, txt);
        b.html = body.innerHTML; ed.save();
      } else {
        document.execCommand('insertText', false, lines[0]);
        b.html = body.innerHTML;
        let anchor = b.id;
        lines.slice(1).forEach(l => {
          const nb = { id: uid('b'), type: 'text', html: A.esc(l) };
          ed.doc.blocks.splice(idx(ed, anchor) + 1, 0, nb);
          anchor = nb.id;
        });
        rerender(ed); ed.save();
        focusEnd(bodyOf(ed, anchor));
      }
    });

    body.addEventListener('focus', () => { ed.focused = b.id; });
  }

  function placeCaret(node, offset) {
    if (!node) return;
    node.focus();
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let n, acc = 0, target = null, to = 0;
    while ((n = walker.nextNode())) {
      if (acc + n.length >= offset) { target = n; to = offset - acc; break; }
      acc += n.length;
    }
    const r = document.createRange();
    if (target) r.setStart(target, Math.min(to, target.length));
    else { r.selectNodeContents(node); r.collapse(false); }
    r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }

  /** renvoie le HTML situé après le caret et le retire du bloc */
  function splitAtCaret(body) {
    const s = getSelection();
    if (!s.rangeCount) return '';
    const r = s.getRangeAt(0);
    const after = r.cloneRange();
    after.selectNodeContents(body);
    after.setStart(r.endContainer, r.endOffset);
    const frag = after.extractContents();
    const tmp = document.createElement('div');
    tmp.append(frag);
    return tmp.innerHTML;
  }

  function prevEditable(ed, i) {
    for (let j = i - 1; j >= 0; j--) { const n = bodyOf(ed, ed.doc.blocks[j].id); if (n) return n; }
    return null;
  }
  function nextEditable(ed, i) {
    for (let j = i + 1; j < ed.doc.blocks.length; j++) { const n = bodyOf(ed, ed.doc.blocks[j].id); if (n) return n; }
    return null;
  }

  function wrapCode(body) {
    const s = getSelection();
    if (!s.rangeCount || s.isCollapsed) return;
    const code = document.createElement('code');
    code.style.cssText = 'font-family:var(--f-mono);font-size:.88em;background:var(--surface-2);padding:1px 5px;border-radius:5px;border:1px solid var(--line)';
    try { s.getRangeAt(0).surroundContents(code); } catch (e) {}
  }
  function makeLink(body, done) {
    const s = getSelection();
    const sel = s.toString();
    A.promptDlg('Lien', '', (url) => {
      if (!/^https?:\/\//.test(url)) url = 'https://' + url;
      body.focus();
      document.execCommand('createLink', false, url);
      Array.from(body.querySelectorAll('a')).forEach(a => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
      done();
    }, { sub: sel ? `Lier « ${A.truncate(sel, 40)} »` : 'Le lien sera inséré.', placeholder: 'https://…' });
  }

  /* ---------- raccourcis markdown ---------- */
  function maybeMarkdown(ed, b, body) {
    if (b.type === 'code') return;
    const txt = body.textContent;
    const rules = [
      [/^#\s/, 'h1'], [/^##\s/, 'h2'], [/^###\s/, 'h3'],
      [/^>\s/, 'quote'], [/^[-*+]\s/, 'list'], [/^1[.)]\s/, 'listo'],
      [/^\[\]\s/, 'todo'], [/^\[\s?\]\s/, 'todo'], [/^```\s?/, 'code'],
      [/^\|\s/, 'callout']
    ];
    for (const [re, type] of rules) {
      const m = re.exec(txt);
      if (m && b.type !== type) {
        b.type = type;
        b.html = A.esc(txt.slice(m[0].length));
        rerender(ed); ed.save();
        focusEnd(bodyOf(ed, b.id));
        return;
      }
    }
    if (/^(---|—-|\*\*\*)$/.test(txt.trim())) {
      b.type = 'divider'; b.html = '';
      rerender(ed); ed.save();
      insertAfter(ed, b.id, { type: 'text', html: '' });
    }
  }

  /* ---------- opérations sur les blocs ---------- */
  function insertAfter(ed, afterId, data) {
    const nb = Object.assign({ id: uid('b'), type: 'text', html: '' }, data);
    const i = afterId ? idx(ed, afterId) : ed.doc.blocks.length - 1;
    ed.doc.blocks.splice(i + 1, 0, nb);
    rerender(ed); ed.save();
    const body = bodyOf(ed, nb.id);
    if (body) focusStart(body);
    else {
      const inp = ed.host.querySelector(`[data-id="${nb.id}"] input`);
      if (inp) inp.focus();
    }
    return nb;
  }
  function removeBlock(ed, id) {
    const i = idx(ed, id);
    if (i < 0) return;
    const gone = ed.doc.blocks[i];
    (gone.images || []).forEach(im => A.Media.del(im.id));
    ed.doc.blocks.splice(i, 1);
    if (!ed.doc.blocks.length) ed.doc.blocks.push({ id: uid('b'), type: 'text', html: '' });
    rerender(ed); ed.save();
    const target = ed.doc.blocks[Math.max(0, i - 1)];
    focusEnd(bodyOf(ed, target.id));
  }
  function duplicate(ed, id) {
    const i = idx(ed, id);
    const copy = JSON.parse(JSON.stringify(ed.doc.blocks[i]));
    copy.id = uid('b');
    ed.doc.blocks.splice(i + 1, 0, copy);
    rerender(ed); ed.save();
  }
  function move(ed, id, dir) {
    const i = idx(ed, id), j = i + dir;
    if (j < 0 || j >= ed.doc.blocks.length) return;
    const [b] = ed.doc.blocks.splice(i, 1);
    ed.doc.blocks.splice(j, 0, b);
    rerender(ed); ed.save();
  }
  function convert(ed, id, type) {
    const b = ed.doc.blocks[idx(ed, id)];
    if (!b) return;
    if (type === 'listo') { b.type = 'listo'; }
    else b.type = type;
    if (type === 'gallery' && !b.images) b.images = [];
    if (type === 'embed' && !b.url) b.url = '';
    rerender(ed); ed.save();
    focusEnd(bodyOf(ed, id));
  }

  function blockMenu(ed, b, anchor) {
    const items = [
      { icon: '⧉', label: 'Dupliquer', run: () => duplicate(ed, b.id) },
      { icon: '↑', label: 'Monter', run: () => move(ed, b.id, -1) },
      { icon: '↓', label: 'Descendre', run: () => move(ed, b.id, 1) },
      '-',
      { icon: '¶', label: 'Transformer en texte', run: () => convert(ed, b.id, 'text') },
      { icon: 'H2', label: 'Transformer en titre', run: () => convert(ed, b.id, 'h2') },
      { icon: '❝', label: 'Transformer en citation', run: () => convert(ed, b.id, 'quote') },
      { icon: '☑', label: 'Transformer en tâche', run: () => convert(ed, b.id, 'todo') },
      '-',
      { icon: '🗑', label: 'Supprimer', run: () => removeBlock(ed, b.id) }
    ];
    A.menu(anchor, items);
  }

  /* ---------- glisser-déposer des blocs ----------
     Quatre côtés : au-dessus / en dessous empile, à gauche / à droite
     met les deux blocs côte à côte (colonnes, façon Anytype). */
  const MARGE_COTE = 0.3;   // part de la largeur considérée comme « le côté »

  function zoneBloc(over, e) {
    const r = over.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    if (px < MARGE_COTE) return { cote: 'gauche' };
    if (px > 1 - MARGE_COTE) return { cote: 'droite' };
    return { cote: e.clientY < r.top + r.height / 2 ? 'haut' : 'bas' };
  }

  const CLASSE_ZONE = { haut: 'drop-before', bas: 'drop-after', gauche: 'drop-left', droite: 'drop-right' };

  function bindDnD(ed) {
    let dragId = null;
    const nettoie = () => ed.host.querySelectorAll('.block').forEach(n =>
      n.classList.remove('drop-before', 'drop-after', 'drop-left', 'drop-right'));

    ed.host.addEventListener('dragstart', e => {
      const grip = e.target.closest('.grip');
      if (!grip) return;
      const blk = grip.closest('.block');
      dragId = blk.dataset.id;
      blk.classList.add('is-drag');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragId); } catch (x) {}
    });

    ed.host.addEventListener('dragend', () => {
      dragId = null;
      nettoie();
      ed.host.querySelectorAll('.block').forEach(n => n.classList.remove('is-drag'));
    });

    ed.host.addEventListener('dragover', e => {
      if (!dragId) return;
      e.preventDefault();
      const over = e.target.closest('.block');
      nettoie();
      if (!over || over.dataset.id === dragId) return;
      over.classList.add(CLASSE_ZONE[zoneBloc(over, e).cote]);
    });

    ed.host.addEventListener('drop', e => {
      if (!dragId) return;
      const over = e.target.closest('.block');
      if (!over || over.dataset.id === dragId) return;
      e.preventDefault();
      const cote = zoneBloc(over, e).cote;
      nettoie();

      const blocks = ed.doc.blocks;
      const cible = blocks[idx(ed, over.dataset.id)];
      const [blk] = blocks.splice(idx(ed, dragId), 1);
      const iCible = blocks.indexOf(cible);

      if (cote === 'gauche' || cote === 'droite') {
        /* colonnes : les deux blocs partagent une même rangée */
        const row = cible.row || uid('r');
        cible.row = row;
        blk.row = row;
        blocks.splice(cote === 'gauche' ? iCible : iCible + 1, 0, blk);
      } else {
        /* empilement : le bloc sort de toute rangée et se pose avant / après
           le groupe entier de la cible */
        blk.row = '';
        const [a, b] = bornesRow(blocks, iCible);
        blocks.splice(cote === 'haut' ? a : b, 0, blk);
      }
      normaliseRows(blocks);
      rerender(ed); ed.save();
    });
  }

  /* ---------- dépôt d'images dans la page ---------- */
  function bindDrop(ed) {
    const host = ed.host;
    host.addEventListener('dragover', e => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
        e.preventDefault(); host.style.outline = '2px dashed var(--accent)'; host.style.outlineOffset = '10px';
      }
    });
    host.addEventListener('dragleave', () => { host.style.outline = ''; });
    host.addEventListener('drop', async e => {
      host.style.outline = '';
      const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []).filter(f => /^(image|video)\//.test(f.type));
      if (!files.length) return;
      e.preventDefault(); e.stopPropagation();
      const got = await A.Media.putMany(files);
      if (!got.length) return;
      const last = ed.doc.blocks[ed.doc.blocks.length - 1];
      insertAfter(ed, last.id, { type: 'gallery', images: got.map(m => ({ id: m.id, kind: m.kind, w: m.w, h: m.h })), layout: got.length > 1 ? 'grille' : 'une' });
    });
  }

  /* ---------- menu « / » ---------- */
  let slashState = null;
  function openSlash(ed, blockId, body, insertMode) {
    closeSlash();
    const host = $('#slash');
    slashState = { ed, blockId, body, query: '', sel: 0, insertMode };
    renderSlash();
    host.hidden = false;
    const anchor = body || ed.host.querySelector(`[data-id="${blockId}"]`);
    const r = anchor.getBoundingClientRect();
    host.style.left = Math.min(r.left, innerWidth - 306) + 'px';
    const below = innerHeight - r.bottom;
    if (below < 260) { host.style.top = ''; host.style.bottom = (innerHeight - r.top + 6) + 'px'; }
    else { host.style.bottom = ''; host.style.top = (r.bottom + 6) + 'px'; }
    document.addEventListener('keydown', slashKeys, true);
    setTimeout(() => document.addEventListener('mousedown', slashOutside), 0);
  }
  function closeSlash() {
    if (!slashState) return;
    $('#slash').hidden = true;
    document.removeEventListener('keydown', slashKeys, true);
    document.removeEventListener('mousedown', slashOutside);
    slashState = null;
  }
  function slashOutside(e) { if (!e.target.closest('#slash')) closeSlash(); }

  function filtered() {
    const q = A.plain(slashState.query);
    if (!q) return TYPES;
    return TYPES.filter(t => A.plain(t.nom + ' ' + t.kw).includes(q));
  }

  /* Reconstruit la liste. À NE PAS appeler au survol : recréer les nœuds
     sous le curseur détruit la cible du clic entre mousedown et mouseup
     (et le survol relance alors une cascade de reconstructions). */
  function renderSlash() {
    const host = $('#slash');
    host.innerHTML = '';
    const list = filtered();
    slashState.noeuds = [];
    if (!list.length) { host.append(el('.slash__group', { text: 'Aucun bloc' })); return; }
    slashState.sel = A.clamp(slashState.sel, 0, list.length - 1);
    let grp = '';
    list.forEach((t, i) => {
      if (t.grp !== grp) { grp = t.grp; host.append(el('.slash__group', { text: grp })); }
      const item = el('.slash__item', {
        onmouseenter: () => surligne(i),
        onmousedown: (e) => { e.preventDefault(); e.stopPropagation(); pick(t); }
      }, el('.slash__ico', { text: t.ico }), el('.slash__txt', el('b', { text: t.nom }), el('small', { text: t.desc })));
      slashState.noeuds.push(item);
      host.append(item);
    });
    surligne(slashState.sel);
  }

  /** déplace la sélection sans toucher au DOM existant */
  function surligne(i) {
    if (!slashState || !slashState.noeuds) return;
    slashState.sel = A.clamp(i, 0, slashState.noeuds.length - 1);
    slashState.noeuds.forEach((n, j) => n.classList.toggle('is-sel', j === slashState.sel));
    const cur = slashState.noeuds[slashState.sel];
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }

  function slashKeys(e) {
    if (!slashState) return;
    const list = filtered();
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSlash(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); surligne((slashState.sel + 1) % list.length); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); surligne((slashState.sel - 1 + list.length) % list.length); return; }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); if (list[slashState.sel]) pick(list[slashState.sel]); return; }
    if (e.key === 'Backspace') {
      if (!slashState.query) { closeSlash(); return; }
      slashState.query = slashState.query.slice(0, -1); slashState.sel = 0; setTimeout(renderSlash, 0); return;
    }
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      slashState.query += e.key; slashState.sel = 0; setTimeout(renderSlash, 0);
    }
  }

  function pick(type) {
    const { ed, blockId, body, insertMode, query } = slashState;
    closeSlash();

    /* « Vidéo » : une galerie qui ouvre directement le sélecteur de vidéos */
    if (type.t === 'video') {
      const b0 = ed.doc.blocks[idx(ed, blockId)];
      const vide = body && !stripHtml(body.innerHTML);
      const cible = vide ? b0 : insertAfter(ed, blockId, { type: 'gallery', images: [], layout: 'une' });
      if (vide) { cible.type = 'gallery'; cible.images = []; cible.layout = 'une'; cible.html = ''; }
      rerender(ed); ed.save();
      A.Media.pick(true, 'video').then(got => {
        if (!got.length) return;
        cible.images = got.map(m => ({ id: m.id, kind: m.kind, w: m.w, h: m.h }));
        ed.save(); rerender(ed);
      });
      return;
    }

    const t = type.t === 'listo' ? 'listo' : type.t;
    if (insertMode || !body) {
      const nb = insertAfter(ed, blockId, { type: t });
      if (t === 'gallery') nb.images = [];
      rerender(ed); ed.save();
      const nbody = bodyOf(ed, nb.id);
      if (nbody) focusStart(nbody);
      return;
    }
    // retire le "/xxx" tapé
    const b = ed.doc.blocks[idx(ed, blockId)];
    const txt = body.textContent;
    const cut = txt.lastIndexOf('/' + query);
    const kept = cut >= 0 ? txt.slice(0, cut) : txt.replace(/\/[^/]*$/, '');
    if (['gallery', 'embed', 'divider', 'rating'].includes(t)) {
      if (kept.trim()) {
        b.html = A.esc(kept);
        const nb = insertAfter(ed, blockId, { type: t, images: t === 'gallery' ? [] : undefined, url: t === 'embed' ? '' : undefined });
        rerender(ed); ed.save();
        return;
      }
      b.type = t; b.html = '';
      if (t === 'gallery') b.images = [];
      if (t === 'embed') b.url = '';
      if (t === 'rating') { b.value = 0; b.label = 'Note'; }
      rerender(ed); ed.save();
      return;
    }
    b.type = t;
    b.html = A.esc(kept);
    rerender(ed); ed.save();
    focusEnd(bodyOf(ed, blockId));
  }

  A.Editor = { mount, rerender, TYPES, starsWidget, stars, noteTexte, insertAfter, focusEnd, stripHtml };
})(window.App);
