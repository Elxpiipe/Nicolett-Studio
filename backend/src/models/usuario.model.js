// src/models/usuario.model.js
// Capa de acceso a datos: toda la interaccion SQL para usuarios/clientes/profesionales
// vive aqui, para que los controllers no escriban SQL directamente.

const db = require("../../db/connection");
const { ROLES } = require("../utils/roles");

const CAMPOS_USUARIO_PUBLICOS = `
  u.id_usuario, u.id_rol, u.rut, u.nombres, u.apellidos, u.email, u.telefono,
  u.activo, u.es_invitado, u.fecha_creacion, u.fecha_actualizacion, r.nombre AS rol
`;

async function findByEmail(email) {
  // email es CITEXT: la comparacion ya no distingue mayusculas (antes COLLATE NOCASE)
  const stmt = db.prepare(`
    SELECT u.*, r.nombre AS rol
    FROM usuarios u
    JOIN roles r ON r.id_rol = u.id_rol
    WHERE u.email = ?
  `);
  return stmt.get(email);
}

async function findById(id_usuario) {
  const stmt = db.prepare(`
    SELECT ${CAMPOS_USUARIO_PUBLICOS}
    FROM usuarios u
    JOIN roles r ON r.id_rol = u.id_rol
    WHERE u.id_usuario = ?
  `);
  return stmt.get(id_usuario);
}

async function findByRut(rut) {
  if (!rut) return null;
  const stmt = db.prepare(`SELECT id_usuario FROM usuarios WHERE rut = ?`);
  return stmt.get(rut);
}

async function getPerfilExtendido(id_usuario, id_rol) {
  if (id_rol === ROLES.CLIENTE.id_rol) {
    const stmt = db.prepare(`
      SELECT id_cliente, fecha_nacimiento, preferencias, observaciones, fecha_registro
      FROM clientes WHERE id_usuario = ?
    `);
    return { perfil: "cliente", detalle: await stmt.get(id_usuario) };
  }
  if (id_rol === ROLES.PROFESIONAL.id_rol) {
    const stmt = db.prepare(`
      SELECT id_profesional, descripcion, fecha_ingreso, activo
      FROM profesionales WHERE id_usuario = ?
    `);
    return { perfil: "profesional", detalle: await stmt.get(id_usuario) };
  }
  return { perfil: "administrador", detalle: null };
}

/**
 * Crea un usuario y, segun su rol, la fila de extension correspondiente
 * (clientes o profesionales), todo dentro de una transaccion.
 */
async function crearUsuarioConPerfil({
  id_rol,
  rut,
  nombres,
  apellidos,
  email,
  telefono,
  password_hash,
  // extension cliente
  fecha_nacimiento,
  preferencias,
  // extension profesional
  descripcion,
  fecha_ingreso,
}) {
  const insertarUsuario = db.prepare(`
    INSERT INTO usuarios (id_rol, rut, nombres, apellidos, email, telefono, password_hash)
    VALUES (@id_rol, @rut, @nombres, @apellidos, @email, @telefono, @password_hash)
    RETURNING id_usuario
  `);

  const insertarCliente = db.prepare(`
    INSERT INTO clientes (id_usuario, fecha_nacimiento, preferencias)
    VALUES (?, ?, ?)
  `);

  const insertarProfesional = db.prepare(`
    INSERT INTO profesionales (id_usuario, descripcion, fecha_ingreso)
    VALUES (?, ?, ?)
  `);

  const transaccion = db.transaction(async () => {
    const info = await insertarUsuario.run({
      id_rol,
      rut: rut || null,
      nombres,
      apellidos,
      email,
      telefono: telefono || null,
      password_hash,
    });

    const id_usuario = info.lastInsertRowid;

    if (id_rol === ROLES.CLIENTE.id_rol) {
      await insertarCliente.run(id_usuario, fecha_nacimiento || null, preferencias || null);
    } else if (id_rol === ROLES.PROFESIONAL.id_rol) {
      await insertarProfesional.run(id_usuario, descripcion || null, fecha_ingreso || null);
    }

    return id_usuario;
  });

  const id_usuario = await transaccion();
  return findById(id_usuario);
}

async function actualizarUsuario(id_usuario, { nombres, apellidos, telefono, rut, email }) {
  const stmt = db.prepare(`
    UPDATE usuarios
    SET nombres = COALESCE(@nombres, nombres),
        apellidos = COALESCE(@apellidos, apellidos),
        telefono = COALESCE(@telefono, telefono),
        rut = COALESCE(@rut, rut),
        email = COALESCE(@email, email),
        fecha_actualizacion = fecha_actual_utc()
    WHERE id_usuario = @id_usuario
  `);
  await stmt.run({ id_usuario, nombres, apellidos, telefono, rut, email });
  return findById(id_usuario);
}

