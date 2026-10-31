// src/models/profesional.model.js
// Profesionales: servicios que realizan, horario semanal y bloqueos de agenda.
const db = require("../../db/connection");
const { ahoraChile } = require("../utils/fechas");
const CAMPOS = `
  p.id_profesional, p.id_usuario, p.descripcion, p.activo,
  p.foto_url, p.cargo, p.es_destacada, p.visible_sitio, p.orden,
  p.alias_calendario, p.google_calendar_id,
  u.nombres, u.apellidos, u.email, u.telefono, u.activo AS usuario_activo,
  (u.id_rol = 1)::int AS es_administradora
`;

async function listar({ soloActivos = false } = {}) {
  const condicion = soloActivos ? "WHERE p.activo = 1 AND u.activo = 1" : "";
  return db
    .prepare(
      `SELECT ${CAMPOS} FROM profesionales p
       JOIN usuarios u ON u.id_usuario = p.id_usuario
       ${condicion}
       ORDER BY p.es_destacada DESC, p.orden, u.nombres, u.apellidos, p.id_profesional`
    )
    .all();
}

async function obtener(id_profesional) {
  return db
    .prepare(
      `SELECT ${CAMPOS} FROM profesionales p
       JOIN usuarios u ON u.id_usuario = p.id_usuario
       WHERE p.id_profesional = ?`
    )
    .get(id_profesional);
}

async function obtenerPorUsuario(id_usuario) {
  return db
    .prepare(
      `SELECT ${CAMPOS} FROM profesionales p
       JOIN usuarios u ON u.id_usuario = p.id_usuario
       WHERE p.id_usuario = ?`
    )
    .get(id_usuario);
}

const CAMPOS_PERFIL = [
  "descripcion",
  "cargo",
  "es_destacada",
  "visible_sitio",
  "orden",
  "alias_calendario",
  "google_calendar_id",
];

/** Actualiza solo los campos enviados del perfil profesional (y nombres en usuarios) */
const actualizarPerfil = db.transaction(async (id_profesional, cambios) => {
  const campos = CAMPOS_PERFIL.filter((c) => cambios[c] !== undefined);
  if (campos.length) {
    const asignaciones = campos.map((c) => `${c} = @${c}`).join(", ");
    const valores = { id_profesional };
    for (const c of campos) {
      const v = cambios[c];
      valores[c] = typeof v === "boolean" ? Number(v) : v === "" ? null : v;
    }
    await db.prepare(`UPDATE profesionales SET ${asignaciones} WHERE id_profesional = @id_profesional`).run(valores);
  }
  // Solo una profesional puede ser la destacada (duena / principal)
  if (cambios.es_destacada) {
    await db.prepare(`UPDATE profesionales SET es_destacada = 0 WHERE id_profesional <> ?`).run(id_profesional);
  }
  if (cambios.nombres || cambios.apellidos) {
    const actual = await obtener(id_profesional);
    await db.prepare(`UPDATE usuarios SET nombres = ?, apellidos = ? WHERE id_usuario = ?`).run(
      cambios.nombres || actual.nombres,
      cambios.apellidos || actual.apellidos,
      actual.id_usuario
    );
  }
});

/** Crea el perfil de profesional para una cuenta existente (ej. la duena, que es Administradora) */
async function crearParaUsuario(id_usuario, { cargo, descripcion } = {}) {
  const existente = await obtenerPorUsuario(id_usuario);
  if (existente) return existente;
  await db.prepare(`INSERT INTO profesionales (id_usuario, descripcion, cargo) VALUES (?, ?, ?)`).run(
    id_usuario,
    descripcion || null,
    cargo || null
  );
  return obtenerPorUsuario(id_usuario);
}

/** Da o quita acceso de Administradora a la cuenta de una profesional */
async function cambiarRolUsuario(id_usuario, esAdministradora) {
  await db.prepare(`UPDATE usuarios SET id_rol = ? WHERE id_usuario = ?`).run(esAdministradora ? 1 : 2, id_usuario);
}

async function contarAdministradorasActivas() {
  return (await db.prepare(`SELECT COUNT(*) AS n FROM usuarios WHERE id_rol = 1 AND activo = 1`).get()).n;
}

async function cambiarEstado(id_profesional, activo) {
  await db.prepare(`UPDATE profesionales SET activo = ? WHERE id_profesional = ?`).run(activo ? 1 : 0, id_profesional);
  return obtener(id_profesional);
}

