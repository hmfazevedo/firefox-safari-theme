# Firefox façon Safari

Personnalisation de **Firefox 158 sous Windows 11** (thème sombre) pour ressembler à Safari de macOS :
barre d'adresse centrée qui n'affiche que le domaine avec un globe, onglets en capsule, menus et panneaux arrondis,
icônes au trait fin, animations d'ouverture et de fermeture, page « nouvel onglet » sobre.

Tout repose sur quatre mécanismes natifs, sans extension :

1. **CSS utilisateur** — `userChrome.css` (interface) et `userContent.css` (page « nouvel onglet ») ;
2. **script d'interface** — `urlbar-domaine.uc.js`, chargé par AutoConfig : domaine seul, globe cliquable, centrage ;
3. **acteurs de fenêtre** — `teinte-child.sys.mjs` (dans la page) et `teinte-parent.sys.mjs` (côté interface) : mesurent la couleur de la page et la transmettent à l'interface ;
4. **préférences** — `user.js`, imposées à chaque démarrage.

Deux chargeurs les font tourner : `installation/config.js` + `installation/defaults/pref/config-prefs.js` (dans le **dossier d'installation** de Firefox) chargent le script ; `user.js` active les feuilles CSS.

| Fichier | Rôle |
|---|---|
| `profil/chrome/userChrome.css` | style de l'interface (barres, onglets, barre d'adresse, panneaux, icônes…) |
| `profil/chrome/userContent.css` | style de la page « nouvel onglet » / accueil |
| `profil/chrome/urlbar-domaine.uc.js` + `.manifest` | script d'interface : domaine seul dans la barre d'adresse, globe cliquable, centrage |
| `profil/chrome/teinte-child.sys.mjs` + `teinte-parent.sys.mjs` | acteurs de fenêtre : mesurent la couleur de la page (côté page) et la transmettent à l'interface (côté interface) |
| `profil/user.js` | préférences imposées à chaque démarrage (active `userChrome.css`, thème sombre, page de nouvel onglet) |
| `installation/config.js` + `installation/defaults/pref/config-prefs.js` | chargeur (AutoConfig) du script ci-dessus, posé dans le **dossier d'installation** de Firefox |

## Prérequis

- **Firefox 158** — la version sur laquelle la personnalisation a été mesurée.
- **Windows 11 en mode sombre** (les mesures de couleurs et d'icônes sont faites en mode sombre, à 150 % d'affichage).
- **Thème sombre de Firefox** — posé par `user.js` (`ui.systemUsesDarkTheme`, `browser.theme.toolbar-theme`), rien à faire à la main.
- **AutoConfig** — le chargeur (`config.js` + `config-prefs.js`) doit être posé dans le dossier d'installation
  (`C:\Program Files\Mozilla Firefox`, droits administrateur, voir « Installer ») : c'est lui qui charge
  `urlbar-domaine.uc.js` dans chaque fenêtre. Voir « Les mises à jour de Firefox peuvent-elles tout casser ? »
  pour ce qui arrive s'il est manquant.

## Installer

Même procédure pour une installation neuve, après une mise à jour de Firefox, une réinstallation ou sur un autre PC :

1. Quitter **complètement** Firefox (aucun `firefox.exe` dans le Gestionnaire des tâches).
2. Copier le contenu du dossier `profil/` dans le dossier de votre profil Firefox (trouvable dans `about:support`, ligne « Dossier du profil ») : `user.js` et le dossier `chrome/`.
3. Copier le contenu du dossier `installation/` dans `C:\Program Files\Mozilla Firefox` (droits administrateur) : `config.js` et le dossier `defaults/`.
4. Relancer Firefox.

