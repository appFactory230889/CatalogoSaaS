// Panel de administración de App Factory: aprobar/rechazar pagos y gestionar planes.
// Solo funciona con cuentas que estén en admins/{uid} = true (las reglas de Firebase lo exigen).
import {
  auth, db, configLista, onAuthStateChanged, ref, get, set, update, serverTimestamp
} from "./firebase.js";
import {
  num, formatearCliente, formatearPrecio, formatearFecha, leerPlan, sumarMeses, LIMITE_GRATIS,
  PRECIO_PREMIUM_MES, LIMITE_PREMIUM
} from "./datos.js";
import { leerPago, ESTADOS_PAGO } from "./pagos.js";

const $ = (id) => document.getElementById(id);
const LIMITE_PREMIUM_SUGERIDO = LIMITE_PREMIUM;
const esperado = (meses) => PRECIO_PREMIUM_MES * meses;

let clientas = {};   // uid → { uid, nombre, contacto, codigoCliente, totalItems, plan, planCrudo }
let pagos = [];      // [{ uid, ...pago }]
let filtroPagos = "pendiente";
let accion = null;   // lo que hará el diálogo: { tipo: "aprobar", pago } | { tipo: "manual", uid }

let toastTimer;
function toast(texto) {
  const el = $("toast");
  el.textContent = texto;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 2800);
}

function mostrar(vista) {
  ["cargando", "sin-acceso", "admin"].forEach((v) => ($(`vista-${v}`).hidden = v !== vista));
}

// ---------------------------------------------------------------------
// Carga
// ---------------------------------------------------------------------
async function cargarTodo() {
  const [snapNeg, snapPlanes, snapPagos, snapBloqueos] = await Promise.all([
    get(ref(db, "negocios")), get(ref(db, "planes")), get(ref(db, "pagos")), get(ref(db, "bloqueos"))
  ]);
  const planes = snapPlanes.val() || {};
  const bloqueos = snapBloqueos.val() || {};
  clientas = {};
  snapNeg.forEach((h) => {
    const d = h.val() || {};
    clientas[h.key] = {
      uid: h.key,
      nombre: typeof d.nombre === "string" ? d.nombre : "(sin nombre)",
      contacto: typeof d.contacto === "string" ? d.contacto : "",
      codigoCliente: num(d.codigoCliente),
      totalItems: num(d.totalItems),
      planCrudo: planes[h.key] || null,
      plan: leerPlan(planes[h.key]),
      bloqueo: bloqueos[h.key] && typeof bloqueos[h.key].motivo === "string" ? bloqueos[h.key] : null
    };
  });
  pagos = [];
  snapPagos.forEach((porClienta) => {
    porClienta.forEach((h) => { pagos.push({ uid: porClienta.key, ...leerPago(h.key, h.val()) }); });
  });
  pagos.sort((a, b) => b.creadoEn - a.creadoEn);
  pintarResumen();
  pintarPagos();
  pintarClientas();
}

function pintarResumen() {
  const lista = Object.values(clientas);
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
  const ingresos = pagos
    .filter((p) => p.estado === "aprobado" && p.revisadoEn >= inicioMes.getTime())
    .reduce((s, p) => s + p.monto, 0);
  $("dato-clientas").textContent = lista.length;
  $("dato-premium").textContent = lista.filter((c) => c.plan.activo).length;
  $("dato-pendientes").textContent = pagos.filter((p) => p.estado === "pendiente").length;
  $("dato-bloqueadas").textContent = lista.filter((c) => c.bloqueo).length;
  $("dato-ingresos").textContent = formatearPrecio(ingresos);
}

