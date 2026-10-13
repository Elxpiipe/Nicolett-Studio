// src/controllers/profesionales.controller.js
const profesionalModel = require("../models/profesional.model");
const usuarioModel = require("../models/usuario.model");
const { ROLES } = require("../utils/roles");
const { hashPassword } = require("../utils/password");
const { urlArchivo, borrarImagenGuardada } = require("../middleware/upload.middleware");
const googleCalendar = require("../services/googleCalendar.service");
const servicioModel = require("../models/servicio.model");
const { REGEX_HORA, aMinutos, normalizarFechaHora, ahoraChile } = require("../utils/fechas");

const DIAS = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** Arma la ficha completa de una profesional */
function fichaCompleta(profesional) {
  return {
    ...profesional,
    servicios: profesionalModel.listarServicios(profesional.id_profesional),
    horario: profesionalModel.listarHorario(profesional.id_profesional),
  };
}

/**
 * Carga la profesional de :id y verifica permisos.
 * Administrador: cualquiera. Profesional: solo la suya (si soloAdmin es false).
 */
function cargarConPermiso(req, res, { soloAdmin = false } = {}) {
  const profesional = profesionalModel.obtener(Number(req.params.id));
  if (!profesional) {
    res.status(404).json({ error: "Profesional no encontrada" });
    return null;
  }
  const esAdmin = req.usuario.rol === "Administrador";
  const esPropia = req.usuario.rol === "Profesional" && profesional.id_usuario === req.usuario.id_usuario;
  if (!esAdmin && (soloAdmin || !esPropia)) {
    res.status(403).json({ error: "No tienes permisos para esta acción" });
    return null;
  }
  return profesional;
}

/**
 * GET /api/profesionales
 * Administrador: todas. Profesional: solo su propia ficha.
 */
function listar(req, res) {
  if (req.usuario.rol === "Profesional") {
    const propia = profesionalModel.obtenerPorUsuario(req.usuario.id_usuario);
    return res.json({ datos: propia ? [fichaCompleta(propia)] : [] });
  }
  return res.json({ datos: profesionalModel.listar().map(fichaCompleta) });
}

/** GET /api/profesionales/:id */
function obtener(req, res) {
  const profesional = cargarConPermiso(req, res);
  if (!profesional) return;
  return res.json({ profesional: fichaCompleta(profesional) });
}

/**
 * POST /api/profesionales — crea la cuenta (rol Profesional) y su perfil. Solo Administrador.
 * { nombres, apellidos, email, telefono?, password, cargo?, descripcion? }
 */
async function crear(req, res) {
  const { nombres, apellidos, email, telefono, password, cargo, descripcion } = req.body;
  if (usuarioModel.findByEmail(email)) {
    return res.status(409).json({ error: "Ya existe una cuenta con ese correo" });
  }
  const usuario = usuarioModel.crearUsuarioConPerfil({
    id_rol: ROLES.PROFESIONAL.id_rol,
    nombres,
    apellidos,
    email,
    telefono,
    password_hash: await hashPassword(password),
    descripcion,
  });
  const creada = profesionalModel.obtenerPorUsuario(usuario.id_usuario);
  // Queda al final del equipo en "Nosotras" (el orden se puede cambiar despues)
  const ultimoOrden = Math.max(0, ...profesionalModel.listar().map((p) => p.orden || 0));
  profesionalModel.actualizarPerfil(creada.id_profesional, { cargo: cargo || null, orden: ultimoOrden + 1 });
  return res.status(201).json({ profesional: fichaCompleta(profesionalModel.obtener(creada.id_profesional)) });
}

/**
 * PUT /api/profesionales/:id — perfil publico y datos de calendario. Solo Administrador.
 * { nombres, apellidos, cargo, descripcion, es_destacada, visible_sitio, orden,
 *   alias_calendario, google_calendar_id }
 */
function actualizar(req, res) {
  const profesional = cargarConPermiso(req, res, { soloAdmin: true });
  if (!profesional) return;
  profesionalModel.actualizarPerfil(profesional.id_profesional, req.body);
  googleCalendar.invalidarCache(); // el alias o el calendario pudieron cambiar
  return res.json({ profesional: fichaCompleta(profesionalModel.obtener(profesional.id_profesional)) });
}

/**
 * PUT /api/profesionales/:id/estado { activo } — solo Administrador.
 * Desactivada: no aparece en el sitio ni recibe reservas (su cuenta sigue existiendo).
 */
