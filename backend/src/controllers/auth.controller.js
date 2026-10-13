// src/controllers/auth.controller.js
const crypto = require("crypto");
const usuarioModel = require("../models/usuario.model");
const { hashPassword, comparePassword } = require("../utils/password");
const { generarToken } = require("../utils/jwt");
const { ROLES } = require("../utils/roles");
const { enviarCorreoRecuperacion } = require("../utils/mailer");

const MINUTOS_EXPIRACION_TOKEN = 30;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

function hashToken(tokenPlano) {
  return crypto.createHash("sha256").update(tokenPlano).digest("hex");
}

function serializarUsuario(usuario) {
  // Nunca devolver password_hash al cliente
  const { password_hash, ...resto } = usuario;
  return resto;
}

/**
 * POST /api/auth/registro
 * Registro publico: SIEMPRE crea un usuario con rol Cliente.
 * (Los roles Profesional/Administrador solo los crea un Administrador,
 * ver usuarios.controller.js -> crear)
 */
function registro(req, res) {
  const { nombres, apellidos, email, password, telefono, rut, fecha_nacimiento } = req.body;

  const existente = usuarioModel.findByEmail(email);
  if (existente) {
    return res.status(409).json({ error: "Ya existe una cuenta registrada con ese email" });
  }

  if (rut && usuarioModel.findByRut(rut)) {
    return res.status(409).json({ error: "Ya existe una cuenta registrada con ese RUT" });
  }

  const password_hash = hashPassword(password);

  const usuario = usuarioModel.crearUsuarioConPerfil({
    id_rol: ROLES.CLIENTE.id_rol,
    rut,
    nombres,
    apellidos,
    email,
    telefono,
    password_hash,
    fecha_nacimiento,
  });

  const token = generarToken({
    id_usuario: usuario.id_usuario,
    id_rol: usuario.id_rol,
    rol: usuario.rol,
  });

  return res.status(201).json({ usuario: serializarUsuario(usuario), token });
}

/**
 * POST /api/auth/login
 */
function login(req, res) {
  const { email, password } = req.body;

  const usuario = usuarioModel.findByEmail(email);

  // Mensaje generico para no filtrar si el email existe o no
  if (!usuario) {
    return res.status(401).json({ error: "Credenciales invalidas" });
  }

  if (!usuario.activo) {
    return res.status(403).json({ error: "Esta cuenta se encuentra deshabilitada" });
  }

  const passwordValida = comparePassword(password, usuario.password_hash);
  if (!passwordValida) {
    return res.status(401).json({ error: "Credenciales invalidas" });
  }

  const token = generarToken({
    id_usuario: usuario.id_usuario,
    id_rol: usuario.id_rol,
    rol: usuario.rol,
  });

  return res.json({ usuario: serializarUsuario(usuario), token });
}

/**
 * GET /api/auth/perfil
 * Requiere autenticacion. Devuelve datos del usuario + su perfil extendido
 * (fila de clientes o profesionales segun corresponda).
 */
function obtenerPerfil(req, res) {
  const usuario = usuarioModel.findById(req.usuario.id_usuario);
  if (!usuario) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }
  const extendido = usuarioModel.getPerfilExtendido(usuario.id_usuario, usuario.id_rol);
  return res.json({ usuario: serializarUsuario(usuario), ...extendido });
}

/**
 * PUT /api/auth/perfil
 * Requiere autenticacion. El usuario edita sus propios datos basicos.
 */
function actualizarPerfil(req, res) {
  const { nombres, apellidos, telefono } = req.body;
  const usuario = usuarioModel.actualizarUsuario(req.usuario.id_usuario, {
    nombres,
    apellidos,
    telefono,
  });
  return res.json({ usuario: serializarUsuario(usuario) });
}

/**
 * PUT /api/auth/password
 * Requiere autenticacion. El usuario cambia su propia contrasena.
 */
function cambiarPassword(req, res) {
  const { password_actual, password_nueva } = req.body;

  const usuarioCompleto = usuarioModel.findByEmail(req.usuario.email);
  const passwordValida = comparePassword(password_actual, usuarioCompleto.password_hash);

  if (!passwordValida) {
    return res.status(401).json({ error: "La contrasena actual no es correcta" });
  }

  usuarioModel.actualizarPassword(req.usuario.id_usuario, hashPassword(password_nueva));
  return res.json({ mensaje: "Contrasena actualizada correctamente" });
}

/**
 * POST /api/auth/olvide-password
 * Publica. SIEMPRE responde con el mismo mensaje generico, exista o no
 * el email, para no revelar que correos estan registrados.
 */
async function olvidePassword(req, res) {
  const { email } = req.body;
  const mensajeGenerico = {
    mensaje: "Si el correo esta registrado, te enviamos un enlace para restablecer tu contraseña.",
  };

  const usuario = usuarioModel.findByEmail(email);
  if (!usuario || !usuario.activo) {
    return res.json(mensajeGenerico);
  }

  // Invalidamos cualquier token anterior sin usar, para que solo el ultimo sirva
  usuarioModel.invalidarTokensRecuperacion(usuario.id_usuario);

  const tokenPlano = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(tokenPlano);
  const expiracion = new Date(Date.now() + MINUTOS_EXPIRACION_TOKEN * 60 * 1000);
  const expiracionSql = expiracion.toISOString().slice(0, 19).replace("T", " ");

  usuarioModel.crearTokenRecuperacion(usuario.id_usuario, tokenHash, expiracionSql);

  const enlaceRecuperacion = `${FRONTEND_URL}/restablecer-password?token=${tokenPlano}`;

  let previewUrl;
  let enlaceDirecto;
  try {
    ({ previewUrl, enlaceDirecto } = await enviarCorreoRecuperacion({
      destinatario: usuario.email,
      nombre: usuario.nombres,
      enlaceRecuperacion,
    }));
  } catch (err) {
    // Solo puede llegar aca si hay un SMTP real configurado y fallo de verdad
    // (en modo desarrollo/Ethereal, enviarCorreoRecuperacion nunca lanza error).
    console.error("Error enviando correo de recuperacion:", err);
    return res.status(500).json({ error: "No se pudo enviar el correo de recuperacion" });
  }

  // Solo en desarrollo (sin SMTP real configurado) devolvemos como ayuda el
  // link de vista previa del correo, o el enlace directo si ni el servicio
  // de prueba estuvo disponible. En produccion (con SMTP real) esto nunca
  // se incluye en la respuesta.
  return res.json({ ...mensajeGenerico, previewUrl, enlaceDirecto });
}

/**
 * POST /api/auth/restablecer-password
 * Publica. Recibe el token plano (el que va en el link del correo) y la
 * nueva contrasena.
 */
function restablecerPassword(req, res) {
  const { token, password_nueva } = req.body;

  const tokenHash = hashToken(token);
  const registroToken = usuarioModel.buscarTokenRecuperacionValido(tokenHash);

  if (!registroToken) {
    return res.status(400).json({ error: "El enlace es invalido o ya expiro" });
  }

  usuarioModel.actualizarPassword(registroToken.id_usuario, hashPassword(password_nueva));
  usuarioModel.marcarTokenRecuperacionUsado(registroToken.id_token);

  return res.json({ mensaje: "Contraseña restablecida correctamente. Ya puedes iniciar sesión." });
}

module.exports = {
  registro,
  login,
  obtenerPerfil,
  actualizarPerfil,
  cambiarPassword,
  olvidePassword,
  restablecerPassword,
  serializarUsuario,
};
