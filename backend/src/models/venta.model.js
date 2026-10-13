// src/models/venta.model.js
// Pedidos de la tienda web. El stock se APARTA (se descuenta) al crear el pedido,
// dentro de la misma transaccion que valida que alcance: asi nunca se venden
// dos veces las ultimas unidades. Si el pago no llega a tiempo, se devuelve.
const crypto = require("crypto");
const db = require("../../db/connection");
const { ahoraChile } = require("../utils/fechas");

function errorHttp(status, mensaje) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

function generarCodigo(fecha) {
  const existe = db.prepare(`SELECT 1 FROM ventas WHERE codigo_venta = ?`);
  const base = `NV-${fecha.slice(2).replace(/-/g, "")}-`;
  for (;;) {
    const codigo = base + crypto.randomBytes(2).toString("hex").toUpperCase();
    if (!existe.get(codigo)) return codigo;
  }
}

/** Devuelve el stock apartado de un pedido y lo anula (sin tocar si ya estaba pagado) */
const anular = db.transaction((id_venta, motivo) => {
  const venta = db.prepare(`SELECT * FROM ventas WHERE id_venta = ?`).get(id_venta);
  if (!venta || venta.estado !== "PENDIENTE") return false;
  if (venta.stock_reservado) {
    const items = db
      .prepare(`SELECT id_producto, cantidad FROM venta_detalle WHERE id_venta = ? AND tipo_item = 'PRODUCTO'`)
      .all(id_venta);
    const devolver = db.prepare(`UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?`);
    for (const it of items) devolver.run(it.cantidad, it.id_producto);
  }
  db.prepare(
    `UPDATE ventas SET estado = 'ANULADA', stock_reservado = 0, motivo_anulacion = ? WHERE id_venta = ?`
  ).run(motivo, id_venta);
  db.prepare(
    `UPDATE pagos SET estado = 'ANULADO' WHERE id_venta = ? AND tipo_pago = 'PAGO_VENTA' AND estado IN ('PENDIENTE','RECHAZADO')`
  ).run(id_venta);
  return true;
});

/**
 * Crea el pedido web: valida productos y stock, aparta el stock, guarda el
 * detalle y deja el pago PENDIENTE. Todo o nada.
 * datos = { id_cliente, id_usuario, items: [{ id_producto, cantidad }], notas, fecha_expiracion_pago }
 */
const crearPedidoWeb = db.transaction((d) => {
  // Si la clienta tenia otro pedido sin pagar, se reemplaza (devuelve su stock)
  const anteriores = db
    .prepare(`SELECT id_venta FROM ventas WHERE id_cliente = ? AND canal = 'WEB' AND estado = 'PENDIENTE'`)
    .all(d.id_cliente);
  for (const a of anteriores) anular(a.id_venta, "Reemplazado por un pedido nuevo");

  const lineas = [];
  for (const item of d.items) {
    const p = db
      .prepare(
        `SELECT id_producto, nombre, marca, precio_venta, CAST(stock_actual AS INTEGER) AS stock, activo
         FROM productos WHERE id_producto = ?`
      )
      .get(item.id_producto);
    if (!p || !p.activo || p.precio_venta == null) throw errorHttp(409, "Un producto del carrito ya no está disponible.");
    if (p.stock < item.cantidad) {
      throw errorHttp(
        409,
        p.stock > 0
          ? `Solo quedan ${p.stock} unidad(es) de ${p.nombre}. Ajusta la cantidad.`
          : `${p.nombre} se agotó. Quítalo del carrito para continuar.`
      );
    }
    lineas.push({ ...p, cantidad: item.cantidad, subtotal: p.precio_venta * item.cantidad });
  }

  const total = lineas.reduce((suma, l) => suma + l.subtotal, 0);
  const codigo = generarCodigo(ahoraChile().fecha);
  const { lastInsertRowid: id_venta } = db
    .prepare(
      `INSERT INTO ventas (id_cliente, id_usuario_cajero, subtotal, descuento, total, estado,
                           codigo_venta, canal, fecha_expiracion_pago, stock_reservado, notas)
       VALUES (?, ?, ?, 0, ?, 'PENDIENTE', ?, 'WEB', ?, 1, ?)`
    )
    .run(d.id_cliente, d.id_usuario, total, total, codigo, d.fecha_expiracion_pago, d.notas || null);

  const insertarDetalle = db.prepare(
    `INSERT INTO venta_detalle (id_venta, tipo_item, id_producto, descripcion, cantidad, precio_unitario, subtotal)
     VALUES (?, 'PRODUCTO', ?, ?, ?, ?, ?)`
  );
  const apartar = db.prepare(`UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?`);
  for (const l of lineas) {
    const descripcion = l.marca ? `${l.nombre} (${l.marca})` : l.nombre;
    insertarDetalle.run(id_venta, l.id_producto, descripcion, l.cantidad, l.precio_venta, l.subtotal);
    apartar.run(l.cantidad, l.id_producto);
  }

  db.prepare(
    `INSERT INTO pagos (id_venta, tipo_pago, monto, metodo_pago, estado) VALUES (?, 'PAGO_VENTA', ?, 'PASARELA_WEB', 'PENDIENTE')`
  ).run(id_venta, total);

  return codigo;
});

/** Registra las salidas de inventario de un pedido pagado */
function registrarSalidas(id_venta, id_usuario) {
  const items = db
    .prepare(`SELECT id_producto, cantidad FROM venta_detalle WHERE id_venta = ? AND tipo_item = 'PRODUCTO'`)
    .all(id_venta);
  const mov = db.prepare(
    `INSERT INTO movimientos_inventario (id_producto, tipo, cantidad, motivo, id_usuario, id_venta)
     VALUES (?, 'SALIDA_VENTA', ?, 'Venta web', ?, ?)`
  );
  for (const it of items) mov.run(it.id_producto, it.cantidad, id_usuario, id_venta);
}

