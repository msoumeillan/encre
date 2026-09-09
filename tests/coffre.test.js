'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { chargerCoffre, octets, contient } = require('./harness.js');

const CODE = 'code-du-coffre';
const SECRET = 'rendez-vous jeudi 14h, ne pas en parler';

/** Coffre neuf, configuré et ouvert. */
async function coffreOuvert(code = CODE) {
  const ctx = chargerCoffre();
  await ctx.coffre.configurer(code, 'un indice');
  return ctx;
}

/** Remplace un octet du chiffré base64 (le dernier : marqueur d'authenticité). */
function altererDernierOctet(b64) {
  const o = Buffer.from(b64, 'base64');
  o[o.length - 1] ^= 0xff;
  return o.toString('base64');
}

describe('configuration', () => {
  test('enregistre un sel de 16 octets et 250 000 itérations', async () => {
    const { coffre, etat } = await coffreOuvert();
    assert.equal(Buffer.from(etat.coffre.sel, 'base64').length, 16);
    assert.equal(etat.coffre.iter, 250000);
    assert.ok(coffre.estConfigure());
    assert.ok(coffre.estOuvert());
  });

  test('deux coffres avec le meme code ont des sels differents', async () => {
    const a = await coffreOuvert();
    const b = await coffreOuvert();
    assert.notEqual(a.etat.coffre.sel, b.etat.coffre.sel);
    assert.notEqual(a.etat.coffre.verif, b.etat.coffre.verif);
  });

  test('refuse un code de moins de 4 caracteres', async () => {
    const { coffre } = chargerCoffre();
    await assert.rejects(() => coffre.configurer('abc'), /au moins 4/);
    await assert.rejects(() => coffre.configurer(''), /au moins 4/);
  });
});

describe('ouverture et fermeture', () => {
  test('le contenu survit a un aller-retour fermer / ouvrir', async () => {
    const { coffre } = await coffreOuvert();
    const note = coffre.creerNote();
    note.titre = 'Journal';
    note.blocks[0].html = SECRET;
    await coffre.sauver();

    coffre.fermer();
    assert.equal(coffre.estOuvert(), false);
    assert.deepEqual(coffre.lesNotes(), []);

    await coffre.ouvrir(CODE);
    assert.ok(coffre.estOuvert());
    const relues = coffre.lesNotes();
    assert.equal(relues.length, 1);
    assert.equal(relues[0].titre, 'Journal');
    assert.equal(relues[0].blocks[0].html, SECRET);
  });

  test('rejette un mauvais code', async () => {
    const { coffre } = await coffreOuvert();
    coffre.fermer();
    await assert.rejects(() => coffre.ouvrir('mauvais-code'), /Code incorrect/);
    assert.equal(coffre.estOuvert(), false);
  });

  test('fermer efface la cle et le contenu de la memoire', async () => {
    const { coffre } = await coffreOuvert();
    coffre.creerNote().blocks[0].html = SECRET;
    await coffre.sauver();

    coffre.fermer();
    assert.equal(coffre.estOuvert(), false);
    assert.deepEqual(coffre.lesNotes(), []);
    // sans cle, on ne peut plus rien ecrire
    await assert.rejects(
      () => coffre.ajouterMedia(new Blob([new Uint8Array([1])])),
      /verrouill/,
    );
  });

  test('ouvrir un coffre inexistant echoue explicitement', async () => {
    const { coffre } = chargerCoffre();
    await assert.rejects(() => coffre.ouvrir(CODE), /Aucun coffre/);
  });
});

describe('ce qui atterrit sur le disque', () => {
  test('le contenu n y figure jamais en clair', async () => {
    const { coffre, etat, surLeDisque } = await coffreOuvert();
    const note = coffre.creerNote();
    note.titre = 'Titre tres reconnaissable';
    note.blocks[0].html = SECRET;
    note.tags = ['confidentiel'];
    await coffre.sauver();

    const disque = surLeDisque();
    assert.ok(!disque.includes(SECRET));
    assert.ok(!disque.includes('Titre tres reconnaissable'));
    assert.ok(!disque.includes('confidentiel'));
    assert.ok(!disque.includes(CODE));      // le code n'est stocke nulle part
    assert.ok(disque.includes('charge'));   // seul le chiffre est la

    // Verifier la chaine ne suffit pas : du contenu simplement encode en
    // base64 y serait invisible alors qu'il est lisible par n'importe qui.
    // On decode donc ce qui est reellement stocke.
    for (const champ of ['charge', 'verif']) {
      const octetsStockes = Buffer.from(etat.coffre[champ], 'base64');
      assert.ok(!octetsStockes.includes(Buffer.from(SECRET)));
      assert.ok(!octetsStockes.includes(Buffer.from('Titre tres reconnaissable')));
    }
  });

  test('deux ecritures du meme contenu produisent des chiffres differents', async () => {
    const { coffre, etat } = await coffreOuvert();
    coffre.creerNote().blocks[0].html = SECRET;

    await coffre.sauver();
    const premier = etat.coffre.charge;
    await coffre.sauver();
    const second = etat.coffre.charge;

    // IV regenere a chaque ecriture : un observateur ne peut pas voir
    // que le contenu n'a pas bouge.
    assert.notEqual(premier, second);
  });
});

describe('integrite', () => {
  test('un temoin altere est rejete, meme avec le bon code', async () => {
    const { coffre, etat } = await coffreOuvert();
    coffre.fermer();
    etat.coffre.verif = altererDernierOctet(etat.coffre.verif);

    // AES-GCM est authentifie : modifier un seul octet invalide le message.
    await assert.rejects(() => coffre.ouvrir(CODE), /Code incorrect/);
  });

});

