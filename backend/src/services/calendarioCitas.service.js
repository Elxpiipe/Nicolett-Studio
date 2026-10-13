// src/services/calendarioCitas.service.js
//
// Escribe las citas del sistema en Google Calendar (el mismo calendario que la
// duena usa para anotar a mano). Es una sincronizacion "por reconciliacion":
// compara lo que DEBERIA haber en Google con lo que se escribio la ultima vez
// y corrige la diferencia. Se ejecuta:
//   - justo despues de cada cambio (reservar, confirmar abono, vencer), y
//   - cada minuto, para reintentar lo que haya fallado (ej. Google caido).
// Una reserva NUNCA falla por culpa de Google: esto corre aparte.
//
// Que citas van a Google:
//   - CONFIRMADA / ATENDIDA / NO_ASISTE  -> evento (verde / gris / rojo)
//   - PENDIENTE_ABONO por TRANSFERENCIA, con plazo vigente -> evento amarillo
//     "esperando abono" (la hora queda apartada hasta 2 horas y la duena
//     debe verla para no darla por telefono)
//   - PENDIENTE_ABONO por WEBPAY -> NO (dura 15 minutos: solo ensuciaria el
//     calendario; se escribe al confirmarse el pago)
//   - CANCELADA o pendiente vencida -> se borra el evento si existia

const db = require("../../db/connection");
const googleCalendar = require("./googleCalendar.service");
const citaModel = require("../models/cita.model");
const { ahoraChile, sumarDias } = require("../utils/fechas");
const { formatearPrecio } = require("../utils/formatoTexto");

// Colores de Google Calendar (colorId)
const COLOR = { CONFIRMADA: "10", PENDIENTE_ABONO: "5", ATENDIDA: "8", NO_ASISTE: "11" };

/** ¿Esta cita deberia tener un evento en Google ahora? */
function debeEstarEnCalendario(cita, ahora) {
  if (["CONFIRMADA", "ATENDIDA", "NO_ASISTE"].includes(cita.estado)) return true;
  return (
    cita.estado === "PENDIENTE_ABONO" &&
    cita.metodo_abono === "TRANSFERENCIA" &&
    (!cita.fecha_expiracion_abono || cita.fecha_expiracion_abono > ahora)
  );
}

function datosEvento(cita) {
  const pendiente = cita.estado === "PENDIENTE_ABONO";
  const saldo = cita.precio - (cita.estado_abono === "APROBADO" ? cita.monto_abono : 0);
  const icono = { CONFIRMADA: "✓", PENDIENTE_ABONO: "⏳", ATENDIDA: "✔", NO_ASISTE: "✗" }[cita.estado] || "";
  const resumen =
    `${icono} ${cita.servicio} · ${cita.cliente} · con ${cita.profesional}` +
    (pendiente ? " (esperando abono)" : cita.estado === "NO_ASISTE" ? " (no asistió)" : "");

  const lineas = [
    `Reserva ${cita.codigo_cita}`,
    `Servicio: ${cita.servicio} (${cita.duracion_minutos} min)`,
    `Profesional: ${cita.profesional}`,
    `Clienta: ${cita.cliente}`,
    cita.telefono_cliente ? `Teléfono: ${cita.telefono_cliente}` : null,
    cita.email_cliente ? `Correo: ${cita.email_cliente}` : null,
    "",
    `Precio: ${formatearPrecio(cita.precio)}`,
    pendiente
      ? `Abono: ${formatearPrecio(cita.monto_abono)} PENDIENTE por transferencia (la hora se libera a las ${cita.fecha_expiracion_abono?.slice(11)} si no llega)`
      : `Abono: ${formatearPrecio(cita.monto_abono)} ${cita.estado_abono === "APROBADO" ? "pagado" : "pendiente"}`,
    `Saldo a pagar en el salón: ${formatearPrecio(saldo)}`,
    cita.notas_cliente ? `\nNotas de la clienta: ${cita.notas_cliente}` : null,
    "",
    "Creada por Nicolett Sync. Para mover o cancelar esta cita usa el panel del sistema, no este evento.",
  ];

  return {
    resumen,
    descripcion: lineas.filter((l) => l !== null).join("\n"),
    inicio: cita.fecha_hora_inicio,
    fin: cita.fecha_hora_fin,
    idCita: cita.id_cita,
    color: COLOR[cita.estado],
  };
}

