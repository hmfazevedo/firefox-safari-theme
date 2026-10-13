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

  // Largeur (en px) du domaine affiché, mesurée avec la police réelle du champ : la feuille de style
  // s'en sert pour poser le globe juste à gauche du texte centré (CSS seul ne sait pas où commence
  // un texte centré dans un champ de saisie). Publiée dans --uc-dw sur la barre, avec l'attribut
  // uc-domaine tant que l'affichage « domaine seul » est actif.
  let canvas = null;
  let dernierTexte = ""; // dernier texte mesuré (déclaré ici : rafraichir() s'exécute avant la fin du script)
  const largeurTexte = (texte) => {
    canvas ||= document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
    const cs = getComputedStyle(this_input());
    const ctx = canvas.getContext("2d");
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    return ctx.measureText(texte).width;
  };
  const this_input = () => bar.inputField;
  // Position (en px, depuis le bord gauche du conteneur) du bouton-globe, mesurée sur le texte réel :
  // le texte est centré dans le CHAMP, pas dans la barre, et un élément en plus dans la barre (extension,
  // icône) décale le champ ; un calcul en pourcentage de la barre mettrait alors le globe sur le texte.
  // Le bouton fait 28 px (icône de 16 px à 6 px du bord) et son bord droit doit être à 6 px du texte.
  const placerGlobe = () => {
    const conteneur = bar.querySelector(".urlbar-input-container");
    const dw = parseFloat(bar.style.getPropertyValue("--uc-dw"));
    if (!conteneur || !(dw >= 0) || !bar.hasAttribute("uc-centre")) {
      return;
    }
    const champ = bar.inputField.getBoundingClientRect();
    const cs = getComputedStyle(bar.inputField);
    const decalage = (parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) / 2;
    const debutTexte = champ.left + champ.width / 2 + decalage - dw / 2;
    const gx = (Math.round((debutTexte - conteneur.getBoundingClientRect().left - 28) * 10) / 10) + "px";
    if (bar.style.getPropertyValue("--uc-gx") !== gx) {
      bar.style.setProperty("--uc-gx", gx);
    }
  };
  // Centrage du groupe « globe + texte » : actif (attribut uc-centre) quand la barre montre l'adresse d'un site
  // (uc-web) et qu'on ne tape pas (usertyping) : au repos (domaine seul) ET barre active (adresse complète
  // sélectionnée). La largeur du texte réellement affiché est remesurée quand elle change ; la position du globe
  // en découle. Pendant la frappe, le texte reste aligné à gauche (sinon il bougerait à chaque lettre).
  const majCentre = () => {
    try {
      const val = bar.inputField.value;
      if (!bar.hasAttribute("uc-web") || bar.hasAttribute("usertyping") || !val) {
        bar.removeAttribute("uc-centre");
        return;
      }
      if (val !== dernierTexte) {
        dernierTexte = val;
        bar.style.setProperty("--uc-dw", Math.round(largeurTexte(val)) + "px");
      }
      bar.setAttribute("uc-centre", "");
      placerGlobe();
    } catch (e) {
      console.error("urlbar-domaine (majCentre) :", e);
    }
  };
  const marquerDomaine = (domaine) => {
    bar.toggleAttribute("uc-domaine", !!domaine);
    majCentre();
  };

  const setValueNatif = bar.setValue;
  bar.setValue = function (val, options) {
    const resultat = setValueNatif.call(this, val, options);
    try {
      // uc-web : la barre montre l'adresse d'un site (réduite OU complète, sélectionnée au focus). Sert au globe
      // de la barre active, alors que uc-domaine n'existe que pour l'affichage « domaine seul » au repos.
      this.toggleAttribute("uc-web", estWeb(val));
      // allowTrim = affichage « au repos » demandé par Firefox ; pas quand on tape ou qu'on édite.
      if (options && options.allowTrim && !this.focused && estWeb(val)) {
        const domaine = new URL(val).host.replace(/^www\./i, "");
        if (domaine) {
          this._protocolIsTrimmed = true; // pour que le focus remette l'adresse entière
          this.inputField.value = domaine;
          this.formatValue();
          marquerDomaine(domaine);
          return domaine;
        }
      }
      marquerDomaine(null);
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
  // d'onglet, redirection, restauration) et la fenêtre peut être redimensionnée. On remesure donc le
  // domaine affiché et la position du globe quand la barre est au repos ; presque gratuit (une lecture
  // de géométrie, la mesure du texte n'est refaite que si le texte change).
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

// ---- Barre d'outils façon Safari : boutons Partager et vue d'ensemble des onglets ----
// #uc-share-button : bouton créé ici (CustomizableUI), qui ouvre le panneau Partager de Windows (nsIWindowsUIUtils.shareUrl).
// #alltabs-button : le bouton « Lister tous les onglets » de Firefox, déplacé dans la barre du haut. La disposition des barres est
// remise à zéro à chaque démarrage par user.js (browser.uiCustomization.state) : on replace donc les deux boutons à chaque
// fois, juste avant « Nouvel onglet ». Une seule fois par session (le script tourne dans chaque fenêtre).
(() => {
  if (Services.__ucOutils) {
    return;
  }
  Services.__ucOutils = true;
  try {
    const ID = "uc-share-button";
    CustomizableUI.createWidget({
      id: ID,
      type: "button",
      defaultArea: "nav-bar",
      label: "Partager",
      tooltiptext: "Partager cette page",
      onCommand(evt) {
        try {
          const fenetre = evt.target.ownerGlobal;
          const url = fenetre.gBrowser.currentURI.spec;
          if (!/^https?:/i.test(url)) {
            return;
          }
          Cc["@mozilla.org/windows-ui-utils;1"].getService(Ci.nsIWindowsUIUtils).shareUrl(url, fenetre.gBrowser.contentTitle || url);
        } catch (e) {
          console.error("partager :", e);
        }
      },
    });
    // Ordre voulu à droite, comme Safari : Partager, « + » (nouvel onglet), vue d'ensemble des onglets. Idempotent : on dresse
    // la liste complète de la barre, on y glisse les deux boutons autour de « Nouvel onglet », puis on ne déplace que ce qui
    // n'est pas déjà à la bonne place (deux passages ne se contredisent donc pas).
    const placer = () => {
      try {
        const AIRE = "nav-bar";
        for (const id of [ID, "alltabs-button"]) {
          const p = CustomizableUI.getPlacementOfWidget(id);
          if (!p || p.area !== AIRE) {
            CustomizableUI.addWidgetToArea(id, AIRE);
          }
        }
        const cible = CustomizableUI.getWidgetIdsInArea(AIRE).filter((id) => id !== ID && id !== "alltabs-button");
        const k = cible.indexOf("new-tab-button");
        if (k < 0) {
          cible.push(ID, "alltabs-button");
        } else {
          cible.splice(k, 1, ID, "new-tab-button", "alltabs-button");
        }
        cible.forEach((id, i) => {
          if (CustomizableUI.getWidgetIdsInArea(AIRE)[i] !== id) {
            CustomizableUI.moveWidgetWithinArea(id, i);
          }
        });
      } catch (e) {
        console.error("partager / onglets (placement) :", e);
      }
    };
    placer();
    setTimeout(placer, 1500);
  } catch (e) {
    console.error("partager / onglets (init) :", e);
  }
})();

// ---- Barre d'outils teintée selon le site (comme Safari) ----
// Safari 26 teinte ses barres d'après le FOND DE LA PAGE à son bord supérieur (et non d'après l'icône de l'onglet). On photographie
// donc une bande de 4 px en haut de la page (windowGlobal.drawSnapshot, réservé au code de l'interface), on en prend la couleur
// dominante, puis on publie une teinte SOMBRE de même ton dans --uc-teinte (même clarté que le gris d'origine, #23282e) ;
// userChrome.css s'en sert pour les barres. Fond blanc, clair, gris ou presque noir (la majorité des sites), page interne ou
// photographie impossible : on retire la variable, retour au gris neutre. Safari passerait en barre claire sur fond blanc ; on ne
// le fait pas, car il faudrait retourner toutes les couleurs de texte et d'icônes de l'interface.
(() => {
  try {
    const XHTML = "http://www.w3.org/1999/xhtml";
    const racine = document.documentElement;
    const neutre = () => racine.style.removeProperty("--uc-teinte");
    const teinter = async () => {
      try {
        const b = gBrowser.selectedBrowser;
        if (!/^https?:/i.test(b.currentURI.spec)) {
          neutre();
          return;
        }
        const wg = b.browsingContext && b.browsingContext.currentWindowGlobal;
        const larg = Math.round(b.getBoundingClientRect().width);
        if (!wg || larg < 50) {
          neutre();
          return;
        }
        const bmp = await wg.drawSnapshot(new DOMRect(0, 0, larg, 4), 0.25, "rgb(255,255,255)");
        if (gBrowser.selectedBrowser !== b) {
          return; // l'onglet a changé pendant la photographie : un autre calcul est en route
        }
        const canvas = document.createElementNS(XHTML, "canvas");
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(bmp, 0, 0);
        const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        // couleur dominante : on regroupe par 4 bits par canal et on garde le groupe le plus fréquent (un logo ou un menu ne comptent pas)
        const groupes = new Map();
        for (let i = 0; i < px.length; i += 4) {
          const cle = (px[i] >> 4) * 256 + (px[i + 1] >> 4) * 16 + (px[i + 2] >> 4);
          const g = groupes.get(cle) || [0, 0, 0, 0];
          g[0] += px[i];
          g[1] += px[i + 1];
          g[2] += px[i + 2];
          g[3]++;
          groupes.set(cle, g);
        }
        let best = null;
        for (const g of groupes.values()) {
          if (!best || g[3] > best[3]) {
            best = g;
          }
        }
        if (!best) {
          neutre();
          return;
        }
        const r = best[0] / best[3] / 255, g = best[1] / best[3] / 255, bl = best[2] / best[3] / 255;
        const max = Math.max(r, g, bl), min = Math.min(r, g, bl), l = (max + min) / 2, c = max - min;
        if (c < 0.12 || l < 0.08 || l > 0.8) {
          neutre(); // gris, presque noir ou clair / blanc : pas de teinte à porter
          return;
        }
        let h = max === r ? ((g - bl) / c) % 6 : max === g ? (bl - r) / c + 2 : (r - g) / c + 4;
        h = (h * 60 + 360) % 360;
        const sHsl = c / (1 - Math.abs(2 * l - 1));
        const s = Math.min(0.32, Math.max(0.12, sHsl * 0.4));
        racine.style.setProperty("--uc-teinte", `hsl(${Math.round(h)} ${Math.round(s * 100)}% 16.5%)`);
      } catch (e) {
        neutre();
      }
    };
    // La page peint après la fin du chargement : on photographie à 150 ms, 900 ms et 2,5 s, le dernier résultat l'emporte.
    let minuteries = [];
    const planifier = (delais = [150]) => {
      minuteries.forEach(clearTimeout);
      minuteries = delais.map((d) => setTimeout(teinter, d));
    };
    gBrowser.tabContainer.addEventListener("TabSelect", () => planifier([150, 900]));
    gBrowser.addTabsProgressListener({
      onStateChange(browser, webProgress, request, flags) {
        if (
          browser === gBrowser.selectedBrowser &&
          webProgress.isTopLevel &&
          flags & Ci.nsIWebProgressListener.STATE_STOP &&
          flags & Ci.nsIWebProgressListener.STATE_IS_WINDOW
        ) {
          planifier([150, 900, 2500]);
        }
      },
      onLocationChange(browser, webProgress, request, location, flags) {
        if (browser === gBrowser.selectedBrowser && webProgress.isTopLevel && flags & Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT) {
          planifier([400]);
        }
      },
    });
    planifier([150, 900]);
  } catch (e) {
    console.error("teinte de la barre :", e);
  }
})();
