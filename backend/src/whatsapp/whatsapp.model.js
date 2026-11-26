// src/whatsapp/whatsapp.model.js
// Sesiones de conversacion, historial de mensajes y numeros de las clientas.
const db = require("../../db/connection");

// ---------------- Sesiones ----------------

async function obtenerSesion(telefono) {
  const fila = await db.prepare(`SELECT * FROM whatsapp_sesiones WHERE telefono = ?`).get(telefono);
  return fila || { telefono, estado: "MENU", datos: {}, humano_desde: null, pendiente_respuesta: 0, nueva: true };
}

async function guardarSesion(telefono, { estado, datos, humano_desde, pendiente_respuesta }) {
  await db
    .prepare(
      `INSERT INTO whatsapp_sesiones (telefono, estado, datos, humano_desde, pendiente_respuesta, fecha_actualizacion)
       VALUES (?, ?, ?::jsonb, ?, ?, fecha_actual_utc())
       ON CONFLICT (telefono) DO UPDATE SET
         estado = excluded.estado, datos = excluded.datos, humano_desde = excluded.humano_desde,
         pendiente_respuesta = excluded.pendiente_respuesta, fecha_actualizacion = excluded.fecha_actualizacion`
    )
    .run(telefono, estado, JSON.stringify(datos || {}), humano_desde || null, pendiente_respuesta ? 1 : 0);
}

async function marcarPendiente(telefono, pendiente) {
  await db.prepare(`UPDATE whatsapp_sesiones SET pendiente_respuesta = ? WHERE telefono = ?`).run(pendiente ? 1 : 0, telefono);
}

// ---------------- Mensajes ----------------

/**
 * Guarda un mensaje. Devuelve su id, o null si ya estaba guardado (Meta puede
 * reenviar el mismo mensaje: asi no se responde dos veces).
 */
async function registrarMensaje({ telefono, direccion, autor, tipo, texto, contenido, wa_id, estado, error }) {
  const fila = await db
    .prepare(
      `INSERT INTO whatsapp_mensajes (telefono, direccion, autor, tipo, texto, contenido, wa_id, estado, error)
       VALUES (?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?)
       ON CONFLICT (wa_id) DO NOTHING
       RETURNING id_mensaje`
    )
    .get(
      telefono,
      direccion,
      autor,
      tipo || "texto",
      texto ?? null,
      contenido ? JSON.stringify(contenido) : null,
      wa_id || null,
      estado || "enviado",
      error || null
    );
  return fila ? fila.id_mensaje : null;
}

/** Meta avisa si un mensaje enviado fue entregado, leido o fallo */
async function actualizarEstadoMensaje(wa_id, estado, error) {
  await db
    .prepare(`UPDATE whatsapp_mensajes SET estado = ?, error = COALESCE(?, error) WHERE wa_id = ? AND direccion = 'salida'`)
    .run(estado, error || null, wa_id);
}

async function historial(telefono, limite = 300) {
  const filas = await db
    .prepare(
      `SELECT id_mensaje, direccion, autor, tipo, texto, contenido, estado, error, fecha
       FROM whatsapp_mensajes WHERE telefono = ? ORDER BY id_mensaje DESC LIMIT ?`
    )
    .all(telefono, limite);
  return filas.reverse();
}

async function ultimaEntrada(telefono) {
  return db
    .prepare(`SELECT fecha FROM whatsapp_mensajes WHERE telefono = ? AND direccion = 'entrada' ORDER BY id_mensaje DESC LIMIT 1`)
    .get(telefono);
}

