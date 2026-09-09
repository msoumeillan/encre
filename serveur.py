#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serveur local d'Encre.

Sert les fichiers du carnet, plus deux petites routes qui servent de relais :

    /api/letterboxd?url=...   → titre, année, réalisateur, note, affiche
    /api/img?url=...          → renvoie l'affiche (pour la stocker hors ligne)

Pourquoi un relais ? Le navigateur ne peut pas lire une page letterboxd.com :
le site ne renvoie pas d'en-tête CORS. Un programme, lui, le peut. Tout reste
sur votre machine — aucun service tiers, aucune clé d'API.

Le relais n'accepte que les domaines de Letterboxd, pour ne pas devenir un
proxy ouvert, et n'écoute que sur 127.0.0.1.
"""

import http.server
import json
import math
import os
import re
import socketserver
import sys
import urllib.parse
import urllib.request
import webbrowser

PORT = int(os.environ.get('PORT') or (sys.argv[1] if len(sys.argv) > 1 else 5173))
RACINE = os.path.dirname(os.path.abspath(__file__))
HOTES_PAGE = ('letterboxd.com', 'www.letterboxd.com')
HOTES_X = ('x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com')
HOTES_IMAGE = ('a.ltrbxd.com', 's.ltrbxd.com', 'letterboxd.com', 'www.letterboxd.com',
               'pbs.twimg.com', 'abs.twimg.com')
UA = 'Mozilla/5.0 (compatible; Encre/1.0; carnet local)'
DELAI = 12


# ───────────────────────── récupération ─────────────────────────

def recuperer(url, taille_max=6 * 1024 * 1024):
    requete = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    })
    with urllib.request.urlopen(requete, timeout=DELAI) as reponse:
        return reponse.read(taille_max), reponse.headers.get('Content-Type', '')


def hote(url):
    try:
        return urllib.parse.urlparse(url).hostname or ''
    except ValueError:
        return ''


# ───────────────────────── analyse de la page ─────────────────────────

def balise_meta(html, cle):
    """Contenu d'une balise <meta property=... content=...>, dans les deux ordres."""
    motifs = (
        r'<meta[^>]+(?:property|name)=["\']%s["\'][^>]*?content=["\']([^"\']*)["\']' % re.escape(cle),
        r'<meta[^>]+content=["\']([^"\']*)["\'][^>]*?(?:property|name)=["\']%s["\']' % re.escape(cle),
    )
    for motif in motifs:
        trouve = re.search(motif, html, re.I | re.S)
        if trouve:
            return trouve.group(1).strip()
    return ''


def _premier(valeur):
    return valeur[0] if isinstance(valeur, list) and valeur else valeur


def _noms(valeur):
    valeur = valeur if isinstance(valeur, list) else [valeur]
    noms = []
    for element in valeur:
        if isinstance(element, dict) and element.get('name'):
            noms.append(element['name'])
        elif isinstance(element, str):
            noms.append(element)
    return noms


def depuis_jsonld(html, infos):
    """Letterboxd publie un bloc JSON-LD : c'est la source la plus fiable."""
    for bloc in re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', html, re.S | re.I):
        bloc = bloc.replace('/* <![CDATA[ */', '').replace('/* ]]> */', '').strip()
        try:
            donnees = json.loads(bloc)
        except Exception:
            continue
        if isinstance(donnees, list):
            donnees = donnees[0] if donnees else {}
        if not isinstance(donnees, dict):
            continue

        # page de critique : le film est imbriqué, la note est à côté
        film = donnees
        if donnees.get('@type') == 'Review':
            note = donnees.get('reviewRating') or {}
            if isinstance(note, dict) and note.get('ratingValue') is not None:
                try:
                    infos['note'] = float(note['ratingValue'])
                except (TypeError, ValueError):
                    pass
            film = donnees.get('itemReviewed') or {}

        if not isinstance(film, dict):
            continue
        if film.get('name') and not infos['titre']:
            infos['titre'] = str(film['name'])
        image = _premier(film.get('image'))
        if isinstance(image, dict):
            image = image.get('url')
        if image and not infos['affiche']:
            infos['affiche'] = str(image)
        realisateurs = _noms(film.get('director'))
        if realisateurs and not infos['realisateur']:
            infos['realisateur'] = ', '.join(realisateurs)
        evenement = _premier(film.get('releasedEvent')) or {}
        if isinstance(evenement, dict) and evenement.get('startDate') and not infos['annee']:
            infos['annee'] = str(evenement['startDate'])[:4]
    return infos


