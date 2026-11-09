# Servidor local para probar el sitio en http://localhost:8120
# Igual que "python -m http.server", pero le dice al navegador que NO guarde
# los archivos en caché (así nunca se mezclan versiones viejas y nuevas del JS).
# Uso:  python servidor-local.py
import http.server
import os
import sys

PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8120
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class SinCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


http.server.ThreadingHTTPServer(("", PUERTO), SinCache).serve_forever()
