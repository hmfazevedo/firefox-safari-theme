"""Minimal, dependency-free Marionette client: drives a TEST Firefox to measure how the theme renders.

Usage (see docs/DEVELOPMENT.md, "Testing without touching your profile"):

    from marionette import Marionette
    m = Marionette()                       # connects to 127.0.0.1:2828
    m.chrome()                             # "browser UI" context (gBrowser, gURLBar, the window's document...)
    print(m.run("return gBrowser.currentURI.spec;"))
    m.content()                            # "web page" context
    print(m.run("return document.title;"))

Start the test Firefox with:  firefox.exe -no-remote -marionette -remote-allow-system-access -profile <throwaway profile>
Firefox 159 and later: also set the environment variable MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1 (the flag alone is no longer enough).
"""
import json
import socket


class Marionette:
    def __init__(self, host="127.0.0.1", port=2828, timeout=60):
        self.s = socket.create_connection((host, port), timeout=timeout)
        self.buf = b""
        self.i = 0
        self._receive()  # welcome message
        self.call("WebDriver:NewSession", {"capabilities": {}})

    def _receive(self):
        while b":" not in self.buf:
            self.buf += self.s.recv(65536)
        n, rest = self.buf.split(b":", 1)
        n = int(n)
        while len(rest) < n:
            rest += self.s.recv(65536)
        msg, self.buf = rest[:n], rest[n:]
        return json.loads(msg)

    def call(self, name, params=None):
        self.i += 1
        body = json.dumps([0, self.i, name, params or {}]).encode()
        self.s.sendall(str(len(body)).encode() + b":" + body)
        while True:
            r = self._receive()
            if r[0] == 1 and r[1] == self.i:
                return r

    def chrome(self):
        self.call("Marionette:SetContext", {"value": "chrome"})

    def content(self):
        self.call("Marionette:SetContext", {"value": "content"})

    def run(self, js, timeout=30000):
        """Runs `js` (a function body: use `return`) and returns its value."""
        r = self.call("WebDriver:ExecuteScript", {"script": js, "args": [], "timeout": timeout})
        res = r[3] if r[2] is None else r[2]
        if "value" not in res:
            raise RuntimeError(json.dumps(res, ensure_ascii=False)[:500])
        return res["value"]

    def mouse(self, x, y, click=False):
        """Moves (and clicks) the virtual mouse, in CSS pixels of the window."""
        actions = [{"type": "pointerMove", "x": int(x), "y": int(y), "origin": "viewport", "duration": 0}]
        if click:
            actions += [{"type": "pointerDown", "button": 0}, {"type": "pointerUp", "button": 0}]
        self.call("WebDriver:PerformActions", {"actions": [{"type": "pointer", "id": "mouse", "parameters": {"pointerType": "mouse"}, "actions": actions}]})
