// src/controllers/pagos.controller.js
const webpay = require("../services/webpay.service");
const citaModel = require("../models/cita.model");
const db = require("../../db/connection");
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
  // Reservas hechas por WhatsApp: la clienta esta en el celular, sin sesion en la
  // pagina. Se le muestra una pagina simple y el detalle le llega por el chat.
  const url = new URL(destino);
  const codigo = url.searchParams.get("codigo") || "";
  if (codigo.startsWith("NS-")) {
    const fila = await db.prepare(`SELECT origen FROM citas WHERE codigo_cita = ?`).get(codigo);
    if (fila?.origen === "WHATSAPP") {
      // Aviso directo por WhatsApp (si ya salio desde notificaciones, no se repite)
      if (url.searchParams.get("estado") === "aprobado") {
        require("../whatsapp/avisos").notificarEnSegundoPlano("reservaConfirmada", codigo);
      }
      return res.redirect(303, `/api/whatsapp/pago-resultado?estado=${encodeURIComponent(url.searchParams.get("estado") || "")}`);
    }
  }
  return res.redirect(303, destino);
}

module.exports = { iniciarWebpay, retornoWebpay };