// Modelo de datos compartido por el panel y las categorías.
//
// Realtime Database:
//   contadores/ultimoCodigoCliente   último código de cliente entregado (1, 2, 3…)
//   codigosCliente/{n}               uid dueño del código n (garantiza que sea único)
//   negocios/{uid}
//     nombre, contacto, creadoEn
//     codigoCliente      n  → se muestra "001"
//     codigoDisponible   siguiente número de producto (empieza en 1 → "0001"); nunca retrocede
//     totalItems         productos que existen hoy (activos + inhabilitados); al borrar, baja 1
//     ultimoBorrado      número del último producto borrado (lo exigen las reglas)
//   planes/{uid}/limite  solo lo edita App Factory (consola). Si no existe → 250
//   productos/{uid}/{numero}
//     numero, codigo "001-0001", categoria, precio, foto, rutaFoto, disponible, creadoEn
//     precioDesde                        el precio más bajo (categorías con presentaciones)
//     presentaciones/{varianteId}        { disponible, precios: { {tallaId}: 12.5 } }  (tela, color…)
//     atributos                          { tipo, tacon, calce }  (Zapatos)
//   configCategorias/{uid}/{categoria}   (lectura pública: el catálogo necesita los nombres)
//     telas | colores /{id} = { nombre, orden }     ← según js/especificaciones.js
//     tallas/{id}           = { nombre, orden, cm? }
//     tipos/{id}            = { nombre, orden }     (Zapatos)
import { db, ref, get, set, update, push, runTransaction, serverTimestamp } from "./firebase.js";
import { ESPECIFICACIONES, especDe } from "./especificaciones.js";

export const LIMITE_GRATIS = 250;

export const CATEGORIAS = [
  { id: "ropa",    nombre: "Ropa",    icono: "👗", color: "#E8618C" },
  { id: "zapatos", nombre: "Zapatos", icono: "👠", color: "#8B5CF6" },
  { id: "joyeria", nombre: "Joyería", icono: "💍", color: "#D4A017" },
  { id: "ninos",   nombre: "Niñ@s",   icono: "🧸", color: "#0EA5E9" },
  { id: "hogar",   nombre: "Hogar",   icono: "🏠", color: "#10B981" }
];

export const categoriaPorId = (id) => CATEGORIAS.find((c) => c.id === id) || null;

/** Devuelve el número solo si de verdad es un número (no confiar en el tipo guardado). */
export function num(valor, porDefecto = 0) {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : porDefecto;
}

/** 1, 5 → "001-0005" */
export function formatearCodigo(codigoCliente, numero) {
  return `${String(codigoCliente).padStart(3, "0")}-${String(numero).padStart(4, "0")}`;
}

export const formatearCliente = (codigoCliente) => String(codigoCliente).padStart(3, "0");

export function formatearPrecio(precio) {
  return "$" + num(precio).toFixed(2);
}

// ---------------------------------------------------------------------
// Configuración por categoría (variantes, tallas y listas de atributos)
// ---------------------------------------------------------------------
/** Id nuevo generado por Firebase (no escribe nada). */
export const nuevoId = () => push(ref(db, "ids")).key;

function listaOrdenada(nodo) {
  const lista = [];
  if (nodo && typeof nodo === "object") {
    Object.entries(nodo).forEach(([id, v]) => {
      if (!v || typeof v.nombre !== "string") return;
      const item = { id, nombre: v.nombre, orden: num(v.orden) };
      if (typeof v.cm === "number" && v.cm > 0) item.cm = v.cm;
      lista.push(item);
    });
  }
  return lista.sort((a, b) => a.orden - b.orden).map(({ orden, ...resto }) => resto);
}

function aNodo(lista) {
  const nodo = {};
  lista.forEach((x, i) => {
    nodo[x.id] = { nombre: x.nombre, orden: i };
    if (typeof x.cm === "number" && x.cm > 0) nodo[x.id].cm = x.cm;
  });
  return nodo;
}

const listasDe = (espec) => espec.atributos.filter((a) => a.lista);

/** Convierte el nodo guardado en { variantes, tallas, listas: { tipos: [...] }, existe }. */
export function configDesdeNodo(categoriaId, d) {
  const espec = especDe(categoriaId);
  d = d && typeof d === "object" ? d : {};
  const listas = {};
  listasDe(espec).forEach((a) => (listas[a.lista] = listaOrdenada(d[a.lista])));
  return {
    variantes: listaOrdenada(d[espec.variante.clave]),
    tallas: listaOrdenada(d.tallas),
    listas,
    existe: !!(d[espec.variante.clave] || d.tallas)
  };
}

/** Lee la configuración de una categoría. Funciona sin sesión (catálogo público). */
export async function leerConfigCategoria(uid, categoriaId) {
  if (!especDe(categoriaId)) return null;
  const d = (await get(ref(db, `configCategorias/${uid}/${categoriaId}`))).val();
  return configDesdeNodo(categoriaId, d);
}

/** Todas las categorías de un negocio en una sola lectura (para el catálogo público). */
export async function leerConfigTodas(uid) {
  const d = (await get(ref(db, `configCategorias/${uid}`))).val() || {};
  const salida = {};
  Object.keys(ESPECIFICACIONES).forEach((cat) => (salida[cat] = configDesdeNodo(cat, d[cat])));
  return salida;
}

