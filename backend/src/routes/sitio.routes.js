// src/routes/sitio.routes.js — datos publicos del sitio
const { Router } = require("express");
const ctrl = require("../controllers/sitio.controller");
const asincrono = require("../utils/asincrono");

const router = Router();
router.get("/equipo", asincrono(ctrl.equipo));
router.get("/horario", asincrono(ctrl.horario));

module.exports = router;
