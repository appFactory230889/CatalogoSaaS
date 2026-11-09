// Panel de la clienta: estado de su plan y "Reportar pago" (comprobante de transferencia).
// El plan SOLO lo cambia App Factory desde admin.html; aquí la clienta solo reporta y ve el estado.
import {
  db, storage, ref, get, set, serverTimestamp, sRef, uploadBytes, getDownloadURL
} from "./firebase.js";
import { nuevoId, num, formatearPrecio, formatearFecha, DIAS_GRACIA, LIMITE_GRATIS } from "./datos.js";

const $ = (id) => document.getElementById(id);
const MAX_MB = 5;

export const ESTADOS_PAGO = {
  pendiente: { texto: "En revisión", clase: "pendiente" },
  aprobado: { texto: "Aprobado", clase: "aprobado" },
  rechazado: { texto: "Rechazado", clase: "rechazado" }
};

/** Normaliza un pago leído de Firebase. */
export function leerPago(id, d) {
  d = d && typeof d === "object" ? d : {};
  return {
    id,
    monto: num(d.monto),
    meses: num(d.meses, 1),
    banco: typeof d.banco === "string" ? d.banco : "",
    referencia: typeof d.referencia === "string" ? d.referencia : "",
    comprobante: typeof d.comprobante === "string" ? d.comprobante : "",
    tipoArchivo: typeof d.tipoArchivo === "string" ? d.tipoArchivo : "",
    estado: ESTADOS_PAGO[d.estado] ? d.estado : "pendiente",
    motivo: typeof d.motivo === "string" ? d.motivo : "",
    creadoEn: num(d.creadoEn),
    revisadoEn: num(d.revisadoEn)
  };
}

export function iniciarPagos({ usuario, negocio, toast }) {
  pintarPlan(negocio.plan);
  cargarMisPagos(usuario.uid);

  const dialogo = $("dialogo-pago");
  $("btn-reportar").onclick = () => {
    $("form-pago").reset();
    $("msg-pago").textContent = "";
    dialogo.showModal();
  };
  $("btn-cancelar-pago").onclick = () => dialogo.close();
  $("form-pago").onsubmit = (e) => {
    e.preventDefault();
    enviarPago(usuario, toast);
  };
}

function pintarPlan(plan) {
  const caja = $("plan");
  caja.classList.remove("premium", "gracia", "vencido", "pronto");
  let etiqueta = "Plan Gratis";
  let detalle = `Hasta ${LIMITE_GRATIS} productos. Para ampliar tu plan, haz tu transferencia y reporta el pago aquí.`;
  if (plan.activo && plan.enGracia) {
    caja.classList.add("premium", "gracia");
    etiqueta = "Plan Premium · pago pendiente";
    detalle = `Tu plan venció el ${formatearFecha(plan.vigenteHasta)}. Tienes ${DIAS_GRACIA} días de gracia: reporta tu pago para no perder los beneficios.`;
  } else if (plan.activo) {
    caja.classList.add("premium");
    if (plan.vencePronto) caja.classList.add("pronto");
    etiqueta = "Plan Premium";
    detalle = `Hasta ${plan.limite} productos. Vigente hasta el ${formatearFecha(plan.vigenteHasta)}` +
      (plan.vencePronto ? ` (vence en ${plan.diasRestantes} día${plan.diasRestantes === 1 ? "" : "s"}).` : ".");
  } else if (plan.vencido) {
    caja.classList.add("vencido");
    detalle = `Tu plan Premium venció el ${formatearFecha(plan.vigenteHasta)}. Tus productos siguen publicados, pero no puedes subir más de ${LIMITE_GRATIS}. Reporta tu pago para reactivarlo.`;
  }
  $("plan-etiqueta").textContent = etiqueta;
  $("plan-detalle").textContent = detalle;
}

