"""Client Marionette minimal, sans dépendance : pilote un Firefox de TEST pour mesurer le rendu de la personnalisation.

Utilisation (voir README.md, section « Tester sans toucher à votre profil ») :

    from marionette import Marionette
    m = Marionette()                       # se connecte à 127.0.0.1:2828
    m.chrome()                             # contexte « interface » (gBrowser, gURLBar, document de la fenêtre…)
    print(m.run("return gBrowser.currentURI.spec;"))
    m.contenu()                            # contexte « page web »
    print(m.run("return document.title;"))

Le Firefox de test se lance avec :  firefox.exe -no-remote -marionette -remote-allow-system-access -profile <profil jetable>
"""
import json
import socket


class Marionette:
    def __init__(self, hote="127.0.0.1", port=2828, delai=60):
        self.s = socket.create_connection((hote, port), timeout=delai)
        self.buf = b""
        self.i = 0
        self._recevoir()  # message d'accueil
        self.appeler("WebDriver:NewSession", {"capabilities": {}})

    def _recevoir(self):
        while b":" not in self.buf:
            self.buf += self.s.recv(65536)
        n, reste = self.buf.split(b":", 1)
        n = int(n)
        while len(reste) < n:
            reste += self.s.recv(65536)
        msg, self.buf = reste[:n], reste[n:]
        return json.loads(msg)

    def appeler(self, nom, params=None):
        self.i += 1
        corps = json.dumps([0, self.i, nom, params or {}]).encode()
        self.s.sendall(str(len(corps)).encode() + b":" + corps)
        while True:
            r = self._recevoir()
            if r[0] == 1 and r[1] == self.i:
                return r

    def chrome(self):
        self.appeler("Marionette:SetContext", {"value": "chrome"})

    def contenu(self):
        self.appeler("Marionette:SetContext", {"value": "content"})

    def run(self, js, delai=30000):
        """Exécute `js` (corps de fonction : utilisez `return`) et renvoie la valeur."""
        r = self.appeler("WebDriver:ExecuteScript", {"script": js, "args": [], "timeout": delai})
        res = r[3] if r[2] is None else r[2]
        if "value" not in res:
            raise RuntimeError(json.dumps(res, ensure_ascii=False)[:500])
        return res["value"]

    def souris(self, x, y, clic=False):
        """Déplace (et clique) la souris virtuelle, en pixels CSS de la fenêtre."""
        actions = [{"type": "pointerMove", "x": int(x), "y": int(y), "origin": "viewport", "duration": 0}]
        if clic:
            actions += [{"type": "pointerDown", "button": 0}, {"type": "pointerUp", "button": 0}]
        self.appeler("WebDriver:PerformActions", {"actions": [{"type": "pointer", "id": "souris", "parameters": {"pointerType": "mouse"}, "actions": actions}]})
