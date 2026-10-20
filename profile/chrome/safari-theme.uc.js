// safari-theme.uc.js: interface script of the "Firefox, Safari style" theme.
//
// Loaded by config.js (AutoConfig, in Firefox's installation folder) into every browser window. Sections:
//  1. Address bar: only the domain is shown when the bar is not in use (like Safari: "mail.google.com" instead of the full address).
//     The real address stays behind: a click in the bar, Ctrl+L or F6 shows the full address again, and copy, reload or bookmarking
//     always use the whole address. It relies on Firefox's native mechanism that shortens the address (removal of "http://", see
//     UrlbarInput.setValue): the reduction to the domain is added on top, reusing its _protocolIsTrimmed / _untrimmedValue flags so
//     that restoring the full address on focus stays Firefox's own.
//  2. Sidebar splitter handle.  3. Page tint.  4. Localised strings.  5. Compact mode.  6. New Tab button.  7. Tab-title fade fix.
(() => {
  const bar = window.gURLBar;
  if (!bar || bar.__domainOnly) {
    return;
  }
  bar.__domainOnly = true;

  // Web addresses only: internal pages (about:, file:, extensions) keep their text.
  const isWeb = (val) => typeof val === "string" && /^https?:\/\/[^/?#\s]+/i.test(val);

  // Centring of the "globe + text" group: active (attribute uc-centered) when the bar shows a site's address (uc-web) and nobody is
  // typing (usertyping): at rest (bare domain) AND with the active bar (full address selected). The globe is stuck to the left of the
  // field by the CSS; while typing, the text stays left-aligned (otherwise it would move at every letter).
  const updateCentering = () => {
    try {
      if (!bar.hasAttribute("uc-web") || bar.hasAttribute("usertyping") || !bar.inputField.value) {
        bar.removeAttribute("uc-centered");
        return;
      }
      bar.setAttribute("uc-centered", "");
    } catch (e) {
      console.error("safari-theme (updateCentering):", e);
    }
  };

  const nativeSetValue = bar.setValue;
  bar.setValue = function (val, options) {
    const result = nativeSetValue.call(this, val, options);
    try {
      // uc-web: the bar shows a site's address (shortened OR full, selected on focus). Used for the globe of the active bar, as at rest
      // (bare domain).
      this.toggleAttribute("uc-web", isWeb(val));
      // allowTrim = the "at rest" display requested by Firefox; not when typing or editing.
      if (options && options.allowTrim && !this.focused && isWeb(val)) {
        const domain = new URL(val).host.replace(/^www\./i, "");
        if (domain) {
          this._protocolIsTrimmed = true; // so that focusing restores the full address
          this.inputField.value = domain;
          this.formatValue();
          updateCentering();
          return domain;
        }
      }
      updateCentering();
    } catch (e) {
      console.error("safari-theme:", e);
    }
    return result;
  };

  // Restores the "domain" display when the bar is at rest and still shows something else (page already open when the script loads;
  // Escape then a click elsewhere, which Firefox only shows shortened, with the path).
  const refresh = () => {
    try {
      bar.toggleAttribute("uc-web", isWeb(bar.untrimmedValue));
      if (!bar.focused && !bar.valueIsTyped && isWeb(bar.untrimmedValue)) {
        const domain = new URL(bar.untrimmedValue).host.replace(/^www\./i, "");
        if (bar.value !== domain) {
          bar.value = bar.untrimmedValue;
        }
      }
    } catch (e) {
      console.error("safari-theme (refresh):", e);
    }
  };
  // After Firefox's blur handler (setTimeout 0), not before.
  bar.inputField.addEventListener("blur", () => setTimeout(refresh, 0));
  refresh();

  // Safety net: Firefox sometimes changes the field text without going through setValue (tab switch, redirect, restore) and the window
  // can be resized. The centring state is therefore re-checked; almost free (two attribute reads).
  const sync = updateCentering;
  new ResizeObserver(sync).observe(bar);
  setInterval(sync, 400);
  // Immediate reaction to focus / typing: Firefox changes the text (full address) and the attributes a moment after the event, hence the
  // staggered passes; the interval above is only the net.
  new MutationObserver(sync).observe(bar, { attributes: true, attributeFilter: ["focused", "usertyping", "uc-web"] });
  for (const evt of ["focus", "input"]) {
    bar.inputField.addEventListener(evt, () => {
      for (const ms of [0, 60, 200]) {
        setTimeout(sync, ms);
      }
    });
  }
  sync();
})();

// ---- Collapsed sidebar: remove the small white handle under the tab card ----
// The #sidebar-tools-and-extensions-splitter separator (32 x 2 px handle, drawn with gradients) is in the inner (shadow) DOM of
// <sidebar-main>: the profile's CSS cannot reach it. A style sheet is added there, with a few retries if the element is not ready when
// the window loads. The separator keeps its role (resizing between tabs and tools): only its drawing disappears.
(() => {
  const apply = () => {
    const root = document.querySelector("sidebar-main")?.shadowRoot;
    if (!root) {
      return false;
    }
    if (!root.getElementById("uc-handle")) {
      const sheet = document.createElementNS("http://www.w3.org/1999/xhtml", "style");
      sheet.id = "uc-handle";
      sheet.textContent = "#sidebar-tools-and-extensions-splitter { background-image: none !important; }";
      root.appendChild(sheet);
    }
    return true;
  };
  try {
    if (!apply()) {
      for (const ms of [300, 1000, 3000, 8000]) {
        setTimeout(() => {
          try {
            apply();
          } catch (e) {
            console.error("sidebar handle:", e);
          }
        }, ms);
      }
    }
  } catch (e) {
    console.error("sidebar handle (init):", e);
  }
})();

// ---- Toolbar tinted like Safari 26 ----
// The colour is measured on the page side (tint-child.sys.mjs: fixed element at the top, otherwise <body> / <html> background,
// otherwise white; the theme-color meta tag is ignored, as in Safari 26). Here: it is stored per tab, published in --uc-tint (userChrome.css
// uses it for the bars, the tab row and the address field) and the uc-light attribute is set when the bar is LIGHT: Safari uses dark
// text if the Rec. 709 luma (0.2126 R + 0.7152 G + 0.0722 B, on 0 to 255) exceeds 127.5, light text otherwise. Internal pages (about:,
// extensions): neutral grey.
// DELAY: a loading page often goes through white (default background) before turning dark, and the bar used to follow that white. A new
// colour is therefore only applied after TINT_DELAY_MS without another measure: if the page changes colour in the meantime the pending
// colour is replaced and the bar never goes through the first one. A tab switch stays immediate (colour already known). A page that
// stays white longer than this delay still makes the bar go through white: raise the value.
(() => {
  try {
    const root = document.documentElement;
    const isPrivateWindow = !!(window.PrivateBrowsingUtils && window.PrivateBrowsingUtils.isWindowPrivate(window));
    if (!Services.__ucTintActor) {
      Services.__ucTintActor = true;
      try {
        ChromeUtils.registerWindowActor("UcTint", {
          parent: { esModuleURI: "chrome://safari-theme/content/tint-parent.sys.mjs" },
          child: {
            esModuleURI: "chrome://safari-theme/content/tint-child.sys.mjs",
            events: {
              DOMContentLoaded: {},
              pageshow: {},
              load: { capture: true },
              scroll: { capture: true, passive: true },
            },
          },
          allFrames: false,
          matches: ["http://*/*", "https://*/*"],
          // Without this Firefox refuses the actor in a web content process ("doesn't match remote type"): the actor only reads background
          // colours and accepts no order from a page.
          safeForUntrustedWebProcess: true,
        });
      } catch (e) {
        console.error("tint: registering the actor", e);
      }
    }
    if (isPrivateWindow) {
      return; // private window: fixed black bars (userChrome.css), no page tint
    }
    const TINT_DELAY_MS = 300;
    let timer = null;
    let appliedKey = "";
    const cancel = () => {
      clearTimeout(timer);
      timer = null;
    };
    // Text and icons switch from light to dark (uc-light attribute) when the background colour crosses the middle of its transition
    // (100 ms out of 300: the luminance crosses 128 there): at instant 0 they would be dark on a bar that is still dark.
    let lightTimer = null;
    const setLight = (light) => {
      root.toggleAttribute("uc-light-bg", light); // the background (strip hollow, active field) aims at its final colour at once: otherwise its transition would restart halfway
      clearTimeout(lightTimer);
      if (light === root.hasAttribute("uc-light")) {
        return;
      }
      lightTimer = setTimeout(() => root.toggleAttribute("uc-light", light), 100);
    };
    const apply = (c) => {
      cancel();
      appliedKey = c ? c.join(",") : "";
      if (!c) {
        root.style.removeProperty("--uc-tint");
        setLight(false);
        return;
      }
      root.style.setProperty("--uc-tint", `rgb(${c[0]} ${c[1]} ${c[2]})`);
      const luma = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      setLight(luma > 127.5);
    };
    const isWeb = (browser) => /^https?:/i.test(browser.currentURI?.spec || "");
    // Asks the page for a measure (useful when this tab's colour is not known yet: page already loaded before the actor
    // was registered, tab restored in the background).
    const requestMeasure = (browser) => {
      try {
        if (isWeb(browser)) {
          browser.browsingContext?.currentWindowGlobal?.getActor("UcTint").sendAsyncMessage("UcTint:Measure");
        }
      } catch (e) {
        // no actor for this page yet
      }
    };
    window.ucTintReceived = (browser, c) => {
      browser._ucTint = c;
      if (browser !== gBrowser.selectedBrowser) {
        return;
      }
      // Each measure replaces the pending colour; going back to the colour already displayed cancels the wait.
      cancel();
      if ((c ? c.join(",") : "") === appliedKey) {
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        if (browser === gBrowser.selectedBrowser) {
          apply(browser._ucTint || null);
        }
      }, TINT_DELAY_MS);
    };
    const onTabSelect = () => {
      const b = gBrowser.selectedBrowser;
      if (!isWeb(b)) {
        apply(null);
        return;
      }
      apply(b._ucTint || null);
      if (!b._ucTint) {
        requestMeasure(b);
      }
    };
    gBrowser.tabContainer.addEventListener("TabSelect", onTabSelect);
    gBrowser.addTabsProgressListener({
      onLocationChange(browser, webProgress) {
        if (!webProgress.isTopLevel) {
          return;
        }
        if (!isWeb(browser)) {
          browser._ucTint = null;
          if (browser === gBrowser.selectedBrowser) {
            apply(null);
          }
        }
      },
    });
    setTimeout(onTabSelect, 500);
    setTimeout(() => requestMeasure(gBrowser.selectedBrowser), 2000);
  } catch (e) {
    console.error("toolbar tint:", e);
  }
})();

