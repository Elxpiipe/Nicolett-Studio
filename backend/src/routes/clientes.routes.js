// src/routes/clientes.routes.js — historial de clientas (solo Administradora)
const { Router } = require("express");
const { param, query } = require("express-validator");
const db = require("../../db/connection");
const citaModel = require("../models/cita.model");
const ventaModel = require("../models/venta.model");
const reservas = require("../services/reservas.service");
const { requiereAutenticacion, requiereRol } = require("../middleware/auth.middleware");
const { manejarErrores } = require("./tienda.routes");

const router = Router();
router.use(requiereAutenticacion, requiereRol("Administrador"));

/**
 * GET /api/clientes?busqueda= — listado de clientas con un resumen corto,
 * ordenado por nombre.
 */
router.get(
  "/",
  query("busqueda").optional({ values: "falsy" }).trim().isLength({ max: 80 }),
  manejarErrores,
  (req, res) => {
    const filtro = req.query.busqueda ? `%${req.query.busqueda}%` : null;
    const datos = db
      .prepare(
        `SELECT c.id_cliente, u.nombres, u.apellidos, u.email, u.telefono, u.activo,
                COUNT(ci.id_cita) AS total_citas,
                SUM(ci.estado = 'ATENDIDA') AS atendidas,
                MAX(CASE WHEN ci.estado IN ('ATENDIDA','CONFIRMADA') THEN ci.fecha_hora_inicio END) AS ultima_cita
         FROM clientes c
         JOIN usuarios u ON u.id_usuario = c.id_usuario
         LEFT JOIN citas ci ON ci.id_cliente = c.id_cliente
         WHERE (@filtro IS NULL OR u.nombres || ' ' || u.apellidos LIKE @filtro OR u.email LIKE @filtro OR u.telefono LIKE @filtro)
         GROUP BY c.id_cliente
         ORDER BY u.nombres COLLATE NOCASE, u.apellidos COLLATE NOCASE
         LIMIT 500`
      )
      .all({ filtro });
    return res.json({ datos });
  }
);

/** GET /api/clientes/:id — ficha de la clienta: datos, resumen, citas y compras */
router.get("/:id", param("id").isInt({ min: 1 }), manejarErrores, (req, res) => {
  const id_cliente = Number(req.params.id);
  const cliente = db
    .prepare(
      `SELECT c.id_cliente, c.fecha_nacimiento, c.preferencias, u.nombres, u.apellidos, u.email, u.telefono,
              u.activo, u.fecha_creacion
       FROM clientes c JOIN usuarios u ON u.id_usuario = c.id_usuario WHERE c.id_cliente = ?`
    )
    .get(id_cliente);
  if (!cliente) return res.status(404).json({ error: "Clienta no encontrada" });

  const citas = citaModel.listarDeCliente(id_cliente).map((c) => ({
    ...reservas.vistaPublica(c),
    observaciones: c.observaciones,
    fecha_atencion: c.fecha_atencion,
  }));
  const pedidos = ventaModel
    .listarDeCliente(id_cliente)
    .filter((v) => v.estado === "PAGADA")
    .map((v) => ({ codigo_venta: v.codigo_venta, fecha: v.fecha_pago || v.fecha, total: v.total, items: v.items, fecha_entrega: v.fecha_entrega }));

  const atendidas = citas.filter((c) => c.estado === "ATENDIDA");
  const resumen = {
    total_citas: citas.length,
    atendidas: atendidas.length,
    no_asistio: citas.filter((c) => c.estado === "NO_ASISTE").length,
    canceladas: citas.filter((c) => c.estado === "CANCELADA").length,
    proximas: citas.filter((c) => ["CONFIRMADA", "PENDIENTE_ABONO"].includes(c.estado) && !c.pasada && !c.vencida).length,
    // Total en servicios atendidos + compras pagadas en la tienda
    total_servicios: atendidas.reduce((s, c) => s + (c.precio || 0), 0),
    total_tienda: pedidos.reduce((s, p) => s + p.total, 0),
    servicio_favorito: (() => {
      const conteo = {};
      for (const c of atendidas) conteo[c.servicio] = (conteo[c.servicio] || 0) + 1;
      return Object.entries(conteo).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    })(),
  };
  return res.json({ cliente, resumen, citas, pedidos });
});

module.exports = router;