async function actualizarFoto(id_profesional, foto_url) {
  await db.prepare(`UPDATE profesionales SET foto_url = ? WHERE id_profesional = ?`).run(foto_url, id_profesional);
  return obtener(id_profesional);
}

/** Equipo visible en el sitio publico ("Nosotras") */
async function listarPublico() {
  const filas = await db
    .prepare(
      `SELECT p.id_profesional, p.descripcion, p.foto_url, p.cargo, p.es_destacada,
              u.nombres, u.apellidos,
              (SELECT STRING_AGG(DISTINCT c.nombre, ',')
                 FROM profesional_servicio ps
                 JOIN servicios s ON s.id_servicio = ps.id_servicio AND s.activo = 1
                 JOIN categorias_servicio c ON c.id_categoria = s.id_categoria
                WHERE ps.id_profesional = p.id_profesional AND ps.activo = 1) AS categorias
       FROM profesionales p JOIN usuarios u ON u.id_usuario = p.id_usuario
       WHERE p.activo = 1 AND u.activo = 1 AND p.visible_sitio = 1
       ORDER BY p.es_destacada DESC, p.orden, u.nombres, p.id_profesional`
    )
    .all();
  return filas.map((p) => ({ ...p, categorias: p.categorias ? p.categorias.split(",").sort() : [] }));
}

/** Tramos de atencion de todas las profesionales activas (para "horario del salon") */
async function tramosActivos() {
  return db
    .prepare(
      `SELECT d.dia_semana, d.hora_inicio, d.hora_fin
       FROM disponibilidad_profesional d
       JOIN profesionales p ON p.id_profesional = d.id_profesional
       JOIN usuarios u ON u.id_usuario = p.id_usuario
       WHERE d.activo = 1 AND p.activo = 1 AND u.activo = 1
       ORDER BY d.dia_semana, d.hora_inicio, d.id_disponibilidad`
    )
    .all();
}

/** Profesionales activas que realizan un servicio (para que la clienta elija) */
async function listarPorServicio(id_servicio) {
  return db
    .prepare(
      `SELECT p.id_profesional, p.descripcion, u.nombres, u.apellidos
       FROM profesional_servicio ps
       JOIN profesionales p ON p.id_profesional = ps.id_profesional
       JOIN usuarios u ON u.id_usuario = p.id_usuario
       WHERE ps.id_servicio = ? AND ps.activo = 1 AND p.activo = 1 AND u.activo = 1
       ORDER BY u.nombres, p.id_profesional`
    )
    .all(id_servicio);
}

// ---------- Servicios que realiza ----------

async function listarServicios(id_profesional) {
  return db
    .prepare(
      `SELECT s.id_servicio, s.nombre, s.id_categoria, c.nombre AS categoria
       FROM profesional_servicio ps
       JOIN servicios s ON s.id_servicio = ps.id_servicio
       JOIN categorias_servicio c ON c.id_categoria = s.id_categoria
       WHERE ps.id_profesional = ? AND ps.activo = 1
       ORDER BY c.nombre, s.nombre, s.id_servicio`
    )
    .all(id_profesional);
}

/** Reemplaza el conjunto completo de servicios de la profesional */
const reemplazarServicios = db.transaction(async (id_profesional, idsServicios) => {
  await db.prepare(`DELETE FROM profesional_servicio WHERE id_profesional = ?`).run(id_profesional);
  const insertar = db.prepare(
    `INSERT INTO profesional_servicio (id_profesional, id_servicio, activo) VALUES (?, ?, 1)`
  );
  for (const id of idsServicios) await insertar.run(id_profesional, id);
});

// ---------- Horario semanal ----------

async function listarHorario(id_profesional) {
  return db
    .prepare(
      `SELECT id_disponibilidad, dia_semana, hora_inicio, hora_fin, fecha_desde, fecha_hasta
       FROM disponibilidad_profesional
       WHERE id_profesional = ? AND activo = 1
       ORDER BY dia_semana, hora_inicio, id_disponibilidad`
    )
    .all(id_profesional);
}

/** Tramos que aplican a una fecha concreta */
async function horarioDeFecha(id_profesional, dia_semana, fecha) {
  return db
    .prepare(
      `SELECT hora_inicio, hora_fin FROM disponibilidad_profesional
       WHERE id_profesional = ? AND dia_semana = ? AND activo = 1
         AND (fecha_desde IS NULL OR fecha_desde <= ?)
         AND (fecha_hasta IS NULL OR fecha_hasta >= ?)
       ORDER BY hora_inicio, id_disponibilidad`
    )
    .all(id_profesional, dia_semana, fecha, fecha);
}

