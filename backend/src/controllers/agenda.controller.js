// src/controllers/agenda.controller.js
// Endpoints PUBLICOS de consulta de disponibilidad (la clienta puede mirar
// horas antes de iniciar sesion; para reservar si necesitara cuenta).
const profesionalModel = require("../models/profesional.model");
const disponibilidad = require("../services/disponibilidad.service");
const { reglasAgenda } = require("../models/configuracion.model");
const { ahoraChile } = require("../utils/fechas");
const citaModel = require("../models/cita.model");

/** ?excluir=NS-... : al cambiar de hora, la cita propia no bloquea su horario */
function idExcluido(req) {
  const codigo = req.query.excluir;
  if (!codigo || !/^NS-\d{6}-[0-9A-F]{4}$/.test(codigo)) return undefined;
  return citaModel.obtenerPorCodigo(codigo)?.id_cita;
}

/** GET /api/agenda/reglas — abono, 48 horas, etc. (para mostrarlas en la reserva) */
function reglas(req, res) {
  return res.json({ reglas: reglasAgenda(), hoy: ahoraChile().fecha });
}

/** GET /api/agenda/profesionales?id_servicio= */
function profesionalesPorServicio(req, res) {
  const datos = profesionalModel
    .listarPorServicio(Number(req.query.id_servicio))
    .map((p) => ({
      id_profesional: p.id_profesional,
      nombre: `${p.nombres} ${p.apellidos}`,
      descripcion: p.descripcion,
    }));
  return res.json({ datos });
}

/** GET /api/agenda/horas-libres?id_servicio=&fecha=AAAA-MM-DD&id_profesional= */
async function horasLibres(req, res) {
  const resultado = await disponibilidad.horasLibres({
    id_servicio: Number(req.query.id_servicio),
    fecha: req.query.fecha,
    id_profesional: req.query.id_profesional ? Number(req.query.id_profesional) : undefined,
    excluirIdCita: idExcluido(req),
  });
  return res.json(resultado);
}

/** GET /api/agenda/dias-disponibles?id_servicio=&id_profesional=&desde=&dias=14 */
async function diasDisponibles(req, res) {
  const datos = await disponibilidad.diasDisponibles({
    id_servicio: Number(req.query.id_servicio),
    id_profesional: req.query.id_profesional ? Number(req.query.id_profesional) : undefined,
    desde: req.query.desde,
    dias: req.query.dias ? Number(req.query.dias) : 14,
    excluirIdCita: idExcluido(req),
  });
  return res.json({ datos });
}

module.exports = { reglas, profesionalesPorServicio, horasLibres, diasDisponibles };
