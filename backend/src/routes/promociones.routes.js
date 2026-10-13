// src/routes/promociones.routes.js — /api/promociones
const { Router } = require("express");
const { body, param } = require("express-validator");
const modelo = require("../models/promocion.model");
const { requiereAutenticacion, requiereRol } = require("../middleware/auth.middleware");
const { crearSubida, urlArchivo, borrarImagenGuardada } = require("../middleware/upload.middleware");
const { manejarErrores } = require("./tienda.routes");
const { ahoraChile } = require("../utils/fechas");

const router = Router();
const soloAdmin = [requiereAutenticacion, requiereRol("Administrador")];
const idParam = [param("id").isInt({ min: 1 }).withMessage("Id invalido"), manejarErrores];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const campos = (crear) => [
  (crear ? body("titulo") : body("titulo").optional()).trim().notEmpty().withMessage("El título es obligatorio").isLength({ max: 80 }),
  body("descripcion").optional({ values: "null" }).trim().isLength({ max: 200 }),
  // Enlace opcional: una pagina del sitio ("/reservar?servicio=9") o una direccion https
  body("enlace")
    .optional({ values: "falsy" })
    .trim()
    .matches(/^(\/[^\s]*|https:\/\/[^\s]+)$/)
    .withMessage("El enlace debe ser una página del sitio (/servicios) o empezar con https://"),
  body("fecha_inicio").optional({ values: "falsy" }).matches(FECHA).withMessage("Fecha de inicio inválida"),
  body("fecha_fin").optional({ values: "falsy" }).matches(FECHA).withMessage("Fecha de término inválida"),
  body("fecha_fin")
    .optional({ values: "falsy" })
    .custom((fin, { req }) => !req.body.fecha_inicio || fin >= req.body.fecha_inicio)
    .withMessage("La fecha de término debe ser posterior al inicio"),
  body("orden").optional().isInt({ min: 0, max: 999 }),
  body("activo").optional().isBoolean(),
  manejarErrores,
];

/** Publico: promociones vigentes hoy, para el carrusel del Inicio */
router.get("/", (req, res) => res.json({ datos: modelo.listarVigentes(ahoraChile().fecha) }));

/** Administradora: todas (incluye futuras, vencidas y ocultas) */
router.get("/admin", ...soloAdmin, (req, res) => res.json({ datos: modelo.listarTodas(), hoy: ahoraChile().fecha }));

router.post("/", ...soloAdmin, ...campos(true), (req, res) => res.status(201).json({ promocion: modelo.crear(req.body) }));

router.put("/:id", ...soloAdmin, ...idParam, ...campos(false), (req, res) => {
  if (!modelo.obtener(Number(req.params.id))) return res.status(404).json({ error: "Promoción no encontrada" });
  return res.json({ promocion: modelo.actualizar(Number(req.params.id), req.body) });
});

router.delete("/:id", ...soloAdmin, ...idParam, (req, res) => {
  const promo = modelo.obtener(Number(req.params.id));
  if (!promo) return res.status(404).json({ error: "Promoción no encontrada" });
  modelo.eliminar(promo.id_promocion);
  borrarImagenGuardada(promo.imagen_url);
  return res.json({ mensaje: "Promoción eliminada" });
});

router.post("/:id/imagen", ...soloAdmin, ...idParam, crearSubida("promociones", "promo"), (req, res) => {
  const promo = modelo.obtener(Number(req.params.id));
  if (!promo) {
    if (req.file) borrarImagenGuardada(urlArchivo("promociones", req.file));
    return res.status(404).json({ error: "Promoción no encontrada" });
  }
  if (!req.file) return res.status(400).json({ error: "Debes adjuntar una imagen" });
  const actualizada = modelo.actualizarImagen(promo.id_promocion, urlArchivo("promociones", req.file));
  borrarImagenGuardada(promo.imagen_url);
  return res.json({ promocion: actualizada });
});

module.exports = router;