def analyser(html):
    infos = {'titre': '', 'annee': '', 'realisateur': '', 'note': 0, 'affiche': ''}
    depuis_jsonld(html, infos)

    # filets de secours sur les balises Open Graph
    if not infos['affiche']:
        infos['affiche'] = balise_meta(html, 'og:image')
    titre_og = balise_meta(html, 'og:title')
    if titre_og and not infos['titre']:
        # « Le Tombeau des lucioles (1988) » ou « ‘Film’ review by untel »
        critique = re.match(r'^[‘\'"“](.+?)[’\'"”]\s+review', titre_og, re.I)
        infos['titre'] = critique.group(1) if critique else re.sub(r'\s*\(\d{4}\)\s*$', '', titre_og)
    if not infos['annee'] and titre_og:
        annee = re.search(r'\((\d{4})\)', titre_og)
        if annee:
            infos['annee'] = annee.group(1)
    if not infos['realisateur']:
        infos['realisateur'] = balise_meta(html, 'twitter:data1')

    # note d'un membre : « ★★★★½ » dans le titre ou la description
    if not infos['note']:
        etoiles = re.search(r'([★]{1,5})(½?)', titre_og + ' ' + balise_meta(html, 'og:description'))
        if etoiles:
            infos['note'] = len(etoiles.group(1)) + (0.5 if etoiles.group(2) else 0)

    infos['titre'] = infos['titre'].strip()
    return infos


# ───────────────────────── tweets ─────────────────────────

MOIS_EN = {'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
           'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12}
MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
           'août', 'septembre', 'octobre', 'novembre', 'décembre']


def date_francaise(brut):
    """« May 31, 2018 » → « 31 mai 2018 »."""
    trouve = re.match(r'([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})', brut.strip())
    if not trouve:
        return brut.strip()
    mois = MOIS_EN.get(trouve.group(1).lower())
    if not mois:
        return brut.strip()
    return '%d %s %s' % (int(trouve.group(2)), MOIS_FR[mois - 1], trouve.group(3))


def _jeton(identifiant):
    """Jeton attendu par le point d'accès de syndication (même calcul que leur widget)."""
    valeur = (int(identifiant) / 1e15) * math.pi
    chiffres = '0123456789abcdefghijklmnopqrstuvwxyz'
    entier, reste = int(valeur), valeur - int(valeur)
    tete = ''
    while entier:
        tete = chiffres[entier % 36] + tete
        entier //= 36
    queue = ''
    for _ in range(20):
        reste *= 36
        d = int(reste)
        queue += chiffres[d]
        reste -= d
    return ((tete or '0') + '.' + queue).replace('0', '').replace('.', '')


def _medias_de(d):
    """Adresses d'images d'un tweet. `entities.media` ne porte que des liens
    t.co : on n'accepte que les vraies adresses, et jamais deux fois la même."""
    medias = []

    def ajouter(lien):
        if lien and lien.startswith('https://pbs.twimg.com/') and lien not in medias:
            medias.append(lien)

    for m in (d.get('mediaDetails') or []):
        if isinstance(m, dict):
            # photo, gif ou vidéo : media_url_https est l'image ou sa vignette
            ajouter(m.get('media_url_https'))
    for m in (d.get('photos') or []):
        if isinstance(m, dict):
            ajouter(m.get('url') or m.get('media_url_https'))
    return medias[:4]


def _depuis_tweet(d):
    """Mise en forme commune au tweet principal et au tweet cité."""
    if not isinstance(d, dict) or not (d.get('text') or d.get('mediaDetails')):
        return None
    membre = d.get('user') or {}
    medias = _medias_de(d)

    # le texte se termine par l'URL raccourcie des médias ou du tweet cité
    texte = d.get('text') or ''
    if medias or d.get('quoted_tweet'):
        texte = re.sub(r'https://t\.co/\w+\s*$', '', texte).rstrip()

    pseudo = membre.get('screen_name') or ''
    return {
        'auteur': membre.get('name') or '',
        'pseudo': pseudo,
        'avatar': (membre.get('profile_image_url_https') or '').replace('_normal.', '_bigger.'),
        'verifie': bool(membre.get('is_blue_verified') or membre.get('verified')),
        'texte': texte,
        'date': date_iso_francaise(d.get('created_at') or ''),
        'medias': medias,
        'liens': [(e.get('url'), e.get('expanded_url')) for e in ((d.get('entities') or {}).get('urls') or [])],
        'lien': 'https://x.com/%s/status/%s' % (pseudo, d.get('id_str')) if pseudo and d.get('id_str') else '',
    }


def tweet_syndication(identifiant):
    """Texte, auteur, avatar, date, médias et tweet cité — sans clé d'API."""
    url = 'https://cdn.syndication.twimg.com/tweet-result?' + urllib.parse.urlencode({
        'id': identifiant, 'token': _jeton(identifiant), 'lang': 'fr',
    })
    try:
        brut, _ = recuperer(url)
        d = json.loads(brut.decode('utf-8', 'replace'))
    except Exception:
        return None
    if not isinstance(d, dict) or not d.get('text'):
        return None

    infos = _depuis_tweet(d)
    if not infos:
        return None
    # le tweet cité a exactement la même forme : même traitement
    infos['cite'] = _depuis_tweet(d.get('quoted_tweet') or {})
    return infos


def date_iso_francaise(iso):
    trouve = re.match(r'(\d{4})-(\d{2})-(\d{2})', iso or '')
    if not trouve:
        return ''
    return '%d %s %s' % (int(trouve.group(3)), MOIS_FR[int(trouve.group(2)) - 1], trouve.group(1))


