// teinte-child.sys.mjs : côté PAGE (processus de contenu). Calcule la couleur que WebKit donne à Safari pour teinter ses barres.
//
// Ce qui est PORTÉ DEPUIS LE CODE DE WEBKIT (branche main, lu le 2026-10-14) :
//   - LocalFrameView::fixedContainerEdges (Source/WebCore/page/LocalFrameView.cpp) : bord HAUT
//   - LocalFrameView::documentBackgroundColor : fond de la page = <html> puis <body> posés sur du blanc, images de fond ignorées
//   - PageColorSampler::predominantColor (Source/WebCore/page/PageColorSampler.cpp) : 29 échantillons, 20 identiques au moins
//   - Page::updateFixedContainerEdges : le bord haut n'est échantillonné qu'avant le premier défilement
//   - WKWebView._updateFixedColorExtensionViews : couleur de l'arête haute, sinon underPageBackgroundColor (= fond de la page)
// Ce qui n'est PAS dans le code de WebKit : la manière dont l'application Safari (fermée) choisit sa couleur de barre à partir de
// ces deux informations. On suit les descriptions publiées : arête haute si elle existe, sinon fond de la page.
// Non porté : l'élément « ::backdrop » (dialogues modaux), les filtres de couleur, pointer-events (elementsFromPoint ignore déjà
// les éléments en pointer-events: none, ce que WebKit ne fait qu'au second essai).
// Valeur reprise d'une description tierce, non lue dans le code : seuil « presque transparent » (0,1).

const XHTML = "http://www.w3.org/1999/xhtml";
const MARGE = 4; // sampleRectMargin : le point touché est à 4 px du bord de la fenêtre
const BORDURE_FINE = 10; // thinBorderWidth : une boîte de 10 px ou moins n'a pas de couleur
const OPACITE_PRESQUE_NULLE = 0.1;
const OPACITE_MIN_OPAQUE = 0.75; // minimumOpacityThresholdToClampToSolidColor
const ELEMENTS_REMPLACES = /^(img|video|canvas|iframe|svg|object|embed|picture|input|textarea|select)$/i;

export class UcTeinteChild extends JSWindowActorChild {
  #minuteries = [];
  #derniere = "";
  #observateur = null;
  #aDefile = false; // Page::updateFixedContainerEdges : plus d'échantillonnage du bord haut après le premier défilement
  #bord = undefined; // dernier résultat du bord haut : { couleur, conteneur, genre }

  handleEvent(evt) {
    if (evt.type === "DOMContentLoaded") {
      this.#observer();
    }
    // La page applique ses styles après le chargement (scripts, thème choisi) : plusieurs mesures, la dernière fait foi.
    this.#planifier(evt.type === "scroll" ? [120] : evt.type === "load" ? [150, 1000, 3000] : [150]);
  }

  receiveMessage(msg) {
    if (msg.name === "UcTeinte:Mesurer") {
      this.#mesurer(true);
    }
  }

  didDestroy() {
    this.#minuteries.forEach((m) => this.#annuler(m));
    this.#observateur?.disconnect();
  }

