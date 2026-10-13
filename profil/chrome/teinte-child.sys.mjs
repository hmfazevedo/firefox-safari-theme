// teinte-child.sys.mjs : côté PAGE (processus de contenu). Calcule la couleur que Safari 26 donnerait à ses barres, d'après les
// règles de WebKit (LocalFrameView::fixedContainerEdges) et les mesures publiées sur Safari 26 :
//   1. un élément `position: fixed` ou `sticky` posé au bord HAUT de la fenêtre (c'est l'élément touché 8 px sous le bord, ou
//      l'un de ses ancêtres), large d'au moins 90 % de la fenêtre (macOS ; 80 % sur iOS), haut d'au moins 3 px, avec une couleur
//      de fond unie (pas un dégradé ni une image, pas presque transparente) et sans `backdrop-filter` : sa couleur de fond ;
//   2. sinon la couleur de fond de <body>, à défaut celle de <html>, à défaut BLANC ;
//   3. la balise `theme-color` est ignorée (Safari 26 ne s'en sert plus), les images de fond aussi.
// Le résultat part au parent (teinte-parent.sys.mjs) seulement quand il change. Ce que Safari fait ensuite de cette couleur
// (barres, texte clair ou foncé selon la luma Rec. 709 > 127,5) est fait par urlbar-domaine.uc.js et userChrome.css.

export class UcTeinteChild extends JSWindowActorChild {
  #minuteries = [];
  #derniere = "";
  #observateur = null;

  handleEvent(evt) {
    if (evt.type === "DOMContentLoaded") {
      this.#observer();
    }
    // La page applique ses styles après le chargement (scripts, thème choisi) : plusieurs mesures, la dernière fait foi.
    this.#planifier(evt.type === "scroll" ? [120] : evt.type === "load" ? [150, 1000] : [150]);
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
  // fond sans évènement de chargement : Safari le réévalue en continu, on suit ces deux éléments.
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
      let a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      return [Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3]), a];
    }
    const cv = this.document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
    cv.width = cv.height = 1;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  }

  // Pose c (avec son alpha) sur un fond opaque.
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
    const style = (el) => win.getComputedStyle(el);

    // Fond de la page : <html> puis <body> posés l'un sur l'autre, sur du blanc.
    let fond = [255, 255, 255];
    for (const el of [doc.documentElement, doc.body]) {
      if (el) {
        fond = this.#poser(this.#analyser(style(el).backgroundColor), fond);
      }
    }

    // Élément fixe ou collant au bord haut : on touche le point à 8 px sous le bord, au milieu de la largeur, puis on
    // remonte jusqu'au premier ancêtre fixe ou collant.
    const largeur = win.innerWidth;
    const touche = doc.elementsFromPoint(largeur / 2, 8)[0];
    for (let el = touche; el && el !== doc.documentElement; el = el.parentElement) {
      const cs = style(el);
      if (cs.position !== "fixed" && cs.position !== "sticky") {
        continue;
      }
      const r = el.getBoundingClientRect();
      const c = this.#analyser(cs.backgroundColor);
      const filtre = cs.backdropFilter;
      if (r.width >= 0.9 * largeur && r.height >= 3 && c[3] >= 0.1 && (!filtre || filtre === "none")) {
        return this.#poser(c, fond);
      }
      break; // le premier élément fixe ne qualifie pas : Safari n'en cherche pas d'autre
    }
    return fond;
  }
}
