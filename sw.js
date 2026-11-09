// Service worker de App Factory Catalog (necesario para "Instalar app").
// A propósito NO guarda archivos en caché: así nunca se mezclan versiones viejas y nuevas.
// Su único trabajo extra es mostrar un aviso amable cuando no hay internet.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

const SIN_CONEXION = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Sin conexión</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;
background:#F5F7FB;color:#141C33;text-align:center;padding:24px}h1{font-size:1.3rem;color:#1E2F5C}
button{font:inherit;font-weight:600;margin-top:16px;padding:12px 20px;border:0;border-radius:10px;
background:#1E2F5C;color:#fff}</style></head><body><div><p style="font-size:2.5rem">📶</p>
<h1>Sin conexión a internet</h1><p>Revisa tu conexión y vuelve a intentarlo.</p>
<button onclick="location.reload()">Reintentar</button></div></body></html>`;

self.addEventListener("fetch", (e) => {
  // Solo las páginas (no imágenes ni Firebase): si falla la red, mostrar el aviso.
  if (e.request.mode !== "navigate") return;
  e.respondWith(
    fetch(e.request).catch(() => new Response(SIN_CONEXION, { headers: { "Content-Type": "text/html; charset=utf-8" } }))
  );
});
