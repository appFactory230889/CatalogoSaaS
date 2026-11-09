// Especificaciones de cada categoría (solo datos, sin Firebase).
//
//  variante  → la "presentación" que la clienta elige antes de la talla; cada una con
//              sus propias tallas y precios (Ropa: tela · Zapatos: color).
//  tallas    → lista editable por cada negocio (talla, medida o tamaño según la categoría);
//              conCm = guía de tallas con largo del pie.
//  atributos → datos fijos del producto. Con `lista`, la dueña edita las opciones en ⚙️;
//              con `opciones`, son fijas; con `texto`, se escriben libremente.
//              `filtro` = la clienta puede filtrar el catálogo por él.
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
    tallas: { singular: "talla", plural: "tallas", femenino: true, iniciales: ["XS", "S", "M", "L", "XL", "XXL"], ejemplo: "Ej. 3XL", conCm: false },
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
      singular: "talla", plural: "tallas", femenino: true,
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
  },

  joyeria: {
    variante: {
      clave: "materiales", singular: "material", plural: "materiales", femenino: false,
      titulo: "Materiales / baños",
      ayuda: "Cada material es una presentación con sus propias medidas y precios.",
      ejemplo: "Ej. Oro rosa",
      iniciales: ["Oro laminado", "Plata 925", "Acero inoxidable", "Chapa de oro", "Fantasía"]
    },
    tallas: {
      singular: "medida", plural: "medidas", femenino: true,
      iniciales: ["Única", "Anillo 6", "Anillo 7", "Anillo 8", "Anillo 9", "Cadena 40 cm", "Cadena 45 cm", "Cadena 50 cm", "Pulsera 18 cm"],
      ejemplo: "Ej. Anillo 10", conCm: false
    },
    atributos: [
      {
        clave: "tipo", nombre: "Tipo de joya", filtro: true,
        lista: "tipos", tituloLista: "Tipos de joya",
        ayudaLista: "Tus clientas podrán filtrar el catálogo por tipo.",
        ejemplo: "Ej. Broche",
        iniciales: ["Anillo", "Collar", "Cadena", "Pulsera", "Aretes", "Conjunto", "Tobillera", "Reloj"]
      }
    ]
  },

  ninos: {
    variante: {
      clave: "disenos", singular: "diseño", plural: "diseños", femenino: false,
      titulo: "Colores / diseños",
      ayuda: "Cada color o diseño es una presentación con sus propias tallas y precios. Usa «Único» si el artículo viene en una sola versión.",
      ejemplo: "Ej. Unicornio",
      iniciales: ["Único", "Rosa", "Azul", "Blanco", "Multicolor"]
    },
    tallas: {
      singular: "talla", plural: "tallas", femenino: true,
      iniciales: ["Única", "0–3 m", "3–6 m", "6–12 m", "1 año", "2 años", "3 años", "4 años", "6 años", "8 años", "10 años", "12 años"],
      ejemplo: "Ej. 14 años", conCm: false
    },
    atributos: [
      {
        clave: "tipo", nombre: "Tipo de artículo", filtro: true,
        lista: "tipos", tituloLista: "Tipos de artículo",
        ayudaLista: "No solo ropa: juguetes, calzado, accesorios… Tus clientas podrán filtrar por tipo.",
        ejemplo: "Ej. Mochilas",
        iniciales: ["Ropa", "Calzado", "Juguetes", "Accesorios", "Artículos varios"]
      },
      {
        clave: "genero", nombre: "Para",
        opciones: [
          { id: "nina", nombre: "Niña" },
          { id: "nino", nombre: "Niño" },
          { id: "unisex", nombre: "Unisex" }
        ]
      },
      {
        clave: "edad", nombre: "Edad recomendada",
        opciones: [
          { id: "0a12m", nombre: "0–12 meses" },
          { id: "1a3", nombre: "1–3 años" },
          { id: "3a5", nombre: "3–5 años" },
          { id: "6a8", nombre: "6–8 años" },
          { id: "9a12", nombre: "9–12 años" },
          { id: "12mas", nombre: "12 años o más" }
        ]
      }
    ]
  },

  hogar: {
    variante: {
      clave: "disenos", singular: "diseño", plural: "diseños", femenino: false,
      titulo: "Colores / diseños",
      ayuda: "Cada color o diseño es una presentación con sus propios tamaños y precios. Usa «Único» si viene en una sola versión.",
      ejemplo: "Ej. Floral",
      iniciales: ["Único", "Blanco", "Negro", "Gris", "Beige", "Estampado"]
    },
    tallas: {
      singular: "tamaño", plural: "tamaños", femenino: false,
      iniciales: ["Único", "Pequeño", "Mediano", "Grande"],
      ejemplo: "Ej. King", conCm: false
    },
    atributos: [
      {
        clave: "tipo", nombre: "Tipo de artículo", filtro: true,
        lista: "tipos", tituloLista: "Tipos de artículo",
        ayudaLista: "Tus clientas podrán filtrar el catálogo por tipo.",
        ejemplo: "Ej. Jardín",
        iniciales: ["Cocina", "Baño", "Dormitorio", "Sala", "Decoración", "Organización"]
      },
      { clave: "medidas", nombre: "Medidas", texto: true, ejemplo: "Ej. 40 × 60 cm", maxLargo: 60 }
    ]
  }
};

export const especDe = (categoriaId) => ESPECIFICACIONES[categoriaId] || null;

const mayus = (t) => t[0].toUpperCase() + t.slice(1);

/** Textos con el género correcto: "una tela" / "un color", "agotada" / "agotado", "las tallas" / "los tamaños". */
export function textos(x) {
  const f = x.femenino;
  return {
    un: f ? "una" : "un",
    la: f ? "la" : "el",
    las: f ? "las" : "los",
    esta: f ? "Esta" : "Este",
    agotado: f ? "agotada" : "agotado",
    todas: f ? "todas" : "todos",
    singular: x.singular,
    plural: x.plural,
    Singular: mayus(x.singular),
    Plural: mayus(x.plural)
  };
}
