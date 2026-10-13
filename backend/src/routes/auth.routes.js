// src/routes/auth.routes.js
const { Router } = require("express");
const authController = require("../controllers/auth.controller");
const { requiereAutenticacion } = require("../middleware/auth.middleware");
const {
  validarRegistro,
  validarLogin,
  validarCambioPassword,
  validarActualizarPerfil,
  validarOlvidePassword,
  validarRestablecerPassword,
} = require("../utils/validators");

const router = Router();

// Publicas
router.post("/registro", validarRegistro, authController.registro);
router.post("/login", validarLogin, authController.login);
router.post("/olvide-password", validarOlvidePassword, authController.olvidePassword);
router.post(
  "/restablecer-password",
  validarRestablecerPassword,
  authController.restablecerPassword
);

// Requieren estar autenticado
router.get("/perfil", requiereAutenticacion, authController.obtenerPerfil);
router.put(
  "/perfil",
  requiereAutenticacion,
  validarActualizarPerfil,
  authController.actualizarPerfil
);
router.put(
  "/password",
  requiereAutenticacion,
  validarCambioPassword,
  authController.cambiarPassword
);

module.exports = router;
