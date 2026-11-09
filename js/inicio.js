// Página de presentación (pública).
import { auth, configLista, onAuthStateChanged } from "./firebase.js";
import { PRECIO_PREMIUM_MES, CONTACTO, linkWhatsApp } from "./datos.js";
import { registrarServiceWorker } from "./instalar.js";

registrarServiceWorker();

// El precio se define en js/datos.js (PRECIO_PREMIUM_MES). null = "Consultar" (por WhatsApp).
const PRECIO_PREMIUM = PRECIO_PREMIUM_MES ? { monto: `$${PRECIO_PREMIUM_MES}`, periodo: "al mes" } : null;

const $ = (id) => document.getElementById(id);

if (PRECIO_PREMIUM) {
  $("precio-premium").innerHTML = `${PRECIO_PREMIUM.monto} <small></small>`;
  $("precio-premium").querySelector("small").textContent = PRECIO_PREMIUM.periodo;
}
$("link-whatsapp").href = linkWhatsApp("Hola, quiero información sobre App Factory Catalog.");
$("texto-telefono").textContent = CONTACTO.telefono;
$("link-correo").href = `mailto:${CONTACTO.correo}?subject=${encodeURIComponent("App Factory Catalog")}`;
$("texto-correo").textContent = CONTACTO.correo;
$("anio").textContent = new Date().getFullYear();

// Con sesión iniciada: directo al panel (salvo con ?ver=inicio, para ver esta página a propósito).
const verInicio = new URLSearchParams(location.search).has("ver");
const mostrarPagina = () => document.documentElement.classList.remove("redirigiendo");
setTimeout(mostrarPagina, 4000); // por si Firebase tarda en responder

if (configLista) {
  onAuthStateChanged(auth, (user) => {
    if (user && !verInicio) {
      location.replace("app.html");
      return;
    }
    if (user) {
      $("btn-ingresar").textContent = "Ir a mi panel";
      $("btn-ingresar").href = "app.html";
    } else {
      try { localStorage.removeItem("afc-sesion"); } catch {}
    }
    mostrarPagina();
  });
} else {
  mostrarPagina();
}