// ---------------------------------------------------------------------
// Pagos
// ---------------------------------------------------------------------
function pintarPagos() {
  const cont = $("lista-pagos");
  cont.innerHTML = "";
  const visibles = pagos.filter((p) => filtroPagos === "todos" || p.estado === filtroPagos);
  $("pagos-vacio").hidden = visibles.length > 0;
  visibles.forEach((p) => {
    const c = clientas[p.uid];
    const tarjeta = document.createElement("article");
    tarjeta.className = "pago-tarjeta";
    tarjeta.innerHTML = `
      <a class="pago-comprobante" target="_blank" rel="noopener" title="Ver comprobante completo"></a>
      <div class="pago-cuerpo">
        <div class="pago-cabecera">
          <strong class="pago-negocio"></strong>
          <span class="estado-pago"></span>
        </div>
        <p class="pago-contacto"></p>
        <p class="pago-montos"><strong></strong> <span></span></p>
        <p class="pago-detalle"></p>
        <p class="pago-motivo" hidden></p>
        <div class="pago-acciones" hidden>
          <button type="button" class="btn btn-peligro btn-sm" data-acc="rechazar">Rechazar</button>
          <button type="button" class="btn btn-primario btn-sm" data-acc="aprobar">Aprobar</button>
        </div>
      </div>`;
    const comp = tarjeta.querySelector(".pago-comprobante");
    comp.href = p.comprobante;
    if (p.tipoArchivo === "application/pdf") comp.innerHTML = `<span class="pdf">📄 Ver PDF</span>`;
    else { const img = document.createElement("img"); img.src = p.comprobante; img.alt = "Comprobante"; img.loading = "lazy"; comp.appendChild(img); }

    tarjeta.querySelector(".pago-negocio").textContent = c ? `${formatearCliente(c.codigoCliente)} · ${c.nombre}` : "(negocio no encontrado)";
    const est = tarjeta.querySelector(".estado-pago");
    est.textContent = ESTADOS_PAGO[p.estado].texto;
    est.classList.add(ESTADOS_PAGO[p.estado].clase);
    tarjeta.querySelector(".pago-contacto").textContent = c?.contacto || "";
    tarjeta.querySelector(".pago-montos strong").textContent = formatearPrecio(p.monto);
    tarjeta.querySelector(".pago-montos span").textContent = `· ${p.meses} mes${p.meses === 1 ? "" : "es"}`;
    if (Math.abs(p.monto - esperado(p.meses)) >= 0.01) {
      const aviso = document.createElement("span");
      aviso.className = "monto-distinto";
      aviso.textContent = `⚠ Esperado: ${formatearPrecio(esperado(p.meses))}`;
      tarjeta.querySelector(".pago-montos").appendChild(aviso);
    }
    tarjeta.querySelector(".pago-detalle").textContent =
      [p.banco, p.referencia && `Ref. ${p.referencia}`, p.creadoEn && `Reportado el ${formatearFecha(p.creadoEn)}`]
        .filter(Boolean).join(" · ");
    if (p.estado === "rechazado" && p.motivo) {
      const m = tarjeta.querySelector(".pago-motivo");
      m.hidden = false;
      m.textContent = `Motivo: ${p.motivo}`;
    }
    if (p.estado === "pendiente" && c) {
      tarjeta.querySelector(".pago-acciones").hidden = false;
      tarjeta.querySelector('[data-acc="aprobar"]').onclick = () => abrirDialogo({ tipo: "aprobar", pago: p });
      tarjeta.querySelector('[data-acc="rechazar"]').onclick = () => rechazar(p);
    }
    cont.appendChild(tarjeta);
  });
}

async function rechazar(p) {
  const motivo = prompt("¿Por qué se rechaza este pago? (La clienta verá este mensaje)", "El comprobante no coincide con el monto recibido.");
  if (motivo === null) return;
  try {
    await update(ref(db, `pagos/${p.uid}/${p.id}`), {
      estado: "rechazado", motivo: motivo.trim().slice(0, 200) || "Rechazado", revisadoEn: serverTimestamp()
    });
    toast("Pago rechazado");
    await cargarTodo();
  } catch (err) {
    console.error(err);
    toast("No se pudo rechazar. Revisa las reglas de Firebase.");
  }
}

