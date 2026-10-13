import sys, io, re
p, dst = sys.argv[1], sys.argv[2]
real = io.open(p + '/user.js', encoding='utf-8').read()
prefs = io.open(p + '/prefs.js', encoding='utf-8').read().splitlines()
keep = [l for l in prefs if re.search(r'widget\.windows\.mica|ui\.systemUsesDarkTheme|browser\.nova\.enabled|browser\.theme\.toolbar-theme|extensions\.activeThemeID"', l)]
extra = ['user_pref("browser.profiles.enabled", false);', 'user_pref("browser.shell.checkDefaultBrowser", false);', 'user_pref("datareporting.policy.dataSubmissionEnabled", false);', 'user_pref("browser.aboutwelcome.enabled", false);', 'user_pref("browser.startup.upgradeDialog.enabled", false);', 'user_pref("trailhead.firstrun.didSeeAboutWelcome", true);', 'user_pref("browser.shell.didSkipDefaultBrowserCheckOnFirstRun", true);', 'user_pref("browser.urlbar.suggest.quicksuggest.all", false);']
io.open(dst + '/user.js', 'w', encoding='utf-8', newline='\n').write(real.rstrip('\n') + '\n' + '\n'.join(keep + extra) + '\n')
