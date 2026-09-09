/* ============================================================
   ENCRE — état & persistance
   ============================================================ */
(function (A) {
  'use strict';

  const LS_KEY = 'encre:data:v1';
  const VERSION = 1;

  const THEMES = [
    { id: 'papier', nom: 'Papier',  bg: '#efe9dc', ink: '#1e1b17', accent: '#b3542a' },
    { id: 'lin',    nom: 'Lin',     bg: '#e8e4d9', ink: '#26241d', accent: '#6b7a4e' },
    { id: 'sakura', nom: 'Sakura',  bg: '#f7ecee', ink: '#2b1f26', accent: '#c2557f' },
    { id: 'brume',  nom: 'Brume',   bg: '#e9ecef', ink: '#151b22', accent: '#3a6ea5' },
    { id: 'encre',  nom: 'Encre',   bg: '#100f0d', ink: '#ece5d8', accent: '#d9884a' },
    { id: 'foret',  nom: 'Forêt',   bg: '#0e1512', ink: '#e2ead9', accent: '#87b06a' },
    { id: 'nuit',   nom: 'Nuit',    bg: '#08080a', ink: '#e8e8ef', accent: '#7c6cf5' }
  ];
  const DARK = new Set(['encre', 'foret', 'nuit']);

  const ACCENTS = ['#b3542a', '#c2557f', '#7c6cf5', '#3a6ea5', '#2f8a7a', '#6b7a4e', '#c9902b', '#a8433b', '#8a5cd6', '#4a7fb5'];

  const FONTS = [
    { id: 'editorial', nom: 'Éditorial', display: '"Instrument Serif", Georgia, serif', body: '"Newsreader", Georgia, serif', ex: 'Aa' },
    { id: 'moderne',   nom: 'Moderne',   display: '"Fraunces", Georgia, serif',          body: '"Inter", system-ui, sans-serif', ex: 'Aa' },
    { id: 'net',       nom: 'Net',       display: '"Space Grotesk", system-ui, sans-serif', body: '"Inter", system-ui, sans-serif', ex: 'Aa' },
    { id: 'machine',   nom: 'Machine',   display: '"Space Grotesk", system-ui, sans-serif', body: '"JetBrains Mono", monospace', ex: 'Aa' },
    { id: 'livre',     nom: 'Livre',     display: '"Fraunces", Georgia, serif',          body: '"Newsreader", Georgia, serif', ex: 'Aa' }
  ];

  const MOODS = [
    { id: 'radieux', e: '🌞', nom: 'Radieux', c: '#e0a63c' },
    { id: 'bien',    e: '🙂', nom: 'Bien',    c: '#6d9e6a' },
    { id: 'calme',   e: '🌊', nom: 'Calme',   c: '#5a8fb5' },
    { id: 'pensif',  e: '🌙', nom: 'Pensif',  c: '#7c6cf5' },
    { id: 'fatigue', e: '🌫️', nom: 'Fatigué', c: '#8a8175' },
    { id: 'tendu',   e: '⚡', nom: 'Tendu',   c: '#c9902b' },
    { id: 'sombre',  e: '🌧️', nom: 'Sombre',  c: '#5b6472' },
    { id: 'amoureux',e: '🌸', nom: 'Épris',   c: '#c2557f' }
  ];

  const LAYOUTS = [
    { id: 'auto',      nom: 'Auto' },
    { id: 'grille',    nom: 'Grille' },
    { id: 'mosaique',  nom: 'Mosaïque' },
    { id: 'colonnes',  nom: 'Colonnes' },
    { id: 'duo',       nom: 'Duo' },
    { id: 'pellicule', nom: 'Pellicule' },
    { id: 'carrousel', nom: 'Carrousel' },
    { id: 'polaroid',  nom: 'Polaroïd' },
    { id: 'une',       nom: 'Pleine' }
  ];

  const DEFAULTS = () => ({
    version: VERSION,
    settings: {
      theme: 'papier',
      accent: '',              // '' = accent du thème
      pattern: 'halo',
      grain: 'on',
      fonts: 'editorial',
      radius: 14,
      measure: 68,
      fontSize: 17.5,
      lineHeight: 1.72,
      coverHeight: 260,
      weekStart: 'lun',
      author: 'moi',
      initial: '✦',
      brandName: 'Encre',
      brandSub: 'carnet & agenda',
      brandMark: '✒',
      sidebar: 'shown',
      autoDate: true,
      spellcheck: true
    },
    days: {},        // "2026-08-20" -> jour
    posts: [],       // du plus récent au plus ancien
    notes: [],
    collections: [
      { id: 'c-anime', nom: 'Animes', emoji: '🌸', desc: 'Chaque épisode, chaque impression.', rating: true, episodes: true },
      { id: 'c-films', nom: 'Films',  emoji: '🎬', desc: 'Ce que je regarde.', rating: true, episodes: false },
      { id: 'c-notes', nom: 'Pensées', emoji: '💭', desc: 'Fragments en vrac.', rating: false, episodes: false }
    ],
    /* coffre secret : tout y est chiffré, seul le strict nécessaire
       reste en clair (sel, vérificateur, liste des médias pour le ménage) */
    coffre: { sel: '', iter: 250000, verif: '', charge: '', indice: '', medias: [] },
    ui: { lastRoute: 'journal', lastDay: null, lastCollection: null }
  });

  let S = DEFAULTS();
  const listeners = new Set();

  /* ---------- persistance ---------- */
  const persist = A.debounce(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(S));
    } catch (e) {
      A.toast('Stockage plein. Exportez puis allégez vos données.', 'bad');
    }
  }, 260);

  function save(silent) {
    S.updatedAt = Date.now();
    persist();
    if (!silent) listeners.forEach(f => f());
  }
  function flush() { persist.flush(); }
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(LS_KEY); } catch (e) {}
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        S = migrate(parsed);
      } catch (e) { console.warn('[Encre] données illisibles, réinitialisation.', e); }
    } else {
      S = DEFAULTS();
      seed();
    }
    return S;
  }

  function migrate(d) {
    const base = DEFAULTS();
    d.settings = Object.assign(base.settings, d.settings || {});
    d.days = d.days || {};
    d.posts = d.posts || [];
    d.notes = d.notes || [];
    d.collections = d.collections && d.collections.length ? d.collections : base.collections;
    /* le drapeau « épisodes » est arrivé après coup : on devine pour l'existant */
    d.collections.forEach(c => {
      if (c.episodes === undefined) {
        c.episodes = !/film|livre|lecture|photo|pens|recette|musique/i.test(c.nom || '');
      }
    });
    d.coffre = Object.assign(base.coffre, d.coffre || {});
    d.ui = Object.assign(base.ui, d.ui || {});
    d.version = VERSION;
    return d;
  }

  /* ---------- amorce (première visite) ---------- */
  function seed() {
    const t = A.today();
    S.days[t] = {
      date: t,
      titre: '',
      cover: null,
      coverPos: 50,
      mood: '',
      tags: [],
      blocks: [
        { id: A.uid('b'), type: 'text', html: 'Bienvenue. Cette page est à vous — écrivez ici, ou tapez <b>/</b> pour insérer un titre, une image, une citation, une vidéo…' },
        { id: A.uid('b'), type: 'callout', tone: 'accent', emoji: '💡', html: 'Astuce : <b>⌘K</b> ouvre la recherche, <b>⌘J</b> revient à aujourd’hui. Ajoutez une couverture en haut de la page.' }
      ],
      createdAt: Date.now(), updatedAt: Date.now()
    };
    S.notes = [{
      id: A.uid('n'), titre: 'Comment j’utilise Encre', icon: '📓',
      blocks: [
        { id: A.uid('b'), type: 'h2', html: 'Trois espaces' },
        { id: A.uid('b'), type: 'list', ordered: false, html: '<b>Journal</b> — une page par jour, avec couverture et humeur.' },
        { id: A.uid('b'), type: 'list', ordered: false, html: '<b>Fil</b> — des notes courtes façon posts, avec images et notes /5.' },
        { id: A.uid('b'), type: 'list', ordered: false, html: '<b>Carnets</b> — regroupe les posts par thème : animes, films, pensées…' }
      ],
      tags: ['guide'], pinned: true, createdAt: Date.now(), updatedAt: Date.now()
    }];
    save(true);
  }

  /* ---------- accès ---------- */
  const state = () => S;
  const settings = () => S.settings;

  function day(k, create) {
    let d = S.days[k];
    if (!d && create) {
      d = S.days[k] = {
        date: k, titre: '', cover: null, coverPos: 50, mood: '', tags: [],
        blocks: [{ id: A.uid('b'), type: 'text', html: '' }],
        createdAt: Date.now(), updatedAt: Date.now()
      };
    }
    return d;
  }
  function dayHasContent(d) {
    if (!d) return false;
    if (d.titre || d.cover || d.mood || (d.tags && d.tags.length)) return true;
    return (d.blocks || []).some(b => (b.html && b.html.replace(/<[^>]*>/g, '').trim()) || b.images && b.images.length || b.url || b.type === 'rating' && b.value);
  }
  function daysWithContent() {
    return Object.keys(S.days).filter(k => dayHasContent(S.days[k])).sort();
  }
  function dayText(d) {
    if (!d) return '';
    return (d.blocks || []).map(b => (b.html || '').replace(/<[^>]*>/g, ' ')).join(' ').replace(/\s+/g, ' ').trim();
  }
  function postsOf(k) { return S.posts.filter(p => p.date === k); }

  /** supprime les journées ouvertes mais laissées vides (sauf celle affichée) */
  function prune(except) {
    let n = 0;
    Object.keys(S.days).forEach(k => {
      if (k === except) return;
      if (!dayHasContent(S.days[k])) { delete S.days[k]; n++; }
    });
    if (n) save(true);
  }

  function collection(id) { return S.collections.find(c => c.id === id); }

  /* ---------- séries ---------- */
  function streak() {
    const set = new Set(daysWithContent());
    let n = 0, k = A.today();
    if (!set.has(k) && !S.posts.some(p => p.date === k)) k = A.addDays(k, -1);
    while (set.has(k) || S.posts.some(p => p.date === k)) { n++; k = A.addDays(k, -1); }
    return n;
  }

  function stats() {
    const ds = daysWithContent();
    let mots = 0;
    ds.forEach(k => mots += A.words(dayText(S.days[k])));
    S.posts.forEach(p => mots += A.words(p.texte));
    return {
      jours: ds.length,
      posts: S.posts.length,
      notes: S.notes.length,
      mots,
      images: allImageIds().length,
      serie: streak()
    };
  }

  function allTags() {
    const m = new Map();
    const add = t => m.set(t, (m.get(t) || 0) + 1);
    Object.values(S.days).forEach(d => (d.tags || []).forEach(add));
    S.posts.forEach(p => (p.tags || []).forEach(add));
    S.notes.forEach(n => (n.tags || []).forEach(add));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }

  function allImageIds() {
    const ids = new Set();
    const scanBlocks = bs => (bs || []).forEach(b => (b.images || []).forEach(im => ids.add(im.id)));
    Object.values(S.days).forEach(d => { if (d.cover) ids.add(d.cover); scanBlocks(d.blocks); });
    S.notes.forEach(n => { if (n.cover) ids.add(n.cover); scanBlocks(n.blocks); });
    S.posts.forEach(p => (p.images || []).forEach(im => ids.add(im.id)));
    S.collections.forEach(c => { if (c.cover) ids.add(c.cover); });
    S.posts.forEach(p => {
      if (p.film && p.film.posterId) ids.add(p.film.posterId);
      if (p.tweet) {
        if (p.tweet.avatarId) ids.add(p.tweet.avatarId);
        (p.tweet.mediaIds || []).forEach(x => ids.add(x));
        if (p.tweet.cite) {
          if (p.tweet.cite.avatarId) ids.add(p.tweet.cite.avatarId);
          (p.tweet.cite.mediaIds || []).forEach(x => ids.add(x));
        }
      }
    });
    /* médias du coffre : leurs identifiants restent en clair, sans quoi
       le ménage automatique les effacerait */
    ((S.coffre && S.coffre.medias) || []).forEach(x => ids.add(x));
    return Array.from(ids);
  }

  /* ---------- thème ---------- */
  function applyTheme() {
    const s = S.settings;
    const root = document.documentElement;
    root.dataset.theme = s.theme;
    root.dataset.pattern = s.pattern;
    root.dataset.grain = s.grain;
    root.dataset.sidebar = s.sidebar;
    root.dataset.dark = DARK.has(s.theme) ? 'true' : 'false';

    const st = root.style;
    if (s.accent) {
      st.setProperty('--accent', s.accent);
      st.setProperty('--accent-ink', A.readable(s.accent));
      st.setProperty('--accent-wash', A.withAlpha(s.accent, DARK.has(s.theme) ? 0.14 : 0.1));
    } else {
      st.removeProperty('--accent'); st.removeProperty('--accent-ink'); st.removeProperty('--accent-wash');
    }
    const f = FONTS.find(x => x.id === s.fonts) || FONTS[0];
    st.setProperty('--f-display', f.display);
    st.setProperty('--f-body', f.body);
    st.setProperty('--r', s.radius + 'px');
    st.setProperty('--r-lg', (s.radius + 6) + 'px');
    st.setProperty('--measure', s.measure + 'ch');
    st.setProperty('--fs-read', s.fontSize + 'px');
    st.setProperty('--lh-read', s.lineHeight);
    st.setProperty('--cover-h', s.coverHeight + 'px');

    const bm = A.$('#brandMark'), bn = A.$('#brandName'), bs = A.$('#brandSub');
    if (bm) bm.textContent = s.brandMark || '✒';
    if (bn) bn.textContent = s.brandName || 'Encre';
    if (bs) bs.textContent = s.brandSub || '';
    document.title = (s.brandName || 'Encre') + ' — ' + (s.brandSub || 'carnet');
  }

  function setSetting(k, v) { S.settings[k] = v; applyTheme(); save(true); }

  /* ---------- export / import ---------- */
  async function exportJSON(withImages) {
    const data = JSON.parse(JSON.stringify(S));
    const pack = { app: 'encre', version: VERSION, exportedAt: new Date().toISOString(), data };
    if (withImages) pack.images = await A.Media.exportAll(allImageIds());
    return JSON.stringify(pack, null, withImages ? 0 : 2);
  }

  async function importJSON(text, mode) {
    const pack = JSON.parse(text);
    const incoming = pack.data || pack;
    if (!incoming || (!incoming.days && !incoming.posts)) throw new Error('Fichier non reconnu.');
    if (pack.images) await A.Media.importAll(pack.images);
    if (mode === 'fusion') {
      const cur = S;
      Object.entries(incoming.days || {}).forEach(([k, d]) => { if (!cur.days[k]) cur.days[k] = d; });
      const seen = new Set(cur.posts.map(p => p.id));
      (incoming.posts || []).forEach(p => { if (!seen.has(p.id)) cur.posts.push(p); });
      const seenN = new Set(cur.notes.map(n => n.id));
      (incoming.notes || []).forEach(n => { if (!seenN.has(n.id)) cur.notes.push(n); });
      const seenC = new Set(cur.collections.map(c => c.id));
      (incoming.collections || []).forEach(c => { if (!seenC.has(c.id)) cur.collections.push(c); });
      cur.posts.sort((a, b) => b.createdAt - a.createdAt);
    } else {
      S = migrate(incoming);
    }
    save();
    applyTheme();
  }

  /** Export Markdown de tout le journal */
  function exportMarkdown() {
    const out = [];
    const html2md = (b) => {
      const txt = (b.html || '').replace(/<br\s*\/?>/g, '\n').replace(/<b>|<strong>/g, '**').replace(/<\/b>|<\/strong>/g, '**')
        .replace(/<i>|<em>/g, '_').replace(/<\/i>|<\/em>/g, '_').replace(/<[^>]*>/g, '').trim();
      switch (b.type) {
        case 'h1': return '# ' + txt;
        case 'h2': return '## ' + txt;
        case 'h3': return '### ' + txt;
        case 'quote': return '> ' + txt;
        case 'code': return '```\n' + txt + '\n```';
        case 'divider': return '---';
        case 'todo': return (b.done ? '- [x] ' : '- [ ] ') + txt;
        case 'list': return (b.ordered ? '1. ' : '- ') + txt;
        case 'callout': return '> ' + (b.emoji || '') + ' ' + txt;
        case 'rating': return `**${b.label || 'Note'} : ${b.value || 0}/5**`;
        case 'embed': return b.url || '';
        case 'gallery': return `_[${(b.images || []).length} image(s)]_`;
        default: return txt;
      }
    };
    out.push(`# ${S.settings.brandName || 'Encre'}\n`);
    Object.keys(S.days).sort().reverse().forEach(k => {
      const d = S.days[k];
      if (!dayHasContent(d)) return;
      out.push(`\n## ${A.longDate(k)}${d.titre ? ' — ' + d.titre : ''}\n`);
      if (d.mood) { const m = MOODS.find(x => x.id === d.mood); if (m) out.push(`_${m.e} ${m.nom}_\n`); }
      (d.blocks || []).forEach(b => { const l = html2md(b); if (l) out.push(l + '\n'); });
      postsOf(k).forEach(p => {
        if (p.titre) out.push(`\n### ${p.titre}${p.episode ? ' — ép. ' + p.episode : ''}${p.rating ? ' (' + p.rating + '/5)' : ''}\n`);
        if (p.texte) out.push(`\n> ${p.texte.replace(/\n/g, '\n> ')}\n`);
      });
    });
    if (S.notes.length) {
      out.push('\n\n# Notes\n');
      S.notes.forEach(n => {
        out.push(`\n## ${n.icon || ''} ${n.titre || 'Sans titre'}\n`);
        (n.blocks || []).forEach(b => { const l = html2md(b); if (l) out.push(l + '\n'); });
      });
    }
    return out.join('\n');
  }

  function reset() {
    S = DEFAULTS();
    seed();
    applyTheme();
    save();
  }

  A.Store = {
    THEMES, DARK, ACCENTS, FONTS, MOODS, LAYOUTS,
    load, save, flush, onChange, state, settings, setSetting, applyTheme,
    day, dayHasContent, daysWithContent, dayText, postsOf, prune, collection,
    streak, stats, allTags, allImageIds,
    exportJSON, importJSON, exportMarkdown, reset
  };
})(window.App);
