// src/models/promocion.model.js — carrusel de promociones del Inicio
const db = require("../../db/connection");

/** Vigentes hoy: activas y dentro de sus fechas (si las tienen) */
function listarVigentes(hoy) {
  return db
    .prepare(
      `SELECT * FROM promociones
       WHERE activo = 1 AND imagen_url IS NOT NULL
         AND (fecha_inicio IS NULL OR fecha_inicio <= ?)
         AND (fecha_fin IS NULL OR fecha_fin >= ?)
       ORDER BY orden, id_promocion DESC`
    )
    .all(hoy, hoy);
}

function listarTodas() {
  return db.prepare(`SELECT * FROM promociones ORDER BY orden, id_promocion DESC`).all();
}

function obtener(id) {
  return db.prepare(`SELECT * FROM promociones WHERE id_promocion = ?`).get(id);
}

const CAMPOS = ["titulo", "descripcion", "enlace", "fecha_inicio", "fecha_fin", "orden", "activo"];

function normalizar(datos) {
  const salida = {};
  for (const c of CAMPOS) {
    if (datos[c] === undefined) continue;
    if (c === "activo") salida[c] = datos[c] ? 1 : 0;
    else if (c === "orden") salida[c] = Number(datos[c]) || 0;
    else salida[c] = datos[c] === "" ? null : datos[c];
  }
  return salida;
}

function crear(datos) {
  const d = { descripcion: null, enlace: null, fecha_inicio: null, fecha_fin: null, orden: 0, activo: 1, ...normalizar(datos) };
  const info = db
    .prepare(
      `INSERT INTO promociones (titulo, descripcion, enlace, fecha_inicio, fecha_fin, orden, activo)
       VALUES (@titulo, @descripcion, @enlace, @fecha_inicio, @fecha_fin, @orden, @activo)`
    )
    .run(d);
  return obtener(info.lastInsertRowid);
}

function actualizar(id, datos) {
  const d = normalizar(datos);
  const campos = Object.keys(d);
  if (campos.length) {
    db.prepare(`UPDATE promociones SET ${campos.map((c) => `${c} = @${c}`).join(", ")} WHERE id_promocion = @id`).run({ ...d, id });
  }
  return obtener(id);
}

function actualizarImagen(id, imagen_url) {
  db.prepare(`UPDATE promociones SET imagen_url = ? WHERE id_promocion = ?`).run(imagen_url, id);
  return obtener(id);
}

function eliminar(id) {
  db.prepare(`DELETE FROM promociones WHERE id_promocion = ?`).run(id);
}

module.exports = { listarVigentes, listarTodas, obtener, crear, actualizar, actualizarImagen, eliminar };
