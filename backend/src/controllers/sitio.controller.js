// src/controllers/sitio.controller.js
// Datos PUBLICOS para el sitio (Inicio, Nosotras, Contacto).
const profesionalModel = require("../models/profesional.model");
const { aMinutos, aHora } = require("../utils/fechas");

/** GET /api/sitio/equipo — profesionales visibles para "Nosotras" */
function equipo(req, res) {
  return res.json({ datos: profesionalModel.listarPublico() });
}

/**
 * GET /api/sitio/horario — horario de atencion del salon, calculado como la union
 * de los horarios de las profesionales activas. Se actualiza solo.
 * { datos: [{ dia_semana: 1, tramos: [{ desde: '10:00', hasta: '19:00' }] }, ...] }
 */
function horario(req, res) {
  const porDia = new Map();
  for (const t of profesionalModel.tramosActivos()) {
    if (!porDia.has(t.dia_semana)) porDia.set(t.dia_semana, []);
    porDia.get(t.dia_semana).push([aMinutos(t.hora_inicio), aMinutos(t.hora_fin)]);
  }

  const datos = [];
  for (let dia = 1; dia <= 7; dia++) {
    const intervalos = (porDia.get(dia) || []).sort((a, b) => a[0] - b[0]);
    const unidos = [];
    for (const [ini, fin] of intervalos) {
      const ultimo = unidos[unidos.length - 1];
      if (ultimo && ini <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], fin);
      else unidos.push([ini, fin]);
    }
    datos.push({ dia_semana: dia, tramos: unidos.map(([d, h]) => ({ desde: aHora(d), hasta: aHora(h) })) });
  }
  return res.json({ datos });
}

module.exports = { equipo, horario };
