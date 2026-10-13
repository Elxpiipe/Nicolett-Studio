// src/controllers/tienda.controller.js — productos, pedidos y su pago
const productoModel = require("../models/producto.model");
const ventaModel = require("../models/venta.model");
const citaModel = require("../models/cita.model");
const webpay = require("../services/webpay.service");
const { reglasAgenda } = require("../models/configuracion.model");
const { ahoraChile } = require("../utils/fechas");
const { urlArchivo, borrarImagenGuardada } = require("../middleware/upload.middleware");

// ---------- Productos ----------

/** GET /api/productos — catalogo publico (solo activos) */
function listarPublico(req, res) {
  return res.json({ datos: productoModel.listar({ soloActivos: true }) });
}

/** GET /api/productos/admin — todos, incluidos los desactivados */
function listarAdmin(req, res) {
  return res.json({ datos: productoModel.listar() });
}

function cargar(req, res) {
  const producto = productoModel.obtener(Number(req.params.id));
  if (!producto) res.status(404).json({ error: "Producto no encontrado" });
  return producto;
}

/** POST /api/productos { nombre, descripcion, marca, linea, precio, stock } */
function crear(req, res) {
  if (productoModel.buscarPorNombre(req.body.nombre)) {
    return res.status(409).json({ error: "Ya existe un producto con ese nombre" });
  }
  const id = productoModel.crear(req.body);
  productoModel.fijarStock(id, Number(req.body.stock) || 0, req.usuario.id_usuario, "Stock inicial");
  return res.status(201).json({ producto: productoModel.obtener(id) });
}

/** PUT /api/productos/:id — datos y/o stock */
function actualizar(req, res) {
  const producto = cargar(req, res);
  if (!producto) return;
  if (req.body.nombre) {
    const otro = productoModel.buscarPorNombre(req.body.nombre);
    if (otro && otro.id_producto !== producto.id_producto) {
      return res.status(409).json({ error: "Ya existe otro producto con ese nombre" });
    }
  }
  productoModel.actualizar(producto.id_producto, req.body);
  if (req.body.stock !== undefined) {
    productoModel.fijarStock(producto.id_producto, Number(req.body.stock), req.usuario.id_usuario);
  }
  return res.json({ producto: productoModel.obtener(producto.id_producto) });
}

/** PUT /api/productos/:id/estado { activo } */
function cambiarEstado(req, res) {
  const producto = cargar(req, res);
  if (!producto) return;
  productoModel.cambiarEstado(producto.id_producto, Boolean(req.body.activo));
  return res.json({ producto: productoModel.obtener(producto.id_producto) });
}

/** POST /api/productos/:id/imagen (multipart "imagen") */
function subirImagen(req, res) {
  const producto = productoModel.obtener(Number(req.params.id));
  if (!producto) {
    if (req.file) borrarImagenGuardada(urlArchivo("productos", req.file));
    return res.status(404).json({ error: "Producto no encontrado" });
  }
  if (!req.file) return res.status(400).json({ error: "Debes adjuntar una imagen en el campo 'imagen'" });
  productoModel.actualizarImagen(producto.id_producto, urlArchivo("productos", req.file));
  borrarImagenGuardada(producto.imagen_url);
  return res.json({ producto: productoModel.obtener(producto.id_producto) });
}

/** DELETE /api/productos/:id/imagen */
function quitarImagen(req, res) {
  const producto = cargar(req, res);
  if (!producto) return;
  productoModel.actualizarImagen(producto.id_producto, null);
  borrarImagenGuardada(producto.imagen_url);
  return res.json({ producto: productoModel.obtener(producto.id_producto) });
}

// ---------- Pedidos ----------

function vistaPedido(v, admin = false) {
  const base = {
    codigo_venta: v.codigo_venta,
    estado: v.estado,
    total: v.total,
    items: v.items,
    fecha: v.fecha,
    fecha_pago: v.fecha_pago,
    fecha_entrega: v.fecha_entrega,
    fecha_expiracion_pago: v.fecha_expiracion_pago,
    estado_pago: v.estado_pago,
    motivo_anulacion: v.motivo_anulacion,
    notas: v.notas,
  };
  return admin
    ? { ...base, cliente: v.cliente, email_cliente: v.email_cliente, telefono_cliente: v.telefono_cliente }
    : base;
}

