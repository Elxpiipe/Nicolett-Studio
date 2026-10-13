// src/services/disponibilidad.service.js
// Motor de disponibilidad: calcula las horas de inicio libres para un servicio
// en una fecha, cruzando horario semanal, bloqueos y citas ya tomadas.

const servicioModel = require("../models/servicio.model");
const profesionalModel = require("../models/profesional.model");
const { reglasAgenda } = require("../models/configuracion.model");
const googleCalendar = require("./googleCalendar.service");
const { aMinutos, aHora, diaSemanaIso, sumarDias, ahoraChile } = require("../utils/fechas");

/** Convierte intervalos 'AAAA-MM-DD HH:MM' a minutos dentro del dia `fecha` */
function aIntervalosDelDia(filas, fecha) {
  return filas.map((f) => {
    const ini = f.fecha_hora_inicio.slice(0, 10) < fecha ? 0 : aMinutos(f.fecha_hora_inicio.slice(11, 16));
    const fin = f.fecha_hora_fin.slice(0, 10) > fecha ? 24 * 60 : aMinutos(f.fecha_hora_fin.slice(11, 16));
    return [ini, fin];
  });
}

function seSolapa(inicio, fin, intervalos) {
  return intervalos.some(([a, b]) => inicio < b && fin > a);
}

/**
 * Horas libres de UNA profesional para una duracion dada.
 * Devuelve minutos de inicio (ej. [600, 630] = 10:00, 10:30).
 */
function horasLibresProfesional(id_profesional, fecha, duracion, reglas, ahora, ocupadosGoogle = [], excluirIdCita = null) {
  const tramos = profesionalModel.horarioDeFecha(id_profesional, diaSemanaIso(fecha), fecha);
  if (!tramos.length) return [];

  const inicioDia = `${fecha} 00:00`;
  const finDia = `${sumarDias(fecha, 1)} 00:00`;
  const ocupados = [
    // Al cambiar de hora, la propia cita no cuenta como ocupada (se puede mover 30 min)
    ...aIntervalosDelDia(
      profesionalModel.citasQueTocan(id_profesional, inicioDia, finDia).filter((c) => c.id_cita !== excluirIdCita),
      fecha
    ),
    ...aIntervalosDelDia(profesionalModel.bloqueosQueTocan(id_profesional, inicioDia, finDia), fecha),
    // Eventos anotados a mano en Google Calendar que tocan este dia
    ...aIntervalosDelDia(
      ocupadosGoogle.filter((g) => g.fecha_hora_inicio < finDia && g.fecha_hora_fin > inicioDia),
      fecha
    ),
  ];

  // No se ofrecen horas en el pasado ni demasiado encima
  const minimoHoy = fecha === ahora.fecha ? ahora.minutos + reglas.anticipacionMinimaMin : -1;

  const libres = [];
  for (const tramo of tramos) {
    const ini = aMinutos(tramo.hora_inicio);
    const fin = aMinutos(tramo.hora_fin);
    for (let t = ini; t + duracion <= fin; t += reglas.intervaloMin) {
      if (t < minimoHoy) continue;
      if (seSolapa(t, t + duracion, ocupados)) continue;
      libres.push(t);
    }
  }
  return libres;
}

/** Valida que la fecha este dentro de la ventana de reserva */
function fechaReservable(fecha, reglas, ahora) {
  return fecha >= ahora.fecha && fecha <= sumarDias(ahora.fecha, reglas.diasMaximosReserva);
}

/**
 * Horas libres para un servicio en una fecha.
 * Si se indica id_profesional, solo esa; si no, "cualquiera disponible".
 * Resultado: { fecha, duracion, calendario, horas: [{ hora: '10:00', profesionales: [...] }] }
 * `ocupacion` permite reutilizar la lectura de Google entre varios dias.
 */
async function horasLibres({ id_servicio, fecha, id_profesional, excluirIdCita }, ocupacion) {
  const servicio = servicioModel.obtener(id_servicio);
  if (!servicio || !servicio.activo) {
    const error = new Error("El servicio no existe o no está disponible");
    error.status = 404;
    throw error;
  }

  const reglas = reglasAgenda();
  const ahora = ahoraChile();
  const google = ocupacion || (await googleCalendar.obtenerOcupacion());
  const resultado = {
    fecha,
    duracion: servicio.duracion_minutos,
    // Informa si se cruzo con Google Calendar (y si hubo un problema al leerlo)
    calendario: { activo: google.activo, sincronizado: google.activo && !google.error },
    horas: [],
  };
  if (!fechaReservable(fecha, reglas, ahora)) return resultado;

  let profesionales = profesionalModel.listarPorServicio(id_servicio);
  if (id_profesional) profesionales = profesionales.filter((p) => p.id_profesional === id_profesional);

  const porHora = new Map();
  for (const p of profesionales) {
    const ocupadosGoogle = googleCalendar.ocupadosDeProfesional(google, p.id_profesional);
    for (const t of horasLibresProfesional(p.id_profesional, fecha, servicio.duracion_minutos, reglas, ahora, ocupadosGoogle, excluirIdCita)) {
      if (!porHora.has(t)) porHora.set(t, []);
      porHora.get(t).push({ id_profesional: p.id_profesional, nombre: `${p.nombres} ${p.apellidos}` });
    }
  }

  resultado.horas = [...porHora.keys()]
    .sort((a, b) => a - b)
    .map((t) => ({ hora: aHora(t), profesionales: porHora.get(t) }));
  return resultado;
}

/** Dias (desde hoy) que tienen al menos una hora libre; para pintar el calendario */
async function diasDisponibles({ id_servicio, id_profesional, desde, dias = 14, excluirIdCita }) {
  const reglas = reglasAgenda();
  const ahora = ahoraChile();
  const inicio = desde && desde > ahora.fecha ? desde : ahora.fecha;
  const total = Math.min(dias, 42);
  const google = await googleCalendar.obtenerOcupacion(); // una sola lectura para todos los dias
  const salida = [];
  for (let i = 0; i < total; i++) {
    const fecha = sumarDias(inicio, i);
    if (!fechaReservable(fecha, reglas, ahora)) break;
    const { horas } = await horasLibres({ id_servicio, fecha, id_profesional, excluirIdCita }, google);
    salida.push({ fecha, disponibles: horas.length });
  }
  return salida;
}

module.exports = { horasLibres, diasDisponibles, horasLibresProfesional };
