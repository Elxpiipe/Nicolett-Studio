// src/routes/integraciones.routes.js — solo Administrador
const { Router } = require("express");
const ctrl = require("../controllers/integraciones.controller");
const { requiereAutenticacion, requiereRol } = require("../middleware/auth.middleware");
const asincrono = require("../utils/asincrono");
const { validarConfigGoogle } = require("../utils/validators");

const router = Router();
router.use(requiereAutenticacion, requiereRol("Administrador"));

router.get("/google", asincrono(ctrl.estadoGoogle));
router.put("/google", validarConfigGoogle, asincrono(ctrl.guardarGoogle));
router.post("/google/prueba", asincrono(ctrl.probarGoogle));
router.delete("/google/prueba", asincrono(ctrl.borrarPrueba));
router.get("/google/ocupacion", asincrono(ctrl.ocupacionGoogle));

module.exports = router;
