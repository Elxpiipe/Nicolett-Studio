// src/routes/agenda.routes.js — consultas publicas de disponibilidad
const { Router } = require("express");
const ctrl = require("../controllers/agenda.controller");
const {
  validarConsultaServicio,
  validarHorasLibres,
  validarDiasDisponibles,
} = require("../utils/validators");

const asincrono = require("../utils/asincrono");

const router = Router();

router.get("/reglas", ctrl.reglas);
router.get("/profesionales", validarConsultaServicio, ctrl.profesionalesPorServicio);
router.get("/horas-libres", validarHorasLibres, asincrono(ctrl.horasLibres));
router.get("/dias-disponibles", validarDiasDisponibles, asincrono(ctrl.diasDisponibles));

module.exports = router;
