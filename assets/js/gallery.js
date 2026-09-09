/* ============================================================
   ENCRE — galeries d'images & visionneuse
   Glisser-déposer pour réordonner ; l'agencement s'adapte
   à l'endroit où l'on lâche l'image.
   ============================================================ */
(function (A) {
  'use strict';
  const { el, $ } = A;

  /* ---------- visionneuse ---------- */
  let lb = { list: [], i: 0, open: false };

  function openLightbox(images, index) {
    lb.list = images.slice(); lb.i = index || 0; lb.open = true;
    $('#lightbox').hidden = false;
    show();
    document.addEventListener('keydown', onKey);
  }
  function closeLightbox() {
    lb.open = false;
    $('#lightbox').hidden = true;
    document.removeEventListener('keydown', onKey);
  }
  function step(n) {
    if (!lb.list.length) return;
    lb.i = (lb.i + n + lb.list.length) % lb.list.length;
    show();
  }
  function show() {
    const im = lb.list[lb.i];
    if (!im) return closeLightbox();
    A.Media.apply($('#lbImg'), im.id);
    $('#lbCount').textContent = lb.list.length > 1 ? `${lb.i + 1} / ${lb.list.length}` : '';
    const multi = lb.list.length > 1;
    $('#lbPrev').style.display = multi ? '' : 'none';
    $('#lbNext').style.display = multi ? '' : 'none';
  }
  function onKey(e) {
    if (!lb.open) return;
    if (e.key === 'Escape') { e.stopPropagation(); closeLightbox(); }
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
  }
  function bindLightbox() {
    $('#lbClose').onclick = closeLightbox;
    $('#lbPrev').onclick = () => step(-1);
    $('#lbNext').onclick = () => step(1);
    $('#lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox') closeLightbox(); });
  }

  /* ============================================================
     Agencement déduit du geste
     ------------------------------------------------------------
     Lâcher une image sur le CÔTÉ d'une autre = « je les veux
     l'une à côté de l'autre » ; en DESSOUS = « l'une sous
     l'autre ». On ne change l'agencement que si le geste
     contredit l'agencement courant.
     ============================================================ */
  function agencementDeduit(layout, n, horizontal) {
    if (horizontal) {
      /* « Auto » place déjà les images côte à côte : rien à changer */
      if (layout === 'auto') return 'auto';
      if (n === 2) return 'duo';
      if (layout === 'colonnes' || layout === 'une') return 'grille';
      return layout === 'duo' && n > 2 ? 'grille' : layout;
    }
    /* vertical : l'utilisateur demande explicitement un empilement */
    if (layout === 'auto' || layout === 'duo' || layout === 'une') return 'colonnes';
    return layout;
  }

  const NOM_AGENCEMENT = { auto: 'Auto', grille: 'Grille', mosaique: 'Mosaïque', colonnes: 'Colonnes', duo: 'Duo', pellicule: 'Pellicule', carrousel: 'Carrousel', polaroid: 'Polaroïd', une: 'Pleine' };

  /* ---------- rendu ---------- */
  /**
   * opts : { images, layout, editable, keepLayout, onChange(images, layout) }
   */
  function render(opts) {
    const images = opts.images || [];
    let layout = opts.layout || 'grille';
    if (images.length === 1 && !opts.keepLayout && (layout === 'grille' || layout === 'mosaique')) layout = 'une';
    const wrap = el('.gal.gal--' + layout);
    const change = (imgs, lay) => opts.onChange && opts.onChange(imgs, lay);

    /* agencement « Auto » : la disposition dépend du nombre d'images,
       comme sur X — 1 en grand, 2 côte à côte, 3 en L, 4 en carré, 5+ en grille */
    if (layout === 'auto') {
      wrap.dataset.n = Math.min(images.length, 5);
      const p = images[0];
      if (images.length === 1 && p && p.w && p.h) {
        const r = A.clamp(p.w / p.h, 0.8, 1.91);
        wrap.style.setProperty('--r1', r);
      }
    }

    images.forEach((im, i) => {
      const fig = el('figure', { 'data-i': i });
      let img;
      if (im.kind === 'video') {
        /* la vidéo se lit sur place : pas de visionneuse au clic,
           sinon les commandes de lecture deviennent inutilisables */
        img = el('video', { controls: true, playsinline: true, preload: 'metadata' });
        A.Media.apply(img, im.id);
        fig.classList.add('is-video');
      } else {
        img = A.Media.img(im.id, { alt: im.legende || '' });
        img.addEventListener('click', () => openLightbox(images.filter(x => x.kind !== 'video'), Math.max(0, images.filter(x => x.kind !== 'video').indexOf(im))));
      }
      fig.append(img);
      if (im.legende) fig.append(el('figcaption', { text: im.legende }));

      if (opts.editable) {
        fig.draggable = true;
        /* seule la figure est source de glissement : sinon le navigateur
           déclenche son propre glisser d'image et peut quitter la page */
        img.draggable = false;
        fig.append(el('button.gal__del', {
          title: 'Retirer', text: '✕',
          onclick: (e) => { e.stopPropagation(); change(images.filter(x => x !== im), layout, 'suppression'); }
        }));
        if (im.kind !== 'video') {   // sur une vidéo, le double-clic passe en plein écran
          img.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            A.promptDlg('Légende', im.legende || '', v => { im.legende = v; change(images, layout, 'legende'); },
              { allowEmpty: true, placeholder: 'Une phrase sous l’image…' });
          });
        }
      }
      wrap.append(fig);
    });

    if (opts.editable) {
      bindReorder(wrap, images, layout, change);
      wrap.append(barreAgencement(images, layout, change));
    }
    return wrap;
  }

  function barreAgencement(images, layout, change) {
    const tools = el('.gal__tools');
    A.Store.LAYOUTS.forEach(l => tools.append(el('button' + (l.id === layout ? '.is-on' : ''), {
      text: l.nom, title: 'Agencement : ' + l.nom,
      onclick: () => change(images, l.id, 'agencement')
    })));
    tools.append(el('button', {
      text: '+ images', title: 'Ajouter des images',
      onclick: async () => {
        const got = await A.Media.pick(true);
        if (got.length) change(images.concat(got.map(m => ({ id: m.id, kind: m.kind, w: m.w, h: m.h }))), layout, 'ajout');
      }
    }));
    return tools;
  }

  /* ---------- réordonnancement ----------
     La source est gardée au niveau du module : une image peut donc être
     tirée d'une galerie vers une AUTRE (autre bloc, autre post). */
  let source = null;   // { images, layout, index, change, wrap }

  function bindReorder(wrap, images, layout, change) {
    const nettoie = () => wrap.querySelectorAll('figure').forEach(f =>
      f.classList.remove('drop-l', 'drop-r', 'drop-t', 'drop-b'));

    wrap.addEventListener('dragstart', e => {
      const fig = e.target.closest('figure');
      if (!fig || !wrap.contains(fig)) return;
      source = { images, layout, index: +fig.dataset.i, change, wrap };
      fig.classList.add('is-drag');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', 'encre:image'); } catch (x) {}
      e.stopPropagation();
    });

    wrap.addEventListener('dragend', () => {
      source = null;
      nettoie();
      wrap.querySelectorAll('figure').forEach(f => f.classList.remove('is-drag'));
    });

    wrap.addEventListener('dragover', e => {
      if (!source) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      const fig = e.target.closest('figure');
      nettoie();
      if (!fig) return;
      if (source.wrap === wrap && +fig.dataset.i === source.index) return;
      const z = zone(fig, e);
      fig.classList.add(z.horizontal ? (z.avant ? 'drop-l' : 'drop-r') : (z.avant ? 'drop-t' : 'drop-b'));
    });

    wrap.addEventListener('drop', e => {
      if (!source) return;
      const fig = e.target.closest('figure');
      if (!fig) return;
      e.preventDefault();
      e.stopPropagation();
      const to = +fig.dataset.i;
      const z = zone(fig, e);
      nettoie();
      const src = source;
      source = null;

      if (src.wrap === wrap) {
        /* réordonnancement à l'intérieur d'une même galerie */
        const suite = images.slice();
        const [pris] = suite.splice(src.index, 1);
        let pos = to + (z.avant ? 0 : 1);
        if (src.index < to) pos--;
        suite.splice(A.clamp(pos, 0, suite.length), 0, pris);
        const lay = agencementDeduit(layout, suite.length, z.horizontal);
        if (lay !== layout) A.toast('Agencement : <b>' + (NOM_AGENCEMENT[lay] || lay) + '</b>');
        change(suite, lay, 'agencement');
        return;
      }

      /* déplacement d'une galerie vers une autre : l'image change de bloc,
         le fichier n'est surtout pas supprimé */
      const pris = src.images[src.index];
      if (!pris) return;
      const restant = src.images.filter((_, i) => i !== src.index);
      const suite = images.slice();
      suite.splice(A.clamp(to + (z.avant ? 0 : 1), 0, suite.length), 0, pris);
      const lay = agencementDeduit(layout, suite.length, z.horizontal);
      src.change(restant, src.layout, 'deplacement');
      change(suite, lay, 'deplacement');
      A.toast('Image déplacée');
    });
  }

  /** côté visé : gauche/droite (horizontal) ou haut/bas (vertical) */
  function zone(fig, e) {
    const r = fig.getBoundingClientRect();
    /* image pas encore chargée : la figure peut être plate, on s'en tient à l'axe X */
    if (r.width < 4 || r.height < 4) return { horizontal: true, avant: e.clientX < r.left + r.width / 2 };
    const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
    const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    return { horizontal, avant: horizontal ? dx < 0 : dy < 0 };
  }

  A.Gallery = { render, openLightbox, closeLightbox, bindLightbox };
})(window.App);
