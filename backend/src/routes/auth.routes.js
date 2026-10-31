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
  validarInvitada,
} = require("../utils/validators");
const asincrono = require("../utils/asincrono");

const router = Router();

// Publicas
router.post("/registro", validarRegistro, asincrono(authController.registro));
router.post("/login", validarLogin, asincrono(authController.login));
// Reservar o comprar sin cuenta (sesion corta de invitada)
router.post("/invitada", validarInvitada, asincrono(authController.invitada));
router.post("/olvide-password", validarOlvidePassword, asincrono(authController.olvidePassword));
router.post(
  "/restablecer-password",
  validarRestablecerPassword,
  asincrono(authController.restablecerPassword)
);

// Requieren estar autenticado
router.get("/perfil", requiereAutenticacion, asincrono(authController.obtenerPerfil));
router.put(
  "/perfil",
  requiereAutenticacion,
  validarActualizarPerfil,
  asincrono(authController.actualizarPerfil)
);
router.put(
  "/password",
  requiereAutenticacion,
  validarCambioPassword,
  asincrono(authController.cambiarPassword)
);

module.exports = router;
