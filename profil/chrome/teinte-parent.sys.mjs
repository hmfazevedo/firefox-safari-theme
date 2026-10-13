// teinte-parent.sys.mjs : côté interface. Reçoit la couleur mesurée par teinte-child.sys.mjs et la passe à la fenêtre du
// navigateur qui affiche cette page (urlbar-domaine.uc.js y a posé window.ucTeinteRecue).
export class UcTeinteParent extends JSWindowActorParent {
  receiveMessage(msg) {
    if (msg.name === "UcTeinte:Erreur") {
      console.error("teinte (page) :", msg.data);
      return;
    }
    if (msg.name !== "UcTeinte:Couleur") {
      return;
    }
    const navigateur = this.browsingContext?.top?.embedderElement;
    // ownerDocument.defaultView plutôt que ownerGlobal : ce dernier revient « undefined » sur cet élément dans certains contextes
    const fenetre = navigateur?.ownerDocument?.defaultView;
    if (fenetre && typeof fenetre.ucTeinteRecue === "function") {
      fenetre.ucTeinteRecue(navigateur, msg.data);
    }
  }
}
