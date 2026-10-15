// urlbar-domaine.uc.js : la barre d'adresse n'affiche que le domaine quand on ne s'en sert pas
// (comme Safari : « mail.google.com » au lieu de l'adresse complète). L'adresse réelle reste
// derrière : un clic dans la barre, Ctrl+L ou F6 réaffiche l'adresse complète, et copier,
// recharger ou mettre en favori utilisent toujours l'adresse entière.
//
// Chargé par config.js (dossier d'installation de Firefox) dans chaque fenêtre du navigateur.
// S'appuie sur le mécanisme natif de Firefox qui raccourcit l'adresse (retrait de « http:// »,
// voir UrlbarInput.setValue) : on y ajoute seulement la réduction au domaine, en réutilisant
// ses indicateurs _protocolIsTrimmed / _untrimmedValue pour que la remise en entier au focus
// reste celle de Firefox.
(() => {
  const bar = window.gURLBar;
  if (!bar || bar.__domaineSeulement) {
    return;
  }
  bar.__domaineSeulement = true;

  // Seules les adresses web : les pages internes (about:, file:, extensions) gardent leur texte.
  const estWeb = (val) => typeof val === "string" && /^https?:\/\/[^/?#\s]+/i.test(val);

  // Centrage du groupe « globe + texte » : actif (attribut uc-centre) quand la barre montre l'adresse d'un site
  // (uc-web) et qu'on ne tape pas (usertyping) : au repos (domaine seul) ET barre active (adresse complète
  // sélectionnée). Le globe est collé à gauche du champ par le CSS ; pendant la frappe, le texte reste aligné à
  // gauche (sinon il bougerait à chaque lettre).
  const majCentre = () => {
    try {
      if (!bar.hasAttribute("uc-web") || bar.hasAttribute("usertyping") || !bar.inputField.value) {
        bar.removeAttribute("uc-centre");
        return;
      }
      bar.setAttribute("uc-centre", "");
    } catch (e) {
      console.error("urlbar-domaine (majCentre) :", e);
    }
  };

  const setValueNatif = bar.setValue;
  bar.setValue = function (val, options) {
    const resultat = setValueNatif.call(this, val, options);
    try {
      // uc-web : la barre montre l'adresse d'un site (réduite OU complète, sélectionnée au focus). Sert au globe
      // de la barre active, comme au repos (domaine seul).
      this.toggleAttribute("uc-web", estWeb(val));
      // allowTrim = affichage « au repos » demandé par Firefox ; pas quand on tape ou qu'on édite.
      if (options && options.allowTrim && !this.focused && estWeb(val)) {
        const domaine = new URL(val).host.replace(/^www\./i, "");
        if (domaine) {
          this._protocolIsTrimmed = true; // pour que le focus remette l'adresse entière
          this.inputField.value = domaine;
          this.formatValue();
          majCentre();
          return domaine;
        }
      }
      majCentre();
    } catch (e) {
      console.error("urlbar-domaine :", e);
    }
    return resultat;
  };

  // Remet l'affichage « domaine » quand la barre est au repos et qu'elle montre encore autre chose
  // (page déjà ouverte au chargement du script ; Échap puis clic ailleurs, que Firefox
  // ne ré-affiche que raccourci, avec le chemin).
  const rafraichir = () => {
    try {
      bar.toggleAttribute("uc-web", estWeb(bar.untrimmedValue));
      if (!bar.focused && !bar.valueIsTyped && estWeb(bar.untrimmedValue)) {
        const domaine = new URL(bar.untrimmedValue).host.replace(/^www\./i, "");
        if (bar.value !== domaine) {
          bar.value = bar.untrimmedValue;
        }
      }
    } catch (e) {
      console.error("urlbar-domaine (rafraichir) :", e);
    }
  };
  // Après le gestionnaire de blur de Firefox (setTimeout 0), pas avant.
  bar.inputField.addEventListener("blur", () => setTimeout(rafraichir, 0));
  rafraichir();

  // Filet de sécurité : Firefox change parfois le texte du champ sans passer par setValue (changement
  // d'onglet, redirection, restauration) et la fenêtre peut être redimensionnée. On revérifie donc
  // l'état de centrage ; presque gratuit (deux lectures d'attributs).
  const synchroniser = majCentre;
  new ResizeObserver(synchroniser).observe(bar);
  setInterval(synchroniser, 400);
  // Réaction immédiate au focus / à la frappe : Firefox change le texte (adresse complète) et les attributs
  // un instant après l'évènement, d'où les passages échelonnés ; l'intervalle ci-dessus n'est que le filet.
  new MutationObserver(synchroniser).observe(bar, { attributes: true, attributeFilter: ["focused", "usertyping", "uc-web"] });
  for (const evt of ["focus", "input"]) {
    bar.inputField.addEventListener(evt, () => {
      for (const ms of [0, 60, 200]) {
        setTimeout(synchroniser, ms);
      }
    });
  }
  synchroniser();
})();

// ---- Barre latérale repliée : retirer la petite poignée blanche sous la carte des onglets ----
// Le séparateur #sidebar-tools-and-extensions-splitter (poignée de 32 x 2 px, dessinée par des dégradés) est dans le DOM
// interne (shadow DOM) de <sidebar-main> : le CSS du profil n'y accède pas. On y ajoute une feuille de style, avec
// quelques nouvelles tentatives si l'élément n'est pas encore prêt au chargement de la fenêtre. Le séparateur garde son
// rôle (redimensionnement entre onglets et outils) : seul son dessin disparaît.
(() => {
  const appliquer = () => {
    const racine = document.querySelector("sidebar-main")?.shadowRoot;
    if (!racine) {
      return false;
    }
    if (!racine.getElementById("uc-poignee")) {
      const feuille = document.createElementNS("http://www.w3.org/1999/xhtml", "style");
      feuille.id = "uc-poignee";
      feuille.textContent = "#sidebar-tools-and-extensions-splitter { background-image: none !important; }";
      racine.appendChild(feuille);
    }
    return true;
  };
  try {
    if (!appliquer()) {
      for (const ms of [300, 1000, 3000, 8000]) {
        setTimeout(() => {
          try {
            appliquer();
          } catch (e) {
            console.error("poignée barre latérale :", e);
          }
        }, ms);
      }
    }
  } catch (e) {
    console.error("poignée barre latérale (init) :", e);
  }
})();

// ---- Barre d'outils teintée comme Safari 26 ----
// La couleur est mesurée côté page (teinte-child.sys.mjs : élément fixe en haut, sinon fond de <body> / <html>, sinon blanc ;
// la balise theme-color est ignorée, comme dans Safari 26). Ici : on l'enregistre par onglet, on la publie dans --uc-teinte
// (userChrome.css s'en sert pour les barres, la rangée d'onglets et le champ d'adresse) et on pose l'attribut uc-clair quand
// la barre est CLAIRE : Safari prend du texte foncé si la luma Rec. 709 (0,2126 R + 0,7152 G + 0,0722 B, sur 0 à 255) dépasse
// 127,5, du texte clair sinon. Pages internes (about:, extensions) : gris neutre.
// DÉLAI : une page qui se charge passe souvent par le blanc (fond par défaut) avant de devenir sombre, et la barre suivait ce blanc.
// Une nouvelle couleur n'est donc appliquée qu'après DELAI_TEINTE_MS sans autre mesure : si la page change de couleur dans l'intervalle,
// la couleur d'attente est remplacée et la barre ne passe jamais par la première. Un changement d'onglet reste immédiat (couleur déjà
// connue). Une page qui reste blanche plus longtemps que ce délai fait encore passer la barre par le blanc : allonger la valeur.
(() => {
  try {
    const racine = document.documentElement;
    const fenetrePrivee = !!(window.PrivateBrowsingUtils && window.PrivateBrowsingUtils.isWindowPrivate(window));
    if (!Services.__ucTeinteActeur) {
      Services.__ucTeinteActeur = true;
      try {
        ChromeUtils.registerWindowActor("UcTeinte", {
          parent: { esModuleURI: "chrome://urlbar-domaine/content/teinte-parent.sys.mjs" },
          child: {
            esModuleURI: "chrome://urlbar-domaine/content/teinte-child.sys.mjs",
            events: {
              DOMContentLoaded: {},
              pageshow: {},
              load: { capture: true },
              scroll: { capture: true, passive: true },
            },
          },
          allFrames: false,
          matches: ["http://*/*", "https://*/*"],
          // Sans cela Firefox refuse l'acteur dans un processus de page web (« doesn't match remote type ») : l'acteur ne lit que
          // des couleurs de fond et n'accepte aucun ordre d'une page.
          safeForUntrustedWebProcess: true,
        });
      } catch (e) {
        console.error("teinte : enregistrement de l'acteur", e);
      }
    }
    if (fenetrePrivee) {
      return; // fenêtre privée : barres noires fixes (userChrome.css), pas de teinte de la page
    }
    const DELAI_TEINTE_MS = 500;
    let minuterie = null;
    let appliqueeCle = "";
    const annuler = () => {
      clearTimeout(minuterie);
      minuterie = null;
    };
    const appliquer = (c) => {
      annuler();
      appliqueeCle = c ? c.join(",") : "";
      if (!c) {
        racine.style.removeProperty("--uc-teinte");
        racine.removeAttribute("uc-clair");
        return;
      }
      racine.style.setProperty("--uc-teinte", `rgb(${c[0]} ${c[1]} ${c[2]})`);
      const luma = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      if (luma > 127.5) {
        racine.setAttribute("uc-clair", "");
      } else {
        racine.removeAttribute("uc-clair");
      }
    };
    const estWeb = (navigateur) => /^https?:/i.test(navigateur.currentURI?.spec || "");
    // Demande une mesure à la page (utile quand la couleur de cet onglet n'est pas encore connue : page déjà chargée avant
    // l'enregistrement de l'acteur, onglet restauré en arrière-plan).
    const demander = (navigateur) => {
      try {
        if (estWeb(navigateur)) {
          navigateur.browsingContext?.currentWindowGlobal?.getActor("UcTeinte").sendAsyncMessage("UcTeinte:Mesurer");
        }
      } catch (e) {
        // pas encore d'acteur pour cette page
      }
    };
    window.ucTeinteRecue = (navigateur, c) => {
      navigateur._ucTeinte = c;
      if (navigateur !== gBrowser.selectedBrowser) {
        return;
      }
      // Chaque mesure remplace la couleur en attente ; revenir à la couleur déjà affichée annule l'attente.
      annuler();
      if ((c ? c.join(",") : "") === appliqueeCle) {
        return;
      }
      minuterie = setTimeout(() => {
        minuterie = null;
        if (navigateur === gBrowser.selectedBrowser) {
          appliquer(navigateur._ucTeinte || null);
        }
      }, DELAI_TEINTE_MS);
    };
    const surSelection = () => {
      const b = gBrowser.selectedBrowser;
      if (!estWeb(b)) {
        appliquer(null);
        return;
      }
      appliquer(b._ucTeinte || null);
      if (!b._ucTeinte) {
        demander(b);
      }
    };
    gBrowser.tabContainer.addEventListener("TabSelect", surSelection);
    gBrowser.addTabsProgressListener({
      onLocationChange(navigateur, webProgress) {
        if (!webProgress.isTopLevel) {
          return;
        }
        if (!estWeb(navigateur)) {
          navigateur._ucTeinte = null;
          if (navigateur === gBrowser.selectedBrowser) {
            appliquer(null);
          }
        }
      },
    });
    setTimeout(surSelection, 500);
    setTimeout(() => demander(gBrowser.selectedBrowser), 2000);
  } catch (e) {
    console.error("teinte de la barre :", e);
  }
})();

// ---- Mode compact : onglets et adresse sur une seule rangée (voir userChrome.css, bloc « MODE COMPACT ») ----
// Le bouton « Mode compact » (créé ici, placé tout à gauche, avant « Précédent », à chaque démarrage car user.js remet la disposition à
// zéro) bascule la préférence extensions.uc.compact ; chaque fenêtre l'observe et pose l'attribut uc-compact sur la racine.
(() => {
  try {
    const CLE = "extensions.uc.compact";
    const ID = "uc-compact-button";
    const racine = document.documentElement;
    const actif = () => {
      try {
        return Services.prefs.getBoolPref(CLE, false);
      } catch (e) {
        return false;
      }
    };
    if (!Services.__ucCompactBouton) {
      Services.__ucCompactBouton = true;
      CustomizableUI.createWidget({
        id: ID,
        type: "button",
        defaultArea: "nav-bar",
        label: "Mode compact",
        tooltiptext: "Mode compact : onglets et adresse sur une seule rangée",
        onCommand() {
          Services.prefs.setBoolPref(CLE, !actif());
        },
      });
    }
    // Placement idempotent : tout à gauche de la barre, juste avant « Précédent » (à la place du bouton de panneau latéral, masqué par
    // userChrome.css).
    const placer = () => {
      try {
        const AIRE = "nav-bar";
        const p = CustomizableUI.getPlacementOfWidget(ID);
        if (!p || p.area !== AIRE) {
          CustomizableUI.addWidgetToArea(ID, AIRE);
        }
        const ids = CustomizableUI.getWidgetIdsInArea(AIRE);
        const k = ids.indexOf("back-button");
        const i = ids.indexOf(ID);
        if (k >= 0 && i !== k - 1) {
          CustomizableUI.moveWidgetWithinArea(ID, i < k ? k - 1 : k);
        }
      } catch (e) {
        console.error("mode compact (placement) :", e);
      }
    };
    placer();
    setTimeout(placer, 1500);

    // Bord droit du bouton « suivant » et largeur des boutons de droite, en pixels CSS.
    const mesurer = () => {
      const suivant = document.getElementById("forward-button");
      const gauche = suivant ? Math.ceil(suivant.getBoundingClientRect().right) : 150;
      let min = Infinity;
      for (const id of ["unified-extensions-button", "new-tab-button", "PanelUI-menu-button"]) {
        const el = document.getElementById(id);
        const r = el && el.getBoundingClientRect();
        if (r && r.width > 0 && r.left < min) {
          min = r.left;
        }
      }
      const droite = isFinite(min) ? Math.ceil(window.innerWidth - min) + 6 : 260;
      racine.style.setProperty("--uc-gauche", gauche + "px");
      racine.style.setProperty("--uc-droite", droite + "px");
    };
    // Disposition compacte EFFECTIVE : préférence vraie, deux onglets ou plus, onglets horizontaux (voir userChrome.css).
    const effectif = () =>
      racine.hasAttribute("uc-compact") && racine.hasAttribute("uc-multi") && gBrowser.tabContainer.getAttribute("orient") === "horizontal";
    let finAnim = null;
    let pret = false; // pas d'animation pendant le démarrage de la fenêtre
    setTimeout(() => (pret = true), 3000);
    // Fait la modification, et si la disposition effective change, l'ANIME : [uc-anim] active les transitions et l'entrée de la bande
    // d'onglets (userChrome.css), et la hauteur de la barre (80 -> 40 px ou l'inverse) glisse avec l'API d'animation. Posé AVANT la
    // modification : une transition prend les propriétés de transition du style d'ARRIVÉE.
    const changer = (modifier, hauteur) => {
      if (!pret) {
        modifier();
        return;
      }
      const avant = effectif();
      const boite = document.getElementById("navigator-toolbox");
      const h0 = boite.getBoundingClientRect().height;
      modifier();
      if (effectif() === avant) {
        return; // rien ne change : aucune animation, le mode normal garde ses propres transitions
      }
      racine.setAttribute("uc-anim", "");
      // La hauteur de la barre ne s'anime que pour la bascule du bouton : à l'ouverture d'un onglet la rangée d'onglets de Firefox est
      // en train de s'ouvrir, la mesure de départ serait fausse (bande sombre sous la barre des favoris).
      const h1 = boite.getBoundingClientRect().height;
      if (hauteur && h0 !== h1) {
        boite.animate([{ height: h0 + "px" }, { height: h1 + "px" }], { duration: 420, easing: "cubic-bezier(0.4, 0, 0.2, 1)" });
      }
      clearTimeout(finAnim);
      finAnim = setTimeout(() => racine.removeAttribute("uc-anim"), 520);
    };
    // Mode « Personnaliser la barre d'outils » (attribut customizing posé par Firefox sur la racine) : pas de disposition compacte, la bande d'onglets
    // en superposition recouvrirait les emplacements des boutons qu'on veut déplacer. La préférence reste vraie : le mode compact revient à la sortie.
    const appliquer = () => {
      changer(() => {
        if (actif() && !racine.hasAttribute("customizing")) {
          racine.setAttribute("uc-compact", "");
        } else {
          racine.removeAttribute("uc-compact");
        }
      }, true);
      mesurer();
    };
    const observateur = { observe: appliquer };
    Services.prefs.addObserver(CLE, observateur);
    window.addEventListener("unload", () => Services.prefs.removeObserver(CLE, observateur), { once: true });
    new MutationObserver(appliquer).observe(racine, { attributes: true, attributeFilter: ["customizing"] });

    // Deux onglets ou plus : seul cas où la disposition change.
    const compter = (exclu) => {
      const n = gBrowser.visibleTabs.filter((t) => !t.closing && t !== exclu).length;
      if (n > 1 === racine.hasAttribute("uc-multi")) {
        return;
      }
      changer(() => {
        if (n > 1) {
          racine.setAttribute("uc-multi", "");
        } else {
          racine.removeAttribute("uc-multi");
        }
      }, false);
    };
    for (const ev of ["TabOpen", "TabClose", "TabPinned", "TabUnpinned", "TabHide", "TabShow"]) {
      gBrowser.tabContainer.addEventListener(ev, (e) => {
        compter(e.type === "TabClose" ? e.target : null); // l'onglet qui se ferme est encore là : on l'écarte
        setTimeout(compter, 0);
        setTimeout(compter, 400);
      });
    }
    compter();
    appliquer();
    setTimeout(appliquer, 800);
    setTimeout(appliquer, 2500);
    window.addEventListener("resize", mesurer);
  } catch (e) {
    console.error("mode compact :", e);
  }
})();

// ---- Titre d'onglet estompé à tort ----
// Firefox estompe la fin du titre d'un onglet (attribut textoverflow, mask-image dans tabs.css) quand le conteneur du titre déborde ; l'attribut est posé et
// retiré par les évènements « overflow » / « underflow » du conteneur (tab.js : on_overflow / on_underflow), donc seulement quand l'état CHANGE. Il peut
// rester posé alors que le titre tient largement (signalé le 2026-10-15 : « Firefox » avec le « x » estompé dans une pastille très large). On recalcule
// l'état réel (le texte dépasse le conteneur de plus de 1 px) toutes les secondes et après chaque animation, changement d'onglet ou redimensionnement.
// Un vrai débordement garde son fondu ; les onglets épinglés (conteneur de largeur nulle) sont ignorés.
(() => {
  try {
    const corriger = () => {
      for (const onglet of gBrowser.tabs) {
        const conteneur = onglet.querySelector(".tab-label-container");
        const texte = conteneur && conteneur.querySelector(".tab-label");
        if (!texte || onglet.hasAttribute("pinned") || !conteneur.clientWidth) {
          continue;
        }
        const deborde = texte.scrollWidth - conteneur.clientWidth > 1;
        if (conteneur.hasAttribute("textoverflow") !== deborde) {
          conteneur.toggleAttribute("textoverflow", deborde);
        }
      }
    };
    setInterval(corriger, 1000);
    gBrowser.tabContainer.addEventListener("transitionend", () => setTimeout(corriger, 60));
    gBrowser.tabContainer.addEventListener("TabSelect", () => setTimeout(corriger, 60));
    window.addEventListener("resize", () => setTimeout(corriger, 200));
  } catch (e) {
    console.error("titre d'onglet :", e);
  }
})();