function cambiarEstado(req, res) {
  const profesional = cargarConPermiso(req, res, { soloAdmin: true });
  if (!profesional) return;
  const actualizada = profesionalModel.cambiarEstado(profesional.id_profesional, Boolean(req.body.activo));
  googleCalendar.invalidarCache();
  return res.json({ profesional: fichaCompleta(actualizada) });
}

/** POST /api/profesionales/:id/foto (multipart, campo "imagen") — solo Administrador */
function subirFoto(req, res) {
  const profesional = profesionalModel.obtener(Number(req.params.id));
  if (!profesional) {
    if (req.file) borrarImagenGuardada(urlArchivo("profesionales", req.file));
    return res.status(404).json({ error: "Profesional no encontrada" });
  }
  if (!req.file) return res.status(400).json({ error: "Debes adjuntar una imagen en el campo 'imagen'" });
  const actualizada = profesionalModel.actualizarFoto(profesional.id_profesional, urlArchivo("profesionales", req.file));
  borrarImagenGuardada(profesional.foto_url);
  return res.json({ profesional: fichaCompleta(actualizada) });
}

/** DELETE /api/profesionales/:id/foto — vuelve a la imagen generica. Solo Administrador */
function quitarFoto(req, res) {
  const profesional = cargarConPermiso(req, res, { soloAdmin: true });
  if (!profesional) return;
  const actualizada = profesionalModel.actualizarFoto(profesional.id_profesional, null);
  borrarImagenGuardada(profesional.foto_url);
  return res.json({ profesional: fichaCompleta(actualizada) });
}

/** PUT /api/profesionales/:id/servicios  { servicios: [id, ...] }  — solo Administrador */
function asignarServicios(req, res) {
  const profesional = cargarConPermiso(req, res, { soloAdmin: true });
  if (!profesional) return;

  const ids = [...new Set(req.body.servicios.map(Number))];
  const inexistente = ids.find((id) => !servicioModel.obtener(id));
  if (inexistente) {
    return res.status(400).json({ error: `El servicio ${inexistente} no existe` });
  }

  profesionalModel.reemplazarServicios(profesional.id_profesional, ids);
  return res.json({ profesional: fichaCompleta(profesionalModel.obtener(profesional.id_profesional)) });
}

/**
 * PUT /api/profesionales/:id/horario  { tramos: [{dia_semana, hora_inicio, hora_fin}] }
 * Reemplaza el horario semanal completo. Solo Administrador.
 */
function guardarHorario(req, res) {
  const profesional = cargarConPermiso(req, res, { soloAdmin: true });
  if (!profesional) return;

  const tramos = req.body.tramos.map((t) => ({
    dia_semana: Number(t.dia_semana),
    hora_inicio: String(t.hora_inicio || "").slice(0, 5),
    hora_fin: String(t.hora_fin || "").slice(0, 5),
  }));

  for (const t of tramos) {
    if (!(t.dia_semana >= 1 && t.dia_semana <= 7)) {
      return res.status(400).json({ error: "Día de la semana inválido" });
    }
    if (!REGEX_HORA.test(t.hora_inicio) || !REGEX_HORA.test(t.hora_fin)) {
      return res.status(400).json({ error: `Hora inválida el ${DIAS[t.dia_semana]}. Usa formato HH:MM` });
    }
    if (aMinutos(t.hora_inicio) >= aMinutos(t.hora_fin)) {
      return res
        .status(400)
        .json({ error: `El ${DIAS[t.dia_semana]}, la hora de inicio debe ser anterior a la de término` });
    }
  }

  // Tramos del mismo dia no pueden solaparse
  for (let dia = 1; dia <= 7; dia++) {
    const delDia = tramos
      .filter((t) => t.dia_semana === dia)
      .sort((a, b) => aMinutos(a.hora_inicio) - aMinutos(b.hora_inicio));
    for (let i = 1; i < delDia.length; i++) {
      if (aMinutos(delDia[i].hora_inicio) < aMinutos(delDia[i - 1].hora_fin)) {
        return res.status(400).json({ error: `Hay tramos que se superponen el ${DIAS[dia]}` });
      }
    }
  }

  profesionalModel.reemplazarHorario(profesional.id_profesional, tramos);
  return res.json({ profesional: fichaCompleta(profesionalModel.obtener(profesional.id_profesional)) });
}

