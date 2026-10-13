// src/middleware/auth.middleware.js
const { verificarToken } = require("../utils/jwt");
const usuarioModel = require("../models/usuario.model");

/**
 * Verifica el header Authorization: Bearer <token>.
 * Si es valido, adjunta req.usuario = { id_usuario, id_rol, rol, email }.
 */
function requiereAutenticacion(req, res, next) {
  const header = req.headers.authorization || "";
  const [tipo, token] = header.split(" ");

  if (tipo !== "Bearer" || !token) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }

  try {
    const payload = verificarToken(token);

    // Confirmamos que el usuario siga existiendo y activo (no solo confiar en el token)
    const usuario = usuarioModel.findById(payload.id_usuario);
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: "Usuario inexistente o inactivo" });
    }

    req.usuario = {
      id_usuario: usuario.id_usuario,
      id_rol: usuario.id_rol,
      rol: usuario.rol,
      email: usuario.email,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token invalido o expirado" });
  }
}

/**
 * Restringe el acceso a los roles indicados.
 * Uso: requiereRol("Administrador") o requiereRol("Administrador", "Profesional")
 */
function requiereRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: "No autenticado" });
    }
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: "No tienes permisos para esta accion" });
    }
    next();
  };
}

module.exports = { requiereAutenticacion, requiereRol };
