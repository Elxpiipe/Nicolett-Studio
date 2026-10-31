// src/routes/categorias.routes.js
const { Router } = require("express");
const categoriasController = require("../controllers/categorias.controller");
const { requiereAutenticacion, requiereRol } = require("../middleware/auth.middleware");
const {
  validarCrearCategoria,
  validarActualizarCategoria,
  validarIdCategoriaParam,
} = require("../utils/validators");
const asincrono = require("../utils/asincrono");

const router = Router();

// Publica: el catalogo se puede navegar sin loguearse
router.get("/", asincrono(categoriasController.listar));

// Desde aqui, solo Administrador
router.use(requiereAutenticacion, requiereRol("Administrador"));

router.post("/", validarCrearCategoria, asincrono(categoriasController.crear));
router.put("/:id", validarIdCategoriaParam, validarActualizarCategoria, asincrono(categoriasController.actualizar));
router.delete("/:id", validarIdCategoriaParam, asincrono(categoriasController.eliminar));
router.put("/:id/reactivar", validarIdCategoriaParam, asincrono(categoriasController.reactivar));

module.exports = router;
