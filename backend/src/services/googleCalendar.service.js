// src/services/googleCalendar.service.js
//
// Integracion con Google Calendar usando una CUENTA DE SERVICIO de Google Cloud.
// La duena del calendario solo tiene que COMPARTIR su calendario con el correo
// de la cuenta de servicio (permiso "Hacer cambios en eventos"). No hay claves
// de Gmail ni permisos que venzan.
//
// Funciona en ambos sentidos:
//   1) LECTURA: los eventos anotados a mano en Google (llamadas, presenciales,
//      tramites) se consideran horas OCUPADAS en la web y en WhatsApp.
//   2) ESCRITURA: cada cita del sistema se crea/mueve/borra como evento en Google.
//
// Modos (tabla configuracion_sistema, clave GOOGLE_CAL_MODO):
//   - "desactivado":     el sistema usa solo su propia agenda.
//   - "compartido":      un solo calendario para todo el salon (GOOGLE_CAL_ID).
//                        Un evento manual bloquea a la profesional cuyo nombre o
//                        alias aparece en el titulo; si no nombra a nadie,
//                        bloquea a TODO el salon (criterio seguro).
//   - "por_profesional": cada profesional tiene su propio calendario
//                        (profesionales.google_calendar_id).

const fs = require("fs");
const path = require("path");
const { JWT } = require("google-auth-library");
const configuracion = require("../models/configuracion.model");
const db = require("../../db/connection");
const { ahoraChile, sumarDias, chileADate, aTextoChile } = require("../utils/fechas");

const API = "https://www.googleapis.com/calendar/v3";
const ZONA = "America/Santiago";
const ORIGEN = "nicolett-sync"; // marca de los eventos creados por el sistema
const CACHE_MS = 60 * 1000;

let cliente = null;
let clienteSimulado = null; // solo para pruebas automaticas
let cache = { clave: null, hasta: 0, datos: null };

// ------------------------------------------------------------------
// Credenciales y cliente
// ------------------------------------------------------------------

function leerCredenciales() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }
  const ruta = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (!ruta) return null;
  const absoluta = path.isAbsolute(ruta) ? ruta : path.join(__dirname, "..", "..", ruta);
  if (!fs.existsSync(absoluta)) return null;
  return JSON.parse(fs.readFileSync(absoluta, "utf8"));
}

