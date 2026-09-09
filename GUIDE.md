# Encre — guide d'utilisation

Manuel complet de l'application : les espaces, l'écriture, le coffre, les
intégrations, les raccourcis et la sauvegarde.

Pour l'architecture et les choix techniques, voir le [README](README.md).

---

## Démarrer

Double-cliquez sur **`demarrer.cmd`** (Windows). Le carnet s'ouvre sur
`http://localhost:5173`.

Ou à la main :

```bash
python serveur.py
```

> Ouvrir `index.html` directement en double-cliquant fonctionne aussi, mais le
> navigateur limite alors le stockage des images à ~5 Mo, refuse les vidéos, et
> les fiches Letterboxd ne se remplissent plus toutes seules. Le petit serveur
> fourni lève ces trois limites.

Après une mise à jour des fichiers, un simple rechargement suffit : les
feuilles de style et scripts portent un numéro de version.

---

## Les quatre espaces

| Espace | À quoi ça sert |
|---|---|
| **Journal** | Une page par jour : couverture, humeur, mots-clés, texte libre. |
| **Agenda** | Le mois en vignettes (les couvertures apparaissent), la vue année en carte de chaleur, les statistiques. |
| **Fil** | Des posts courts façon micro-blog : texte, images, note /5, intégrations. |
| **Carnets** | Regroupe les posts par thème — animes, films, lectures… avec note moyenne. |
| **Notes** | Des pages libres, indépendantes des dates. |
| **Coffre** | Des pages chiffrées, ouvertes par un code. |

### Le carnet d'animes, concrètement

1. Ouvrez **Fil**, choisissez le carnet « Animes » dans le menu déroulant.
2. Tapez le **titre** (`My Hero Academia`) et le **numéro d'épisode** dans la
   ligne du haut du composeur.
3. Écrivez votre review, glissez vos captures, mettez une note /5.
4. Collez le lien YouTube de l'opening — il s'intègre tout seul.

Ce qui se passe ensuite :

- Le titre devient automatiquement un **mot-clé**, donc toute la série se
  retrouve d'un clic.
- Une puce apparaît dans le bandeau **Séries** en haut du carnet, avec le
  nombre d'épisodes et la note moyenne.
- Cliquer sur la série (ou sur le titre d'un post) l'ouvre **dans l'ordre des
  épisodes**, pas par date — pratique pour relire un visionnage.
- Après publication, le titre est conservé et le **numéro d'épisode
  s'incrémente tout seul** : enchaîner les épisodes ne demande qu'une phrase.

---

## Le coffre secret

Un espace à part, ouvert par un code. Son contenu n'est **jamais écrit en
clair** : il est chiffré en AES-GCM avec une clé dérivée du code par PBKDF2
(250 000 itérations, sel aléatoire). Ce qui reste sur le disque quand le coffre
est fermé est illisible, y compris pour qui ouvre les outils du navigateur.

- Les **images et vidéos** ajoutées dans le coffre sont chiffrées elles aussi :
  sur le disque, ce ne sont plus des fichiers image, juste des octets.
- Le coffre se **verrouille tout seul** après 10 minutes sans activité, et à la
  fermeture de l'onglet — la clé ne vit qu'en mémoire.
- Le contenu du coffre n'apparaît **ni dans la recherche, ni dans l'export
  Markdown**. La sauvegarde JSON l'emporte, mais chiffré.
- Un **indice** facultatif s'affiche sur l'écran de verrouillage. N'y mettez
  évidemment pas le code.
- **Changer le code** rechiffre tout le contenu, images comprises.

> ⚠️ **Le code n'est stocké nulle part** — c'est lui qui fabrique la clé. Il ne
> peut donc pas être réinitialisé : si vous l'oubliez, le contenu du coffre est
> définitivement perdu. C'est le prix d'un chiffrement qui protège vraiment.

> Le chiffrement du navigateur n'est accessible que sur une page servie par un
> serveur. Le coffre demande donc `demarrer.cmd` — en ouvrant `index.html`
> directement, il s'affiche mais refuse de se créer, en le disant.

---

## Écrire

Tapez **`/`** dans une page pour insérer un bloc : titre, citation, liste,
tâche, encart, code, filet, **images**, **intégration**, **note /5**.

Raccourcis d'écriture (en début de ligne, suivis d'un espace) :

