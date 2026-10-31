// src/models/servicio.model.js
const db = require("../../db/connection");

const CAMPOS_SERVICIO = `
  s.id_servicio, s.id_categoria, s.nombre, s.descripcion, s.duracion_minutos,
  s.precio, s.activo, s.imagen_url, s.tipo_precio, s.orden,
  c.nombre AS categoria, c.abono AS abono_categoria
`;

/** Variantes (S/M/L/XL...) de varios servicios, agrupadas por servicio */
async function variantesDe(ids, { soloActivas = true } = {}) {
  if (!ids.length) return new Map();
  const filas = await db
    .prepare(
      `SELECT id_variante, id_servicio, nombre, detalle, precio, orden, activo FROM servicio_variantes
       WHERE id_servicio IN (${ids.map(() => "?").join(",")}) ${soloActivas ? "AND activo = 1" : ""}
       ORDER BY orden, precio, id_variante`
    )
    .all(...ids);
  const mapa = new Map();
  for (const v of filas) {
    if (!mapa.has(v.id_servicio)) mapa.set(v.id_servicio, []);
    mapa.get(v.id_servicio).push(v);
  }
  return mapa;
}

/** Agrega variantes y el "precio desde" a cada servicio */
async function conVariantes(servicios) {
  const mapa = await variantesDe(servicios.map((s) => s.id_servicio));
  return servicios.map((s) => {
    const variantes = mapa.get(s.id_servicio) || [];
    return {
      ...s,
      variantes,
      // Precio a mostrar: si hay variantes, el menor ("Desde $25.000")
      precio_desde: variantes.length ? Math.min(...variantes.map((v) => v.precio)) : s.precio,
      // Los "segun evaluacion" se cotizan por WhatsApp, no se reservan online
      reserva_online: s.tipo_precio !== "EVALUACION",
    };
  });
}

async function listar({ id_categoria, soloActivos, busqueda } = {}) {
  const condiciones = [];
  const params = {};

  if (id_categoria) {
    condiciones.push("s.id_categoria = @id_categoria");
    params.id_categoria = id_categoria;
  }
  if (soloActivos) {
    condiciones.push("s.activo = 1");
  }
  if (busqueda) {
    condiciones.push("s.nombre ILIKE @busqueda"); // ILIKE: igual que LIKE de SQLite (sin mayusculas)
    params.busqueda = `%${busqueda}%`;
  }

  const whereClause = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";

  return db
    .prepare(
      `
      SELECT ${CAMPOS_SERVICIO}
      FROM servicios s
      JOIN categorias_servicio c ON c.id_categoria = s.id_categoria
      ${whereClause}
      ORDER BY c.orden ASC, c.nombre ASC, s.orden ASC, s.precio ASC, s.nombre ASC, s.id_servicio ASC
    `
    )
    .all(params);
}

async function obtenerBase(id_servicio) {
  return db
    .prepare(
      `
      SELECT ${CAMPOS_SERVICIO}
      FROM servicios s
      JOIN categorias_servicio c ON c.id_categoria = s.id_categoria
      WHERE s.id_servicio = ?
    `
    )
    .get(id_servicio);
}

async function obtener(id_servicio) {
  const s = await obtenerBase(id_servicio);
  return s ? (await conVariantes([s]))[0] : undefined;
}

async function obtenerVariante(id_variante) {
  return db.prepare(`SELECT * FROM servicio_variantes WHERE id_variante = ?`).get(id_variante);
}

/**
 * Reemplaza las variantes de un servicio. Las que ya existen se actualizan por
 * id (las citas antiguas las referencian); las que se quitan se desactivan.
 * lista = [{ id_variante?, nombre, detalle, precio }]
 */
