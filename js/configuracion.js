// ⚙️ Configuración de una categoría: variantes (telas, colores…), tallas (con cm si aplica)
// y listas de atributos (tipos de zapato…). Todo según js/especificaciones.js.
import { auth, db, configLista, onAuthStateChanged, ref, get } from "./firebase.js";
import {
  categoriaPorId, asegurarConfigCategoria, guardarConfigCategoria, leerPresentaciones, nuevoId
} from "./datos.js";
import { especDe } from "./especificaciones.js";

const $ = (id) => document.getElementById(id);
const categoria = categoriaPorId(new URLSearchParams(location.search).get("c"));
const espec = especDe(categoria?.id);

let uid = null;
let config = null;
let uso = { variantes: {}, tallas: {}, listas: {} }; // cuántos productos usan cada opción

let toastTimer;
function toast(texto) {
  const el = $("toast");
  el.textContent = texto;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 2600);
}

async function contarUso() {
  uso = { variantes: {}, tallas: {}, listas: {} };
  const suma = (obj, id) => (obj[id] = (obj[id] || 0) + 1);
  const snap = await get(ref(db, `productos/${uid}`));
  snap.forEach((hijo) => {
    if (hijo.child("categoria").val() !== categoria.id) return;
    const pres = leerPresentaciones(hijo.child("presentaciones").val());
    const tallasDelProducto = new Set();
    Object.entries(pres).forEach(([id, pr]) => {
      suma(uso.variantes, id);
      Object.keys(pr.precios).forEach((t) => tallasDelProducto.add(t));
    });
    tallasDelProducto.forEach((t) => suma(uso.tallas, t));
    espec.atributos.filter((a) => a.lista).forEach((a) => {
      const v = hijo.child(`atributos/${a.clave}`).val();
      uso.listas[a.lista] ??= {};
      if (typeof v === "string") suma(uso.listas[a.lista], v);
    });
  });
}

async function guardar(mensaje) {
  try {
    await guardarConfigCategoria(uid, categoria.id, config);
    if (mensaje) toast(mensaje);
  } catch (err) {
    console.error(err);
    toast("No se pudo guardar. Revisa tu conexión.");
  }
}

/**
 * Tarjeta con una lista editable.
 * opciones: { titulo, ayuda, ejemplo, maxLargo, items, conteo, conCm, etiqueta }
 */