  #annuler(m) {
    try {
      this.contentWindow?.clearTimeout(m);
    } catch (e) {
      // fenêtre déjà détruite
    }
  }

  #planifier(delais) {
    const win = this.contentWindow;
    if (!win) {
      return;
    }
    this.#minuteries.forEach((m) => this.#annuler(m));
    this.#minuteries = delais.map((d) => win.setTimeout(() => this.#mesurer(false), d));
  }

  // Un changement de classe ou de style sur <html> / <body> (thème clair / sombre du site, page à navigation interne) change le
  // fond sans évènement de chargement : on suit ces deux éléments.
  #observer() {
    const doc = this.document;
    if (!doc || this.#observateur) {
      return;
    }
    const win = this.contentWindow;
    this.#observateur = new win.MutationObserver(() => this.#planifier([150]));
    const options = { attributes: true, attributeFilter: ["class", "style", "data-theme", "data-color-mode"] };
    this.#observateur.observe(doc.documentElement, options);
    if (doc.body) {
      this.#observateur.observe(doc.body, options);
    }
  }

  #mesurer(force) {
    let couleur = null;
    try {
      couleur = this.#calculer();
    } catch (e) {
      couleur = null;
      this.sendAsyncMessage("UcTeinte:Erreur", String(e) + " | " + (e && e.stack));
    }
    const cle = couleur ? couleur.join(",") : "";
    if (force || cle !== this.#derniere) {
      this.#derniere = cle;
      this.sendAsyncMessage("UcTeinte:Couleur", couleur);
    }
  }

  // [r, g, b, a] (a de 0 à 1) d'une couleur CSS calculée. « rgb() / rgba() » se lit tel quel ; tout autre format (oklch,
  // color-mix…) passe par un canvas, qui sait tout interpréter.
  #analyser(css) {
    const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(css);
    if (m) {
      const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      return [Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3]), a];
    }
    const cv = this.document.createElementNS(XHTML, "canvas");
    cv.width = cv.height = 1;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  }

  // Pose c (avec son alpha) sur un fond opaque (blendSourceOver).
  #poser(c, dessous) {
    const a = c[3];
    return [0, 1, 2].map((i) => Math.round(c[i] * a + dessous[i] * (1 - a)));
  }

  #calculer() {
    const win = this.contentWindow;
    const doc = this.document;
    if (!win || !doc || !doc.documentElement || !/html/i.test(doc.contentType)) {
      return null;
    }
    // Fond de la page (documentBackgroundColor) : <html> puis <body> posés l'un sur l'autre, sur du blanc.
    let fond = [255, 255, 255];
    for (const el of [doc.documentElement, doc.body]) {
      if (el) {
        fond = this.#poser(this.#analyser(win.getComputedStyle(el).backgroundColor), fond);
      }
    }
    if (win.scrollY > 0) {
      this.#aDefile = true;
    }
    // Le bord haut n'est recalculé qu'avant le premier défilement ; ensuite on garde le dernier résultat.
    if (!this.#aDefile || this.#bord === undefined) {
      this.#bord = this.#bordHaut(win, doc, fond);
    }
    const couleur = this.#bord && this.#bord.couleur;
    return couleur ? couleur : fond;
  }

  #vide(el) {
    if (el.shadowRoot && el.shadowRoot.childNodes.length) {
      return false;
    }
    return ![...el.childNodes].some((n) => n.nodeType === 1 || (n.nodeType === 3 && n.data.trim()));
  }

  #aFond(el, cs) {
    return this.#analyser(cs.backgroundColor)[3] > 0 || cs.backgroundImage !== "none";
  }

  #aFiltreFond(cs) {
    return !!cs.backdropFilter && cs.backdropFilter !== "none";
  }

  // isHiddenOrNearlyTransparent : invisible, opacité nulle ou presque, ou boîte vide sans fond ni filtre (hors éléments remplacés)
  #cacheOuTransparent(el, cs) {
    const opacite = parseFloat(cs.opacity);
    if (cs.visibility !== "visible" || !(opacite >= OPACITE_PRESQUE_NULLE)) {
      return true;
    }
    return !this.#aFond(el, cs) && !this.#aFiltreFond(cs) && this.#vide(el) && !ELEMENTS_REMPLACES.test(el.localName);
  }

  // primaryBackgroundColorForRenderer : couleur de fond d'une boîte, seulement si elle a plus de 10 px dans les deux sens, n'est
  // ni cachée ni presque transparente, et couvre au moins 90 % de la largeur (côté haut).
  #primaire(el, cs, r, vw) {
    if (cs.display === "inline" || r.width <= BORDURE_FINE || r.height <= BORDURE_FINE) {
      return null;
    }
    if (this.#cacheOuTransparent(el, cs) || r.width < 0.9 * vw) {
      return null;
    }
    const c = this.#analyser(cs.backgroundColor);
    return c[3] > 0 ? c : null;
  }

  // Bord HAUT, comme LocalFrameView::fixedContainerEdges. Renvoie { couleur: [r,g,b] | null, conteneur, genre } ; conteneur null =
  // pas d'arête fixe en haut.
  #bordHaut(win, doc, fond) {
    const L = doc.documentElement.clientWidth;
    const H = win.innerHeight;
    // fixedRect contracté de 4 px de chaque côté : c'est la longueur de référence de compareWithViewportSize
    const vw = Math.max(1, L - 2 * MARGE);
    const vh = Math.max(1, H - 2 * MARGE);
    const classe = (v, ref) => (v < 0.9 * ref ? "P" : v < 1.05 * ref ? "M" : "G"); // Smaller / Similar / Larger
    const parent = (el) => el.parentElement || (el.getRootNode && el.getRootNode().host) || null;

    // Point touché : milieu du bord haut, à 4 px sous le bord. On descend dans les ombres ouvertes.
    const x = L / 2;
    let touche = doc.elementsFromPoint(x, MARGE)[0];
    while (touche && touche.shadowRoot) {
      const interieur = touche.shadowRoot.elementsFromPoint(x, MARGE)[0];
      if (!interieur || interieur === touche) {
        break;
      }
      touche = interieur;
    }

    let enregistre = null; // première couleur de fond vue en remontant
    let multiple = false; // couleurs différentes vues : on ne s'en sert pas
    let filtre = false; // un filtre d'arrière-plan : « Multiple » côté WebKit
    let fondVu = false; // un fond (couleur ou image) dans la chaîne jusqu'au conteneur : seul cas où l'on échantillonne les pixels
    let conteneur = null;
    let genre = null;
    for (let el = touche; el; el = parent(el)) {
      const cs = win.getComputedStyle(el);
      if (cs.display === "none" || cs.display === "contents") {
        continue; // pas de rendu
      }
      const r = el.getBoundingClientRect();
      const fixe = cs.position === "fixed" || cs.position === "sticky";
      const cache = fixe && this.#cacheOuTransparent(el, cs);
      if (!cache) {
        if (this.#aFiltreFond(cs)) {
          filtre = true;
        } else {
          const c = this.#primaire(el, cs, r, vw);
          if (c) {
            if (!enregistre) {
              enregistre = c;
            } else if (enregistre[0] !== c[0] || enregistre[1] !== c[1] || enregistre[2] !== c[2] || enregistre[3] !== c[3]) {
              multiple = true;
            }
          }
          if (this.#aFond(el, cs)) {
            fondVu = true;
          }
        }
      }
      if (!fixe || cache) {
        continue; // NoLayer, NotFixedOrSticky, IsHiddenOrTransparent
      }
      // containerEdgeCandidateResult
      const cote = classe(r.width, vw); // longueur sur le côté haut = largeur
      const adj = classe(r.height, vh); // côté adjacent (droit) = hauteur
      const c = this.#primaire(el, cs, r, vw);
      const translucide = parseFloat(cs.opacity) < 1 || (c && c[3] < 1);
      const dimming = cote !== "P" && adj !== "P" && this.#aFond(el, cs) && this.#vide(el) && translucide;
      if (cote === "P" && adj !== "P") {
        conteneur = el;
        genre = "sidebar"; // IsSidebar
        break;
      }
      if (cote === "P" && adj === "P") {
        continue; // TooSmall
      }
      if (!dimming && adj === "G") {
        continue; // TooLarge
      }
      if (dimming) {
        conteneur = el;
        genre = "dimming";
        break;
      }
      if (cote === "M" && adj === "M") {
        const z = parseInt(cs.zIndex, 10);
        if (z < 0) {
          continue; // NegativeZIndex
        }
        conteneur = el;
        genre = "viewport"; // IsViewportSizedCandidate
        break;
      }
      conteneur = el;
      genre = "candidat"; // IsCandidate
      break;
    }
    if (!conteneur) {
      return { couleur: null, conteneur: null, genre: null };
    }

    const avant = this.#bord && this.#bord.conteneur ? this.#bord : null;
    const opaqueOuMelange = (c, dimming) => (dimming || c[3] < OPACITE_MIN_OPAQUE ? this.#poser(c, fond) : [c[0], c[1], c[2]]);
    let couleur = null;
    if (filtre) {
      couleur = null; // Multiple : le navigateur retombe sur le fond de la page
    } else if (genre !== "candidat" && avant) {
      couleur = avant.couleur; // dimming / pleine fenêtre / barre latérale : on garde la couleur déjà connue
    } else if (enregistre && !multiple) {
      couleur = opaqueOuMelange(enregistre, genre === "dimming");
    } else if (avant && avant.conteneur === conteneur) {
      couleur = avant.couleur;
    } else if (fondVu) {
      const e = this.#echantillonner(win, doc, L);
      couleur = e ? opaqueOuMelange(e, genre === "dimming") : null;
    }
    return { couleur, conteneur, genre };
  }

  // PageColorSampler::predominantColor : 29 échantillons sur une bande de 2 px au bord haut, une couleur doit en réunir au moins
  // 20 (ou ses voisines à une distance RVB de 6 au plus). Sinon « Multiple » (null). drawWindow photographie tout, pas seulement
  // les couches fixes comme WebKit : on ne l'appelle que si un fond existe entre l'élément touché et le conteneur.
  #echantillonner(win, doc, L) {
    try {
      const h = 2;
      const cv = doc.createElementNS(XHTML, "canvas");
      cv.width = L;
      cv.height = h;
      const ctx = cv.getContext("2d", { willReadFrequently: true });
      ctx.drawWindow(win, 0, MARGE, L, h, "rgba(0,0,0,0)");
      const d = ctx.getImageData(0, 0, L, h).data;
      const n = L * h;
      const pas = Math.max(1, Math.floor(n / 28));
      const comptes = new Map();
      for (let i = 0; i < 29 && i * pas < n; i++) {
        const k = i * pas * 4;
        if (d[k + 3] === 0) {
          continue; // pixel invisible
        }
        const cle = d[k] + "," + d[k + 1] + "," + d[k + 2] + "," + d[k + 3];
        comptes.set(cle, (comptes.get(cle) || 0) + 1);
      }
      const seuil = 0.67 * 29;
      const liste = [...comptes.entries()].sort((a, b) => b[1] - a[1]);
      if (!liste.length) {
        return null;
      }
      const ancre = liste[0][0].split(",").map(Number);
      let somme = 0;
      for (const [cle, nb] of liste) {
        const c = cle.split(",").map(Number);
        const dist = (c[0] - ancre[0]) ** 2 + (c[1] - ancre[1]) ** 2 + (c[2] - ancre[2]) ** 2;
        if (dist <= 36) {
          somme += nb;
        }
      }
      if (liste[0][1] <= seuil && somme <= seuil) {
        return null;
      }
      const a = ancre[3] / 255;
      return a < OPACITE_PRESQUE_NULLE ? null : [ancre[0], ancre[1], ancre[2], a];
    } catch (e) {
      return null;
    }
  }
}