const guardarVariantes = db.transaction(async (id_servicio, lista) => {
  const actuales = await db.prepare(`SELECT id_variante, nombre FROM servicio_variantes WHERE id_servicio = ? ORDER BY id_variante`).all(id_servicio);
  const conservar = new Set();
  for (const [i, v] of lista.entries()) {
    const existente =
      actuales.find((a) => a.id_variante === Number(v.id_variante)) ||
      actuales.find((a) => a.nombre.toLowerCase() === v.nombre.trim().toLowerCase());
    if (existente) {
      await db.prepare(
        `UPDATE servicio_variantes SET nombre = ?, detalle = ?, precio = ?, orden = ?, activo = 1 WHERE id_variante = ?`
      ).run(v.nombre.trim(), v.detalle || null, Number(v.precio), i, existente.id_variante);
      conservar.add(existente.id_variante);
    } else {
      const info = await db
        .prepare(`INSERT INTO servicio_variantes (id_servicio, nombre, detalle, precio, orden) VALUES (?, ?, ?, ?, ?) RETURNING id_variante`)
        .run(id_servicio, v.nombre.trim(), v.detalle || null, Number(v.precio), i);
      conservar.add(info.lastInsertRowid);
    }
  }
  for (const a of actuales) {
    if (!conservar.has(a.id_variante)) await db.prepare(`UPDATE servicio_variantes SET activo = 0 WHERE id_variante = ?`).run(a.id_variante);
  }
});

async function buscarPorNombreEnCategoria(id_categoria, nombre) {
  return db
    .prepare(
      `SELECT * FROM servicios WHERE id_categoria = ? AND lower(nombre) = lower(?)`
    )
    .get(id_categoria, nombre);
}

async function crear({ id_categoria, nombre, descripcion, duracion_minutos, precio, tipo_precio, orden }) {
  const info = await db
    .prepare(
      `INSERT INTO servicios (id_categoria, nombre, descripcion, duracion_minutos, precio, tipo_precio, orden)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING id_servicio`
    )
    .run(id_categoria, nombre, descripcion || null, duracion_minutos, precio, tipo_precio || "FIJO", orden || 0);
  return obtener(info.lastInsertRowid);
}

async function actualizar(id_servicio, { id_categoria, nombre, descripcion, duracion_minutos, precio, tipo_precio, orden }) {
  await db.prepare(
    `UPDATE servicios
     SET id_categoria = COALESCE(@id_categoria, id_categoria),
         nombre = COALESCE(@nombre, nombre),
         descripcion = COALESCE(@descripcion, descripcion),
         duracion_minutos = COALESCE(@duracion_minutos, duracion_minutos),
         precio = COALESCE(@precio, precio),
         tipo_precio = COALESCE(@tipo_precio, tipo_precio),
         orden = COALESCE(@orden, orden)
     WHERE id_servicio = @id_servicio`
  ).run({
    id_servicio,
    id_categoria: id_categoria ?? null,
    nombre: nombre ?? null,
    descripcion: descripcion ?? null,
    duracion_minutos: duracion_minutos ?? null,
    precio: precio ?? null,
    tipo_precio: tipo_precio ?? null,
    orden: orden ?? null,
  });
  return obtener(id_servicio);
}

async function cambiarEstadoActivo(id_servicio, activo) {
  await db.prepare(`UPDATE servicios SET activo = ? WHERE id_servicio = ?`).run(
    activo ? 1 : 0,
    id_servicio
  );
  return obtener(id_servicio);
}

async function actualizarImagen(id_servicio, imagen_url) {
  await db.prepare(`UPDATE servicios SET imagen_url = ? WHERE id_servicio = ?`).run(
    imagen_url,
    id_servicio
  );
  return obtener(id_servicio);
}

// listar devuelve cada servicio con sus variantes
const listarBase = listar;
async function listarConVariantes(filtros) {
  return conVariantes(await listarBase(filtros));
}

module.exports = {
  actualizarImagen,
  listar: listarConVariantes,
  obtenerVariante,
  guardarVariantes,
  obtener,
  buscarPorNombreEnCategoria,
  crear,
  actualizar,
  cambiarEstadoActivo,
};
