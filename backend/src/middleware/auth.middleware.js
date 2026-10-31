// src/middleware/auth.middleware.js
const { verificarToken } = require("../utils/jwt");
const usuarioModel = require("../models/usuario.model");

/**
 * Verifica el header Authorization: Bearer <token>.
 * Si es valido, adjunta req.usuario = { id_usuario, id_rol, rol, email }.
 */
async function requiereAutenticacion(req, res, next) {
  const header = req.headers.authorization || "";
  const [tipo, token] = header.split(" ");

  if (tipo !== "Bearer" || !token) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }

  try {
    const payload = verificarToken(token);

    // Confirmamos que el usuario siga existiendo y activo (no solo confiar en el token)
    const usuario = await usuarioModel.findById(payload.id_usuario);
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: "Usuario inexistente o inactivo" });
    }

    // Sesion de invitada (reserva o compra sin cuenta): solo sirve en las rutas que la
    // permiten y deja de valer si la persona ya creo su cuenta con ese correo.
    if (payload.invitado) {
      if (!usuario.es_invitado) {
        return res.status(401).json({ error: "Ya creaste tu cuenta: inicia sesión para continuar." });
      }
      if (!req.permiteInvitada) {
        return res.status(403).json({ error: "Para esto necesitas una cuenta. Crea la tuya con el mismo correo." });
      }
    }

    req.usuario = {
      id_usuario: usuario.id_usuario,
      id_rol: usuario.id_rol,
      rol: usuario.rol,
      email: usuario.email,
      invitada: Boolean(payload.invitado),
      // Una invitada solo ve lo que creo en esta sesion (no el historial de ese correo)
      sesionDesde: payload.invitado ? new Date(payload.iat * 1000).toISOString().slice(0, 19).replace("T", " ") : null,
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

/** Se pone antes de requiereAutenticacion en las rutas que aceptan una sesion de invitada */
function permitirInvitada(req, res, next) {
  req.permiteInvitada = true;
  next();
}

/**
 * Para una invitada, true solo si el registro (cita o pedido) se creo durante su sesion.
 * `fechaCreacion` viene de la base en UTC ('AAAA-MM-DD HH:MM:SS').
 */
function creadoEnSesion(usuario, fechaCreacion) {
  if (!usuario?.invitada) return true;
  return Boolean(fechaCreacion) && fechaCreacion >= usuario.sesionDesde;
}

module.exports = { requiereAutenticacion, requiereRol, permitirInvitada, creadoEnSesion };