| Vous tapez | Vous obtenez |
|---|---|
| `# ` | grand titre |
| `## ` | titre |
| `### ` | petit titre |
| `> ` | citation |
| `- ` | liste à puces |
| `1. ` | liste numérotée |
| `[] ` | case à cocher |
| ` ``` ` | bloc de code |
| `---` | filet de séparation |

### Deux blocs côte à côte

Attrapez un bloc par sa poignée **⠿** et lâchez-le sur le **côté gauche ou
droit** d'un autre : les deux se placent en colonnes. Lâché **au-dessus ou en
dessous**, il ressort de la rangée et se réempile. C'est le geste d'Anytype —
pratique pour mettre deux images l'une à côté de l'autre dans une journée.

### Vidéos

`/vidéo` insère un fichier vidéo, lu directement dans la page. Vous pouvez
aussi glisser un `.mp4` / `.webm` / `.mov` dans une page, ou l'ajouter à une
galerie existante avec « + images » — images et vidéos cohabitent dans le même
bloc et suivent le même agencement.

> Les vidéos sont stockées telles quelles, sans réencodage. Elles pèsent donc
> leur poids réel : passez par `demarrer.cmd` plutôt que par un double-clic sur
> `index.html`, sinon le navigateur les refuse.

Autres gestes utiles :

- **Glissez des images** dans la page → une galerie se crée.
- **Collez un lien** X / YouTube / TikTok dans un bloc vide → il s'intègre.
- **Double-clic** sur une image d'une galerie → légende.
- **Glissez la couverture** vers le haut ou le bas → recadrage.
- **`⠿`** à gauche d'un bloc → glisser-déposer, dupliquer, transformer.

### Agencements de galerie

**Auto** (par défaut) · Grille · Mosaïque · Colonnes · Duo · Pellicule ·
Carrousel · Polaroïd · Pleine page. Le sélecteur apparaît en bas à droite de la
galerie au survol — dans l'éditeur **comme dans les posts publiés**.

L'agencement **Auto** se règle sur le nombre d'images, comme sur X :

| Images | Disposition |
|---|---|
| 1 | en grand, à son propre format |
| 2 | côte à côte, moitié-moitié |
| 3 | une grande à gauche, deux empilées à droite |
| 4 | carré 2×2 |
| 5 et + | grille de 3 colonnes |

**Glissez une image sur une autre pour la déplacer.** Un trait couleur accent
montre le côté visé — les **quatre** côtés sont reconnus. Le déplacement
fonctionne aussi **d'une galerie à une autre** : entre deux blocs images d'une
même page, ou d'un post vers un autre. Le fichier suit l'image, il n'est jamais
supprimé au passage.

Dans le fil, les images d'un post publié sont **verrouillées** ; passez par
`⋯ › Modifier` pour les réarranger, changer le titre, l'épisode, le carnet, la
date, le texte ou la note. « Terminé » referme le mode modification — c'est à
ce moment que le post reprend sa place dans le fil si vous avez changé sa date.

Un carnet peut déclarer qu'il **n'a pas d'épisodes** (Films, Livres…) : le champ
« ép. » disparaît alors du composeur et de la modification. Réglable dans
`Carnets › ⋯ › Modifier`.

L'agencement suit le geste :

| Vous lâchez l'image… | Résultat |
|---|---|
| à **côté**, en mode Auto | reste en Auto (déjà côte à côte) |
| à **côté** d'une autre, à 2 images | passe en **Duo** |
| à **côté** d'une autre, à 3+ images | passe en **Grille** |
| **en dessous** d'une autre | passe en **Colonnes** |

### Réordonner les carnets

Dans la barre latérale, glissez un carnet vers le haut ou le bas pour changer
l'ordre. Il est conservé.

### Notes en demi-étoiles

Les notes vont de 0,5 à 5 par demis. Cliquez sur la **moitié gauche** d'une
étoile pour la demie, sur la moitié droite pour l'entier ; recliquer la même
note l'efface.

### Fiches film (Letterboxd)

Collez un lien `letterboxd.com/film/...` : la fiche se dessine comme un partage
Letterboxd — **affiche, titre, « Réalisé par… », votre note en étoiles** et la
signature Letterboxd.

L'affiche, le titre exact et le réalisateur sont récupérés automatiquement,
**à condition de lancer le carnet avec `demarrer.cmd`** (ou `python
serveur.py`). Pourquoi : Letterboxd ne publie ni oEmbed ni iframe, et le
navigateur ne peut pas lire leur page — elle ne renvoie pas d'en-tête CORS. Le
petit serveur fourni fait la requête à sa place et en extrait les données
(`/api/letterboxd`), puis récupère l'affiche (`/api/img`).

- Ni clé d'API, ni service tiers : tout passe par votre machine.
- Le relais n'accepte que les domaines Letterboxd et n'écoute que sur
  `127.0.0.1` — ce n'est pas un proxy ouvert.
- L'affiche est **rangée hors ligne** dès la première fois : aucun appel réseau
  aux rechargements suivants.
- Sans le relais (ouverture directe de `index.html`), la fiche marche quand
  même : titre et année sont déduits de l'URL, et si le post contient
  **exactement une image**, elle sert d'affiche.

#### Mettre votre affiche à vous

L'affiche récupérée est celle **par défaut**. Si vous êtes Patron et avez
choisi une autre affiche, elle n'est visible que par votre compte : une
requête anonyme reçoit toujours celle d'origine, et la page des affiches
alternatives est fermée aux visiteurs (403). Il n'y a donc pas moyen de la
deviner sans vos identifiants.

Le remplacement prend cinq secondes. En mode modification, survolez l'affiche
et cliquez **« changer l'affiche »** :

- **collez l'adresse de l'image** — sur votre page Letterboxd, clic droit sur
  l'affiche que vous avez choisie → « Copier l'adresse de l'image ». Le relais
  la télécharge et la range hors ligne ;
- ou **choisissez un fichier** sur votre disque.

Une affiche posée à la main est marquée comme telle : elle ne sera jamais
remplacée par celle de Letterboxd.

### Intégrations reconnues

X (tweets), YouTube (dont Shorts), TikTok, Instagram, Spotify, SoundCloud,
Twitch, Vimeo, Dailymotion, Google Maps. Les autres liens deviennent une jolie
carte cliquable.

Deux façons de coller, les deux marchent :

- **le lien** — `https://x.com/…/status/…` ;
- **le code d'intégration** — le `<blockquote>` ou l'`<iframe>` que donnent les
  boutons « Copier le code intégré » de X, Spotify, TikTok, Instagram… Le lien
  est extrait automatiquement du code.

