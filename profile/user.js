// Loads chrome/userChrome.css and chrome/userContent.css (disabled by default since Firefox 69)
user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);

// Downloads button: hidden while the list is empty ("Hide button when list is empty"). This is Firefox's default, but Firefox
// switches it to false as soon as the button is moved with "Customize Toolbar". Enforced here at every start.
user_pref("browser.download.autohideButton", true);

// The toolbar layout is NOT enforced. Whatever Firefox saved in the profile (prefs.js) is kept, including the user's own
// arrangement. On a new profile, safari-theme.uc.js places the Compact mode button once (leftmost in the bar) and the New Tab
// button once (at the end, like Safari). The centring of the address text does not depend on the layout (userChrome.css:
// absolute position + auto margins).

// No startup "skeleton": before the interface is ready Firefox draws a mock-up of ITS layout (a tab pill at the top left, the
// address bar below it), stored in the registry (HKCU\Software\Mozilla\Firefox\PreXULSkeletonUISettings). It does not look like
// this theme (tabs below the address bar) and disappears after half a second. Takes effect on the start after the one that reads
// this line.
user_pref("browser.startup.preXulSkeletonUI", false);

// Settings the rendering depends on and that Firefox does not set by itself (without them a new profile does not look the same):
// the classic Firefox UI (the CSS targets that one), dark theme forced, dark toolbar.
user_pref("browser.nova.enabled", false);
user_pref("ui.systemUsesDarkTheme", 1);
user_pref("browser.theme.toolbar-theme", 0);

// Thumbnails in the card that appears when hovering a tab (Firefox shows title and address only without them).
user_pref("browser.tabs.hoverPreview.showThumbnails", true);
