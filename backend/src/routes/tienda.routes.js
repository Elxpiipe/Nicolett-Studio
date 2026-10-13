// src/routes/tienda.routes.js — /api/productos y /api/pedidos
const { Router } = require("express");
const { body, param, query, validationResult } = require("express-validator");
const ctrl = require("../controllers/tienda.controller");
const { requiereAutenticacion, requiereRol } = require("../middleware/auth.middleware");
const { crearSubida } = require("../middleware/upload.middleware");

function manejarErrores(req, res, next) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({
      error: errores.array()[0].msg,
      detalles: errores.array().map((e) => ({ campo: e.path, mensaje: e.msg })),
    });
  }
  next();
}

const soloAdmin = [requiereAutenticacion, requiereRol("Administrador")];
const idParam = [param("id").isInt({ min: 1 }).withMessage("Id invalido"), manejarErrores];
const codigoPedido = [param("codigo").matches(/^NV-\d{6}-[0-9A-F]{4}$/).withMessage("Codigo de pedido invalido"), manejarErrores];

const camposProducto = (crear) => [
  (crear ? body("nombre") : body("nombre").optional())
    .trim()
    .notEmpty()
    .withMessage("El nombre es obligatorio")
    .isLength({ max: 100 }),
  body("descripcion").optional({ values: "null" }).trim().isLength({ max: 600 }).withMessage("Descripción muy larga (máx. 600)"),
  body("marca").optional({ values: "null" }).trim().isLength({ max: 60 }),
  body("linea").optional({ values: "null" }).trim().isLength({ max: 60 }),
  body("codigo").optional({ values: "null" }).trim().isLength({ max: 40 }),
  (crear ? body("precio") : body("precio").optional())
    .isInt({ min: 1, max: 5000000 })
    .withMessage("Indica un precio válido en pesos"),
  (crear ? body("stock") : body("stock").optional())
    .isInt({ min: 0, max: 100000 })
    .withMessage("El stock debe ser un número entero de 0 o más"),
  manejarErrores,
];

const productos = Router();
productos.get("/", ctrl.listarPublico);
productos.get("/admin", ...soloAdmin, ctrl.listarAdmin);
productos.post("/", ...soloAdmin, ...camposProducto(true), ctrl.crear);
productos.put("/:id", ...soloAdmin, ...idParam, ...camposProducto(false), ctrl.actualizar);
productos.put("/:id/estado", ...soloAdmin, ...idParam, body("activo").isBoolean(), manejarErrores, ctrl.cambiarEstado);
productos.post("/:id/imagen", ...soloAdmin, ...idParam, crearSubida("productos", "producto"), ctrl.subirImagen);
productos.delete("/:id/imagen", ...soloAdmin, ...idParam, ctrl.quitarImagen);

const pedidos = Router();
pedidos.post(
  "/",
  requiereAutenticacion,
  requiereRol("Cliente"),
  body("items").isArray({ min: 1, max: 30 }).withMessage("El carrito está vacío"),
  body("items.*.id_producto").isInt({ min: 1 }).withMessage("Producto inválido"),
  body("items.*.cantidad").isInt({ min: 1, max: 20 }).withMessage("Cantidad inválida (1 a 20)"),
  body("notas").optional({ values: "falsy" }).trim().isLength({ max: 300 }),
  manejarErrores,
  ctrl.crearPedido
);
pedidos.get(
  "/",
  ...soloAdmin,
  query("estado").optional({ values: "falsy" }).isIn(["PENDIENTE", "PAGADA", "ANULADA"]),
  query("entregada").optional({ values: "falsy" }).isIn(["0", "1"]),
  manejarErrores,
  ctrl.listarPedidos
);
pedidos.get("/mios", requiereAutenticacion, requiereRol("Cliente"), ctrl.misPedidos);
pedidos.get("/:codigo", requiereAutenticacion, ...codigoPedido, ctrl.obtenerPedido);
pedidos.post("/:codigo/entregar", ...soloAdmin, ...codigoPedido, ctrl.entregarPedido);

module.exports = { productos, pedidos, manejarErrores };