/**
 * Pago aprobado. Si el pedido seguia PENDIENTE (stock apartado) queda PAGADA.
 * Si ya se habia anulado por tiempo (stock devuelto), se intenta apartar de
 * nuevo; si ya no hay stock, el pago queda registrado y el pedido en revision.
 * Devuelve "pagado" | "revision".
 */
const aprobarPago = db.transaction((id_pago, id_venta, detalle) => {
  const venta = db.prepare(`SELECT * FROM ventas WHERE id_venta = ?`).get(id_venta);
  db.prepare(
    `UPDATE pagos SET estado = 'APROBADO', detalle_pasarela = ?, fecha_pago = CURRENT_TIMESTAMP WHERE id_pago = ?`
  ).run(JSON.stringify(detalle), id_pago);

  if (venta.estado === "ANULADA") {
    const items = db
      .prepare(
        `SELECT d.id_producto, d.cantidad, CAST(p.stock_actual AS INTEGER) AS stock
         FROM venta_detalle d JOIN productos p ON p.id_producto = d.id_producto WHERE d.id_venta = ?`
      )
      .all(id_venta);
    if (items.some((i) => i.stock < i.cantidad)) {
      db.prepare(
        `UPDATE ventas SET motivo_anulacion = 'Pago recibido fuera de plazo y sin stock suficiente: reponer o devolver' WHERE id_venta = ?`
      ).run(id_venta);
      return "revision";
    }
    const apartar = db.prepare(`UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?`);
    for (const i of items) apartar.run(i.cantidad, i.id_producto);
  }

  db.prepare(
    `UPDATE ventas SET estado = 'PAGADA', stock_reservado = 0, fecha_expiracion_pago = NULL,
       fecha_pago = ?, motivo_anulacion = NULL WHERE id_venta = ?`
  ).run(ahoraChile().texto, id_venta);
  registrarSalidas(id_venta, venta.id_usuario_cajero);
  return "pagado";
});

function obtenerPorCodigo(codigo_venta) {
  const venta = db
    .prepare(
      `SELECT v.*, u.nombres || ' ' || u.apellidos AS cliente, u.email AS email_cliente, u.telefono AS telefono_cliente,
              pg.id_pago, pg.estado AS estado_pago
       FROM ventas v
       LEFT JOIN clientes c ON c.id_cliente = v.id_cliente
       LEFT JOIN usuarios u ON u.id_usuario = c.id_usuario
       LEFT JOIN pagos pg ON pg.id_venta = v.id_venta AND pg.tipo_pago = 'PAGO_VENTA'
       WHERE v.codigo_venta = ?
       ORDER BY pg.id_pago DESC LIMIT 1`
    )
    .get(codigo_venta);
  if (!venta) return null;
  venta.items = db
    .prepare(
      `SELECT d.id_producto, d.descripcion, CAST(d.cantidad AS INTEGER) AS cantidad, d.precio_unitario, d.subtotal, p.imagen_url
       FROM venta_detalle d LEFT JOIN productos p ON p.id_producto = d.id_producto WHERE d.id_venta = ?`
    )
    .all(venta.id_venta);
  return venta;
}

function listarWeb({ estado, entregada } = {}) {
  const cond = ["v.canal = 'WEB'"];
  const params = {};
  if (estado) {
    cond.push("v.estado = @estado");
    params.estado = estado;
  }
  if (entregada === "0") cond.push("v.fecha_entrega IS NULL");
  if (entregada === "1") cond.push("v.fecha_entrega IS NOT NULL");
  return db
    .prepare(`SELECT codigo_venta FROM ventas v WHERE ${cond.join(" AND ")} ORDER BY v.fecha DESC LIMIT 200`)
    .all(params)
    .map((f) => obtenerPorCodigo(f.codigo_venta));
}

/** Pedidos web de una clienta (mas nuevos primero) */
function listarDeCliente(id_cliente) {
  return db
    .prepare(
      `SELECT codigo_venta FROM ventas WHERE id_cliente = ? AND canal = 'WEB' ORDER BY fecha DESC, id_venta DESC LIMIT 100`
    )
    .all(id_cliente)
    .map((f) => obtenerPorCodigo(f.codigo_venta));
}

function marcarEntregada(id_venta) {
  db.prepare(`UPDATE ventas SET fecha_entrega = ? WHERE id_venta = ?`).run(ahoraChile().texto, id_venta);
}

function extenderPlazo(id_venta, fecha_expiracion_pago) {
  db.prepare(`UPDATE ventas SET fecha_expiracion_pago = ? WHERE id_venta = ?`).run(fecha_expiracion_pago, id_venta);
}

/** Pedidos web sin pagar cuyo plazo vencio (para la tarea de cada minuto) */
function vencerPendientes(ahora) {
  const vencidas = db
    .prepare(
      `SELECT id_venta, codigo_venta FROM ventas
       WHERE canal = 'WEB' AND estado = 'PENDIENTE' AND fecha_expiracion_pago IS NOT NULL AND fecha_expiracion_pago <= ?`
    )
    .all(ahora);
  for (const v of vencidas) anular(v.id_venta, "Plazo de pago vencido");
  return vencidas.map((v) => v.codigo_venta);
}

module.exports = {
  listarDeCliente,
  errorHttp,
  crearPedidoWeb,
  aprobarPago,
  anular,
  obtenerPorCodigo,
  listarWeb,
  marcarEntregada,
  extenderPlazo,
  vencerPendientes,
};
