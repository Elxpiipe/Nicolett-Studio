// src/models/promocion.model.js — carrusel de promociones del Inicio
const db = require("../../db/connection");

/** Vigentes hoy: activas y dentro de sus fechas (si las tienen) */
async function listarVigentes(hoy) {
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

async function listarTodas() {
  return db.prepare(`SELECT * FROM promociones ORDER BY orden, id_promocion DESC`).all();
}

async function obtener(id) {
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

async function crear(datos) {
  const d = { descripcion: null, enlace: null, fecha_inicio: null, fecha_fin: null, orden: 0, activo: 1, ...normalizar(datos) };
  const info = await db
    .prepare(
      `INSERT INTO promociones (titulo, descripcion, enlace, fecha_inicio, fecha_fin, orden, activo)
       VALUES (@titulo, @descripcion, @enlace, @fecha_inicio, @fecha_fin, @orden, @activo)
       RETURNING id_promocion`
    )
    .run(d);
  return obtener(info.lastInsertRowid);
}

async function actualizar(id, datos) {
  const d = normalizar(datos);
  const campos = Object.keys(d);
  if (campos.length) {
    await db.prepare(`UPDATE promociones SET ${campos.map((c) => `${c} = @${c}`).join(", ")} WHERE id_promocion = @id`).run({ ...d, id });
  }
  return obtener(id);
}

async function actualizarImagen(id, imagen_url) {
  await db.prepare(`UPDATE promociones SET imagen_url = ? WHERE id_promocion = ?`).run(imagen_url, id);
  return obtener(id);
}

async function eliminar(id) {
  await db.prepare(`DELETE FROM promociones WHERE id_promocion = ?`).run(id);
}

module.exports = { listarVigentes, listarTodas, obtener, crear, actualizar, actualizarImagen, eliminar };
