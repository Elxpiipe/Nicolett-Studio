// src/api/client.js
// Cliente HTTP minimo: agrega el token JWT (si existe) y normaliza errores.

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

// Origen del backend (sin /api), para armar la URL de las imagenes subidas
const ORIGEN_BACKEND = API_URL.replace(/\/api\/?$/, "");

/** Convierte "/uploads/servicios/x.jpg" en una URL absoluta al backend. */
export function urlImagen(ruta) {
  if (!ruta) return null;
  if (/^(https?:|blob:|data:)/.test(ruta)) return ruta;
  return `${ORIGEN_BACKEND}${ruta}`;
}

// Subida de archivos (multipart). No se fija Content-Type: el navegador lo
// arma solo con el "boundary" correcto.
async function subirArchivo(ruta, campo, archivo, token) {
  const formData = new FormData();
  formData.append(campo, archivo);
  const respuesta = await fetch(`${API_URL}${ruta}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(datos.error || "No se pudo subir la imagen");
    error.status = respuesta.status;
    throw error;
  }
  return datos;
}

async function solicitud(ruta, { metodo = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const respuesta = await fetch(`${API_URL}${ruta}`, {
    method: metodo,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    const error = new Error(datos.error || "Ocurrio un error inesperado");
    error.detalles = datos.detalles;
    error.status = respuesta.status;
    throw error;
  }

  return datos;
}

export const api = {
  registro: (payload) => solicitud("/auth/registro", { metodo: "POST", body: payload }),
  login: (payload) => solicitud("/auth/login", { metodo: "POST", body: payload }),
  perfil: (token) => solicitud("/auth/perfil", { token }),
  actualizarPerfil: (payload, token) =>
    solicitud("/auth/perfil", { metodo: "PUT", body: payload, token }),
  cambiarPassword: (payload, token) =>
    solicitud("/auth/password", { metodo: "PUT", body: payload, token }),
  olvidePassword: (payload) => solicitud("/auth/olvide-password", { metodo: "POST", body: payload }),
  restablecerPassword: (payload) =>
    solicitud("/auth/restablecer-password", { metodo: "POST", body: payload }),

  // CRUD de usuarios (solo Administrador)
  listarUsuarios: (queryString, token) =>
    solicitud(`/usuarios${queryString ? `?${queryString}` : ""}`, { token }),
  obtenerUsuario: (id, token) => solicitud(`/usuarios/${id}`, { token }),
  crearUsuario: (payload, token) =>
    solicitud("/usuarios", { metodo: "POST", body: payload, token }),
  actualizarUsuario: (id, payload, token) =>
    solicitud(`/usuarios/${id}`, { metodo: "PUT", body: payload, token }),
  deshabilitarUsuario: (id, token) =>
    solicitud(`/usuarios/${id}`, { metodo: "DELETE", token }),
  reactivarUsuario: (id, token) =>
    solicitud(`/usuarios/${id}/reactivar`, { metodo: "PUT", token }),

  // Catálogo: categorías
  listarCategorias: (soloActivas) =>
    solicitud(`/categorias${soloActivas ? "?soloActivas=1" : ""}`),
  crearCategoria: (payload, token) =>
    solicitud("/categorias", { metodo: "POST", body: payload, token }),
  actualizarCategoria: (id, payload, token) =>
    solicitud(`/categorias/${id}`, { metodo: "PUT", body: payload, token }),
  deshabilitarCategoria: (id, token) =>
    solicitud(`/categorias/${id}`, { metodo: "DELETE", token }),
  reactivarCategoria: (id, token) =>
    solicitud(`/categorias/${id}/reactivar`, { metodo: "PUT", token }),

  // Catálogo: servicios
  listarServicios: (queryString) =>
    solicitud(`/servicios${queryString ? `?${queryString}` : ""}`),
  crearServicio: (payload, token) =>
    solicitud("/servicios", { metodo: "POST", body: payload, token }),
  actualizarServicio: (id, payload, token) =>
    solicitud(`/servicios/${id}`, { metodo: "PUT", body: payload, token }),
  deshabilitarServicio: (id, token) =>
    solicitud(`/servicios/${id}`, { metodo: "DELETE", token }),
  reactivarServicio: (id, token) =>
    solicitud(`/servicios/${id}/reactivar`, { metodo: "PUT", token }),
  subirImagenServicio: (id, archivo, token) =>
    subirArchivo(`/servicios/${id}/imagen`, "imagen", archivo, token),
  quitarImagenServicio: (id, token) =>
    solicitud(`/servicios/${id}/imagen`, { metodo: "DELETE", token }),

  // Equipo: profesionales (Administrador; la Profesional solo ve la suya)
  listarProfesionales: (token) => solicitud("/profesionales", { token }),
  actualizarProfesional: (id, payload, token) =>
    solicitud(`/profesionales/${id}`, { metodo: "PUT", body: payload, token }),
  asignarServiciosProfesional: (id, servicios, token) =>
    solicitud(`/profesionales/${id}/servicios`, { metodo: "PUT", body: { servicios }, token }),
  guardarHorarioProfesional: (id, tramos, token) =>
    solicitud(`/profesionales/${id}/horario`, { metodo: "PUT", body: { tramos }, token }),
  listarBloqueos: (id, token) => solicitud(`/profesionales/${id}/bloqueos`, { token }),
  crearBloqueo: (id, payload, token) =>
    solicitud(`/profesionales/${id}/bloqueos`, { metodo: "POST", body: payload, token }),
  eliminarBloqueo: (id, idBloqueo, token) =>
    solicitud(`/profesionales/${id}/bloqueos/${idBloqueo}`, { metodo: "DELETE", token }),

  crearProfesional: (payload, token) =>
    solicitud("/profesionales", { metodo: "POST", body: payload, token }),
  cambiarEstadoProfesional: (id, activo, token) =>
    solicitud(`/profesionales/${id}/estado`, { metodo: "PUT", body: { activo }, token }),
  subirFotoProfesional: (id, archivo, token) =>
    subirArchivo(`/profesionales/${id}/foto`, "imagen", archivo, token),
  quitarFotoProfesional: (id, token) =>
    solicitud(`/profesionales/${id}/foto`, { metodo: "DELETE", token }),

  // Sitio publico
  equipoPublico: () => solicitud("/sitio/equipo"),
  horarioSalon: () => solicitud("/sitio/horario"),

  // Integraciones (Administrador)
  estadoGoogle: (token) => solicitud("/integraciones/google", { token }),
  guardarGoogle: (payload, token) =>
    solicitud("/integraciones/google", { metodo: "PUT", body: payload, token }),
  probarGoogle: (token) => solicitud("/integraciones/google/prueba", { metodo: "POST", token }),
  borrarPruebaGoogle: (payload, token) =>
    solicitud("/integraciones/google/prueba", { metodo: "DELETE", body: payload, token }),
  ocupacionGoogle: (token) => solicitud("/integraciones/google/ocupacion", { token }),

  // Reservas y abono
  crearReserva: (payload, token) => solicitud("/reservas", { metodo: "POST", body: payload, token }),
  obtenerReserva: (codigo, token) => solicitud(`/reservas/${codigo}`, { token }),
  listarReservas: (filtros, token) =>
    solicitud(`/reservas?${new URLSearchParams(filtros || {}).toString()}`, { token }),
  confirmarAbono: (codigo, referencia, token) =>
    solicitud(`/reservas/${codigo}/confirmar-abono`, { metodo: "POST", body: { referencia }, token }),
  misCitas: (token) => solicitud("/reservas/mias", { token }),
  agendaDelDia: ({ fecha, id_profesional }, token) =>
    solicitud(`/reservas/agenda?fecha=${fecha}` + (id_profesional ? `&id_profesional=${id_profesional}` : ""), { token }),
  marcarAtencion: (codigo, estado, observaciones, token) =>
    solicitud(`/reservas/${codigo}/atencion`, { metodo: "POST", body: { estado, observaciones }, token }),

  // Clientas (historial para la administradora)
  listarClientes: (busqueda, token) =>
    solicitud(`/clientes${busqueda ? `?busqueda=${encodeURIComponent(busqueda)}` : ""}`, { token }),
  fichaCliente: (id, token) => solicitud(`/clientes/${id}`, { token }),

  // Equipo: la administradora tambien atiende / dar acceso de administradora
  crearPerfilPropio: (payload, token) => solicitud("/profesionales/yo", { metodo: "POST", body: payload, token }),
  cambiarAccesoAdmin: (id, es_administradora, token) =>
    solicitud(`/profesionales/${id}/administradora`, { metodo: "PUT", body: { es_administradora }, token }),

  // Promociones (carrusel del Inicio)
  promocionesVigentes: () => solicitud("/promociones"),
  promocionesAdmin: (token) => solicitud("/promociones/admin", { token }),
  crearPromocion: (payload, token) => solicitud("/promociones", { metodo: "POST", body: payload, token }),
  actualizarPromocion: (id, payload, token) => solicitud(`/promociones/${id}`, { metodo: "PUT", body: payload, token }),
  eliminarPromocion: (id, token) => solicitud(`/promociones/${id}`, { metodo: "DELETE", token }),
  subirImagenPromocion: (id, archivo, token) => subirArchivo(`/promociones/${id}/imagen`, "imagen", archivo, token),
  reagendarReserva: (codigo, payload, token) =>
    solicitud(`/reservas/${codigo}/reagendar`, { metodo: "POST", body: payload, token }),
  cancelarReserva: (codigo, token) => solicitud(`/reservas/${codigo}/cancelar`, { metodo: "POST", token }),
  misPedidos: (token) => solicitud("/pedidos/mios", { token }),
  iniciarWebpayReserva: (codigo_cita, token) =>
    solicitud("/pagos/webpay/iniciar", { metodo: "POST", body: { codigo_cita }, token }),

  // Tienda
  listarProductos: () => solicitud("/productos"),
  listarProductosAdmin: (token) => solicitud("/productos/admin", { token }),
  crearProducto: (payload, token) => solicitud("/productos", { metodo: "POST", body: payload, token }),
  actualizarProducto: (id, payload, token) =>
    solicitud(`/productos/${id}`, { metodo: "PUT", body: payload, token }),
  cambiarEstadoProducto: (id, activo, token) =>
    solicitud(`/productos/${id}/estado`, { metodo: "PUT", body: { activo }, token }),
  subirImagenProducto: (id, archivo, token) => subirArchivo(`/productos/${id}/imagen`, "imagen", archivo, token),
  quitarImagenProducto: (id, token) => solicitud(`/productos/${id}/imagen`, { metodo: "DELETE", token }),
  crearPedido: (payload, token) => solicitud("/pedidos", { metodo: "POST", body: payload, token }),
  obtenerPedido: (codigo, token) => solicitud(`/pedidos/${codigo}`, { token }),
  listarPedidos: (filtros, token) =>
    solicitud(`/pedidos?${new URLSearchParams(filtros || {}).toString()}`, { token }),
  entregarPedido: (codigo, token) => solicitud(`/pedidos/${codigo}/entregar`, { metodo: "POST", token }),
  iniciarWebpayCompra: (codigo_venta, token) =>
    solicitud("/pagos/webpay/iniciar-compra", { metodo: "POST", body: { codigo_venta }, token }),

  // Agenda (publica)
  reglasAgenda: () => solicitud("/agenda/reglas"),
  profesionalesPorServicio: (idServicio) =>
    solicitud(`/agenda/profesionales?id_servicio=${idServicio}`),
  // `excluir`: codigo de la cita que se esta cambiando (su propio horario no cuenta como ocupado)
  horasLibres: ({ id_servicio, fecha, id_profesional, excluir }) =>
    solicitud(
      `/agenda/horas-libres?id_servicio=${id_servicio}&fecha=${fecha}` +
        (id_profesional ? `&id_profesional=${id_profesional}` : "") +
        (excluir ? `&excluir=${excluir}` : "")
    ),
  diasDisponibles: ({ id_servicio, id_profesional, desde, dias = 14, excluir }) =>
    solicitud(
      `/agenda/dias-disponibles?id_servicio=${id_servicio}&dias=${dias}` +
        (id_profesional ? `&id_profesional=${id_profesional}` : "") +
        (desde ? `&desde=${desde}` : "") +
        (excluir ? `&excluir=${excluir}` : "")
    ),
};
