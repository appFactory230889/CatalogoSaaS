// Links del catálogo público y botón de compartir (celular: menú de compartir; PC: copiar).
import { formatearCliente } from "./datos.js";

/** catalogo.html?t=001  o  catalogo.html?t=001&c=ropa (solo esa categoría) */
export function linkCatalogo(codigoCliente, categoriaId = null) {
  const url = new URL("catalogo.html", location.href);
  url.search = "";
  url.searchParams.set("t", formatearCliente(codigoCliente));
  if (categoriaId) url.searchParams.set("c", categoriaId);
  return url.href;
}

export async function compartirLink({ url, titulo, texto }, toast) {
  if (navigator.share) {
    try { await navigator.share({ title: titulo, text: texto, url }); } catch {}
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast?.("Link copiado. Pégalo en WhatsApp o donde quieras.");
  } catch {
    prompt("Copia este link:", url);
  }
}

/**
 * Descarga la foto del producto como "001-0004.jpg" (para publicarla en redes).
 * 1) Si Storage tiene CORS configurado (ver cors.json), la baja directo con su nombre.
 * 2) Si no, abre la foto: las subidas con "Content-Disposition: attachment" se descargan
 *    solas; las más viejas se abren en otra pestaña para guardarlas.
 */
export async function descargarImagen(url, codigo, toast) {
  const nombre = `${codigo}.jpg`;
  try {
    const r = await fetch(url, { mode: "cors" });
    if (!r.ok) throw new Error(String(r.status));
    const blob = await r.blob();
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(blob);
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 5000);
    toast?.(`Imagen ${nombre} descargada`);
  } catch {
    window.open(url, "_blank", "noopener");
    toast?.("Si la imagen se abrió en otra pestaña, mantenla presionada (o clic derecho) y elige «Guardar imagen».");
  }
}

/** Metadatos para subir fotos: así se descargan con su nombre aunque no haya CORS. */
export const metadatosFoto = (codigo) => ({
  contentType: "image/jpeg",
  cacheControl: "public,max-age=31536000",
  contentDisposition: `attachment; filename="${codigo}.jpg"`
});

export const ICONO_DESCARGAR =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>';

export const ICONO_COMPARTIR =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>';
