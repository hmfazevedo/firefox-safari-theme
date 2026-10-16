// Charge chrome/userChrome.css (désactivé par défaut depuis Firefox 69)
user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);
// Bouton des téléchargements : masqué tant que la liste est vide (réglage « Masquer le bouton lorsque la liste
// est vide »). C'est la valeur par défaut de Firefox, mais il la passe à false dès qu'on déplace le bouton avec
// « Personnaliser la barre d'outils ». Imposé ici à chaque démarrage.
user_pref("browser.download.autohideButton", true);
// Disposition des barres d'outils : NON imposée (retrait du 2026-10-16). Une ligne « browser.uiCustomization.state »
// ré-imposait un état à chaque démarrage : les extensions absentes de sa liste « seen » y étaient replacées
// d'elles-mêmes dans la zone d'extensions, donc un « dépinglage » fait via l'icône de l'extension — et tout
// arrangement de la barre — était annulé au redémarrage suivant. La disposition enregistrée par Firefox dans le
// profil (prefs.js) est maintenant la source de vérité : les boutons épinglés / dépinglés et leur emplacement
// sont gardés. Sur un profil neuf, le script (urlbar-domaine.uc.js) positionne une seule fois le bouton compact
// (en tête de la barre) et le bouton « Nouvel onglet » (en bout, comme dans Safari) ; le centrage de l'adresse
// ne dépend pas de la disposition (userChrome.css : position absolue + marges automatiques).
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
