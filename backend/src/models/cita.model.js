// src/models/cita.model.js
// Citas (reservas) y su abono. Toda la escritura de una reserva nueva se hace
// en una sola transaccion: cita + servicio de la cita + pago pendiente.
const crypto = require("crypto");
const db = require("../../db/connection");
const { ahoraChile } = require("../utils/fechas");

/** id_cliente del usuario con sesion (null si no es clienta) */
function clienteDeUsuario(id_usuario) {
  const fila = db.prepare(`SELECT id_cliente FROM clientes WHERE id_usuario = ?`).get(id_usuario);
  return fila ? fila.id_cliente : null;
}

/** Reserva PENDIENTE_ABONO de la clienta cuyo plazo de pago aun no vence */
function pendienteVigenteDeCliente(id_cliente) {
  return db
    .prepare(
      `SELECT codigo_cita, fecha_hora_inicio, metodo_abono, fecha_expiracion_abono
       FROM citas
       WHERE id_cliente = ? AND estado = 'PENDIENTE_ABONO'
         AND (fecha_expiracion_abono IS NULL OR fecha_expiracion_abono > ?)
       ORDER BY fecha_creacion DESC LIMIT 1`
    )
    .get(id_cliente, ahoraChile().texto);
}

/** Codigo corto y legible: NS-260930-K7Q2 (sirve tambien como orden de compra en Webpay) */
function generarCodigo(fecha) {
  const existe = db.prepare(`SELECT 1 FROM citas WHERE codigo_cita = ?`);
  const base = `NS-${fecha.slice(2).replace(/-/g, "")}-`;
  for (;;) {
    const codigo = base + crypto.randomBytes(3).toString("hex").slice(0, 4).toUpperCase();
    if (!existe.get(codigo)) return codigo;
  }
}

/**
 * Crea la cita PENDIENTE_ABONO, su servicio y el pago del abono (PENDIENTE).
 * La disponibilidad se valida ANTES en reservas.service.js, en el mismo bloque
 * sincronico, por lo que dos reservas no pueden tomar la misma hora.
 */
