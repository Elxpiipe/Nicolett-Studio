// src/whatsapp/formato.js
// Textos cortos y claros para WhatsApp: fechas en español, precios, duraciones.
const crypto = require("crypto");
const { formatearPrecio } = require("../utils/formatoTexto");
const { ahoraChile, sumarDias } = require("../utils/fechas");
const config = require("./config");

const DIRECCION = "Avenida Bernardo O'Higgins 979, Buin";
const MAPA = `https://maps.google.com/?q=${encodeURIComponent("Avenida Bernardo O'Higgins 979, Buin, Chile")}`;

const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function partes(fecha) {
  const [a, m, d] = fecha.slice(0, 10).split("-").map(Number);
  return { dia: d, mes: m - 1, semana: new Date(Date.UTC(a, m - 1, d)).getUTCDay() };
}

/** '2026-11-21' -> 'Vie 21 nov' */
function fechaCorta(fecha) {
  const p = partes(fecha);
  return `${DIAS_CORTOS[p.semana]} ${p.dia} ${MESES_CORTOS[p.mes]}`;
}

/** '2026-11-21' -> 'viernes 21 de noviembre' */
function fechaLarga(fecha) {
  const p = partes(fecha);
  return `${DIAS_LARGOS[p.semana]} ${p.dia} de ${MESES_LARGOS[p.mes]}`;
}

/** '2026-11-21 10:30' -> 'viernes 21 de noviembre a las 10:30' */
function fechaHoraLarga(texto) {
  return `${fechaLarga(texto)} a las ${texto.slice(11, 16)}`;
}

/** 'Hoy', 'Mañana' o '' segun la fecha */
function relativo(fecha) {
  const hoy = ahoraChile().fecha;
  if (fecha === hoy) return "Hoy";
  if (fecha === sumarDias(hoy, 1)) return "Mañana";
  return "";
}

function duracion(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const precio = (monto) => formatearPrecio(monto);

/** Precio de un servicio tal como se muestra en el catalogo */
function precioServicio(s) {
  if (s.tipo_precio === "EVALUACION") return "según evaluación";
  if (s.variantes?.length) return `desde ${precio(s.precio_desde)}`;
  return precio(s.precio);
}

const mayuscula = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const primerNombre = (nombre) => String(nombre || "").trim().split(/\s+/)[0] || "";

/** Quita tildes, mayusculas y espacios de mas (para entender lo que escribe la clienta) */
function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[¡!¿?.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function estadoCita(c) {
  if (c.estado === "CONFIRMADA") return "Confirmada";
  if (c.estado === "PENDIENTE_ABONO") return c.vencida ? "Abono vencido" : "Esperando abono";
  if (c.estado === "CANCELADA") return "Cancelada";
  if (c.estado === "ATENDIDA") return "Atendida";
  return c.estado;
}

/** Bloque con los datos de una cita (servicio, dia, profesional, codigo) */
function detalleCita(c) {
  return [
    `*${c.servicio}*`,
    mayuscula(fechaHoraLarga(c.fecha_hora_inicio)),
    `Con ${c.profesional}`,
    `Código: ${c.codigo_cita}`,
  ].join("\n");
}

/** Firma del enlace de pago: solo quien recibio el enlace puede abrirlo */
function firmaPago(codigo) {
  return crypto
    .createHmac("sha256", process.env.JWT_SECRET || "nicolett-sync")
    .update(`pagar:${codigo}`)
    .digest("hex")
    .slice(0, 32);
}

function firmaValida(codigo, firma) {
  const esperada = Buffer.from(firmaPago(codigo));
  const recibida = Buffer.from(String(firma || ""));
  return esperada.length === recibida.length && crypto.timingSafeEqual(esperada, recibida);
}

const enlacePago = (codigo) => `${config.urlBackend()}/api/whatsapp/pagar/${codigo}?f=${firmaPago(codigo)}`;

module.exports = {
  DIRECCION,
  MAPA,
  fechaCorta,
  fechaLarga,
  fechaHoraLarga,
  relativo,
  duracion,
  precio,
  precioServicio,
  mayuscula,
  primerNombre,
  normalizar,
  estadoCita,
  detalleCita,
  firmaPago,
  firmaValida,
  enlacePago,
};
