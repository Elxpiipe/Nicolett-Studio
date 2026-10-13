// db/seed-productos-nicolett.js
// Carga los productos REALES de la tienda de Nicolett Studio Fantasy.
// - Se puede ejecutar varias veces: si un producto ya existe (mismo nombre), se omite.
// - Los productos con precio "Por definir" quedan con precio vacío: se ven en el panel
//   (Tienda en modo Administrador) pero NO en la tienda pública hasta ponerles precio.
// - El stock parte en STOCK_INICIAL (0 = "Agotado"): ajústalo en la tienda (modo
//   Administrador) o cambia el número aquí antes de ejecutar.
// - Desactiva los 5 productos de ejemplo de seed-productos-demo.js (no los borra, por
//   si ya tienen ventas de prueba asociadas).
// Uso: node db/seed-productos-nicolett.js   (o npm run seed:productos)
require("dotenv").config();
const db = require("./connection");
const productoModel = require("../src/models/producto.model");

const STOCK_INICIAL = 0;

// precio: número en pesos, o null si está "Por definir"
const PRODUCTOS = [
  // --- Pestañas y Cejas (Lash & Brow) ---
  { linea: "Pestañas y Cejas", marca: "Puluk", nombre: "Kit Laminado de Cejas Pro Lifting Perfect 10", precio: 27000,
    descripcion: "Kit profesional para el tratamiento de laminación de cejas." },
  { linea: "Pestañas y Cejas", marca: "Dlux", nombre: "Ultra Bonder - Sellador 20 ml", precio: 12500,
    descripcion: "Sellador profesional para extensiones de pestañas." },
  { linea: "Pestañas y Cejas", marca: "Dlux", nombre: "Gold Booster Serum", precio: 23000,
    descripcion: "Serum estimulador (booster) para fortalecer y cuidar las pestañas." },
  { linea: "Pestañas y Cejas", marca: "Dlux", nombre: "Lash Botox - Keratin Vitamin", precio: 23000,
    descripcion: "Crema intensiva enriquecida con keratina y vitaminas para nutrir las pestañas." },
  { linea: "Pestañas y Cejas", marca: "Dlux", nombre: "Glue Less Lift", precio: 12000,
    descripcion: "Polvo especializado para realizar lifting de pestañas sin necesidad de pegamento." },
  { linea: "Pestañas y Cejas", marca: "Puluk", nombre: "Kit Lash Lifting Pro Wave", precio: 27000,
    descripcion: "Kit completo para lifting de pestañas: incluye lociones, gel fijador y set de bigudíes." },
  { linea: "Pestañas y Cejas", marca: "Puluk", nombre: "Toxtox Lash Treatment (Tratamiento Serum)", precio: 10000,
    descripcion: "Tratamiento en formato máscara para mantener la salud de pestañas y cejas." },

  // --- Tratamientos capilares y ampollas (Inoar) ---
  { linea: "Tratamientos Capilares", marca: "Inoar", nombre: "Ampolla Cicatrifios Reconstrucción 45 ml", precio: 7990,
    descripcion: "Súper ampolla de plástica capilar instantánea para una renovación absoluta del cabello." },
  { linea: "Tratamientos Capilares", marca: "Inoar", nombre: "Ampolla Fuerza y Brillo (Força & Brilho) 45 ml", precio: 6590,
    descripcion: "Súper ampolla acondicionadora para cabellos sedosos, fuertes y con brillo intenso." },
  { linea: "Tratamientos Capilares", marca: "Inoar", nombre: "Ampolla Resistance Flor de Lótus 45 ml (caja display)", precio: 63900,
    descripcion: "Ampolla para reparación intensa, restauración y suavidad. Precio por caja display completa." },
  { linea: "Tratamientos Capilares", marca: "Inoar", nombre: "Glycolic Force Súper Ampolla 45 ml", precio: null,
    descripcion: "Ampolla enfocada en brindar súper brillo e hidratación profunda." },
  { linea: "Tratamientos Capilares", marca: "Inoar", nombre: "Ampolla Daymoist Fast Repair 8 ml", precio: null,
    descripcion: "Tratamiento intensivo que penetra la fibra capilar en solo 3 minutos aportando nutrientes." },
  { linea: "Tratamientos Capilares", marca: "Inoar", nombre: "Aceite Argan Oil System", precio: 4880,
    descripcion: "Aceite capilar de argán puro." },
  { linea: "Tratamientos Capilares", marca: "Inoar", nombre: "Liso Mágico Antifrizz", precio: 14290,
    descripcion: "Tratamiento progresivo termoactivo antifrizz." },
  { linea: "Tratamientos Capilares", marca: "Inoar", nombre: "Set Résistance Fibra de Bambú", precio: 41900,
    descripcion: "Set hidratante con biotina y fibra de bambú para reparar y fortalecer el cabello maltratado." },
  { linea: "Tratamientos Capilares", marca: "Inoar", nombre: "Línea Cacau Forte (Shampoo y Acondicionador)", precio: null,
    descripcion: "Shampoo y acondicionador con biotina y manteca de cacao para fuerza, crecimiento y menos quiebre." },
  { linea: "Tratamientos Capilares", marca: "Inoar", nombre: "Ampolla Resistance Bambú 45 ml", precio: null,
    descripcion: "Súper ampolla con fibra de bambú y biotina para fortalecimiento, crecimiento y reparación intensa." },

  // --- Capilar profesional (Richée Professional) ---
  { linea: "Capilar Profesional", marca: "Richée Professional", nombre: "Kit Cacau Power Nutri 1 L (Shampoo + Acondicionador)", precio: 60000,
    descripcion: "Nutre y recupera cabellos secos expuestos a químicos. Con agua de coco y colágeno vegetal." },
  { linea: "Capilar Profesional", marca: "Richée Professional", nombre: "Kit Clinic Repair System 1 L", precio: 50000,
    descripcion: "Hidratación profunda para cabellos apagados y quebradizos, con nanoesferas de cereales y multivitaminas." },
  { linea: "Capilar Profesional", marca: "Richée Professional", nombre: "Alisado Bioplástica Capilar", precio: 89990,
    descripcion: "Sistema multi-control de alisado (shampoo antiresiduos y texturizador de 1 L) con Omega Plus." },
  { linea: "Capilar Profesional", marca: "Richée Professional", nombre: "Nanobtx Repair 500 g", precio: 32251,
    descripcion: "Repositor de masa capilar en crema, con aceite de macadamia y ácido hialurónico." },
];