> Le script `restaurer.ps1` (inclus dans ce dépôt) fait les étapes 2 et 3 automatiquement et garde une copie des
> anciens fichiers dans `<profil>\sauvegarde-avant-restauration\` : `.\restaurer.ps1 -Simuler` affiche ce qui serait
> copié sans rien faire, `.\restaurer.ps1` exécute (il se relance en administrateur si besoin).
> Options : `-Profil <dossier>`, `-DossierFirefox <dossier>`, `-SansInstallation`, `-SansUserJs`.
> Si la stratégie de scripts bloque : `powershell -ExecutionPolicy Bypass -File .\restaurer.ps1`.

## Les mises à jour de Firefox peuvent-elles tout casser ?

- Les fichiers du **profil** ne sont jamais touchés par une mise à jour.
- Le **chargeur** (`config.js`, `config-prefs.js`) est dans le dossier d'installation : une mise à jour ne devrait pas
  l'effacer, mais ce n'est pas garanti. S'il disparaît, le CSS continue de marcher mais le script s'arrête (domaine seul,
  globe centré, recentrage de la barre active) : recopier le contenu du dossier `installation/` le remet.
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
  haut au lieu d'être centrées) et `.dialogBox` aux coins du bas arrondis (22 px) avec ombre douce. Structure de Firefox 158 : `stack.dialogStack.
  content-prompt-dialog > div.dialogTemplate.dialogOverlay[topmost] > div.dialogBox > browser.dialogFrame`. Vérifié sur une structure SYNTHÉTIQUE
  aux vraies classes : Marionette ferme toute vraie boîte `confirm()` dès la commande suivante et la capture ne la montre pas, donc l'aspect
  d'une vraie boîte n'a pas été photographié.
- **Fenêtre privée reconnaissable** : `:root[privatebrowsingmode]` barres `#161618` ; `urlbar-domaine.uc.js` n'y active pas la teinte de la page ;
  mention « Navigation privée » en violet (`#b9a3ff`) à gauche du champ, seulement quand une page est affichée (`pageproxystate="valid"`) : sur
  un nouvel onglet vide le texte d'invite centré la recouvrait. Mention et couleurs inspirées de Safari, non vérifiées sur Safari 27.
