// Presentaciones (tela en Ropa, color en Zapatos…) con precio por talla — estilo SHEIN/TEMU.
//  - crearEditorPresentaciones: lo usa la dueña al subir un producto de Ropa.
//  - crearSelectorPresentaciones: lo ve la clienta en el catálogo (elige tela y talla).
import { formatearPrecio, rangoPrecios } from "./datos.js";
import { textos } from "./especificaciones.js";

// =====================================================================
// Editor (administradora)
// =====================================================================
export function crearEditorPresentaciones({ contChips, contPresentaciones, toast, variante, tallas: specTallas }) {
  const tx = textos(variante);
  const tt = textos(specTallas || { singular: "talla", plural: "tallas", femenino: true });
  let config = { variantes: [], tallas: [] };
  let borrador = {}; // { telaId: { disponible, mismoPrecio, precio, tallas: { tallaId: { activa, precio } } } }

  const nombreTela = (id) => config.variantes.find((t) => t.id === id)?.nombre ?? "";

  function presentacionVacia() {
    const tallas = {};
    config.tallas.forEach((t) => (tallas[t.id] = { activa: true, precio: "" }));
    return { disponible: true, mismoPrecio: true, precio: "", tallas };
  }

  function pintarChips() {
    contChips.innerHTML = "";
    config.variantes.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (borrador[t.id] ? " activo" : "");
      b.textContent = t.nombre;
      b.setAttribute("aria-pressed", String(!!borrador[t.id]));
      b.addEventListener("click", () => {
        if (borrador[t.id]) delete borrador[t.id];
        else borrador[t.id] = presentacionVacia();
        pintar();
      });
      contChips.appendChild(b);
    });
  }

  function pintarPresentaciones() {
    contPresentaciones.innerHTML = "";
    config.variantes.filter((t) => borrador[t.id]).forEach((t) => {
      const pr = borrador[t.id];
      config.tallas.forEach((ta) => { if (!pr.tallas[ta.id]) pr.tallas[ta.id] = { activa: false, precio: "" }; });

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
          <button type="button" class="btn-icono" data-acc="quitar" title="Quitar" aria-label="Quitar">✕</button>
        </div>
        <label class="check-linea">
          <input type="checkbox" data-campo="mismo"> Mismo precio para ${tt.todas} ${tt.las} ${tt.plural}
        </label>
        <div class="precio-unico" data-bloque="unico">
          <span>$</span><input type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" aria-label="Precio">
        </div>
        <p class="ayuda-tallas"></p>
        <div class="grid-tallas"></div>
        <div class="presentacion-pie"></div>`;
      caja.querySelector("strong").textContent = t.nombre;

      const chkDisp = caja.querySelector('[data-campo="disponible"]');
      chkDisp.checked = pr.disponible;
      chkDisp.addEventListener("change", () => { pr.disponible = chkDisp.checked; caja.classList.toggle("agotada", !pr.disponible); });

      caja.querySelector('[data-acc="quitar"]').addEventListener("click", () => { delete borrador[t.id]; pintar(); });

      const chkMismo = caja.querySelector('[data-campo="mismo"]');
      chkMismo.checked = pr.mismoPrecio;
      chkMismo.addEventListener("change", () => {
        pr.mismoPrecio = chkMismo.checked;
        if (!pr.mismoPrecio && pr.precio) Object.values(pr.tallas).forEach((x) => { if (!x.precio) x.precio = pr.precio; });
        pintarPresentaciones();
      });

      const bloqueUnico = caja.querySelector('[data-bloque="unico"]');
      bloqueUnico.hidden = !pr.mismoPrecio;
      const inputUnico = bloqueUnico.querySelector("input");
      inputUnico.value = pr.precio;
      inputUnico.addEventListener("input", () => (pr.precio = inputUnico.value));

      caja.querySelector(".ayuda-tallas").textContent = pr.mismoPrecio
        ? `Marca ${tt.las} ${tt.plural} en que viene ${tx.esta.toLowerCase()} ${variante.singular}:`
        : `Marca ${tt.las} ${tt.plural} y escribe el precio de cada ${tt.singular === "tamaño" ? "uno" : "una"}:`;

      const grid = caja.querySelector(".grid-tallas");
      config.tallas.forEach((ta) => {
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

      const otras = config.variantes.filter((o) => o.id !== t.id && borrador[o.id]);
      const pie = caja.querySelector(".presentacion-pie");
      if (otras.length) {
        pie.innerHTML = `<span>Copiar ${tt.plural} y precios de:</span>`;
        otras.forEach((o) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "chip chip-sm";
          b.textContent = o.nombre;
          b.addEventListener("click", () => {
            borrador[t.id] = structuredClone({ ...borrador[o.id], disponible: pr.disponible });
            pintarPresentaciones();
            toast?.(`Copiado de ${o.nombre}`);
          });
          pie.appendChild(b);
        });
      }
      contPresentaciones.appendChild(caja);
    });
  }

  function pintar() {
    pintarChips();
    pintarPresentaciones();
  }

  function precioValido(v) {
    const n = Math.round(parseFloat(v) * 100) / 100;
    return Number.isFinite(n) && n > 0 && n < 100000 ? n : null;
  }

  /** Devuelve { error } o { presentaciones, precioDesde } listo para Firebase. */
  function construir() {
    const ids = config.variantes.map((t) => t.id).filter((id) => borrador[id]);
    if (!ids.length) return { error: `Elige al menos ${tx.un} ${variante.singular}.` };
    const presentaciones = {};
    for (const id of ids) {
      const pr = borrador[id];
      const activas = config.tallas.filter((ta) => pr.tallas[ta.id]?.activa);
      if (!activas.length) return { error: `${nombreTela(id)}: marca al menos ${tt.un} ${tt.singular}.` };
      const precios = {};
      for (const ta of activas) {
        const p = precioValido(pr.mismoPrecio ? pr.precio : pr.tallas[ta.id].precio);
        if (p === null) {
          return { error: pr.mismoPrecio
            ? `${nombreTela(id)}: escribe el precio.`
            : `${nombreTela(id)}: falta el precio de ${tt.la} ${tt.singular} ${ta.nombre}.` };
        }
        precios[ta.id] = p;
      }
      presentaciones[id] = { disponible: pr.disponible, precios };
    }
    const precioDesde = Math.min(...Object.values(presentaciones).flatMap((p) => Object.values(p.precios)));
    return { presentaciones, precioDesde };
  }

  return {
    setConfig(c) { config = c; pintar(); },
    reiniciar() { borrador = {}; pintar(); },
    /** Carga las presentaciones de un producto ya guardado (para editarlo). */
    cargar(presentaciones) {
      borrador = {};
      Object.entries(presentaciones || {}).forEach(([id, pr]) => {
        const valores = Object.values(pr.precios);
        const mismo = new Set(valores).size <= 1;
        const tallas = {};
        config.tallas.forEach((t) => {
          const v = pr.precios[t.id];
          tallas[t.id] = { activa: v !== undefined, precio: v !== undefined ? String(v) : "" };
        });
        borrador[id] = { disponible: pr.disponible, mismoPrecio: mismo, precio: mismo && valores.length ? String(valores[0]) : "", tallas };
      });
      pintar();
    },
    construir
  };
}

// =====================================================================
// Selector (clienta): elige tela y talla, el precio se actualiza
// =====================================================================
export function crearSelectorPresentaciones({ contTelas, contTallas, elTela, elTalla, elPrecio, elNota, elGuia }) {
  let producto = null;
  let config = { variantes: [], tallas: [] };
  let tx = textos({ singular: "opción", plural: "opciones", femenino: true });
  let tt = textos({ singular: "talla", plural: "tallas", femenino: true });
  let tela = null, talla = null;

  const nombreDe = (lista, id) => lista.find((x) => x.id === id)?.nombre ?? "";

  function pintar() {
    const pres = producto.presentaciones;
    const telas = config.variantes.filter((t) => pres[t.id]);
    // Telas que ya no están en la configuración siguen visibles con su id
    Object.keys(pres).forEach((id) => { if (!telas.some((t) => t.id === id)) telas.push({ id, nombre: "Otra" }); });

    if (!pres[tela]) {
      tela = (telas.find((t) => pres[t.id].disponible) || telas[0])?.id ?? null;
      talla = null;
    }
    const pr = pres[tela];
    if (pr && !(talla in pr.precios)) talla = null;

    if (!pr) { elPrecio.textContent = ""; elNota.textContent = ""; }
    else if (!pr.disponible) { elPrecio.textContent = rangoPrecios(pr.precios); elNota.textContent = `${tx.esta} ${tx.singular} está ${tx.agotado}.`; }
    else if (talla) { elPrecio.textContent = formatearPrecio(pr.precios[talla]); elNota.textContent = ""; }
    else {
      elPrecio.textContent = rangoPrecios(pr.precios);
      elNota.textContent = Object.keys(pr.precios).length > 1 ? `Elige ${tt.un} ${tt.singular} para ver su precio.` : "";
    }

    elTela.textContent = pr ? nombreDe(telas, tela) : "";
    contTelas.innerHTML = "";
    telas.forEach((t) => {
      const prt = pres[t.id];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (t.id === tela ? " activo" : "") + (prt.disponible ? "" : " agotado");
      b.textContent = t.nombre;
      b.addEventListener("click", () => { tela = t.id; talla = null; pintar(); });
      contTelas.appendChild(b);
    });

    // Tallas en el orden de la configuración; las que no vienen en esta tela, tachadas.
    const tallas = [...config.tallas];
    Object.values(pres).forEach((p) => Object.keys(p.precios).forEach((id) => {
      if (!tallas.some((x) => x.id === id)) tallas.push({ id, nombre: "Otra" });
    }));
    elTalla.textContent = talla ? nombreDe(tallas, talla) : "";
    if (elGuia) {
      const cm = config.tallas.find((t) => t.id === talla)?.cm;
      elGuia.textContent = cm ? `Largo del pie: ${cm} cm` : "";
    }
    contTallas.innerHTML = "";
    tallas.filter((ta) => Object.values(pres).some((p) => ta.id in p.precios)).forEach((ta) => {
      const existe = pr && ta.id in pr.precios;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip chip-talla" + (ta.id === talla ? " activo" : "") + (existe && pr.disponible ? "" : " agotado");
      b.textContent = ta.nombre;
      b.disabled = !existe || !pr.disponible;
      b.addEventListener("click", () => { talla = ta.id; pintar(); });
      contTallas.appendChild(b);
    });
  }

  return {
    mostrar(p, c, variante, specTallas) {
      producto = p; config = c; tela = null; talla = null;
      if (variante) tx = textos(variante);
      if (specTallas) tt = textos(specTallas);
      pintar();
    },
    /** Tela y talla elegidas (para un futuro pedido por WhatsApp). */
    seleccion() { return { variante: nombreDe(config.variantes, tela), talla: nombreDe(config.tallas, talla) }; }
  };
}