/** Lo que se escribio en Google: si cambia el estado, la hora o la profesional, hay que actualizar */
function firma(cita) {
  return `${cita.estado}|${cita.fecha_hora_inicio}|${cita.id_profesional}`;
}

function guardarVinculo(id_cita, eventId, calendarId, estado) {
  db.prepare(
    `UPDATE citas SET google_calendar_event_id = ?, google_calendar_calendario = ?, google_calendar_estado = ?
     WHERE id_cita = ?`
  ).run(eventId, calendarId, estado, id_cita);
}

/** Citas que podrian necesitar un cambio en Google */
function candidatas() {
  const desde = `${sumarDias(ahoraChile().fecha, -1)} 00:00`; // no se reescribe el historial antiguo
  return db
    .prepare(
      `SELECT c.codigo_cita FROM citas c
       WHERE c.google_calendar_event_id IS NOT NULL
          OR (c.estado <> 'CANCELADA' AND c.fecha_hora_fin > ?)`
    )
    .all(desde)
    .map((f) => citaModel.obtenerPorCodigo(f.codigo_cita))
    .filter(Boolean);
}

/** Borra de Google los eventos de una cita que no sean `conservar` (duplicados) */
async function borrarSobrantes(eventos, conservar) {
  let n = 0;
  for (const ev of eventos) {
    if (ev.id === conservar) continue;
    await googleCalendar.eliminarEvento(ev.calendarId, ev.id);
    n++;
  }
  return n;
}

/**
 * Eventos del sistema que ya existen en Google, agrupados por id de cita.
 * Devuelve null si no se pudieron leer (se sigue sin control de duplicados).
 */
async function eventosExistentes(citas) {
  const calendarios = new Set();
  for (const cita of citas) {
    if (cita.google_calendar_calendario) calendarios.add(cita.google_calendar_calendario);
    const destino = googleCalendar.calendarioParaProfesional(cita.id_profesional);
    if (destino) calendarios.add(destino);
  }
  const desde = sumarDias(ahoraChile().fecha, -1);
  const porCita = new Map();
  try {
    for (const calendarId of calendarios) {
      for (const ev of await googleCalendar.listarEventosDelSistema(calendarId, desde)) {
        if (!porCita.has(ev.idCita)) porCita.set(ev.idCita, []);
        porCita.get(ev.idCita).push(ev);
      }
    }
  } catch (err) {
    console.error("[Google Calendar] No se pudo revisar si hay eventos duplicados:", err.message);
    return null;
  }
  return porCita;
}

