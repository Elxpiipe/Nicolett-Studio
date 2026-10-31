// src/controllers/pagos.controller.js
const webpay = require("../services/webpay.service");
const citaModel = require("../models/cita.model");
const { creadoEnSesion } = require("../middleware/auth.middleware");

/** POST /api/pagos/webpay/iniciar  { codigo_cita } -> { url, token } */
async function iniciarWebpay(req, res) {
  // Una invitada solo puede pagar la reserva que creo en esta sesion
  const cita = await citaModel.obtenerPorCodigo(req.body.codigo_cita);
  if (cita && !creadoEnSesion(req.usuario, cita.fecha_creacion)) {
    return res.status(404).json({ error: "Reserva no encontrada" });
  }
  const datos = await webpay.iniciarPago(req.body.codigo_cita, req.usuario.id_usuario);
  return res.json(datos);
}

/** GET o POST /api/pagos/webpay/retorno — aqui vuelve la clienta desde Webpay */
async function retornoWebpay(req, res) {
  const datos = { ...req.query, ...req.body };
  const destino = await webpay.procesarRetorno(datos);
  return res.redirect(303, destino);
}

module.exports = { iniciarWebpay, retornoWebpay };