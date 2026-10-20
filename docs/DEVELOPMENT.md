# Development notes

Measured on **Firefox 158, Windows 11, dark mode, 150 % scaling**. Names below refer to this repository's files.

## How the pieces fit

| File | Role |
|---|---|
| `profile/chrome/userChrome.css` | styles the browser interface (bars, tabs, address bar, panels, icons...) |
| `profile/chrome/userContent.css` | New Tab / home page, thin scrollbars, focus ring on web pages |
| `profile/chrome/safari-theme.uc.js` + `.manifest` | interface script: domain-only address, centring, tint, compact mode, New Tab button, localised strings |
| `profile/chrome/tint-child.sys.mjs` / `tint-parent.sys.mjs` | window actors: measure the page colour (page side) and hand it to the interface (parent side) |
| `profile/user.js` | preferences applied at every start |
| `loader/config.js` + `loader/defaults/pref/config-prefs.js` | AutoConfig loader, placed in Firefox's installation folder |
| `install.ps1` / `sync-from-profile.ps1` | install into a profile; copy a live profile back into the repository |
| `test-tools/` | throwaway-profile testing (see the end of this file) |

The loader registers `safari-theme.manifest` (`content safari-theme ./`) so that the profile's `chrome` folder becomes
`chrome://safari-theme/content/`, then loads `safari-theme.uc.js` into every `browser.xhtml` window.

## Updates and compatibility

- Profile files are never touched by a Firefox update. The loader lives in the installation folder and normally survives an
  update, but this is not guaranteed; if it disappears the CSS keeps working and the script stops.
- The real risk is Firefox renaming or restructuring an element the CSS targets: the element then simply looks stock. Most
  exposed: the address bar and its dropdown (`.urlbar-background`, `.urlbarView-background`), panels (`--panel-*`), the sidebar,
  the New Tab page (`activity-stream`), the find bar. Tabs, bookmarks and icons are more stable.

## Pitfalls

- `userChrome.css` is a *user* sheet: `!important` is needed to beat Firefox's own CSS.
- A `data:` image does not get `context-fill`: SVG icons have their colour written inside (`%23fbfbfe`).
- `display: none` or `visibility: hidden` on the bookmark star stops the "Add bookmark" panel from opening (Ctrl+D): make it
  transparent (`opacity: 0`) instead.
- A `transform` on `#urlbar-container` breaks the anchoring of the address dropdown: centre with auto margins.
- The whole top bar is a window drag area (`-moz-window-dragging: drag`): a button placed outside the address field (the
  former shield did) needs `no-drag`, otherwise a real click does nothing.
- `.browserContainer` is a grid: an `position: absolute` child (the find bar) lands in an implicit row without `grid-area: 1 / 1`.
- Check the real selector before claiming an element is hidden (`findbar`, `.searchmode-switcher`... may lack an id).
- The New Tab page remembers its last render: after a change, press F5 or restart completely.
- When replacing a CSS block by cutting between two markers, compare the list of selectors before and after.
- An actor must declare `safeForUntrustedWebProcess: true` at the root of its options, otherwise `getActor` answers
  "doesn't match remote type". `browser.ownerGlobal` can be `undefined`: use `ownerDocument.defaultView`.
- `closebuttons="activetab"` on `#tabbrowser-tabs` (tabs narrower than `browser.tabs.tabClipWidth`) hides the close button of
  every tab but the active one; the CSS puts it back, and the "invisible unless hovered" rule keeps it hidden at rest. The pref is
  only re-read when tabs open or close.

## Design decisions

### Tinted bars (Safari 26 style)

`tint-child.sys.mjs` ports behaviour of WebKit's code (main branch, read on 2026-10-14):
`LocalFrameView::fixedContainerEdges` (top edge: a fixed or sticky element touched at the middle of the edge, 4 px below it;
at least 90 % of the window width; box over 10 px; opacity, empty boxes and `backdrop-filter` discarded; a plain background is
blended with the page background if its alpha is under 0.75, otherwise made opaque; without a plain background, 29 pixels are
sampled and 20 must match; frozen after the first scroll), `documentBackgroundColor` (page background = `<html>` then `<body>`
over white, background images ignored) and `WKWebView._updateFixedColorExtensionViews` (top-edge colour, otherwise the page
background). `theme-color` is not used.

