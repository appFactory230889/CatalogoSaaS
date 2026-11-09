// PROTOTIPO: configuración de Ropa (telas y tallas) y productos con presentaciones.
// Todo se guarda en localStorage de este navegador; aún no toca Firebase.
//
// Modelo propuesto (lo que se guardaría en Firebase):
//   configCategorias/{uid}/ropa/telas/{telaId}  = { nombre, orden }
//   configCategorias/{uid}/ropa/tallas/{tallaId} = { nombre, orden }
//   productos/{uid}/{numero}/presentaciones/{telaId} = {
//       disponible: true,
//       precios: { {tallaId}: 12.5, ... }    ← solo las tallas en que viene
//   }
//   productos/{uid}/{numero}/precioDesde = el precio más bajo (para ordenar y mostrar "desde $X")
import { categoriaPorId, formatearPrecio } from "./datos.js";

const $ = (id) => document.getElementById(id);
const categoria = categoriaPorId(new URLSearchParams(location.search).get("c"));
const CLAVE = "appfactory-prototipo-ropa-v1";

const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function estadoInicial() {
  const telas = ["Sin especificar", "Liverpool", "Piel de durazno", "Cárdigan", "Quiana"];
  const tallas = ["XS", "S", "M", "L", "XL", "XXL"];
  return {
    telas: telas.map((nombre) => ({ id: nuevoId() + nombre.length, nombre })),
    tallas: tallas.map((nombre) => ({ id: nuevoId() + nombre, nombre })),
    productos: [],
    siguiente: 1
  };
}

function cargar() {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE));
    if (d && Array.isArray(d.telas) && Array.isArray(d.tallas) && Array.isArray(d.productos)) return d;
  } catch {}
  return estadoInicial();
}

let estado = cargar();
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); }
  catch { toast("El navegador no dejó guardar (¿foto muy grande?). Los cambios siguen en pantalla."); }
}

let toastTimer;
function toast(texto) {
  const el = $("toast");
  el.textContent = texto;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 2600);
}

const nombreTela = (id) => estado.telas.find((t) => t.id === id)?.nombre ?? "(tela borrada)";
const codigoDemo = (n) => `DEMO-${String(n).padStart(4, "0")}`;

// =====================================================================
// PASO 1 · Telas y tallas
// =====================================================================
function usoDeTela(id) {
  return estado.productos.filter((p) => p.presentaciones[id]).length;
}
function usoDeTalla(id) {
  return estado.productos.filter((p) => Object.values(p.presentaciones).some((pr) => id in pr.precios)).length;
}

