# Firefox façon Safari

Personnalisation de **Firefox 157 sous Windows 11** (thème sombre) pour ressembler à Safari de macOS :
barre d'adresse centrée qui n'affiche que le domaine avec un globe, onglets en capsule, menus et panneaux arrondis,
icônes au trait fin, animations d'ouverture et de fermeture, page « nouvel onglet » sobre.

Tout repose sur quatre mécanismes, sans extension :

| Fichier | Rôle |
|---|---|
| `profil/chrome/userChrome.css` | style de l'interface (barres, onglets, barre d'adresse, panneaux, icônes…) |
| `profil/chrome/userContent.css` | style de la page « nouvel onglet » / accueil |
| `profil/chrome/urlbar-domaine.uc.js` + `.manifest` | script d'interface : domaine seul dans la barre d'adresse, globe cliquable, centrage |
| `profil/chrome/teinte-child.sys.mjs` + `teinte-parent.sys.mjs` | acteur de fenêtre : mesure la couleur de la page (côté page) et la transmet à l'interface (côté interface) |
| `profil/user.js` | préférences imposées à chaque démarrage (active `userChrome.css`, disposition des barres…) |
| `installation/config.js` + `installation/defaults/pref/config-prefs.js` | chargeur (AutoConfig) du script ci-dessus, dans **le dossier d'installation** de Firefox |

## Remettre en place (après une mise à jour, une réinstallation, sur un autre PC)

1. Quitter **complètement** Firefox (aucun `firefox.exe` dans le Gestionnaire des tâches).
2. Dans PowerShell, depuis ce dossier :

```powershell
.\restaurer.ps1 -Simuler     # affiche ce qui sera copié, sans rien faire
.\restaurer.ps1              # restaure ; accepter la fenêtre d'autorisation administrateur
```

3. Relancer Firefox.

