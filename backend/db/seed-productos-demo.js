// db/seed-productos-demo.js
// SOLO PARA DEMOS: productos de ejemplo para la tienda. Precios y stock son de
// EJEMPLO: reemplazarlos en /tienda (modo Administrador) con los reales.
// Uso: node db/seed-productos-demo.js
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("./connection");
const productoModel = require("../src/models/producto.model");

const PRODUCTOS = [
  {
    nombre: "Shampoo matizador Violet Crush 400 ml",
    marca: "PZZO",
    linea: "Matizadores",
    descripcion: "Neutraliza los tonos amarillos en cabellos rubios, decolorados o con canas. Con biotina.",
    precio: 12990,
    stock: 6,
    foto: "violet-crush.jpg",
  },
  { nombre: "Acondicionador matizador 400 ml", marca: "PZZO", linea: "Matizadores", descripcion: "Complemento del shampoo matizador: suaviza y mantiene el tono frío.", precio: 12990, stock: 4 },
  { nombre: "Mascarilla hidratación profunda 300 ml", linea: "Tratamientos", descripcion: "Nutre el cabello seco o dañado por químicos. Uso semanal.", precio: 15990, stock: 3 },
  { nombre: "Sérum reparador de puntas 60 ml", linea: "Tratamientos", descripcion: "Sella las puntas y aporta brillo sin engrasar.", precio: 9990, stock: 8 },
  { nombre: "Protector térmico en spray 200 ml", linea: "Cuidado diario", descripcion: "Protege el cabello del calor de secador y plancha.", precio: 8990, stock: 1 },
];

let creados = 0;
const idAdmin = db.prepare(`SELECT id_usuario FROM usuarios WHERE id_rol = 1 ORDER BY id_usuario LIMIT 1`).get()?.id_usuario;
if (!idAdmin) {
  console.error("Primero crea un Administrador (npm run crear-admin o npm run demo).");
  process.exit(1);
}

for (const p of PRODUCTOS) {
  if (productoModel.buscarPorNombre(p.nombre)) {
    console.log(`Ya existe "${p.nombre}", se omite.`);
    continue;
  }
  const id = productoModel.crear({ ...p, descripcion: `${p.descripcion} (Producto y precio de ejemplo)` });
  productoModel.fijarStock(id, p.stock, idAdmin, "Stock inicial (demo)");
  if (p.foto) {
    const destino = path.join(__dirname, "..", "uploads", "productos");
    fs.mkdirSync(destino, { recursive: true });
    const archivo = `producto-${id}-demo.jpg`;
    fs.copyFileSync(path.join(__dirname, "demo", p.foto), path.join(destino, archivo));
    productoModel.actualizarImagen(id, `/uploads/productos/${archivo}`);
  }
  creados++;
  console.log(`Creado: ${p.nombre} — $${p.precio} (stock ${p.stock})`);
}
console.log(`\nListo: ${creados} producto(s) de ejemplo. Edita precios, fotos y stock en /tienda.`);