function obtenerCliente() {
  if (clienteSimulado) return clienteSimulado;
  if (cliente) return cliente;
  const cred = leerCredenciales();
  if (!cred?.client_email || !cred?.private_key) return null;
  cliente = new JWT({
    email: cred.client_email,
    key: cred.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  cliente.correoCuentaServicio = cred.client_email;
  return cliente;
}

async function peticion({ url, method = "GET", params, data }) {
  const c = obtenerCliente();
  if (!c) {
    const error = new Error(
      "Google Calendar no está configurado: falta el archivo de la cuenta de servicio (GOOGLE_SERVICE_ACCOUNT_FILE)."
    );
    error.status = 400;
    throw error;
  }
  try {
    const respuesta = await c.request({ url: `${API}${url}`, method, params, data });
    return respuesta.data;
  } catch (err) {
    const status = err.response?.status || err.status;
    const detalle = err.response?.data?.error?.message || err.message;
    const error = new Error(traducirError(status, detalle));
    error.status = status === 404 || status === 403 ? 400 : 502;
    error.statusGoogle = status;
    throw error;
  }
}

function traducirError(status, detalle) {
  if (status === 404) {
    return "Google no encuentra ese calendario. Revisa el ID y que esté compartido con la cuenta de servicio.";
  }
  if (status === 403) {
    return "La cuenta de servicio no tiene permiso: comparte el calendario con permiso \u201cHacer cambios en eventos\u201d.";
  }
  if (status === 401) return "Las credenciales de Google no son válidas. Descarga una nueva clave JSON.";
  return `Error de Google Calendar: ${detalle}`;
}

// ------------------------------------------------------------------
// Configuracion
// ------------------------------------------------------------------

function modo() {
  const valor = configuracion.obtenerTexto("GOOGLE_CAL_MODO", "desactivado");
  return ["compartido", "por_profesional"].includes(valor) ? valor : "desactivado";
}

function profesionalesActivos() {
  return db
    .prepare(
      `SELECT p.id_profesional, p.alias_calendario, p.google_calendar_id, u.nombres, u.apellidos
       FROM profesionales p JOIN usuarios u ON u.id_usuario = p.id_usuario
       WHERE p.activo = 1 AND u.activo = 1`
    )
    .all();
}

/** Calendarios a revisar: [{ calendarId, id_profesional|null, etiqueta }] */
function calendariosObjetivo() {
  const m = modo();
  if (m === "compartido") {
    const id = configuracion.obtenerTexto("GOOGLE_CAL_ID", "").trim();
    return id ? [{ calendarId: id, id_profesional: null, etiqueta: "Calendario del salón" }] : [];
  }
  if (m === "por_profesional") {
    return profesionalesActivos()
      .filter((p) => p.google_calendar_id)
      .map((p) => ({
        calendarId: p.google_calendar_id.trim(),
        id_profesional: p.id_profesional,
        etiqueta: `${p.nombres} ${p.apellidos}`,
      }));
  }
  return [];
}

/** Calendario donde se escriben las citas de una profesional (o null) */
function calendarioParaProfesional(id_profesional) {
  const m = modo();
  if (m === "compartido") return configuracion.obtenerTexto("GOOGLE_CAL_ID", "").trim() || null;
  if (m === "por_profesional") {
    const fila = db
      .prepare(`SELECT google_calendar_id FROM profesionales WHERE id_profesional = ?`)
      .get(id_profesional);
    return fila?.google_calendar_id?.trim() || null;
  }
  return null;
}

function invalidarCache() {
  cache = { clave: null, hasta: 0, datos: null };
}

// ------------------------------------------------------------------
// Lectura: eventos -> horas ocupadas
// ------------------------------------------------------------------

function normalizar(texto = "") {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Palabras que identifican a una profesional en un titulo */
function aliasDe(p) {
  const propios = (p.alias_calendario || "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  const lista = propios.length ? propios : [p.nombres.split(" ")[0]];
  return lista.map(normalizar);
}

function mencionaA(titulo, alias) {
  const t = ` ${normalizar(titulo).replace(/[^a-z0-9ñ]+/g, " ")} `;
  return alias.some((a) => a && t.includes(` ${a.replace(/[^a-z0-9ñ]+/g, " ").trim()} `));
}

/** Evento de Google -> { fecha_hora_inicio, fecha_hora_fin } en hora de Chile, o null si no ocupa */
function intervaloDeEvento(ev) {
  if (ev.status === "cancelled") return null;
  if (ev.transparency === "transparent") return null; // marcado como "Disponible"
  if (ev.extendedProperties?.private?.origen === ORIGEN) return null; // ya es una cita del sistema
  if (ev.start?.date) {
    // Evento de dia completo: la fecha de termino de Google es exclusiva
    return { fecha_hora_inicio: `${ev.start.date} 00:00`, fecha_hora_fin: `${ev.end.date} 00:00` };
  }
  if (!ev.start?.dateTime || !ev.end?.dateTime) return null;
  return {
    fecha_hora_inicio: aTextoChile(ev.start.dateTime),
    fecha_hora_fin: aTextoChile(ev.end.dateTime),
  };
}

async function listarEventos(calendarId, desde, hasta) {
  const eventos = [];
  let pageToken;
  do {
    const datos = await peticion({
      url: `/calendars/${encodeURIComponent(calendarId)}/events`,
      params: {
        timeMin: chileADate(desde).toISOString(),
        timeMax: chileADate(hasta).toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 2500,
        pageToken,
      },
    });
    eventos.push(...(datos.items || []));
    pageToken = datos.nextPageToken;
  } while (pageToken);
  return eventos;
}

/**
 * Horas ocupadas en Google para toda la ventana de reserva.
 * Devuelve { activo, error, porProfesional: Map(id -> [intervalos]), general: [intervalos] }
 * Si Google falla, NO bloquea las reservas: devuelve error para mostrar un aviso.
 */
async function obtenerOcupacion() {
  const objetivos = calendariosObjetivo();
  if (modo() === "desactivado" || objetivos.length === 0) {
    return { activo: false, error: null, porProfesional: new Map(), general: [] };
  }

  const { diasMaximosReserva } = configuracion.reglasAgenda();
  const hoy = ahoraChile().fecha;
  const clave = JSON.stringify([modo(), objetivos, hoy]);
  if (cache.clave === clave && Date.now() < cache.hasta) return cache.datos;

  const resultado = { activo: true, error: null, porProfesional: new Map(), general: [] };
  const agregar = (id, intervalo) => {
    if (!resultado.porProfesional.has(id)) resultado.porProfesional.set(id, []);
    resultado.porProfesional.get(id).push(intervalo);
  };

  try {
    const profesionales = profesionalesActivos().map((p) => ({ ...p, alias: aliasDe(p) }));
    const desde = `${hoy} 00:00`;
    const hasta = `${sumarDias(hoy, diasMaximosReserva + 1)} 00:00`;

    for (const objetivo of objetivos) {
      const eventos = await listarEventos(objetivo.calendarId, desde, hasta);
      for (const ev of eventos) {
        const intervalo = intervaloDeEvento(ev);
        if (!intervalo) continue;
        intervalo.titulo = ev.summary || "";

        if (objetivo.id_profesional) {
          agregar(objetivo.id_profesional, intervalo);
          continue;
        }
        // Calendario compartido: a quien nombra el titulo; si a nadie, a todo el salon
        const mencionadas = profesionales.filter((p) => mencionaA(intervalo.titulo, p.alias));
        if (mencionadas.length) mencionadas.forEach((p) => agregar(p.id_profesional, intervalo));
        else resultado.general.push(intervalo);
      }
    }
  } catch (err) {
    console.error("[Google Calendar] No se pudo leer la ocupación:", err.message);
    resultado.error = err.message;
    resultado.porProfesional = new Map();
    resultado.general = [];
    // se cachea menos tiempo para reintentar pronto
    cache = { clave, hasta: Date.now() + 15 * 1000, datos: resultado };
    return resultado;
  }

  cache = { clave, hasta: Date.now() + CACHE_MS, datos: resultado };
  return resultado;
}

/** Intervalos ocupados en Google para una profesional (incluye los de todo el salon) */
function ocupadosDeProfesional(ocupacion, id_profesional) {
  if (!ocupacion?.activo) return [];
  return [...(ocupacion.porProfesional.get(id_profesional) || []), ...ocupacion.general];
}

// ------------------------------------------------------------------
// Escritura: citas -> eventos
// ------------------------------------------------------------------

function cuerpoEvento({ resumen, descripcion, inicio, fin, idCita, color }) {
  return {
    summary: resumen,
    description: descripcion,
    start: { dateTime: `${inicio.replace(" ", "T")}:00`, timeZone: ZONA },
    end: { dateTime: `${fin.replace(" ", "T")}:00`, timeZone: ZONA },
    colorId: color, // 5 = amarillo (pendiente de abono), 10 = verde (confirmada)
    extendedProperties: { private: { origen: ORIGEN, id_cita: String(idCita ?? "") } },
  };
}

/** Crea el evento de una cita. Devuelve { id, htmlLink } */
async function crearEvento(calendarId, datos) {
  const ev = await peticion({
    url: `/calendars/${encodeURIComponent(calendarId)}/events`,
    method: "POST",
    data: cuerpoEvento(datos),
  });
  invalidarCache();
  return { id: ev.id, htmlLink: ev.htmlLink };
}

async function actualizarEvento(calendarId, eventId, datos) {
  const ev = await peticion({
    url: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    method: "PATCH",
    data: cuerpoEvento(datos),
  });
  invalidarCache();
  return { id: ev.id, htmlLink: ev.htmlLink };
}

/**
 * Eventos creados por el sistema (marca "origen") desde una fecha, con el id de
 * cita al que pertenecen. Sirve para detectar duplicados: si dos procesos
 * escribieron la misma cita al mismo tiempo, la reconciliacion borra el sobrante.
 */
async function listarEventosDelSistema(calendarId, desdeFecha) {
  const timeMin = chileADate(`${desdeFecha} 00:00`).toISOString();
  const eventos = [];
  let pageToken;
  do {
    const r = await peticion({
      url: `/calendars/${encodeURIComponent(calendarId)}/events`,
      params: { privateExtendedProperty: `origen=${ORIGEN}`, timeMin, singleEvents: true, maxResults: 2500, pageToken },
    });
    for (const ev of r.items || []) {
      const idCita = ev.extendedProperties?.private?.id_cita;
      if (ev.status !== "cancelled" && idCita && /^\d+$/.test(idCita)) eventos.push({ id: ev.id, idCita, calendarId });
    }
    pageToken = r.nextPageToken;
  } while (pageToken);
  return eventos;
}

async function eliminarEvento(calendarId, eventId) {
  try {
    await peticion({
      url: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      method: "DELETE",
    });
  } catch (err) {
    // Si ya no existe (la borraron a mano en Google), no es un error
    if (err.statusGoogle !== 404 && err.statusGoogle !== 410) throw err;
  }
  invalidarCache();
}

// ------------------------------------------------------------------
// Diagnostico (panel de Integraciones)
// ------------------------------------------------------------------

function correoCuentaServicio() {
  try {
    return obtenerCliente()?.correoCuentaServicio || null;
  } catch {
    return null;
  }
}

/** Estado de la conexion: credenciales, modo y acceso a cada calendario */
async function estado() {
  const salida = {
    modo: modo(),
    calendarioCompartido: configuracion.obtenerTexto("GOOGLE_CAL_ID", ""),
    credencialesCargadas: false,
    cuentaServicio: null,
    calendarios: [],
    error: null,
  };

  try {
    salida.credencialesCargadas = Boolean(obtenerCliente());
    salida.cuentaServicio = correoCuentaServicio();
  } catch (err) {
    salida.error = `No se pudo leer el archivo de credenciales: ${err.message}`;
    return salida;
  }
  if (!salida.credencialesCargadas || salida.modo === "desactivado") return salida;

  for (const objetivo of calendariosObjetivo()) {
    const item = { ...objetivo, ok: false, nombre: null, error: null };
    try {
      const cal = await peticion({ url: `/calendars/${encodeURIComponent(objetivo.calendarId)}` });
      item.nombre = cal.summary;
      item.zonaHoraria = cal.timeZone;
      item.ok = true;
    } catch (err) {
      item.error = err.message;
    }
    salida.calendarios.push(item);
  }
  return salida;
}

/** Crea un evento de prueba de 30 minutos (en ~1 hora) en cada calendario configurado */
async function crearEventosPrueba() {
  const objetivos = calendariosObjetivo();
  if (!objetivos.length) {
    const error = new Error("No hay calendarios configurados para probar.");
    error.status = 400;
    throw error;
  }
  const ahora = ahoraChile();
  const inicioMin = Math.ceil((ahora.minutos + 60) / 30) * 30;
  const fecha = inicioMin >= 23 * 60 ? sumarDias(ahora.fecha, 1) : ahora.fecha;
  const minutos = inicioMin >= 23 * 60 ? 10 * 60 : inicioMin;
  const hora = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  const resultados = [];
  for (const o of objetivos) {
    try {
      const ev = await crearEvento(o.calendarId, {
        resumen: "✓ Prueba de conexión — Nicolett Sync",
        descripcion: "Evento creado automáticamente para verificar la conexión. Se puede borrar.",
        inicio: `${fecha} ${hora(minutos)}`,
        fin: `${fecha} ${hora(minutos + 30)}`,
        idCita: "prueba",
        color: "10",
      });
      resultados.push({ ...o, ok: true, eventId: ev.id, htmlLink: ev.htmlLink });
    } catch (err) {
      resultados.push({ ...o, ok: false, error: err.message });
    }
  }
  return resultados;
}

// Solo para pruebas automaticas (simula las respuestas de Google)
function _usarClienteSimulado(simulado) {
  clienteSimulado = simulado;
  invalidarCache();
}

module.exports = {
  modo,
  calendariosObjetivo,
  calendarioParaProfesional,
  obtenerOcupacion,
  ocupadosDeProfesional,
  crearEvento,
  actualizarEvento,
  eliminarEvento,
  listarEventosDelSistema,
  estado,
  crearEventosPrueba,
  invalidarCache,
  correoCuentaServicio,
  _usarClienteSimulado,
  _internos: { intervaloDeEvento, mencionaA, aliasDe },
};
