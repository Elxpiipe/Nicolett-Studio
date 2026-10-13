// src/utils/formatoTexto.js — formatos para textos generados en el backend
const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

function formatearPrecio(monto) {
  return clp.format(Number(monto) || 0);
}

module.exports = { formatearPrecio };
