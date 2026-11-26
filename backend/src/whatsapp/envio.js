// src/whatsapp/envio.js
// Envia mensajes por la WhatsApp Cloud API de Meta y los guarda en el historial.
// Sin credenciales (o en el simulador) solo se guardan: nada sale a internet.
const config = require("./config");
const modelo = require("./whatsapp.model");
const { aPayloadMeta, resumen } = require("./mensajes");

const urlGraph = (ruta) => `https://graph.facebook.com/${config.versionApi()}/${ruta}`;

/** Llamada autenticada a la Graph API. Lanza un error con el mensaje de Meta si falla */
async function graph(ruta, { metodo = "GET", body } = {}) {
  const respuesta = await fetch(urlGraph(ruta), {
    method: metodo,
    headers: { Authorization: `Bearer ${config.token()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const e = datos.error || {};
    throw new Error(`${e.message || `Meta respondió ${respuesta.status}`}${e.code ? ` (código ${e.code})` : ""}`);
  }
  return datos;
}

/**
 * Envia uno o varios mensajes a un numero, en orden.
 * autor: 'bot' (el agente) o 'salon' (respuesta escrita desde el panel).
 */
async function enviar(telefono, mensajes, { autor = "bot" } = {}) {
  const lista = Array.isArray(mensajes) ? mensajes : [mensajes];
  const simulado = config.esSimulado(telefono);
  for (const mensaje of lista) {
    let estado = "simulado";
    let wa_id = null;
    let error = null;
    if (!simulado) {
      if (!config.conectado()) {
        estado = "sin_conexion";
        error = "Faltan WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID en el .env";
      } else {
        try {
          const r = await graph(`${config.idNumero()}/messages`, { metodo: "POST", body: aPayloadMeta(telefono, mensaje) });
          wa_id = r.messages?.[0]?.id || null;
          estado = "enviado";
        } catch (err) {
          estado = "error";
          error = err.message;
          console.warn(`[WhatsApp] No se pudo enviar a ${telefono}: ${err.message}`);
        }
      }
    }
    await modelo.registrarMensaje({
      telefono,
      direccion: "salida",
      autor,
      tipo: mensaje.tipo,
      texto: resumen(mensaje),
      contenido: mensaje,
      wa_id,
      estado,
      error,
    });
  }
}

/** Datos del numero conectado (para comprobar las credenciales desde el panel) */
async function probarConexion() {
  if (!config.conectado()) throw new Error("Faltan WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID en el .env");
  const d = await graph(`${config.idNumero()}?fields=display_phone_number,verified_name,quality_rating`);
  return { numero: d.display_phone_number, nombre: d.verified_name, calidad: d.quality_rating };
}

/** Descarga una imagen que mando la clienta (ej. comprobante de transferencia) */
async function descargarMedia(idMedia) {
  if (!config.conectado()) throw new Error("WhatsApp no está conectado");
  const info = await graph(encodeURIComponent(idMedia));
  const respuesta = await fetch(info.url, {
    headers: { Authorization: `Bearer ${config.token()}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!respuesta.ok) throw new Error(`No se pudo descargar el archivo (${respuesta.status})`);
  return { tipo: info.mime_type || respuesta.headers.get("content-type"), datos: Buffer.from(await respuesta.arrayBuffer()) };
}

module.exports = { enviar, probarConexion, descargarMedia };
