'use strict';
/*
  Charge coffre.js hors du navigateur.

  Le module est une IIFE qui reçoit `window.App` et n'utilise du carnet que
  deux choses : le magasin d'état et le stockage des médias. On les remplace
  par des doublures, et on lui laisse les vraies primitives de Node — même
  WebCrypto, même AES-GCM, même PBKDF2 que dans le navigateur.

  Le chargement passe par `new Function` plutôt que par `node:vm` : les
  paramètres `window` et `document` masquent les globales absentes, et tout
  s'exécute dans le realm courant. Un contexte vm créerait des Uint8Array
  d'un autre realm, que WebCrypto refuse.
*/
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.join(__dirname, '..', 'assets', 'js', 'coffre.js');

function chargerCoffre() {
  const etat = {};
  const medias = new Map();          // id -> Blob tel qu'il finirait sur le disque
  const compteurs = new Map();
  let sauvegardes = 0;

  const A = {
    debounce: (fn) => fn,
    uid: (prefixe) => {
      const n = (compteurs.get(prefixe) || 0) + 1;
      compteurs.set(prefixe, n);
      return `${prefixe}${n}`;
    },
    toast: () => {},
    Store: {
      state: () => etat,
      save: () => { sauvegardes += 1; },
    },
    Media: {
      putSecret: async (id, blob) => { medias.set(id, blob); },
      brut: async (id) => medias.get(id),
      del: async (id) => { medias.delete(id); },
    },
  };

  const faussefenetre = { App: A, crypto: globalThis.crypto, addEventListener: () => {} };
  const fauxdocument = { addEventListener: () => {} };

  // Le verrouillage automatique arme un setTimeout de 10 minutes. En test,
  // il empêcherait Node de rendre la main : on le déréférence pour qu'il
  // n'entretienne pas l'event loop, sans changer son comportement.
  const minuterie = (fn, ms) => {
    const t = setTimeout(fn, ms);
    if (typeof t.unref === 'function') t.unref();
    return t;
  };

  const source = fs.readFileSync(SOURCE, 'utf8');
  new Function('window', 'document', 'setTimeout', source)(
    faussefenetre, fauxdocument, minuterie,
  );

  return {
    coffre: A.Coffre,
    etat,
    medias,
    /** Ce qui serait réellement écrit dans localStorage. */
    surLeDisque: () => JSON.stringify(etat),
    nbSauvegardes: () => sauvegardes,
  };
}

/** Octets d'un blob, y compris ceux derrière une URL blob: */
async function octets(blobOuUrl) {
  const blob = typeof blobOuUrl === 'string'
    ? require('node:buffer').resolveObjectURL(blobOuUrl)
    : blobOuUrl;
  return new Uint8Array(await blob.arrayBuffer());
}

const contient = (foin, aiguille) => Buffer.from(foin).includes(Buffer.from(aiguille));

module.exports = { chargerCoffre, octets, contient };