// ---------------------------------------------------------------------
// Diálogo: aprobar pago o gestionar plan manualmente
// ---------------------------------------------------------------------
function baseVencimiento(c) {
  // Si todavía está vigente, se suma desde su vencimiento; si no, desde hoy.
  return Math.max(Date.now(), c.plan.activo ? c.plan.vigenteHasta : 0);
}

function actualizarResultado() {
  const c = clientas[accion.uid ?? accion.pago.uid];
  const meses = parseInt($("plan-meses").value, 10) || 0;
  const limite = parseInt($("plan-limite").value, 10) || 0;
  $("plan-resultado").textContent = meses > 0
    ? `Quedará Premium hasta el ${formatearFecha(sumarMeses(baseVencimiento(c), meses))}, con hasta ${limite} productos.`
    : "";
}

function abrirDialogo(a) {
  accion = a;
  const c = clientas[a.uid ?? a.pago.uid];
  const limiteActual = c.plan.activo ? c.plan.limite : LIMITE_PREMIUM_SUGERIDO;
  $("plan-limite").value = Math.max(limiteActual, LIMITE_GRATIS);
  $("msg-plan").textContent = "";
  if (a.tipo === "aprobar") {
    $("plan-titulo").textContent = "Aprobar pago";
    const diferencia = a.pago.monto - esperado(a.pago.meses);
    $("plan-subtitulo").textContent = `${c.nombre} reportó ${formatearPrecio(a.pago.monto)} por ${a.pago.meses} mes${a.pago.meses === 1 ? "" : "es"}` +
      (Math.abs(diferencia) >= 0.01
        ? ` (lo esperado es ${formatearPrecio(esperado(a.pago.meses))}: ${diferencia < 0 ? "faltan" : "sobran"} ${formatearPrecio(Math.abs(diferencia))}).`
        : ` (monto correcto).`);
    $("plan-meses").value = a.pago.meses;
    $("btn-plan-guardar").textContent = "Aprobar";
    $("btn-plan-gratis").hidden = true;
  } else {
    $("plan-titulo").textContent = `Plan de ${c.nombre}`;
    $("plan-subtitulo").textContent = c.plan.activo
      ? `Premium vigente hasta el ${formatearFecha(c.plan.vigenteHasta)}.`
      : "Actualmente en plan gratis.";
    $("plan-meses").value = 1;
    $("btn-plan-guardar").textContent = "Guardar";
    $("btn-plan-gratis").hidden = !c.plan.activo;
  }
  const bloq = $("btn-bloquear");
  bloq.hidden = a.tipo !== "manual";
  bloq.textContent = c.bloqueo ? "✅ Desbloquear" : "⛔ Bloquear uso";
  bloq.classList.toggle("btn-peligro", !c.bloqueo);
  bloq.classList.toggle("btn-fantasma", !!c.bloqueo);
  $("plan-bloqueo").hidden = !c.bloqueo;
  if (c.bloqueo) {
    $("plan-bloqueo").textContent = `Cuenta bloqueada${c.bloqueo.desde ? ` desde el ${formatearFecha(c.bloqueo.desde)}` : ""}. Motivo: ${c.bloqueo.motivo}`;
  }
  actualizarResultado();
  $("dialogo-plan").showModal();
}

$("plan-meses").addEventListener("input", actualizarResultado);
$("plan-limite").addEventListener("input", actualizarResultado);
$("btn-plan-cancelar").onclick = () => $("dialogo-plan").close();

