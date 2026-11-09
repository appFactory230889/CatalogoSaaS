// Panel principal de la administradora del negocio.
import {
  auth, db, configLista, onAuthStateChanged, signOut, ref, get
} from "./firebase.js";
import {
  CATEGORIAS, leerNegocio, registrarNegocio, formatearCliente
} from "./datos.js";

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
    const a = document.createElement("a");
    a.className = "categoria";
    a.href = `categoria.html?c=${c.id}`;
    a.style.setProperty("--acento", c.color);
    a.innerHTML = `
      <span class="categoria-icono" aria-hidden="true">${c.icono}</span>
      <span class="categoria-nombre"></span>
      <span class="categoria-detalle"></span>`;
    a.querySelector(".categoria-nombre").textContent = c.nombre;
    const n = conteo[c.id] || 0;
    a.querySelector(".categoria-detalle").textContent = `${n} producto${n === 1 ? "" : "s"}`;
    grid.appendChild(a);
  });
}

function pintarUso(negocio) {
  const usados = negocio.totalItems;
  const pct = Math.min(100, Math.round((usados / negocio.limite) * 100));
  $("uso-texto").textContent = `${usados} de ${negocio.limite} productos usados`;
  $("uso-barra").style.width = pct + "%";
  $("uso").classList.toggle("lleno", usados >= negocio.limite);
  $("codigo-cliente").textContent = formatearCliente(negocio.codigoCliente);
}

async function mostrarPanel(negocio) {
  $("saludo").textContent = `Hola, ${negocio.nombre}`;
  document.title = `${negocio.nombre} · App Factory`;
  pintarUso(negocio);
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
    cargarNegocio(user);
  });
}
