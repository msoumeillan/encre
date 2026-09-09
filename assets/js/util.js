/* ============================================================
   ENCRE — utilitaires
   ============================================================ */
window.App = window.App || {};

(function (A) {
  'use strict';

  /* ---------- DOM ---------- */
  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /** el('div.foo', {attrs}, ...children) */
  function el(spec, attrs, ...kids) {
    const m = /^([a-z0-9]+)?((?:[.#][^.#]+)*)$/i.exec(spec) || [];
    const node = document.createElement(m[1] || 'div');
    (m[2] || '').split(/(?=[.#])/).filter(Boolean).forEach(t => {
      if (t[0] === '#') node.id = t.slice(1);
      else node.classList.add(t.slice(1));
    });
    if (attrs && (attrs.nodeType || typeof attrs === 'string')) { kids.unshift(attrs); attrs = null; }
    for (const k in (attrs || {})) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    kids.flat(9).forEach(c => {
      if (c == null || c === false) return;
      node.append(c.nodeType ? c : document.createTextNode(String(c)));
    });
    return node;
  }

  const frag = (...kids) => { const f = document.createDocumentFragment(); kids.flat(9).filter(Boolean).forEach(c => f.append(c.nodeType ? c : document.createTextNode(String(c)))); return f; };

  /* ---------- divers ---------- */
  const uid = (p) => (p || 'x') + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function debounce(fn, ms) {
    let t; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    d.flush = (...a) => { clearTimeout(t); fn(...a); };
    d.cancel = () => clearTimeout(t);
    return d;
  }

  /* ---------- dates ---------- */
  const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const MOIS_C = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  const JOURS = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  const JOURS_C = ['dim','lun','mar','mer','jeu','ven','sam'];

  /** clé "AAAA-MM-JJ" en heure locale */
  function key(d) {
    d = d instanceof Date ? d : new Date(d);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  const today = () => key(new Date());
  function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
  function addDays(k, n) { const d = parseKey(k); d.setDate(d.getDate() + n); return key(d); }

  /** "mardi 20 août 2026" */
  function longDate(k) {
    const d = parseKey(k);
    return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
  }
  function midDate(k) {
    const d = parseKey(k);
    return `${d.getDate()} ${MOIS_C[d.getMonth()]} ${d.getFullYear()}`;
  }
  function relDate(k) {
    const t = today();
    if (k === t) return "aujourd'hui";
    if (k === addDays(t, -1)) return 'hier';
    if (k === addDays(t, 1)) return 'demain';
    const diff = Math.round((parseKey(k) - parseKey(t)) / 86400000);
    if (diff < 0 && diff > -7) return `il y a ${-diff} jours`;
    if (diff > 0 && diff < 7) return `dans ${diff} jours`;
    return midDate(k);
  }
  /** heure courte "14:38" */
  function hhmm(ts) { const d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  function relTime(ts) {
    const s = (Date.now() - ts) / 1000;
    if (s < 60) return "à l'instant";
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    const k = key(new Date(ts));
    if (k === addDays(today(), -1)) return 'hier ' + hhmm(ts);
    if (s < 86400 * 7) return `il y a ${Math.floor(s / 86400)} j`;
    return midDate(k);
  }

  /** matrice du mois : 6 semaines de 7 jours (lundi ou dimanche en tête) */
  function monthMatrix(year, month, weekStart) {
    const first = new Date(year, month, 1);
    let lead = first.getDay() - (weekStart === 'lun' ? 1 : 0);
    if (lead < 0) lead += 7;
    const start = new Date(year, month, 1 - lead);
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      cells.push({ k: key(d), d, out: d.getMonth() !== month });
    }
    return cells;
  }
  function dowLabels(weekStart) {
    const base = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
    return weekStart === 'lun' ? base.slice(1).concat(base[0]) : base;
  }
  /** semaine contenant k */
  function weekOf(k, weekStart) {
    const d = parseKey(k);
    let off = d.getDay() - (weekStart === 'lun' ? 1 : 0);
    if (off < 0) off += 7;
    return Array.from({ length: 7 }, (_, i) => addDays(key(d), i - off));
  }

  /* ---------- texte ---------- */
  /** transforme URLs / #tags / @mentions en HTML cliquable */
  function richText(s) {
    let h = esc(s);
    h = h.replace(/(https?:\/\/[^\s<]+)/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48)}${u.length > 60 ? '…' : ''}</a>`);
    h = h.replace(/(^|[\s(])#([\p{L}\p{N}_-]{1,32})/gu, (m, p, t) => `${p}<span class="mention">#${t}</span>`);
    h = h.replace(/(^|[\s(])@([\p{L}\p{N}_.]{1,32})/gu, (m, p, t) => `${p}<span class="mention">@${t}</span>`);
    return h;
  }
  const words = (s) => (String(s || '').trim().match(/[\p{L}\p{N}'’-]+/gu) || []).length;
  const truncate = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  /** minuscules sans accents, pour comparer/chercher */
  const plain = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const slug = (s) => plain(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  /** score de recherche floue simple */
  function fuzzy(needle, hay) {
    if (!needle) return 0;
    const n = plain(needle);
    const h = plain(hay);
    const i = h.indexOf(n);
    if (i === 0) return 100;
    if (i > 0) return 70 - Math.min(i, 40) / 2;
    let j = 0, sc = 0;
    for (const c of n) { const p = h.indexOf(c, j); if (p < 0) return -1; sc += p === j ? 2 : 1; j = p + 1; }
    return sc / n.length * 8;
  }

  /* ---------- couleurs ---------- */
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  /** noir ou blanc lisible sur la couleur donnée */
  function readable(hex) {
    const [r, g, b] = hexToRgb(hex);
    const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return L > 0.58 ? '#15130f' : '#fffaf4';
  }
  function withAlpha(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }

  /* ---------- UI : toasts ---------- */
  function toast(msg, kind) {
    const box = $('#toasts');
    const t = el('.toast', { html: msg });
    if (kind === 'bad') t.style.background = 'var(--bad)', t.style.color = '#fff';
    box.append(t);
    setTimeout(() => { t.classList.add('is-out'); setTimeout(() => t.remove(), 320); }, kind === 'bad' ? 3600 : 2400);
  }

  /* ---------- UI : modale ---------- */
  let modalClose = null;
  function modal(build, opts) {
    opts = opts || {};
    const host = $('#modal'), box = $('#modalBox');
    box.innerHTML = '';
    box.append(build(close));
    host.hidden = false;
    modalClose = close;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    const onBg = (e) => { if (e.target === host) close(); };
    document.addEventListener('keydown', onKey, true);
    host.addEventListener('mousedown', onBg);
    setTimeout(() => { const f = box.querySelector('[autofocus],input,textarea'); if (f) f.focus(); }, 60);
    function close(result) {
      document.removeEventListener('keydown', onKey, true);
      host.removeEventListener('mousedown', onBg);
      host.hidden = true; box.innerHTML = ''; modalClose = null;
      if (opts.onClose) opts.onClose(result);
    }
    return close;
  }

  function dialog({ title, sub, body, ok = 'Valider', cancel = 'Annuler', danger, onOk }) {
    return modal(close => {
      const wrap = el('div');
      wrap.append(el('h3.modal__title', { text: title }));
      if (sub) wrap.append(el('p.modal__sub', { text: sub }));
      if (body) wrap.append(body);
      const okBtn = el('button.btn' + (danger ? '.btn--danger' : '.btn--primary'), { text: ok, onclick: () => { if (onOk(wrap) !== false) close(); } });
      wrap.append(el('.modal__foot',
        el('button.btn.btn--ghost', { text: cancel, onclick: () => close() }),
        okBtn));
      wrap.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); okBtn.click(); } });
      return wrap;
    });
  }

  function confirmDlg(title, sub, onOk, okLabel) {
    dialog({ title, sub, ok: okLabel || 'Supprimer', danger: true, onOk });
  }

  function promptDlg(title, value, onOk, opts) {
    opts = opts || {};
    const input = el(opts.multiline ? 'textarea.textarea' : 'input.input', { value: value || '', placeholder: opts.placeholder || '', autofocus: true });
    dialog({
      title, sub: opts.sub, ok: opts.ok || 'Valider',
      body: el('.field', input),
      onOk: () => { const v = input.value.trim(); if (!v && !opts.allowEmpty) return false; onOk(v); }
    });
    setTimeout(() => { input.focus(); input.select && input.select(); }, 60);
  }

  /* ---------- sélecteur d'emoji ---------- */
  const EMOJIS = ('📓 📔 📕 📗 📘 📙 📖 ✒️ 🖋️ ✏️ 🗒️ 📅 🗓️ ⭐ 🌟 ✨ 💫 🌙 ☀️ 🌈 ⛅ 🌧️ ❄️ 🔥 💧 🌊 🍃 🌿 🌱 🌸 🌺 🌻 🌼 🍁 🍂 🌲 🏔️ 🌅 🌌 🎬 🎥 📺 🍿 🎮 🕹️ 🎧 🎵 🎸 🎹 📷 🖼️ 🎨 🖌️ 📚 📝 💭 💡 🧠 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 ☕ 🍵 🍜 🍣 🍱 🧋 🍰 🥐 🐱 🐶 🦊 🐻 🐼 🐰 🦉 🐉 🗾 ⛩️ 🎌 🏯 🚀 🛸 🎯 🏆 ⚡ 🌀 🔮 🗝️ 📌 📎 🔖 🏷️ ✅ ⏳ 💤').split(' ');

  /* Panneau ancré, et non une modale : il peut ainsi s'ouvrir PAR-DESSUS
     un formulaire déjà ouvert (édition d'un carnet) sans le remplacer. */
  const EMOJI_MOTS = {
    '📓': 'carnet cahier', '📔': 'carnet', '📕': 'livre', '📗': 'livre', '📘': 'livre', '📙': 'livre',
    '📖': 'livre lecture', '✒️': 'encre plume', '🖋️': 'plume stylo', '✏️': 'crayon', '🗒️': 'note',
    '📅': 'agenda date', '🗓️': 'agenda', '🎬': 'film cinema', '🎥': 'film camera', '📺': 'serie tele',
    '🍿': 'film cinema', '🎮': 'jeu', '🕹️': 'jeu', '🎧': 'musique audio', '🎵': 'musique',
    '🎸': 'musique', '🎹': 'musique', '📷': 'photo', '🖼️': 'image photo', '🎨': 'art dessin',
    '🌸': 'anime fleur sakura', '🗾': 'japon', '⛩️': 'japon', '🎌': 'japon', '🏯': 'japon',
    '☕': 'cafe', '🍵': 'the', '🍜': 'cuisine ramen', '🍣': 'cuisine sushi', '🍱': 'cuisine bento',
    '💭': 'pensee idee', '💡': 'idee', '🧠': 'cerveau idee', '⭐': 'etoile favori', '🔥': 'feu'
  };

  function emojiPicker(onPick, current, anchor) {
    const panel = el('.emoji-pop');
    const recherche = el('input.input.emoji-pop__q', { placeholder: 'Chercher ou coller un emoji…', value: '' });
    const grille = el('.emoji-pop__grid');

    const peindre = () => {
      const q = plain(recherche.value.trim());
      grille.innerHTML = '';
      const liste = q ? EMOJIS.filter(e => plain(EMOJI_MOTS[e] || '').includes(q)) : EMOJIS;
      if (!liste.length) {
        grille.append(el('.emoji-pop__vide', { text: 'Aucun résultat — validez pour utiliser ce que vous avez tapé.' }));
        return;
      }
      liste.forEach(e => grille.append(el('button.emoji-pop__item', {
        text: e, onclick: () => { onPick(e); fermer(); }
      })));
    };

    recherche.addEventListener('input', peindre);
    recherche.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); fermer(); }
      if (e.key === 'Enter') { e.preventDefault(); const v = recherche.value.trim(); if (v) { onPick(v); fermer(); } }
    });
    peindre();

    panel.append(recherche, grille, el('.emoji-pop__foot',
      el('button.btn.btn--ghost.btn--sm', { text: 'Retirer', onclick: () => { onPick(''); fermer(); } }),
      el('button.btn.btn--ghost.btn--sm', { text: 'Fermer', onclick: () => fermer() })));

    document.body.append(panel);

    if (anchor && anchor.getBoundingClientRect) {
      const r = anchor.getBoundingClientRect();
      panel.style.left = clamp(r.left, 8, innerWidth - panel.offsetWidth - 8) + 'px';
      const dessous = innerHeight - r.bottom;
      if (dessous < panel.offsetHeight + 12) panel.style.top = Math.max(8, r.top - panel.offsetHeight - 6) + 'px';
      else panel.style.top = (r.bottom + 6) + 'px';
    } else {
      panel.style.left = Math.round((innerWidth - panel.offsetWidth) / 2) + 'px';
      panel.style.top = '14vh';
    }
    setTimeout(() => recherche.focus(), 40);

    const dehors = (e) => { if (!panel.contains(e.target)) fermer(); };
    const auClavier = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fermer(); } };
    setTimeout(() => { document.addEventListener('mousedown', dehors, true); document.addEventListener('keydown', auClavier, true); }, 0);
    function fermer() {
      panel.remove();
      document.removeEventListener('mousedown', dehors, true);
      document.removeEventListener('keydown', auClavier, true);
    }
    return fermer;
  }

  /* ---------- menu contextuel ---------- */
  function menu(anchor, items) {
    const m = el('.slash', { style: { width: '210px' } });
    items.forEach(it => {
      if (it === '-') { m.append(el('div', { style: { height: '1px', background: 'var(--line)', margin: '5px 8px' } })); return; }
      m.append(el('.slash__item', {
        onclick: () => { close(); it.run(); }
      }, el('.slash__ico', { text: it.icon || '·' }), el('.slash__txt', el('b', { text: it.label }))));
    });
    document.body.append(m);
    const r = anchor.getBoundingClientRect();
    m.style.left = Math.min(r.left, innerWidth - 226) + 'px';
    m.style.top = Math.min(r.bottom + 6, innerHeight - m.offsetHeight - 10) + 'px';
    m.hidden = false;
    const off = (e) => { if (!m.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    setTimeout(() => { document.addEventListener('mousedown', off); document.addEventListener('keydown', onKey); }, 0);
    function close() { m.remove(); document.removeEventListener('mousedown', off); document.removeEventListener('keydown', onKey); }
    return close;
  }

  /* ---------- téléchargement ---------- */
  function download(name, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: type || 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  Object.assign(A, {
    $, $$, el, frag, uid, clamp, esc, debounce,
    MOIS, MOIS_C, JOURS, JOURS_C,
    key, today, parseKey, addDays, longDate, midDate, relDate, relTime, hhmm,
    monthMatrix, dowLabels, weekOf,
    richText, words, truncate, slug, plain, fuzzy,
    hexToRgb, readable, withAlpha,
    toast, modal, dialog, confirmDlg, promptDlg, emojiPicker, menu, download
  });
})(window.App);