const idAdmin = db.prepare(`SELECT id_usuario FROM usuarios WHERE id_rol = 1 ORDER BY id_usuario LIMIT 1`).get()?.id_usuario;

const cargar = db.transaction(() => {
  let creados = 0;
  let sinPrecio = 0;
  for (const p of PRODUCTOS) {
    if (productoModel.buscarPorNombre(p.nombre)) {
      console.log(`Ya existe "${p.nombre}", se omite.`);
      continue;
    }
    const id = productoModel.crear(p);
    if (STOCK_INICIAL > 0 && idAdmin) productoModel.fijarStock(id, STOCK_INICIAL, idAdmin, "Stock inicial");
    creados++;
    if (p.precio == null) sinPrecio++;
    console.log(`Creado: [${p.linea}] ${p.marca} · ${p.nombre} — ${p.precio == null ? "precio por definir" : "$" + p.precio}`);
  }

  // Ocultar los productos de ejemplo
  const demo = db
    .prepare(`UPDATE productos SET activo = 0 WHERE activo = 1 AND descripcion LIKE '%(Producto y precio de ejemplo)%'`)
    .run().changes;

  return { creados, sinPrecio, demo };
});

const r = cargar();
console.log(`\nListo: ${r.creados} producto(s) nuevos.`);
if (r.sinPrecio) console.log(`${r.sinPrecio} quedaron sin precio y no se muestran en la tienda hasta que se les ponga uno.`);
if (r.demo) console.log(`Se ocultaron ${r.demo} producto(s) de ejemplo.`);
console.log("Siguiente paso: en /tienda (modo Administrador) agrega fotos y stock a cada producto.");
