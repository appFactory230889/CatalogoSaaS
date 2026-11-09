// Productos de una categoría: subir (foto + código encima), listar, inhabilitar y borrar.
import {
  auth, db, storage, configLista, onAuthStateChanged,
  ref, get, update, query, orderByChild, equalTo, serverTimestamp,
  sRef, uploadBytes, getDownloadURL, deleteObject, updateMetadata
} from "./firebase.js";
import {
  categoriaPorId, leerNegocio, formatearCodigo, formatearPrecio, num,
  pintarUsoPlan, linkWhatsApp,
  asegurarConfigCategoria, leerPresentaciones, leerAtributos, tieneVariosPrecios
} from "./datos.js";
import { especDe, textos } from "./especificaciones.js";
import { crearEditorPresentaciones } from "./presentaciones.js";
import {
  linkCatalogo, compartirLink, descargarImagen, metadatosFoto, ICONO_COMPARTIR, ICONO_DESCARGAR
} from "./compartir.js";
import { dibujarCodigo } from "./marca-codigo.js";

const $ = (id) => document.getElementById(id);
const categoria = categoriaPorId(new URLSearchParams(location.search).get("c"));
const ANCHO_MAXIMO = 1080; // px de la imagen final

let usuario = null;
let negocio = null;
let productos = [];
let imagen = null; // HTMLImageElement elegido
const espec = especDe(categoria?.id);           // null = categoría sin especificaciones aún
const usaPresentaciones = !!espec;
let configCat = { variantes: [], tallas: [], listas: {} };
let editor = null;
let editando = null; // producto que se está editando (null = producto nuevo)

// ---------- utilidades de UI ----------
let toastTimer;
function toast(texto) {
  const el = $("toast");
  el.textContent = texto;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 2600);
}

function pintarUso() {
  const lleno = pintarUsoPlan(negocio, (usados, limite) => `${usados} de ${limite} productos usados en tu catálogo`);
  $("btn-nuevo").disabled = lleno;
}

function pintarProductos() {
  const grid = $("grid-productos");
  grid.innerHTML = "";
  $("cat-conteo").textContent = `${productos.length} producto${productos.length === 1 ? "" : "s"}`;
  $("lista-vacia").hidden = productos.length > 0;

  productos.forEach((p) => {
    const card = document.createElement("article");
    card.className = "producto" + (p.disponible ? "" : " inhabilitado");
    card.innerHTML = `
      <div class="producto-foto">
        <img loading="lazy" alt="">
        <span class="producto-estado">Inhabilitado</span>
      </div>
      <div class="producto-info">
        <div class="producto-fila">
          <strong class="producto-codigo"></strong>
          <span class="producto-precio"></span>
        </div>
        <div class="producto-fila">
          <label class="interruptor">
            <input type="checkbox">
            <span class="interruptor-pista" aria-hidden="true"></span>
            <span>Disponible</span>
          </label>
          <button type="button" class="btn-icono" data-acc="borrar" title="Borrar producto" aria-label="Borrar producto">🗑️</button>
        </div>
        <div class="producto-acciones">
          <button type="button" class="btn btn-fantasma btn-sm" data-acc="editar">✏️ Editar</button>
          <button type="button" class="btn btn-fantasma btn-sm" data-acc="descargar" title="Descargar imagen">${ICONO_DESCARGAR}<span>Imagen</span></button>
        </div>
      </div>`;
    card.querySelector("img").src = p.foto;
    card.querySelector("img").alt = `Producto ${p.codigo}`;
    card.querySelector(".producto-codigo").textContent = p.codigo;
    card.querySelector(".producto-precio").textContent =
      (tieneVariosPrecios(p.presentaciones) ? "desde " : "") + formatearPrecio(p.precio);
    const variantes = Object.keys(p.presentaciones)
      .map((id) => configCat.variantes.find((t) => t.id === id)?.nombre).filter(Boolean);
    const tipo = p.atributos.find((a) => a.clave === "tipo")?.nombre;
    const detalle = [tipo, variantes.join(" · ")].filter(Boolean).join(" — ");
    if (detalle) {
      const det = document.createElement("p");
      det.className = "producto-detalle";
      det.textContent = detalle;
      card.querySelector(".producto-info").insertBefore(det, card.querySelector(".producto-info").children[1]);
    }

    const check = card.querySelector("input[type=checkbox]");
    check.checked = p.disponible;
    check.addEventListener("change", () => cambiarDisponible(p, check));
    card.querySelector('[data-acc="borrar"]').addEventListener("click", () => borrarProducto(p));
    card.querySelector('[data-acc="editar"]').addEventListener("click", () => abrirFormulario(p));
    card.querySelector('[data-acc="descargar"]').addEventListener("click", () => descargar(p));
    grid.appendChild(card);
  });
}

