// src/models/configuracion.model.js
// Lee y guarda parametros de la tabla configuracion_sistema (abono, 48 horas, Google, etc.)
const db = require("../../db/connection");

async function obtenerTexto(clave, porDefecto = "") {
  const fila = await db.prepare(`SELECT valor FROM configuracion_sistema WHERE clave = ?`).get(clave);
  return fila ? fila.valor : porDefecto;
}

async function obtenerNumero(clave, porDefecto) {
  const numero = Number(await obtenerTexto(clave, NaN));
  return Number.isFinite(numero) ? numero : porDefecto;
}

async function guardarValor(clave, valor) {
  await db.prepare(
    `INSERT INTO configuracion_sistema (clave, valor) VALUES (?, ?)
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`
  ).run(clave, String(valor ?? ""));
}

async function reglasAgenda() {
  return {
    abono: await obtenerNumero("ABONO_CITA", 5000),
    horasCambio: await obtenerNumero("HORAS_CANCELACION", 48),
    horasRetencionTransferencia: await obtenerNumero("HORAS_RETENCION_TRANSFERENCIA", 2),
    minutosRetencionWebpay: await obtenerNumero("MINUTOS_RETENCION_WEBPAY", 15),
    abonoReembolsable: (await obtenerNumero("ABONO_REEMBOLSABLE", 0)) === 1,
    intervaloMin: await obtenerNumero("INTERVALO_AGENDA_MIN", 30),
    anticipacionMinimaMin: await obtenerNumero("ANTICIPACION_MINIMA_MIN", 60),
    diasMaximosReserva: await obtenerNumero("DIAS_MAXIMOS_RESERVA", 60),
  };
}

module.exports = { obtenerTexto, obtenerNumero, guardarValor, reglasAgenda };
