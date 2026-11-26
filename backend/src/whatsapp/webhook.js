// src/whatsapp/webhook.js
// Recibe los avisos de Meta: mensajes nuevos de las clientas y el estado de los
// mensajes enviados (entregado, leido, fallido).
const crypto = require("crypto");
const config = require("./config");
const modelo = require("./whatsapp.model");
const bot = require("./bot");

/** Los mensajes de un mismo numero se responden de a uno y en orden */
const colas = new Map();
function enCola(telefono, tarea) {
  const anterior = colas.get(telefono) || Promise.resolve();
  const siguiente = anterior
    .then(tarea)
    .catch((err) => console.error(`[WhatsApp] Error procesando un mensaje de ${telefono}:`, err))
    .finally(() => {
      if (colas.get(telefono) === siguiente) colas.delete(telefono);
    });
  colas.set(telefono, siguiente);
  return siguiente;
}

/** GET /api/whatsapp/webhook — Meta verifica la URL al configurarla */
function verificar(req, res) {
  const modo = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const desafio = req.query["hub.challenge"];
  if (modo === "subscribe" && config.tokenVerificacion() && token === config.tokenVerificacion()) {
    return res.status(200).type("text/plain").send(String(desafio ?? ""));
  }
  return res.sendStatus(403);
}

/** La firma X-Hub-Signature-256 prueba que el aviso viene de Meta y no de otra persona */
function firmaValida(req) {
  const secreto = config.secretoApp();
  if (!secreto) return true; // sin secreto configurado (desarrollo) no se puede comprobar
  const firma = req.get("x-hub-signature-256") || "";
  if (!req.rawBody || !firma.startsWith("sha256=")) return false;
  const esperada = Buffer.from(`sha256=${crypto.createHmac("sha256", secreto).update(req.rawBody).digest("hex")}`);
  const recibida = Buffer.from(firma);
  return esperada.length === recibida.length && crypto.timingSafeEqual(esperada, recibida);
}

/** Convierte un mensaje de Meta al formato que entiende el bot */
function aEntrada(m) {
  const base = { wa_id: m.id };
  switch (m.type) {
    case "text":
      return { ...base, tipo: "texto", texto: m.text?.body || "" };
    case "interactive": {
      const r = m.interactive?.button_reply || m.interactive?.list_reply || {};
      return { ...base, tipo: "opcion", texto: r.title || "", id_opcion: r.id };
    }
    case "button": // respuesta rapida de una plantilla
      return { ...base, tipo: "opcion", texto: m.button?.text || "", id_opcion: m.button?.payload };
    case "image":
      return { ...base, tipo: "imagen", texto: m.image?.caption || "[Imagen]", media_id: m.image?.id };
    case "document":
      return { ...base, tipo: "documento", texto: m.document?.caption || m.document?.filename || "[Documento]", media_id: m.document?.id };
    case "audio":
      return { ...base, tipo: "otro", texto: "[Audio]" };
    case "sticker":
      return { ...base, tipo: "otro", texto: "[Sticker]" };
    case "location":
      return { ...base, tipo: "otro", texto: "[Ubicación]" };
    default:
      return { ...base, tipo: "otro", texto: `[${m.type || "Mensaje"}]` };
  }
}

/** POST /api/whatsapp/webhook */
function recibir(req, res) {
  if (!firmaValida(req)) {
    console.warn("[WhatsApp] Aviso rechazado: la firma no coincide con WHATSAPP_APP_SECRET");
    return res.sendStatus(401);
  }
  // Meta exige responder rapido (si no, reintenta): se procesa despues de responder
  res.sendStatus(200);
  procesar(req.body).catch((err) => console.error("[WhatsApp] Error leyendo el aviso de Meta:", err));
}

async function procesar(cuerpo) {
  if (cuerpo?.object !== "whatsapp_business_account") return;
  for (const entrada of cuerpo.entry || []) {
    for (const cambio of entrada.changes || []) {
      const v = cambio.value || {};
      // Solo mensajes del numero configurado (una app puede tener varios numeros)
      if (config.idNumero() && v.metadata?.phone_number_id && v.metadata.phone_number_id !== config.idNumero()) continue;

      const perfiles = new Map((v.contacts || []).map((c) => [c.wa_id, c.profile?.name]));
      for (const m of v.messages || []) {
        const telefono = String(m.from || "").replace(/\D/g, "");
        if (!telefono) continue;
        enCola(telefono, () => bot.recibir({ telefono, entrada: aEntrada(m), nombrePerfil: perfiles.get(m.from) }));
      }
      for (const s of v.statuses || []) {
        const error = s.errors?.[0] ? `${s.errors[0].title || ""} ${s.errors[0].error_data?.details || ""}`.trim() : null;
        await modelo.actualizarEstadoMensaje(s.id, s.status, error);
      }
    }
  }
}

module.exports = { verificar, recibir, procesar, enCola, aEntrada };
