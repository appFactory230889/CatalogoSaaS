// Dibuja el código del producto sobre la foto, de forma SUTIL:
// letras blancas semitransparentes con una sombra gris suave (como la app Android),
// para que el producto siga siendo el protagonista pero el código no se pierda
// sobre fondos blancos. Las clientas lo usan para buscar el producto en el catálogo.
export async function dibujarCodigo(ctx, ancho, alto, codigo) {
  const tamano = Math.round(Math.max(16, ancho * 0.045));
  try { await document.fonts.load(`700 ${tamano}px Montserrat`); } catch {}

  ctx.save();
  ctx.font = `700 ${tamano}px Montserrat, "Plus Jakarta Sans", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = Math.max(2, tamano * 0.18);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.max(1, tamano * 0.04);
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.fillText(codigo, ancho / 2, alto / 2);
  ctx.restore();
}
