// src/routes/servicios.routes.js
const { Router } = require("express");
const serviciosController = require("../controllers/servicios.controller");
const { requiereAutenticacion, requiereRol } = require("../middleware/auth.middleware");
const { manejarSubidaImagen } = require("../middleware/upload.middleware");
const {
  validarCrearServicio,
  validarActualizarServicio,
  validarIdServicioParam,
  validarListadoServicios,
} = require("../utils/validators");
const asincrono = require("../utils/asincrono");

const router = Router();

// Publicas: el catalogo se puede navegar sin loguearse
router.get("/", validarListadoServicios, asincrono(serviciosController.listar));
router.get("/:id", validarIdServicioParam, asincrono(serviciosController.obtener));

// Desde aqui, solo Administrador
router.use(requiereAutenticacion, requiereRol("Administrador"));

router.post("/", validarCrearServicio, asincrono(serviciosController.crear));
router.put("/:id", validarIdServicioParam, validarActualizarServicio, asincrono(serviciosController.actualizar));
router.delete("/:id", validarIdServicioParam, asincrono(serviciosController.eliminar));
router.put("/:id/reactivar", validarIdServicioParam, asincrono(serviciosController.reactivar));
router.post("/:id/imagen", validarIdServicioParam, manejarSubidaImagen, asincrono(serviciosController.subirImagen));
router.delete("/:id/imagen", validarIdServicioParam, asincrono(serviciosController.quitarImagen));

module.exports = router;
