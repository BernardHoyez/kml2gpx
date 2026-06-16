# kml2gpx

Application web (PWA) de conversion **KML ⇄ GPX**, avec carte Leaflet et choix
du fond de plan : OpenStreetMap, IGN Plan V2, IGN BD Ortho.

Tout se passe dans le navigateur : aucun serveur, aucune donnée envoyée à un
tiers. Les fichiers ouverts et convertis restent sur l'appareil de
l'utilisateur.

## Fonctionnalités

- Lecture d'un fichier `.kml` ou `.gpx` (sélection ou glisser-déposer).
- Détection automatique du format et du sens de conversion.
- Conversion KML → GPX et GPX → KML (points isolés, tracés/itinéraires,
  polygones simples, et lecture basique des pistes `gx:Track`).
- Affichage du contenu importé sur une carte Leaflet, avec calcul de la
  distance totale des tracés.
- Trois fonds de carte interchangeables : OSM, IGN Plan V2, IGN BD Ortho
  (services gratuits de la Géoplateforme IGN, sans clé d'API).
- Enregistrement du fichier converti (bouton « Enregistrer »).
- Installable comme application (PWA), fonctionnement hors-ligne après une
  première visite grâce au service worker.

## Structure du dépôt

```
kml2gpx/
├── index.html
├── manifest.json
├── sw.js
├── css/
│   └── style.css
├── js/
│   └── app.js
└── icons/
    ├── icon192.png   (placeholder — à remplacer par le logo définitif)
    └── icon512.png   (placeholder — à remplacer par le logo définitif)
```

## Déploiement sur GitHub Pages

L'application est prévue pour être servie à l'adresse :
`https://BernardHoyez.github.io/kml2gpx/`

1. Créer un dépôt GitHub nommé **kml2gpx** sur le compte **BernardHoyez**.
2. Copier l'ensemble du contenu de ce dossier à la racine du dépôt (le
   fichier `index.html` doit être directement à la racine, pas dans un
   sous-dossier).
3. Pousser sur la branche `main` :
   ```bash
   git init
   git add .
   git commit -m "kml2gpx — version initiale"
   git branch -M main
   git remote add origin https://github.com/BernardHoyez/kml2gpx.git
   git push -u origin main
   ```
4. Dans le dépôt GitHub : **Settings → Pages → Build and deployment**, choisir
   *Deploy from a branch*, branche `main`, dossier `/ (root)`. Enregistrer.
5. Après quelques minutes, le site est accessible à
   `https://BernardHoyez.github.io/kml2gpx/`.

Tous les chemins du projet (CSS, JS, icônes, manifest, service worker) sont
relatifs : aucune adaptation n'est nécessaire pour fonctionner sous ce
sous-chemin `/kml2gpx/`.

### Forcer la mise à jour du cache après chaque déploiement

Le service worker (`sw.js`) utilise une stratégie **« brise-cache » /
network-first** : il tente toujours le réseau en premier, et ne retombe sur
le cache que hors-ligne. À chaque activation, **toutes les anciennes
versions de cache sont supprimées**.

Pour garantir qu'un visiteur récupère bien la dernière version après une mise
à jour, il suffit d'incrémenter la constante en tête de fichier avant de
publier :

```js
const CACHE_VERSION = 'v2';   // v1 -> v2 -> v3 ...
```

Changer cette valeur modifie le contenu binaire de `sw.js`, ce que les
navigateurs détectent automatiquement pour déclencher la mise à jour du
service worker et la purge de l'ancien cache.

## Remplacer les icônes

`icons/icon192.png` et `icons/icon512.png` sont des **placeholders**
générés automatiquement (logo simple sur fond sombre). Pour les remplacer,
déposer un PNG carré aux dimensions correspondantes (192×192 et 512×512) sous
le même nom de fichier — aucune autre modification n'est nécessaire.

## Fonds de carte IGN

Les fonds *IGN Plan V2* et *IGN BD Ortho* sont servis par la Géoplateforme de
l'IGN (`data.geopf.fr`), en accès libre et sans clé d'API pour ces couches.
En cas de changement de politique d'accès par l'IGN, seules les URL des
tuiles dans `js/app.js` (objet `baseLayers`) seraient à mettre à jour.

## Limites connues

- Les pistes KML temporelles complexes (`gx:MultiTrack`, attributs `when`
  détaillés) sont lues de façon simplifiée : seules les coordonnées sont
  conservées, sans les horodatages.
- Les styles visuels KML (couleurs, icônes personnalisées) ne sont pas
  importés ; l'affichage sur la carte utilise un style unique.
- La conversion est effectuée entièrement côté client ; les fichiers très
  volumineux (plusieurs dizaines de Mo) peuvent ralentir le navigateur.
