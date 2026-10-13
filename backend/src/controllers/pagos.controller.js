// src/controllers/pagos.controller.js
const webpay = require("../services/webpay.service");

/** POST /api/pagos/webpay/iniciar  { codigo_cita } -> { url, token } */
async function iniciarWebpay(req, res) {
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