async function actualizarPassword(id_usuario, password_hash) {
  const stmt = db.prepare(`
    UPDATE usuarios
    SET password_hash = ?, fecha_actualizacion = fecha_actual_utc()
    WHERE id_usuario = ?
  `);
  await stmt.run(password_hash, id_usuario);
}

async function cambiarEstadoActivo(id_usuario, activo) {
  const stmt = db.prepare(`
    UPDATE usuarios
    SET activo = ?, fecha_actualizacion = fecha_actual_utc()
    WHERE id_usuario = ?
  `);
  await stmt.run(activo ? 1 : 0, id_usuario);
  return findById(id_usuario);
}

async function listarUsuarios({ id_rol, activo, busqueda, pagina = 1, tamanoPagina = 20 }) {
  const condiciones = [];
  const params = {};

  if (id_rol) {
    condiciones.push("u.id_rol = @id_rol");
    params.id_rol = id_rol;
  }
  if (activo !== undefined && activo !== null) {
    condiciones.push("u.activo = @activo");
    params.activo = activo ? 1 : 0;
  }
  if (busqueda) {
    condiciones.push(
      // ILIKE: en SQLite LIKE no distinguia mayusculas
      "(u.nombres ILIKE @busqueda OR u.apellidos ILIKE @busqueda OR u.email ILIKE @busqueda OR u.rut ILIKE @busqueda)"
    );
    params.busqueda = `%${busqueda}%`;
  }

  const whereClause = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const offset = (Math.max(1, pagina) - 1) * tamanoPagina;

  const filas = await db
    .prepare(
      `
      SELECT ${CAMPOS_USUARIO_PUBLICOS}
      FROM usuarios u
      JOIN roles r ON r.id_rol = u.id_rol
      ${whereClause}
      ORDER BY u.fecha_creacion DESC, u.id_usuario ASC
      LIMIT @limite OFFSET @offset
    `
    )
    .all({ ...params, limite: tamanoPagina, offset });

  const total = (await db.prepare(`SELECT COUNT(*) AS total FROM usuarios u ${whereClause}`).get(params)).total;

  return { datos: filas, total, pagina, tamanoPagina };
}

// --- Recuperacion de contrasena ---

async function invalidarTokensRecuperacion(id_usuario) {
  await db.prepare(
    `UPDATE tokens_recuperacion_password SET usado = 1 WHERE id_usuario = ? AND usado = 0`
  ).run(id_usuario);
}

async function crearTokenRecuperacion(id_usuario, token_hash, fecha_expiracion) {
  await db.prepare(
    `INSERT INTO tokens_recuperacion_password (id_usuario, token_hash, fecha_expiracion)
     VALUES (?, ?, ?)`
  ).run(id_usuario, token_hash, fecha_expiracion);
}

async function buscarTokenRecuperacionValido(token_hash) {
  return db
    .prepare(
      `SELECT t.*, u.email
       FROM tokens_recuperacion_password t
       JOIN usuarios u ON u.id_usuario = t.id_usuario
       WHERE t.token_hash = ?
         AND t.usado = 0
         AND t.fecha_expiracion > fecha_actual_utc()`
    )
    .get(token_hash);
}

async function marcarTokenRecuperacionUsado(id_token) {
  await db.prepare(`UPDATE tokens_recuperacion_password SET usado = 1 WHERE id_token = ?`).run(id_token);
}

/** Marca (1) o desmarca (0) a un usuario como invitada (compra o reserva sin cuenta) */
async function marcarInvitado(id_usuario, esInvitado) {
  await db.prepare(`UPDATE usuarios SET es_invitado = ?, fecha_actualizacion = fecha_actual_utc() WHERE id_usuario = ?`).run(
    esInvitado ? 1 : 0,
    id_usuario
  );
}

module.exports = {
  findByEmail,
  findById,
  findByRut,
  getPerfilExtendido,
  crearUsuarioConPerfil,
  marcarInvitado,
  actualizarUsuario,
  actualizarPassword,
  cambiarEstadoActivo,
  listarUsuarios,
  invalidarTokensRecuperacion,
  crearTokenRecuperacion,
  buscarTokenRecuperacionValido,
  marcarTokenRecuperacionUsado,
};