/**
 * POST /api/pedidos { items: [{ id_producto, cantidad }], notas } — Cliente.
 * Aparta el stock y deja el pedido esperando pago (15 minutos).
 */
function crearPedido(req, res) {
  const id_cliente = citaModel.clienteDeUsuario(req.usuario.id_usuario);
  if (!id_cliente) return res.status(403).json({ error: "Solo las clientas pueden comprar desde la web" });

  // Une lineas repetidas del mismo producto
  const porProducto = new Map();
  for (const it of req.body.items) {
    const id = Number(it.id_producto);
    porProducto.set(id, (porProducto.get(id) || 0) + Number(it.cantidad));
  }
  const items = [...porProducto].map(([id_producto, cantidad]) => ({ id_producto, cantidad }));

  const { minutosRetencionWebpay } = reglasAgenda();
  const codigo = ventaModel.crearPedidoWeb({
    id_cliente,
    id_usuario: req.usuario.id_usuario,
    items,
    notas: req.body.notas,
    fecha_expiracion_pago: ahoraChile(new Date(Date.now() + minutosRetencionWebpay * 60000)).texto,
  });
  return res.status(201).json({ pedido: vistaPedido(ventaModel.obtenerPorCodigo(codigo)) });
}

/** GET /api/pedidos/:codigo — la duena del pedido o Admin */
function obtenerPedido(req, res) {
  const v = ventaModel.obtenerPorCodigo(req.params.codigo);
  const esAdmin = req.usuario.rol === "Administrador";
  const esSuyo = v && v.id_cliente === citaModel.clienteDeUsuario(req.usuario.id_usuario);
  if (!v || (!esAdmin && !esSuyo)) return res.status(404).json({ error: "Pedido no encontrado" });
  return res.json({ pedido: vistaPedido(v, esAdmin) });
}

/** GET /api/pedidos/mios — historial de compras de la clienta con sesion */
function misPedidos(req, res) {
  const id_cliente = citaModel.clienteDeUsuario(req.usuario.id_usuario);
  if (!id_cliente) return res.status(403).json({ error: "Solo las clientas tienen pedidos" });
  return res.json({ datos: ventaModel.listarDeCliente(id_cliente).map((v) => vistaPedido(v)) });
}

/** GET /api/pedidos?estado=&entregada=0|1 — Admin */
function listarPedidos(req, res) {
  return res.json({
    datos: ventaModel.listarWeb({ estado: req.query.estado, entregada: req.query.entregada }).map((v) => vistaPedido(v, true)),
  });
}

/** POST /api/pedidos/:codigo/entregar — Admin: la clienta retiro su pedido */
function entregarPedido(req, res) {
  const v = ventaModel.obtenerPorCodigo(req.params.codigo);
  if (!v) return res.status(404).json({ error: "Pedido no encontrado" });
  if (v.estado !== "PAGADA") return res.status(409).json({ error: "Solo se entregan pedidos pagados" });
  if (v.fecha_entrega) return res.status(409).json({ error: "Este pedido ya fue entregado" });
  ventaModel.marcarEntregada(v.id_venta);
  return res.json({ pedido: vistaPedido(ventaModel.obtenerPorCodigo(v.codigo_venta), true) });
}

/** POST /api/pagos/webpay/iniciar-compra { codigo_venta } — Cliente */
async function iniciarPagoCompra(req, res) {
  return res.json(await webpay.iniciarPagoVenta(req.body.codigo_venta, req.usuario.id_usuario));
}

module.exports = {
  misPedidos,
  listarPublico,
  listarAdmin,
  crear,
  actualizar,
  cambiarEstado,
  subirImagen,
  quitarImagen,
  crearPedido,
  obtenerPedido,
  listarPedidos,
  entregarPedido,
  iniciarPagoCompra,
};
