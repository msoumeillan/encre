/* ============================================================
   ENCRE — intégrations (X, YouTube, TikTok, Spotify…)
   Tout passe par des iframes officielles : pas de script tiers.
   ============================================================ */
(function (A) {
  'use strict';
  const { el } = A;

  const HOST = location.hostname || 'localhost';
  /* incrémenté quand le relais renvoie davantage : les tweets déjà
     enregistrés sont alors réinterrogés pour se compléter (v2 = images) */
  const TWEET_V = 3;   // v2 : images — v3 : tweet cité

  const deHTML = (s) => String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").trim();

  /**
   * Accepte aussi bien un lien qu'un CODE D'INTÉGRATION collé depuis X,
   * Spotify, TikTok, Instagram… (« Copier le code intégré » renvoie un
   * <iframe> ou un <blockquote>, pas une URL).
   */
  function extraireURL(raw) {
    const s = String(raw || '').trim();
    if (s.indexOf('<') < 0) return s;                       // déjà une URL

    let m = /<iframe[^>]+\ssrc=["']([^"']+)["']/i.exec(s);  // Spotify, YouTube, Maps…
    if (m) return deHTML(m[1]);
    m = /data-instgrm-permalink=["']([^"']+)["']/i.exec(s); // Instagram
    if (m) return deHTML(m[1]);
    m = /\scite=["']([^"']+)["']/i.exec(s);                 // TikTok, X
    if (m) return deHTML(m[1]);

    const liens = (s.match(/https?:\/\/[^\s"'<>]+/g) || []).map(deHTML);
    /* dans un blockquote X, le lien du tweet côtoie ceux des hashtags */
    const statut = liens.find(u => /(?:twitter|x)\.com\/[^/]+\/status/i.test(u))
                || liens.find(u => /tiktok\.com\/[^/]*\/video\//i.test(u))
                || liens.find(u => /instagram\.com\/(?:p|reel|tv)\//i.test(u));
    if (statut) return statut;
    return liens.length ? liens[liens.length - 1] : s;
  }

  /** Analyse une URL et renvoie {kind, id, nom, ratio, src, extra} */
  function parse(raw) {
    const url = extraireURL(raw);
    if (!url || url.indexOf('<') >= 0) return null;
    let u;
    try { u = new URL(url.startsWith('http') ? url : 'https://' + url); } catch (e) { return null; }
    const h = u.hostname.replace(/^www\./, '').toLowerCase();
    const p = u.pathname;

    /* — YouTube — */
    if (h === 'youtu.be' || h.endsWith('youtube.com') || h.endsWith('youtube-nocookie.com')) {
      let id = '', list = u.searchParams.get('list') || '';
      if (h === 'youtu.be') id = p.slice(1);
      else if (p.startsWith('/watch')) id = u.searchParams.get('v') || '';
      else if (p.startsWith('/shorts/')) id = p.split('/')[2];
      else if (p.startsWith('/embed/')) id = p.split('/')[2];
      else if (p.startsWith('/live/')) id = p.split('/')[2];
      const t = u.searchParams.get('t') || u.searchParams.get('start') || '';
      const start = /^\d+$/.test(t) ? t : (t.match(/(\d+)m(\d+)s/) ? RegExp.$1 * 60 + +RegExp.$2 : '');
      if (id || list) {
        const q = new URLSearchParams({ rel: '0', modestbranding: '1' });
        if (start) q.set('start', start);
        if (list) q.set('list', list);
        const short = p.startsWith('/shorts/');
        return {
          kind: 'youtube', nom: 'YouTube', badge: '▶', url,
          src: `https://www.youtube-nocookie.com/embed/${id || 'videoseries'}?${q}`,
          ratio: short ? '9/16' : '16/9', maxW: short ? '340px' : ''
        };
      }
    }

    /* — X / Twitter — */
    if (h === 'x.com' || h === 'twitter.com' || h === 'mobile.twitter.com' || h === 'nitter.net') {
      const m = /\/status(?:es)?\/(\d+)/.exec(p);
      if (m) return {
        kind: 'x', nom: 'X', badge: '𝕏', url, id: m[1], sansBarre: true, maxW: '560px',
        src: `https://platform.twitter.com/embed/Tweet.html?id=${m[1]}&theme=THEME&dnt=true&maxWidth=550`,
        themed: true, h: 560
      };
      const user = p.replace(/^\//, '').split('/')[0];
      if (user) return { kind: 'card', nom: 'X', badge: '𝕏', url, titre: '@' + user, sous: 'Profil X' };
    }

    /* — TikTok — */
    if (h.endsWith('tiktok.com')) {
      const m = /\/video\/(\d+)/.exec(p) || /^\/embed\/(?:v2\/)?(\d+)/.exec(p);
      /* hauteur fixe et non ratio 9/16 : sous la vidéo, TikTok ajoute la
         légende, la musique et les boutons — un 9/16 les rognerait. */
      if (m) return {
        kind: 'tiktok', nom: 'TikTok', badge: '♪', url, vertical: true,
        src: `https://www.tiktok.com/embed/v2/${m[1]}`, h: 740, maxW: '340px'
      };
      const user = (p.match(/@([\w.-]+)/) || [])[1];
      return { kind: 'card', nom: 'TikTok', badge: '♪', url, titre: user ? '@' + user : 'TikTok', sous: 'Ouvrir sur TikTok' };
    }

    /* — Instagram — */
    if (h.endsWith('instagram.com')) {
      const m = /\/(p|reel|tv)\/([\w-]+)/.exec(p);
      if (m) return {
        kind: 'instagram', nom: 'Instagram', badge: '◉', url, vertical: true,
        src: `https://www.instagram.com/${m[1]}/${m[2]}/embed/captioned/`, h: 640, maxW: '440px'
      };
    }

    /* — Vimeo — */
    if (h.endsWith('vimeo.com')) {
      const m = /\/(\d+)/.exec(p);
      if (m) return { kind: 'vimeo', nom: 'Vimeo', badge: 'V', url, src: `https://player.vimeo.com/video/${m[1]}`, ratio: '16/9' };
    }

    /* — Dailymotion — */
    if (h.endsWith('dailymotion.com') || h === 'dai.ly') {
      const id = h === 'dai.ly' ? p.slice(1) : (p.match(/\/video\/([\w]+)/) || [])[1];
      if (id) return { kind: 'dailymotion', nom: 'Dailymotion', badge: 'd', url, src: `https://www.dailymotion.com/embed/video/${id}`, ratio: '16/9' };
    }

    /* — Spotify — */
    if (h.endsWith('spotify.com')) {
      const m = /\/(track|album|playlist|episode|show|artist)\/([\w]+)/.exec(p);
      if (m) return {
        kind: 'spotify', nom: 'Spotify', badge: '♫', url,
        src: `https://open.spotify.com/embed/${m[1]}/${m[2]}?theme=0`,
        audio: true, h: m[1] === 'track' || m[1] === 'episode' ? 152 : 380
      };
    }

    /* — SoundCloud — */
    if (h.endsWith('soundcloud.com')) {
      return {
        kind: 'soundcloud', nom: 'SoundCloud', badge: '☁', url, audio: true, h: 166,
        src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23b3542a&auto_play=false&show_comments=false`
      };
    }

    /* — Twitch — */
    if (h.endsWith('twitch.tv')) {
      const vid = (p.match(/\/videos\/(\d+)/) || [])[1];
      const chan = p.replace(/^\//, '').split('/')[0];
      const q = vid ? `video=${vid}` : `channel=${chan}`;
      return { kind: 'twitch', nom: 'Twitch', badge: 'T', url, src: `https://player.twitch.tv/?${q}&parent=${HOST}&autoplay=false`, ratio: '16/9' };
    }

    /* — Bandcamp / autres médias sans iframe simple — */
    if (h.endsWith('bandcamp.com')) return { kind: 'card', nom: 'Bandcamp', badge: '◼', url, titre: 'Bandcamp', sous: u.hostname + p };

    /* — Letterboxd : fiche film —
       Letterboxd ne publie ni oEmbed ni iframe, et sa page est inaccessible
       depuis le navigateur (pas d'en-tête CORS). On tire donc le titre — et
       l'année, et la note si c'est une critique — de l'URL elle-même.
       L'affiche s'ajoute à la main : glissez-la dans le post. */
    if (h.endsWith('letterboxd.com')) {
      const parts = p.split('/').filter(Boolean);
      const iFilm = parts.indexOf('film');
      if (iFilm >= 0 && parts[iFilm + 1]) {
        const slug = parts[iFilm + 1];
        const mAn = /-(\d{4})$/.exec(slug);
        const titre = slug.replace(/-(\d{4})$/, '').replace(/-/g, ' ')
          .replace(/\b\p{Ll}/gu, c => c.toUpperCase());
        const membre = iFilm > 0 ? parts[0] : '';
        return {
          kind: 'film', nom: 'Letterboxd', badge: '◉◉◉', url,
          titre, annee: mAn ? mAn[1] : '', membre
        };
      }
      if (parts.length) return { kind: 'card', nom: 'Letterboxd', badge: '◉', url, titre: '@' + parts[0], sous: 'Profil Letterboxd' };
    }

    /* — MyAnimeList / AniList : carte — */
    if (h.endsWith('myanimelist.net')) return { kind: 'card', nom: 'MyAnimeList', badge: 'M', url, titre: decodeURIComponent((p.split('/')[3] || 'MyAnimeList').replace(/_/g, ' ')), sous: 'MyAnimeList' };
    if (h.endsWith('anilist.co')) return { kind: 'card', nom: 'AniList', badge: 'A', url, titre: decodeURIComponent((p.split('/')[3] || 'AniList').replace(/-/g, ' ')), sous: 'AniList' };

    /* — Google Maps — */
    if (h.endsWith('google.com') && p.startsWith('/maps')) {
      return { kind: 'carte', nom: 'Maps', badge: '◎', url, src: url.replace('/maps/', '/maps/embed/'), ratio: '16/10' };
    }

    /* — repli : carte de lien — */
    return { kind: 'card', nom: h, badge: h[0].toUpperCase(), url, titre: decodeURIComponent(p === '/' ? h : p.split('/').filter(Boolean).pop() || h).replace(/[-_]/g, ' ').slice(0, 70), sous: h };
  }

  /* Largeurs proposées. Le contenu d'une iframe appartient au site d'origine
     et ne peut pas être restylé depuis ici : ce qu'on règle, c'est le cadre. */
  const LARGEURS_VERTICALES  = { compact: '260px', normal: '340px', large: '440px', pleine: '' };
  const LARGEURS_HORIZONTALES = { compact: '380px', normal: '', large: '', pleine: '' };
  const TAILLES = [['compact', 'Compact'], ['normal', 'Normal'], ['large', 'Large'], ['pleine', 'Pleine']];
  const ALIGNS = [['gauche', '⇤'], ['centre', '↔'], ['droite', '⇥']];

  function controlesAffichage(info, reg, hauteur, onReglages) {
    const modifier = (champ, valeur) => onReglages(Object.assign({}, reg, { [champ]: valeur }));
    const row = el('.embed__reglages');

    TAILLES.forEach(([id, nom]) => {
      if (!info.vertical && (id === 'large' || id === 'pleine')) return;   // déjà pleine largeur
      const actif = (reg.taille || 'normal') === id;
      row.append(el('button' + (actif ? '.is-on' : ''), { text: nom, title: 'Largeur : ' + nom, onclick: () => modifier('taille', id) }));
    });

    row.append(el('span.embed__sep'));
    ALIGNS.forEach(([id, sigle]) => {
      const actif = (reg.align || (info.vertical ? 'centre' : 'gauche')) === id;
      row.append(el('button' + (actif ? '.is-on' : ''), { text: sigle, title: 'Aligner : ' + id, onclick: () => modifier('align', id) }));
    });

    /* hauteur : seulement là où elle a un sens (pas de ratio imposé) */
    if (!info.audio && (!info.ratio || reg.h)) {
      row.append(el('span.embed__sep'));
      row.append(el('button', { text: '−', title: 'Réduire la hauteur', onclick: () => modifier('h', Math.max(200, (hauteur || 560) - 60)) }));
      row.append(el('button', { text: '+', title: 'Augmenter la hauteur', onclick: () => modifier('h', Math.min(1600, (hauteur || 560) + 60)) }));
      if (reg.h) row.append(el('button', { text: '↺', title: 'Hauteur d’origine', onclick: () => modifier('h', 0) }));
    }
    return row;
  }

  /** Remplace les t.co par les adresses lisibles, et rend les liens cliquables. */
  function liensLisibles(t) {
    let texte = A.esc(t.texte || '');
    (t.liens || []).forEach(([court, complet]) => {
      if (court && complet) texte = texte.split(A.esc(court)).join(A.esc(complet));
    });
    return texte.replace(/(https?:\/\/[^\s<]+)/g, u =>
      `<a href="${u}">${u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 46)}</a>`);
  }

  /** Le relais ne renvoie que <a> et <br>, mais on ne fait confiance à rien :
   *  on reconstruit le fragment nous-mêmes. */
  function assainir(html) {
    const bac = document.createElement('div');
    bac.innerHTML = String(html || '');
    const sortie = document.createElement('div');
    const copier = (source, cible) => {
      source.childNodes.forEach(n => {
        if (n.nodeType === 3) { cible.append(document.createTextNode(n.nodeValue)); return; }
        if (n.nodeType !== 1) return;
        const nom = n.tagName.toLowerCase();
        if (nom === 'br') { cible.append(document.createElement('br')); return; }
        if (nom === 'a') {
          const href = n.getAttribute('href') || '';
          if (/^https?:\/\//i.test(href)) {
            const a = el('a', { href, target: '_blank', rel: 'noopener noreferrer' });
            copier(n, a);
            cible.append(a);
            return;
          }
        }
        copier(n, cible);   // tout le reste : on garde le texte, pas la balise
      });
    };
    copier(bac, sortie);
    return sortie.innerHTML;
  }

  function frame(src, attrs) {
    return el('iframe', Object.assign({
      src, loading: 'lazy', frameborder: '0', scrolling: 'no',
      allow: 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen',
      allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin'
    }, attrs || {}));
  }

  /** Construit l'élément DOM d'une intégration */
  function render(url, opts) {
    opts = opts || {};
    const info = parse(url);
    /* jamais d'impasse : un lien vide ou incompréhensible reste corrigeable */
    if (!info) {
      return el('.embed-card', { style: { cursor: 'default' } },
        el('.embed-card__ico', { text: '?' }),
        el('.embed-card__txt',
          el('b', { text: String(url || '').trim() || 'Aucun lien' }),
          el('small', { text: 'Lien non reconnu — utilisez « changer » pour le corriger.' })),
        opts.extra || '');
    }

    const bar = (extra) => el('.embed__bar',
      el('span.dot'), el('span', { text: info.nom }), extra || '',
      el('a', { href: info.url, target: '_blank', rel: 'noopener noreferrer', text: 'ouvrir ↗' }));

    /* fiche film : affiche au centre, titre, réalisateur, note — comme un
       partage Letterboxd. Les données viennent du relais si disponible,
       sinon de l'URL elle-même. */
    if (info.kind === 'film') {
      const f = opts.film || {};
      const titre = f.titre || info.titre;
      const annee = f.annee || info.annee;
      const note = opts.note || f.note || 0;
      const posterId = opts.poster || f.posterId;

      const carte = el('a.film-poster', { href: info.url, target: '_blank', rel: 'noopener noreferrer' });
      const cadre = el('.film-poster__cadre');
      if (posterId) cadre.append(A.Media.img(posterId, { alt: titre }));
      else cadre.append(el('.film-poster__vide', el('span', { text: '🎞' }),
        el('small', { text: 'Ajoutez l’affiche' })));
      carte.append(cadre);
      carte.append(el('h3.film-poster__titre', { text: titre }));
      if (f.realisateur) carte.append(el('.film-poster__real', 'Réalisé par ', el('b', { text: f.realisateur })));
      else if (annee) carte.append(el('.film-poster__real', { text: annee }));
      if (note) carte.append(el('.film-poster__note', A.Editor.stars(note),
        el('span', { text: A.Editor.noteTexte(note) })));
      carte.append(el('.film-poster__marque',
        el('.lbxd-dots', el('i'), el('i'), el('i')),
        el('span', { text: 'Letterboxd' + (info.membre ? ' · @' + info.membre : '') })));
      if (opts.onAffiche) {
        cadre.append(el('button.film-poster__changer', {
          text: posterId ? 'changer l’affiche' : 'ajouter l’affiche',
          onclick: (e) => { e.preventDefault(); e.stopPropagation(); opts.onAffiche(); }
        }));
      }
      if (opts.extra) carte.append(el('.film-poster__extra', opts.extra));
      return carte;
    }

    /* tweet rendu nativement : ni iframe, ni barre de défilement, ni bandeau.
       Le contenu vient du relais local (oEmbed public de X). */
    if (info.kind === 'x' && opts.tweet && opts.tweet.texte) {
      const t = opts.tweet;
      const carte = el('a.tweet', { href: info.url, target: '_blank', rel: 'noopener noreferrer' });

      const ava = t.avatarId
        ? A.Media.img(t.avatarId, { class: 'tweet__ava' })
        : el('.tweet__ava.tweet__ava--mono', { text: (t.auteur || '?').trim().charAt(0).toUpperCase() });
      carte.append(el('.tweet__tete', ava,
        el('.tweet__qui',
          el('b', t.auteur || '', t.verifie ? el('span.tweet__ok', { text: '✓', title: 'Compte certifié' }) : ''),
          el('span', { text: t.pseudo ? '@' + t.pseudo : '' })),
        el('.tweet__logo', { text: '𝕏' })));

      if (t.texte) carte.append(el('.tweet__texte', { html: assainir(liensLisibles(t)) }));
      const galerie = medias => {
        if (!medias || !medias.length) return null;
        const gal = el('.tweet__medias', { 'data-n': Math.min(medias.length, 4) });
        medias.slice(0, 4).forEach(id => gal.append(el('figure', A.Media.img(id))));
        return gal;
      };
      const gal = galerie(t.mediaIds);
      if (gal) carte.append(gal);

      /* tweet cité : carte imbriquée, sans lien propre — la carte entière
         est déjà un lien, et un <a> dans un <a> n'est pas valide */
      if (t.cite && (t.cite.texte || (t.cite.mediaIds || []).length)) {
        const c = t.cite;
        const bloc = el('.tweet__cite');
        bloc.append(el('.tweet__cite-tete',
          c.avatarId ? A.Media.img(c.avatarId, { class: 'tweet__cite-ava' })
                     : el('.tweet__cite-ava.tweet__ava--mono', { text: (c.auteur || '?').trim().charAt(0).toUpperCase() }),
          el('b', c.auteur || '', c.verifie ? el('span.tweet__ok', { text: '✓' }) : ''),
          el('span', { text: c.pseudo ? '@' + c.pseudo : '' }),
          c.date ? el('span.tweet__cite-date', { text: '· ' + c.date }) : ''));
        if (c.texte) bloc.append(el('.tweet__cite-texte', { html: assainir(liensLisibles(c)) }));
        const galCite = galerie(c.mediaIds);
        if (galCite) bloc.append(galCite);
        carte.append(bloc);
      }

      if (t.date) carte.append(el('.tweet__pied', { text: t.date }));
      /* commandes d'édition : hors du flux, visibles au survol seulement —
         au repos, il ne reste que le tweet */
      if (opts.extra) {
        carte.append(el('.tweet__cmd', {
          onclick: (e) => { e.preventDefault(); e.stopPropagation(); }
        }, opts.extra));
      }
      return carte;
    }

    if (info.kind === 'card') {
      return el('a.embed-card', { href: info.url, target: '_blank', rel: 'noopener noreferrer' },
        el('.embed-card__ico', { text: info.badge }),
        el('.embed-card__txt',
          el('b', { text: info.titre || info.nom }),
          el('small', { text: info.sous || info.url })));
    }

    let src = info.src;
    if (info.themed) src = src.replace('THEME', A.Store.DARK.has(A.Store.settings().theme) ? 'dark' : 'light');

    const reg = opts.reglages || {};
    const box = el('.embed');

    /* ---- largeur ---- */
    const echelle = info.vertical ? LARGEURS_VERTICALES : LARGEURS_HORIZONTALES;
    const cle = reg.taille && echelle[reg.taille] !== undefined ? reg.taille : 'normal';
    const largeur = reg.taille ? echelle[cle] : (info.maxW || echelle.normal);
    box.style.maxWidth = largeur || 'none';

    /* ---- alignement ---- */
    const align = reg.align || (info.vertical ? 'centre' : 'gauche');
    box.style.marginLeft = align === 'gauche' ? '0' : 'auto';
    box.style.marginRight = align === 'droite' ? '0' : 'auto';

    /* le cadre porte le ratio ; la barre reste en dehors, sinon elle est rognée */
    const frameWrap = el('.embed__frame');
    let hauteur = 0;
    let iframe;
    if (info.audio) { hauteur = info.h || 166; iframe = frame(src, { scrolling: 'no' }); }
    else if (info.ratio && !reg.h) { frameWrap.style.aspectRatio = info.ratio; iframe = frame(src); }
    else { hauteur = info.h || opts.height || 560; iframe = frame(src, { scrolling: info.sansBarre ? 'no' : 'yes' }); }
    if (reg.h) hauteur = reg.h;
    if (hauteur) frameWrap.style.height = hauteur + 'px';
    frameWrap.append(iframe);
    box.append(frameWrap);

    const alerte = el('span', { style: { color: 'var(--warn)' } });
    const reglages = opts.onReglages ? controlesAffichage(info, reg, hauteur, opts.onReglages) : '';
    /* X se suffit : jamais de bandeau ni de réglages sous le tweet */
    if (!info.sansBarre) box.append(bar(A.frag(alerte, reglages, opts.extra || '')));
    else if (opts.extra) box.append(el('.tweet__cmd', { onclick: (e) => e.stopPropagation() }, opts.extra));

    /* si rien ne charge (bloqueur, réseau), on le dit plutôt que d'afficher un trou */
    let charge = false;
    iframe.addEventListener('load', () => { charge = true; });
    setTimeout(() => {
      if (!charge) alerte.textContent = 'aperçu bloqué — ';
    }, 6000);

    return box;
  }

  /** Devine si un texte collé est intégrable : lien nu ou code d'intégration */
  function looksEmbeddable(text) {
    const t = String(text || '').trim();
    const estCode = /<(iframe|blockquote)\b/i.test(t);
    if (!estCode && !/^https?:\/\/\S+$/i.test(t)) return false;
    const i = parse(t);
    return !!i && (estCode || i.kind !== 'card');
  }

  /**
   * Demande au relais local les données d'un film Letterboxd et range
   * l'affiche hors ligne. Renvoie null si le relais n'est pas là — dans ce
   * cas la fiche reste alimentée par l'URL seule.
   */
  async function enrichirFilm(url) {
    const info = parse(url);
    if (!info || info.kind !== 'film') return null;
    if (!/^https?:$/.test(location.protocol)) return null;   // ouvert en file://

    let data;
    try {
      const r = await fetch('/api/letterboxd?url=' + encodeURIComponent(info.url), { cache: 'no-store' });
      if (!r.ok) return null;
      data = await r.json();
      if (data.erreur) return null;
    } catch (e) { return null; }   // serveur simple : on n'insiste pas

    const film = {
      titre: data.titre || info.titre,
      annee: data.annee || info.annee,
      realisateur: data.realisateur || '',
      note: Number(data.note) || 0,
      posterId: null
    };

    if (data.affiche) {
      try {
        const rep = await fetch('/api/img?url=' + encodeURIComponent(data.affiche), { cache: 'no-store' });
        if (rep.ok) {
          const blob = await rep.blob();
          const fichier = new File([blob], 'affiche.jpg', { type: blob.type || 'image/jpeg' });
          const enregistre = await A.Media.put(fichier);
          film.posterId = enregistre.id;
        }
      } catch (e) { /* l'affiche restera à ajouter à la main */ }
    }
    return film;
  }

  /**
   * Remplace l'affiche d'une fiche film.
   * L'affiche « Patron » que vous avez choisie sur Letterboxd n'est visible
   * que par votre compte : une requête anonyme reçoit l'affiche par défaut.
   * D'où ces deux voies manuelles, l'une ou l'autre prend cinq secondes.
   */
  function choisirAffiche(cible, apres) {
    const champ = el('input.input', { placeholder: 'https://a.ltrbxd.com/resized/film-poster/…' });

    const poser = async (promesse) => {
      try {
        const media = await promesse;
        if (!media) return null;
        cible.film = Object.assign({}, cible.film, { posterId: media.id, afficheManuelle: true });
        A.Store.save(true);
        apres && apres();
        A.toast('Affiche mise à jour');
      } catch (e) {
        A.toast(e.message || 'Échec du chargement', 'bad');
      }
    };

    let fermer;
    fermer = A.dialog({
      title: 'Affiche du film',
      sub: 'Letterboxd ne partage pas votre affiche Patron avec les visiteurs — mettez la vôtre ici.',
      body: el('div',
        el('.field',
          el('.field__label', { text: 'Depuis Letterboxd' }),
          el('.field__hint', { html: 'Sur votre page Letterboxd, clic droit sur l’affiche → <b>Copier l’adresse de l’image</b>, puis collez-la ici.' }),
          champ),
        el('.field',
          el('.field__label', { text: 'Ou depuis un fichier' }),
          el('button.btn', { text: '🖼  Choisir une image…', onclick: () => {
            poser(A.Media.pick(false, 'image').then(g => g[0])).then(() => fermer && fermer());
          } }))),
      ok: 'Utiliser cette adresse',
      onOk: () => {
        const v = champ.value.trim();
        if (!v) return false;
        poser(A.Media.putFromUrl(v));
      }
    });
  }

  /** Récupère le contenu public d'un tweet et range ses images hors ligne. */
  async function enrichirTweet(url) {
    const info = parse(url);
    if (!info || info.kind !== 'x') return null;
    if (!/^https?:$/.test(location.protocol)) return null;
    let d;
    try {
      const r = await fetch('/api/x?url=' + encodeURIComponent(info.url), { cache: 'no-store' });
      if (!r.ok) return null;
      d = await r.json();
      if (d.erreur || !d.texte) return null;
    } catch (e) { return null; }

    /* avatar et photos rangés en local : le tweet reste lisible hors ligne,
       et même s'il disparaît de X plus tard */
    await rangerMedias(d);
    if (d.cite) await rangerMedias(d.cite);
    d.v = TWEET_V;
    return d;
  }

  async function rangerMedias(t) {
    if (t.avatar) {
      try { t.avatarId = (await A.Media.putFromUrl(t.avatar)).id; } catch (e) {}
    }
    t.mediaIds = [];
    for (const lien of (t.medias || [])) {
      try { t.mediaIds.push((await A.Media.putFromUrl(lien)).id); } catch (e) {}
    }
    delete t.avatar; delete t.medias;
  }

  /** Un tweet récupéré par une version antérieure du relais est réinterrogé. */
  function tweetAJour(tweet, url) {
    return !!tweet && tweet.pourUrl === url && tweet.v >= TWEET_V;
  }

  A.Embed = { parse, render, looksEmbeddable, extraireURL, enrichirFilm, enrichirTweet, tweetAJour, choisirAffiche };
})(window.App);
