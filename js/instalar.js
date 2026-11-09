// "Instalar app" (PWA): registra el service worker y muestra el botón para instalar.
//  - Android / Chrome / Edge: botón que abre el instalador del navegador.
//  - iPhone (Safari): instrucciones, porque Apple no permite instalar con un botón.
//  - Si ya está instalada (abierta como app), no muestra nada.

export function registrarServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((err) => console.warn("Service worker:", err));
  }
}

const yaInstalada = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

const esIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);

/** Conecta el recuadro #instalar-app del panel. */
export function iniciarInstalacion() {
  registrarServiceWorker();
  const caja = document.getElementById("instalar-app");
  if (!caja || yaInstalada()) return;

  const boton = caja.querySelector("button");
  const texto = caja.querySelector(".instalar-texto");
  let pedido = null;

  // Ocultarla si la cerró antes (recordado solo en este navegador)
  const CLAVE = "afc-instalar-cerrado";
  const cerrado = () => { try { return localStorage.getItem(CLAVE) === "1"; } catch { return false; } };
  caja.querySelector(".instalar-cerrar").onclick = () => {
    caja.hidden = true;
    try { localStorage.setItem(CLAVE, "1"); } catch {}
  };
  if (cerrado()) return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    pedido = e;
    boton.hidden = false;
    caja.hidden = false;
  });

  boton.onclick = async () => {
    if (!pedido) return;
    pedido.prompt();
    const { outcome } = await pedido.userChoice;
    pedido = null;
    if (outcome === "accepted") caja.hidden = true;
  };

  window.addEventListener("appinstalled", () => { caja.hidden = true; });

  if (esIphone()) {
    texto.innerHTML = "Tócala abajo en <strong>Compartir</strong> <span aria-hidden='true'>⬆️</span> y elige <strong>«Agregar a inicio»</strong>.";
    boton.hidden = true;
    caja.hidden = false;
  }
}