async function sincronizarCita(cita, ahora, existentes, resumen) {
  const debe = debeEstarEnCalendario(cita, ahora);
  const tiene = Boolean(cita.google_calendar_event_id);
  const enGoogle = existentes?.get(String(cita.id_cita)) || [];

  // 1) Ya no corresponde (cancelada o vencida): borrar el evento y cualquier copia
  if (!debe) {
    let borrados = 0;
    if (tiene) {
      await googleCalendar.eliminarEvento(cita.google_calendar_calendario, cita.google_calendar_event_id);
      guardarVinculo(cita.id_cita, null, null, null);
      borrados++;
    }
    resumen.duplicados += await borrarSobrantes(enGoogle, cita.google_calendar_event_id);
    return borrados ? "eliminado" : null;
  }

  // 2) Corresponde y no esta vinculada: reutilizar si ya existe en Google, si no crear
  if (!tiene) {
    const calendarId = googleCalendar.calendarioParaProfesional(cita.id_profesional);
    if (!calendarId) return null; // Google desactivado o la profesional sin calendario
    const previo = enGoogle.find((ev) => ev.calendarId === calendarId);
    if (previo) {
      await googleCalendar.actualizarEvento(calendarId, previo.id, datosEvento(cita));
      guardarVinculo(cita.id_cita, previo.id, calendarId, firma(cita));
      resumen.duplicados += await borrarSobrantes(enGoogle, previo.id);
      return "actualizado";
    }
    const ev = await googleCalendar.crearEvento(calendarId, datosEvento(cita));
    guardarVinculo(cita.id_cita, ev.id, calendarId, firma(cita));
    resumen.duplicados += await borrarSobrantes(enGoogle, ev.id);
    return "creado";
  }

  // Vinculada: si hay otra copia del mismo evento (dos procesos escribieron a la vez), se borra
  resumen.duplicados += await borrarSobrantes(enGoogle, cita.google_calendar_event_id);

  // 3) Existe pero cambio el estado, la hora o la profesional: actualizar
  if (cita.google_calendar_estado !== firma(cita)) {
    // Si al cambiar de profesional cambia tambien el calendario (modo por profesional),
    // se borra en el antiguo y se crea en el nuevo en la proxima vuelta
    const calendarioNuevo = googleCalendar.calendarioParaProfesional(cita.id_profesional);
    if (calendarioNuevo && calendarioNuevo !== cita.google_calendar_calendario) {
      await googleCalendar.eliminarEvento(cita.google_calendar_calendario, cita.google_calendar_event_id);
      guardarVinculo(cita.id_cita, null, null, null);
      return "recrear";
    }
    try {
      await googleCalendar.actualizarEvento(
        cita.google_calendar_calendario,
        cita.google_calendar_event_id,
        datosEvento(cita)
      );
      guardarVinculo(cita.id_cita, cita.google_calendar_event_id, cita.google_calendar_calendario, firma(cita));
      return "actualizado";
    } catch (err) {
      // Lo borraron a mano en Google: se olvida el vinculo y se recrea en la proxima vuelta
      if (err.statusGoogle === 404 || err.statusGoogle === 410) {
        guardarVinculo(cita.id_cita, null, null, null);
        return "recrear";
      }
      throw err;
    }
  }
  return null;
}

let enCurso = null;
let repetir = false;

/**
 * Reconciliacion completa. Si ya hay una corriendo, se agenda otra al terminar
 * (asi nunca corren dos a la vez ni se pierde un cambio).
 */
async function sincronizar() {
  if (enCurso) {
    repetir = true;
    return enCurso;
  }
  enCurso = (async () => {
    const resumen = { creado: 0, actualizado: 0, eliminado: 0, recrear: 0, duplicados: 0, errores: 0 };
    try {
      // Sin conexion configurada no hay a quien escribir
      if (googleCalendar.modo() === "desactivado") return resumen;
      const ahora = ahoraChile().texto;
      const citas = candidatas();
      const existentes = await eventosExistentes(citas);
      for (const cita of citas) {
        try {
          const accion = await sincronizarCita(cita, ahora, existentes, resumen);
          if (accion) resumen[accion]++;
        } catch (err) {
          resumen.errores++;
          if (resumen.errores === 1) console.error(`[Google Calendar] No se pudo sincronizar ${cita.codigo_cita}: ${err.message}`);
        }
      }
      const cambios = resumen.creado + resumen.actualizado + resumen.eliminado + resumen.duplicados;
      if (cambios) console.log(`[Google Calendar] Citas sincronizadas:`, resumen);
      return resumen;
    } finally {
      enCurso = null;
      if (repetir) {
        repetir = false;
        setImmediate(() => sincronizar().catch(() => {}));
      }
    }
  })();
  return enCurso;
}

/** Para llamar despues de un cambio sin esperar a Google (no bloquea la respuesta) */
function sincronizarEnSegundoPlano() {
  setImmediate(() => sincronizar().catch((err) => console.error("[Google Calendar]", err.message)));
}

module.exports = { sincronizar, sincronizarEnSegundoPlano, debeEstarEnCalendario, datosEvento };