// ---------- carga ----------
async function cargarProductos() {
  const snap = await get(query(ref(db, `productos/${usuario.uid}`), orderByChild("categoria"), equalTo(categoria.id)));
  const lista = [];
  snap.forEach((hijo) => {
    const d = hijo.val() || {};
    if (typeof d.foto !== "string" || typeof d.codigo !== "string") return;
    lista.push({
      numero: num(d.numero),
      codigo: d.codigo,
      precio: num(d.precioDesde, num(d.precio)),
      presentaciones: leerPresentaciones(d.presentaciones),
      atributos: leerAtributos(categoria.id, d.atributos, configCat),
      atributosCrudos: d.atributos && typeof d.atributos === "object" ? d.atributos : {},
      foto: d.foto,
      rutaFoto: typeof d.rutaFoto === "string" ? d.rutaFoto : "",
      disponible: d.disponible !== false
    });
  });
  productos = lista.sort((a, b) => b.numero - a.numero);
  pintarProductos();
}

async function iniciar(user) {
  usuario = user;
  negocio = await leerNegocio(user.uid);
  if (!negocio.nombre || !negocio.codigoCliente || negocio.bloqueo) {
    location.replace("app.html");
    return;
  }
  $("cat-icono").textContent = categoria.icono;
  $("cat-icono").style.setProperty("--acento", categoria.color);
  $("cat-nombre").textContent = categoria.nombre;
  document.title = `${categoria.nombre} · App Factory Catalog`;
  pintarUso();
  const link = linkCatalogo(negocio.codigoCliente, categoria.id);
  $("btn-ver-categoria").href = link;
  $("btn-compartir-categoria").innerHTML = `${ICONO_COMPARTIR} Compartir ${categoria.nombre}`;
  $("btn-compartir-categoria").addEventListener("click", () => compartirLink({
    url: link,
    titulo: `${categoria.nombre} · ${negocio.nombre}`,
    texto: `Mira ${categoria.nombre} en el catálogo de ${negocio.nombre}`
  }, toast));
  if (usaPresentaciones) {
    configCat = await asegurarConfigCategoria(user.uid, categoria.id);
    const v = espec.variante, tx = textos(v);
    $("titulo-presentaciones").textContent = `Presentaciones (${v.plural})`;
    $("ayuda-presentaciones").textContent =
      `Toca ${v.femenino ? "las" : "los"} ${v.plural} en que viene este producto. Cada ${v.singular} tiene sus propios precios por ${espec.tallas.singular}.`;
    $("link-config").href = `configuracion.html?c=${categoria.id}`;
    $("link-config").textContent = `Editar ${v.plural} y ${espec.tallas.plural}`;
    editor = crearEditorPresentaciones({
      contChips: $("chips-telas"), contPresentaciones: $("presentaciones"), toast, variante: v, tallas: espec.tallas
    });
    editor.setConfig(configCat);
    pintarSelectoresAtributos();
    $("bloque-precio-simple").hidden = true;
    $("bloque-presentaciones").hidden = false;
  }
  await cargarProductos();
  $("vista-cargando").hidden = true;
  $("vista-categoria").hidden = false;
}