// ---- Theme strings adapted to Firefox's language (Services.locale) ----
// The visible strings of the theme are translated into the user's language; a language that is not listed falls back to English.
//  - Options button (label + tooltip) and its "Compact mode" row: set on the widget below;
//  - "Address bar" label (Customize mode) and "Private Browsing" mention: set as CSS variables on the root, read by userChrome.css with
//    var() (English fallback if the variable is not set). The values are set as CSS strings (JSON.stringify): the apostrophe of a
//    translation would otherwise be an invalid token in a bare value.
// To add a language: add its two-letter code to each entry below.
(() => {
  try {
    const LANG = (Services.locale.appLocaleAsBCP47 || "en").split("-")[0].toLowerCase();
    const TRANSLATIONS = {
      compact: {
        fr: "Mode compact", en: "Compact mode", de: "Kompakter Modus", es: "Modo compacto", it: "Modalità compatta",
        pt: "Modo compacto", nl: "Compacte modus", pl: "Tryb kompaktowy", ru: "Компактный режим", ja: "コンパクトモード",
        ko: "컴팩트 모드", zh: "紧凑模式", ar: "وضع مدمج", tr: "Sıkıştırılmış mod", sv: "Kompakt läge",
      },
      options: {
        fr: "Options", en: "Options", de: "Optionen", es: "Opciones", it: "Opzioni",
        pt: "Opções", nl: "Opties", pl: "Opcje", ru: "Параметры", ja: "オプション",
        ko: "옵션", zh: "选项", ar: "خيارات", tr: "Seçenekler", sv: "Alternativ",
      },
      "address-bar": {
        fr: "Barre d'adresse", en: "Address bar", de: "Adressleiste", es: "Barra de direcciones", it: "Barra degli indirizzi",
        pt: "Barra de endereço", nl: "Adresbalk", pl: "Pasek adresu", ru: "Строка адреса", ja: "アドレスバー",
        ko: "주소창", zh: "地址栏", ar: "شريط العنوان", tr: "Adres çubuğu", sv: "Adressfält",
      },
      "private-browsing": {
        fr: "Navigation privée", en: "Private Browsing", de: "Privater Modus", es: "Navegación privada", it: "Navigazione privata",
        pt: "Navegação privada", nl: "Privé browsen", pl: "Tryb prywatny", ru: "Секретный режим", ja: "プライベートブラウジング",
        ko: "개인정보 보호", zh: "隐私浏览", ar: "التصفح الخاص", tr: "Gizli gezinme", sv: "Privat webbläsning",
      },
    };
    const localised = (key) => TRANSLATIONS[key][LANG] || TRANSLATIONS[key].en;
    Services.__ucStrings = { compact: localised("compact"), options: localised("options") };
    const root = document.documentElement;
    root.style.setProperty("--uc-label-address-bar", JSON.stringify(localised("address-bar")));
    root.style.setProperty("--uc-label-private", JSON.stringify(localised("private-browsing")));
  } catch (e) {
    console.error("string localisation:", e);
  }
})();