$("form-plan").addEventListener("submit", async (e) => {
  e.preventDefault();
  const uid = accion.uid ?? accion.pago.uid;
  const c = clientas[uid];
  const meses = parseInt($("plan-meses").value, 10);
  const limite = parseInt($("plan-limite").value, 10);
  if (!(meses >= 1 && meses <= 24)) return ($("msg-plan").textContent = "Los meses deben ser de 1 a 24.");
  if (!(limite >= LIMITE_GRATIS && limite <= 100000)) return ($("msg-plan").textContent = `El límite debe ser de ${LIMITE_GRATIS} a 100000.`);

  const cambios = {
    [`planes/${uid}`]: {
      plan: "premium",
      limite,
      vigenteHasta: sumarMeses(baseVencimiento(c), meses),
      metodo: accion.tipo === "aprobar" ? "transferencia" : "manual",
      actualizadoEn: serverTimestamp()
    }
  };
  if (accion.tipo === "aprobar") {
    cambios[`pagos/${uid}/${accion.pago.id}/estado`] = "aprobado";
    cambios[`pagos/${uid}/${accion.pago.id}/revisadoEn`] = serverTimestamp();
  }
  const btn = $("btn-plan-guardar");
  btn.disabled = true;
  try {
    await update(ref(db), cambios);
    $("dialogo-plan").close();
    toast(accion.tipo === "aprobar" ? `Pago aprobado: ${c.nombre} es Premium` : "Plan actualizado");
    await cargarTodo();
  } catch (err) {
    console.error(err);
    $("msg-plan").textContent = "No se pudo guardar. Revisa las reglas de Firebase.";
  } finally {
    btn.disabled = false;
  }
});

$("btn-plan-gratis").onclick = async () => {
  const uid = accion.uid;
  const c = clientas[uid];
  if (!confirm(`¿Pasar a ${c.nombre} al plan gratis desde ahora?\n\nNo se borra ningún producto, pero no podrá subir más de ${LIMITE_GRATIS}.`)) return;
  try {
    await update(ref(db, `planes/${uid}`), { plan: "gratis", limite: LIMITE_GRATIS, vigenteHasta: Date.now(), metodo: "manual", actualizadoEn: serverTimestamp() });
    $("dialogo-plan").close();
    toast(`${c.nombre} pasó al plan gratis`);
    await cargarTodo();
  } catch (err) {
    console.error(err);
    $("msg-plan").textContent = "No se pudo guardar. Revisa las reglas de Firebase.";
  }
};

$("btn-bloquear").onclick = async () => {
  const uid = accion.uid;
  const c = clientas[uid];
  try {
    if (c.bloqueo) {
      if (!confirm(`¿Desbloquear a ${c.nombre}?\n\nPodrá volver a usar su panel y su catálogo será público otra vez.`)) return;
      await set(ref(db, `bloqueos/${uid}`), null);
      toast(`${c.nombre} desbloqueada`);
    } else {
      const motivo = prompt(
        `¿Por qué se bloquea a ${c.nombre}? (Ella verá este mensaje)\n\n` +
        "Mientras esté bloqueada no podrá subir ni editar productos, y su catálogo público dejará de verse. No se borra nada.",
        "Falta de pago de la suscripción."
      );
      if (motivo === null) return;
      await set(ref(db, `bloqueos/${uid}`), { motivo: motivo.trim().slice(0, 200) || "Cuenta suspendida", desde: serverTimestamp() });
      toast(`${c.nombre} bloqueada`);
    }
    $("dialogo-plan").close();
    await cargarTodo();
  } catch (err) {
    console.error(err);
    $("msg-plan").textContent = "No se pudo guardar. ¿Publicaste las reglas nuevas de Firebase?";
  }
};