// ---------- atributos (tipo, tacón, calce…) ----------
function pintarSelectoresAtributos() {
  const cont = $("bloque-atributos");
  cont.innerHTML = "";
  espec.atributos.forEach((a) => {
    const label = document.createElement("label");
    label.className = "campo";
    if (a.texto) {
      label.innerHTML = `<span></span><input type="text" data-atributo="${a.clave}" autocomplete="off">`;
      label.querySelector("span").textContent = a.nombre;
      label.querySelector("input").placeholder = a.ejemplo;
      label.querySelector("input").maxLength = a.maxLargo || 60;
      cont.appendChild(label);
      return;
    }
    const opciones = a.lista ? configCat.listas[a.lista] || [] : a.opciones;
    label.innerHTML = `<span></span><select data-atributo="${a.clave}"><option value="">Sin especificar</option></select>`;
    label.querySelector("span").textContent = a.nombre;
    const select = label.querySelector("select");
    opciones.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = o.nombre;
      select.appendChild(opt);
    });
    cont.appendChild(label);
  });
}

function leerSelectoresAtributos() {
  const atributos = {};
  document.querySelectorAll("#bloque-atributos [data-atributo]").forEach((s) => {
    const v = s.value.trim().replace(/\s+/g, " ");
    if (v) atributos[s.dataset.atributo] = v;
  });
  return atributos;
}

// ---------- foto + código ----------
async function dibujar(codigo) {
  const lienzo = $("lienzo");
  const escala = Math.min(1, ANCHO_MAXIMO / imagen.naturalWidth);
  lienzo.width = Math.round(imagen.naturalWidth * escala);
  lienzo.height = Math.round(imagen.naturalHeight * escala);
  const ctx = lienzo.getContext("2d");
  ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  await dibujarCodigo(ctx, lienzo.width, lienzo.height, codigo);
}

function codigoSiguiente() {
  return formatearCodigo(negocio.codigoCliente, negocio.codigoDisponible);
}

$("input-foto").addEventListener("change", (e) => {
  const archivo = e.target.files?.[0];
  if (!archivo) return;
  if (!archivo.type.startsWith("image/")) {
    $("msg-producto").textContent = "El archivo debe ser una imagen.";
    return;
  }
  const url = URL.createObjectURL(archivo);
  const img = new Image();
  img.onload = async () => {
    imagen = img;
    await dibujar(editando ? editando.codigo : codigoSiguiente());
    $("foto-actual").hidden = true;
    $("lienzo").hidden = false;
    $("selector-texto").hidden = true;
    $("msg-producto").textContent = "";
    URL.revokeObjectURL(url);
  };
  img.onerror = () => {
    $("msg-producto").textContent = "No se pudo abrir esa imagen. Prueba con otra (JPG o PNG).";
    URL.revokeObjectURL(url);
  };
  img.src = url;
});

function abrirFormulario(producto = null) {
  editando = producto;
  imagen = null;
  $("input-foto").value = "";
  $("precio").value = producto && !usaPresentaciones ? producto.precio : "";
  if (producto) editor?.cargar(producto.presentaciones);
  else editor?.reiniciar();
  document.querySelectorAll("#bloque-atributos [data-atributo]").forEach((s) => {
    const v = producto?.atributosCrudos?.[s.dataset.atributo];
    s.value = typeof v === "string" ? v : "";
  });
  $("lienzo").hidden = true;
  $("foto-actual").hidden = !producto;
  if (producto) $("foto-actual").src = producto.foto;
  $("selector-texto").hidden = !!producto;
  $("msg-producto").textContent = "";
  $("titulo-form").textContent = producto ? `Editar ${producto.codigo}` : "Nuevo producto";
  $("btn-guardar").textContent = producto ? "Guardar cambios" : "Guardar producto";
  $("ayuda-foto").innerHTML = producto
    ? "Toca la foto si quieres cambiarla. Se mantiene el código <strong></strong>."
    : "El código <strong></strong> se coloca sobre la foto y así se guarda.";
  $("ayuda-foto").querySelector("strong").textContent = producto ? producto.codigo : codigoSiguiente();
  $("form-producto").hidden = false;
  $("btn-nuevo").hidden = true;
  $("form-producto").scrollIntoView({ behavior: "smooth", block: "start" });
}

