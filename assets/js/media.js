/* ============================================================
   ENCRE — stockage des images
   IndexedDB (avec repli localStorage), redimensionnement,
   cache d'URL objet.
   ============================================================ */
(function (A) {
  'use strict';

  const DB_NAME = 'encre-media';
  const STORE = 'images';
  const LS_PREFIX = 'encre:img:';
  const MAX_EDGE = 1800;        // px, côté le plus long
  const QUALITY = 0.86;

  let dbp = null;
  let useLS = false;
  const urlCache = new Map();

  function openDB() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      let req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (e) { return rej(e); }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
      setTimeout(() => rej(new Error('timeout')), 4000);
    }).catch(err => { useLS = true; console.warn('[Encre] IndexedDB indisponible, repli localStorage.', err); return null; });
    return dbp;
  }

  async function idb(mode, fn) {
    const db = await openDB();
    if (!db) return null;
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  /* ---------- redimensionnement ---------- */
  function loadImage(src) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = src;
    });
  }

  async function shrink(file) {
    const raw = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
    // GIF : on garde tel quel pour préserver l'animation
    if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
      const im = await loadImage(raw).catch(() => null);
      return { blob: file, w: im ? im.naturalWidth : 0, h: im ? im.naturalHeight : 0, type: file.type };
    }
    const im = await loadImage(raw);
    let { naturalWidth: w, naturalHeight: h } = im;
    const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
    w = Math.round(w * scale); h = Math.round(h * scale);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const cx = cv.getContext('2d');
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(im, 0, 0, w, h);
    const type = 'image/webp';
    const blob = await new Promise(r => cv.toBlob(r, type, QUALITY));
    if (!blob) return { blob: file, w, h, type: file.type };
    // si le "redimensionné" est plus lourd que l'original, on garde l'original
    if (blob.size > file.size && scale === 1) return { blob: file, w, h, type: file.type };
    return { blob, w, h, type };
  }

  function blobToDataURL(blob) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  }
  function dataURLToBlob(u) {
    const [head, b64] = u.split(',');
    const mime = (/data:([^;]+)/.exec(head) || [])[1] || 'image/webp';
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  /* ---------- API ---------- */

  /** Dimensions d'une vidéo, sans la charger entièrement */
  function videoDims(file) {
    return new Promise(res => {
      const u = URL.createObjectURL(file);
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => { res({ w: v.videoWidth, h: v.videoHeight, duree: v.duration }); URL.revokeObjectURL(u); };
      v.onerror = () => { res({ w: 0, h: 0, duree: 0 }); URL.revokeObjectURL(u); };
      v.src = u;
      setTimeout(() => res({ w: 0, h: 0, duree: 0 }), 4000);
    });
  }

  /** Enregistre un File (image ou vidéo) → {id,kind,w,h,name,type,size} */
  async function put(file) {
    if (!file || !/^(image|video)\//.test(file.type)) throw new Error('Format non pris en charge');

    /* dans le coffre, rien ne touche le disque en clair */
    if (A.Media.secret && A.Coffre && A.Coffre.estOuvert()) return A.Coffre.ajouterMedia(file);

    /* vidéo : conservée telle quelle, on ne réencode pas dans le navigateur */
    if (/^video\//.test(file.type)) {
      const { w, h, duree } = await videoDims(file);
      const id = A.uid('vd');
      const rec = { blob: file, kind: 'video', w, h, duree, type: file.type, name: file.name || 'video', size: file.size, at: Date.now() };
      await openDB();
      if (useLS) throw new Error('Les vidéos demandent le mode serveur (voir demarrer.cmd).');
      await idb('readwrite', st => st.put(rec, id));
      return { id, kind: 'video', w, h, duree, name: rec.name, type: file.type, size: file.size };
    }

    const { blob, w, h, type } = await shrink(file);
    const id = A.uid('im');
    const rec = { blob, w, h, type, kind: 'image', name: file.name || 'image', size: blob.size, at: Date.now() };
    await openDB();
    if (useLS) {
      const du = await blobToDataURL(blob);
      try { localStorage.setItem(LS_PREFIX + id, du); }
      catch (e) { throw new Error('Stockage plein — impossible d\'enregistrer l\'image.'); }
    } else {
      await idb('readwrite', st => st.put(rec, id));
    }
    return { id, kind: 'image', w, h, name: rec.name, type, size: rec.size };
  }

  /** Enregistre directement une dataURL (import) */
  async function putDataURL(id, dataURL, meta) {
    await openDB();
    if (useLS) { localStorage.setItem(LS_PREFIX + id, dataURL); return id; }
    const blob = dataURLToBlob(dataURL);
    /* un média du coffre garde sa marque : sans elle, on tenterait de
       l'afficher tel quel au lieu de le déchiffrer */
    const secret = String(id).startsWith('sc');
    await idb('readwrite', st => st.put(Object.assign({ blob, secret, at: Date.now() }, meta || {}), id));
    return id;
  }

  /** Enregistre des octets déjà chiffrés (coffre secret) */
  async function putSecret(id, blob, meta) {
    await openDB();
    if (useLS) throw new Error('Le coffre demande le mode serveur (voir demarrer.cmd).');
    await idb('readwrite', st => st.put(Object.assign({
      blob, secret: true, kind: 'image', at: Date.now()
    }, meta || {}), id));
    return id;
  }

  /** Octets bruts tels qu'ils sont sur le disque (encore chiffrés) */
  async function brut(id) {
    await openDB();
    if (useLS) return null;
    const rec = await idb('readonly', st => st.get(id)).catch(() => null);
    return rec ? rec.blob : null;
  }

  /** URL objet (mise en cache) pour un id */
  async function url(id) {
    if (!id) return '';
    if (urlCache.has(id)) return urlCache.get(id);
    await openDB();
    let u = '';
    if (useLS) {
      u = localStorage.getItem(LS_PREFIX + id) || '';
    } else {
      const rec = await idb('readonly', st => st.get(id)).catch(() => null);
      if (rec && rec.blob) {
        /* média du coffre : illisible tant que le coffre est verrouillé */
        if (rec.secret) return A.Coffre ? A.Coffre.dechiffrerMedia(id, rec.blob, rec.type) : '';
        u = URL.createObjectURL(rec.blob);
      }
    }
    urlCache.set(id, u);
    return u;
  }

  /** Applique l'image à un <img> de façon asynchrone */
  function apply(imgEl, id) {
    if (!id) return imgEl;
    imgEl.dataset.mid = id;
    url(id).then(u => { if (u && imgEl.dataset.mid === id) imgEl.src = u; });
    return imgEl;
  }

  /** <img> prêt à l'emploi.
   *  Pas de loading="lazy" : les images sont des blobs locaux (aucun coût
   *  réseau) et le chargement différé se bloquerait sur les agencements
   *  dont la hauteur dépend de l'image (Colonnes, Pleine page). */
  function img(id, attrs) {
    const im = A.el('img', Object.assign({ alt: '', decoding: 'async' }, attrs || {}));
    return apply(im, id);
  }

  async function del(id) {
    urlCache.delete(id);
    await openDB();
    if (useLS) { localStorage.removeItem(LS_PREFIX + id); return; }
    await idb('readwrite', st => st.delete(id)).catch(() => {});
  }

  /** Toutes les images en dataURL (pour l'export) */
  async function exportAll(ids) {
    const out = {};
    await openDB();
    for (const id of ids) {
      try {
        if (useLS) {
          const v = localStorage.getItem(LS_PREFIX + id);
          if (v) out[id] = v;
        } else {
          const rec = await idb('readonly', st => st.get(id));
          if (rec && rec.blob) out[id] = await blobToDataURL(rec.blob);
        }
      } catch (e) { /* image manquante : on continue */ }
    }
    return out;
  }

  async function importAll(map) {
    for (const id in map) await putDataURL(id, map[id]);
  }

  /** Taille approximative occupée */
  async function usage() {
    if (navigator.storage && navigator.storage.estimate) {
      try { const e = await navigator.storage.estimate(); return { used: e.usage || 0, quota: e.quota || 0 }; } catch (e) {}
    }
    return { used: 0, quota: 0 };
  }

  /** Nettoie les images non référencées */
  async function gc(usedIds) {
    await openDB();
    const keep = new Set(usedIds);
    let removed = 0;
    if (useLS) {
      Object.keys(localStorage).filter(k => k.startsWith(LS_PREFIX)).forEach(k => {
        if (!keep.has(k.slice(LS_PREFIX.length))) { localStorage.removeItem(k); removed++; }
      });
      return removed;
    }
    const all = await idb('readonly', st => st.getAllKeys()).catch(() => []);
    for (const id of (all || [])) if (!keep.has(id)) { await del(id); removed++; }
    return removed;
  }

  /** Ouvre le sélecteur de fichiers → renvoie la liste des métadonnées enregistrées.
   *  accept : 'image', 'video' ou 'tout' (défaut) */
  function pick(multiple, accept) {
    return new Promise(res => {
      const inp = A.$('#filePicker');
      inp.multiple = multiple !== false;
      inp.accept = accept === 'video' ? 'video/*' : accept === 'image' ? 'image/*' : 'image/*,video/*';
      inp.value = '';
      const onChange = async () => {
        inp.removeEventListener('change', onChange);
        const files = Array.from(inp.files || []);
        if (!files.length) return res([]);
        res(await putMany(files));
      };
      inp.addEventListener('change', onChange);
      inp.click();
    });
  }

  async function putMany(files) {
    const out = [];
    const medias = files.filter(f => /^(image|video)\//.test(f.type));
    if (!medias.length) return out;
    const lourd = medias.find(f => f.size > 300 * 1024 * 1024);
    if (lourd) A.toast('Fichier très lourd — l’import peut prendre un moment.');
    if (medias.length > 2) A.toast(`Import de ${medias.length} fichiers…`);
    for (const f of medias) {
      try { out.push(await put(f)); }
      catch (e) { A.toast(e.message || 'Échec de l\'import', 'bad'); }
    }
    return out;
  }

  /**
   * Enregistre une image désignée par son adresse.
   * Passe par le relais local pour les domaines Letterboxd (le navigateur
   * n'a pas le droit de lire leurs octets directement), sinon tente
   * l'accès direct — qui ne marche que si le site l'autorise.
   */
  async function putFromUrl(adresse) {
    const u = String(adresse || '').trim();
    if (!/^https?:\/\//i.test(u)) throw new Error('Adresse invalide.');
    const relayable = /(^|\.)(ltrbxd\.com|letterboxd\.com|twimg\.com)$/i.test(new URL(u).hostname);
    const via = (relayable && /^https?:$/.test(location.protocol))
      ? '/api/img?url=' + encodeURIComponent(u) : u;
    let rep;
    try { rep = await fetch(via, { cache: 'no-store' }); }
    catch (e) {
      throw new Error(relayable
        ? 'Le relais local ne répond pas — lancez le carnet avec demarrer.cmd.'
        : 'Ce site refuse le téléchargement direct. Enregistrez l’image puis choisissez le fichier.');
    }
    if (!rep.ok) throw new Error('Image introuvable (' + rep.status + ').');
    const blob = await rep.blob();
    if (!/^image\//.test(blob.type || '')) throw new Error('Ce lien ne pointe pas vers une image.');
    return put(new File([blob], 'affiche.jpg', { type: blob.type }));
  }

  /** Métadonnées d'un média enregistré (pour retrouver son type) */
  async function meta(id) {
    await openDB();
    if (useLS) return { kind: 'image' };
    const rec = await idb('readonly', st => st.get(id)).catch(() => null);
    return rec ? { kind: rec.kind || 'image', w: rec.w, h: rec.h, duree: rec.duree, type: rec.type, size: rec.size } : null;
  }

  A.Media = { put, putMany, putDataURL, putFromUrl, putSecret, brut, url, apply, img, del, meta, exportAll, importAll, usage, gc, pick, blobToDataURL };
})(window.App);
