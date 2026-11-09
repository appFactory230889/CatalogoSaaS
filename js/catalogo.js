// Catálogo PÚBLICO de un negocio: solo lectura, sin iniciar sesión.
// Links:
//   catalogo.html?t=001          catálogo completo: portada con las categorías
//   catalogo.html?t=001&c=ropa   SOLO los productos de esa categoría (sin acceso a las demás)
// Las reglas de Firebase solo permiten LEER aquí; nadie puede modificar nada desde esta página.
import { db, configLista, ref, get } from "./firebase.js";
import {
  CATEGORIAS, categoriaPorId, formatearPrecio, num,
  leerConfigTodas, leerPresentaciones, leerAtributos, tieneVariosPrecios
} from "./datos.js";
import { especDe } from "./especificaciones.js";
import { crearSelectorPresentaciones } from "./presentaciones.js";
import { linkCatalogo, compartirLink, descargarImagen, ICONO_COMPARTIR, ICONO_DESCARGAR } from "./compartir.js";

const $ = (id) => document.getElementById(id);

let productos = [];
let codigoCliente = 0;
let nombreTienda = "Catálogo";
let categoriaActual = null;
let configs = {};           // configuración de cada categoría (variantes, tallas, listas)
let filtro = null;
let productoAbierto = null;          // { clave: "tipo", id } filtro activo dentro de la categoría
const selector = crearSelectorPresentaciones({
  contTelas: $("detalle-telas"), contTallas: $("detalle-tallas"),
  elTela: $("detalle-tela"), elTalla: $("detalle-talla"),
  elPrecio: $("detalle-precio"), elNota: $("detalle-nota"), elGuia: $("detalle-guia")
});

function mostrar(vista) {
  ["cargando", "error", "portada", "categoria"].forEach((v) => ($(`vista-${v}`).hidden = v !== vista));
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
  codigoCliente = parseInt(t, 10);
  if (!/^\d{1,6}$/.test(t) || !codigoCliente) return error();

  const uid = (await get(ref(db, `codigosCliente/${codigoCliente}`))).val();
  if (typeof uid !== "string") return error();

  const [snapNombre, snapProductos, config] = await Promise.all([
    get(ref(db, `negocios/${uid}/nombre`)),
    get(ref(db, `productos/${uid}`)),
    leerConfigTodas(uid).catch(() => ({}))
  ]);
  configs = config;
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
      presentaciones: leerPresentaciones(d.presentaciones),
      atributos: leerAtributos(d.categoria, d.atributos, configs[d.categoria])
    });
  });
  productos = lista.sort((a, b) => b.numero - a.numero);

  nombreTienda = nombre;
  $("titulo-tienda").textContent = nombre;
  $("nombre-tienda").textContent = nombre;

  // Si el link trae una categoría, se muestra SOLO esa (sin botón para ver las demás).
  const inicial = categoriaPorId(new URLSearchParams(location.search).get("c"));
  history.replaceState({ c: inicial?.id ?? null, directo: true }, "");
  if (inicial) mostrarCategoria(inicial, false);
  else mostrarPortada();
}

const cuantos = (catId) => productos.filter((p) => p.categoria === catId).length;
const plural = (n) => `${n} producto${n === 1 ? "" : "s"}`;

function mostrarPortada() {
  categoriaActual = null;
  document.title = `${nombreTienda} · Catálogo`;
  const presentes = CATEGORIAS.filter((c) => cuantos(c.id) > 0);
  $("resumen").textContent = productos.length
    ? "Elige una categoría para ver sus productos."
    : "Este catálogo todavía no tiene productos.";
  $("btn-compartir-todo").hidden = productos.length === 0;

  const grid = $("grid-categorias");
  grid.innerHTML = "";
  presentes.forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "categoria";
    b.style.setProperty("--acento", c.color);
    b.innerHTML = `
      <span class="categoria-icono" aria-hidden="true">${c.icono}</span>
      <span class="categoria-nombre"></span>
      <span class="categoria-detalle"></span>`;
    b.querySelector(".categoria-nombre").textContent = c.nombre;
    b.querySelector(".categoria-detalle").textContent = plural(cuantos(c.id));
    b.addEventListener("click", () => {
      history.pushState({ c: c.id }, "", linkCatalogo(codigoCliente, c.id));
      mostrarCategoria(c, true);
    });
    grid.appendChild(b);
  });
  mostrar("portada");
  window.scrollTo(0, 0);
}

function mostrarCategoria(cat, conVolver) {
  categoriaActual = cat;
  document.title = `${cat.nombre} · ${nombreTienda}`;
  $("cat-icono").textContent = cat.icono;
  $("cat-icono").style.setProperty("--acento", cat.color);
  $("cat-nombre").textContent = cat.nombre;
  const n = cuantos(cat.id);
  $("cat-resumen").textContent = n ? `${plural(n)} disponibles` : "Esta categoría todavía no tiene productos.";
  $("btn-volver").hidden = !conVolver;
  $("btn-compartir-categoria").hidden = n === 0;
  document.querySelector(".filtros").hidden = n === 0;
  $("buscar").value = "";
  filtro = null;
  pintarFiltros();
  pintarGrid();
  mostrar("categoria");
  window.scrollTo(0, 0);
}

// Atrás/adelante del navegador dentro del catálogo completo
window.addEventListener("popstate", (e) => {
  if (!productos) return;
  const cat = categoriaPorId(e.state?.c);
  if (cat) mostrarCategoria(cat, !e.state?.directo);
  else mostrarPortada();
});

