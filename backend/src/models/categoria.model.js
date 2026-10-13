// src/models/categoria.model.js
const db = require("../../db/connection");

function listar({ soloActivas = false } = {}) {
  const condicion = soloActivas ? "WHERE activo = 1" : "";
  return db
    .prepare(`SELECT * FROM categorias_servicio ${condicion} ORDER BY orden ASC, nombre ASC`)
    .all();
}

function obtener(id_categoria) {
  return db.prepare(`SELECT * FROM categorias_servicio WHERE id_categoria = ?`).get(id_categoria);
}

function buscarPorNombre(nombre) {
  return db
    .prepare(`SELECT * FROM categorias_servicio WHERE nombre = ? COLLATE NOCASE`)
    .get(nombre);
}

function crear({ nombre, descripcion, abono, indicaciones, adicionales }) {
  const info = db
    .prepare(
      `INSERT INTO categorias_servicio (nombre, descripcion, abono, indicaciones, adicionales) VALUES (?, ?, ?, ?, ?)`
    )
    .run(nombre, descripcion || null, abono ?? null, indicaciones || null, adicionales || null);
  return obtener(info.lastInsertRowid);
}

function actualizar(id_categoria, { nombre, descripcion, abono, indicaciones, adicionales, orden }) {
  db.prepare(
    `UPDATE categorias_servicio
     SET nombre = COALESCE(@nombre, nombre),
         descripcion = COALESCE(@descripcion, descripcion)
     WHERE id_categoria = @id_categoria`
  ).run({ id_categoria, nombre, descripcion });
  // abono: numero = abono propio; null = vuelve al abono general; undefined = sin cambio
  if (abono !== undefined) {
    db.prepare(`UPDATE categorias_servicio SET abono = ? WHERE id_categoria = ?`).run(abono, id_categoria);
  }
  if (orden !== undefined && orden !== null && orden !== "") {
    db.prepare(`UPDATE categorias_servicio SET orden = ? WHERE id_categoria = ?`).run(Number(orden) || 0, id_categoria);
  }
  // Textos de reglas y adicionales: "" los borra, undefined no los toca
  for (const [campo, valor] of [["indicaciones", indicaciones], ["adicionales", adicionales]]) {
    if (valor !== undefined) {
      db.prepare(`UPDATE categorias_servicio SET ${campo} = ? WHERE id_categoria = ?`).run(valor || null, id_categoria);
    }
  }
  return obtener(id_categoria);
}

function cambiarEstadoActivo(id_categoria, activo) {
  db.prepare(`UPDATE categorias_servicio SET activo = ? WHERE id_categoria = ?`).run(
    activo ? 1 : 0,
    id_categoria
  );
  return obtener(id_categoria);
}

// Solo cuenta servicios ACTIVOS: si todos estan deshabilitados, la categoria
// ya se puede deshabilitar.
function contarServiciosEnCategoria(id_categoria) {
  return db
    .prepare(`SELECT COUNT(*) AS total FROM servicios WHERE id_categoria = ? AND activo = 1`)
    .get(id_categoria).total;
}

module.exports = {
  listar,
  obtener,
  buscarPorNombre,
  crear,
  actualizar,
  cambiarEstadoActivo,
  contarServiciosEnCategoria,
};