/** Reemplaza el horario semanal completo (tramos: [{dia_semana, hora_inicio, hora_fin}]) */
const reemplazarHorario = db.transaction(async (id_profesional, tramos) => {
  await db.prepare(`DELETE FROM disponibilidad_profesional WHERE id_profesional = ?`).run(id_profesional);
  const insertar = db.prepare(
    `INSERT INTO disponibilidad_profesional (id_profesional, dia_semana, hora_inicio, hora_fin)
     VALUES (?, ?, ?, ?)`
  );
  for (const t of tramos) await insertar.run(id_profesional, t.dia_semana, t.hora_inicio, t.hora_fin);
});

// ---------- Bloqueos (vacaciones, tramites, colacion puntual) ----------

async function listarBloqueos(id_profesional, desde) {
  return db
    .prepare(
      `SELECT id_bloqueo, fecha_hora_inicio, fecha_hora_fin, motivo
       FROM bloqueos_agenda
       WHERE id_profesional = ? AND fecha_hora_fin > ?
       ORDER BY fecha_hora_inicio, id_bloqueo`
    )
    .all(id_profesional, desde);
}

async function bloqueosQueTocan(id_profesional, inicio, fin) {
  return db
    .prepare(
      `SELECT fecha_hora_inicio, fecha_hora_fin FROM bloqueos_agenda
       WHERE id_profesional = ? AND fecha_hora_inicio < ? AND fecha_hora_fin > ?
       ORDER BY id_bloqueo`
    )
    .all(id_profesional, fin, inicio);
}

async function obtenerBloqueo(id_bloqueo) {
  return db.prepare(`SELECT * FROM bloqueos_agenda WHERE id_bloqueo = ?`).get(id_bloqueo);
}

async function crearBloqueo({ id_profesional, fecha_hora_inicio, fecha_hora_fin, motivo }) {
  const info = await db
    .prepare(
      `INSERT INTO bloqueos_agenda (id_profesional, fecha_hora_inicio, fecha_hora_fin, motivo)
       VALUES (?, ?, ?, ?)
       RETURNING id_bloqueo`
    )
    .run(id_profesional, fecha_hora_inicio, fecha_hora_fin, motivo || null);
  return obtenerBloqueo(info.lastInsertRowid);
}

async function eliminarBloqueo(id_bloqueo) {
  await db.prepare(`DELETE FROM bloqueos_agenda WHERE id_bloqueo = ?`).run(id_bloqueo);
}

// ---------- Citas que ocupan agenda ----------

// Una cita ocupa la hora si:
//  - esta CONFIRMADA (abono pagado), o
//  - esta PENDIENTE_ABONO y su plazo para pagar aun no vence
//    (15 min en Webpay, 2 horas por transferencia). Vencido el plazo,
//    la hora vuelve a ofrecerse aunque la cita aun no se haya cancelado.
async function citasQueTocan(id_profesional, inicio, fin) {
  return db
    .prepare(
      `SELECT id_cita, fecha_hora_inicio, fecha_hora_fin, estado FROM citas
       WHERE id_profesional = ?
         AND (
           estado = 'CONFIRMADA'
           OR (estado = 'PENDIENTE_ABONO'
               AND (fecha_expiracion_abono IS NULL OR fecha_expiracion_abono > ?))
         )
         AND fecha_hora_inicio < ? AND fecha_hora_fin > ?
       ORDER BY id_cita`
    )
    .all(id_profesional, ahoraChile().texto, fin, inicio);
}

module.exports = {
  listar,
  obtener,
  obtenerPorUsuario,
  actualizarPerfil,
  crearParaUsuario,
  cambiarRolUsuario,
  contarAdministradorasActivas,
  cambiarEstado,
  actualizarFoto,
  listarPublico,
  tramosActivos,
  listarPorServicio,
  listarServicios,
  reemplazarServicios,
  listarHorario,
  horarioDeFecha,
  reemplazarHorario,
  listarBloqueos,
  bloqueosQueTocan,
  obtenerBloqueo,
  crearBloqueo,
  eliminarBloqueo,
  citasQueTocan,
};
