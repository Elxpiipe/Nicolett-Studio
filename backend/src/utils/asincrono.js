// src/utils/asincrono.js
// Express 4 no captura errores de funciones async: este envoltorio los
// pasa al manejador de errores central (server.js).
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
