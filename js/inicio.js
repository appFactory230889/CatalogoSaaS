// Página de presentación (pública).
import { auth, configLista, onAuthStateChanged } from "./firebase.js";
import { LINK_SUSCRIPCION, PRECIO_PREMIUM_MES } from "./datos.js";

// El precio se define en js/datos.js (PRECIO_PREMIUM_MES). null = "Consultar" (por WhatsApp).
const PRECIO_PREMIUM = PRECIO_PREMIUM_MES ? { monto: `$${PRECIO_PREMIUM_MES}`, periodo: "al mes" } : null;

const $ = (id) => document.getElementById(id);

if (PRECIO_PREMIUM) {
  $("precio-premium").innerHTML = `${PRECIO_PREMIUM.monto} <small></small>`;
  $("precio-premium").querySelector("small").textContent = PRECIO_PREMIUM.periodo;
}
$("link-contacto").href = LINK_SUSCRIPCION;
$("anio").textContent = new Date().getFullYear();

// Si ya tiene sesión, el botón de arriba la lleva directo a su panel.
if (configLista) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      $("btn-ingresar").textContent = "Ir a mi panel";
      $("btn-ingresar").href = "app.html";
    }
  });
}
