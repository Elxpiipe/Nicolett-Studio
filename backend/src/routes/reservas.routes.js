// src/routes/reservas.routes.js — reservas (clienta) y su gestion (Administrador)
const { Router } = require("express");
const { body, param, query, validationResult } = require("express-validator");
const ctrl = require("../controllers/reservas.controller");
const { requiereAutenticacion, requiereRol } = require("../middleware/auth.middleware");
const asincrono = require("../utils/asincrono");

function manejarErrores(req, res, next) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({
      error: "Datos invalidos",
      detalles: errores.array().map((e) => ({ campo: e.path, mensaje: e.msg })),
    });
  }
  next();
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ESTADOS = ["PENDIENTE_ABONO", "CONFIRMADA", "ATENDIDA", "CANCELADA", "NO_ASISTE"];

const validarCrearReserva = [
  body("id_servicio").isInt({ min: 1 }).withMessage("Servicio invalido"),
  body("id_variante").optional({ values: "falsy" }).isInt({ min: 1 }),
  body("fecha").matches(FECHA).withMessage("La fecha debe tener formato AAAA-MM-DD"),
  body("hora").matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage("La hora debe tener formato HH:MM"),
  body("id_profesional").optional({ values: "falsy" }).isInt({ min: 1 }).withMessage("Profesional invalida"),
  body("metodo_abono").isIn(["WEBPAY", "TRANSFERENCIA"]).withMessage("Elige Webpay o transferencia"),
  body("notas").optional({ values: "falsy" }).trim().isLength({ max: 300 }),
  manejarErrores,
];

const validarListado = [
  query("estado").optional({ values: "falsy" }).isIn(ESTADOS).withMessage("Estado invalido"),
  query("metodo_abono").optional({ values: "falsy" }).isIn(["WEBPAY", "TRANSFERENCIA"]),
  query("desde").optional({ values: "falsy" }).matches(FECHA),
  query("hasta").optional({ values: "falsy" }).matches(FECHA),
  manejarErrores,
];

const validarCodigo = [
  param("codigo").matches(/^NS-\d{6}-[0-9A-F]{4}$/).withMessage("Codigo de reserva invalido"),
  manejarErrores,
];

const router = Router();
const soloAdmin = requiereRol("Administrador");

router.post("/", requiereAutenticacion, requiereRol("Cliente"), validarCrearReserva, asincrono(ctrl.crear));
router.get("/", requiereAutenticacion, soloAdmin, validarListado, ctrl.listar);
// Agenda del dia (antes de "/:codigo")
router.get(
  "/agenda",
  requiereAutenticacion,
  requiereRol("Administrador", "Profesional"),
  query("fecha").optional({ values: "falsy" }).matches(FECHA).withMessage("La fecha debe tener formato AAAA-MM-DD"),
  query("id_profesional").optional({ values: "falsy" }).isInt({ min: 1 }),
  manejarErrores,
  ctrl.agenda
);
router.post(
  "/:codigo/atencion",
  requiereAutenticacion,
  requiereRol("Administrador", "Profesional"),
  validarCodigo,
  body("estado").isIn(["ATENDIDA", "NO_ASISTE", "CONFIRMADA"]).withMessage("Estado inválido"),
  body("observaciones").optional({ values: "falsy" }).trim().isLength({ max: 1000 }),
  manejarErrores,
  ctrl.atencion
);

// "/mias" va antes de "/:codigo" para que no se lea como un codigo
router.get("/mias", requiereAutenticacion, requiereRol("Cliente"), ctrl.mias);
router.get("/:codigo", requiereAutenticacion, validarCodigo, ctrl.obtener);
router.post(
  "/:codigo/reagendar",
  requiereAutenticacion,
  requiereRol("Cliente"),
  validarCodigo,
  body("fecha").matches(FECHA).withMessage("La fecha debe tener formato AAAA-MM-DD"),
  body("hora").matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage("La hora debe tener formato HH:MM"),
  body("id_profesional").optional({ values: "falsy" }).isInt({ min: 1 }),
  manejarErrores,
  asincrono(ctrl.reagendar)
);
router.post("/:codigo/cancelar", requiereAutenticacion, requiereRol("Cliente"), validarCodigo, ctrl.cancelar);
router.post(
  "/:codigo/confirmar-abono",
  requiereAutenticacion,
  soloAdmin,
  validarCodigo,
  body("referencia").optional({ values: "falsy" }).trim().isLength({ max: 100 }),
  manejarErrores,
  ctrl.confirmarAbono
);

module.exports = router;