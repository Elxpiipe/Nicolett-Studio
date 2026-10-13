// db/seed-servicios.js
//
// Catalogo REAL de Nicolett Studio Fantasy, tomado de sus listas de precios
// (publicaciones de Instagram compartidas por la clienta, septiembre 2026).
//
// - Crea o ACTUALIZA categorias y servicios (no duplica: busca por nombre).
// - Precios, descripciones, reglas ("indicaciones") y adicionales: de las imagenes.
// - DURACIONES: estimadas (las imagenes no las indican). Solo se fijan al crear
//   un servicio, asi que si ya las corregiste en el panel, no se pisan.
// - Deshabilita (no borra) los servicios de ejemplo que no aparecen en las listas.
//
// Uso: npm run seed:servicios   (o: node db/seed-servicios.js)

require("dotenv").config();
const db = require("./connection");
const servicioModel = require("../src/models/servicio.model");

const LARGOS = [
  ["S", "Hasta hombros"],
  ["M", "Hasta axila"],
  ["L", "Hasta codo"],
  ["XL", "Bajo codo"],
];
const porLargo = (precios) => LARGOS.map(([nombre, detalle], i) => ({ nombre, detalle, precio: precios[i] }));
const CERA = "Cera de abeja hipoalergénica.";

// [nombre, descripcion, duracion_estimada_min, precio, tipo_precio?, variantes?, nombres_anteriores?]
const CATALOGO = [
  {
    nombre: "Manicura",
    antes: ["Manicure"],
    descripcion: "Más que uñas, es un momento para ti",
    adicionales: "Francesa o degradé | + $5.000 | + 2 diseños simples\nDiseños aparte | $1.000 el par",
    indicaciones:
      "Kapping en tamaños M, L, XL y más tienen valor adicional.\nExtensión de uñas en tamaños L, XL y más tienen valor adicional.",
    servicios: [
      ["Permanente", "Un solo tono + 2 diseños simples.", 60, 15000],
      ["Ruber", "Un solo tono + 2 diseños simples.", 75, 20000],
      ["Kapping Poly Gel", "Uña corta. Un solo tono + 2 diseños simples.", 90, 20000],
      ["Soft Gel", "Un solo tono + 2 diseños simples.", 90, 25000],
      ["Extensión Poly Gel", "Un solo tono + 2 diseños simples.", 120, 28000],
    ],
  },
  {
    nombre: "Pedicure",
    descripcion: "Cuida tus pasos",
    adicionales: "Francesa o degradé | + $5.000\nDiseños extras | $1.000 el par",
    servicios: [
      ["Limpieza de pies", "Corte de uñas, limpieza de talones e hidratación de pies.", 45, 15000],
      ["Limpieza de pies + spa", "Corte de uñas, exfoliación, limpieza de talones e hidratación de pies.", 60, 20000],
      ["Pedicure con esmaltado", "Corte de uñas, limpieza de talones, hidratación y esmaltado permanente en un solo tono + 2 diseños básicos.", 75, 25000],
      ["Pedicure spa premium", "Corte de uñas, limpieza de talones, eliminación de durezas, exfoliación, hidratación, masaje de relajación y esmaltado permanente + 2 diseños básicos.", 90, 35000],
    ],
  },
  {
    nombre: "Podología clínica",
    descripcion: "Salud, bienestar y confianza para tus pies",
    indicaciones:
      "Atención realizada por podóloga clínica certificada por el MINSAL.\nLos valores son precios base: el valor final se informa antes de la atención, según el estado del pie, cantidad de uñas comprometidas, grado de afección y complejidad.\nCada atención se evalúa de manera individual antes de iniciar el procedimiento.",
    servicios: [
      ["Podología clínica básica", "Limpieza, corte y cuidado de uñas, retiro de durezas y evaluación del estado del pie.", 45, 20000, "DESDE"],
      ["Podología + tratamiento para hongos", "Limpieza podológica y aplicación de tratamiento específico para hongos. Varía según uñas afectadas y grado de afección.", 60, 23000, "DESDE"],
      ["Tratamiento de uña encarnada", "Incluye procedimiento y control inicial. Caso sencillo $25.000 · complejidad media $28.000 · caso complejo $30.000.", 60, 25000, "DESDE"],
    ],
  },
  {
    nombre: "Pestañas",
    descripcion: "Miradas que inspiran",
    indicaciones:
      "Ven con tus pestañas limpias: sin maquillaje ni residuos de productos 24 horas antes de tu atención.\nSin máscara de pestañas, sin delineador y sin cremas, aceites ni tratamientos en la zona de los ojos.\nSi quedan residuos y debemos hacer limpieza adicional, puede haber mala adherencia y caídas precoces.",
    servicios: [
      ["Lifting coreano", "Realza tu mirada de forma natural: levanta y define tus pestañas.", 60, 25000],
      ["Extensiones rímel o clásica", "Un efecto natural y elegante para tu día a día.", 120, 25000],
      ["Extensiones tecnológicas", "Más volumen, más definición, más duración.", 120, 30000],
      ["Volumen tecnológico", "Una mirada impactante y personalizada.", 150, 35000, "DESDE"],
    ],
  },
  {
    nombre: "Cejas",
    servicios: [["Laminado de cejas", "Define, ordena y da forma a tus cejas.", 45, 20000]],
  },
  {
    nombre: "Depilación",
    descripcion: "Cera de abeja hipoalergénica: suave con tu piel",
    servicios: [
      ["Pierna completa", CERA, 45, 15000],
      ["Media pierna", CERA, 25, 7000],
      ["Brazo completo", CERA, 30, 13000],
      ["Medio brazo", CERA, 20, 6000],
      ["Axila", CERA, 15, 5000],
      ["Rebaje completo", CERA, 40, 15000],
      ["Medio rebaje", CERA, 25, 10000],
      ["Rostro completo", CERA, 30, 10000],
      ["Bozo", CERA, 10, 5000],
      ["Cejas", CERA, 15, 5000, "FIJO", null, ["Cejas con cera"]],
      ["Nariz", CERA, 10, 5000],
      ["Oídos", CERA, 10, 5000],
      ["Mentón", CERA, 10, 3000],
    ],
  },
  {
    nombre: "Depilación masculina",
    descripcion: "Cera caliente de miel de abeja. Cuidado también para ellos",
    servicios: [
      ["Cejas", "Definición y limpieza.", 15, 5000],
      ["Nariz", "Eliminación de vello.", 10, 5000],
      ["Orejas", "Eliminación de vello.", 10, 5000],
      ["Hombros", "Depilación de hombros.", 20, 7000],
      ["Axilas", "Piel limpia y fresca.", 15, 8000],
      ["Pecho", "Depilación de pecho.", 30, 10000],
      ["Abdomen", "Depilación de abdomen.", 30, 10000],
      ["Media pierna", "Desde rodilla a tobillo.", 30, 10000],
      ["Brazos completos", "Depilación completa de brazos.", 40, 15000],
      ["Pecho + abdomen", "Zona superior del torso.", 50, 18000],
      ["Espalda completa", "Depilación de espalda.", 45, 18000],
      ["Piernas completas", "Desde muslo a tobillo.", 60, 22000],
    ],
  },
  {
    nombre: "Corte y peinado",
    antes: ["Peluquería"],
    descripcion: "Tu estilo, nuestra pasión",
    abono: 10000,
    adicionales: "Tratamiento capilar adicional | + $9.990 | Hidratación o nutrición + masaje capilar. Se puede agregar a cualquier corte",
    indicaciones:
      "Los valores base consideran cabellos hasta largo L (aprox. hasta el codo).\nEn cabellos XL, extra largos o de alta densidad puede aplicarse un adicional según largo, cantidad de cabello y tiempo de trabajo. El valor final se informa antes de la atención.",
    servicios: [
      ["Corte de cabello", "Corte personalizado según tu estilo y necesidades.", 45, 19990],
      ["Corte avanzado", "Corte personalizado con mayor detalle y definición. Incluye lavado y brushing.", 60, 24990],
      ["Brushing / ondas / liso", "Lavado de cabello + peinado.", 45, 19990],
      ["Peinado para ocasión especial", "Lavado + peinado elaborado, adaptado a la ocasión y estilo deseado.", 75, 24990, "DESDE"],
    ],
  },
  {
    nombre: "Color e iluminación",
    descripcion: "Color que ilumina tu esencia",
    abono: 10000,
    indicaciones:
      "Ven con el cabello lavado solo con shampoo y acondicionador: sin aceites capilares, máscaras, tratamientos, cremas de peinar, sérums ni productos de finalización.\nLos valores desde $89.990 corresponden a cabellos hasta el hombro (talla S). En tallas M, L, XL o de alta densidad puede aplicarse un adicional según largo, técnica y producto.\nCada trabajo es un diagnóstico y cotización según evaluación del cabello; algunos casos requieren corrección de fondo u otros procesos con valor adicional.",
    servicios: [
      ["Babylights", "Iluminación delicada y multidimensional con mechas muy finas, para un resultado natural, luminoso y elegante.", 240, 89990, "DESDE"],
      ["Balayage", "Técnica de iluminación en degradé que aporta luz natural y personalizada, con un efecto suave y sofisticado.", 240, 89990, "DESDE"],
      ["Mechas", "Iluminación personalizada por secciones de cabello: contraste, luz y dimensión según el resultado que desees.", 210, 89990, "DESDE"],
      ["Face framing (contorno)", "Iluminación focalizada en el contorno del rostro para aportar luz, definición y frescura. No incluye la parte posterior.", 150, 89990, "DESDE"],
      ["Decoloración global", "Aclaración integral del cabello para lograr un tono uniforme. Valor según evaluación profesional.", 240, 0, "EVALUACION"],
      ["Corrección de color", "Evaluación y diseño personalizado para corregir o transformar el color según el estado actual del cabello.", 240, 0, "EVALUACION"],
    ],
  },
  {
    nombre: "Tratamientos capilares",
    descripcion: "Ciencia, cuidado y belleza en un solo lugar",
    abono: 10000,
    adicionales: "Terminaciones especiales | desde + $5.000 | Planchado, ondas o rulos, según largo y complejidad",
    indicaciones:
      "Todos incluyen diagnóstico, aplicación del tratamiento, masaje capilar, lavado, secado y brushing, más activación fotónica Photon Lizze Supreme.\nValores para cabello de largo y cantidad estándar; cabellos XXL o de abundancia extraordinaria: según evaluación.",
    servicios: [
      ["Hidratación profunda", "Devuelve suavidad, brillo y vitalidad.", 75, 25000, "FIJO", porLargo([25000, 30000, 35000, 40000])],
      ["Reconstrucción capilar", "Repara y fortalece la fibra capilar.", 75, 25000, "FIJO", porLargo([25000, 30000, 35000, 40000])],
      ["Nutrición con ampolla capilar", "Aporta nutrientes y mejora la elasticidad.", 75, 30000, "FIJO", porLargo([30000, 35000, 40000, 45000])],
      ["Nanobotox", "Controla el frizz, aporta brillo, disciplina y regenera la fibra capilar.", 90, 35000, "FIJO", porLargo([35000, 40000, 45000, 55000])],
      ["Tratamiento personalizado", "Evaluación previa para determinar el tratamiento ideal para tu cabello.", 90, 0, "EVALUACION"],
    ],
  },
  {
    nombre: "Alisado",
    descripcion: "Bioplástica Richée Professional: liso natural, brillo real",
    abono: 10000,
    indicaciones:
      "Tratamiento sin formol, termoactivado y progresivo. Incluye diagnóstico, lavado, secado y brushing y activación fotónica.\nNo realizamos este servicio durante embarazo o lactancia, ni en menores de 12 años. En adolescentes requiere evaluación previa y autorización de su representante.\nPersonas con dermatitis, lesiones o sensibilidad del cuero cabelludo deben contar con autorización médica previa.\nEl valor final se determina según largo, cantidad, densidad y estado del cabello (XXL: según evaluación).",
    servicios: [
      ["Alisado bioplástica", "Reduce el volumen y el frizz, dejando el cabello visiblemente más sano, suave y brillante.", 180, 50000, "DESDE", porLargo([50000, 65000, 80000, 95000])],
    ],
  },
];

