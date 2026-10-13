// src/routes/sitio.routes.js — datos publicos del sitio
const { Router } = require("express");
const ctrl = require("../controllers/sitio.controller");

const router = Router();
router.get("/equipo", ctrl.equipo);
router.get("/horario", ctrl.horario);

module.exports = router;
