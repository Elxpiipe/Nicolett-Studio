// src/routes/usuarios.routes.js
const { Router } = require("express");
const usuariosController = require("../controllers/usuarios.controller");
const { requiereAutenticacion, requiereRol } = require("../middleware/auth.middleware");
const {
  validarCrearUsuarioAdmin,
  validarActualizarUsuarioAdmin,
  validarIdUsuarioParam,
  validarListadoUsuarios,
} = require("../utils/validators");
const asincrono = require("../utils/asincrono");

const router = Router();

// Todas las rutas de este archivo requieren estar autenticado Y ser Administrador
router.use(requiereAutenticacion, requiereRol("Administrador"));

router.get("/", validarListadoUsuarios, asincrono(usuariosController.listar));
router.get("/:id", validarIdUsuarioParam, asincrono(usuariosController.obtener));
router.post("/", validarCrearUsuarioAdmin, asincrono(usuariosController.crear));
router.put(
  "/:id",
  validarIdUsuarioParam,
  validarActualizarUsuarioAdmin,
  asincrono(usuariosController.actualizar)
);
router.delete("/:id", validarIdUsuarioParam, asincrono(usuariosController.eliminar));
router.put("/:id/reactivar", validarIdUsuarioParam, asincrono(usuariosController.reactivar));

module.exports = router;
