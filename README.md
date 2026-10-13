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
- Mica de Windows 11 sur les barres : remplacé par un gris plein `#23282e` pour avoir exactement la même couleur partout.