describe('charge corrompue : lecture seule', () => {
  /** Coffre dont la charge a ete alteree, rouvert avec le bon code. */
  async function coffreCorrompu() {
    const ctx = await coffreOuvert();
    ctx.coffre.creerNote().blocks[0].html = SECRET;
    await ctx.coffre.sauver();
    ctx.coffre.fermer();
    ctx.chargeAvant = ctx.etat.coffre.charge = altererDernierOctet(ctx.etat.coffre.charge);
    await ctx.coffre.ouvrir(CODE);
    return ctx;
  }

  test('le coffre s ouvre en lecture seule, pas en coffre vide', async () => {
    const { coffre } = await coffreCorrompu();
    // Le temoin a valide le code : ce n'est pas une erreur de code.
    assert.ok(coffre.estOuvert());
    assert.ok(coffre.estIllisible());
    assert.deepEqual(coffre.lesNotes(), []);
  });

  test('sauver n ecrase pas le chiffre existant', async () => {
    const { coffre, etat, chargeAvant } = await coffreCorrompu();
    await coffre.sauver();
    // C'est tout l'enjeu : le seul exemplaire du chiffre reste intact.
    assert.equal(etat.coffre.charge, chargeAvant);
  });

  test('toute ecriture est refusee', async () => {
    const { coffre } = await coffreCorrompu();
    assert.throws(() => coffre.creerNote(), /lecture seule/);
    await assert.rejects(() => coffre.supprimerNote('sn1'), /lecture seule/);
    await assert.rejects(
      () => coffre.ajouterMedia(new Blob([new Uint8Array([1])])),
      /lecture seule/,
    );
    await assert.rejects(() => coffre.supprimerMedia('sc1'), /lecture seule/);
  });

  test('changer le code est refuse et ne touche pas au sel', async () => {
    const { coffre, etat } = await coffreCorrompu();
    const selAvant = etat.coffre.sel;
    await assert.rejects(
      () => coffre.changerCode(CODE, 'un-autre-code'),
      /irrecuperable|irrécupérable/,
    );
    // Un nouveau sel aurait rendu l'ancien chiffre dechiffrable par personne.
    assert.equal(etat.coffre.sel, selAvant);
  });

  test('fermer remet le coffre dans un etat neuf', async () => {
    const { coffre } = await coffreCorrompu();
    coffre.fermer();
    assert.equal(coffre.estIllisible(), false);
  });

  test('un coffre legitimement vide n est pas en lecture seule', async () => {
    const { coffre } = await coffreOuvert();
    coffre.fermer();
    await coffre.ouvrir(CODE);
    assert.equal(coffre.estIllisible(), false);
    assert.deepEqual(coffre.lesNotes(), []);
    assert.ok(coffre.creerNote());        // l'ecriture reste permise
  });

  test('un media illisible annule le changement de code', async () => {
    const { coffre, etat, medias } = await coffreOuvert();
    const media = await coffre.ajouterMedia(new Blob([new Uint8Array([1, 2, 3])]));
    const abime = Buffer.from(await (medias.get(media.id)).arrayBuffer());
    abime[abime.length - 1] ^= 0xff;
    medias.set(media.id, new Blob([abime]));
    const selAvant = etat.coffre.sel;

    await assert.rejects(() => coffre.changerCode(CODE, 'un-autre-code'), /media|média/);
    // Rien n'a bouge : l'ancienne cle peut encore lire les autres medias.
    assert.equal(etat.coffre.sel, selAvant);
  });
});

describe('changement de code', () => {
  test('preserve le contenu et invalide l ancien code', async () => {
    const NOUVEAU = 'nouveau-code-plus-long';
    const { coffre, etat } = await coffreOuvert();
    coffre.creerNote().blocks[0].html = SECRET;
    await coffre.sauver();
    const selAvant = etat.coffre.sel;

    await coffre.changerCode(CODE, NOUVEAU, 'nouvel indice');
    coffre.fermer();

    await assert.rejects(() => coffre.ouvrir(CODE), /Code incorrect/);

    await coffre.ouvrir(NOUVEAU);
    assert.equal(coffre.lesNotes()[0].blocks[0].html, SECRET);
    // rechiffrement complet : nouveau sel, donc nouvelle cle
    assert.notEqual(etat.coffre.sel, selAvant);
    assert.equal(etat.coffre.indice, 'nouvel indice');
  });

  test('refuse de changer le code si l ancien est faux', async () => {
    const { coffre } = await coffreOuvert();
    await assert.rejects(
      () => coffre.changerCode('pas-le-bon', 'autre-code'),
      /Code incorrect/,
    );
  });
});

describe('medias', () => {
  test('un fichier est chiffre au repos et se relit correctement', async () => {
    const { coffre, medias } = await coffreOuvert();
    const clair = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 42, 42, 42, 7, 8]);
    const media = await coffre.ajouterMedia(new Blob([clair], { type: 'image/png' }));

    const stocke = await octets(medias.get(media.id));
    assert.ok(!contient(stocke, clair));       // plus une image sur le disque
    assert.ok(stocke.length > clair.length);   // IV + marqueur d'authenticite

    const url = await coffre.dechiffrerMedia(media.id, medias.get(media.id), 'image/png');
    assert.deepEqual(await octets(url), clair);
  });

  test('sans la cle, un media ne se dechiffre pas', async () => {
    const { coffre, medias } = await coffreOuvert();
    const media = await coffre.ajouterMedia(new Blob([new Uint8Array([1, 2, 3])]));
    const stocke = medias.get(media.id);
    coffre.fermer();

    assert.equal(await coffre.dechiffrerMedia(media.id, stocke, 'image/png'), '');
  });
});
