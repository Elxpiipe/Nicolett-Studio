// src/controllers/reservas.controller.js
const reservas = require("../services/reservas.service");
const citaModel = require("../models/cita.model");

/** POST /api/reservas — la clienta aparta una hora (queda esperando el abono) */
async function crear(req, res) {
  const cita = await reservas.crearReserva({
    id_usuario: req.usuario.id_usuario,
    id_servicio: Number(req.body.id_servicio),
    fecha: req.body.fecha,
    hora: req.body.hora,
    id_profesional: req.body.id_profesional ? Number(req.body.id_profesional) : undefined,
    id_variante: req.body.id_variante ? Number(req.body.id_variante) : undefined,
    metodo_abono: req.body.metodo_abono,
    notas: req.body.notas,
  });
  return res.status(201).json({ reserva: reservas.vistaPublica(cita) });
}

/** GET /api/reservas?estado=&metodo_abono=&desde=&hasta= — panel (Administrador) */
function listar(req, res) {
  const datos = citaModel
    .listar({
      estado: req.query.estado,
      metodo_abono: req.query.metodo_abono,
      desde: req.query.desde,
      hasta: req.query.hasta,
    })
    .map(reservas.vistaAdmin);
  return res.json({ datos });
}

/** GET /api/reservas/:codigo — solo la duena de la reserva o un Administrador */
function obtener(req, res) {
  const cita = citaModel.obtenerPorCodigo(req.params.codigo);
  const esAdmin = req.usuario.rol === "Administrador";
  const esSuya = cita && cita.id_cliente === citaModel.clienteDeUsuario(req.usuario.id_usuario);
  if (!cita || (!esAdmin && !esSuya)) {
    return res.status(404).json({ error: "Reserva no encontrada" });
  }
  return res.json({ reserva: esAdmin ? reservas.vistaAdmin(cita) : reservas.vistaPublica(cita) });
}

/** POST /api/reservas/:codigo/confirmar-abono { referencia } — llego la transferencia */
function confirmarAbono(req, res) {
  const cita = reservas.confirmarTransferencia(req.params.codigo, req.usuario.id_usuario, req.body.referencia);
  return res.json({ reserva: reservas.vistaAdmin(cita) });
}

/** GET /api/reservas/mias — proximas e historial de la clienta con sesion */
function mias(req, res) {
  return res.json(reservas.misCitas(req.usuario.id_usuario));
}

/** POST /api/reservas/:codigo/reagendar { fecha, hora, id_profesional? } — la duena, 48 h antes */
async function reagendar(req, res) {
  const cita = await reservas.reagendar(req.params.codigo, req.usuario.id_usuario, {
    fecha: req.body.fecha,
    hora: req.body.hora,
    id_profesional: req.body.id_profesional ? Number(req.body.id_profesional) : undefined,
  });
  return res.json({ reserva: reservas.vistaPublica(cita) });
}

/** POST /api/reservas/:codigo/cancelar — la duena (el abono pagado no se devuelve) */
function cancelar(req, res) {
  return res.json({ reserva: reservas.vistaPublica(reservas.cancelar(req.params.codigo, req.usuario.id_usuario)) });
}

/** GET /api/reservas/agenda?fecha=&id_profesional= — Admin (todas) / Profesional (la suya) */
function agenda(req, res) {
  const fecha = req.query.fecha || require("../utils/fechas").ahoraChile().fecha;
  return res.json(
    reservas.agendaDelDia(req.usuario, fecha, req.query.id_profesional ? Number(req.query.id_profesional) : undefined)
  );
}

/** POST /api/reservas/:codigo/atencion { estado: ATENDIDA|NO_ASISTE|CONFIRMADA, observaciones } */
function atencion(req, res) {
  return res.json({
    reserva: reservas.marcarAtencion(req.params.codigo, req.usuario, req.body.estado, req.body.observaciones),
  });
}

module.exports = { crear, listar, obtener, confirmarAbono, mias, reagendar, cancelar, agenda, atencion };