function pintarListaEditable(ul, items, { tipo, uso, alBorrar }) {
  ul.innerHTML = "";
  items.forEach((item, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <input type="text" maxlength="40" aria-label="Nombre">
      <span class="uso-item"></span>
      <button type="button" class="btn-icono" data-acc="subir" title="Subir" aria-label="Subir">↑</button>
      <button type="button" class="btn-icono" data-acc="bajar" title="Bajar" aria-label="Bajar">↓</button>
      <button type="button" class="btn-icono" data-acc="borrar" title="Borrar" aria-label="Borrar">✕</button>`;
    const input = li.querySelector("input");
    input.value = item.nombre;
    const n = uso(item.id);
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
      guardar();
      pintarTodo();
    });
    li.addEventListener("click", (e) => {
      const acc = e.target.closest("button")?.dataset.acc;
      if (!acc) return;
      if (acc === "borrar") {
        const msg = n
          ? `"${item.nombre}" se usa en ${n} producto(s). Si la borras, se quitará de esos productos. ¿Continuar?`
          : `¿Borrar "${item.nombre}"?`;
        if (!confirm(msg)) return;
        items.splice(i, 1);
        alBorrar(item.id);
      } else {
        const j = acc === "subir" ? i - 1 : i + 1;
        [items[i], items[j]] = [items[j], items[i]];
      }
      guardar();
      pintarTodo();
    });
    ul.appendChild(li);
  });
  if (!items.length) ul.innerHTML = `<li class="lista-vacia">No hay ${tipo} todavía.</li>`;
}

function agregarItem(lista, input, msg, tipo) {
  const v = input.value.trim().replace(/\s+/g, " ");
  msg.textContent = "";
  if (!v) return;
  if (lista.some((x) => x.nombre.toLowerCase() === v.toLowerCase())) {
    msg.textContent = `Ya existe "${v}".`;
    return;
  }
  lista.push({ id: nuevoId(), nombre: v });
  input.value = "";
  guardar();
  pintarTodo();
  toast(`${tipo} "${v}" agregada`);
}

function pintarConfig() {
  pintarListaEditable($("lista-telas"), estado.telas, {
    tipo: "telas",
    uso: usoDeTela,
    alBorrar: (id) => {
      estado.productos.forEach((p) => delete p.presentaciones[id]);
      delete borrador.presentaciones[id];
    }
  });
  pintarListaEditable($("lista-tallas"), estado.tallas, {
    tipo: "tallas",
    uso: usoDeTalla,
    alBorrar: (id) => {
      estado.productos.forEach((p) => Object.values(p.presentaciones).forEach((pr) => delete pr.precios[id]));
      Object.values(borrador.presentaciones).forEach((pr) => delete pr.tallas[id]);
    }
  });
}

$("form-tela").addEventListener("submit", (e) => {
  e.preventDefault();
  agregarItem(estado.telas, $("nueva-tela"), $("msg-tela"), "Tela");
});
$("form-talla").addEventListener("submit", (e) => {
  e.preventDefault();
  agregarItem(estado.tallas, $("nueva-talla"), $("msg-talla"), "Talla");
});

// =====================================================================
// PASO 2 · Nuevo producto con presentaciones
// =====================================================================
let borrador = borradorVacio();
function borradorVacio() {
  return { foto: null, imagen: null, presentaciones: {} };
}

function presentacionVacia() {
  const tallas = {};
  estado.tallas.forEach((t) => (tallas[t.id] = { activa: true, precio: "" }));
  return { disponible: true, mismoPrecio: true, precio: "", tallas };
}

function pintarChipsTelas() {
  const cont = $("chips-telas");
  cont.innerHTML = "";
  estado.telas.forEach((t) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (borrador.presentaciones[t.id] ? " activo" : "");
    b.textContent = t.nombre;
    b.setAttribute("aria-pressed", String(!!borrador.presentaciones[t.id]));
    b.addEventListener("click", () => {
      if (borrador.presentaciones[t.id]) delete borrador.presentaciones[t.id];
      else borrador.presentaciones[t.id] = presentacionVacia();
      pintarFormulario();
    });
    cont.appendChild(b);
  });
  if (!estado.telas.length) cont.innerHTML = `<p class="sub">Primero agrega telas en el paso 1.</p>`;
}

function pintarPresentaciones() {
  const cont = $("presentaciones");
  cont.innerHTML = "";
  // Mantener el orden de la configuración de telas.
  estado.telas.filter((t) => borrador.presentaciones[t.id]).forEach((t) => {
    const pr = borrador.presentaciones[t.id];
    // Tallas agregadas después de abrir el borrador.
    estado.tallas.forEach((ta) => { if (!pr.tallas[ta.id]) pr.tallas[ta.id] = { activa: false, precio: "" }; });

    const caja = document.createElement("div");
    caja.className = "presentacion" + (pr.disponible ? "" : " agotada");
    caja.innerHTML = `
      <div class="presentacion-cabecera">
        <strong></strong>
        <label class="interruptor">
          <input type="checkbox" data-campo="disponible">
          <span class="interruptor-pista" aria-hidden="true"></span>
          <span>Disponible</span>
        </label>
        <button type="button" class="btn-icono" data-acc="quitar" title="Quitar presentación" aria-label="Quitar presentación">✕</button>
      </div>
      <label class="check-linea">
        <input type="checkbox" data-campo="mismo"> Mismo precio para todas las tallas
      </label>
      <div class="precio-unico" data-bloque="unico">
        <span>$</span><input type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" data-campo="precio" aria-label="Precio">
      </div>
      <p class="ayuda-tallas"></p>
      <div class="grid-tallas"></div>
      <div class="presentacion-pie"></div>`;
    caja.querySelector("strong").textContent = t.nombre;

    const chkDisp = caja.querySelector('[data-campo="disponible"]');
    chkDisp.checked = pr.disponible;
    chkDisp.addEventListener("change", () => { pr.disponible = chkDisp.checked; caja.classList.toggle("agotada", !pr.disponible); });

    caja.querySelector('[data-acc="quitar"]').addEventListener("click", () => {
      delete borrador.presentaciones[t.id];
      pintarFormulario();
    });

    const chkMismo = caja.querySelector('[data-campo="mismo"]');
    chkMismo.checked = pr.mismoPrecio;
    chkMismo.addEventListener("change", () => {
      pr.mismoPrecio = chkMismo.checked;
      if (!pr.mismoPrecio && pr.precio) {
        // Al separar precios, cada talla arranca con el precio único.
        Object.values(pr.tallas).forEach((x) => { if (!x.precio) x.precio = pr.precio; });
      }
      pintarPresentaciones();
    });

    const bloqueUnico = caja.querySelector('[data-bloque="unico"]');
    bloqueUnico.hidden = !pr.mismoPrecio;
    const inputUnico = bloqueUnico.querySelector("input");
    inputUnico.value = pr.precio;
    inputUnico.addEventListener("input", () => (pr.precio = inputUnico.value));

    caja.querySelector(".ayuda-tallas").textContent = pr.mismoPrecio
      ? "Marca las tallas en que viene esta tela:"
      : "Marca las tallas y escribe el precio de cada una:";

    const grid = caja.querySelector(".grid-tallas");
    estado.tallas.forEach((ta) => {
      const st = pr.tallas[ta.id];
      const celda = document.createElement("div");
      celda.className = "talla-celda" + (st.activa ? "" : " inactiva");
      celda.innerHTML = `
        <label><input type="checkbox"><span></span></label>
        <input type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" aria-label="Precio">`;
      celda.querySelector("span").textContent = ta.nombre;
      const chk = celda.querySelector("input[type=checkbox]");
      chk.checked = st.activa;
      chk.addEventListener("change", () => { st.activa = chk.checked; celda.classList.toggle("inactiva", !st.activa); });
      const inp = celda.querySelector("input[type=number]");
      inp.hidden = pr.mismoPrecio;
      inp.value = st.precio;
      inp.addEventListener("input", () => (st.precio = inp.value));
      grid.appendChild(celda);
    });

    // Copiar precios de otra presentación ya llenada
    const otras = estado.telas.filter((o) => o.id !== t.id && borrador.presentaciones[o.id]);
    const pie = caja.querySelector(".presentacion-pie");
    if (otras.length) {
      pie.innerHTML = `<span>Copiar tallas y precios de:</span>`;
      otras.forEach((o) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip chip-sm";
        b.textContent = o.nombre;
        b.addEventListener("click", () => {
          borrador.presentaciones[t.id] = structuredClone({ ...borrador.presentaciones[o.id], disponible: pr.disponible });
          pintarPresentaciones();
          toast(`Copiado de ${o.nombre}`);
        });
        pie.appendChild(b);
      });
    }
    cont.appendChild(caja);
  });
}