// ---- Compact mode: tabs and address on a single row (see userChrome.css, "COMPACT MODE" block) ----
// The Options button (created here; a button in its own right, like the others: it can be moved, removed, or placed next to the
// sidebar button) opens a small panel. Its first row, the "Compact mode" switch, toggles the extensions.uc.compact preference; every window
// observes it and sets the uc-compact attribute on the root. Further options go in the same panel.
(() => {
  try {
    const PREF_KEY = "extensions.uc.compact";
    const ID = "uc-compact-button";
    const PANEL_ID = "uc-options-panel";
    const root = document.documentElement;
    const isActive = () => {
      try {
        return Services.prefs.getBoolPref(PREF_KEY, false);
      } catch (e) {
        return false;
      }
    };
    if (!Services.__ucCompactButton) {
      Services.__ucCompactButton = true;
      const strings = Services.__ucStrings || {};
      CustomizableUI.createWidget({
        id: ID,
        type: "custom",
        defaultArea: "nav-bar",
        onBuild(doc) {
          const XHTML = "http://www.w3.org/1999/xhtml";
          const button = doc.createXULElement("toolbarbutton");
          button.id = ID;
          button.className = "toolbarbutton-1 chromeclass-toolbar-additional";
          button.setAttribute("label", strings.options || "Options");
          button.setAttribute("tooltiptext", strings.options || "Options");
          // The panel lives in the window's popup set (one per window; the palette of "Customize Toolbar" builds the button again).
          let panel = doc.getElementById(PANEL_ID);
          if (!panel) {
            panel = doc.createXULElement("panel");
            panel.id = PANEL_ID;
            panel.setAttribute("type", "arrow");
            // One row per option: a label and a switch. Add further options as more rows.
            const row = doc.createElementNS(XHTML, "label");
            row.className = "uc-option";
            const text = doc.createElementNS(XHTML, "span");
            text.textContent = strings.compact || "Compact mode";
            const toggle = doc.createElementNS(XHTML, "input");
            toggle.type = "checkbox";
            toggle.className = "uc-switch";
            toggle.setAttribute("role", "switch");
            toggle.addEventListener("change", () => Services.prefs.setBoolPref(PREF_KEY, toggle.checked));
            row.append(text, toggle);
            panel.appendChild(row);
            panel.addEventListener("popupshowing", () => (toggle.checked = isActive()));
            doc.getElementById("mainPopupSet").appendChild(panel);
          }
          button.addEventListener("command", () => panel.openPopup(button, "after_start"));
          return button;
        },
      });
    }
    // Placement on first use only: createWidget appends the button at the END of the bar, so it is moved once to the leftmost slot (a
    // button already moved by the user, i.e. not last, is left alone). user.js does not impose the toolbar layout: the placement saved in
    // the profile is kept, including the one chosen by the user.
    const place = () => {
      try {
        const PLACED_PREF = "extensions.uc.compactPlaced";
        if (Services.prefs.getBoolPref(PLACED_PREF, false)) {
          return;
        }
        const widgets = CustomizableUI.getWidgetIdsInArea("nav-bar");
        const index = widgets.indexOf(ID);
        if (index === -1) {
          return; // not placed yet: try again on the next call
        }
        Services.prefs.setBoolPref(PLACED_PREF, true);
        if (index === widgets.length - 1) {
          CustomizableUI.addWidgetToArea(ID, "nav-bar", 0);
        }
      } catch (e) {
        console.error("compact mode (placement):", e);
      }
    };
    place();
    setTimeout(place, 1500);

    // Right edge of the "forward" button and width of the right-hand buttons, in CSS pixels. The downloads button is one of them: hidden
    // while the list is empty (zero width), it appears on the left of the others during a download and the tab strip used to cover it; its
    // size is therefore watched (ResizeObserver, below) and re-measured as soon as it appears or disappears.
    const measure = () => {
      const forward = document.getElementById("forward-button");
      const left = forward ? Math.ceil(forward.getBoundingClientRect().right) : 150;
      let min = Infinity;
      for (const id of ["reset-pbm-toolbar-button", "downloads-button", "unified-extensions-button", "new-tab-button", "PanelUI-menu-button"]) {
        const el = document.getElementById(id);
        const r = el && el.getBoundingClientRect();
        if (r && r.width > 0 && r.left < min) {
          min = r.left;
        }
      }
      // Any other button in the right half of the buttons area (Firefox account button, an extension's button...): a button this list
      // does not know would be covered by the tab strip (the account button, visible in private windows, was).
      const area = document.getElementById("nav-bar-customization-target");
      for (const el of area ? area.children : []) {
        const r = el.getBoundingClientRect();
        if (!/spring|spacer/.test(el.id) && r.width > 0 && r.left > window.innerWidth / 2 && r.left < min) {
          min = r.left;
        }
      }
      const right = isFinite(min) ? Math.ceil(window.innerWidth - min) + 6 : 260;
      root.style.setProperty("--uc-left", left + "px");
      root.style.setProperty("--uc-right", right + "px");
    };
    // The buttons settle a moment after a layout switch (springs resizing): measure now, then again once they have.
    const measureSoon = () => {
      measure();
      requestAnimationFrame(() => requestAnimationFrame(measure));
      setTimeout(measure, 150);
      setTimeout(measure, 600);
    };
    // EFFECTIVE compact layout: preference true, two tabs or more, horizontal tabs (see userChrome.css).
    const isEffective = () =>
      root.hasAttribute("uc-compact") && root.hasAttribute("uc-multi") && gBrowser.tabContainer.getAttribute("orient") === "horizontal";
    let animTimer = null;
    let ready = false; // no animation while the window starts
    setTimeout(() => (ready = true), 3000);
    // Makes the change and, if the effective layout changes, ANIMATES it: [uc-anim] enables the transitions and the tab strip's entrance
    // (userChrome.css), and the bar's height (80 -> 40 px or the reverse) slides with the animation API. Set BEFORE the change: a transition
    // takes the transition properties of the TARGET style.
    const change = (mutate, animateHeight) => {
      if (!ready) {
        mutate();
        measureSoon();
        return;
      }
      const wasEffective = isEffective();
      const box = document.getElementById("navigator-toolbox");
      const h0 = box.getBoundingClientRect().height;
      mutate();
      if (isEffective() === wasEffective) {
        return; // nothing changes: no animation, normal mode keeps its own transitions
      }
      measureSoon();
      root.setAttribute("uc-anim", "");
      // The bar's height is only animated for the button toggle: when a tab opens, Firefox's own tab row is opening, the starting
      // measure would be wrong (dark band under the bookmarks bar).
      const h1 = box.getBoundingClientRect().height;
      if (animateHeight && h0 !== h1) {
        box.animate([{ height: h0 + "px" }, { height: h1 + "px" }], { duration: 420, easing: "cubic-bezier(0.4, 0, 0.2, 1)" });
      }
      clearTimeout(animTimer);
      animTimer = setTimeout(() => root.removeAttribute("uc-anim"), 520);
    };
    // "Customize Toolbar" mode (customizing attribute set by Firefox on the root): no compact layout, the overlaid tab strip would cover
    // the slots of the buttons being moved. The preference stays true: compact mode comes back when leaving it.
    const apply = () => {
      change(() => {
        if (isActive() && !root.hasAttribute("customizing")) {
          root.setAttribute("uc-compact", "");
        } else {
          root.removeAttribute("uc-compact");
        }
      }, true);
      measureSoon();
    };
    const mutationWatcher = { observe: apply };
    Services.prefs.addObserver(PREF_KEY, mutationWatcher);
    window.addEventListener("unload", () => Services.prefs.removeObserver(PREF_KEY, mutationWatcher), { once: true });
    new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ["customizing"] });

    // Two tabs or more: the only case where the layout changes.
    const countTabs = (excluded) => {
      const n = gBrowser.visibleTabs.filter((t) => !t.closing && t !== excluded).length;
      if (n > 1 === root.hasAttribute("uc-multi")) {
        return;
      }
      change(() => {
        if (n > 1) {
          root.setAttribute("uc-multi", "");
        } else {
          root.removeAttribute("uc-multi");
        }
      }, false);
    };
    for (const ev of ["TabOpen", "TabClose", "TabPinned", "TabUnpinned", "TabHide", "TabShow"]) {
      gBrowser.tabContainer.addEventListener(ev, (e) => {
        countTabs(e.type === "TabClose" ? e.target : null); // the closing tab is still there: leave it out
        setTimeout(countTabs, 0);
        setTimeout(countTabs, 400);
      });
    }
    countTabs();
    apply();
    setTimeout(apply, 800);
    setTimeout(apply, 2500);
    window.addEventListener("resize", measure);
    // Buttons that appear or disappear (downloads; flame + "Private Browsing" label of private windows, account button): re-measure on
    // every size change.
    for (const id of ["downloads-button", "reset-pbm-toolbar-button", "fxa-toolbar-menu-button"]) {
      const button = document.getElementById(id);
      if (button) {
        new ResizeObserver(measure).observe(button);
      }
    }
    // The right-hand buttons also move (without resizing) when the flexible spaces around the address bar change size.
    const buttonsArea = document.getElementById("nav-bar-customization-target");
    if (buttonsArea) {
      const observer = new ResizeObserver(measure);
      for (const el of buttonsArea.querySelectorAll("toolbarspring")) {
        observer.observe(el);
      }
    }
  } catch (e) {
    console.error("compact mode:", e);
  }
})();

