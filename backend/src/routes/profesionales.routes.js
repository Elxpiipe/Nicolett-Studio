// src/routes/profesionales.routes.js
const { Router } = require("express");
const ctrl = require("../controllers/profesionales.controller");
const { requiereAutenticacion, requiereRol } = require("../middleware/auth.middleware");
const { crearSubida } = require("../middleware/upload.middleware");
const asincrono = require("../utils/asincrono");
const {
  validarIdProfesionalParam,
  validarAsignarServicios,
  validarHorario,
  validarBloqueo,
  validarCrearProfesional,
  validarPerfilProfesional,
  validarEstadoProfesional,
} = require("../utils/validators");

const router = Router();
const soloAdmin = requiereRol("Administrador");
const subirFotoProfesional = crearSubida("profesionales", "profesional");

// Admin y Profesional (el controlador limita a la Profesional a su propia ficha)
router.use(requiereAutenticacion, requiereRol("Administrador", "Profesional"));

router.get("/", ctrl.listar);
router.post("/", soloAdmin, validarCrearProfesional, asincrono(ctrl.crear));
router.post("/yo", soloAdmin, ctrl.crearPerfilPropio);
router.get("/:id", validarIdProfesionalParam, ctrl.obtener);
router.put("/:id", validarIdProfesionalParam, validarPerfilProfesional, ctrl.actualizar);
router.put("/:id/estado", validarIdProfesionalParam, validarEstadoProfesional, ctrl.cambiarEstado);
router.put("/:id/administradora", soloAdmin, validarIdProfesionalParam, ctrl.cambiarAccesoAdmin);
router.post("/:id/foto", soloAdmin, validarIdProfesionalParam, subirFotoProfesional, ctrl.subirFoto);
router.delete("/:id/foto", validarIdProfesionalParam, ctrl.quitarFoto);
router.put("/:id/servicios", validarIdProfesionalParam, validarAsignarServicios, ctrl.asignarServicios);
router.put("/:id/horario", validarIdProfesionalParam, validarHorario, ctrl.guardarHorario);
router.get("/:id/bloqueos", validarIdProfesionalParam, ctrl.listarBloqueos);
router.post("/:id/bloqueos", validarIdProfesionalParam, validarBloqueo, ctrl.crearBloqueo);
router.delete("/:id/bloqueos/:idBloqueo", validarIdProfesionalParam, ctrl.eliminarBloqueo);

module.exports = router;
