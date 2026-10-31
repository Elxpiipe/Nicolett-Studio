// src/models/pago.model.js
// Pagos del abono. Aprobar un abono confirma la cita en la misma transaccion.
const db = require("../../db/connection");

/** Guarda el token de Webpay en el pago y extiende el plazo de la cita mientras paga */
const registrarInicioWebpay = db.transaction(async (id_pago, id_cita, token, fecha_expiracion_abono) => {
  await db.prepare(
    `UPDATE pagos SET id_transaccion_externa = ?, estado = 'PENDIENTE', detalle_pasarela = NULL
     WHERE id_pago = ?`
  ).run(token, id_pago);
  await db.prepare(`UPDATE citas SET fecha_expiracion_abono = ? WHERE id_cita = ?`).run(fecha_expiracion_abono, id_cita);
});

/** Pago por token de Webpay. Sirve para abonos (cita) y compras de la tienda (venta). */
async function obtenerPorToken(token) {
  return db
    .prepare(
      `SELECT pg.*, c.codigo_cita, c.estado AS estado_cita, v.codigo_venta, v.estado AS estado_venta
       FROM pagos pg
       LEFT JOIN citas c ON c.id_cita = pg.id_cita
       LEFT JOIN ventas v ON v.id_venta = pg.id_venta
       WHERE pg.id_transaccion_externa = ?`
    )
    .get(token);
}

/** Guarda el token de Webpay de una compra de la tienda */
async function registrarInicioWebpayVenta(id_pago, token) {
  await db.prepare(
    `UPDATE pagos SET id_transaccion_externa = ?, estado = 'PENDIENTE', detalle_pasarela = NULL WHERE id_pago = ?`
  ).run(token, id_pago);
}

/**
 * Pago aprobado: el abono queda APROBADO y la cita CONFIRMADA (ya no vence).
 * Si la cita alcanzo a cancelarse por plazo vencido, se reactiva (quien llama
 * ya verifico que la hora sigue libre).
 */
const aprobarAbono = db.transaction(async (id_pago, id_cita, detalle) => {
  await db.prepare(
    `UPDATE pagos SET estado = 'APROBADO', detalle_pasarela = ?, fecha_pago = fecha_actual_utc()
     WHERE id_pago = ?`
  ).run(JSON.stringify(detalle), id_pago);
  await db.prepare(
    `UPDATE citas SET estado = 'CONFIRMADA', fecha_expiracion_abono = NULL,
       fecha_cancelacion = NULL, motivo_cancelacion = NULL
     WHERE id_cita = ?`
  ).run(id_cita);
});

/**
 * Caso muy raro: el banco aprobo el abono, pero el plazo ya habia vencido y otra
 * clienta tomo la hora. El pago queda APROBADO (el dinero se cobro) y la cita
 * CANCELADA con un motivo claro, para que la administracion reagende o devuelva.
 */
const registrarAbonoFueraDePlazo = db.transaction(async (id_pago, id_cita, detalle) => {
  await db.prepare(
    `UPDATE pagos SET estado = 'APROBADO', detalle_pasarela = ?, fecha_pago = fecha_actual_utc()
     WHERE id_pago = ?`
  ).run(JSON.stringify(detalle), id_pago);
  await db.prepare(
    `UPDATE citas SET estado = 'CANCELADA', fecha_cancelacion = fecha_actual_utc(),
       motivo_cancelacion = 'Abono pagado fuera de plazo y la hora ya estaba tomada: reagendar o devolver'
     WHERE id_cita = ?`
  ).run(id_cita);
});

/** Pago rechazado por el banco: la cita sigue pendiente hasta que venza su plazo */
async function rechazarPago(id_pago, detalle) {
  await db.prepare(`UPDATE pagos SET estado = 'RECHAZADO', detalle_pasarela = ? WHERE id_pago = ?`).run(
    JSON.stringify(detalle),
    id_pago
  );
}

module.exports = {
  registrarInicioWebpay,
  registrarInicioWebpayVenta,
  obtenerPorToken,
  aprobarAbono,
  registrarAbonoFueraDePlazo,
  rechazarPago,
};