- **Mode compact** (bouton « Mode compact » tout à gauche de la barre, un bouton à part entière ; deux rangées / une rangée) : onglets et champ d'adresse sur UNE seule rangée,
  comme la disposition « Compact » de Safari : [Mode compact, précédent, suivant] [bouclier] [champ d'adresse] [onglets] [boutons de droite]. Le choix est la
  préférence `extensions.uc.compact` (modifiable aussi dans about:config), observée par chaque fenêtre. `urlbar-domaine.uc.js` crée le bouton
  (`CustomizableUI.createWidget`, placé en tête de la barre seulement s'il n'a encore aucune place), pose `uc-compact`,
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
- **Barre de favoris** : pas de marge en haut, `--uc-barre-bas` (7 px) en bas (`padding-block: 0 var(--uc-barre-bas)`, `max-height: calc(3em + var(--uc-barre-bas) - 8px)`), favoris sans marge haut et bas (`margin-block: 0` sur `.bookmark-item`), avec UN seul
  onglet (page de nouvel onglet) comme avec plusieurs : même hauteur de barre (demandé le 2026-10-14 ; un essai « seulement avec 2 onglets ou plus » avait été fait juste avant puis retiré).
  Réduite le 2026-10-15 de 2 px en haut et 2 px en bas (elle avait `padding-block: 2px calc(2px + var(--uc-barre-bas))`), puis encore de 2 px et 2 px : Firefox met 2 px de marge haut et bas autour de
  chaque favori (pilule de 24 px dans une rangée de 28 px), retirée. Mesuré en profil jetable (Firefox 158), avec des favoris : barre de 31 px au lieu de 39, favoris collés en haut de la barre
  (0 px) et à 7 px du bas au lieu de 4 / 11, pilule toujours de 24 px, identique avec 1 ou 2 onglets et en mode compact.
- **Contour de focus bleu à l'INTÉRIEUR** (`outline-offset: -3px` sur `#urlbar[focused] > .urlbar-background`) : il ne déborde plus du champ ; mesuré, champ identique au repos et pris
  en focus (448,5 / 7 / 384,4 x 36).
- **Globe et « Actualiser »** (demandé) : le globe (`#identity-box`) est toujours à gauche du champ, à `inset-inline-start: 4px` (rond de 28 px, mesuré à 4,7 px du bord), comme « Actualiser » est à droite
  (`left: calc(var(--uc-ux) + var(--uc-uw) - 34px)`, rond à 4 px du bord) ; il n'est plus placé d'après le texte. Le texte seul est centré dans le champ : `#urlbar[uc-centre] .urlbar-input-box` a pour marges `calc(25px + var(--uc-ecart-texte)) calc(20px + var(--uc-ecart-texte))` avec
  `--uc-ecart-texte: 12px` (avec le globe seulement ; sans globe : marges de 12 et 40 px comme avant) et `padding-inline-end: 4px`. Le texte commence ainsi aussi loin du globe qu'il finit loin
  d'« Actualiser » (demandé le 2026-10-15) : 12,3 px / 12 px mesurés avec une adresse longue, texte court centré à 0,5 px du centre du champ. Un premier essai à 20 px (20,3 / 20) a été jugé
  « un peu trop d'espace » : pour changer, ne toucher qu'à la variable. Avant, le texte commençait à 13 px du bord, SOUS le globe (écart de -12,7 px contre 20 px côté « Actualiser »), et le
  domaine seul était 16 px trop à gauche. Le bouton des permissions (site qui en a, YouTube par exemple) était une pilule de 52 px (globe + icône de lecture automatique bloquée, marges de 8 px) : même rond de 28 px, les icônes de
  permission BLOQUÉE (`#blocked-permissions-container`) ne s'affichent plus à côté (elles restent dans le panneau au clic) ; les icônes de PARTAGE en cours (caméra, micro) restent visibles et élargissent la zone.
  Mesuré : 28 x 28, rayon 14 px, avec et sans permission, normal et compact.
- **Globe sur une page non sécurisée (http)** : Firefox (classe `notSecureText` sur `#identity-box`) lui donnait un fond CLAIR et affichait « Non sécurisé » (`#identity-icon-label`), coupé en « … » par
  la barre étroite. Fond transparent (survol 22 % de la couleur du texte), texte masqué ; la page non sécurisée est signalée par le bouclier à gauche du champ, qui passe en « ! » (règle `.insecure`).
  Reproduit avec `http://192.168.86.206:8766/` (serveur de test sur le réseau local), corrigé et revérifié sur capture.
- **Texte de l'adresse centré dans tous les états** (demandé le 2026-10-15 : d'abord la saisie d'un nouvel onglet, puis « si le site est assez court, toujours au centre, dans tous les modes ») : `#urlbar-input { text-align: center }` sans
  condition (repos, barre active, saisie, nouvel onglet, page interne, texte d'invite), en mode normal comme en compact ; trop long pour tenir, le texte remplit le champ et commence à gauche. Pour que le milieu du texte soit le milieu du champ
  il faut le même espace des deux côtés. Avec le globe (`uc-centre`) : marges calculées plus haut (« Globe et Actualiser »). Sans le globe (`#urlbar:not([uc-centre], [searchmode]) .urlbar-input-box`) : la zone du texte est en
  `position: absolute; inset: 0 40px`, donc centrée quoi que Firefox mette dans le flux à côté (icône de page interne de 77 px, bouton « Aller » de 28 px pendant la frappe, rien sur un nouvel onglet) ; le bouton « Aller » reçoit
  `margin-inline-start: auto` (sans cela, la zone n'étant plus dans le flux, il se collait à gauche) et l'icône de la page interne `z-index: 2` (elle reste cliquable). Pas en mode recherche (pastille du moteur dans le flux).
  Mesuré (champ de 384 px, profil jetable, normal et compact) : écart entre le milieu du texte et celui du champ = 0 px (0,5 px avec le globe) dans 10 états (page web au repos / active / saisie, page interne au repos / active / saisie,
  nouvel onglet au repos / actif / saisie) ; avant, texte décalé jusqu'à 24 px (page interne, repos) et alignée à gauche pendant la frappe sur une page web (et, centrée avec les anciennes marges de 12 / 40 px, 28 px à gauche du milieu à cause du bouton « Aller »). Le bouton « Aller »
  reste à 2 px du bord droit. Limite : un texte plus long que le champ (en compact, le texte d'invite de 280 px dans un champ de 220 px) est aligné à gauche, c'est voulu. L'attribut `uc-vierge`, essayé d'abord pour le seul nouvel onglet,
  a été retiré (code mort).
- **Nouvel onglet : favoris en fondu** (choisi le 2026-10-15 sur une vidéo, option A) : avec le réglage « barre de favoris seulement sur la page de nouvel onglet », ouvrir un onglet fait en même temps glisser la barre d'adresse
  et les onglets (passage au mode compact, 420 ms) ET ouvrir en hauteur la barre de favoris, le texte coupé en bas : effet « collapse ». Option A : la barre de favoris change de hauteur d'un coup et apparaît en fondu
  (`opacity` 260 ms, `#PersonalToolbar[collapsed] { opacity: 0 }`) ; à la disparition elle est repliée tout de suite (le fondu est alors invisible, la hauteur étant nulle). Écartées (même vidéo) : B, favoris
  glissant 400 ms après le reste, et C, tout d'un coup (barre d'adresse et onglets compris). Comparaison filmée en temps réel (`PrintWindow` de la fenêtre de test, ~120 images / s, fenêtre réduite à 1300 x 330).
- **Démarrage sans « squelette »** (signalé le 2026-10-15 : « l'animation de la tab » au premier lancement) : avant que l'interface soit prête, Firefox dessine une maquette de SA disposition (pastille d'onglet en haut à gauche,
  barre d'adresse dessous) enregistrée dans le registre (`HKCU\Software\Mozilla\Firefox\PreXULSkeletonUISettings`, `C:\Program Files\Mozilla Firefox\firefox.exe|Enabled = 1`), qui ne ressemble pas à cette personnalisation
  et dure ~0,5 s. `user.js` règle `browser.startup.preXulSkeletonUI` sur `false` ; prise en compte au lancement suivant celui qui lit cette ligne (la valeur du registre est mise à jour par Firefox, on n'y touche pas).
  Mesuré : aucune animation d'onglet ni de barre de favoris pendant les 3,5 premières secondes (seules les couleurs fondent à la première teinte d'une page web).
- **Croix de fermeture au survol de TOUS les onglets** (signalé le 2026-10-15, avec ~8 onglets de ~100 px) : quand les onglets font moins de 140 px (`browser.tabs.tabClipWidth`), Firefox pose `closebuttons="activetab"` sur
  `#tabbrowser-tabs` et masque (`display: none`, `tabs.css`) la croix de tous les onglets sauf l'actif, donc survoler un onglet inactif n'affichait rien. `userChrome.css` remet `display: flex !important` sur la croix des
  onglets non épinglés dans ce cas ; la règle « invisible hors survol » existante la garde cachée au repos. Les onglets épinglés gardent leur règle (pas de croix). Mesuré (14 onglets de 94 px, souris virtuelle) :
  onglet inactif survolé : croix affichée (24 px, à 4 px du bord gauche) ; onglet épinglé survolé : pas de croix. Piège de test : le réglage `tabClipWidth` n'est relu qu'à l'ouverture / la fermeture d'onglets, pas quand
  il change ; refaire le test avec une valeur par défaut et des onglets neufs.
- **Bouton « Mode compact » indépendant** (demandé le 2026-10-15 : il donnait l'impression d'être une copie du bouton de panneau latéral, dont il avait pris la place) : le bouton de panneau latéral n'était pas
  retiré de la barre, seulement masqué (`display: none`), et le script plaçait le bouton compact devant « Précédent » à chaque démarrage. Le script ne place le bouton compact que s'il n'a encore aucune place
  (première utilisation), en tête de `nav-bar` ; plus aucune règle ne masque le bouton de panneau latéral, il est dans la palette de « Personnaliser la barre d'outils » et on peut aussi le mettre à côté du
  bouton compact. Même position qu'avant : `#nav-bar-customization-target { padding-inline-start: 9px }` (Firefox met 8 px au lieu de 2 de remplissage à gauche du PREMIER bouton, donc 6 px de plus
  que quand le bouton compact était le deuxième) : symbole à 25 px du bord, « Précédent » à 51 px. Mesuré en profil jetable : bouton compact en tête, bouton latéral dans la palette,
  les deux ensemble possibles, bascule par clic, animations et mode Personnaliser inchangés. (Depuis le retrait de la disposition imposée par `user.js` le 2026-10-16 — ci-dessous —, un arrangement fait
  dans « Personnaliser » est désormais gardé au redémarrage.)
- **Choix d'épinglage conservés au redémarrage** (corrigé le 2026-10-16 : « quand je clique sur épingler pour la désactiver, elle disparaît et réapparaît au prochain démarrage ») : la ligne
  `browser.uiCustomization.state` de `user.js` ré-imposait un état GÉNÉRIQUE à chaque démarrage — les extensions absentes de sa liste « seen » y étaient replacées d'elles-mêmes dans la zone
  d'extensions, donc un « dépinglage » fait via l'icône de l'extension était annulé au redémarrage suivant, et de même tout arrangement de la barre (état enregistré du profil : le bouton uBlock posé
  en bout de barre du haut était perdu). La ligne est retirée : la disposition enregistrée par Firefox dans le profil (`prefs.js`) devient la source de vérité — boutons épinglés / dépinglés et leur
  emplacement sont gardés, et un arrangement fait dans « Personnaliser » est conservé au redémarrage. Sur un profil neuf, le script positionne une seule fois le bouton « Nouvel onglet » en bout de
  barre du haut (à droite, comme dans Safari) et le bouton compact en tête ; ensuite l'emplacement choisi par l'utilisateur est gardé. Limite profil neuf : le bouton de panneau latéral reste à sa place
  par défaut (il n'est plus forcé dans la palette ; le retirer via « Personnaliser » si besoin). Le centrage de l'adresse ne dépendait pas de la ligne (`userChrome.css` : position absolue + marges
  automatiques).
- **Bouton des téléchargements recouvert en mode compact** (signalé le 2026-10-16 : l'icône « cassée » pendant un téléchargement, cachée sinon) : le bouton est masqué tant que la liste de téléchargements est vide
  (`browser.download.autohideButton`, imposé par `user.js`) et apparaît à gauche du bouton d'extensions pendant un téléchargement. La bande d'onglets en superposition s'arrête à `right: calc(var(--uc-droite) + 9px)`, où
  `--uc-droite` était mesuré à partir du bouton d'extensions, du « + » et du menu seulement : le bout arrondi de la bande recouvrait le bouton (seule une moitié de l'anneau de progression restait visible). `mesurer()`
  (`urlbar-domaine.uc.js`) compte maintenant `downloads-button` et un `ResizeObserver` le remesure quand le bouton apparaît ou disparaît. Reproduit avec un faux fichier de 8 Mo servi lentement (`Downloads.createDownload`) :
  avant, bouton [1021-1057] sous la bande [514-1042], `--uc-droite` 234 px ; après, bande [478-1005], `--uc-droite` 271 px, anneau entier ; le téléchargement effacé, la bande revient à 1042. La bande saute de 37 px quand
  le bouton apparaît (pas d'animation). Le mode normal n'est pas concerné (la rangée d'onglets est sous la barre).
- **Les trois icônes de téléchargement au même diamètre** (demandé le 2026-10-16) : flèche (notre dessin), anneau de progression et coche de fin (dessins de Firefox) mesuraient 14,7 / 18,7 / 18,7 px (capture à 150 %,
  étendue des pixels différents du fond). La flèche passe à un cercle de rayon 8,3 dans un cadre de 18 (viewBox `-1 -1 18 18`, trait 1,4 = 1,25 px une fois ramené à 16 px) et `#downloads-indicator-progress-outer`,
  `-start-box` et `-finish-box` reçoivent `scale: 0.89`. Mesuré après : 16,0 / 16,0 / 16,0 px. Le test force l'animation de fin à la main (attributs `animate` + `notification="finish"` sur `#downloads-button`) : la fenêtre
  de test hors écran ne la déclenche pas.
  Même jour : anneau et coche étaient 0,7 px plus hauts que la flèche (centre mesuré, dy -1,0 contre -0,3) : `translate: 0 0.7px` sur les trois boîtes ; et leur bleu (`--toolbarbutton-icon-fill-attention`, turquoise
  chez Firefox) est réglé sur `#0a84ff`, le bleu de Safari utilisé partout ailleurs, sur `#downloads-button`.
- **Animations unifiées** (mesurées image par image le 2026-10-15, avec `requestAnimationFrame` dans le Firefox de test) : une seule courbe `--uc-courbe: cubic-bezier(0.4, 0, 0.2, 1)` et des durées communes
  (`--uc-duree` 260 ms pour tout ce qui glisse : ouverture / fermeture d'un onglet, rangée d'onglets, favoris ; `--uc-duree-teinte` 300 ms pour les couleurs), définies sur `:root` en tête de `userChrome.css`. Avant :
  ouverture d'onglet en `ease-out` de 220 ms (27 % de la largeur en 25 ms : départ brusque), fermeture quasi linéaire, favoris et rangée en `ease-out`. Le mode compact (420 ms, même courbe) n'a pas changé.
  **Teinte** : avant, la barre du haut (`#nav-bar`) et la bande d'onglets (`#tabbrowser-tabs`) changeaient de couleur d'un coup, la rangée d'onglets, les favoris et `#browser` fondaient sur 350 ms : 5 surfaces,
  2 moments. Maintenant les cinq fondent ensemble (début à ~25 ms, fin à ~255 ms). Le texte et les icônes (attribut `uc-clair`) ne changent qu'à 100 ms (la luminance franchit alors 128), pas à l'instant 0 où ils
  étaient foncés sur une barre encore sombre. L'attribut `uc-fond-clair`, posé tout de suite, commande le calcul du creux de la bande et du champ actif (`--uc-creux-pct`, `--uc-actif-pct`) : si ce calcul suivait
  `uc-clair` (retardé), la couleur d'arrivée de la bande changerait en cours de route et sa transition repartirait (arrêt de 40 ms mesuré, fin à 377 ms au lieu de 255 ms). Le délai de 500 ms avant d'appliquer une
  nouvelle couleur de page (`DELAI_TEINTE_MS`) est inchangé. Limite : mesure des VALEURS animées, pas de la fluidité réelle sur votre carte graphique (la fenêtre de test est hors écran).
- **Mode « Personnaliser la barre d'outils »** (corrigé le 2026-10-15) : Firefox pose l'attribut `customizing` sur la racine, chaque bouton est alors enveloppé dans un emplacement (`toolbarpaletteitem`) qu'on glisse-dépose.
  Les réglages de la feuille cassaient ce mode : la barre d'adresse (`#urlbar-container`) et « Actualiser » (`#stop-reload-button`) en `position: absolute` laissaient leurs emplacements vides ailleurs, en mode compact
  la bande d'onglets en superposition recouvrait les emplacements, « Actualiser » restait invisible (la page « Personnaliser » compte comme page vide) et la barre du haut est une zone de déplacement de la fenêtre. Maintenant, pendant
  ce mode seulement : barre d'adresse et « Actualiser » dans le flux (largeur `--uc-urlbar-width`), « Actualiser » visible, `-moz-window-dragging: no-drag` sur `#nav-bar`, `#TabsToolbar` et les emplacements, et la disposition compacte suspendue par `urlbar-domaine.uc.js` (un `MutationObserver` sur `customizing` ; la préférence reste vraie, le compact revient à la
  sortie, mesuré : barre d'adresse et bande d'onglets exactement aux mêmes positions qu'avant). Mesuré en profil jetable, en normal et en compact : 11 emplacements, aucun recouvert (`elementsFromPoint` au centre de chacun),
  rendu identique à celui de Firefox. La barre d'adresse y est vide (désactivée) et son fond est un voile noir de 30 % : on ne la voyait presque plus (signalé le 2026-10-15) ; elle est maintenant dessinée plus nettement
  (fond `rgba(255, 255, 255, 0.07)`, contour de 28 %) avec l'étiquette « Barre d'adresse » (`::before` de `.urlbar-input-container`), dans ce mode seulement (fond, contour et absence d'étiquette hors du mode vérifiés identiques).
  Piège de test : la peinture rayée rouge de Marionette sur `.urlbar-background` masquait le défaut ; l'annuler (`background-image: none`) dans la fenêtre de test. NON vérifié : un vrai glisser-déposer à la souris (Marionette ne déclenche pas la session de glisser de Windows) et l'effet réel de `no-drag` (la valeur calculée n'est pas lisible depuis le test).
- **Titre d'onglet estompé à tort** (signalé le 2026-10-15 : « Firefox » avec le « x » estompé dans une pastille très large) : Firefox estompe la fin du titre (`mask-image` sur
  `.tab-label-container[textoverflow]`, `tabs.css`) et pose / retire l'attribut `textoverflow` avec les événements `overflow` / `underflow` du conteneur (`tab.js`, `on_overflow` / `on_underflow`), donc seulement quand
  l'état change : un événement raté laisse l'attribut posé alors que le titre tient. `urlbar-domaine.uc.js` recalcule l'état réel (texte plus large que le conteneur de plus de 1 px) toutes les secondes et après
  chaque animation, changement d'onglet ou redimensionnement ; un vrai débordement garde son fondu, les onglets épinglés sont ignorés. NON reproduit spontanément (essais : ouverture / fermeture d'onglets, 132 titres,
  titre changé pendant l'animation d'ouverture, 200 largeurs de fenêtre, normal et compact : jamais de fondu à tort) : le correctif est vérifié sur un état périmé FORCÉ (attribut posé à la main sur deux onglets larges : retiré
  en moins de 1,6 s, les 6 titres réellement trop longs gardent leur fondu). Si le défaut revient, noter la page, le mode et ce qui précédait (ouverture, fermeture, changement de mode).
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
passent pas par la zone de déplacement de fenêtre de Windows. Un Firefox piloté par Marionette affiche aussi l'icône de télécommande
`#remote-control-box` (32 px, dans le flux, à gauche du champ d'adresse) qui décale le texte de la barre de 32 px par rapport à votre vrai Firefox : avant de mesurer
l'adresse, la masquer (`#remote-control-box { display: none !important }` injecté dans la fenêtre de test, pas dans le profil).

## Ce qui a été essayé puis retiré

- Grille « Favoris » sur la page « nouvel onglet » (marque-pages épinglés, dossiers via un faux lien intercepté).
- Boutons de fenêtre en ronds rouge / jaune / vert à gauche (refusés : retour aux boutons Windows à droite).
- Capsules de verre derrière les boutons de la barre latérale et de précédent / suivant (refusées).
- Boutons Partager et vue d'ensemble des onglets dans la barre du haut (refusés ; le script CustomizableUI est dans l'historique git).
- Mica de Windows 11 sur les barres : remplacé par un gris plein `#23282e` pour avoir exactement la même couleur partout.

## Licence

Code sous licence MIT — voir [LICENSE](LICENSE) (Copyright (c) 2026 hugom).
