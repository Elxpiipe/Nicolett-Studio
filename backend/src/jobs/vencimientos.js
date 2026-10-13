// src/jobs/vencimientos.js
// Cada minuto cancela las reservas PENDIENTE_ABONO cuyo plazo para pagar vencio
// (15 min en Webpay, 2 horas por transferencia) y anula su pago pendiente.
// Despues sincroniza las citas con Google Calendar.
// La hora ya se liberaba sola en la disponibilidad; esto deja el estado ordenado
// para el panel y para "Mis citas".
const db = require("../../db/connection");
const { ahoraChile } = require("../utils/fechas");
const calendarioCitas = require("../services/calendarioCitas.service");
const ventaModel = require("../models/venta.model");

const MOTIVO_VENCIDA = "Plazo de abono vencido";

const vencerPendientes = db.transaction((ahora) => {
  const vencidas = db
    .prepare(
      `SELECT id_cita, codigo_cita FROM citas
       WHERE estado = 'PENDIENTE_ABONO'
         AND fecha_expiracion_abono IS NOT NULL AND fecha_expiracion_abono <= ?`
    )
    .all(ahora);
  const cancelarCita = db.prepare(
    `UPDATE citas SET estado = 'CANCELADA', fecha_cancelacion = CURRENT_TIMESTAMP,
       motivo_cancelacion = ? WHERE id_cita = ?`
  );
  const anularPago = db.prepare(
    `UPDATE pagos SET estado = 'ANULADO'
     WHERE id_cita = ? AND tipo_pago = 'ABONO_CITA' AND estado IN ('PENDIENTE','RECHAZADO')`
  );
  for (const c of vencidas) {
    cancelarCita.run(MOTIVO_VENCIDA, c.id_cita);
    anularPago.run(c.id_cita);
  }
  return vencidas.map((c) => c.codigo_cita);
});

function revisar() {
  try {
    const codigos = vencerPendientes(ahoraChile().texto);
    if (codigos.length) console.log(`Reservas vencidas por falta de abono: ${codigos.join(", ")}`);
    const pedidos = ventaModel.vencerPendientes(ahoraChile().texto); // devuelve el stock apartado
    if (pedidos.length) console.log(`Pedidos vencidos sin pago (stock devuelto): ${pedidos.join(", ")}`);
  } catch (err) {
    console.error("Error al revisar reservas vencidas:", err.message);
  }
  // Refleja los cambios en Google Calendar y reintenta lo que haya fallado antes
  calendarioCitas.sincronizar().catch((err) => console.error("[Google Calendar]", err.message));
}

function iniciarVencimientos() {
  revisar(); // al arrancar el servidor
  setInterval(revisar, 60 * 1000); // y luego cada minuto
}

module.exports = { iniciarVencimientos, vencerPendientes, MOTIVO_VENCIDA };