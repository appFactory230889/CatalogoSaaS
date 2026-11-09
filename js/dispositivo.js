// Identificador interno del dispositivo (celular o navegador), para detectar cuentas duplicadas.
// No contiene datos personales: es un código al azar guardado en este navegador.
// Limitación conocida: en modo incógnito o si borran los datos del navegador, se genera otro.
// Por eso se registra en CADA ingreso al panel (no solo al registrarse): basta con que alguien
// entre a dos cuentas desde el mismo navegador una sola vez para que App Factory lo vea.

const CLAVE_ID = "afc-dispositivo";
const CLAVE_CUENTAS = "afc-cuentas-dispositivo";

function guardar(clave, valor) { try { localStorage.setItem(clave, valor); } catch {} }
function leer(clave) { try { return localStorage.getItem(clave); } catch { return null; } }

/** Código del dispositivo (se crea la primera vez). Solo letras y números, apto como clave de Firebase. */
export function idDispositivo() {
  let id = leer(CLAVE_ID);
  if (!id || !/^[a-z0-9]{12,40}$/.test(id)) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}${Math.random()}`).replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 32);
    guardar(CLAVE_ID, id);
  }
  return id;
}

/** "ana.perez@gmail.com" → "a***@gmail.com" */
export function enmascararCorreo(correo) {
  const [usuario, dominio] = String(correo || "").split("@");
  if (!usuario || !dominio) return "";
  return `${usuario[0]}***@${dominio}`;
}

/** Recuerda (enmascarado) qué cuentas han entrado desde este dispositivo. */
export function recordarCuenta(uid, correo) {
  let cuentas = {};
  try { cuentas = JSON.parse(leer(CLAVE_CUENTAS)) || {}; } catch {}
  cuentas[uid] = enmascararCorreo(correo) || "otra cuenta";
  guardar(CLAVE_CUENTAS, JSON.stringify(cuentas));
}

/** Correos enmascarados de las cuentas que ya entraron desde este dispositivo. */
export function cuentasPrevias() {
  try {
    const cuentas = JSON.parse(leer(CLAVE_CUENTAS)) || {};
    return [...new Set(Object.values(cuentas).filter((c) => typeof c === "string"))];
  } catch {
    return [];
  }
}
