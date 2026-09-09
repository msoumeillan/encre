/* ============================================================
   ENCRE — coffre secret
   Le contenu du coffre n'est jamais écrit en clair : il est
   chiffré en AES-GCM avec une clé dérivée du code par PBKDF2.
   Sans le code, ce qui reste sur le disque est illisible —
   y compris pour qui ouvre les outils du navigateur.
   ============================================================ */
(function (A) {
  'use strict';
  const S = () => A.Store.state();

  const ITERATIONS = 250000;
  const INACTIVITE = 10 * 60 * 1000;   // verrouillage automatique

  let cle = null;          // CryptoKey, en mémoire seulement
  let notes = null;        // contenu déchiffré, en mémoire seulement
  let minuterie = null;
  const abonnes = new Set();

  const dispo = () => !!(window.crypto && crypto.subtle);

  /* ---------- base64 ---------- */
  const versB64 = (buf) => {
    const o = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < o.length; i++) s += String.fromCharCode(o[i]);
    return btoa(s);
  };
  const depuisB64 = (b64) => {
    const s = atob(b64);
    const o = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i);
    return o;
  };

  /* ---------- primitives ---------- */
  async function deriver(code, sel, iterations) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: sel, iterations, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  /** renvoie « iv + chiffré » en base64 */
  async function chiffrer(donnees) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const secret = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cle, donnees);
    const tout = new Uint8Array(iv.length + secret.byteLength);
    tout.set(iv, 0);
    tout.set(new Uint8Array(secret), iv.length);
    return versB64(tout);
  }

  async function dechiffrer(b64, cleUtilisee) {
    const tout = depuisB64(b64);
    return crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: tout.slice(0, 12) }, cleUtilisee || cle, tout.slice(12));
  }

  const texteVers = (s) => new TextEncoder().encode(s);
  const versTexte = (buf) => new TextDecoder().decode(buf);

  /* ---------- état ---------- */
  function coffre() {
    const st = S();
    if (!st.coffre) st.coffre = { sel: '', iter: ITERATIONS, verif: '', charge: '', indice: '', medias: [] };
    return st.coffre;
  }
  const estConfigure = () => !!coffre().sel;
  const estOuvert = () => !!cle;
  function onChange(fn) { abonnes.add(fn); return () => abonnes.delete(fn); }
  const prevenir = () => abonnes.forEach(f => f());

  /* ---------- création / ouverture ---------- */
  async function configurer(code, indice) {
    if (!dispo()) throw new Error('Le chiffrement n’est pas disponible ici. Lancez le carnet avec demarrer.cmd.');
    if (!code || code.length < 4) throw new Error('Choisissez un code d’au moins 4 caractères.');
    const c = coffre();
    const sel = crypto.getRandomValues(new Uint8Array(16));
    cle = await deriver(code, sel, ITERATIONS);
    c.sel = versB64(sel);
    c.iter = ITERATIONS;
    c.indice = indice || '';
    c.medias = [];
    c.verif = await chiffrer(texteVers('encre-coffre'));
    notes = [];
    c.charge = await chiffrer(texteVers(JSON.stringify(notes)));
    A.Store.save(true);
    relancerMinuterie();
    prevenir();
  }

  async function ouvrir(code) {
    if (!dispo()) throw new Error('Le chiffrement n’est pas disponible ici. Lancez le carnet avec demarrer.cmd.');
    const c = coffre();
    if (!c.sel) throw new Error('Aucun coffre à ouvrir.');
    const essai = await deriver(code, depuisB64(c.sel), c.iter || ITERATIONS);
    try {
      const t = versTexte(await dechiffrer(c.verif, essai));
      if (t !== 'encre-coffre') throw new Error('bad');
    } catch (e) {
      throw new Error('Code incorrect.');
    }
    cle = essai;
    try {
      notes = JSON.parse(versTexte(await dechiffrer(c.charge)) || '[]');
    } catch (e) { notes = []; }
    relancerMinuterie();
    prevenir();
  }

  function fermer() {
    cle = null;
    notes = null;
    clearTimeout(minuterie);
    minuterie = null;
    urlsEnCache.forEach(u => URL.revokeObjectURL(u));
    urlsEnCache.clear();
    prevenir();
  }

  /** Change le code sans perdre le contenu : on rechiffre tout. */
  async function changerCode(ancien, nouveau, indice) {
    await ouvrir(ancien);
    const contenu = notes.slice();
    const medias = coffre().medias.slice();
    const anciensBlobs = [];
    for (const id of medias) anciensBlobs.push([id, await A.Media.brut(id)]);

    const clairs = [];
    for (const [id, chiffre] of anciensBlobs) {
      try { clairs.push([id, await dechiffrer(versB64(await chiffre.arrayBuffer()))]); }
      catch (e) { clairs.push([id, null]); }
    }
    await configurer(nouveau, indice);
    notes = contenu;
    coffre().medias = medias;
    for (const [id, donnees] of clairs) {
      if (!donnees) continue;
      const b64 = await chiffrer(donnees);
      await A.Media.putSecret(id, new Blob([depuisB64(b64)]));
    }
    await sauver();
  }

  /* ---------- contenu ---------- */
  function lesNotes() { return notes || []; }

  const sauverPlusTard = A.debounce(() => { sauver(); }, 500);

  async function sauver() {
    if (!cle || !notes) return;
    coffre().charge = await chiffrer(texteVers(JSON.stringify(notes)));
    A.Store.save(true);
  }

  function creerNote() {
    const n = {
      id: A.uid('sn'), titre: '', icon: '🔒', cover: null, coverPos: 50,
      blocks: [{ id: A.uid('b'), type: 'text', html: '' }],
      tags: [], createdAt: Date.now(), updatedAt: Date.now()
    };
    notes.unshift(n);
    sauverPlusTard();
    return n;
  }

  async function supprimerNote(id) {
    const n = (notes || []).find(x => x.id === id);
    if (n) {
      const ids = [];
      if (n.cover) ids.push(n.cover);
      (n.blocks || []).forEach(b => (b.images || []).forEach(im => ids.push(im.id)));
      for (const mid of ids) await supprimerMedia(mid);
    }
    notes = (notes || []).filter(x => x.id !== id);
    await sauver();
  }

  /* ---------- médias chiffrés ---------- */
  const urlsEnCache = new Map();

  /** Chiffre le fichier puis le range : sur le disque, ce sont des octets illisibles. */
  async function ajouterMedia(file) {
    if (!cle) throw new Error('Coffre verrouillé.');
    const donnees = await file.arrayBuffer();
    const b64 = await chiffrer(donnees);
    const id = A.uid('sc');
    await A.Media.putSecret(id, new Blob([depuisB64(b64)]), { type: file.type });
    coffre().medias.push(id);
    A.Store.save(true);
    return { id, kind: /^video\//.test(file.type) ? 'video' : 'image', w: 0, h: 0 };
  }

  async function supprimerMedia(id) {
    const c = coffre();
    c.medias = (c.medias || []).filter(x => x !== id);
    const u = urlsEnCache.get(id);
    if (u) { URL.revokeObjectURL(u); urlsEnCache.delete(id); }
    await A.Media.del(id);
    A.Store.save(true);
  }

  /** Appelé par Media.url pour les médias marqués secrets. */
  async function dechiffrerMedia(id, blob, type) {
    if (!cle) return '';
    if (urlsEnCache.has(id)) return urlsEnCache.get(id);
    try {
      const donnees = await dechiffrer(versB64(await blob.arrayBuffer()));
      const u = URL.createObjectURL(new Blob([donnees], { type: type || 'image/webp' }));
      urlsEnCache.set(id, u);
      return u;
    } catch (e) { return ''; }
  }

  /* ---------- verrouillage automatique ---------- */
  function relancerMinuterie() {
    if (!cle) return;
    clearTimeout(minuterie);
    minuterie = setTimeout(() => {
      fermer();
      A.toast('Coffre verrouillé après inactivité');
      if (A.route && A.route() === 'coffre') A.paint();
    }, INACTIVITE);
  }

  function surveiller() {
    ['pointerdown', 'keydown'].forEach(ev =>
      document.addEventListener(ev, () => { if (cle) relancerMinuterie(); }, { passive: true }));
    /* la clé ne vit qu'en mémoire : fermer l'onglet verrouille de fait */
    window.addEventListener('pagehide', () => { cle = null; notes = null; });
  }

  A.Coffre = {
    dispo, estConfigure, estOuvert, configurer, ouvrir, fermer, changerCode,
    lesNotes, creerNote, supprimerNote, sauver, sauverPlusTard,
    ajouterMedia, supprimerMedia, dechiffrerMedia,
    onChange, surveiller
  };
})(window.App);
