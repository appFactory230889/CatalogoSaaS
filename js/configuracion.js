// Configuración de la categoría: telas y tallas de Ropa, guardadas en Firebase.
import { auth, db, configLista, onAuthStateChanged, ref, get } from "./firebase.js";
import {
  categoriaPorId, asegurarConfigRopa, guardarConfigRopa, leerPresentaciones, nuevoId
} from "./datos.js";

const $ = (id) => document.getElementById(id);
const categoria = categoriaPorId(new URLSearchParams(location.search).get("c"));

let uid = null;
let config = { telas: [], tallas: [] };
let uso = { telas: {}, tallas: {} }; // cuántos productos usan cada tela/talla

let toastTimer;
function toast(texto) {
  const el = $("toast");
  el.textContent = texto;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 2600);
}

async function contarUso() {
  uso = { telas: {}, tallas: {} };
  const snap = await get(ref(db, `productos/${uid}`));
  snap.forEach((hijo) => {
    if (hijo.child("categoria").val() !== "ropa") return;
    const pres = leerPresentaciones(hijo.child("presentaciones").val());
    const tallasDelProducto = new Set();
    Object.entries(pres).forEach(([telaId, pr]) => {
      uso.telas[telaId] = (uso.telas[telaId] || 0) + 1;
      Object.keys(pr.precios).forEach((t) => tallasDelProducto.add(t));
    });
    tallasDelProducto.forEach((t) => (uso.tallas[t] = (uso.tallas[t] || 0) + 1));
  });
}

async function guardar(mensaje) {
  try {
    await guardarConfigRopa(uid, config);
    if (mensaje) toast(mensaje);
  } catch (err) {
    console.error(err);
    toast("No se pudo guardar. Revisa tu conexión.");
  }
}

function pintarLista(ul, items, tipo, conteo) {
  ul.innerHTML = "";
  items.forEach((item, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <input type="text" maxlength="${tipo === "tallas" ? 12 : 40}" aria-label="Nombre">
      <span class="uso-item"></span>
      <button type="button" class="btn-icono" data-acc="subir" title="Subir" aria-label="Subir">↑</button>
      <button type="button" class="btn-icono" data-acc="bajar" title="Bajar" aria-label="Bajar">↓</button>
      <button type="button" class="btn-icono" data-acc="borrar" title="Borrar" aria-label="Borrar">✕</button>`;
    const input = li.querySelector("input");
    input.value = item.nombre;
    const n = conteo[item.id] || 0;
    li.querySelector(".uso-item").textContent = n ? `${n} prod.` : "";
    li.querySelector('[data-acc="subir"]').disabled = i === 0;
    li.querySelector('[data-acc="bajar"]').disabled = i === items.length - 1;

    input.addEventListener("change", () => {
      const v = input.value.trim().replace(/\s+/g, " ");
      if (!v || items.some((x) => x !== item && x.nombre.toLowerCase() === v.toLowerCase())) {
        input.value = item.nombre;
        toast(v ? `Ya existe "${v}"` : "El nombre no puede quedar vacío");
        return;
      }
      item.nombre = v;
      guardar("Nombre actualizado");
    });

    li.addEventListener("click", (e) => {
      const acc = e.target.closest("button")?.dataset.acc;
      if (!acc) return;
      if (acc === "borrar") {
        if (n) {
          alert(`"${item.nombre}" se usa en ${n} producto(s).\n\nPara borrarla, primero borra esos productos. Si solo quieres cambiarle el nombre, escríbelo encima.`);
          return;
        }
        if (!confirm(`¿Borrar "${item.nombre}"?`)) return;
        items.splice(i, 1);
        guardar(`"${item.nombre}" borrada`);
      } else {
        const j = acc === "subir" ? i - 1 : i + 1;
        [items[i], items[j]] = [items[j], items[i]];
        guardar();
      }
      pintar();
    });
    ul.appendChild(li);
  });
  if (!items.length) ul.innerHTML = `<li class="lista-vacia">No hay ${tipo} todavía.</li>`;
}

function pintar() {
  pintarLista($("lista-telas"), config.telas, "telas", uso.telas);
  pintarLista($("lista-tallas"), config.tallas, "tallas", uso.tallas);
}

function agregar(lista, input, msg, etiqueta) {
  const v = input.value.trim().replace(/\s+/g, " ");
  msg.textContent = "";
  if (!v) return;
  if (lista.some((x) => x.nombre.toLowerCase() === v.toLowerCase())) {
    msg.textContent = `Ya existe "${v}".`;
    return;
  }
  lista.push({ id: nuevoId(), nombre: v });
  input.value = "";
  pintar();
  guardar(`${etiqueta} "${v}" agregada`);
}

$("form-tela").addEventListener("submit", (e) => { e.preventDefault(); agregar(config.telas, $("nueva-tela"), $("msg-tela"), "Tela"); });
$("form-talla").addEventListener("submit", (e) => { e.preventDefault(); agregar(config.tallas, $("nueva-talla"), $("msg-talla"), "Talla"); });

async function iniciar(user) {
  uid = user.uid;
  $("cat-icono").textContent = categoria.icono;
  $("cat-nombre").textContent = categoria.nombre;
  document.title = `Configuración de ${categoria.nombre} · App Factory`;
  if (categoria.id === "ropa") {
    config = await asegurarConfigRopa(uid);
    await contarUso();
    pintar();
    $("vista-ropa").hidden = false;
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