/** Chips para filtrar por un atributo (ej. Tipo de zapato), solo con opciones que tengan productos. */
function pintarFiltros() {
  const cont = $("chips-filtro");
  cont.innerHTML = "";
  const espec = especDe(categoriaActual?.id);
  const atributo = espec?.atributos.find((a) => a.filtro);
  if (!atributo) return;
  const enCategoria = productos.filter((p) => p.categoria === categoriaActual.id);
  const presentes = [];
  enCategoria.forEach((p) => {
    const a = p.atributos.find((x) => x.clave === atributo.clave);
    if (a && !presentes.some((x) => x.id === a.id)) presentes.push(a);
  });
  if (presentes.length < 2) return;
  const orden = configs[categoriaActual.id]?.listas?.[atributo.lista] || [];
  presentes.sort((a, b) => orden.findIndex((o) => o.id === a.id) - orden.findIndex((o) => o.id === b.id));
  [{ id: null, nombre: "Todos" }, ...presentes].forEach((o) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + ((filtro?.id ?? null) === o.id ? " activo" : "");
    b.textContent = o.nombre;
    b.addEventListener("click", () => {
      filtro = o.id ? { clave: atributo.clave, id: o.id } : null;
      pintarFiltros();
      pintarGrid();
    });
    cont.appendChild(b);
  });
}

function pintarGrid() {
  const texto = $("buscar").value.trim().replace(/\s+/g, "");
  const visibles = productos.filter((p) =>
    p.categoria === categoriaActual?.id && (!texto || p.codigo.includes(texto)) &&
    (!filtro || p.atributos.some((a) => a.clave === filtro.clave && a.id === filtro.id))
  );
  const grid = $("grid");
  grid.innerHTML = "";
  $("sin-resultados").hidden = visibles.length > 0 || cuantos(categoriaActual?.id) === 0;
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
  productoAbierto = p;
  $("detalle-img").src = p.foto;
  $("detalle-img").alt = `Producto ${p.codigo}`;
  $("detalle-codigo").textContent = p.codigo;
  const conOpciones = Object.keys(p.presentaciones).length > 0;
  $("detalle-opciones").hidden = !conOpciones;
  const espec = especDe(p.categoria);
  const config = configs[p.categoria] || { variantes: [], tallas: [] };
  if (conOpciones && espec) {
    $("etiqueta-variante").textContent = espec.variante.singular[0].toUpperCase() + espec.variante.singular.slice(1);
    $("etiqueta-talla").textContent = espec.tallas.singular[0].toUpperCase() + espec.tallas.singular.slice(1);
    selector.mostrar(p, config, espec.variante, espec.tallas);
  } else {
    $("detalle-precio").textContent = formatearPrecio(p.precio);
    $("detalle-nota").textContent = "";
  }

  // Guía de tallas (solo tallas con cm que vienen en este producto)
  const tallasProducto = new Set(Object.values(p.presentaciones).flatMap((x) => Object.keys(x.precios)));
  const conCm = (config.tallas || []).filter((t) => t.cm && tallasProducto.has(t.id));
  $("tabla-tallas").hidden = !conCm.length;
  $("tabla-tallas").open = false;
  $("tabla-tallas").querySelector("tbody").innerHTML = "";
  conCm.forEach((t) => {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td></td><td></td>";
    tr.children[0].textContent = t.nombre;
    tr.children[1].textContent = `${t.cm} cm`;
    $("tabla-tallas").querySelector("tbody").appendChild(tr);
  });
  if (!conOpciones) $("detalle-guia").textContent = "";

  // Especificaciones (tipo, tacón, calce…)
  const dl = $("detalle-atributos");
  dl.innerHTML = "";
  p.atributos.forEach((a) => {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = a.etiqueta;
    dd.textContent = a.nombre;
    dl.append(dt, dd);
  });
  dl.hidden = !p.atributos.length;
  $("detalle").showModal();
}

$("detalle-cerrar").addEventListener("click", () => $("detalle").close());
$("detalle").addEventListener("click", (e) => { if (e.target === $("detalle")) $("detalle").close(); });
$("buscar").addEventListener("input", pintarGrid);

$("btn-volver").addEventListener("click", () => history.back());
$("btn-descargar").innerHTML = `${ICONO_DESCARGAR} Descargar imagen`;
$("btn-descargar").addEventListener("click", () => {
  if (productoAbierto) descargarImagen(productoAbierto.foto, productoAbierto.codigo, toast);
});

// Compartir: todo el catálogo, o solo la categoría que se está viendo.
$("btn-compartir-todo").innerHTML = `${ICONO_COMPARTIR} Compartir catálogo`;
$("btn-compartir-categoria").innerHTML = `${ICONO_COMPARTIR} Compartir esta categoría`;
$("btn-compartir-todo").addEventListener("click", () =>
  compartirLink({ url: linkCatalogo(codigoCliente), titulo: nombreTienda, texto: `Mira el catálogo de ${nombreTienda}` }, toast)
);
$("btn-compartir-categoria").addEventListener("click", () =>
  compartirLink({
    url: linkCatalogo(codigoCliente, categoriaActual.id),
    titulo: `${categoriaActual.nombre} · ${nombreTienda}`,
    texto: `Mira ${categoriaActual.nombre} en el catálogo de ${nombreTienda}`
  }, toast)
);

if (!configLista) {
  error("El catálogo no está disponible en este momento.");
} else {
  cargar().catch((err) => {
    console.error(err);
    // Si Firebase no deja leerlo, el catálogo está suspendido.
    const sinPermiso = err?.code === "PERMISSION_DENIED" || /permission/i.test(err?.message || "");
    error(sinPermiso
      ? "Este catálogo no está disponible por el momento."
      : "No se pudo cargar el catálogo. Revisa tu conexión e intenta de nuevo.");
  });
}
