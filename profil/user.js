// Charge chrome/userChrome.css (désactivé par défaut depuis Firefox 69)
user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);
// Bouton des téléchargements : masqué tant que la liste est vide (réglage « Masquer le bouton lorsque la liste
// est vide »). C'est la valeur par défaut de Firefox, mais il la passe à false dès qu'on déplace le bouton avec
// « Personnaliser la barre d'outils ». Imposé ici à chaque démarrage.
user_pref("browser.download.autohideButton", true);
// Disposition des barres d'outils : le bouton « Nouvel onglet » passe de la rangée d'onglets à la barre du haut
// (à droite, comme dans Safari). Firefox relit cette ligne à chaque démarrage : une personnalisation
// faite ensuite via « Personnaliser la barre d'outils » est annulée au redémarrage suivant. Pour
// garder la main : supprimer cette ligne après un premier redémarrage (Firefox aura enregistré la disposition).
// État GÉNÉRIQUE (partageable) : la zone d'extensions est vide et « seen » ne liste que des widgets standards —
// les extensions de chacun apparaissent d'elles-mêmes (Firefox y ajoute automatiquement les widgets absents
// de « seen »). « newElementCount » : compteur qui génère les identifiants des springs
// (« customizableui-special-springN ») ; à conserver >= 2 (la barre contient spring1 et spring2),
// sinon un nouveau spring pourrait reprendre un identifiant déjà posé.
user_pref("browser.uiCustomization.state", "{\"placements\":{\"widget-overflow-fixed-list\":[],\"unified-extensions-area\":[],\"nav-bar\":[\"uc-compact-button\",\"back-button\",\"forward-button\",\"stop-reload-button\",\"customizableui-special-spring1\",\"vertical-spacer\",\"urlbar-container\",\"customizableui-special-spring2\",\"downloads-button\",\"reset-pbm-toolbar-button\",\"unified-extensions-button\",\"new-tab-button\"],\"toolbar-menubar\":[\"menubar-items\"],\"TabsToolbar\":[\"tabbrowser-tabs\",\"smartwindow-group-tabs-button\",\"ai-window-toggle\"],\"vertical-tabs\":[],\"PersonalToolbar\":[\"personal-bookmarks\"]},\"seen\":[\"sidebar-button\",\"uc-compact-button\",\"reset-pbm-toolbar-button\",\"screenshot-button\",\"developer-button\"],\"dirtyAreaCache\":[\"unified-extensions-area\",\"nav-bar\",\"toolbar-menubar\",\"TabsToolbar\",\"vertical-tabs\",\"PersonalToolbar\"],\"currentVersion\":26,\"newElementCount\":11}");
// Page « nouvel onglet » : pas de raccourcis (état d'origine de ce profil : feeds.topsites = false). La grille « Favoris »
// a été essayée puis retirée à la demande de l'utilisateur ; la préférence est remise à false (elle avait été passée à
// true) et les épingles posées par l'ancien script sont vidées. Imposé à chaque démarrage.
user_pref("browser.newtabpage.activity-stream.feeds.topsites", false);
user_pref("browser.newtabpage.pinned", "[]");
// Pas de « squelette » au démarrage : avant que l'interface soit prête, Firefox dessine une maquette de SA disposition (une pastille d'onglet en haut à
// gauche, la barre d'adresse en dessous) enregistrée dans le registre (HKCU\Software\Mozilla\Firefox\PreXULSkeletonUISettings). Elle ne ressemble pas à
// cette personnalisation (onglets sous la barre d'adresse) et s'efface au bout d'une demi-seconde : signalé le 2026-10-15 (« l'animation de la tab »
// au premier lancement). Prise en compte au lancement suivant celui qui lit cette ligne.
user_pref("browser.startup.preXulSkeletonUI", false);
// Réglages dont dépend le rendu et que Firefox ne pose pas tout seul (sans eux, un profil neuf n'a pas le même aspect) :
// ancienne présentation de Firefox (le CSS cible celle-là), thème sombre forcé, barre d'outils sombre.
user_pref("browser.nova.enabled", false);
user_pref("ui.systemUsesDarkTheme", 1);
user_pref("browser.theme.toolbar-theme", 0);
