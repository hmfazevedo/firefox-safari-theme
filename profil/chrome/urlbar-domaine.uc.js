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
