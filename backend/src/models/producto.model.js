// src/models/producto.model.js
// Productos de la tienda (matizadores, shampoo, tratamientos, etc.)
const db = require("../../db/connection");

const CAMPOS = `
  id_producto, codigo, nombre, descripcion, marca, linea, imagen_url,
  precio_venta AS precio, CAST(trunc(stock_actual) AS INTEGER) AS stock, activo
`;

async function listar({ soloActivos = false } = {}) {
  const condicion = soloActivos ? "WHERE activo = 1 AND precio_venta IS NOT NULL" : "";
  return db
    .prepare(`SELECT ${CAMPOS} FROM productos ${condicion} ORDER BY activo DESC, linea NULLS FIRST, nombre, id_producto`)
    .all();
}

async function obtener(id_producto) {
  return db.prepare(`SELECT ${CAMPOS} FROM productos WHERE id_producto = ?`).get(id_producto);
}

async function crear({ nombre, descripcion, marca, linea, precio, stock, codigo }) {
  const info = await db
    .prepare(
      `INSERT INTO productos (codigo, nombre, descripcion, marca, linea, precio_venta, stock_actual)
       VALUES (?, ?, ?, ?, ?, ?, 0)
       RETURNING id_producto`
    )
    .run(codigo || null, nombre, descripcion || null, marca || null, linea || null, precio);
  return info.lastInsertRowid;
}

const EDITABLES = { nombre: "nombre", descripcion: "descripcion", marca: "marca", linea: "linea", precio: "precio_venta", codigo: "codigo" };

async function actualizar(id_producto, cambios) {
  const campos = Object.keys(EDITABLES).filter((c) => cambios[c] !== undefined);
  if (!campos.length) return;
  const sql = campos.map((c) => `${EDITABLES[c]} = @${c}`).join(", ");
  const valores = { id_producto };
  for (const c of campos) valores[c] = cambios[c] === "" ? null : cambios[c];
  await db.prepare(`UPDATE productos SET ${sql} WHERE id_producto = @id_producto`).run(valores);
}

/**
 * Deja el stock en `nuevoStock` y registra la diferencia como movimiento de
 * inventario (entrada o ajuste), para tener trazabilidad de quien lo cambio.
 */
const fijarStock = db.transaction(async (id_producto, nuevoStock, id_usuario, motivo) => {
  const actual = (await obtener(id_producto)).stock;
  const diferencia = nuevoStock - actual;
  if (diferencia === 0) return;
  await db.prepare(`UPDATE productos SET stock_actual = ? WHERE id_producto = ?`).run(nuevoStock, id_producto);
  await db.prepare(
    `INSERT INTO movimientos_inventario (id_producto, tipo, cantidad, motivo, id_usuario)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    id_producto,
    diferencia > 0 ? "ENTRADA_COMPRA" : "AJUSTE",
    Math.abs(diferencia),
    motivo || (diferencia > 0 ? "Ingreso de stock desde el panel" : "Ajuste de stock desde el panel"),
    id_usuario
  );
});

async function cambiarEstado(id_producto, activo) {
  await db.prepare(`UPDATE productos SET activo = ? WHERE id_producto = ?`).run(activo ? 1 : 0, id_producto);
}

async function actualizarImagen(id_producto, imagen_url) {
  await db.prepare(`UPDATE productos SET imagen_url = ? WHERE id_producto = ?`).run(imagen_url, id_producto);
}

async function buscarPorNombre(nombre) {
  return db.prepare(`SELECT id_producto FROM productos WHERE lower(nombre) = lower(?)`).get(nombre);
}

module.exports = { listar, obtener, crear, actualizar, fijarStock, cambiarEstado, actualizarImagen, buscarPorNombre };
