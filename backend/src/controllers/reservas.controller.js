// src/controllers/reservas.controller.js
const { creadoEnSesion } = require("../middleware/auth.middleware");
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
  return res.status(201).json({ reserva: await reservas.vistaPublica(cita) });
}

/** GET /api/reservas?estado=&metodo_abono=&desde=&hasta= — panel (Administrador) */
async function listar(req, res) {
  const citas = await citaModel.listar({
    estado: req.query.estado,
    metodo_abono: req.query.metodo_abono,
    desde: req.query.desde,
    hasta: req.query.hasta,
  });
  const datos = await Promise.all(citas.map(reservas.vistaAdmin));
  return res.json({ datos });
}

/** GET /api/reservas/:codigo — solo la duena de la reserva o un Administrador */
async function obtener(req, res) {
  const cita = await citaModel.obtenerPorCodigo(req.params.codigo);
  const esAdmin = req.usuario.rol === "Administrador";
  const esSuya =
    cita &&
    cita.id_cliente === await citaModel.clienteDeUsuario(req.usuario.id_usuario) &&
    creadoEnSesion(req.usuario, cita.fecha_creacion);
  if (!cita || (!esAdmin && !esSuya)) {
    return res.status(404).json({ error: "Reserva no encontrada" });
  }
  return res.json({ reserva: esAdmin ? await reservas.vistaAdmin(cita) : await reservas.vistaPublica(cita) });
}

/** POST /api/reservas/:codigo/confirmar-abono { referencia } — llego la transferencia */
async function confirmarAbono(req, res) {
  const cita = await reservas.confirmarTransferencia(req.params.codigo, req.usuario.id_usuario, req.body.referencia);
  return res.json({ reserva: await reservas.vistaAdmin(cita) });
}

/** GET /api/reservas/mias — proximas e historial de la clienta con sesion */
async function mias(req, res) {
  return res.json(await reservas.misCitas(req.usuario.id_usuario));
}

/** POST /api/reservas/:codigo/reagendar { fecha, hora, id_profesional? } — la duena, 48 h antes */
async function reagendar(req, res) {
  const cita = await reservas.reagendar(req.params.codigo, req.usuario.id_usuario, {
    fecha: req.body.fecha,
    hora: req.body.hora,
    id_profesional: req.body.id_profesional ? Number(req.body.id_profesional) : undefined,
  });
  return res.json({ reserva: await reservas.vistaPublica(cita) });
}

/** POST /api/reservas/:codigo/cancelar — la duena (el abono pagado no se devuelve) */
async function cancelar(req, res) {
  return res.json({ reserva: await reservas.vistaPublica(await reservas.cancelar(req.params.codigo, req.usuario.id_usuario)) });
}

/** GET /api/reservas/agenda?fecha=&id_profesional= — Admin (todas) / Profesional (la suya) */
async function agenda(req, res) {
  const fecha = req.query.fecha || require("../utils/fechas").ahoraChile().fecha;
  return res.json(
    await reservas.agendaDelDia(req.usuario, fecha, req.query.id_profesional ? Number(req.query.id_profesional) : undefined)
  );
}

/** POST /api/reservas/:codigo/atencion { estado: ATENDIDA|NO_ASISTE|CONFIRMADA, observaciones } */
async function atencion(req, res) {
  return res.json({
    reserva: await reservas.marcarAtencion(req.params.codigo, req.usuario, req.body.estado, req.body.observaciones),
  });
}

module.exports = { crear, listar, obtener, confirmarAbono, mias, reagendar, cancelar, agenda, atencion };