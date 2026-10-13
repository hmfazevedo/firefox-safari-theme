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
user_pref("browser.uiCustomization.state", "{\"placements\":{\"widget-overflow-fixed-list\":[],\"unified-extensions-area\":[\"amptra_keepa_com-browser-action\",\"reddit-url-redirector_kichkoupi_com-browser-action\",\"firefoxdav_icloud_com-browser-action\",\"ublock0_raymondhill_net-browser-action\",\"_446900e4-71c2-419f-a6a7-df9c091e268b_-browser-action\",\"_4cf120ba-c67a-47a9-9c99-7ab813d08379_-browser-action\",\"invis-url_placeofinsanity-browser-action\"],\"nav-bar\":[\"sidebar-button\",\"back-button\",\"forward-button\",\"stop-reload-button\",\"customizableui-special-spring1\",\"vertical-spacer\",\"urlbar-container\",\"customizableui-special-spring2\",\"downloads-button\",\"reset-pbm-toolbar-button\",\"unified-extensions-button\",\"new-tab-button\"],\"toolbar-menubar\":[\"menubar-items\"],\"TabsToolbar\":[\"tabbrowser-tabs\",\"smartwindow-group-tabs-button\",\"ai-window-toggle\"],\"vertical-tabs\":[],\"PersonalToolbar\":[\"personal-bookmarks\"]},\"seen\":[\"reset-pbm-toolbar-button\",\"amptra_keepa_com-browser-action\",\"reddit-url-redirector_kichkoupi_com-browser-action\",\"firefoxdav_icloud_com-browser-action\",\"ublock0_raymondhill_net-browser-action\",\"_446900e4-71c2-419f-a6a7-df9c091e268b_-browser-action\",\"_4cf120ba-c67a-47a9-9c99-7ab813d08379_-browser-action\",\"screenshot-button\",\"developer-button\",\"invis-url_placeofinsanity-browser-action\"],\"dirtyAreaCache\":[\"unified-extensions-area\",\"nav-bar\",\"toolbar-menubar\",\"TabsToolbar\",\"vertical-tabs\",\"PersonalToolbar\"],\"currentVersion\":26,\"newElementCount\":11}");
// Page « nouvel onglet » : pas de raccourcis (état d'origine de ce profil : feeds.topsites = false). La grille « Favoris »
// a été essayée puis retirée à la demande de l'utilisateur ; la préférence est remise à false (elle avait été passée à
// true) et les épingles posées par l'ancien script sont vidées. Imposé à chaque démarrage.
user_pref("browser.newtabpage.activity-stream.feeds.topsites", false);
user_pref("browser.newtabpage.pinned", "[]");