function cerrarFormulario() {
  editando = null;
  $("form-producto").hidden = true;
  $("btn-nuevo").hidden = false;
}

$("btn-nuevo").addEventListener("click", () => abrirFormulario());
$("btn-cancelar").addEventListener("click", cerrarFormulario);

// ---------- guardar ----------
$("btn-guardar").addEventListener("click", async () => {
  const msg = $("msg-producto");
  if (!imagen && !editando) return (msg.textContent = "Elige una foto.");
  let precio, extra = {};
  if (usaPresentaciones) {
    const r = editor.construir();
    if (r.error) return (msg.textContent = r.error);
    precio = r.precioDesde;
    extra = { precioDesde: r.precioDesde, presentaciones: r.presentaciones };
    const atributos = leerSelectoresAtributos();
    if (Object.keys(atributos).length) extra.atributos = atributos;
    else if (editando) extra.atributos = null; // quitar especificaciones borradas
  } else {
    precio = Math.round(parseFloat($("precio").value) * 100) / 100;
    if (!Number.isFinite(precio) || precio <= 0) return (msg.textContent = "Escribe un precio válido.");
  }

  const btn = $("btn-guardar");
  btn.disabled = true;
  btn.textContent = "Guardando…";
  msg.textContent = "";
  if (editando) {
    await guardarEdicion(editando, precio, extra, msg);
    btn.disabled = false;
    btn.textContent = editando ? "Guardar cambios" : "Guardar producto";
    return;
  }
  let archivo = null;
  try {
    // 1. Leer el contador más reciente (puede haber cambiado en otro dispositivo).
    negocio = await leerNegocio(usuario.uid);
    pintarUso();
    if (negocio.totalItems >= negocio.limite) {
      msg.innerHTML = `Llegaste al límite de ${negocio.limite} productos. <a target="_blank" rel="noopener">Amplía tu plan por WhatsApp</a>.`;
      msg.querySelector("a").href = linkWhatsApp(
        `Hola, soy ${negocio.nombre} (código de cliente ${String(negocio.codigoCliente).padStart(3, "0")}) y llegué al límite de productos. Quiero ampliar mi plan.`
      );
      return;
    }
    const numero = negocio.codigoDisponible;
    const codigo = formatearCodigo(negocio.codigoCliente, numero);

    // 2. "Captura": la foto con el código encima.
    await dibujar(codigo);
    $("codigo-preview").textContent = codigo;
    const blob = await new Promise((r) => $("lienzo").toBlob(r, "image/jpeg", 0.88));
    if (!blob) throw new Error("No se pudo generar la imagen");

    // 3. Subir a Storage con el nombre del código.
    const rutaFoto = `catalogos/${usuario.uid}/${codigo}.jpg`;
    archivo = sRef(storage, rutaFoto);
    await uploadBytes(archivo, blob, metadatosFoto(codigo));
    const foto = await getDownloadURL(archivo);

    // 4. Guardar producto y sumar +1 a los contadores, todo en una sola escritura.
    await update(ref(db), {
      [`productos/${usuario.uid}/${numero}`]: {
        numero, codigo, categoria: categoria.id, precio, foto, rutaFoto,
        disponible: true, creadoEn: serverTimestamp(), ...extra
      },
      [`negocios/${usuario.uid}/codigoDisponible`]: numero + 1,
      [`negocios/${usuario.uid}/totalItems`]: negocio.totalItems + 1
    });
    archivo = null;

    negocio.codigoDisponible = numero + 1;
    negocio.totalItems += 1;
    pintarUso();
    productos.unshift({ numero, codigo, precio, foto, rutaFoto, disponible: true, presentaciones: extra.presentaciones || {},
      atributos: leerAtributos(categoria.id, extra.atributos, configCat) });
    pintarProductos();
    cerrarFormulario();
    toast(`Producto ${codigo} guardado`);
  } catch (err) {
    console.error(err);
    msg.textContent = "No se pudo guardar el producto. Intenta de nuevo.";
    if (archivo) deleteObject(archivo).catch(() => {});
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar producto";
  }
});

