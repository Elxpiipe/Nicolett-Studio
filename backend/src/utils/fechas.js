// src/utils/fechas.js
// Fechas y horas del salon, siempre en hora de Chile (America/Santiago).
// En la BD se guardan como texto 'AAAA-MM-DD HH:MM' (hora local del salon),
// asi se pueden comparar como strings y no hay sorpresas con zonas horarias.

const ZONA = "America/Santiago";

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** 'HH:MM' -> minutos desde medianoche */
function aMinutos(hora) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

/** minutos desde medianoche -> 'HH:MM' */
function aHora(minutos) {
  const h = String(Math.floor(minutos / 60)).padStart(2, "0");
  const m = String(minutos % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/** 1 = lunes ... 7 = domingo (ISO), para 'AAAA-MM-DD' */
function diaSemanaIso(fecha) {
  const [a, m, d] = fecha.split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return dia === 0 ? 7 : dia;
}

/** Suma n dias a 'AAAA-MM-DD' */
function sumarDias(fecha, n) {
  const [a, m, d] = fecha.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d + n));
  return f.toISOString().slice(0, 10);
}

/** Momento actual en Chile: { fecha: 'AAAA-MM-DD', minutos, texto: 'AAAA-MM-DD HH:MM' } */
function ahoraChile(fechaBase = new Date()) {
  // 'sv-SE' formatea como 'AAAA-MM-DD HH:MM:SS'
  const texto = new Intl.DateTimeFormat("sv-SE", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(fechaBase)
    .replace(",", "");
  const [fecha, hora] = texto.split(" ");
  return { fecha, minutos: aMinutos(hora.slice(0, 5)), texto: `${fecha} ${hora.slice(0, 5)}` };
}

/** Diferencia en minutos entre la hora de Chile y UTC en un instante dado */
function desfaseChileMin(instante) {
  const redondeado = new Date(Math.floor(instante.getTime() / 60000) * 60000);
  const { texto } = ahoraChile(redondeado);
  const [f, h] = texto.split(" ");
  const [a, m, d] = f.split("-").map(Number);
  const [hh, mm] = h.split(":").map(Number);
  return (Date.UTC(a, m - 1, d, hh, mm) - redondeado.getTime()) / 60000;
}

/** 'AAAA-MM-DD HH:MM' en hora de Chile -> Date (instante real). Considera horario de verano. */
function chileADate(texto) {
  const [f, h] = texto.split(" ");
  const [a, m, d] = f.split("-").map(Number);
  const [hh, mm] = h.split(":").map(Number);
  const comoUtc = Date.UTC(a, m - 1, d, hh, mm);
  let desfase = desfaseChileMin(new Date(comoUtc));
  let resultado = new Date(comoUtc - desfase * 60000);
  const desfase2 = desfaseChileMin(resultado);
  if (desfase2 !== desfase) resultado = new Date(comoUtc - desfase2 * 60000);
  return resultado;
}

/** Instante (Date o texto ISO de Google) -> 'AAAA-MM-DD HH:MM' en hora de Chile */
function aTextoChile(instante) {
  return ahoraChile(instante instanceof Date ? instante : new Date(instante)).texto;
}

/** Acepta 'AAAA-MM-DDTHH:MM' o 'AAAA-MM-DD HH:MM' y devuelve 'AAAA-MM-DD HH:MM' */
function normalizarFechaHora(valor) {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim().replace("T", " ").slice(0, 16);
  const [fecha, hora] = limpio.split(" ");
  if (!REGEX_FECHA.test(fecha || "") || !REGEX_HORA.test(hora || "")) return null;
  return `${fecha} ${hora}`;
}

module.exports = {
  REGEX_FECHA,
  REGEX_HORA,
  aMinutos,
  aHora,
  diaSemanaIso,
  sumarDias,
  ahoraChile,
  normalizarFechaHora,
  chileADate,
  aTextoChile,
};
