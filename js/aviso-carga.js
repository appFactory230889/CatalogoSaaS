// Red de seguridad (script clásico, se carga ANTES de los módulos).
// Si la página se queda en "Cargando…" o falla un archivo JS (por ejemplo, porque el
// navegador mezcló versiones viejas y nuevas guardadas en caché), muestra un botón
// que descarga de nuevo todos los archivos y recarga.
(function () {
  var ARCHIVOS = [
    "js/firebase.js", "js/firebase-config.js", "js/datos.js", "js/presentaciones.js",
    "js/marca-codigo.js", "js/compartir.js", "js/auth.js", "js/app.js", "js/categoria.js",
    "js/configuracion.js", "js/catalogo.js", "css/styles.css"
  ];

  function recargarSinCache() {
    var pedidos = ARCHIVOS.map(function (a) {
      return fetch(a, { cache: "reload" }).catch(function () {});
    });
    Promise.all(pedidos).then(function () { location.reload(); });
  }

  function avisar() {
    var c = document.getElementById("vista-cargando");
    if (!c || c.hidden || c.dataset.avisado) return;
    c.dataset.avisado = "1";
    c.innerHTML =
      '<p>La página no terminó de cargar.</p>' +
      '<button type="button" class="btn btn-primario" style="width:auto">Recargar</button>';
    c.querySelector("button").addEventListener("click", function (e) {
      e.target.disabled = true;
      e.target.textContent = "Recargando…";
      recargarSinCache();
    });
  }

  window.addEventListener("error", function (e) {
    var archivo = e.filename || "";
    if (archivo.indexOf("/js/") !== -1 || e.error instanceof SyntaxError) setTimeout(avisar, 300);
  });
  setTimeout(avisar, 15000);
})();