// ---------- editar ----------
async function guardarEdicion(p, precio, extra, msg) {
  try {
    const cambios = { precio, ...extra };
    if (imagen) {
      // Foto nueva: se dibuja el MISMO código y reemplaza a la anterior en Storage.
      await dibujar(p.codigo);
      const blob = await new Promise((r) => $("lienzo").toBlob(r, "image/jpeg", 0.88));
      if (!blob) throw new Error("No se pudo generar la imagen");
      const rutaFoto = p.rutaFoto || `catalogos/${usuario.uid}/${p.codigo}.jpg`;
      const archivo = sRef(storage, rutaFoto);
      await uploadBytes(archivo, blob, metadatosFoto(p.codigo));
      cambios.foto = await getDownloadURL(archivo);
      cambios.rutaFoto = rutaFoto;
    }
    await update(ref(db, `productos/${usuario.uid}/${p.numero}`), cambios);

    Object.assign(p, {
      precio,
      presentaciones: extra.presentaciones || p.presentaciones,
      atributosCrudos: extra.atributos || {},
      atributos: leerAtributos(categoria.id, extra.atributos, configCat)
    });
    if (cambios.foto) Object.assign(p, { foto: cambios.foto, rutaFoto: cambios.rutaFoto });
    pintarProductos();
    cerrarFormulario();
    toast(`Producto ${p.codigo} actualizado`);
  } catch (err) {
    console.error(err);
    msg.textContent = "No se pudieron guardar los cambios. Intenta de nuevo.";
  }
}

// ---------- descargar imagen ----------
async function descargar(p) {
  // Las fotos subidas antes de este botón no tenían el nombre de descarga: se les agrega una vez.
  if (p.rutaFoto) {
    await updateMetadata(sRef(storage, p.rutaFoto), { contentDisposition: metadatosFoto(p.codigo).contentDisposition })
      .catch(() => {});
  }
  descargarImagen(p.foto, p.codigo, toast);
}

// ---------- inhabilitar / borrar ----------
async function cambiarDisponible(p, check) {
  check.disabled = true;
  try {
    await update(ref(db, `productos/${usuario.uid}/${p.numero}`), { disponible: check.checked });
    p.disponible = check.checked;
    pintarProductos();
    toast(p.disponible ? `${p.codigo} disponible` : `${p.codigo} inhabilitado`);
  } catch (err) {
    console.error(err);
    check.checked = p.disponible;
    toast("No se pudo cambiar. Intenta de nuevo.");
  } finally {
    check.disabled = false;
  }
}

async function borrarProducto(p) {
  const ok = confirm(`¿Borrar el producto ${p.codigo}?\n\nSe elimina para siempre y libera un espacio de tu límite. El código ${p.codigo} no se vuelve a usar.`);
  if (!ok) return;
  try {
    negocio = await leerNegocio(usuario.uid);
    await update(ref(db), {
      [`productos/${usuario.uid}/${p.numero}`]: null,
      [`negocios/${usuario.uid}/totalItems`]: negocio.totalItems - 1,
      [`negocios/${usuario.uid}/ultimoBorrado`]: String(p.numero)
    });
    if (p.rutaFoto) deleteObject(sRef(storage, p.rutaFoto)).catch(() => {});
    negocio.totalItems -= 1;
    productos = productos.filter((x) => x.numero !== p.numero);
    pintarUso();
    pintarProductos();
    toast(`Producto ${p.codigo} borrado`);
  } catch (err) {
    console.error(err);
    toast("No se pudo borrar. Intenta de nuevo.");
  }
}

// ---------- arranque ----------
if (!configLista || !categoria) {
  location.replace(configLista ? "app.html" : "ingresar.html");
} else {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      location.replace("ingresar.html");
      return;
    }
    iniciar(user).catch((err) => {
      console.error(err);
      $("vista-cargando").innerHTML = "<p>No se pudo cargar la categoría. Revisa tu conexión o las reglas de Firebase.</p>";
    });
  });
}
