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
import { db, ref, get, update, runTransaction, serverTimestamp } from "./firebase.js";

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
