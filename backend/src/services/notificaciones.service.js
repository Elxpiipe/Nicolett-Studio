// src/services/notificaciones.service.js
// Correos automaticos a la clienta: reserva confirmada, hora apartada (transferencia),
// cambio de hora, cancelacion y compra pagada. Se envian en segundo plano: si el
// correo falla, la reserva o la compra NO se ven afectadas.
const citaModel = require("../models/cita.model");
const ventaModel = require("../models/venta.model");
const { reglasAgenda } = require("../models/configuracion.model");
const { enviarCorreo } = require("../utils/mailer");
const { formatearPrecio } = require("../utils/formatoTexto");

const DIRECCION = "Avenida Bernardo O'Higgins 979, Buin";
const WHATSAPP = "+56 9 4032 2551";
const urlSitio = () => (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function fechaLarga(texto) {
  const f = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(`${texto.slice(0, 10)}T12:00:00`)
  );
  return `${f.charAt(0).toUpperCase()}${f.slice(1)}, ${texto.slice(11, 16)}`;
}

/** Plantilla con la identidad del salon (estilos en linea: los correos no leen CSS externo) */
function plantilla({ titulo, intro, filas = [], bloques = [], boton }) {
  const tabla = filas
    .map(
      ([k, v, destacado]) => `
      <tr>
        <td style="padding:8px 0;color:#6b5b4b;font-size:14px;border-top:1px dashed #efe3d3;">${esc(k)}</td>
        <td style="padding:8px 0;text-align:right;font-size:14px;border-top:1px dashed #efe3d3;${destacado ? "font-weight:bold;color:#8c6a36;" : "color:#1f1a15;"}">${esc(v)}</td>
      </tr>`
    )
    .join("");
  const extras = bloques
    .filter((b) => b.lineas?.length)
    .map(
      (b) => `
      <div style="margin-top:18px;padding:14px 18px;border-radius:14px;background:${b.fondo || "#fbf1df"};">
        <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#4b3a2b;"><b>${esc(b.titulo)}</b></p>
        ${b.lineas.map((l) => `<p style="margin:4px 0;font-size:13px;color:#4b3a2b;">&#9829;&nbsp; ${esc(l)}</p>`).join("")}
      </div>`
    )
    .join("");
  return `
  <div style="background:#fcf9f4;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:auto;background:#ffffff;border:1px solid #ebdccb;border-radius:20px;padding:28px 26px;">
      <p style="margin:0;text-align:center;font-family:Georgia,serif;font-size:24px;letter-spacing:6px;color:#1f1a15;">NICOLETT</p>
      <p style="margin:2px 0 18px;text-align:center;font-size:10px;letter-spacing:5px;color:#6b5b4b;">STUDIO FANTASY</p>
      <div style="height:1px;background:linear-gradient(90deg,transparent,#e2c893,transparent);margin-bottom:20px;"></div>
      <h1 style="margin:0 0 8px;font-family:Georgia,serif;font-style:italic;font-weight:normal;font-size:26px;color:#8c6a36;text-align:center;">${esc(titulo)}</h1>
      <p style="margin:0 0 18px;font-size:15px;color:#4b3a2b;text-align:center;">${intro}</p>
      <table style="width:100%;border-collapse:collapse;">${tabla}</table>
      ${extras}
      ${boton ? `<p style="text-align:center;margin:24px 0 4px;"><a href="${boton.url}" style="background:#4b3a2b;color:#fcf9f4;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;">${esc(boton.texto)}</a></p>` : ""}
      <p style="margin:26px 0 0;text-align:center;font-size:12px;color:#6b5b4b;">
        ${esc(DIRECCION)} · WhatsApp ${esc(WHATSAPP)} · @nicolettstudiofantasy<br/>
        <span style="letter-spacing:3px;">CUIDA TU BELLEZA, SIEMPRE &#9825;</span>
      </p>
    </div>
  </div>`;
}

function texto({ titulo, intro, filas = [], bloques = [] }) {
  return [
    `${titulo}\n`,
    intro.replace(/<[^>]+>/g, ""),
    "",
    ...filas.map(([k, v]) => `${k}: ${v}`),
    ...bloques.filter((b) => b.lineas?.length).flatMap((b) => ["", b.titulo.toUpperCase(), ...b.lineas.map((l) => `- ${l}`)]),
    "",
    `${DIRECCION} · WhatsApp ${WHATSAPP}`,
  ].join("\n");
}

function filasCita(c) {
  return [
    ["Servicio", c.servicio],
    ["Día y hora", fechaLarga(c.fecha_hora_inicio)],
    ["Profesional", c.profesional],
    ["Código", c.codigo_cita],
    ["Valor del servicio", `${c.tipo_precio === "DESDE" ? "Desde " : ""}${formatearPrecio(c.precio)}`],
    ["Abono", `${formatearPrecio(c.monto_abono)} ${c.estado_abono === "APROBADO" ? "(pagado)" : "(pendiente)"}`, true],
    ["Pagas en el salón", formatearPrecio(c.precio - (c.estado_abono === "APROBADO" ? c.monto_abono : 0))],
  ];
}

function bloquesCita(c) {
  const { horasCambio } = reglasAgenda();
  return [
    { titulo: "Antes de tu cita", lineas: (c.indicaciones || "").split("\n").map((l) => l.trim()).filter(Boolean) },
    {
      titulo: "Reglas de agendamiento",
      fondo: "#f5eee4",
      lineas: [
        "El abono se descuenta del total del servicio.",
        `Cambio de hora solo con ${horasCambio} horas de anticipación, desde "Mis citas".`,
        "Si no cumples el plazo o no asistes, se pierde el abono.",
      ],
    },
  ];
}

async function enviar(datos, destinatario) {
  return enviarCorreo({ destinatario, asunto: `${datos.asunto} — Nicolett Studio Fantasy`, html: plantilla(datos), texto: texto(datos) });
}

const NOTIFICACIONES = {
  async reservaConfirmada(codigo) {
    const c = citaModel.obtenerPorCodigo(codigo);
    if (!c) return;
    return enviar(
      {
        asunto: "Tu hora está confirmada",
        titulo: "¡Tu hora está confirmada!",
        intro: `Hola ${esc(c.cliente.split(" ")[0])}, recibimos tu abono. Te esperamos.`,
        filas: filasCita(c),
        bloques: bloquesCita(c),
        boton: { texto: "Ver mis citas", url: `${urlSitio()}/panel/mis-citas` },
      },
      c.email_cliente
    );
  },

  async reservaApartada(codigo) {
    const c = citaModel.obtenerPorCodigo(codigo);
    if (!c) return;
    const mensaje = encodeURIComponent(`Hola, quiero pagar el abono de mi reserva ${c.codigo_cita} por transferencia.`);
    return enviar(
      {
        asunto: "Tu hora está apartada",
        titulo: "Tu hora está apartada",
        intro: `Hola ${esc(c.cliente.split(" ")[0])}, te guardamos la hora hasta las <b>${esc(c.fecha_expiracion_abono?.slice(11, 16))}</b>. Escríbenos por WhatsApp para pagar el abono por transferencia; si no llega a tiempo, la hora se libera.`,
        filas: filasCita(c),
        bloques: bloquesCita(c),
        boton: { texto: "Coordinar por WhatsApp", url: `https://wa.me/56940322551?text=${mensaje}` },
      },
      c.email_cliente
    );
  },

  async citaReagendada(codigo) {
    const c = citaModel.obtenerPorCodigo(codigo);
    if (!c) return;
    return enviar(
      {
        asunto: "Cambiaste tu hora",
        titulo: "Tu nueva hora",
        intro: `Hola ${esc(c.cliente.split(" ")[0])}, tu cita quedó para el <b>${esc(fechaLarga(c.fecha_hora_inicio))}</b>. Tu abono se mantiene.`,
        filas: filasCita(c),
        bloques: bloquesCita(c),
        boton: { texto: "Ver mis citas", url: `${urlSitio()}/panel/mis-citas` },
      },
      c.email_cliente
    );
  },

  async citaCancelada(codigo) {
    const c = citaModel.obtenerPorCodigo(codigo);
    if (!c) return;
    return enviar(
      {
        asunto: "Reserva cancelada",
        titulo: "Tu reserva fue cancelada",
        intro: `Hola ${esc(c.cliente.split(" ")[0])}, cancelamos tu reserva de <b>${esc(c.servicio)}</b> del ${esc(fechaLarga(c.fecha_hora_inicio))}.${
          c.estado_abono === "APROBADO" ? " Según las reglas del salón, el abono no es reembolsable." : ""
        }`,
        filas: [["Código", c.codigo_cita]],
        boton: { texto: "Reservar otra hora", url: `${urlSitio()}/reservar` },
      },
      c.email_cliente
    );
  },

  async compraPagada(codigo) {
    const v = ventaModel.obtenerPorCodigo(codigo);
    if (!v) return;
    return enviar(
      {
        asunto: "Gracias por tu compra",
        titulo: "¡Gracias por tu compra!",
        intro: `Hola ${esc((v.cliente || "").split(" ")[0])}, tu pago está confirmado. Retira tu pedido en el salón mostrando el código <b>${esc(v.codigo_venta)}</b>.`,
        filas: [
          ...v.items.map((i) => [`${i.cantidad} × ${i.descripcion}`, formatearPrecio(i.subtotal)]),
          ["Total pagado", formatearPrecio(v.total), true],
          ["Retiro", DIRECCION],
        ],
        boton: { texto: "Ver mis pedidos", url: `${urlSitio()}/panel/mis-pedidos` },
      },
      v.email_cliente
    );
  },
};

/** Dispara un correo sin esperar ni bloquear la respuesta */
function notificar(tipo, codigo) {
  setImmediate(() =>
    NOTIFICACIONES[tipo](codigo).catch((err) => console.warn(`Notificación ${tipo} (${codigo}) falló: ${err.message}`))
  );
}

module.exports = { notificar, NOTIFICACIONES, plantilla };