function pintarFormulario() {
  $("codigo-preview").textContent = codigoDemo(estado.siguiente);
  pintarChipsTelas();
  pintarPresentaciones();
}

// ---- foto (igual que la versión real: el código va dibujado encima) ----
async function dibujarFoto(codigo) {
  const lienzo = $("lienzo");
  const img = borrador.imagen;
  const escala = Math.min(1, 600 / img.naturalWidth); // pequeña: el prototipo guarda en el navegador
  lienzo.width = Math.round(img.naturalWidth * escala);
  lienzo.height = Math.round(img.naturalHeight * escala);
  const ctx = lienzo.getContext("2d");
  ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
  const tam = Math.round(Math.max(22, lienzo.width * 0.09));
  try { await document.fonts.load(`800 ${tam}px Montserrat`); } catch {}
  ctx.font = `800 ${tam}px Montserrat, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(3, tam * 0.18);
  ctx.strokeStyle = "#000";
  ctx.strokeText(codigo, lienzo.width / 2, lienzo.height / 2);
  ctx.fillStyle = "#fff";
  ctx.fillText(codigo, lienzo.width / 2, lienzo.height / 2);
  borrador.foto = lienzo.toDataURL("image/jpeg", 0.8);
}

$("input-foto").addEventListener("change", (e) => {
  const archivo = e.target.files?.[0];
  if (!archivo || !archivo.type.startsWith("image/")) return;
  const url = URL.createObjectURL(archivo);
  const img = new Image();
  img.onload = async () => {
    borrador.imagen = img;
    await dibujarFoto(codigoDemo(estado.siguiente));
    $("lienzo").hidden = false;
    $("selector-texto").hidden = true;
    URL.revokeObjectURL(url);
  };
  img.src = url;
});

// ---- validar y guardar ----
function precioValido(v) {
  const n = Math.round(parseFloat(v) * 100) / 100;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function construirProducto() {
  const ids = estado.telas.map((t) => t.id).filter((id) => borrador.presentaciones[id]);
  if (!ids.length) return { error: "Elige al menos una tela (presentación)." };

  const presentaciones = {};
  for (const id of ids) {
    const pr = borrador.presentaciones[id];
    const tallasActivas = estado.tallas.filter((ta) => pr.tallas[ta.id]?.activa);
    if (!tallasActivas.length) return { error: `${nombreTela(id)}: marca al menos una talla.` };
    const precios = {};
    for (const ta of tallasActivas) {
      const p = precioValido(pr.mismoPrecio ? pr.precio : pr.tallas[ta.id].precio);
      if (p === null) {
        return { error: pr.mismoPrecio
          ? `${nombreTela(id)}: escribe el precio.`
          : `${nombreTela(id)}: falta el precio de la talla ${ta.nombre}.` };
      }
      precios[ta.id] = p;
    }
    presentaciones[id] = { disponible: pr.disponible, precios };
  }
  const todos = Object.values(presentaciones).flatMap((p) => Object.values(p.precios));
  return {
    producto: {
      numero: estado.siguiente,
      codigo: codigoDemo(estado.siguiente),
      foto: borrador.foto,
      precioDesde: Math.min(...todos),
      presentaciones
    }
  };
}

$("btn-guardar").addEventListener("click", async () => {
  const msg = $("msg-producto");
  msg.textContent = "";
  const { error, producto } = construirProducto();
  if (error) {
    msg.textContent = error;
    return;
  }
  estado.productos.unshift(producto);
  estado.siguiente += 1;
  guardar();
  limpiarFormulario();
  pintarTodo();
  toast(`Producto ${producto.codigo} guardado`);
});

function limpiarFormulario() {
  borrador = borradorVacio();
  $("input-foto").value = "";
  $("lienzo").hidden = true;
  $("selector-texto").hidden = false;
  $("msg-producto").textContent = "";
  pintarFormulario();
}
$("btn-limpiar").addEventListener("click", limpiarFormulario);

// ---- lista de productos de prueba ----
function rangoPrecios(precios) {
  const v = Object.values(precios);
  if (!v.length) return "";
  const min = Math.min(...v), max = Math.max(...v);
  return min === max ? formatearPrecio(min) : `${formatearPrecio(min)} – ${formatearPrecio(max)}`;
}

function pintarListaProductos() {
  const grid = $("grid-productos");
  grid.innerHTML = "";
  $("lista-vacia").hidden = estado.productos.length > 0;
  estado.productos.forEach((p) => {
    const telas = Object.keys(p.presentaciones);
    const card = document.createElement("article");
    card.className = "producto";
    card.innerHTML = `
      <div class="producto-foto"></div>
      <div class="producto-info">
        <div class="producto-fila">
          <strong class="producto-codigo"></strong>
          <span class="producto-precio"></span>
        </div>
        <p class="producto-detalle"></p>
        <div class="producto-fila">
          <button type="button" class="btn btn-fantasma btn-sm" data-acc="ver">Ver como clienta</button>
          <button type="button" class="btn-icono" data-acc="borrar" aria-label="Borrar">🗑️</button>
        </div>
      </div>`;
    const foto = card.querySelector(".producto-foto");
    if (p.foto) foto.innerHTML = `<img alt="" src="${p.foto}">`;
    else foto.innerHTML = `<span class="foto-demo">${p.codigo}</span>`;
    card.querySelector(".producto-codigo").textContent = p.codigo;
    card.querySelector(".producto-precio").textContent = "desde " + formatearPrecio(p.precioDesde);
    card.querySelector(".producto-detalle").textContent =
      telas.length === 1 ? nombreTela(telas[0]) : `${telas.length} telas: ${telas.map(nombreTela).join(", ")}`;
    card.querySelector('[data-acc="ver"]').addEventListener("click", () => {
      fichaSeleccion = { numero: p.numero, tela: null, talla: null };
      irAPaso("vista");
    });
    card.querySelector('[data-acc="borrar"]').addEventListener("click", () => {
      if (!confirm(`¿Borrar ${p.codigo}?`)) return;
      estado.productos = estado.productos.filter((x) => x !== p);
      guardar();
      pintarTodo();
    });
    grid.appendChild(card);
  });
}

// =====================================================================
// PASO 3 · Vista de la clienta (como SHEIN/TEMU)
// =====================================================================
let fichaSeleccion = { numero: null, tela: null, talla: null };

function pintarVista() {
  const sel = $("select-producto");
  const hay = estado.productos.length > 0;
  $("vista-vacia").hidden = hay;
  $("ficha").hidden = !hay;
  sel.parentElement.hidden = !hay;
  if (!hay) return;

  if (!estado.productos.some((p) => p.numero === fichaSeleccion.numero)) {
    fichaSeleccion = { numero: estado.productos[0].numero, tela: null, talla: null };
  }
  sel.innerHTML = "";
  estado.productos.forEach((p) => {
    const o = document.createElement("option");
    o.value = p.numero;
    o.textContent = `${p.codigo} · desde ${formatearPrecio(p.precioDesde)}`;
    sel.appendChild(o);
  });
  sel.value = fichaSeleccion.numero;

  const p = estado.productos.find((x) => x.numero === fichaSeleccion.numero);
  const telasProducto = estado.telas.filter((t) => p.presentaciones[t.id]);
  // Si no hay tela elegida, tomar la primera disponible.
  if (!p.presentaciones[fichaSeleccion.tela]) {
    fichaSeleccion.tela = (telasProducto.find((t) => p.presentaciones[t.id].disponible) || telasProducto[0])?.id ?? null;
    fichaSeleccion.talla = null;
  }
  const pr = p.presentaciones[fichaSeleccion.tela];
  if (pr && !(fichaSeleccion.talla in pr.precios)) fichaSeleccion.talla = null;

  // Foto
  const img = $("ficha-img");
  if (p.foto) { img.src = p.foto; img.hidden = false; img.parentElement.classList.remove("sin-foto"); }
  else { img.hidden = true; img.parentElement.classList.add("sin-foto"); img.parentElement.dataset.codigo = p.codigo; }
  $("ficha-codigo").textContent = p.codigo;

  // Precio: exacto si hay talla elegida; si no, el rango de la tela.
  const nota = $("ficha-nota");
  if (!pr) {
    $("ficha-precio").textContent = "";
    nota.textContent = "";
  } else if (!pr.disponible) {
    $("ficha-precio").textContent = rangoPrecios(pr.precios);
    nota.textContent = "Esta tela está agotada.";
  } else if (fichaSeleccion.talla) {
    $("ficha-precio").textContent = formatearPrecio(pr.precios[fichaSeleccion.talla]);
    nota.textContent = "";
  } else {
    $("ficha-precio").textContent = rangoPrecios(pr.precios);
    nota.textContent = Object.keys(pr.precios).length > 1 ? "Elige una talla para ver su precio." : "";
  }

  // Chips de tela
  $("ficha-tela").textContent = pr ? nombreTela(fichaSeleccion.tela) : "";
  const chipsTela = $("ficha-telas");
  chipsTela.innerHTML = "";
  telasProducto.forEach((t) => {
    const prt = p.presentaciones[t.id];
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (t.id === fichaSeleccion.tela ? " activo" : "") + (prt.disponible ? "" : " agotado");
    b.textContent = t.nombre;
    b.title = prt.disponible ? rangoPrecios(prt.precios) : "Agotado";
    b.addEventListener("click", () => { fichaSeleccion.tela = t.id; fichaSeleccion.talla = null; pintarVista(); });
    chipsTela.appendChild(b);
  });

  // Chips de talla (las que no vienen en esta tela aparecen tachadas)
  $("ficha-talla").textContent = fichaSeleccion.talla ? estado.tallas.find((t) => t.id === fichaSeleccion.talla)?.nombre : "";
  const chipsTalla = $("ficha-tallas");
  chipsTalla.innerHTML = "";
  estado.tallas.forEach((ta) => {
    const existe = pr && ta.id in pr.precios;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip chip-talla" + (ta.id === fichaSeleccion.talla ? " activo" : "") + (existe && pr.disponible ? "" : " agotado");
    b.textContent = ta.nombre;
    b.disabled = !existe || !pr.disponible;
    b.addEventListener("click", () => { fichaSeleccion.talla = ta.id; pintarVista(); });
    chipsTalla.appendChild(b);
  });

  // JSON propuesto (con nombres en lugar de ids para que se entienda)
  const legible = {
    codigo: p.codigo,
    precioDesde: p.precioDesde,
    presentaciones: Object.fromEntries(Object.entries(p.presentaciones).map(([id, x]) => [
      nombreTela(id),
      { disponible: x.disponible, precios: Object.fromEntries(Object.entries(x.precios).map(([tid, v]) => [estado.tallas.find((t) => t.id === tid)?.nombre ?? tid, v])) }
    ]))
  };
  $("ficha-json").textContent = JSON.stringify(legible, null, 2);
}

$("select-producto").addEventListener("change", (e) => {
  fichaSeleccion = { numero: Number(e.target.value), tela: null, talla: null };
  pintarVista();
});

// =====================================================================
// Navegación y arranque
// =====================================================================
function irAPaso(paso) {
  document.querySelectorAll(".tabs-config .tab").forEach((t) => {
    const activo = t.dataset.paso === paso;
    t.classList.toggle("active", activo);
    t.setAttribute("aria-selected", String(activo));
  });
  ["config", "producto", "vista"].forEach((p) => ($(`paso-${p}`).hidden = p !== paso));
  try { sessionStorage.setItem(CLAVE + "-paso", paso); } catch {}
  pintarTodo();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function pintarTodo() {
  pintarConfig();
  pintarFormulario();
  pintarListaProductos();
  pintarVista();
}

document.querySelectorAll(".tabs-config .tab").forEach((t) =>
  t.addEventListener("click", () => irAPaso(t.dataset.paso))
);

$("btn-reiniciar").addEventListener("click", () => {
  if (!confirm("¿Borrar todo lo del prototipo y empezar de nuevo?")) return;
  estado = estadoInicial();
  guardar();
  limpiarFormulario();
  irAPaso("config");
});

if (!categoria) {
  location.replace("app.html");
} else {
  $("cat-icono").textContent = categoria.icono;
  $("cat-nombre").textContent = categoria.nombre;
  document.title = `Configuración de ${categoria.nombre} · App Factory`;
  if (categoria.id === "ropa") {
    $("vista-ropa").hidden = false;
    let paso = "config";
    try { paso = sessionStorage.getItem(CLAVE + "-paso") || "config"; } catch {}
    irAPaso(paso);
  } else {
    $("vista-proximamente").hidden = false;
    document.querySelector(".aviso-prototipo").hidden = true;
  }
}