def analyser_tweet(donnees, url):
    html = donnees.get('html') or ''
    infos = {
        'auteur': donnees.get('author_name') or '',
        'pseudo': '',
        'texte': '',
        'date': '',
        'url': donnees.get('url') or url,
    }

    corps = re.search(r'<p[^>]*>(.*?)</p>', html, re.S | re.I)
    if corps:
        # on ne garde que les liens et les sauts de ligne
        texte = corps.group(1)
        texte = re.sub(r'<(?!/?(?:a|br)\b)[^>]*>', '', texte, flags=re.I)
        infos['texte'] = texte.strip()

    signature = re.search(r'&mdash;\s*(.*?)\s*\(@([\w]+)\)', html)
    if signature:
        infos['auteur'] = infos['auteur'] or re.sub(r'<[^>]*>', '', signature.group(1))
        infos['pseudo'] = signature.group(2)
    elif donnees.get('author_url'):
        infos['pseudo'] = donnees['author_url'].rstrip('/').split('/')[-1]

    dernier = re.findall(r'<a[^>]*>([^<]*)</a>', html)
    if dernier:
        infos['date'] = date_francaise(dernier[-1])
    return infos


# ───────────────────────── serveur ─────────────────────────

class Gestionnaire(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=RACINE, **kwargs)

    def log_message(self, format, *args):
        if '/api/' in (self.path or ''):
            sys.stderr.write("  relais %s\n" % self.path.split('?')[0])

    def envoyer_json(self, charge, code=200):
        corps = json.dumps(charge, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(corps)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(corps)

    def do_GET(self):
        chemin = urllib.parse.urlparse(self.path)
        if chemin.path == '/api/letterboxd':
            return self.route_letterboxd(chemin)
        if chemin.path == '/api/x':
            return self.route_x(chemin)
        if chemin.path == '/api/img':
            return self.route_image(chemin)
        # fichiers du carnet : jamais de cache, sinon les mises à jour passent inaperçues
        self.send_header_no_cache = True
        return super().do_GET()

    def end_headers(self):
        if getattr(self, 'send_header_no_cache', False):
            self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()

    def route_letterboxd(self, chemin):
        url = urllib.parse.parse_qs(chemin.query).get('url', [''])[0]
        if hote(url) not in HOTES_PAGE:
            return self.envoyer_json({'erreur': 'Seuls les liens letterboxd.com sont acceptés.'}, 400)
        try:
            brut, _ = recuperer(url)
            infos = analyser(brut.decode('utf-8', 'replace'))
        except Exception as souci:
            return self.envoyer_json({'erreur': 'Page injoignable : %s' % souci}, 502)
        infos['url'] = url
        return self.envoyer_json(infos)

    def route_x(self, chemin):
        """Contenu public d'un tweet. Deux sources, de la plus riche à la plus sûre."""
        url = urllib.parse.parse_qs(chemin.query).get('url', [''])[0]
        if hote(url) not in HOTES_X:
            return self.envoyer_json({'erreur': 'Seuls les liens X / Twitter sont acceptés.'}, 400)

        identifiant = re.search(r'/status(?:es)?/(\d+)', url)
        if identifiant:
            riche = tweet_syndication(identifiant.group(1))
            if riche:
                riche['url'] = url
                return self.envoyer_json(riche)

        # repli : oEmbed public (texte seul)
        point = 'https://publish.twitter.com/oembed?' + urllib.parse.urlencode({
            'url': url, 'omit_script': '1', 'dnt': 'true', 'maxwidth': '550', 'hide_thread': 'true',
        })
        try:
            brut, _ = recuperer(point)
            donnees = json.loads(brut.decode('utf-8', 'replace'))
        except Exception as souci:
            return self.envoyer_json({'erreur': 'Tweet injoignable : %s' % souci}, 502)
        return self.envoyer_json(analyser_tweet(donnees, url))

    def route_image(self, chemin):
        url = urllib.parse.parse_qs(chemin.query).get('url', [''])[0]
        if hote(url) not in HOTES_IMAGE:
            return self.envoyer_json({'erreur': 'Domaine d’image non autorisé.'}, 400)
        try:
            octets, type_mime = recuperer(url)
        except Exception as souci:
            return self.envoyer_json({'erreur': str(souci)}, 502)
        self.send_response(200)
        self.send_header('Content-Type', type_mime or 'image/jpeg')
        self.send_header('Content-Length', str(len(octets)))
        self.end_headers()
        self.wfile.write(octets)


class Serveur(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    # certaines consoles Windows ne sont pas en UTF-8 (cp1252, cp932…) et
    # plantent sur un simple accent : on force, sans casser si c'est impossible
    for flux in (sys.stdout, sys.stderr):
        try:
            flux.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass

    adresse = ('127.0.0.1', PORT)
    print('')
    print('  Encre  ->  http://localhost:%d' % PORT)
    print('  Relais Letterboxd actif (affiche, titre, realisateur, note).')
    print('  Ctrl+C pour arreter.')
    print('')
    try:
        webbrowser.open('http://localhost:%d' % PORT)
    except Exception:
        pass
    with Serveur(adresse, Gestionnaire) as serveur:
        try:
            serveur.serve_forever()
        except KeyboardInterrupt:
            print('\n  Arrete.')
