// src/routes/pagos.routes.js — abono de reservas con Webpay Plus
const { Router } = require("express");
const { body, validationResult } = require("express-validator");
const ctrl = require("../controllers/pagos.controller");
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

const router = Router();

router.post(
  "/webpay/iniciar",
  requiereAutenticacion,
  requiereRol("Cliente"),
  body("codigo_cita").matches(/^NS-\d{6}-[0-9A-F]{4}$/).withMessage("Codigo de reserva invalido"),
  manejarErrores,
  asincrono(ctrl.iniciarWebpay)
);

// Pago de un pedido de la tienda
router.post(
  "/webpay/iniciar-compra",
  requiereAutenticacion,
  requiereRol("Cliente"),
  body("codigo_venta").matches(/^NV-\d{6}-[0-9A-F]{4}$/).withMessage("Codigo de pedido invalido"),
  manejarErrores,
  asincrono(require("../controllers/tienda.controller").iniciarPagoCompra)
);

// Transbank redirige a la clienta aqui (puede llegar por GET o por POST). Es publica:
// la seguridad esta en que el pago se confirma consultando a Transbank con el token.
router.all("/webpay/retorno", asincrono(ctrl.retornoWebpay));

module.exports = router;