async function cargarMisPagos(uid) {
  const cont = $("mis-pagos");
  try {
    const snap = await get(ref(db, `pagos/${uid}`));
    const pagos = [];
    snap.forEach((h) => { pagos.push(leerPago(h.key, h.val())); });
    pagos.sort((a, b) => b.creadoEn - a.creadoEn);
    const recientes = pagos.slice(0, 3);
    cont.hidden = recientes.length === 0;
    cont.innerHTML = "<p class='mis-pagos-titulo'>Tus últimos pagos reportados</p>";
    recientes.forEach((p) => {
      const fila = document.createElement("div");
      fila.className = "pago-fila";
      fila.innerHTML = `<span class="pago-fecha"></span><span class="pago-monto"></span><span class="estado-pago"></span>`;
      fila.querySelector(".pago-fecha").textContent = p.creadoEn ? formatearFecha(p.creadoEn) : "";
      fila.querySelector(".pago-monto").textContent = `${formatearPrecio(p.monto)} · ${p.meses} mes${p.meses === 1 ? "" : "es"}`;
      const est = fila.querySelector(".estado-pago");
      est.textContent = ESTADOS_PAGO[p.estado].texto;
      est.classList.add(ESTADOS_PAGO[p.estado].clase);
      cont.appendChild(fila);
      if (p.estado === "rechazado" && p.motivo) {
        const m = document.createElement("p");
        m.className = "pago-motivo";
        m.textContent = `Motivo: ${p.motivo}`;
        cont.appendChild(m);
      }
    });
  } catch (err) {
    console.error(err);
    cont.hidden = true;
  }
}

/** Fotos muy grandes se reducen antes de subir (los comprobantes no necesitan más de 1600 px). */
async function prepararArchivo(archivo) {
  if (archivo.type === "application/pdf") return { blob: archivo, ext: "pdf", tipo: "application/pdf" };
  if (archivo.size <= 1.5 * 1024 * 1024) {
    const ext = archivo.type === "image/png" ? "png" : "jpg";
    return { blob: archivo, ext, tipo: archivo.type || "image/jpeg" };
  }
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
    const escala = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * escala);
    c.height = Math.round(img.naturalHeight * escala);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
    return { blob, ext: "jpg", tipo: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function enviarPago(usuario, toast) {
  const msg = $("msg-pago");
  const monto = Math.round(parseFloat($("pago-monto").value) * 100) / 100;
  const meses = parseInt($("pago-meses").value, 10);
  const banco = $("pago-banco").value.trim().replace(/\s+/g, " ");
  const referencia = $("pago-referencia").value.trim().replace(/\s+/g, " ");
  const archivo = $("pago-comprobante").files?.[0];

  if (!Number.isFinite(monto) || monto <= 0) return (msg.textContent = "Escribe el monto que pagaste.");
  if (!banco) return (msg.textContent = "Escribe el banco o medio de pago.");
  if (!archivo) return (msg.textContent = "Adjunta la foto o el PDF del comprobante.");
  if (!archivo.type.startsWith("image/") && archivo.type !== "application/pdf") {
    return (msg.textContent = "El comprobante debe ser una foto o un PDF.");
  }

  const btn = $("btn-enviar-pago");
  btn.disabled = true;
  btn.textContent = "Enviando…";
  msg.textContent = "";
  try {
    const { blob, ext, tipo } = await prepararArchivo(archivo);
    if (blob.size > MAX_MB * 1024 * 1024) throw new Error("grande");
    const id = nuevoId();
    const rutaComprobante = `comprobantes/${usuario.uid}/${id}.${ext}`;
    const destino = sRef(storage, rutaComprobante);
    await uploadBytes(destino, blob, { contentType: tipo });
    const comprobante = await getDownloadURL(destino);

    const pago = { monto, meses, banco, comprobante, rutaComprobante, tipoArchivo: tipo, estado: "pendiente", creadoEn: serverTimestamp() };
    if (referencia) pago.referencia = referencia;
    await set(ref(db, `pagos/${usuario.uid}/${id}`), pago);

    $("dialogo-pago").close();
    toast("¡Comprobante enviado! App Factory lo revisará pronto.");
    cargarMisPagos(usuario.uid);
  } catch (err) {
    console.error(err);
    msg.textContent = err?.message === "grande"
      ? `El archivo pesa más de ${MAX_MB} MB. Prueba con una foto o un PDF más liviano.`
      : "No se pudo enviar el comprobante. Revisa tu conexión e intenta de nuevo.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Enviar comprobante";
  }
}