`safari-theme.uc.js` publishes the colour as `--uc-tint`; `userChrome.css` applies it to the bars, the tab strip hollow and the
address field (`--uc-hollow`: 76 % of the bar + 24 % black, matching the #1b1f22 measured on Safari). A light bar is decided by
Rec. 709 luma > 127.5 (rule described by andesco/safari-color-tinting, not read in WebKit): attribute `uc-light`
(`color-scheme: light` on the bars, inverted icons, dark tab text).

**300 ms delay** (`TINT_DELAY_MS`): a loading page often goes through the default white before turning dark. A new colour is
applied only after 300 ms without another measure, so the pending colour is replaced and the bar does not flash white. Tab
switches stay immediate. A page that stays white longer than the delay still flashes: raise the value.

Not verifiable (Safari's code is closed): how Safari picks its bar colour from the top edge and the page background, what it
does with a white page, the exact look of the tab strip and active tab. Third-party value: the "almost transparent" threshold
(0.1). Not ported: `::backdrop`, colour filters, `pointer-events` (WebKit ignores them only on the first attempt;
`elementsFromPoint` respects them).

Scrollbars: thin and translucent everywhere (`userContent.css`). The *page's* scrollbar follows its background like WebKit
(`recalculateScrollbarOverlayStyle`): HSL lightness `(max + min) / 2` of 0.5 or less gives a light thumb, otherwise a dark one.
`tint-child.sys.mjs` loads a per-page user sheet for it (`windowUtils.loadSheetUsingURIString`, a `:root` rule that beats the
`*` rule of `userContent.css`). A page declaring `color-scheme: dark` without a background counts as dark (`#1c1b22`).

### Compact mode

Tabs and address field on one row: [Options button, back, forward] [address] [tabs] [right-hand buttons]. The preference
`extensions.uc.compact` is observed by every window. The script creates the Options button (`CustomizableUI.createWidget`, a custom `toolbarbutton` of type `menu` whose first item is the "Compact mode" checkbox; placed
leftmost only if it has no placement yet), sets `uc-compact`, `uc-multi` (two tabs or more; with one tab nothing changes) and
measures `--uc-left` / `--uc-right`. The CSS overlays the tab row on the navigation bar (`position: absolute`, 40 px box), only
with horizontal tabs.

- Address field: `left = --uc-left + 15px`, width `clamp(220px, 22vw, 380px)`.
- Tab strip: `left: calc(var(--uc-ux) + var(--uc-uw) + 25px)`, `right: calc(var(--uc-right) + 9px)`.
- Normal <-> compact is animated over 0.42 s with `cubic-bezier(0.4, 0, 0.2, 1)`: the field slides and shrinks (`--uc-ux` /
  `--uc-uw`, registered with `@property`, transitions only under `uc-anim`, set AFTER the change in the same task and only if the
  layout changes). The bar height is animated with `element.animate` only for the button toggle. Tabs are counted synchronously on
  `TabOpen` / `TabClose`. No animation during the first 3 seconds of a window.
- Customize mode suspends the compact layout (the overlaid strip would cover the slots being dragged); the preference stays true.
- `measure()` counts every button of the right half of the buttons area (downloads, private-browsing flame, account button,
  extensions...) and a `ResizeObserver` re-measures when one appears or disappears.

### Heights, spacing, alignment

- `--urlbar-height: 36px !important`: the address field has the tab strip's height in both modes; the top bar is 50 px.
- Normal mode: no top padding on `#TabsToolbar`, `--uc-bar-bottom` (7 px) below it. Compact: 2 px top and bottom, centred.
- Bookmarks bar: no top margin, `--uc-bar-bottom` below, no margin around bookmarks, same height with one tab or many.
- Globe (`#identity-box`) is always at the left of the field (`inset-inline-start: 4px`, 28 px circle), Reload at the right.
  The address text is centred in every state (`#urlbar-input { text-align: center }`); with the globe, margins are
  `calc(25px + var(--uc-text-gap)) calc(20px + var(--uc-text-gap))` with `--uc-text-gap: 12px`. Without the globe the text area is
  `position: absolute; inset: 0 40px`. A text longer than the field is left-aligned on purpose.
- Insecure (http) pages: the globe keeps a transparent background and no "Not secure" label.
- The three downloads icons (arrow, progress ring, done check) share a 16 px diameter; the Firefox ones get `scale: 0.89` and
  `translate: 0 0.7px`; the accent colour is `#0a84ff`.
- Window buttons are round (30 px, thin SVG glyphs in `::before`; the Windows symbol is a font), red hover for close.
- Corners: 22 px on panels, the address dropdown and the find bar; 12 px on context menus.
- Page dialogs hang from the top like Safari sheets (`.content-prompt-dialog > .dialogOverlay { align-content: start }`).
- Blue focus ring is drawn *inside* the address field (`outline-offset: -3px`); on web pages it is
  `:focus-visible { outline: 3px solid rgba(10, 132, 255, 0.5) }` WITHOUT `!important`, so a site's own outline wins.

### Private windows

`:root[privatebrowsingmode]` has fixed `#161618` bars and no page tint. The "Private Browsing" mention is always visible, as the
`::before` of `#reset-pbm-toolbar-button` (the flame), with Firefox's mask icon; Firefox's native indicator is hidden. The string
is localised through `--uc-label-private`.

### Animations

One curve `--uc-easing: cubic-bezier(0.4, 0, 0.2, 1)` and two durations on `:root` (`--uc-duration` 260 ms for everything that
slides, `--uc-duration-tint` 300 ms for colours). The five tinted surfaces fade together. Text and icons switch at 100 ms
(`uc-light`, when luminance crosses 128); `uc-light-bg` is set immediately so the hollow's destination colour never changes
mid-transition. New Tab: the bookmarks bar changes height at once and fades in (`#PersonalToolbar[collapsed] { opacity: 0 }`).
Values were measured per frame with `requestAnimationFrame`; real smoothness on your GPU is not measured.

### Other

- No startup skeleton (`browser.startup.preXulSkeletonUI=false`): Firefox's mock-up of its own layout flashes for ~0.5 s.
- A stale `textoverflow` attribute can fade a tab title that fits; the script recomputes the real state every second and after
  animations, tab changes and resizes.
- Measured and deliberately left alone (Firefox 158): the two safety-net timers cost about 0.0003 ms (centring, every 400 ms)
  and 0.05 ms with 40 tabs (title fade, every second) per tick; writing an attribute or a custom property again with the same
  value restyles nothing (`windowUtils.restyleGeneration` stays put), so caching in `measure()` / `updateCentering()` would gain
  nothing. In `tint-child.sys.mjs`, `load` and `scroll` are captured, so sub-resource loads and inner-scroller scrolls also re-arm
  the measure timers (a few `clearTimeout` / `setTimeout` calls each, not profiled). Filtering them to the document would change when pages are re-measured, so it was
  not done.
- Customize mode: the address bar and Reload are put back in the flow, drag is disabled, the address field gets an "Address bar"
  label and a stronger outline, so the slots can be dragged.
- The New Tab page: dark gradient background (a CSS gradient: the page's CSP only allows https:, data: and blob: images), no
  search field, weather, widgets, shortcuts or "Customize" button; logo near the top.

### Tried and removed

A "Favourites" grid on the New Tab page; red / yellow / green window buttons on the left; glass capsules behind the sidebar and
back / forward buttons; Share and tab-overview buttons in the top bar; Windows 11 Mica on the bars (replaced by plain `#23282e`).

## Testing without touching your profile

`test-tools/` holds what was used to measure everything:

- `mkprofile.py <real profile> <throwaway folder>`: creates a test profile with your `user.js` (not a whole `prefs.js`: a
  copied one carries its `storeID` and registers the copy in your profile group). Then copy `profile\chrome\*` to
  `<throwaway folder>\chrome\`.
- Start the test Firefox: `firefox.exe -no-remote -marionette -remote-allow-system-access -profile <throwaway folder> <url>`. The first
  launch often fails; retry. To test the loader without administrator rights, copy Firefox's installation folder (~250 MB),
  install `loader\*` into the copy, and run the copy.
- `offscreen.ps1`: moves the test window off screen. `shotall.ps1 -Prefix name`: screenshots every window of the test profile
  (main window plus panels and menus, which are separate windows).
- `marionette.py`: small client to measure (`m.run("return ...")` in the chrome context) and simulate mouse / clicks.
- Stop the test with `taskkill /PID <pid> /T /F` on the throwaway profile's processes only, then delete the folder.

Known limits: with Marionette (or an isolated profile) the real New Tab page stays empty; an off-screen window is "inactive"; simulated
clicks do not go through Windows' drag area; a Marionette-driven Firefox shows the remote-control icon (`#remote-control-box`, 32 px)
which shifts the address text by 32 px, so hide it (`display: none !important`, injected in the test window only) before measuring.