// ---- "New Tab" button at the end of the top bar (right side, like Safari) ----
// user.js does not impose the toolbar layout: the layout saved in the profile is kept, including the user's choices. On a profile
// where the button is not in the top bar yet (Firefox's default: in the tab row, hidden by userChrome.css), the script moves it once to
// the end of the bar; afterwards the placement chosen by the user is kept.
(() => {
  try {
    if (CustomizableUI.getPlacementOfWidget("new-tab-button")?.area !== "nav-bar") {
      // (extensions.uc.nouvelOngletDeplace: the flag's former name, kept so that existing installs do not move the button again)
      if (!Services.prefs.getBoolPref("extensions.uc.newTabMoved", false) && !Services.prefs.getBoolPref("extensions.uc.nouvelOngletDeplace", false)) {
        CustomizableUI.addWidgetToArea("new-tab-button", "nav-bar");
        Services.prefs.setBoolPref("extensions.uc.newTabMoved", true);
      }
    }
  } catch (e) {
    console.error("New Tab button (placement):", e);
  }
})();

// ---- Clean-up: a short-lived version of this script placed Firefox's "Share" button in the bar; take it out once and forget it ----
(() => {
  try {
    if (Services.prefs.getBoolPref("extensions.uc.shareMoved", false)) {
      CustomizableUI.removeWidgetFromArea("share-tab-button");
      Services.prefs.clearUserPref("extensions.uc.shareMoved");
    }
  } catch (e) {
    console.error("Share button (clean-up):", e);
  }
})();


