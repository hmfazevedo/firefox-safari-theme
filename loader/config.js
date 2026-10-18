// config.js: minimal loader of ONE interface script (Firefox AutoConfig).
// This file runs with Firefox's privileges at startup: it only loads the script below, located in the profile folder, and only in
// browser windows. To disable everything: delete this file and defaults\pref\config-prefs.js.
try {
  const Ci = Components.interfaces;
  const SCRIPT = "safari-theme.uc.js"; // in <profile>\chrome\
  const MANIFEST = "safari-theme.manifest"; // same: "content safari-theme ./"

  // Firefox does not load a file from disk directly ("untrusted URI"): the profile's chrome folder is declared as the source
  // chrome://safari-theme/content/ through a manifest.
  const folder = Services.dirsvc.get("ProfD", Ci.nsIFile);
  folder.append("chrome");
  const manifest = folder.clone();
  manifest.append(MANIFEST);
  if (manifest.exists()) {
    Components.manager
      .QueryInterface(Ci.nsIComponentRegistrar)
      .autoRegister(manifest);
  }

  Services.obs.addObserver(function (win) {
    try {
      if (win.location.href !== "chrome://browser/content/browser.xhtml") {
        return;
      }
      Services.scriptloader.loadSubScriptWithOptions(
        "chrome://safari-theme/content/" + SCRIPT,
        { target: win, ignoreCache: true }
      );
    } catch (e) {
      Components.utils.reportError(e);
    }
  }, "browser-delayed-startup-finished");
} catch (e) {
  Components.utils.reportError(e);
}
