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

const router = Router();

// Todas las rutas de este archivo requieren estar autenticado Y ser Administrador
router.use(requiereAutenticacion, requiereRol("Administrador"));

router.get("/", validarListadoUsuarios, usuariosController.listar);
router.get("/:id", validarIdUsuarioParam, usuariosController.obtener);
router.post("/", validarCrearUsuarioAdmin, usuariosController.crear);
router.put(
  "/:id",
  validarIdUsuarioParam,
  validarActualizarUsuarioAdmin,
  usuariosController.actualizar
);
router.delete("/:id", validarIdUsuarioParam, usuariosController.eliminar);
router.put("/:id/reactivar", validarIdUsuarioParam, usuariosController.reactivar);

module.exports = router;