function crearTarjeta(o) {
  const tarjeta = document.createElement("div");
  tarjeta.className = "tarjeta";
  tarjeta.innerHTML = `
    <h2></h2>
    <p class="sub"></p>
    <ul class="lista-editable${o.conCm ? " con-cm" : ""}"></ul>
    <form class="fila-agregar">
      <input type="text" autocomplete="off">
      <button type="submit" class="btn btn-primario">Agregar</button>
    </form>
    <p class="mensaje" role="alert"></p>`;
  tarjeta.querySelector("h2").textContent = o.titulo;
  tarjeta.querySelector(".sub").textContent = o.ayuda;
  const input = tarjeta.querySelector("form input");
  input.placeholder = o.ejemplo;
  input.maxLength = o.maxLargo;
  const ul = tarjeta.querySelector("ul");
  const msg = tarjeta.querySelector(".mensaje");

  function pintar() {
    ul.innerHTML = "";
    if (o.conCm) {
      ul.innerHTML = `<li class="lista-encabezado"><span>Talla</span><span>Largo del pie (cm)</span></li>`;
    }
    o.items.forEach((item, i) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <input type="text" class="nombre" aria-label="Nombre">
        ${o.conCm ? `<input type="number" class="cm" min="0" max="49" step="0.1" placeholder="cm" aria-label="Largo del pie en cm">` : ""}
        <span class="uso-item"></span>
        <button type="button" class="btn-icono" data-acc="subir" title="Subir" aria-label="Subir">↑</button>
        <button type="button" class="btn-icono" data-acc="bajar" title="Bajar" aria-label="Bajar">↓</button>
        <button type="button" class="btn-icono" data-acc="borrar" title="Borrar" aria-label="Borrar">✕</button>`;
      const nombre = li.querySelector(".nombre");
      nombre.value = item.nombre;
      nombre.maxLength = o.maxLargo;
      const n = o.conteo()[item.id] || 0;
      li.querySelector(".uso-item").textContent = n ? `${n} prod.` : "";
      li.querySelector('[data-acc="subir"]').disabled = i === 0;
      li.querySelector('[data-acc="bajar"]').disabled = i === o.items.length - 1;

      nombre.addEventListener("change", () => {
        const v = nombre.value.trim().replace(/\s+/g, " ");
        if (!v || o.items.some((x) => x !== item && x.nombre.toLowerCase() === v.toLowerCase())) {
          nombre.value = item.nombre;
          toast(v ? `Ya existe "${v}"` : "El nombre no puede quedar vacío");
          return;
        }
        item.nombre = v;
        guardar("Nombre actualizado");
      });

      if (o.conCm) {
        const cm = li.querySelector(".cm");
        cm.value = item.cm ?? "";
        cm.addEventListener("change", () => {
          const v = Math.round(parseFloat(cm.value) * 10) / 10;
          if (Number.isFinite(v) && v > 0 && v < 50) item.cm = v;
          else { delete item.cm; cm.value = ""; }
          guardar("Guía de tallas actualizada");
        });
      }

      li.addEventListener("click", (e) => {
        const acc = e.target.closest("button")?.dataset.acc;
        if (!acc) return;
        if (acc === "borrar") {
          if (n) {
            alert(`"${item.nombre}" se usa en ${n} producto(s).\n\nPara borrarlo, primero borra esos productos. Si solo quieres cambiarle el nombre, escríbelo encima.`);
            return;
          }
          if (!confirm(`¿Borrar "${item.nombre}"?`)) return;
          o.items.splice(i, 1);
          guardar(`"${item.nombre}" borrado`);
        } else {
          const j = acc === "subir" ? i - 1 : i + 1;
          [o.items[i], o.items[j]] = [o.items[j], o.items[i]];
          guardar();
        }
        pintar();
      });
      ul.appendChild(li);
    });
    if (!o.items.length) ul.innerHTML = `<li class="lista-vacia">Todavía no hay ${o.etiqueta}.</li>`;
  }

  tarjeta.querySelector("form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value.trim().replace(/\s+/g, " ");
    msg.textContent = "";
    if (!v) return;
    if (o.items.some((x) => x.nombre.toLowerCase() === v.toLowerCase())) {
      msg.textContent = `Ya existe "${v}".`;
      return;
    }
    o.items.push({ id: nuevoId(), nombre: v });
    input.value = "";
    pintar();
    guardar(`"${v}" agregado`);
  });

  pintar();
  return tarjeta;
}

function pintarTarjetas() {
  const cont = $("tarjetas-config");
  cont.innerHTML = "";
  const v = espec.variante;
  cont.appendChild(crearTarjeta({
    titulo: v.titulo, ayuda: v.ayuda, ejemplo: v.ejemplo, maxLargo: 40,
    items: config.variantes, conteo: () => uso.variantes, etiqueta: v.plural
  }));
  const t = espec.tallas;
  cont.appendChild(crearTarjeta({
    titulo: t.plural[0].toUpperCase() + t.plural.slice(1),
    ayuda: t.conCm
      ? "En el orden en que se mostrarán. Agrega el largo del pie en cm: tus clientas lo verán como guía de tallas."
      : `En el orden en que se mostrarán. El precio puede cambiar según ${t.femenino ? "la" : "el"} ${t.singular}.`,
    ejemplo: t.ejemplo, maxLargo: 20, conCm: t.conCm,
    items: config.tallas, conteo: () => uso.tallas, etiqueta: t.plural
  }));
  espec.atributos.filter((a) => a.lista).forEach((a) => {
    config.listas[a.lista] ??= [];
    cont.appendChild(crearTarjeta({
      titulo: a.tituloLista, ayuda: a.ayudaLista, ejemplo: a.ejemplo, maxLargo: 40,
      items: config.listas[a.lista], conteo: () => uso.listas[a.lista] || {}, etiqueta: a.tituloLista.toLowerCase()
    }));
  });
}

async function iniciar(user) {
  uid = user.uid;
  $("cat-icono").textContent = categoria.icono;
  $("cat-nombre").textContent = categoria.nombre;
  document.title = `Configuración de ${categoria.nombre} · App Factory`;
  if (espec) {
    config = await asegurarConfigCategoria(uid, categoria.id);
    await contarUso();
    pintarTarjetas();
    $("ir-categoria").href = `categoria.html?c=${categoria.id}`;
    $("ir-categoria").textContent = `Ir a mis productos de ${categoria.nombre} →`;
    $("vista-espec").hidden = false;
  } else {
    $("vista-proximamente").hidden = false;
  }
  $("vista-cargando").hidden = true;
  $("vista-config").hidden = false;
}

if (!configLista || !categoria) {
  location.replace(configLista ? "app.html" : "index.html");
} else {
  onAuthStateChanged(auth, (user) => {
    if (!user) { location.replace("index.html"); return; }
    iniciar(user).catch((err) => {
      console.error(err);
      $("vista-cargando").innerHTML = "<p>No se pudo cargar la configuración. Revisa tu conexión o las reglas de Firebase.</p>";
    });
  });
}
