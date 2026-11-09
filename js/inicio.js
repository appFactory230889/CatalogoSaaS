// Página de presentación (pública).
import { auth, configLista, onAuthStateChanged } from "./firebase.js";
import { LINK_SUSCRIPCION } from "./datos.js";

// Precio del plan Premium que se muestra en la página. null = "Consultar" (por WhatsApp).
// Cuando lo definas, cámbialo aquí, ej.: const PRECIO_PREMIUM = { monto: "$8", periodo: "al mes" };
const PRECIO_PREMIUM = null;

const $ = (id) => document.getElementById(id);

if (PRECIO_PREMIUM) {
  $("precio-premium").innerHTML = `${PRECIO_PREMIUM.monto} <small></small>`;
  $("precio-premium").querySelector("small").textContent = PRECIO_PREMIUM.periodo;
}
$("btn-premium").href = LINK_SUSCRIPCION;
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
