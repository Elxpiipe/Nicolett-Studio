// src/controllers/servicios.controller.js
const servicioModel = require("../models/servicio.model");
const categoriaModel = require("../models/categoria.model");
const { borrarImagenGuardada } = require("../middleware/upload.middleware");

/**
 * GET /api/servicios?id_categoria=&activo=&soloActivos=1
 * Publica: cualquiera puede navegar el catalogo (Clientes sin loguearse
 * incluidos, y Profesionales/Administradores dentro del panel).
 */
async function listar(req, res) {
  const { id_categoria, activo, soloActivos } = req.query;
  const servicios = await servicioModel.listar({
    id_categoria: id_categoria ? Number(id_categoria) : undefined,
    soloActivos: soloActivos === "1" || activo === "1",
  });
  return res.json({ datos: servicios });
}

/**
 * GET /api/servicios/:id
 */
async function obtener(req, res) {
  const servicio = await servicioModel.obtener(Number(req.params.id));
  if (!servicio) {
    return res.status(404).json({ error: "Servicio no encontrado" });
  }
  return res.json({ servicio });
}

/**
 * POST /api/servicios
 * Solo Administrador.
 */
async function crear(req, res) {
  const { id_categoria, nombre, descripcion, duracion_minutos, precio } = req.body;

  const categoria = await categoriaModel.obtener(id_categoria);
  if (!categoria) {
    return res.status(400).json({ error: "La categoria indicada no existe" });
  }

  if (await servicioModel.buscarPorNombreEnCategoria(id_categoria, nombre)) {
    return res.status(409).json({ error: "Ya existe un servicio con ese nombre en esa categoria" });
  }

  const { tipo_precio, orden, variantes } = req.body;
  let servicio = await servicioModel.crear({ id_categoria, nombre, descripcion, duracion_minutos, precio, tipo_precio, orden });
  if (Array.isArray(variantes)) {
    await servicioModel.guardarVariantes(servicio.id_servicio, variantes);
    servicio = await servicioModel.obtener(servicio.id_servicio);
  }
  return res.status(201).json({ servicio });
}

/**
 * PUT /api/servicios/:id
 * Solo Administrador.
 */
async function actualizar(req, res) {
  const id_servicio = Number(req.params.id);
  const existente = await servicioModel.obtener(id_servicio);
  if (!existente) {
    return res.status(404).json({ error: "Servicio no encontrado" });
  }

  const { id_categoria, nombre, descripcion, duracion_minutos, precio } = req.body;

  if (id_categoria && !await categoriaModel.obtener(id_categoria)) {
    return res.status(400).json({ error: "La categoria indicada no existe" });
  }

  await servicioModel.actualizar(id_servicio, {
    id_categoria,
    nombre,
    descripcion,
    duracion_minutos,
    precio,
    tipo_precio: req.body.tipo_precio,
    orden: req.body.orden,
  });
  // Variantes por largo (S/M/L/XL): si se envian, reemplazan a las actuales
  if (Array.isArray(req.body.variantes)) await servicioModel.guardarVariantes(id_servicio, req.body.variantes);
  return res.json({ servicio: await servicioModel.obtener(id_servicio) });
}

/**
 * DELETE /api/servicios/:id
 * Baja logica. Solo Administrador.
 */
async function eliminar(req, res) {
  const id_servicio = Number(req.params.id);
  const existente = await servicioModel.obtener(id_servicio);
  if (!existente) {
    return res.status(404).json({ error: "Servicio no encontrado" });
  }
  const servicio = await servicioModel.cambiarEstadoActivo(id_servicio, false);
  return res.json({ mensaje: "Servicio deshabilitado", servicio });
}

/**
 * PUT /api/servicios/:id/reactivar
 * Solo Administrador.
 */
async function reactivar(req, res) {
  const id_servicio = Number(req.params.id);
  const existente = await servicioModel.obtener(id_servicio);
  if (!existente) {
    return res.status(404).json({ error: "Servicio no encontrado" });
  }
  const servicio = await servicioModel.cambiarEstadoActivo(id_servicio, true);
  return res.json({ mensaje: "Servicio reactivado", servicio });
}

/**
 * POST /api/servicios/:id/imagen   (multipart/form-data, campo "imagen")
 * Sube o reemplaza la foto del servicio. Solo Administrador.
 */
async function subirImagen(req, res) {
  const id_servicio = Number(req.params.id);
  const existente = await servicioModel.obtener(id_servicio);

  if (!existente) {
    if (req.file) borrarImagenGuardada(`/uploads/servicios/${req.file.filename}`);
    return res.status(404).json({ error: "Servicio no encontrado" });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Debes adjuntar una imagen en el campo 'imagen'" });
  }

  const nuevaUrl = `/uploads/servicios/${req.file.filename}`;
  const servicio = await servicioModel.actualizarImagen(id_servicio, nuevaUrl);
  // La foto anterior ya no se usa: se borra para no acumular archivos
  borrarImagenGuardada(existente.imagen_url);
  return res.json({ mensaje: "Imagen actualizada", servicio });
}

/**
 * DELETE /api/servicios/:id/imagen
 * Quita la foto del servicio. Solo Administrador.
 */
async function quitarImagen(req, res) {
  const id_servicio = Number(req.params.id);
  const existente = await servicioModel.obtener(id_servicio);
  if (!existente) {
    return res.status(404).json({ error: "Servicio no encontrado" });
  }
  const servicio = await servicioModel.actualizarImagen(id_servicio, null);
  borrarImagenGuardada(existente.imagen_url);
  return res.json({ mensaje: "Imagen eliminada", servicio });
}

module.exports = { listar, obtener, crear, actualizar, eliminar, reactivar, subirImagen, quitarImagen };