export async function guardarConfigCategoria(uid, categoriaId, config) {
  const espec = especDe(categoriaId);
  const nodo = { [espec.variante.clave]: aNodo(config.variantes), tallas: aNodo(config.tallas) };
  listasDe(espec).forEach((a) => (nodo[a.lista] = aNodo(config.listas[a.lista] || [])));
  await set(ref(db, `configCategorias/${uid}/${categoriaId}`), nodo);
}

/** La primera vez, crea las listas de ejemplo para que la dueña no empiece en blanco. */
export async function asegurarConfigCategoria(uid, categoriaId) {
  const espec = especDe(categoriaId);
  if (!espec) return null;
  const config = await leerConfigCategoria(uid, categoriaId);
  if (config.existe) return config;
  const listas = {};
  listasDe(espec).forEach((a) => (listas[a.lista] = a.iniciales.map((nombre) => ({ id: nuevoId(), nombre }))));
  const inicial = {
    variantes: espec.variante.iniciales.map((nombre) => ({ id: nuevoId(), nombre })),
    tallas: espec.tallas.iniciales.map((nombre) => {
      const t = { id: nuevoId(), nombre };
      const cm = espec.tallas.cmIniciales?.[nombre];
      if (cm) t.cm = cm;
      return t;
    }),
    listas
  };
  await guardarConfigCategoria(uid, categoriaId, inicial);
  return { ...inicial, existe: true };
}

/** Atributos del producto (tipo, tacón, calce…) con su texto para mostrar. */
export function leerAtributos(categoriaId, nodo, config) {
  const espec = especDe(categoriaId);
  const salida = [];
  if (!espec || !nodo || typeof nodo !== "object") return salida;
  espec.atributos.forEach((a) => {
    const valor = nodo[a.clave];
    if (typeof valor !== "string") return;
    const opciones = a.lista ? config?.listas?.[a.lista] || [] : a.opciones;
    const nombre = opciones.find((o) => o.id === valor)?.nombre;
    if (nombre) salida.push({ clave: a.clave, etiqueta: a.nombre, id: valor, nombre });
  });
  return salida;
}

/** Normaliza presentaciones leídas de Firebase (no confiar en los tipos). */
export function leerPresentaciones(nodo) {
  const salida = {};
  if (!nodo || typeof nodo !== "object") return salida;
  Object.entries(nodo).forEach(([telaId, pr]) => {
    if (!pr || typeof pr !== "object") return;
    const precios = {};
    Object.entries(pr.precios || {}).forEach(([tallaId, v]) => {
      if (typeof v === "number" && v > 0) precios[tallaId] = v;
    });
    if (Object.keys(precios).length) salida[telaId] = { disponible: pr.disponible !== false, precios };
  });
  return salida;
}

export function rangoPrecios(precios) {
  const v = Object.values(precios);
  if (!v.length) return "";
  const min = Math.min(...v), max = Math.max(...v);
  return min === max ? formatearPrecio(min) : `${formatearPrecio(min)} – ${formatearPrecio(max)}`;
}

/** ¿El producto tiene más de un precio posible? (para mostrar "desde $X") */
export function tieneVariosPrecios(presentaciones) {
  const todos = new Set(Object.values(presentaciones).flatMap((p) => Object.values(p.precios)));
  return todos.size > 1;
}

/** Lee el negocio con valores seguros. */
export async function leerNegocio(uid) {
  const [snapNegocio, snapLimite] = await Promise.all([
    get(ref(db, `negocios/${uid}`)),
    get(ref(db, `planes/${uid}/limite`)).catch(() => null)
  ]);
  const d = snapNegocio.val() || {};
  return {
    nombre: typeof d.nombre === "string" ? d.nombre.trim() : "",
    codigoCliente: num(d.codigoCliente, 0),
    codigoDisponible: num(d.codigoDisponible, 0),
    totalItems: num(d.totalItems, 0),
    limite: Math.max(LIMITE_GRATIS, num(snapLimite?.val(), LIMITE_GRATIS))
  };
}

/**
 * Crea (o completa) el negocio y le asigna un código de cliente único.
 * El contador global se incrementa con una transacción, así dos registros
 * simultáneos nunca reciben el mismo código.
 */
export async function registrarNegocio(user, nombre) {
  let ultimoError;
  for (let intento = 0; intento < 5; intento++) {
    const tx = await runTransaction(
      ref(db, "contadores/ultimoCodigoCliente"),
      (actual) => num(actual, 0) + 1
    );
    if (!tx.committed) continue;
    const codigoCliente = tx.snapshot.val();
    try {
      await update(ref(db), {
        [`codigosCliente/${codigoCliente}`]: user.uid,
        [`negocios/${user.uid}/nombre`]: nombre,
        [`negocios/${user.uid}/contacto`]: user.email || "",
        [`negocios/${user.uid}/creadoEn`]: serverTimestamp(),
        [`negocios/${user.uid}/codigoCliente`]: codigoCliente,
        [`negocios/${user.uid}/codigoDisponible`]: 1,
        [`negocios/${user.uid}/totalItems`]: 0
      });
      return codigoCliente;
    } catch (err) {
      ultimoError = err; // código ya tomado: pedir otro
    }
  }
  throw ultimoError || new Error("No se pudo asignar el código de cliente");
}
