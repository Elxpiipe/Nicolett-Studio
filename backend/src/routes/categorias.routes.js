// src/routes/categorias.routes.js
const { Router } = require("express");
const categoriasController = require("../controllers/categorias.controller");
const { requiereAutenticacion, requiereRol } = require("../middleware/auth.middleware");
const {
  validarCrearCategoria,
  validarActualizarCategoria,
  validarIdCategoriaParam,
} = require("../utils/validators");

const router = Router();

// Publica: el catalogo se puede navegar sin loguearse
router.get("/", categoriasController.listar);

// Desde aqui, solo Administrador
router.use(requiereAutenticacion, requiereRol("Administrador"));

router.post("/", validarCrearCategoria, categoriasController.crear);
router.put("/:id", validarIdCategoriaParam, validarActualizarCategoria, categoriasController.actualizar);
router.delete("/:id", validarIdCategoriaParam, categoriasController.eliminar);
router.put("/:id/reactivar", validarIdCategoriaParam, categoriasController.reactivar);

module.exports = router;
