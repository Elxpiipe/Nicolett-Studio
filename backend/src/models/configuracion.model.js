// src/models/configuracion.model.js
// Lee y guarda parametros de la tabla configuracion_sistema (abono, 48 horas, Google, etc.)
const db = require("../../db/connection");

function obtenerTexto(clave, porDefecto = "") {
  const fila = db.prepare(`SELECT valor FROM configuracion_sistema WHERE clave = ?`).get(clave);
  return fila ? fila.valor : porDefecto;
}

function obtenerNumero(clave, porDefecto) {
  const numero = Number(obtenerTexto(clave, NaN));
  return Number.isFinite(numero) ? numero : porDefecto;
}

function guardarValor(clave, valor) {
  db.prepare(
    `INSERT INTO configuracion_sistema (clave, valor) VALUES (?, ?)
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`
  ).run(clave, String(valor ?? ""));
}

function reglasAgenda() {
  return {
    abono: obtenerNumero("ABONO_CITA", 5000),
    horasCambio: obtenerNumero("HORAS_CANCELACION", 48),
    horasRetencionTransferencia: obtenerNumero("HORAS_RETENCION_TRANSFERENCIA", 2),
    minutosRetencionWebpay: obtenerNumero("MINUTOS_RETENCION_WEBPAY", 15),
    abonoReembolsable: obtenerNumero("ABONO_REEMBOLSABLE", 0) === 1,
    intervaloMin: obtenerNumero("INTERVALO_AGENDA_MIN", 30),
    anticipacionMinimaMin: obtenerNumero("ANTICIPACION_MINIMA_MIN", 60),
    diasMaximosReserva: obtenerNumero("DIAS_MAXIMOS_RESERVA", 60),
  };
}

module.exports = { obtenerTexto, obtenerNumero, guardarValor, reglasAgenda };
