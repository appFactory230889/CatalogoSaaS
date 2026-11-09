// Catálogo PÚBLICO de un negocio: solo lectura, sin iniciar sesión.
// Link: catalogo.html?t=001  (t = código de cliente)
// Las reglas de Firebase solo permiten LEER aquí; nadie puede modificar nada desde esta página.
import { db, configLista, ref, get } from "./firebase.js";
import {
  CATEGORIAS, categoriaPorId, formatearPrecio, num,
  leerConfigRopa, leerPresentaciones, tieneVariosPrecios
} from "./datos.js";
import { crearSelectorPresentaciones } from "./presentaciones.js";

const $ = (id) => document.getElementById(id);

let productos = [];
let filtroCategoria = "todas";
let configRopa = { telas: [], tallas: [] };
const selector = crearSelectorPresentaciones({
  contTelas: $("detalle-telas"), contTallas: $("detalle-tallas"),
  elTela: $("detalle-tela"), elTalla: $("detalle-talla"),
  elPrecio: $("detalle-precio"), elNota: $("detalle-nota")
});

function mostrar(vista) {
  ["cargando", "error", "catalogo"].forEach((v) => ($(`vista-${v}`).hidden = v !== vista));
}

function error(texto) {
  if (texto) $("error-texto").textContent = texto;
  mostrar("error");
}

let toastTimer;
function toast(texto) {
  const el = $("toast");
  el.textContent = texto;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 2600);
}

async function cargar() {
  const t = new URLSearchParams(location.search).get("t") || "";
  const codigoCliente = parseInt(t, 10);
  if (!/^\d{1,6}$/.test(t) || !codigoCliente) return error();

  const uid = (await get(ref(db, `codigosCliente/${codigoCliente}`))).val();
  if (typeof uid !== "string") return error();

  const [snapNombre, snapProductos, config] = await Promise.all([
    get(ref(db, `negocios/${uid}/nombre`)),
    get(ref(db, `productos/${uid}`)),
    leerConfigRopa(uid).catch(() => ({ telas: [], tallas: [] }))
  ]);
  configRopa = config;
  const nombre = typeof snapNombre.val() === "string" ? snapNombre.val() : "Catálogo";

  const lista = [];
  snapProductos.forEach((hijo) => {
    const d = hijo.val() || {};
    // Solo productos completos y disponibles (los inhabilitados no se muestran).
    if (d.disponible === false) return;
    if (typeof d.foto !== "string" || typeof d.codigo !== "string") return;
    if (!categoriaPorId(d.categoria)) return;
    lista.push({
      numero: num(d.numero), codigo: d.codigo, categoria: d.categoria,
      precio: num(d.precioDesde, num(d.precio)), foto: d.foto,
      presentaciones: leerPresentaciones(d.presentaciones)
    });
  });
  productos = lista.sort((a, b) => b.numero - a.numero);

  document.title = `${nombre} · Catálogo`;
  $("titulo-tienda").textContent = nombre;
  $("nombre-tienda").textContent = nombre;
  $("resumen").textContent = productos.length
    ? `${productos.length} producto${productos.length === 1 ? "" : "s"} disponibles`
    : "Este catálogo todavía no tiene productos.";
  document.querySelector(".filtros").hidden = productos.length === 0;
  pintarChips();
  pintarGrid();
  mostrar("catalogo");
}

function pintarChips() {
  const cont = $("chips-categorias");
  cont.innerHTML = "";
  const presentes = CATEGORIAS.filter((c) => productos.some((p) => p.categoria === c.id));
  if (presentes.length < 2) return; // con una sola categoría no hace falta filtrar
  [{ id: "todas", nombre: "Todas", icono: "✨" }, ...presentes].forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (filtroCategoria === c.id ? " activo" : "");
    b.textContent = `${c.icono} ${c.nombre}`;
    b.addEventListener("click", () => {
      filtroCategoria = c.id;
      pintarChips();
      pintarGrid();
    });
    cont.appendChild(b);
  });
}

function pintarGrid() {
  const texto = $("buscar").value.trim().replace(/\s+/g, "");
  const visibles = productos.filter((p) =>
    (filtroCategoria === "todas" || p.categoria === filtroCategoria) &&
    (!texto || p.codigo.includes(texto))
  );
  const grid = $("grid");
  grid.innerHTML = "";
  $("sin-resultados").hidden = visibles.length > 0 || productos.length === 0;
  visibles.forEach((p) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "producto producto-publico";
    card.innerHTML = `
      <div class="producto-foto"><img loading="lazy" alt=""></div>
      <div class="producto-info">
        <div class="producto-fila">
          <strong class="producto-codigo"></strong>
          <span class="producto-precio"></span>
        </div>
      </div>`;
    card.querySelector("img").src = p.foto;
    card.querySelector("img").alt = `Producto ${p.codigo}`;
    card.querySelector(".producto-codigo").textContent = p.codigo;
    card.querySelector(".producto-precio").textContent =
      (tieneVariosPrecios(p.presentaciones) ? "desde " : "") + formatearPrecio(p.precio);
    card.addEventListener("click", () => abrirDetalle(p));
    grid.appendChild(card);
  });
}

function abrirDetalle(p) {
  $("detalle-img").src = p.foto;
  $("detalle-img").alt = `Producto ${p.codigo}`;
  $("detalle-codigo").textContent = p.codigo;
  const conOpciones = Object.keys(p.presentaciones).length > 0;
  $("detalle-opciones").hidden = !conOpciones;
  if (conOpciones) {
    selector.mostrar(p, configRopa);
  } else {
    $("detalle-precio").textContent = formatearPrecio(p.precio);
    $("detalle-nota").textContent = "";
  }
  $("detalle").showModal();
}

$("detalle-cerrar").addEventListener("click", () => $("detalle").close());
$("detalle").addEventListener("click", (e) => { if (e.target === $("detalle")) $("detalle").close(); });
$("buscar").addEventListener("input", pintarGrid);

// Compartir el mismo link (útil si una clienta quiere reenviarlo).
if (navigator.share) {
  $("btn-compartir").hidden = false;
  $("btn-compartir").addEventListener("click", () =>
    navigator.share({ title: document.title, url: location.href }).catch(() => {})
  );
}

if (!configLista) {
  error("El catálogo no está disponible en este momento.");
} else {
  cargar().catch((err) => {
    console.error(err);
    error("No se pudo cargar el catálogo. Revisa tu conexión e intenta de nuevo.");
  });
}
