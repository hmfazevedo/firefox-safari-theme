// tint-parent.sys.mjs: interface side. Receives the colour measured by tint-child.sys.mjs and hands it to the browser window that
// displays that page (safari-theme.uc.js set window.ucTintReceived there).
export class UcTintParent extends JSWindowActorParent {
  receiveMessage(msg) {
    if (msg.name === "UcTint:Error") {
      console.error("tint (page):", msg.data);
      return;
    }
    if (msg.name !== "UcTint:Color") {
      return;
    }
    const browser = this.browsingContext?.top?.embedderElement;
    // ownerDocument.defaultView rather than ownerGlobal: the latter comes back "undefined" on this element in some contexts
    const win = browser?.ownerDocument?.defaultView;
    if (win && typeof win.ucTintReceived === "function") {
      win.ucTintReceived(browser, msg.data);
    }
  }
}
