// src/controllers/integraciones.controller.js
// Configuracion y diagnostico de Google Calendar (solo Administrador).
const googleCalendar = require("../services/googleCalendar.service");
const configuracion = require("../models/configuracion.model");

/** GET /api/integraciones/google — estado de la conexion */
async function estadoGoogle(req, res) {
  return res.json(await googleCalendar.estado());
}

/** PUT /api/integraciones/google { modo, calendarioCompartido } */
async function guardarGoogle(req, res) {
  configuracion.guardarValor("GOOGLE_CAL_MODO", req.body.modo);
  if (req.body.calendarioCompartido !== undefined) {
    configuracion.guardarValor("GOOGLE_CAL_ID", (req.body.calendarioCompartido || "").trim());
  }
  googleCalendar.invalidarCache();
  return res.json(await googleCalendar.estado());
}

/** POST /api/integraciones/google/prueba — crea un evento de prueba en cada calendario */
async function probarGoogle(req, res) {
  return res.json({ resultados: await googleCalendar.crearEventosPrueba() });
}

/** DELETE /api/integraciones/google/prueba { calendarId, eventId } — borra el evento de prueba */
async function borrarPrueba(req, res) {
  await googleCalendar.eliminarEvento(req.body.calendarId, req.body.eventId);
  return res.json({ mensaje: "Evento de prueba eliminado" });
}

/** GET /api/integraciones/google/ocupacion — lo que el sistema esta leyendo de Google */
async function ocupacionGoogle(req, res) {
  googleCalendar.invalidarCache();
  const o = await googleCalendar.obtenerOcupacion();
  return res.json({
    activo: o.activo,
    error: o.error,
    general: o.general.slice(0, 50),
    porProfesional: Object.fromEntries([...o.porProfesional].map(([id, l]) => [id, l.slice(0, 50)])),
  });
}

module.exports = { estadoGoogle, guardarGoogle, probarGoogle, borrarPrueba, ocupacionGoogle };