// ---- Tab title faded by mistake ----
// Firefox fades the end of a tab title (textoverflow attribute, mask-image in tabs.css) when the title container overflows; the
// attribute is set and removed by the container's "overflow" / "underflow" events (tab.js: on_overflow / on_underflow), so only when the
// state CHANGES. It can stay set although the title fits easily (seen: "Firefox" with a faded "x" in a very wide pill). The real state
// (text wider than the container by more than 1 px) is recomputed every second and after every animation, tab change or resize. A real
// overflow keeps its fade; pinned tabs (zero-width container) are ignored.
(() => {
  try {
    const fixTitleFade = () => {
      for (const tab of gBrowser.tabs) {
        const container = tab.querySelector(".tab-label-container");
        const label = container && container.querySelector(".tab-label");
        if (!label || tab.hasAttribute("pinned") || !container.clientWidth) {
          continue;
        }
        const overflows = label.scrollWidth - container.clientWidth > 1;
        if (container.hasAttribute("textoverflow") !== overflows) {
          container.toggleAttribute("textoverflow", overflows);
        }
      }
    };
    setInterval(fixTitleFade, 1000);
    gBrowser.tabContainer.addEventListener("transitionend", () => setTimeout(fixTitleFade, 60));
    gBrowser.tabContainer.addEventListener("TabSelect", () => setTimeout(fixTitleFade, 60));
    window.addEventListener("resize", () => setTimeout(fixTitleFade, 200));
  } catch (e) {
    console.error("tab title:", e);
  }
})();