const crearReservaPendiente = db.transaction((d) => {
  const codigo = generarCodigo(d.fecha_hora_inicio.slice(0, 10));
  const { lastInsertRowid: id_cita } = db
    .prepare(
      `INSERT INTO citas (codigo_cita, id_cliente, id_profesional, fecha_hora_inicio, fecha_hora_fin,
                          estado, notas_cliente, metodo_abono, fecha_expiracion_abono)
       VALUES (?, ?, ?, ?, ?, 'PENDIENTE_ABONO', ?, ?, ?)`
    )
    .run(
      codigo,
      d.id_cliente,
      d.id_profesional,
      d.fecha_hora_inicio,
      d.fecha_hora_fin,
      d.notas || null,
      d.metodo_abono,
      d.fecha_expiracion_abono
    );

  db.prepare(
    `INSERT INTO cita_servicio (id_cita, id_servicio, precio_aplicado, duracion_minutos, id_variante, variante)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id_cita, d.id_servicio, d.precio, d.duracion, d.id_variante ?? null, d.variante ?? null);

  db.prepare(
    `INSERT INTO pagos (id_cita, tipo_pago, monto, metodo_pago, estado)
     VALUES (?, 'ABONO_CITA', ?, ?, 'PENDIENTE')`
  ).run(id_cita, d.monto_abono, d.metodo_abono === "WEBPAY" ? "PASARELA_WEB" : "TRANSFERENCIA");

  return codigo;
});

/** Detalle completo de una reserva, para la clienta y para el panel */
function obtenerPorCodigo(codigo_cita) {
  return db
    .prepare(
      `SELECT c.id_cita, c.codigo_cita, c.id_cliente, c.id_profesional,
              c.fecha_hora_inicio, c.fecha_hora_fin, c.estado, c.notas_cliente,
              c.metodo_abono, c.fecha_expiracion_abono, c.fecha_creacion,
              c.google_calendar_event_id, c.google_calendar_calendario, c.google_calendar_estado,
              c.motivo_cancelacion, c.veces_reagendada, c.fecha_cancelacion, s.id_categoria, cat.nombre AS categoria, cat.indicaciones,
              s.id_servicio, s.nombre || COALESCE(' · ' || cs.variante, '') AS servicio, cs.variante, s.tipo_precio,
              cs.precio_aplicado AS precio, cs.duracion_minutos, c.fecha_atencion,
              (SELECT a.observaciones FROM atenciones a WHERE a.id_cita = c.id_cita) AS observaciones,
              up.nombres || ' ' || up.apellidos AS profesional,
              uc.nombres || ' ' || uc.apellidos AS cliente, uc.email AS email_cliente,
              uc.telefono AS telefono_cliente,
              pg.id_pago, pg.monto AS monto_abono, pg.estado AS estado_abono
       FROM citas c
       JOIN cita_servicio cs ON cs.id_cita = c.id_cita
       JOIN servicios s ON s.id_servicio = cs.id_servicio
       JOIN categorias_servicio cat ON cat.id_categoria = s.id_categoria
       JOIN profesionales p ON p.id_profesional = c.id_profesional
       JOIN usuarios up ON up.id_usuario = p.id_usuario
       JOIN clientes cl ON cl.id_cliente = c.id_cliente
       JOIN usuarios uc ON uc.id_usuario = cl.id_usuario
       LEFT JOIN pagos pg ON pg.id_cita = c.id_cita AND pg.tipo_pago = 'ABONO_CITA'
       WHERE c.codigo_cita = ?
       ORDER BY pg.id_pago DESC LIMIT 1`
    )
    .get(codigo_cita);
}

/**
 * Listado para el panel de administracion.
 * filtros: { estado, metodo_abono, desde: 'AAAA-MM-DD', hasta: 'AAAA-MM-DD' }
 */
function listar({ estado, metodo_abono, desde, hasta } = {}) {
  const condiciones = [];
  const params = {};
  if (estado) {
    condiciones.push("c.estado = @estado");
    params.estado = estado;
  }
  if (metodo_abono) {
    condiciones.push("c.metodo_abono = @metodo_abono");
    params.metodo_abono = metodo_abono;
  }
  if (desde) {
    condiciones.push("c.fecha_hora_inicio >= @desde");
    params.desde = `${desde} 00:00`;
  }
  if (hasta) {
    condiciones.push("c.fecha_hora_inicio < @hasta");
    params.hasta = `${hasta} 24:00`;
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  return db
    .prepare(
      `SELECT c.codigo_cita FROM citas c ${where}
       ORDER BY c.fecha_hora_inicio ASC LIMIT 300`
    )
    .all(params)
    .map((f) => obtenerPorCodigo(f.codigo_cita));
}

/** Todas las citas de una clienta (proximas e historial) */
function listarDeCliente(id_cliente) {
  return db
    .prepare(`SELECT codigo_cita FROM citas WHERE id_cliente = ? ORDER BY fecha_hora_inicio DESC LIMIT 200`)
    .all(id_cliente)
    .map((f) => obtenerPorCodigo(f.codigo_cita));
}

/** Mueve la cita a otra hora (y posiblemente otra profesional) */
function moverCita(id_cita, { id_profesional, fecha_hora_inicio, fecha_hora_fin }) {
  db.prepare(
    `UPDATE citas SET id_profesional = ?, fecha_hora_inicio = ?, fecha_hora_fin = ?,
       veces_reagendada = veces_reagendada + 1
     WHERE id_cita = ?`
  ).run(id_profesional, fecha_hora_inicio, fecha_hora_fin, id_cita);
}

/** Cancela la cita. El abono pagado NO se devuelve (regla del salon). */
const cancelarPorCliente = db.transaction((id_cita, motivo) => {
  db.prepare(
    `UPDATE citas SET estado = 'CANCELADA', fecha_cancelacion = CURRENT_TIMESTAMP,
       motivo_cancelacion = ?, fecha_expiracion_abono = NULL
     WHERE id_cita = ?`
  ).run(motivo, id_cita);
  // Solo se anula un abono que nunca se pago
  db.prepare(
    `UPDATE pagos SET estado = 'ANULADO'
     WHERE id_cita = ? AND tipo_pago = 'ABONO_CITA' AND estado IN ('PENDIENTE','RECHAZADO')`
  ).run(id_cita);
});

/** Citas de un dia (para la agenda), sin canceladas ni pendientes vencidas */
function citasDelDia(fecha, id_profesional, ahora) {
  const cond = ["substr(c.fecha_hora_inicio, 1, 10) = @fecha", "c.estado <> 'CANCELADA'"];
  const params = { fecha, ahora };
  cond.push("NOT (c.estado = 'PENDIENTE_ABONO' AND c.fecha_expiracion_abono IS NOT NULL AND c.fecha_expiracion_abono <= @ahora)");
  if (id_profesional) {
    cond.push("c.id_profesional = @id_profesional");
    params.id_profesional = id_profesional;
  }
  return db
    .prepare(`SELECT codigo_cita FROM citas c WHERE ${cond.join(" AND ")} ORDER BY c.fecha_hora_inicio`)
    .all(params)
    .map((f) => obtenerPorCodigo(f.codigo_cita));
}

/**
 * Marca el resultado de la cita. ATENDIDA guarda observaciones en "atenciones";
 * CONFIRMADA deshace una marca equivocada.
 */
const registrarAtencion = db.transaction((id_cita, estado, observaciones, id_usuario, fecha) => {
  db.prepare(
    `UPDATE citas SET estado = ?, fecha_atencion = ?, id_usuario_atencion = ? WHERE id_cita = ?`
  ).run(estado, estado === "CONFIRMADA" ? null : fecha, estado === "CONFIRMADA" ? null : id_usuario, id_cita);
  if (estado === "ATENDIDA") {
    db.prepare(
      `INSERT INTO atenciones (id_cita, observaciones) VALUES (?, ?)
       ON CONFLICT(id_cita) DO UPDATE SET observaciones = excluded.observaciones`
    ).run(id_cita, observaciones || null);
  }
});

module.exports = {
  citasDelDia,
  registrarAtencion,
  listarDeCliente,
  moverCita,
  cancelarPorCliente,
  listar,
  clienteDeUsuario,
  pendienteVigenteDeCliente,
  crearReservaPendiente,
  obtenerPorCodigo,
};