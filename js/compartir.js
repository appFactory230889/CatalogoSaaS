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

export const ICONO_COMPARTIR =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>';
