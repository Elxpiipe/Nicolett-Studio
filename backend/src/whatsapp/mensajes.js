// src/whatsapp/mensajes.js
// Mensajes del agente en un formato propio, simple, y su traduccion al formato de
// la API de Meta. Respeta los limites de WhatsApp (largo de titulos, cantidad de
// botones y de filas) para que Meta nunca rechace un mensaje por eso.
//
//   { tipo: "texto",   texto }
//   { tipo: "botones", texto, botones: [{ id, titulo }], pie }            (max 3 botones)
//   { tipo: "lista",   texto, boton, filas: [{ id, titulo, descripcion }], pie } (max 10 filas)
//   { tipo: "enlace",  texto, boton, url }                                (boton que abre una pagina)

const LIMITES = {
  texto: 4096,
  cuerpo: 1024,
  pie: 60,
  tituloBoton: 20,
  tituloFila: 24,
  descripcionFila: 72,
  botonLista: 20,
  botones: 3,
  filas: 10,
};

function cortar(texto, max) {
  const t = String(texto ?? "").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

const texto = (t) => ({ tipo: "texto", texto: t });
const botones = (t, lista, pie) => ({ tipo: "botones", texto: t, botones: lista.slice(0, LIMITES.botones), pie });
const lista = (t, boton, filas, pie) => ({ tipo: "lista", texto: t, boton, filas: filas.slice(0, LIMITES.filas), pie });
const enlace = (t, boton, url) => ({ tipo: "enlace", texto: t, boton, url });

/** Opciones que la clienta puede elegir en este mensaje (para aceptar "1", "2"... escritos) */
function opcionesDe(mensaje) {
  if (mensaje.tipo === "botones") return mensaje.botones.map((b) => ({ id: b.id, titulo: b.titulo }));
  if (mensaje.tipo === "lista") return mensaje.filas.map((f) => ({ id: f.id, titulo: f.titulo }));
  return [];
}

/** Version en texto plano (para el historial del panel y los avisos por correo) */
function resumen(mensaje) {
  switch (mensaje.tipo) {
    case "botones":
      return `${mensaje.texto}\n${mensaje.botones.map((b) => `[${b.titulo}]`).join(" ")}`;
    case "lista":
      // El texto de las listas del agente ya trae las opciones numeradas
      return `${mensaje.texto}\n[${mensaje.boton || "Ver opciones"}]`;
    case "enlace":
      return `${mensaje.texto}\n[${mensaje.boton}] ${mensaje.url}`;
    default:
      return mensaje.texto;
  }
}

/** Formato que espera POST /{phone-number-id}/messages de la Cloud API */
function aPayloadMeta(telefono, mensaje) {
  const base = { messaging_product: "whatsapp", recipient_type: "individual", to: telefono };
  const pie = mensaje.pie ? { footer: { text: cortar(mensaje.pie, LIMITES.pie) } } : {};

  if (mensaje.tipo === "botones") {
    return {
      ...base,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: cortar(mensaje.texto, LIMITES.cuerpo) },
        ...pie,
        action: {
          buttons: mensaje.botones.map((b) => ({
            type: "reply",
            reply: { id: b.id, title: cortar(b.titulo, LIMITES.tituloBoton) },
          })),
        },
      },
    };
  }

  if (mensaje.tipo === "lista") {
    return {
      ...base,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: cortar(mensaje.texto, LIMITES.cuerpo) },
        ...pie,
        action: {
          button: cortar(mensaje.boton || "Ver opciones", LIMITES.botonLista),
          sections: [
            {
              title: cortar("Opciones", 24),
              rows: mensaje.filas.map((f) => ({
                id: f.id,
                title: cortar(f.titulo, LIMITES.tituloFila),
                ...(f.descripcion ? { description: cortar(f.descripcion, LIMITES.descripcionFila) } : {}),
              })),
            },
          ],
        },
      },
    };
  }

  if (mensaje.tipo === "enlace") {
    return {
      ...base,
      type: "interactive",
      interactive: {
        type: "cta_url",
        body: { text: cortar(mensaje.texto, LIMITES.cuerpo) },
        action: { name: "cta_url", parameters: { display_text: cortar(mensaje.boton, LIMITES.tituloBoton), url: mensaje.url } },
      },
    };
  }

  return { ...base, type: "text", text: { body: cortar(mensaje.texto, LIMITES.texto), preview_url: false } };
}

module.exports = { texto, botones, lista, enlace, opcionesDe, resumen, aPayloadMeta, cortar, LIMITES };
