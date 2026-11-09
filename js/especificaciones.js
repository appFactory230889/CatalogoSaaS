// Especificaciones de cada categoría (solo datos, sin Firebase).
//
//  variante  → la "presentación" que la clienta elige antes de la talla; cada una con
//              sus propias tallas y precios (Ropa: tela · Zapatos: color).
//  tallas    → lista editable por cada negocio; conCm = guía de tallas con largo del pie.
//  atributos → datos fijos del producto. Con `lista`, la dueña edita las opciones en ⚙️;
//              con `opciones`, son fijas. `filtro` = la clienta puede filtrar por él.
//
// Para agregar otra categoría (Joyería, Niñ@s, Hogar) basta con definirla aquí
// y permitir sus listas en database.rules.json.

export const ESPECIFICACIONES = {
  ropa: {
    variante: {
      clave: "telas", singular: "tela", plural: "telas", femenino: true,
      titulo: "Tipos de tela",
      ayuda: "Cada tela es una presentación que puedes asignar a tus productos.",
      ejemplo: "Ej. Piel de durazno",
      iniciales: ["Sin especificar", "Liverpool", "Piel de durazno", "Cárdigan", "Quiana"]
    },
    tallas: { iniciales: ["XS", "S", "M", "L", "XL", "XXL"], ejemplo: "Ej. 3XL", conCm: false },
    atributos: []
  },

  zapatos: {
    variante: {
      clave: "colores", singular: "color", plural: "colores", femenino: false,
      titulo: "Colores",
      ayuda: "Cada color es una presentación con sus propias tallas y precios.",
      ejemplo: "Ej. Vino",
      iniciales: ["Negro", "Blanco", "Nude", "Café", "Dorado", "Plateado"]
    },
    tallas: {
      iniciales: ["35", "36", "37", "38", "39", "40", "41"],
      ejemplo: "Ej. 42",
      conCm: true,
      // Largo del pie aproximado (tabla de referencia tipo SHEIN); cada dueña puede ajustarlo.
      cmIniciales: { 35: 22.5, 36: 23, 37: 23.5, 38: 24, 39: 24.5, 40: 25, 41: 25.5 }
    },
    atributos: [
      {
        clave: "tipo", nombre: "Tipo de zapato", filtro: true,
        lista: "tipos", tituloLista: "Tipos de zapato",
        ayudaLista: "Tus clientas podrán filtrar el catálogo por tipo.",
        ejemplo: "Ej. Mocasín",
        iniciales: ["Tacón", "Sandalia", "Tenis", "Flats", "Botas", "Plataforma"]
      },
      {
        clave: "tacon", nombre: "Altura de tacón",
        opciones: [
          { id: "sin", nombre: "Sin tacón" },
          { id: "bajo", nombre: "Bajo (1–3 cm)" },
          { id: "medio", nombre: "Medio (4–7 cm)" },
          { id: "alto", nombre: "Alto (8 cm o más)" }
        ]
      },
      {
        clave: "calce", nombre: "Calce",
        opciones: [
          { id: "normal", nombre: "Talla normal" },
          { id: "pequena", nombre: "Horma pequeña: pide media talla más" },
          { id: "grande", nombre: "Horma grande: pide media talla menos" }
        ]
      }
    ]
  }
};

export const especDe = (categoriaId) => ESPECIFICACIONES[categoriaId] || null;

/** Textos con el género correcto: "una tela" / "un color", "agotada" / "agotado". */
export function textos(variante) {
  const f = variante.femenino;
  return {
    un: f ? "una" : "un",
    esta: f ? "Esta" : "Este",
    agotado: f ? "agotada" : "agotado",
    Singular: variante.singular[0].toUpperCase() + variante.singular.slice(1),
    Plural: variante.plural[0].toUpperCase() + variante.plural.slice(1)
  };
}
