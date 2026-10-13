// db/seed-promociones-demo.js
// SOLO PARA DEMOS: 3 promociones para el carrusel del Inicio, usando las
// publicaciones de la clienta. Reemplazarlas en Panel -> Promociones.
// Uso: npm run seed:promociones
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("./connection");
const modelo = require("../src/models/promocion.model");

const PROMOS = [
  { titulo: "Manicura", descripcion: "Permanente, ruber, kapping, soft gel y extensiones.", enlace: "/reservar", foto: "promo-manicura.jpg" },
  { titulo: "Pedicure", descripcion: "Desde limpieza de pies hasta pedicure spa premium.", enlace: "/servicios", foto: "promo-pedicure.jpg" },
  { titulo: "Depilación masculina", descripcion: "Cera caliente de miel de abeja. Cuidado también para ellos.", enlace: "/servicios", foto: "promo-depilacion-masculina.jpg" },
];

const destino = path.join(__dirname, "..", "uploads", "promociones");
fs.mkdirSync(destino, { recursive: true });

PROMOS.forEach((p, orden) => {
  if (db.prepare(`SELECT 1 FROM promociones WHERE titulo = ?`).get(p.titulo)) {
    console.log(`Ya existe la promoción "${p.titulo}", se omite.`);
    return;
  }
  const promo = modelo.crear({ titulo: p.titulo, descripcion: p.descripcion, enlace: p.enlace, orden });
  const archivo = `promo-${promo.id_promocion}-demo.jpg`;
  fs.copyFileSync(path.join(__dirname, "demo", p.foto), path.join(destino, archivo));
  modelo.actualizarImagen(promo.id_promocion, `/uploads/promociones/${archivo}`);
  console.log(`Promoción creada: ${p.titulo}`);
});
