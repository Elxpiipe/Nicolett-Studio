// src/controllers/categorias.controller.js
const categoriaModel = require("../models/categoria.model");

/** "" o null -> null (usa el abono general); "10000" -> 10000 */
function aNumeroONull(valor) {
  return valor === null || valor === undefined || valor === "" ? null : Number(valor);
}

/**
 * GET /api/categorias?soloActivas=1
 * Publica: cualquiera puede ver el listado de categorias (util para mostrar
 * el catalogo antes de loguearse).
 */
function listar(req, res) {
  const soloActivas = req.query.soloActivas === "1";
  const categorias = categoriaModel.listar({ soloActivas });
  return res.json({ datos: categorias });
}

/**
 * POST /api/categorias
 * Solo Administrador.
 */
function crear(req, res) {
  const { nombre, descripcion } = req.body;
  const abono = aNumeroONull(req.body.abono);

  if (categoriaModel.buscarPorNombre(nombre)) {
    return res.status(409).json({ error: "Ya existe una categoria con ese nombre" });
  }

  const categoria = categoriaModel.crear({ nombre, descripcion, abono, indicaciones: req.body.indicaciones, adicionales: req.body.adicionales });
  return res.status(201).json({ categoria });
}

/**
 * PUT /api/categorias/:id
 * Solo Administrador.
 */
function actualizar(req, res) {
  const id_categoria = Number(req.params.id);
  const existente = categoriaModel.obtener(id_categoria);
  if (!existente) {
    return res.status(404).json({ error: "Categoria no encontrada" });
  }

  const { nombre, descripcion } = req.body;
  const abono = req.body.abono === undefined ? undefined : aNumeroONull(req.body.abono);

  if (nombre) {
    const conMismoNombre = categoriaModel.buscarPorNombre(nombre);
    if (conMismoNombre && conMismoNombre.id_categoria !== id_categoria) {
      return res.status(409).json({ error: "Ya existe otra categoria con ese nombre" });
    }
  }

  const categoria = categoriaModel.actualizar(id_categoria, { nombre, descripcion, abono, indicaciones: req.body.indicaciones, adicionales: req.body.adicionales, orden: req.body.orden });
  return res.json({ categoria });
}

/**
 * DELETE /api/categorias/:id
 * Baja logica. Solo Administrador. No se permite si tiene servicios activos,
 * para no dejar servicios "huerfanos" de categoria visible.
 */
function eliminar(req, res) {
  const id_categoria = Number(req.params.id);
  const existente = categoriaModel.obtener(id_categoria);
  if (!existente) {
    return res.status(404).json({ error: "Categoria no encontrada" });
  }

  const totalServicios = categoriaModel.contarServiciosEnCategoria(id_categoria);
  if (totalServicios > 0) {
    return res.status(409).json({
      error: `No puedes deshabilitar esta categoria: tiene ${totalServicios} servicio(s) activo(s). Deshabilita o reasigna esos servicios primero.`,
    });
  }

  const categoria = categoriaModel.cambiarEstadoActivo(id_categoria, false);
  return res.json({ mensaje: "Categoria deshabilitada", categoria });
}

/**
 * PUT /api/categorias/:id/reactivar
 * Solo Administrador.
 */
function reactivar(req, res) {
  const id_categoria = Number(req.params.id);
  const existente = categoriaModel.obtener(id_categoria);
  if (!existente) {
    return res.status(404).json({ error: "Categoria no encontrada" });
  }

  const categoria = categoriaModel.cambiarEstadoActivo(id_categoria, true);
  return res.json({ mensaje: "Categoria reactivada", categoria });
}

module.exports = { listar, crear, actualizar, eliminar, reactivar };
