// src/controllers/usuarios.controller.js
// CRUD completo de usuarios. Todas las rutas de este controller estan
// protegidas para uso exclusivo del rol Administrador (ver routes/usuarios.routes.js)

const usuarioModel = require("../models/usuario.model");
const { hashPassword } = require("../utils/password");
const { serializarUsuario } = require("./auth.controller");

/**
 * GET /api/usuarios?id_rol=&activo=&busqueda=&pagina=&tamanoPagina=
 */
async function listar(req, res) {
  const { id_rol, activo, busqueda, pagina, tamanoPagina } = req.query;

  const resultado = await usuarioModel.listarUsuarios({
    id_rol: id_rol ? Number(id_rol) : undefined,
    activo: activo === undefined ? undefined : activo === "1",
    busqueda,
    pagina: pagina ? Number(pagina) : 1,
    tamanoPagina: tamanoPagina ? Number(tamanoPagina) : 20,
  });

  return res.json(resultado);
}

/**
 * GET /api/usuarios/:id
 */
async function obtener(req, res) {
  const usuario = await usuarioModel.findById(Number(req.params.id));
  if (!usuario) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }
  const extendido = await usuarioModel.getPerfilExtendido(usuario.id_usuario, usuario.id_rol);
  return res.json({ usuario, ...extendido });
}

/**
 * POST /api/usuarios
 * El Administrador puede crear usuarios de CUALQUIER rol
 * (incluyendo Profesional y otros Administradores).
 */
async function crear(req, res) {
  const {
    nombres,
    apellidos,
    email,
    password,
    telefono,
    rut,
    id_rol,
    fecha_nacimiento,
    preferencias,
    descripcion,
    fecha_ingreso,
  } = req.body;

  const existente = await usuarioModel.findByEmail(email);
  if (existente) {
    return res.status(409).json({ error: "Ya existe un usuario con ese email" });
  }
  if (rut && await usuarioModel.findByRut(rut)) {
    return res.status(409).json({ error: "Ya existe un usuario con ese RUT" });
  }

  const usuario = await usuarioModel.crearUsuarioConPerfil({
    id_rol,
    rut,
    nombres,
    apellidos,
    email,
    telefono,
    password_hash: hashPassword(password),
    fecha_nacimiento,
    preferencias,
    descripcion,
    fecha_ingreso,
  });

  return res.status(201).json({ usuario: serializarUsuario(usuario) });
}

/**
 * PUT /api/usuarios/:id
 * Actualiza datos basicos de cualquier usuario.
 */
async function actualizar(req, res) {
  const id_usuario = Number(req.params.id);
  const existente = await usuarioModel.findById(id_usuario);
  if (!existente) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const { nombres, apellidos, telefono, rut, email } = req.body;

  if (email) {
    const conMismoEmail = await usuarioModel.findByEmail(email);
    if (conMismoEmail && conMismoEmail.id_usuario !== id_usuario) {
      return res.status(409).json({ error: "Ese email ya lo usa otro usuario" });
    }
  }
  if (rut) {
    const conMismoRut = await usuarioModel.findByRut(rut);
    if (conMismoRut && conMismoRut.id_usuario !== id_usuario) {
      return res.status(409).json({ error: "Ese RUT ya lo usa otro usuario" });
    }
  }

  const usuario = await usuarioModel.actualizarUsuario(id_usuario, {
    nombres,
    apellidos,
    telefono,
    rut,
    email,
  });

  return res.json({ usuario });
}

/**
 * DELETE /api/usuarios/:id
 * Baja logica (activo = 0). Nunca se borra fisicamente para no romper
 * la integridad referencial con citas, ventas, historial clinico, etc.
 */
async function eliminar(req, res) {
  const id_usuario = Number(req.params.id);
  const existente = await usuarioModel.findById(id_usuario);
  if (!existente) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  if (req.usuario.id_usuario === id_usuario) {
    return res.status(400).json({ error: "No puedes deshabilitar tu propia cuenta" });
  }

  const usuario = await usuarioModel.cambiarEstadoActivo(id_usuario, false);
  return res.json({ mensaje: "Usuario deshabilitado", usuario });
}

/**
 * PUT /api/usuarios/:id/reactivar
 */
async function reactivar(req, res) {
  const id_usuario = Number(req.params.id);
  const existente = await usuarioModel.findById(id_usuario);
  if (!existente) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const usuario = await usuarioModel.cambiarEstadoActivo(id_usuario, true);
  return res.json({ mensaje: "Usuario reactivado", usuario });
}

module.exports = { listar, obtener, crear, actualizar, eliminar, reactivar };
