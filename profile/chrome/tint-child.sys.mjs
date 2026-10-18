// tint-child.sys.mjs: PAGE side (content process). Computes the colour that WebKit gives Safari to tint its bars.
//
// What is PORTED FROM WEBKIT'S CODE (main branch, read on 2026-10-14):
//   - LocalFrameView::fixedContainerEdges (Source/WebCore/page/LocalFrameView.cpp): TOP edge
//   - LocalFrameView::documentBackgroundColor: page background = <html> then <body> laid over white, background images ignored
//   - PageColorSampler::predominantColor (Source/WebCore/page/PageColorSampler.cpp): 29 samples, at least 20 identical
//   - Page::updateFixedContainerEdges: the top edge is only sampled before the first scroll
//   - WKWebView._updateFixedColorExtensionViews: colour of the top edge, otherwise underPageBackgroundColor (= the page background)
//   - LocalFrameView::recalculateScrollbarOverlayStyle + Color::lightness: the page's scrollbar is LIGHT if the background has an HSL
//     lightness (max + min) / 2 of 0.5 or less, otherwise DARK (ScrollbarOverlayStyle::Light / Default)
// What is NOT in WebKit's code: how the Safari application (closed source) picks its bar colour from these two pieces of information.
// The published descriptions are followed: top edge if it exists, otherwise the page background.
// Not ported: the ::backdrop element (modal dialogs), colour filters, pointer-events (elementsFromPoint already ignores elements with
// pointer-events: none, which WebKit only does on the second attempt).
// Value taken from a third-party description, not read in the code: the "almost transparent" threshold (0.1).
// These are re-implementations of WebKit's logic in JavaScript (WebKit is BSD / LGPL licensed): check the licences before redistributing.

const XHTML = "http://www.w3.org/1999/xhtml";
const MARGE = 4; // sampleRectMargin: the touched point is 4 px from the window edge
const THIN_BORDER = 10; // thinBorderWidth: a box of 10 px or less has no colour
const NEARLY_ZERO_OPACITY = 0.1;
const MIN_OPACITY_TO_CLAMP = 0.75; // minimumOpacityThresholdToClampToSolidColor
// Scrollbar of the PAGE (the viewport) only: :root beats the "*" rule of userContent.css, the page's inner scroll areas keep the
// medium grey (their background is not the page's). WebKit does the same: one style per view.
const sheet = (color) => "data:text/css," + encodeURIComponent(`:root{scrollbar-color:${color} transparent !important}`);
const SCROLLBAR_FOR_LIGHT_PAGE = sheet("rgba(0, 0, 0, 0.5)"); // ScrollbarOverlayStyle::Default: dark thumb on a light page
const SCROLLBAR_FOR_DARK_PAGE = sheet("rgba(255, 255, 255, 0.5)"); // ScrollbarOverlayStyle::Light: light thumb on a dark page
const DARK_CANVAS = [28, 27, 34]; // background of a page with no colour when its color-scheme is dark (Firefox's "Canvas" system colour)
const REPLACED_ELEMENTS = /^(img|video|canvas|iframe|svg|object|embed|picture|input|textarea|select)$/i;

export class UcTintChild extends JSWindowActorChild {
  #timers = [];
  #last = "";
  #mutationWatcher = null;
  #hasScrolled = false; // Page::updateFixedContainerEdges: no more sampling of the top edge after the first scroll
  #edge = undefined; // last result for the top edge: { color, container, kind }
  #sheet = null; // scrollbar sheet currently loaded in this page

  handleEvent(evt) {
    if (evt.type === "DOMContentLoaded") {
      this.#watchPage();
    }
    // A page applies its styles after loading (scripts, chosen theme): several measures, the last one counts.
    this.#schedule(evt.type === "scroll" ? [120] : evt.type === "load" ? [150, 1000, 3000] : [150]);
  }

  receiveMessage(msg) {
    if (msg.name === "UcTint:Measure") {
      this.#measure(true);
    }
  }

  didDestroy() {
    this.#timers.forEach((m) => this.#cancel(m));
    this.#mutationWatcher?.disconnect();
  }

