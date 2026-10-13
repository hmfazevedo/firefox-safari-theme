// config.js : chargeur minimal d'UN script d'interface (Firefox AutoConfig).
// Ce fichier s'exécute avec les droits de Firefox au démarrage : il ne charge que le script
// ci-dessous, situé dans le dossier du profil, et uniquement dans les fenêtres du navigateur.
// Pour tout désactiver : supprimer ce fichier et defaults\pref\config-prefs.js.
try {
  const Ci = Components.interfaces;
  const SCRIPT = "urlbar-domaine.uc.js"; // dans <profil>\chrome\
  const MANIFESTE = "urlbar-domaine.manifest"; // idem : « content urlbar-domaine ./ »

  // Firefox ne charge pas un fichier du disque directement (« untrusted URI ») : on déclare le
  // dossier chrome du profil comme source chrome://urlbar-domaine/content/ via un manifeste.
  const dossier = Services.dirsvc.get("ProfD", Ci.nsIFile);
  dossier.append("chrome");
  const manifeste = dossier.clone();
  manifeste.append(MANIFESTE);
  if (manifeste.exists()) {
    Components.manager
      .QueryInterface(Ci.nsIComponentRegistrar)
      .autoRegister(manifeste);
  }

  Services.obs.addObserver(function (fenetre) {
    try {
      if (fenetre.location.href !== "chrome://browser/content/browser.xhtml") {
        return;
      }
      Services.scriptloader.loadSubScriptWithOptions(
        "chrome://urlbar-domaine/content/" + SCRIPT,
        { target: fenetre, ignoreCache: true }
      );
    } catch (e) {
      Components.utils.reportError(e);
    }
  }, "browser-delayed-startup-finished");
} catch (e) {
  Components.utils.reportError(e);
}
