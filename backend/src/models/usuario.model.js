// src/models/usuario.model.js
// Capa de acceso a datos: toda la interaccion SQL para usuarios/clientes/profesionales
// vive aqui, para que los controllers no escriban SQL directamente.

const db = require("../../db/connection");
const { ROLES } = require("../utils/roles");

const CAMPOS_USUARIO_PUBLICOS = `
  u.id_usuario, u.id_rol, u.rut, u.nombres, u.apellidos, u.email, u.telefono,
  u.activo, u.fecha_creacion, u.fecha_actualizacion, r.nombre AS rol
`;

function findByEmail(email) {
  const stmt = db.prepare(`
    SELECT u.*, r.nombre AS rol
    FROM usuarios u
    JOIN roles r ON r.id_rol = u.id_rol
    WHERE u.email = ? COLLATE NOCASE
  `);
  return stmt.get(email);
}

function findById(id_usuario) {
  const stmt = db.prepare(`
    SELECT ${CAMPOS_USUARIO_PUBLICOS}
    FROM usuarios u
    JOIN roles r ON r.id_rol = u.id_rol
    WHERE u.id_usuario = ?
  `);
  return stmt.get(id_usuario);
}

function findByRut(rut) {
  if (!rut) return null;
  const stmt = db.prepare(`SELECT id_usuario FROM usuarios WHERE rut = ?`);
  return stmt.get(rut);
}

function getPerfilExtendido(id_usuario, id_rol) {
  if (id_rol === ROLES.CLIENTE.id_rol) {
    const stmt = db.prepare(`
      SELECT id_cliente, fecha_nacimiento, preferencias, observaciones, fecha_registro
      FROM clientes WHERE id_usuario = ?
    `);
    return { perfil: "cliente", detalle: stmt.get(id_usuario) };
  }
  if (id_rol === ROLES.PROFESIONAL.id_rol) {
    const stmt = db.prepare(`
      SELECT id_profesional, descripcion, fecha_ingreso, activo
      FROM profesionales WHERE id_usuario = ?
    `);
    return { perfil: "profesional", detalle: stmt.get(id_usuario) };
  }
  return { perfil: "administrador", detalle: null };
}

/**
 * Crea un usuario y, segun su rol, la fila de extension correspondiente
 * (clientes o profesionales), todo dentro de una transaccion.
 */
function crearUsuarioConPerfil({
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
  `);

  const insertarCliente = db.prepare(`
    INSERT INTO clientes (id_usuario, fecha_nacimiento, preferencias)
    VALUES (?, ?, ?)
  `);

  const insertarProfesional = db.prepare(`
    INSERT INTO profesionales (id_usuario, descripcion, fecha_ingreso)
    VALUES (?, ?, ?)
  `);

  const transaccion = db.transaction(() => {
    const info = insertarUsuario.run({
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
      insertarCliente.run(id_usuario, fecha_nacimiento || null, preferencias || null);
    } else if (id_rol === ROLES.PROFESIONAL.id_rol) {
      insertarProfesional.run(id_usuario, descripcion || null, fecha_ingreso || null);
    }

    return id_usuario;
  });

  const id_usuario = transaccion();
  return findById(id_usuario);
}

function actualizarUsuario(id_usuario, { nombres, apellidos, telefono, rut, email }) {
  const stmt = db.prepare(`
    UPDATE usuarios
    SET nombres = COALESCE(@nombres, nombres),
        apellidos = COALESCE(@apellidos, apellidos),
        telefono = COALESCE(@telefono, telefono),
        rut = COALESCE(@rut, rut),
        email = COALESCE(@email, email),
        fecha_actualizacion = CURRENT_TIMESTAMP
    WHERE id_usuario = @id_usuario
  `);
  stmt.run({ id_usuario, nombres, apellidos, telefono, rut, email });
  return findById(id_usuario);
}

function actualizarPassword(id_usuario, password_hash) {
  const stmt = db.prepare(`
    UPDATE usuarios
    SET password_hash = ?, fecha_actualizacion = CURRENT_TIMESTAMP
    WHERE id_usuario = ?
  `);
  stmt.run(password_hash, id_usuario);
}

function cambiarEstadoActivo(id_usuario, activo) {
  const stmt = db.prepare(`
    UPDATE usuarios
    SET activo = ?, fecha_actualizacion = CURRENT_TIMESTAMP
    WHERE id_usuario = ?
  `);
  stmt.run(activo ? 1 : 0, id_usuario);
  return findById(id_usuario);
}

function listarUsuarios({ id_rol, activo, busqueda, pagina = 1, tamanoPagina = 20 }) {
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
      "(u.nombres LIKE @busqueda OR u.apellidos LIKE @busqueda OR u.email LIKE @busqueda OR u.rut LIKE @busqueda)"
    );
    params.busqueda = `%${busqueda}%`;
  }

  const whereClause = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const offset = (Math.max(1, pagina) - 1) * tamanoPagina;

  const filas = db
    .prepare(
      `
      SELECT ${CAMPOS_USUARIO_PUBLICOS}
      FROM usuarios u
      JOIN roles r ON r.id_rol = u.id_rol
      ${whereClause}
      ORDER BY u.fecha_creacion DESC
      LIMIT @limite OFFSET @offset
    `
    )
    .all({ ...params, limite: tamanoPagina, offset });

  const total = db
    .prepare(`SELECT COUNT(*) AS total FROM usuarios u ${whereClause}`)
    .get(params).total;

  return { datos: filas, total, pagina, tamanoPagina };
}

// --- Recuperacion de contrasena ---

function invalidarTokensRecuperacion(id_usuario) {
  db.prepare(
    `UPDATE tokens_recuperacion_password SET usado = 1 WHERE id_usuario = ? AND usado = 0`
  ).run(id_usuario);
}

function crearTokenRecuperacion(id_usuario, token_hash, fecha_expiracion) {
  db.prepare(
    `INSERT INTO tokens_recuperacion_password (id_usuario, token_hash, fecha_expiracion)
     VALUES (?, ?, ?)`
  ).run(id_usuario, token_hash, fecha_expiracion);
}

function buscarTokenRecuperacionValido(token_hash) {
  return db
    .prepare(
      `SELECT t.*, u.email
       FROM tokens_recuperacion_password t
       JOIN usuarios u ON u.id_usuario = t.id_usuario
       WHERE t.token_hash = ?
         AND t.usado = 0
         AND datetime(t.fecha_expiracion) > datetime('now')`
    )
    .get(token_hash);
}

function marcarTokenRecuperacionUsado(id_token) {
  db.prepare(`UPDATE tokens_recuperacion_password SET usado = 1 WHERE id_token = ?`).run(id_token);
}

module.exports = {
  findByEmail,
  findById,
  findByRut,
  getPerfilExtendido,
  crearUsuarioConPerfil,
  actualizarUsuario,
  actualizarPassword,
  cambiarEstadoActivo,
  listarUsuarios,
  invalidarTokensRecuperacion,
  crearTokenRecuperacion,
  buscarTokenRecuperacionValido,
  marcarTokenRecuperacionUsado,
};