/** Una fila por numero: ultimo mensaje, nombre y si espera respuesta del salon */
async function listarConversaciones() {
  return db
    .prepare(
      `SELECT t.telefono, t.texto AS ultimo_texto, t.direccion AS ultima_direccion, t.fecha AS ultima_fecha,
              s.estado, COALESCE(s.pendiente_respuesta, 0) AS pendiente_respuesta,
              c.id_usuario, c.nombre_perfil,
              NULLIF(TRIM(COALESCE(u.nombres, '') || ' ' || COALESCE(u.apellidos, '')), '') AS nombre
       FROM (
         SELECT DISTINCT ON (telefono) telefono, texto, direccion, fecha, id_mensaje
         FROM whatsapp_mensajes ORDER BY telefono, id_mensaje DESC
       ) t
       LEFT JOIN whatsapp_sesiones s ON s.telefono = t.telefono
       LEFT JOIN whatsapp_contactos c ON c.telefono = t.telefono
       LEFT JOIN usuarios u ON u.id_usuario = c.id_usuario
       ORDER BY COALESCE(s.pendiente_respuesta, 0) DESC, t.id_mensaje DESC`
    )
    .all();
}

/** Borra una conversacion del simulador para empezar de nuevo */
async function borrarConversacion(telefono) {
  await db.transaction(async () => {
    await db.prepare(`DELETE FROM whatsapp_mensajes WHERE telefono = ?`).run(telefono);
    await db.prepare(`DELETE FROM whatsapp_sesiones WHERE telefono = ?`).run(telefono);
    await db.prepare(`DELETE FROM whatsapp_contactos WHERE telefono = ?`).run(telefono);
  })();
}

// ---------------- Contactos (numero -> clienta) ----------------

async function obtenerContacto(telefono) {
  return db.prepare(`SELECT * FROM whatsapp_contactos WHERE telefono = ?`).get(telefono);
}

async function guardarContacto(telefono, id_usuario, nombre_perfil) {
  await db
    .prepare(
      `INSERT INTO whatsapp_contactos (telefono, id_usuario, nombre_perfil) VALUES (?, ?, ?)
       ON CONFLICT (telefono) DO UPDATE SET
         id_usuario = COALESCE(excluded.id_usuario, whatsapp_contactos.id_usuario),
         nombre_perfil = COALESCE(excluded.nombre_perfil, whatsapp_contactos.nombre_perfil)`
    )
    .run(telefono, id_usuario || null, nombre_perfil || null);
}

/** Numero de WhatsApp de una clienta (el usado mas recientemente) */
async function telefonoDeUsuario(id_usuario) {
  const fila = await db
    .prepare(
      `SELECT c.telefono FROM whatsapp_contactos c
       LEFT JOIN whatsapp_sesiones s ON s.telefono = c.telefono
       WHERE c.id_usuario = ?
       ORDER BY s.fecha_actualizacion DESC NULLS LAST LIMIT 1`
    )
    .get(id_usuario);
  return fila?.telefono;
}

/**
 * Clienta registrada con ese telefono (se comparan los ultimos 9 digitos, asi
 * "+56 9 1234 5678", "912345678" y "56912345678" son el mismo numero).
 * Si hay varias, se prefiere la que tiene cuenta propia y la mas reciente.
 */
async function buscarClientaPorTelefono(digitos) {
  const ultimos = String(digitos).replace(/\D/g, "").slice(-9);
  if (ultimos.length < 8) return undefined;
  return db
    .prepare(
      `SELECT u.id_usuario, u.nombres, u.apellidos, u.es_invitado
       FROM usuarios u JOIN clientes cl ON cl.id_usuario = u.id_usuario
       WHERE u.activo = 1 AND u.id_rol = 3
         AND RIGHT(regexp_replace(COALESCE(u.telefono, ''), '[^0-9]', '', 'g'), 9) = ?
       ORDER BY u.es_invitado ASC, u.id_usuario DESC LIMIT 1`
    )
    .get(ultimos);
}

module.exports = {
  obtenerSesion,
  guardarSesion,
  marcarPendiente,
  registrarMensaje,
  actualizarEstadoMensaje,
  historial,
  ultimaEntrada,
  listarConversaciones,
  borrarConversacion,
  obtenerContacto,
  guardarContacto,
  telefonoDeUsuario,
  buscarClientaPorTelefono,
};