> Les intégrations passent par les iframes officielles, sans script tiers. Si
> un bloqueur de pub est actif, certaines peuvent rester vides — le lien
> « ouvrir ↗ » fonctionne toujours.

### Tweets rendus nativement

Un lien X ne passe pas par une iframe : le relais local récupère le contenu
public du tweet et Encre le dessine avec ses propres styles — **avatar, nom,
pseudo, badge de certification, texte, images, date**. Résultat : **rien sous
le tweet**, aucun réglage, aucune barre de défilement, une carte à la hauteur
exacte de son contenu.

- Les images du tweet sont disposées comme sur X : une en grand, deux côte à
  côte, trois en L, quatre en carré.
- Un **tweet cité** apparaît en carte imbriquée, avec son auteur, son avatar,
  sa date, son texte et ses propres images.
- Avatar et images sont **rangés hors ligne** : le tweet reste lisible sans
  réseau, et même s'il disparaît de X plus tard.
- Les liens `t.co` sont réécrits en adresses lisibles.
- En modification, une petite commande apparaît **au survol seulement**, en
  haut à droite de la carte.
- Sans le relais, on retombe sur l'iframe officielle de X, sans barre de
  défilement elle non plus.

### Régler l'affichage d'une intégration

En mode modification (ou dans l'éditeur), la barre sous l'intégration propose :

- **largeur** — Compact · Normal · Large · Pleine. Les trois dernières ne
  s'affichent que pour les formats verticaux (TikTok, Reels, Shorts) ; une
  vidéo 16/9 occupe déjà toute la colonne.
- **alignement** — ⇤ gauche, ↔ centré, ⇥ droite.
- **hauteur** — `−` / `+` par pas de 60 px, `↺` pour revenir à l'origine.
  Proposé là où la hauteur n'est pas imposée par un format (TikTok, X,
  Instagram) ; une vidéo 16/9 garde son ratio.