// Servicios de ejemplo que no aparecen en las listas reales de la clienta
const EJEMPLOS = ["Esmaltado permanente", "Extensión pelo a pelo", "Perfilado y laminado de cejas", "Corte y peinado", "Limpieza facial profunda"];
// Categorias de la plantilla original que el salon no ofrece hoy
const CATEGORIAS_NO_OFRECIDAS = ["Facial", "Masajes"];

const buscarCategoria = (nombre) => db.prepare(`SELECT * FROM categorias_servicio WHERE nombre = ? COLLATE NOCASE`).get(nombre);

let creados = 0;
let actualizados = 0;

const ejecutar = db.transaction(() => {
  // Servicios de ejemplo primero (uno se llama igual que la categoria "Corte y peinado")
  for (const nombre of EJEMPLOS) {
    const info = db.prepare(`UPDATE servicios SET activo = 0 WHERE nombre = ? AND activo = 1`).run(nombre);
    if (info.changes) console.log(`Deshabilitado servicio de ejemplo: ${nombre}`);
  }

  for (const [posicion, cat] of CATALOGO.entries()) {
    let categoria = buscarCategoria(cat.nombre) || (cat.antes || []).map(buscarCategoria).find(Boolean);
    if (!categoria) {
      const info = db.prepare(`INSERT INTO categorias_servicio (nombre) VALUES (?)`).run(cat.nombre);
      categoria = { id_categoria: info.lastInsertRowid };
      console.log(`Categoría creada: ${cat.nombre}`);
    }
    db.prepare(
      `UPDATE categorias_servicio SET nombre = ?, descripcion = ?, indicaciones = ?, adicionales = ?, activo = 1,
         abono = COALESCE(?, abono), orden = ? WHERE id_categoria = ?`
    ).run(cat.nombre, cat.descripcion || null, cat.indicaciones || null, cat.adicionales || null, cat.abono ?? null, posicion + 1, categoria.id_categoria);

    cat.servicios.forEach(([nombre, descripcion, duracion, precio, tipo = "FIJO", variantes = null, antes = []], orden) => {
      const existente = [nombre, ...antes]
        .map((n) => db.prepare(`SELECT * FROM servicios WHERE id_categoria = ? AND nombre = ? COLLATE NOCASE`).get(categoria.id_categoria, n))
        .find(Boolean);
      let id;
      if (existente) {
        db.prepare(
          `UPDATE servicios SET nombre = ?, descripcion = ?, precio = ?, tipo_precio = ?, orden = ?, activo = 1 WHERE id_servicio = ?`
        ).run(nombre, descripcion, precio, tipo, orden, existente.id_servicio);
        id = existente.id_servicio;
        actualizados++;
      } else {
        id = db
          .prepare(
            `INSERT INTO servicios (id_categoria, nombre, descripcion, duracion_minutos, precio, tipo_precio, orden)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(categoria.id_categoria, nombre, descripcion, duracion, precio, tipo, orden).lastInsertRowid;
        creados++;
      }
      if (variantes) servicioModel.guardarVariantes(id, variantes);
    });
  }

  for (const nombre of CATEGORIAS_NO_OFRECIDAS) {
    const cat = buscarCategoria(nombre);
    if (!cat) continue;
    db.prepare(`UPDATE servicios SET activo = 0 WHERE id_categoria = ?`).run(cat.id_categoria);
    db.prepare(`UPDATE categorias_servicio SET activo = 0 WHERE id_categoria = ?`).run(cat.id_categoria);
    console.log(`Categoría no ofrecida, deshabilitada: ${nombre}`);
  }
});

ejecutar();
console.log(`\nListo: ${creados} servicio(s) creados y ${actualizados} actualizados.`);
console.log("Revisa las DURACIONES (estimadas) y asigna los servicios nuevos a cada profesional en Panel -> Equipo y horarios.");