/** GET /api/profesionales/:id/bloqueos — proximos bloqueos (Admin o la propia profesional) */
function listarBloqueos(req, res) {
  const profesional = cargarConPermiso(req, res);
  if (!profesional) return;
  const datos = profesionalModel.listarBloqueos(profesional.id_profesional, ahoraChile().texto);
  return res.json({ datos });
}

/**
 * POST /api/profesionales/:id/bloqueos  { fecha_hora_inicio, fecha_hora_fin, motivo }
 * Admin o la propia profesional. Avisa cuantas citas ya tomadas quedan dentro del bloqueo.
 */
function crearBloqueo(req, res) {
  const profesional = cargarConPermiso(req, res);
  if (!profesional) return;

  const inicio = normalizarFechaHora(req.body.fecha_hora_inicio);
  const fin = normalizarFechaHora(req.body.fecha_hora_fin);
  if (!inicio || !fin) {
    return res.status(400).json({ error: "Indica fecha y hora de inicio y de término" });
  }
  if (inicio >= fin) {
    return res.status(400).json({ error: "El término del bloqueo debe ser posterior al inicio" });
  }
  if (fin <= ahoraChile().texto) {
    return res.status(400).json({ error: "El bloqueo ya terminó: elige una fecha futura" });
  }

  const citasAfectadas = profesionalModel.citasQueTocan(profesional.id_profesional, inicio, fin).length;
  const bloqueo = profesionalModel.crearBloqueo({
    id_profesional: profesional.id_profesional,
    fecha_hora_inicio: inicio,
    fecha_hora_fin: fin,
    motivo: req.body.motivo,
  });
  return res.status(201).json({ bloqueo, citasAfectadas });
}

/** DELETE /api/profesionales/:id/bloqueos/:idBloqueo */
function eliminarBloqueo(req, res) {
  const profesional = cargarConPermiso(req, res);
  if (!profesional) return;
  const bloqueo = profesionalModel.obtenerBloqueo(Number(req.params.idBloqueo));
  if (!bloqueo || bloqueo.id_profesional !== profesional.id_profesional) {
    return res.status(404).json({ error: "Bloqueo no encontrado" });
  }
  profesionalModel.eliminarBloqueo(bloqueo.id_bloqueo);
  return res.json({ mensaje: "Bloqueo eliminado" });
}

/**
 * POST /api/profesionales/yo — la Administradora que tambien atiende clientas crea
 * su perfil de profesional con SU MISMA cuenta (aparece en "Nosotras" y recibe reservas).
 */
function crearPerfilPropio(req, res) {
  const ya = profesionalModel.obtenerPorUsuario(req.usuario.id_usuario);
  if (ya) return res.json({ profesional: fichaCompleta(ya) });
  const creada = profesionalModel.crearParaUsuario(req.usuario.id_usuario, {
    cargo: req.body.cargo || "Fundadora",
    descripcion: req.body.descripcion,
  });
  // Al crearse, queda al final del equipo; la duena se puede marcar "destacada"
  return res.status(201).json({ profesional: fichaCompleta(creada) });
}

/**
 * PUT /api/profesionales/:id/administradora { es_administradora } — solo Administrador.
 * Una sola cuenta con los dos roles: la profesional puede administrar el sistema.
 * No se puede quitar el acceso a una misma ni dejar el sistema sin administradoras.
 */
function cambiarAccesoAdmin(req, res) {
  const profesional = cargarConPermiso(req, res, { soloAdmin: true });
  if (!profesional) return;
  const darAcceso = Boolean(req.body.es_administradora);
  if (!darAcceso) {
    if (profesional.id_usuario === req.usuario.id_usuario) {
      return res.status(409).json({ error: "No puedes quitarte a ti misma el acceso de administradora." });
    }
    if (profesional.es_administradora && profesionalModel.contarAdministradorasActivas() <= 1) {
      return res.status(409).json({ error: "El sistema debe tener al menos una administradora." });
    }
  }
  profesionalModel.cambiarRolUsuario(profesional.id_usuario, darAcceso);
  return res.json({ profesional: fichaCompleta(profesionalModel.obtener(profesional.id_profesional)) });
}

module.exports = {
  crearPerfilPropio,
  cambiarAccesoAdmin,
  listar,
  obtener,
  crear,
  actualizar,
  cambiarEstado,
  subirFoto,
  quitarFoto,
  asignarServicios,
  guardarHorario,
  listarBloqueos,
  crearBloqueo,
  eliminarBloqueo,
};