  #cancel(m) {
    try {
      this.contentWindow?.clearTimeout(m);
    } catch (e) {
      // window already destroyed
    }
  }

  #schedule(delays) {
    const win = this.contentWindow;
    if (!win) {
      return;
    }
    this.#timers.forEach((m) => this.#cancel(m));
    this.#timers = delays.map((d) => win.setTimeout(() => this.#measure(false), d));
  }

  // A class or style change on <html> / <body> (the site's light / dark theme, a page with in-page navigation) changes the background
  // without a load event: these two elements are watched.
  #watchPage() {
    const doc = this.document;
    if (!doc || this.#mutationWatcher) {
      return;
    }
    const win = this.contentWindow;
    this.#mutationWatcher = new win.MutationObserver(() => this.#schedule([150]));
    const options = { attributes: true, attributeFilter: ["class", "style", "data-theme", "data-color-mode"] };
    this.#mutationWatcher.observe(doc.documentElement, options);
    if (doc.body) {
      this.#mutationWatcher.observe(doc.body, options);
    }
  }

  #measure(force) {
    let color = null;
    try {
      color = this.#compute();
    } catch (e) {
      color = null;
      this.sendAsyncMessage("UcTint:Error", String(e) + " | " + (e && e.stack));
    }
    const key = color ? color.join(",") : "";
    if (force || key !== this.#last) {
      this.#last = key;
      this.sendAsyncMessage("UcTint:Color", color);
    }
  }

  // [r, g, b, a] (a from 0 to 1) of a computed CSS colour. "rgb() / rgba()" is read as is; any other format (oklch, color-mix...) goes
  // through a canvas, which can interpret everything.
  #parseColor(css) {
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

  // Lays c (with its alpha) over an opaque background (blendSourceOver).
  #blendOver(c, under) {
    const a = c[3];
    return [0, 1, 2].map((i) => Math.round(c[i] * a + under[i] * (1 - a)));
  }

  #compute() {
    const win = this.contentWindow;
    const doc = this.document;
    if (!win || !doc || !doc.documentElement || !/html/i.test(doc.contentType)) {
      return null;
    }
    // Page background (documentBackgroundColor): <html> then <body> laid over each other, over white (over Firefox's dark background if
    // the page asks for a dark color-scheme: with no background colour, that is what is seen).
    let background = this.#darkCanvas(win, doc) ? DARK_CANVAS : [255, 255, 255];
    for (const el of [doc.documentElement, doc.body]) {
      if (el) {
        background = this.#blendOver(this.#parseColor(win.getComputedStyle(el).backgroundColor), background);
      }
    }
    this.#scrollbars(win, background);
    if (win.scrollY > 0) {
      this.#hasScrolled = true;
    }
    // The top edge is only recomputed before the first scroll; afterwards the last result is kept.
    if (!this.#hasScrolled || this.#edge === undefined) {
      this.#edge = this.#topEdge(win, doc, background);
    }
    const color = this.#edge && this.#edge.color;
    return color ? color : background;
  }

  // color-scheme used by the page (CSS property of <html>, otherwise the <meta name="color-scheme"> tag): "dark", or "light dark" when
  // Firefox uses a dark theme.
  #darkCanvas(win, doc) {
    let v = (win.getComputedStyle(doc.documentElement).colorScheme || "normal").toLowerCase();
    if (v === "normal") {
      const meta = doc.querySelector('meta[name="color-scheme"]');
      v = ((meta && meta.content) || "normal").toLowerCase();
    }
    if (!v.includes("dark")) {
      return false;
    }
    return !v.includes("light") || win.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  // recalculateScrollbarOverlayStyle: lightness = (max + min) / 2 on sRGB channels from 0 to 1; 0.5 or less = dark page = light scrollbar.
  #scrollbars(win, background) {
    const lightness = (0.5 * (Math.max(...background) + Math.min(...background))) / 255;
    const wanted = lightness <= 0.5 ? SCROLLBAR_FOR_DARK_PAGE : SCROLLBAR_FOR_LIGHT_PAGE;
    if (wanted === this.#sheet) {
      return;
    }
    try {
      const wu = win.windowUtils;
      if (this.#sheet) {
        wu.removeSheetUsingURIString(this.#sheet, wu.USER_SHEET);
      }
      wu.loadSheetUsingURIString(wanted, wu.USER_SHEET);
      this.#sheet = wanted;
    } catch (e) {
      this.sendAsyncMessage("UcTint:Error", "scrollbars: " + e);
    }
  }

  #isEmpty(el) {
    if (el.shadowRoot && el.shadowRoot.childNodes.length) {
      return false;
    }
    return ![...el.childNodes].some((n) => n.nodeType === 1 || (n.nodeType === 3 && n.data.trim()));
  }

  #hasBackground(el, cs) {
    return this.#parseColor(cs.backgroundColor)[3] > 0 || cs.backgroundImage !== "none";
  }

  #hasBackdropFilter(cs) {
    return !!cs.backdropFilter && cs.backdropFilter !== "none";
  }

  // isHiddenOrNearlyTransparent: invisible, zero or near-zero opacity, or an empty box with no background or filter (except replaced elements)
  #hiddenOrTransparent(el, cs) {
    const opacityValue = parseFloat(cs.opacity);
    if (cs.visibility !== "visible" || !(opacityValue >= NEARLY_ZERO_OPACITY)) {
      return true;
    }
    return !this.#hasBackground(el, cs) && !this.#hasBackdropFilter(cs) && this.#isEmpty(el) && !REPLACED_ELEMENTS.test(el.localName);
  }

  // primaryBackgroundColorForRenderer: a box's background colour, only if it is more than 10 px in both directions, neither hidden nor
  // nearly transparent, and covers at least 90% of the width (top side).
  #primaryColor(el, cs, r, vw) {
    if (cs.display === "inline" || r.width <= THIN_BORDER || r.height <= THIN_BORDER) {
      return null;
    }
    if (this.#hiddenOrTransparent(el, cs) || r.width < 0.9 * vw) {
      return null;
    }
    const c = this.#parseColor(cs.backgroundColor);
    return c[3] > 0 ? c : null;
  }

  // TOP edge, like LocalFrameView::fixedContainerEdges. Returns { color: [r,g,b] | null, container, kind }; container null = no fixed
  // edge at the top.
  #topEdge(win, doc, background) {
    const L = doc.documentElement.clientWidth;
    const H = win.innerHeight;
    // fixedRect shrunk by 4 px on each side: it is the reference length of compareWithViewportSize
    const vw = Math.max(1, L - 2 * MARGE);
    const vh = Math.max(1, H - 2 * MARGE);
    const bucket = (v, ref) => (v < 0.9 * ref ? "P" : v < 1.05 * ref ? "M" : "G"); // Smaller / Similar / Larger
    const parent = (el) => el.parentElement || (el.getRootNode && el.getRootNode().host) || null;

    // Touched point: middle of the top edge, 4 px below the edge. Open shadow roots are descended into.
    const x = L / 2;
    let touched = doc.elementsFromPoint(x, MARGE)[0];
    while (touched && touched.shadowRoot) {
      const inner = touched.shadowRoot.elementsFromPoint(x, MARGE)[0];
      if (!inner || inner === touched) {
        break;
      }
      touched = inner;
    }

    let recorded = null; // first background colour seen while walking up
    let multiple = false; // different colours seen: not used
    let hasFilter = false; // a backdrop filter: "Multiple" on WebKit's side
    let backgroundSeen = false; // a background (colour or image) in the chain up to the container: the only case where pixels are sampled
    let container = null;
    let kind = null;
    for (let el = touched; el; el = parent(el)) {
      const cs = win.getComputedStyle(el);
      if (cs.display === "none" || cs.display === "contents") {
        continue; // not rendered
      }
      const r = el.getBoundingClientRect();
      const isFixed = cs.position === "fixed" || cs.position === "sticky";
      const hidden = isFixed && this.#hiddenOrTransparent(el, cs);
      if (!hidden) {
        if (this.#hasBackdropFilter(cs)) {
          hasFilter = true;
        } else {
          const c = this.#primaryColor(el, cs, r, vw);
          if (c) {
            if (!recorded) {
              recorded = c;
            } else if (recorded[0] !== c[0] || recorded[1] !== c[1] || recorded[2] !== c[2] || recorded[3] !== c[3]) {
              multiple = true;
            }
          }
          if (this.#hasBackground(el, cs)) {
            backgroundSeen = true;
          }
        }
      }
      if (!isFixed || hidden) {
        continue; // NoLayer, NotFixedOrSticky, IsHiddenOrTransparent
      }
      // containerEdgeCandidateResult
      const side = bucket(r.width, vw); // length on the top side = width
      const adj = bucket(r.height, vh); // adjacent (right) side = height
      const c = this.#primaryColor(el, cs, r, vw);
      const translucent = parseFloat(cs.opacity) < 1 || (c && c[3] < 1);
      const dimming = side !== "P" && adj !== "P" && this.#hasBackground(el, cs) && this.#isEmpty(el) && translucent;
      if (side === "P" && adj !== "P") {
        container = el;
        kind = "sidebar"; // IsSidebar
        break;
      }
      if (side === "P" && adj === "P") {
        continue; // TooSmall
      }
      if (!dimming && adj === "G") {
        continue; // TooLarge
      }
      if (dimming) {
        container = el;
        kind = "dimming";
        break;
      }
      if (side === "M" && adj === "M") {
        const z = parseInt(cs.zIndex, 10);
        if (z < 0) {
          continue; // NegativeZIndex
        }
        container = el;
        kind = "viewport"; // IsViewportSizedCandidate
        break;
      }
      container = el;
      kind = "candidate"; // IsCandidate
      break;
    }
    if (!container) {
      return { color: null, container: null, kind: null };
    }

    const wasEffective = this.#edge && this.#edge.container ? this.#edge : null;
    const opaqueOrBlended = (c, dimming) => (dimming || c[3] < MIN_OPACITY_TO_CLAMP ? this.#blendOver(c, background) : [c[0], c[1], c[2]]);
    let color = null;
    if (hasFilter) {
      color = null; // Multiple: the browser falls back to the page background
    } else if (kind !== "candidate" && wasEffective) {
      color = wasEffective.color; // dimming / full window / sidebar: the colour already known is kept
    } else if (recorded && !multiple) {
      color = opaqueOrBlended(recorded, kind === "dimming");
    } else if (wasEffective && wasEffective.container === container) {
      color = wasEffective.color;
    } else if (backgroundSeen) {
      const e = this.#sample(win, doc, L);
      color = e ? opaqueOrBlended(e, kind === "dimming") : null;
    }
    return { color, container, kind };
  }

  // PageColorSampler::predominantColor: 29 samples on a 2 px band at the top edge, one colour must gather at least 20 of them (or its
  // neighbours within an RGB distance of 6). Otherwise "Multiple" (null). drawWindow photographs everything, not only the fixed layers
  // like WebKit: it is only called if a background exists between the touched element and the container.
  #sample(win, doc, L) {
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
      const counts = new Map();
      for (let i = 0; i < 29 && i * pas < n; i++) {
        const k = i * pas * 4;
        if (d[k + 3] === 0) {
          continue; // invisible pixel
        }
        const key = d[k] + "," + d[k + 1] + "," + d[k + 2] + "," + d[k + 3];
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      const threshold = 0.67 * 29;
      const list = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      if (!list.length) {
        return null;
      }
      const anchor = list[0][0].split(",").map(Number);
      let sum = 0;
      for (const [key, count] of list) {
        const c = key.split(",").map(Number);
        const dist = (c[0] - anchor[0]) ** 2 + (c[1] - anchor[1]) ** 2 + (c[2] - anchor[2]) ** 2;
        if (dist <= 36) {
          sum += count;
        }
      }
      if (list[0][1] <= threshold && sum <= threshold) {
        return null;
      }
      const a = anchor[3] / 255;
      return a < NEARLY_ZERO_OPACITY ? null : [anchor[0], anchor[1], anchor[2], a];
    } catch (e) {
      return null;
    }
  }
}