Le script copie les fichiers du profil (en gardant les anciens dans `<profil>\sauvegarde-avant-restauration\`) puis installe
le chargeur dans `C:\Program Files\Mozilla Firefox` (droits administrateur : il se relance seul en élevé).
Options : `-Profil <dossier>`, `-DossierFirefox <dossier>`, `-SansInstallation`, `-SansUserJs`.

> Si l'exécution est bloquée par la stratégie de scripts : `powershell -ExecutionPolicy Bypass -File .\restaurer.ps1`.

## Enregistrer une modification

Après avoir changé quelque chose dans le profil :

```powershell
.\sauvegarder.ps1            # recopie profil + chargeur ici et affiche git status
git add -A; git commit -m "…"; git push
```

## Les mises à jour de Firefox peuvent-elles tout casser ?

- Les fichiers du **profil** ne sont jamais touchés par une mise à jour.
- Le **chargeur** (`config.js`, `config-prefs.js`) est dans le dossier d'installation : une mise à jour ne devrait pas
  l'effacer, mais ce n'est pas garanti. S'il disparaît, le CSS continue de marcher mais le script s'arrête (domaine seul,
  globe centré, recentrage de la barre active). `restaurer.ps1` le remet.
- Le vrai risque : Firefox change le nom ou la structure d'un élément ciblé. L'élément reprend alors simplement son aspect
  d'origine, sans plantage. Les zones les plus exposées : la barre d'adresse et son menu déroulant
  (`.urlbar-background`, `.urlbarView-background`), les panneaux (`--panel-*`), la barre latérale, la page « nouvel onglet »
  (`activity-stream`), la barre de recherche dans la page (`findbar`). Les onglets, les favoris et les icônes sont plus stables.

## Pièges appris (à relire avant de modifier)

- `userChrome.css` est une feuille « utilisateur » : il faut `!important` pour battre le CSS de Firefox.
- Une image `data:` ne reçoit pas `context-fill` : les icônes SVG ont leur couleur écrite dedans (`%23fbfbfe`).
- `display: none` ou `visibility: hidden` sur l'étoile des marque-pages empêche le panneau « Ajouter un marque-page » de
  s'ouvrir (Ctrl+D) : on la rend transparente (`opacity: 0`).
- Un `transform` sur `#urlbar-container` casse l'ancrage du menu de l'adresse : centrer avec des marges automatiques.
- Toute la barre du haut est une zone de déplacement de la fenêtre (`-moz-window-dragging: drag`) : un bouton posé hors
  de la barre d'adresse (le bouclier) doit avoir `no-drag`, sinon un vrai clic ne fait rien.
- `.browserContainer` est une grille : un élément en `position: absolute` (la recherche dans la page) va dans une ligne
  implicite sans `grid-area: 1 / 1`.
- Une règle de sélection `findbar`, `.searchmode-switcher`, etc. peut manquer d'identifiant : vérifier le vrai sélecteur
  avant d'annoncer qu'un élément est masqué.
- La page « nouvel onglet » mémorise son dernier affichage : après un changement, F5 ou redémarrage complet.
- Quand on remplace un bloc du CSS en le coupant entre deux repères, vérifier qu'on n'emporte pas d'autres règles
  (comparer la liste des sélecteurs avant et après).

## Style « Safari macOS 26 » (teinte, coins, défilement)

- **Barre teintée (comme Safari 26 / 27)** : `teinte-child.sys.mjs` (dans la page) porte le code de WebKit (branche `main`, lue le
  2026-10-14) : `LocalFrameView::fixedContainerEdges` (bord haut : élément fixe ou collant touché au milieu du bord, à 4 px sous
  le bord ; largeur d'au moins 90 % de la fenêtre ; boîte de plus de 10 px ; opacité, boîte vide et `backdrop-filter` écartés ;
  couleur de fond unie, mélangée au fond de la page si son alpha est sous 0,75, sinon rendue opaque ; sans fond uni, échantillon de
  29 pixels dont 20 identiques ; figée après le premier défilement), `documentBackgroundColor` (fond de page = `<html>` puis
  `<body>` sur du blanc, images de fond ignorées) et `WKWebView._updateFixedColorExtensionViews` (couleur de l'arête haute, sinon
  `underPageBackgroundColor`, c'est-à-dire le fond de la page). `theme-color` n'est pas utilisé. `urlbar-domaine.uc.js` publie la
  couleur dans `--uc-teinte` ; `userChrome.css` l'applique aux barres, au creux de la bande d'onglets et du champ d'adresse
  (`--uc-creux`, 76 % de la barre + 24 % de noir, comme le #1b1f22 mesuré sur Safari). Barre claire : luma Rec. 709 > 127,5 (règle
  décrite par le dépôt andesco/safari-color-tinting, pas lue dans WebKit) → attribut `uc-clair` : `color-scheme: light` sur les
  barres, icônes inversées, texte des onglets foncé. Piège : un acteur doit déclarer `safeForUntrustedWebProcess: true` à la racine
  de ses options, sinon `getActor` répond « doesn't match remote type » ; et `browser.ownerGlobal` peut revenir `undefined` :
  utiliser `ownerDocument.defaultView`. 17 pages de test (fond, en-tête fixe, dégradé, flou, voile, collant, 8 px…) donnent la couleur
  attendue.
  **Délai de 500 ms** (`DELAI_TEINTE_MS` dans `urlbar-domaine.uc.js`) : une page qui se charge passe souvent par le blanc du fond par
  défaut avant de devenir sombre ; une nouvelle couleur n'est appliquée qu'après 500 ms sans autre mesure, donc la couleur d'attente est
  remplacée et la barre ne passe pas par le blanc (page blanche puis sombre à 300 ms : plus de blanc ; sombre à 900 ms : le blanc
  passe encore, valeur à allonger). Le changement d'onglet reste immédiat (4 ms mesurés).
  **Non vérifiable** (le code de l'application Safari n'est pas public) : comment Safari choisit sa couleur de barre à partir de ces
  deux informations (arête haute, fond de page) et ce qu'il fait d'une page blanche (WebKit lui donne du blanc ; qu'il l'affiche en
  blanc est probable mais non lu), l'aspect exact de la bande d'onglets et de l'onglet actif. Valeur tierce : seuil « presque
  transparent » 0,1 (la constante n'est pas dans le fichier lu). Non porté : `::backdrop` (dialogues), filtres de couleur,
  `pointer-events` (WebKit les ignore au premier essai, `elementsFromPoint` les respecte).
- **Anneau de focus** (`userContent.css`) : `:focus-visible { outline: 3px solid rgba(10, 132, 255, 0.5); outline-offset: 0 }` sur toutes les pages,
  SANS `!important` : un site qui dessine ou retire son contour garde le sien (testé : un champ au contour vert reste vert).
- **Boîtes de dialogue des pages en « feuille »** (`userChrome.css`) : `.content-prompt-dialog > .dialogOverlay { align-content: start }` (accrochées en
  haut au lieu d'être centrées) et `.dialogBox` aux coins du bas arrondis (22 px) avec ombre douce. Structure de Firefox 157 : `stack.dialogStack.
  content-prompt-dialog > div.dialogTemplate.dialogOverlay[topmost] > div.dialogBox > browser.dialogFrame`. Vérifié sur une structure SYNTHÉTIQUE
  aux vraies classes : Marionette ferme toute vraie boîte `confirm()` dès la commande suivante et la capture ne la montre pas, donc l'aspect
  d'une vraie boîte n'a pas été photographié.
- **Fenêtre privée reconnaissable** : `:root[privatebrowsingmode]` barres `#161618` ; `urlbar-domaine.uc.js` n'y active pas la teinte de la page ;
  mention « Navigation privée » en violet (`#b9a3ff`) à gauche du champ, seulement quand une page est affichée (`pageproxystate="valid"`) : sur
  un nouvel onglet vide le texte d'invite centré la recouvrait. Mention et couleurs inspirées de Safari, non vérifiées sur votre Safari 27.
- **Mode compact** (bouton « Mode compact » tout à gauche de la barre, à la place du bouton de panneau latéral, masqué ; deux rangées / une rangée) : onglets et champ d'adresse sur UNE seule rangée,
  comme la disposition « Compact » de Safari : [Mode compact, précédent, suivant] [bouclier] [champ d'adresse] [onglets] [boutons de droite]. Le choix est la
  préférence `extensions.uc.compact` (modifiable aussi dans about:config), observée par chaque fenêtre. `urlbar-domaine.uc.js` crée le bouton
  (`CustomizableUI.createWidget`, replacé avant « Précédent » à chaque démarrage car `user.js` remet la disposition à zéro), pose `uc-compact`,
  `uc-multi` (2 onglets ou plus : avec un seul la rangée est masquée, rien ne change) et mesure `--uc-gauche` / `--uc-droite`. `userChrome.css` pose la
  rangée d'onglets EN SUPERPOSITION de la barre de navigation (`position: absolute`, boîte de 40 px) ; seulement en onglets horizontaux (`:has(#tabbrowser-tabs[orient="horizontal"])`).
  **Champ** : `left` = `--uc-gauche + 47px`, largeur `clamp(220px, 22vw, 380px)`.
  **Bouclier** : à gauche du champ (`inset-inline-end: calc(100% + 13px)`, 6 px en mode normal). Mesuré sur capture, pixels réels : flèche « suivant » -> bouclier 39 px (écart
  VALIDÉ par l'utilisateur : ne plus y toucher), bouclier -> bord du champ 32 px (essais : 24 px = « pas bon », 40 px = « trop grand »). **Bouton compact** décalé de 15 px (`margin-inline-start`) :
  bord de la fenêtre -> symbole = 40 px, symbole -> flèche « précédent » = 39 px (valable aussi en mode normal, même bouton).
  **Bande d'onglets** : `left: calc(var(--uc-ux) + var(--uc-uw) + 25px)` et `right: calc(var(--uc-droite) + 9px)`, soit 25 px d'écart visible avec le champ (= l'écart flèche « suivant » -> champ, 25,4 px
  mesurés) et 25 px avec l'icône du premier bouton de droite (`--uc-droite` compte 6 px de marge et le bouton a 10 px de vide autour de son icône).
  **Hauteur** : la bande garde sa taille normale (boîte de 40 px, onglets de 36 px dont des pastilles de 28 px) ; c'est le champ qui est à 36 px (voir « Hauteur de la barre du haut »). La bande est
  centrée dans la barre de 50 px : `top: calc((hauteur de barre - 40px) / 2)` = 5 px.
  **Animation** : le passage normal <-> compact (bouton, ou 2e onglet qui s'ouvre / se ferme en mode compact) est progressif sur 0,42 s, courbe symétrique
  `cubic-bezier(0.4, 0, 0.2, 1)` (la première, très « ease-out », faisait la moitié du trajet en 35 ms : on ne voyait qu'un saut). Le champ glisse et se rétrécit
  (variables `--uc-ux` / `--uc-uw` déclarées avec `@property`, transition seulement sous l'attribut `uc-anim`, posé APRÈS la modification dans la même tâche et
  seulement si la disposition change, sinon le champ « traînerait » au redimensionnement et le mode normal serait touché). La bande d'onglets SUIT le bord droit du
  champ : plus de chevauchement. Pendant `uc-anim` : pas de transition propre
  à Firefox sur la rangée d'onglets (son ouverture en hauteur laissait voir une rangée vide), boîte de la barre de la couleur des barres (sa couleur propre, plus sombre,
  faisait une bande sous la barre des favoris), flèches de défilement des onglets masquées. La hauteur n'est animée (`element.animate`) que pour la bascule du bouton :
  à l'ouverture d'un onglet la mesure de départ était faussée par la rangée de Firefox en train de s'ouvrir. Onglets comptés SYNCHRONEMENT à `TabOpen` / `TabClose`
  (l'onglet qui se ferme est écarté), avec des passages différés en secours. Pas d'animation pendant les 3 premières secondes d'une fenêtre. Corrigé après un
  enregistrement d'écran de l'utilisateur (images extraites avec ffmpeg).
  Testé : bascule dans les deux sens, fenêtre de 885 px, 10 onglets (la bande défile avec ses flèches), retour à la disposition normale avec un seul onglet.
- **Boutons de fenêtre en ronds** (`userChrome.css`) : réduire / agrandir / fermer en ronds de 30 px (90 px de large au lieu de 138), glyphes fins arrondis dessinés en SVG
  dans le `::before` du bouton (le symbole de Windows est une police : `content: "\e8bb"`), survol rond clair, rouge `#e5484d` pour fermer, dessins inversés
  sur barre claire. Ce sont les boutons que Firefox garde en copie dans `#nav-bar`. Vérifié : mesures, survol forcé (`InspectorUtils.addPseudoClassLock`) en barre
  sombre et claire, touche du centre. NON testé : de vrais clics de souris sur la fenêtre (les clics simulés ne traversent pas la zone de déplacement de Windows) ;
  le dessin du bouton « restaurer » (fenêtre agrandie) n'a pas été photographié. Refusés avant : ronds rouge/jaune/vert à GAUCHE.
- **Hauteur de la barre du haut** (`userChrome.css`, `--uc-barre-extra` = 6 px et `--urlbar-height: 36px !important` sur `:root`, demandé le 2026-10-14) : le champ d'adresse a la hauteur de la bande
  d'onglets (36 px), dans les DEUX modes ; la barre du haut passe à 50 px (36 + 8 + 6), soit 7 px d'air au-dessus et au-dessous du champ. `!important` : Firefox pose sa valeur dans une règle d'auteur.
  Mode normal : `#TabsToolbar` n'a pas de padding haut (la barre du dessus a déjà 7 px d'air sous le champ ; sinon 9 px sous le champ contre 7 au-dessus, écart signalé sur capture) et `--uc-barre-bas` = 7 px
  en bas (`padding: 0 8px 7px`, `max-height: 43px`), le même air entre la bande et la page qu'entre le champ et la bande (demandé : « il manque de la hauteur en bas des tabs »). Mesuré sur capture : 11 px au-dessus
  du champ, 11 px sous le champ jusqu'à la bande d'onglets. En compact (bande en superposition) : 2 px haut et bas, 40 px, centrée dans la barre (onglets alignés sur le champ, de 7 à 43 px).
  Le 36 px avait été refusé plus tôt en compact (« j'aime pas comme ça », barre de 40 px, 2 px d'air) : si ce n'est pas la hauteur mais l'air qui gênait, ne changer que la variable.
- **Barre de favoris** : même air sous les favoris que sous la bande / le champ (`padding-block: 2px calc(2px + var(--uc-barre-bas))`, `max-height: calc(3em + var(--uc-barre-bas))`), avec UN seul
  onglet (page de nouvel onglet) comme avec plusieurs : même hauteur de barre (demandé le 2026-10-14 ; un essai « seulement avec 2 onglets ou plus » avait été fait juste avant puis retiré).
  Mesuré avec 3 favoris : barre de 39 px, favoris à 11 px au-dessus / 11,7 px sous, avec 1 comme avec 3 onglets, en normal comme en compact.
- **Contour de focus bleu à l'INTÉRIEUR** (`outline-offset: -3px` sur `#urlbar[focused] > .urlbar-background`) : il ne déborde plus du champ ; mesuré, champ identique au repos et pris
  en focus (448,5 / 7 / 384,4 x 36).
- **Globe et « Actualiser »** (demandé) : le globe (`#identity-box`) est toujours à gauche du champ, à `inset-inline-start: 4px` (rond de 28 px, mesuré à 4,7 px du bord), comme « Actualiser » est à droite
  (`left: calc(var(--uc-ux) + var(--uc-uw) - 34px)`, rond à 4 px du bord) ; il n'est plus placé d'après le texte. Le texte seul est centré dans le champ (`padding-inline-end: 4px` : mesuré, centre du texte =
  centre du champ). Le bouton des permissions (site qui en a, YouTube par exemple) était une pilule de 52 px (globe + icône de lecture automatique bloquée, marges de 8 px) : même rond de 28 px, les icônes de
  permission BLOQUÉE (`#blocked-permissions-container`) ne s'affichent plus à côté (elles restent dans le panneau au clic) ; les icônes de PARTAGE en cours (caméra, micro) restent visibles et élargissent la zone.
  Mesuré : 28 x 28, rayon 14 px, avec et sans permission, normal et compact.
- **Globe sur une page non sécurisée (http)** : Firefox (classe `notSecureText` sur `#identity-box`) lui donnait un fond CLAIR et affichait « Non sécurisé » (`#identity-icon-label`), coupé en « … » par
  la barre étroite. Fond transparent (survol 22 % de la couleur du texte), texte masqué ; la page non sécurisée est signalée par le bouclier à gauche du champ, qui passe en « ! » (règle `.insecure`).
  Reproduit avec `http://192.168.86.206:8766/` (serveur de test sur le réseau local), corrigé et revérifié sur capture.
- **Coins** : 22 px sur les panneaux, le menu de l'adresse et la recherche dans la page ; 12 px sur les menus contextuels. Les
  coins de la fenêtre elle-même sont gérés par Windows.
- **Barres de défilement** : fines et translucides partout (`scrollbar-width: thin`, gris moyen, `userContent.css`). La barre de la PAGE
  (le viewport) suit son fond, comme WebKit (`LocalFrameView::recalculateScrollbarOverlayStyle`, `Color::lightness`) : fond de luminosité
  HSL `(max + min) / 2` de 0,5 ou moins → curseur clair `rgba(255, 255, 255, 0.5)`, sinon curseur sombre `rgba(0, 0, 0, 0.5)`.
  `teinte-child.sys.mjs` charge pour cela une feuille utilisateur par page (`windowUtils.loadSheetUsingURIString`, règle `:root`, qui
  l'emporte sur la règle `*` de `userContent.css`) ; les zones de défilement internes d'une page gardent le gris moyen. Une page qui
  déclare `color-scheme: dark` sans fond compte comme sombre (`#1c1b22`, le fond de Firefox). Vérifié sur 6 pages de test avec les
  barres classiques (`ui.useOverlayScrollbars` = 0) : seuil 127 / 128 compris. Windows 11 les rend « overlay » (visibles seulement en
  défilant).

## Tester sans toucher à votre profil (profil jetable + Marionette)

`outils-test/` contient ce qui a servi à tout mesurer :

- `mkprofile.py <profil réel> <dossier jetable>` : crée un profil de test avec votre `user.js` (sans copier `prefs.js` en entier :
  un `prefs.js` copié avec son `storeID` inscrit la copie dans votre groupe de profils et fait apparaître un faux profil).
  Copier ensuite `chrome\*` dans `<dossier jetable>\chrome\`.
- Lancer le Firefox de test : `firefox.exe -no-remote -marionette -remote-allow-system-access -profile <dossier jetable> <url>`.
  Le premier lancement échoue souvent : réessayer.
- `offscreen.ps1` : déplace la fenêtre de test hors écran (`x = -6000`) pour ne pas gêner.
- `shotall.ps1 -Prefix nom` : capture **toutes** les fenêtres du profil de test (fenêtre principale + panneaux et menus, qui
  sont des fenêtres séparées).
- `marionette.py` : petit client pour mesurer (`m.run("return …")` dans le contexte interface) et simuler souris/clics.
- Arrêter le test avec `taskkill /PID <pid> /T /F` sur les processus du profil jetable seulement, puis supprimer le dossier.

Limites connues : avec Marionette actif, ou dans un profil isolé, la vraie page « nouvel onglet » reste vide (le rendu se
vérifie sur une copie statique) ; une fenêtre hors écran est « inactive » (sélection de texte grisée) ; les clics simulés ne
passent pas par la zone de déplacement de fenêtre de Windows.

## Ce qui a été essayé puis retiré

- Grille « Favoris » sur la page « nouvel onglet » (marque-pages épinglés, dossiers via un faux lien intercepté).
- Boutons de fenêtre en ronds rouge / jaune / vert à gauche (refusés : retour aux boutons Windows à droite).
- Capsules de verre derrière les boutons de la barre latérale et de précédent / suivant (refusées).
- Boutons Partager et vue d'ensemble des onglets dans la barre du haut (refusés ; le script CustomizableUI est dans l'historique git).
- Mica de Windows 11 sur les barres : remplacé par un gris plein `#23282e` pour avoir exactement la même couleur partout.