// ---------------------------------------------------------------------
// Clientas
// ---------------------------------------------------------------------
function pintarClientas() {
  const texto = $("buscar-clienta").value.trim().toLowerCase();
  const tbody = $("tabla-clientas");
  tbody.innerHTML = "";
  Object.values(clientas)
    .filter((c) => !texto || c.nombre.toLowerCase().includes(texto) || c.contacto.toLowerCase().includes(texto) || formatearCliente(c.codigoCliente).includes(texto))
    .sort((a, b) => a.codigoCliente - b.codigoCliente)
    .forEach((c) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td class="mono"></td><td><strong></strong><small></small></td><td></td><td><span class="plan-chip"></span></td><td></td><td><button type="button" class="btn btn-fantasma btn-sm">Gestionar</button></td>`;
      const td = tr.children;
      td[0].textContent = formatearCliente(c.codigoCliente);
      td[1].querySelector("strong").textContent = c.nombre;
      td[1].querySelector("small").textContent = c.contacto;
      td[2].textContent = `${c.totalItems} / ${c.plan.limite}`;
      const chip = td[3].querySelector(".plan-chip");
      chip.textContent = c.bloqueo ? "Bloqueada" : c.plan.activo ? (c.plan.enGracia ? "Premium (gracia)" : "Premium") : (c.plan.vencido ? "Vencido" : "Gratis");
      chip.classList.add(c.bloqueo ? "bloqueada" : c.plan.activo ? (c.plan.enGracia ? "gracia" : "premium") : (c.plan.vencido ? "vencido" : "gratis"));
      td[4].textContent = c.plan.vigenteHasta ? formatearFecha(c.plan.vigenteHasta) : "—";
      td[5].querySelector("button").onclick = () => abrirDialogo({ tipo: "manual", uid: c.uid });
      tbody.appendChild(tr);
    });
}

$("buscar-clienta").addEventListener("input", pintarClientas);

// ---------------------------------------------------------------------
// Navegación y arranque
// ---------------------------------------------------------------------
document.querySelectorAll(".tabs-admin .tab").forEach((t) => t.addEventListener("click", () => {
  document.querySelectorAll(".tabs-admin .tab").forEach((x) => x.classList.toggle("active", x === t));
  $("tab-pagos").hidden = t.dataset.vista !== "pagos";
  $("tab-clientas").hidden = t.dataset.vista !== "clientas";
}));

document.querySelectorAll("#filtro-pagos .chip").forEach((b) => b.addEventListener("click", () => {
  filtroPagos = b.dataset.filtro;
  document.querySelectorAll("#filtro-pagos .chip").forEach((x) => x.classList.toggle("activo", x === b));
  pintarPagos();
}));

/** Explica por qué esta cuenta no tiene acceso (para no adivinar). */
async function diagnosticar(user, error, valor) {
  if (error) {
    return error.code === "PERMISSION_DENIED" || /permission/i.test(error.message || "")
      ? "Firebase no deja leer admins: las reglas nuevas de la base de datos todavía no están publicadas (o se publicó una versión anterior)."
      : `Error al leer admins: ${error.message || error}`;
  }
  if (valor === "true") return "La clave existe, pero su valor es el TEXTO \"true\". Debe ser el valor verdadero true (sin comillas).";
  if (valor !== null && valor !== undefined) return `La clave existe, pero su valor es ${JSON.stringify(valor)}. Debe ser true.`;
  return `No existe la ruta admins/${user.uid} en la RAÍZ de la base de datos. Revisa que "admins" esté al mismo nivel que "negocios" (no dentro de otro nodo) y que el UID sea exactamente este, con la cuenta ${user.email || "actual"}.`;
}

async function iniciar(user) {
  let valor = null, error = null;
  try { valor = (await get(ref(db, `admins/${user.uid}`))).val(); }
  catch (e) { error = e; }
  if (valor !== true) {
    $("mi-uid").textContent = user.uid;
    $("btn-copiar-uid").onclick = () => navigator.clipboard.writeText(user.uid).then(() => toast("UID copiado"));
    $("diagnostico").textContent = await diagnosticar(user, error, valor);
    mostrar("sin-acceso");
    return;
  }
  await cargarTodo();
  mostrar("admin");
}

if (!configLista) {
  location.replace("ingresar.html");
} else {
  onAuthStateChanged(auth, (user) => {
    if (!user) { location.replace("ingresar.html"); return; }
    iniciar(user).catch((err) => {
      console.error(err);
      $("vista-cargando").innerHTML = "<p>No se pudo cargar el panel. ¿Publicaste las reglas nuevas de Firebase?</p>";
    });
  });
}
