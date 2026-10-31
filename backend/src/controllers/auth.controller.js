// src/controllers/auth.controller.js
const crypto = require("crypto");
const usuarioModel = require("../models/usuario.model");
const { hashPassword, comparePassword } = require("../utils/password");
const { generarToken } = require("../utils/jwt");
const { ROLES } = require("../utils/roles");
const { enviarCorreoRecuperacion } = require("../utils/mailer");

const MINUTOS_EXPIRACION_TOKEN = 30;
const HORAS_ACTIVACION_INVITADA = 48; // enlace para que una invitada cree su contraseña
const DURACION_SESION_INVITADA = "3h"; // lo justo para reservar o comprar y pagar
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
async function registro(req, res) {
  const { nombres, apellidos, email, password, telefono, rut, fecha_nacimiento } = req.body;

  const existente = await usuarioModel.findByEmail(email);
  if (existente?.es_invitado && existente.activo) {
    // Ya reservo o compro como invitada con este correo: para no dejar que cualquiera
    // tome ese historial, se confirma que el correo es suyo con un enlace.
    return enviarActivacionInvitada(existente, res);
  }
  if (existente) {
    return res.status(409).json({ error: "Ya existe una cuenta registrada con ese email" });
  }

  if (rut && await usuarioModel.findByRut(rut)) {
    return res.status(409).json({ error: "Ya existe una cuenta registrada con ese RUT" });
  }

  const password_hash = hashPassword(password);

  const usuario = await usuarioModel.crearUsuarioConPerfil({
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
 * Envia a una invitada el enlace para crear su contraseña (usa los mismos tokens de
 * un solo uso que la recuperacion de contraseña).
 */
async function enviarActivacionInvitada(usuario, res) {
  await usuarioModel.invalidarTokensRecuperacion(usuario.id_usuario);
  const tokenPlano = crypto.randomBytes(32).toString("hex");
  const expiracion = new Date(Date.now() + HORAS_ACTIVACION_INVITADA * 3600 * 1000);
  await usuarioModel.crearTokenRecuperacion(usuario.id_usuario, hashToken(tokenPlano), expiracion.toISOString().slice(0, 19).replace("T", " "));
  const enlace = `${FRONTEND_URL}/restablecer-password?token=${tokenPlano}&activar=1`;
  let ayuda = {};
  try {
    ayuda = await enviarCorreoRecuperacion({
      destinatario: usuario.email,
      nombre: usuario.nombres,
      enlaceRecuperacion: enlace,
      tipo: "activacion",
    });
  } catch (err) {
    console.error("Error enviando correo de activacion:", err);
    return res.status(500).json({ error: "No se pudo enviar el correo. Intenta de nuevo en unos minutos." });
  }
  return res.status(202).json({
    activacion: true,
    mensaje:
      "Ya reservaste o compraste con este correo. Te enviamos un enlace para crear tu contraseña: al usarlo verás todo tu historial.",
    previewUrl: ayuda.previewUrl,
    enlaceDirecto: ayuda.enlaceDirecto,
  });
}

/**
 * POST /api/auth/invitada { nombres, apellidos, email, telefono }
 * Para reservar o comprar sin crear cuenta. Crea (o reutiliza) una clienta "invitada"
 * con ese correo y devuelve una sesion corta que SOLO sirve para crear y pagar una
 * reserva o un pedido, y ver lo creado en esa sesion.
 */
async function invitada(req, res) {
  const { nombres, apellidos, email, telefono } = req.body;
  let usuario = await usuarioModel.findByEmail(email);

  if (usuario && !usuario.es_invitado) {
    return res.status(409).json({
      error: "Ya tienes una cuenta con este correo. Inicia sesión para continuar.",
      codigo: "CUENTA_EXISTENTE",
    });
  }
  if (usuario && !usuario.activo) {
    return res.status(403).json({ error: "Este correo no puede usarse para reservar. Escríbenos por WhatsApp." });
  }

  if (usuario) {
    // Puede haber corregido su nombre o telefono
    await usuarioModel.actualizarUsuario(usuario.id_usuario, { nombres, apellidos, telefono });
  } else {
    usuario = await usuarioModel.crearUsuarioConPerfil({
      id_rol: ROLES.CLIENTE.id_rol,
      nombres,
      apellidos,
      email,
      telefono,
      // Sin contraseña usable: para entrar debe activar su cuenta desde su correo
      password_hash: hashPassword(crypto.randomBytes(24).toString("hex")),
    });
    await usuarioModel.marcarInvitado(usuario.id_usuario, true);
  }

  const token = generarToken(
    { id_usuario: usuario.id_usuario, id_rol: ROLES.CLIENTE.id_rol, rol: "Cliente", invitado: true },
    DURACION_SESION_INVITADA
  );
  return res.json({ token, invitada: { nombres, apellidos, email, telefono } });
}

/**
 * POST /api/auth/login
 */
async function login(req, res) {
  const { email, password } = req.body;

  const usuario = await usuarioModel.findByEmail(email);

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
async function obtenerPerfil(req, res) {
  const usuario = await usuarioModel.findById(req.usuario.id_usuario);
  if (!usuario) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }
  const extendido = await usuarioModel.getPerfilExtendido(usuario.id_usuario, usuario.id_rol);
  return res.json({ usuario: serializarUsuario(usuario), ...extendido });
}

/**
 * PUT /api/auth/perfil
 * Requiere autenticacion. El usuario edita sus propios datos basicos.
 */
async function actualizarPerfil(req, res) {
  const { nombres, apellidos, telefono } = req.body;
  const usuario = await usuarioModel.actualizarUsuario(req.usuario.id_usuario, {
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
async function cambiarPassword(req, res) {
  const { password_actual, password_nueva } = req.body;

  const usuarioCompleto = await usuarioModel.findByEmail(req.usuario.email);
  const passwordValida = comparePassword(password_actual, usuarioCompleto.password_hash);

  if (!passwordValida) {
    return res.status(401).json({ error: "La contrasena actual no es correcta" });
  }

  await usuarioModel.actualizarPassword(req.usuario.id_usuario, hashPassword(password_nueva));
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

  const usuario = await usuarioModel.findByEmail(email);
  if (!usuario || !usuario.activo) {
    return res.json(mensajeGenerico);
  }

  // Invalidamos cualquier token anterior sin usar, para que solo el ultimo sirva
  await usuarioModel.invalidarTokensRecuperacion(usuario.id_usuario);

  const tokenPlano = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(tokenPlano);
  const expiracion = new Date(Date.now() + MINUTOS_EXPIRACION_TOKEN * 60 * 1000);
  const expiracionSql = expiracion.toISOString().slice(0, 19).replace("T", " ");

  await usuarioModel.crearTokenRecuperacion(usuario.id_usuario, tokenHash, expiracionSql);

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
async function restablecerPassword(req, res) {
  const { token, password_nueva } = req.body;

  const tokenHash = hashToken(token);
  const registroToken = await usuarioModel.buscarTokenRecuperacionValido(tokenHash);

  if (!registroToken) {
    return res.status(400).json({ error: "El enlace es invalido o ya expiro" });
  }

  await usuarioModel.actualizarPassword(registroToken.id_usuario, hashPassword(password_nueva));
  await usuarioModel.marcarTokenRecuperacionUsado(registroToken.id_token);
  // Si era una invitada, al crear su contraseña su cuenta queda activa (con su historial)
  await usuarioModel.marcarInvitado(registroToken.id_usuario, false);

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
  invitada,
  serializarUsuario,
};
