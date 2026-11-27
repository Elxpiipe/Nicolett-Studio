// src/whatsapp/avisos.js
// Avisos que el agente envia solo (sin que la clienta escriba), para reservas
// hechas por WhatsApp: abono confirmado y hora liberada por falta de abono.
// Llegan pocos minutos u horas despues de que la clienta escribio, dentro de la
// ventana de 24 horas en que WhatsApp permite responder sin plantillas.
const db = require("../../db/connection");
const citaModel = require("../models/cita.model");
const modelo = require("./whatsapp.model");
const envio = require("./envio");
const M = require("./mensajes");
const F = require("./formato");

const MENU = { id: "menu:inicio", titulo: "Menú principal" };

async function datosDeCita(codigo) {
  return db
    .prepare(
      `SELECT c.origen, cl.id_usuario FROM citas c JOIN clientes cl ON cl.id_cliente = c.id_cliente WHERE c.codigo_cita = ?`
    )
    .get(codigo);
}

const MENSAJES = {
  async reservaConfirmada(cita) {
    const indicaciones = cita.indicaciones ? `\n\n*Antes de venir:* ${cita.indicaciones}` : "";
    return M.botones(
      `¡Tu hora está confirmada! Recibimos tu abono de ${F.precio(cita.monto_abono)}.\n\n${F.detalleCita(cita)}${indicaciones}\n\nTe esperamos en ${F.DIRECCION}.`,
      [{ id: "menu:citas", titulo: "Ver mis citas" }, MENU]
    );
  },

  async reservaVencida(cita) {
    return M.botones(
      `Tu hora de ${cita.servicio} del ${F.fechaHoraLarga(cita.fecha_hora_inicio)} se liberó porque no recibimos el abono a tiempo. Si quieres, puedes reservar de nuevo.`,
      [{ id: "menu:reservar", titulo: "Reservar otra vez" }, MENU]
    );
  },
};

// Avisos ya enviados (el de "hora confirmada" se puede disparar desde dos lugares)
const yaEnviados = new Set();

/** tipo: el mismo nombre que usan los correos (notificaciones.service) */
async function notificar(tipo, codigo) {
  if (!MENSAJES[tipo]) return;
  const clave = `${tipo}:${codigo}`;
  if (yaEnviados.has(clave)) return;
  yaEnviados.add(clave);

  const origen = await datosDeCita(codigo);
  if (!origen) return console.log(`[WhatsApp] Aviso ${tipo} (${codigo}): la reserva no existe`);
  if (origen.origen !== "WHATSAPP") return; // reserva hecha en la pagina: solo correo
  const telefono = await modelo.telefonoDeUsuario(origen.id_usuario);
  if (!telefono) {
    return console.log(`[WhatsApp] Aviso ${tipo} (${codigo}): la clienta no tiene un numero de WhatsApp asociado`);
  }
  const cita = await citaModel.obtenerPorCodigo(codigo);
  if (!cita) return;

  const mensaje = await MENSAJES[tipo](cita);
  await envio.enviar(telefono, mensaje);
  console.log(`[WhatsApp] Aviso ${tipo} (${codigo}) enviado a ${telefono}`);

  // Si la clienta responde "1" o toca un boton, el agente sabe a que se refiere
  const sesion = await modelo.obtenerSesion(telefono);
  if (sesion.estado !== "HUMANO") {
    await modelo.guardarSesion(telefono, {
      estado: "MENU",
      datos: { opciones: M.opcionesDe(mensaje), ultimo: mensaje },
      humano_desde: null,
      pendiente_respuesta: sesion.pendiente_respuesta,
    });
  }
}

/** Igual que notificar, pero sin esperar ni dejar caer el proceso si falla */
function notificarEnSegundoPlano(tipo, codigo) {
  db.enSegundoPlano(() =>
    notificar(tipo, codigo).catch((err) => console.warn(`[WhatsApp] Aviso ${tipo} (${codigo}) falló: ${err.message}`))
  );
}

module.exports = { notificar, notificarEnSegundoPlano };