Les réglages sont enregistrés avec le post.

> **Ce qui n'est pas réglable :** l'intérieur du lecteur. Une iframe appartient
> au site d'origine — ni sa légende, ni ses boutons, ni ses couleurs ne peuvent
> être modifiés depuis Encre. Ce qu'on règle, c'est le cadre.
>
> Le cadre TikTok fait 340 × 740 par défaut, et non un 9/16 : sous la vidéo,
> TikTok ajoute la légende, la musique et les boutons — un 9/16 les couperait.

---

## Raccourcis clavier

| Touche | Action |
|---|---|
| `⌘/Ctrl + K` | Recherche & commandes |
| `⌘/Ctrl + J` | Aller à aujourd'hui |
| `⌘/Ctrl + B` | Replier le menu (mode concentration) |
| `⌘/Ctrl + D` | Clair / sombre |
| `⌘/Ctrl + ,` | Réglages |
| `←` `→` | Jour précédent / suivant |
| `Alt + ↑ ↓` | Déplacer un bloc |

Dans la recherche, tapez une date (`12/03`, `2026-03-12`, `hier`) pour ouvrir
directement cette journée.

---

## Personnalisation

**Réglages** (⚙ en bas du menu) :

- **7 ambiances** — Papier, Lin, Sakura, Brume, Encre, Forêt, Nuit.
- **Couleur d'accent** libre (sélecteur de couleur inclus).
- **Fond de page** : halo, points, quadrillage, lignes, ou rien.
- **Grain** façon papier imprimé, activable.
- **5 duos de polices**, taille du texte, interligne, largeur de colonne.
- **Arrondis** et **hauteur des couvertures**.
- **Identité** : nom du carnet, sous-titre, emoji de marque, avatar, signature.

---

## Sauvegarde

Vos données vivent dans le stockage local du navigateur. **Exportez
régulièrement** depuis Réglages → Données :

- **Sauvegarde complète** (`.json` avec les images) — pour tout restaurer.
- **Texte seul** (`.json` léger).
- **Markdown** — lisible partout.
- **Imprimer / PDF** — la mise en page d'impression est propre.

L'import propose de *fusionner* (ajoute ce qui manque) ou de *remplacer*.

> Vider les données de site du navigateur efface le carnet. Une sauvegarde de
> temps en temps évite les mauvaises surprises.

---

## Structure du projet

```
encre/
├── index.html
├── demarrer.cmd          lance serveur.py, avec repli sur http.server
├── serveur.py            fichiers + relais (/api/letterboxd, /api/x, /api/img)
└── assets/
    ├── css/
    │   ├── style.css        tokens, thèmes, mise en page, menu latéral
    │   ├── components.css   boutons, champs, éditeur, galeries, modales
    │   └── views.css        agenda, fil, carnets, notes, réglages
    └── js/
        ├── util.js          DOM, dates FR, modales, menus, toasts
        ├── coffre.js        chiffrement du coffre (PBKDF2 + AES-GCM)
        ├── media.js         images : IndexedDB, redimensionnement
        ├── store.js         état, persistance, thèmes, export/import
        ├── embed.js         analyse des liens → iframes officielles
        ├── gallery.js       8 agencements + visionneuse
        ├── editor.js        éditeur par blocs, menu « / », markdown
        ├── view-*.js        une vue par espace
        └── app.js           routeur, palette ⌘K, raccourcis
```

Aucune dépendance, aucune étape de build : du HTML, du CSS et du JavaScript.
