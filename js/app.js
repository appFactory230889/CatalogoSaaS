// Panel principal de la administradora del negocio.
import {
  auth, db, configLista, onAuthStateChanged, signOut, ref, get
} from "./firebase.js";
import {
  CATEGORIAS, leerNegocio, registrarNegocio, formatearCliente, pintarUsoPlan, LINK_SUSCRIPCION
} from "./datos.js";
import { linkCatalogo, compartirLink } from "./compartir.js";
import { iniciarPagos } from "./pagos.js";

const $ = (id) => document.getElementById(id);
const vistas = {
  cargando: $("vista-cargando"),
  onboarding: $("vista-onboarding"),
  panel: $("vista-panel")
};

let usuario = null;

function mostrarVista(nombre) {
  Object.entries(vistas).forEach(([k, el]) => (el.hidden = k !== nombre));
}

let toastTimer;
function toast(texto) {
  const el = $("toast");
  el.textContent = texto;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 2600);
}

async function contarPorCategoria(uid) {
  const conteo = {};
  try {
    const snap = await get(ref(db, `productos/${uid}`));
    snap.forEach((hijo) => {
      const cat = hijo.child("categoria").val();
      if (typeof cat === "string") conteo[cat] = (conteo[cat] || 0) + 1;
    });
  } catch (err) {
    console.error(err);
  }
  return conteo;
}

function pintarCategorias(conteo) {
  const grid = $("grid-categorias");
  grid.innerHTML = "";
  CATEGORIAS.forEach((c) => {
    const tarjeta = document.createElement("div");
    tarjeta.className = "categoria-tarjeta";
    tarjeta.style.setProperty("--acento", c.color);
    tarjeta.innerHTML = `
      <a class="categoria" href="categoria.html?c=${c.id}">
        <span class="categoria-icono" aria-hidden="true">${c.icono}</span>
        <span class="categoria-nombre"></span>
        <span class="categoria-detalle"></span>
      </a>
      <a class="categoria-config" href="configuracion.html?c=${c.id}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </a>`;
    tarjeta.querySelector(".categoria-nombre").textContent = c.nombre;
    tarjeta.querySelector(".categoria-config").setAttribute("aria-label", `Configuración de ${c.nombre}`);
    tarjeta.querySelector(".categoria-config").title = `Configuración de ${c.nombre}`;
    const n = conteo[c.id] || 0;
    tarjeta.querySelector(".categoria-detalle").textContent = `${n} producto${n === 1 ? "" : "s"}`;
    grid.appendChild(tarjeta);
  });
}

function pintarUso(negocio) {
  pintarUsoPlan(negocio, (usados, limite) => `${usados} de ${limite} productos usados`);
  $("codigo-cliente").textContent = formatearCliente(negocio.codigoCliente);
}

function prepararCompartir(negocio) {
  const url = linkCatalogo(negocio.codigoCliente);
  $("link-catalogo").textContent = url;
  $("btn-ver-catalogo").href = url;
  $("btn-compartir").onclick = () =>
    compartirLink({ url, titulo: negocio.nombre, texto: `Mira el catálogo de ${negocio.nombre}` }, toast);
}

async function mostrarPanel(negocio) {
  prepararCompartir(negocio);
  $("saludo").textContent = `Hola, ${negocio.nombre}`;
  document.title = `${negocio.nombre} · App Factory Catalog`;
  pintarUso(negocio);
  iniciarPagos({ usuario, negocio, toast });
  // Cuenta bloqueada por App Factory: aviso y sin acceso a categorías ni a compartir.
  const bloqueada = !!negocio.bloqueo;
  $("aviso-bloqueo").hidden = !bloqueada;
  if (bloqueada) {
    $("bloqueo-motivo").textContent = `Motivo: ${negocio.bloqueo.motivo}`;
    $("bloqueo-whatsapp").href = LINK_SUSCRIPCION;
  }
  document.querySelector(".compartir").hidden = bloqueada;
  $("grid-categorias").hidden = bloqueada;
  pintarCategorias({});
  mostrarVista("panel");
  pintarCategorias(await contarPorCategoria(usuario.uid));
}

async function cargarNegocio(user) {
  try {
    let negocio = await leerNegocio(user.uid);
    if (!negocio.nombre) {
      mostrarVista("onboarding");
      $("nombre-negocio").focus();
      return;
    }
    if (!negocio.codigoCliente) {
      // Negocio creado antes de existir los códigos: asignarle uno.
      await registrarNegocio(user, negocio.nombre);
      negocio = await leerNegocio(user.uid);
    }
    await mostrarPanel(negocio);
  } catch (err) {
    console.error(err);
    mostrarVista("onboarding");
    $("msg-negocio").textContent = "No se pudo leer tu negocio. Revisa tu conexión o las reglas de la base de datos.";
  }
}

$("form-negocio").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nombre = $("nombre-negocio").value.trim().replace(/\s+/g, " ");
  const msg = $("msg-negocio");
  if (nombre.length < 2) {
    msg.textContent = "Escribe el nombre de tu negocio.";
    return;
  }
  const btn = $("btn-guardar-negocio");
  btn.disabled = true;
  msg.textContent = "";
  try {
    await registrarNegocio(usuario, nombre);
    await mostrarPanel(await leerNegocio(usuario.uid));
    toast("¡Negocio guardado!");
  } catch (err) {
    console.error(err);
    msg.textContent = "No se pudo guardar. Intenta de nuevo.";
  } finally {
    btn.disabled = false;
  }
});

$("btn-salir").addEventListener("click", async () => {
  await signOut(auth);
  location.replace("index.html");
});

if (!configLista) {
  location.replace("index.html");
} else {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      location.replace("index.html");
      return;
    }
    usuario = user;
    $("contacto").textContent = user.email || "";
    // El botón "Admin" solo aparece para las cuentas de App Factory (admins/{uid} = true).
    get(ref(db, `admins/${user.uid}`))
      .then((s) => { $("link-admin").hidden = s.val() !== true; })
      .catch(() => {});
    cargarNegocio(user);
  });
}
