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

const router = Router();

// Publicas: el catalogo se puede navegar sin loguearse
router.get("/", validarListadoServicios, serviciosController.listar);
router.get("/:id", validarIdServicioParam, serviciosController.obtener);

// Desde aqui, solo Administrador
router.use(requiereAutenticacion, requiereRol("Administrador"));

router.post("/", validarCrearServicio, serviciosController.crear);
router.put("/:id", validarIdServicioParam, validarActualizarServicio, serviciosController.actualizar);
router.delete("/:id", validarIdServicioParam, serviciosController.eliminar);
router.put("/:id/reactivar", validarIdServicioParam, serviciosController.reactivar);
router.post("/:id/imagen", validarIdServicioParam, manejarSubidaImagen, serviciosController.subirImagen);
router.delete("/:id/imagen", validarIdServicioParam, serviciosController.quitarImagen);

module.exports = router;
