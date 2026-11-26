// src/whatsapp/config.js
// Configuracion del agente de WhatsApp (WhatsApp Cloud API de Meta).
// Todo sale del .env; si falta el token o el id del numero, el agente funciona
// igual en "modo simulador" (panel → WhatsApp → Simulador) sin enviar nada a Meta.

const config = {
  token: () => (process.env.WHATSAPP_TOKEN || "").trim(),
  idNumero: () => (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim(),
  tokenVerificacion: () => (process.env.WHATSAPP_VERIFY_TOKEN || "").trim(),
  secretoApp: () => (process.env.WHATSAPP_APP_SECRET || "").trim(),
  versionApi: () => (process.env.WHATSAPP_API_VERSION || "v23.0").trim(),
  // Correo que recibe el aviso cuando una clienta pide hablar con una persona
  correoAviso: () => (process.env.WHATSAPP_AVISO_EMAIL || process.env.SMTP_USER || "").trim(),
  urlBackend: () => (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, ""),
  urlFrontend: () => (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, ""),
};

/** ¿Hay credenciales para enviar mensajes reales por la API de Meta? */
config.conectado = () => Boolean(config.token() && config.idNumero());

// Las conversaciones del simulador del panel se guardan con este prefijo
// (ej. "sim-56912345678"): nunca se envian a Meta.
config.PREFIJO_SIMULADOR = "sim-";
config.esSimulado = (telefono) => String(telefono).startsWith(config.PREFIJO_SIMULADOR);

// Correo interno para las clientas creadas por WhatsApp (no tienen correo).
// El dominio .invalid esta reservado: nunca se envia nada ahi.
config.DOMINIO_CORREO = "whatsapp.invalid";

module.exports = config;
