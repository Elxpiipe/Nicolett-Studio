// src/routes/whatsapp.routes.js — agente de WhatsApp
//   Publicas:  webhook de Meta, enlace de pago del abono y pagina de resultado
//   Panel:     conversaciones, responder como salon, simulador y configuracion (Administrador)
const { Router } = require("express");
const { body, param, validationResult } = require("express-validator");
const { requiereAutenticacion, requiereRol } = require("../middleware/auth.middleware");
const asincrono = require("../utils/asincrono");
const config = require("../whatsapp/config");
const modelo = require("../whatsapp/whatsapp.model");
const webhook = require("../whatsapp/webhook");
const bot = require("../whatsapp/bot");
const envio = require("../whatsapp/envio");
const M = require("../whatsapp/mensajes");
const F = require("../whatsapp/formato");
const db = require("../../db/connection");
const citaModel = require("../models/cita.model");
const webpay = require("../services/webpay.service");
const { obtenerTexto, obtenerNumero, guardarValor } = require("../models/configuracion.model");

const router = Router();

function manejarErrores(req, res, next) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({
      error: "Datos invalidos",
      detalles: errores.array().map((e) => ({ campo: e.path, mensaje: e.msg })),
    });
  }
  next();
}

const soloAdmin = [requiereAutenticacion, requiereRol("Administrador")];
const telefonoParam = param("telefono").matches(/^(sim-)?\d{8,15}$/).withMessage("Número inválido");

// ------------------------------------------------------------------
// Webhook de Meta
// ------------------------------------------------------------------

router.get("/webhook", webhook.verificar);
router.post("/webhook", webhook.recibir);

// ------------------------------------------------------------------
// Pago del abono desde el enlace que envia el agente
// ------------------------------------------------------------------

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Pagina simple con la identidad del salon (se abre en el celular de la clienta) */
function pagina(titulo, texto, extra = "") {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)} · Nicolett Studio Fantasy</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fcf9f4;font-family:Arial,Helvetica,sans-serif;color:#1f1a15;padding:16px;box-sizing:border-box}
  main{max-width:420px;width:100%;background:#fff;border:1px solid #ebdccb;border-radius:20px;padding:28px 24px;text-align:center}
  .marca{font-family:Georgia,serif;letter-spacing:6px;font-size:22px;margin:0}
  .sub{font-size:10px;letter-spacing:5px;color:#6b5b4b;margin:2px 0 20px}
  h1{font-family:Georgia,serif;font-style:italic;font-weight:normal;color:#8c6a36;font-size:26px;margin:0 0 10px}
  p{font-size:16px;line-height:1.5;color:#4b3a2b}
  .boton{display:inline-block;margin-top:14px;background:#4b3a2b;color:#fcf9f4;padding:14px 26px;border-radius:999px;text-decoration:none;font-size:16px;border:0;cursor:pointer}
</style></head>
<body><main><p class="marca">NICOLETT</p><p class="sub">STUDIO FANTASY</p><h1>${esc(titulo)}</h1><p>${texto}</p>${extra}</main></body></html>`;
}

const botonWhatsApp = () =>
  process.env.WHATSAPP_NUMERO_PUBLICO
    ? `<a class="boton" href="https://wa.me/${esc(process.env.WHATSAPP_NUMERO_PUBLICO.replace(/\D/g, ""))}">Volver a WhatsApp</a>`
    : "";

/** GET /api/whatsapp/pagar/:codigo?f=firma — lleva a la clienta al formulario de Webpay */
router.get(
  "/pagar/:codigo",
  asincrono(async (req, res) => {
    const codigo = String(req.params.codigo || "");
    if (!/^NS-\d{6}-[0-9A-F]{4}$/.test(codigo) || !F.firmaValida(codigo, req.query.f)) {
      return res.status(404).send(pagina("Enlace no válido", "Este enlace de pago no es válido. Pide uno nuevo por WhatsApp."));
    }
    const fila = await db
      .prepare(`SELECT cl.id_usuario FROM citas c JOIN clientes cl ON cl.id_cliente = c.id_cliente WHERE c.codigo_cita = ?`)
      .get(codigo);
    if (!fila) return res.status(404).send(pagina("Reserva no encontrada", "No encontramos esta reserva."));

    let pago;
    try {
      pago = await webpay.iniciarPago(codigo, fila.id_usuario);
    } catch (err) {
      const cita = await citaModel.obtenerPorCodigo(codigo);
      if (cita?.estado === "CONFIRMADA") {
        return res.send(pagina("Ya está pagado", "Tu abono ya fue recibido y tu hora está confirmada.", botonWhatsApp()));
      }
      return res
        .status(err.status && err.status < 500 ? 409 : 502)
        .send(
          pagina(
            "No se pudo abrir el pago",
            `${esc(err.message)}<br><br>Escribe <b>MENÚ</b> en WhatsApp para revisar tu reserva.`,
            botonWhatsApp()
          )
        );
    }
    // Webpay exige llegar con un formulario POST que lleve token_ws
    return res.send(
      pagina(
        "Te llevamos a Webpay",
        "Un momento, estamos abriendo el pago seguro de Transbank…",
        `<form id="webpay" method="post" action="${esc(pago.url)}"><input type="hidden" name="token_ws" value="${esc(pago.token)}">
         <button class="boton" type="submit">Ir a pagar</button></form>
         <script>document.getElementById("webpay").submit();</script>`
      )
    );
  })
);

/** GET /api/whatsapp/pago-resultado?estado= — a donde vuelve la clienta despues de Webpay */
router.get("/pago-resultado", (req, res) => {
  const textos = {
    aprobado: ["¡Pago recibido!", "Tu hora está confirmada. Te enviamos el detalle por WhatsApp. Ya puedes cerrar esta página."],
    rechazado: ["Pago rechazado", "El banco no aprobó el pago. Puedes intentarlo de nuevo desde <b>Mis citas</b> en WhatsApp mientras tu hora siga apartada."],
    anulado: ["Pago anulado", "Cancelaste el pago. Puedes intentarlo de nuevo desde <b>Mis citas</b> en WhatsApp mientras tu hora siga apartada."],
    tiempo_agotado: ["Se acabó el tiempo", "El formulario de pago se cerró por tiempo. Puedes intentarlo de nuevo desde <b>Mis citas</b> en WhatsApp."],
    revision: ["Estamos revisando tu pago", "Recibimos tu abono, pero la hora fue tomada justo antes. El equipo del salón te escribirá por WhatsApp para darte otra hora."],
  };
  const [titulo, texto] = textos[req.query.estado] || ["Algo salió mal", "No pudimos confirmar el pago. Escríbenos por WhatsApp y lo revisamos."];
  res.send(pagina(titulo, texto, botonWhatsApp()));
});

// ------------------------------------------------------------------
// Panel (Administrador)
// ------------------------------------------------------------------

router.get(
  "/estado",
  ...soloAdmin,
  asincrono(async (req, res) => {
    res.json({
      conectado: config.conectado(),
      idNumeroFinal: config.idNumero() ? config.idNumero().slice(-4) : null,
      tokenVerificacionDefinido: Boolean(config.tokenVerificacion()),
      secretoAppDefinido: Boolean(config.secretoApp()),
      versionApi: config.versionApi(),
      urlWebhook: `${config.urlBackend()}/api/whatsapp/webhook`,
      backendPublico: !/localhost|127\.0\.0\.1/.test(config.urlBackend()),
      correoAviso: config.correoAviso() || null,
      datosTransferencia: await obtenerTexto("WHATSAPP_DATOS_TRANSFERENCIA", ""),
      horasAtencionHumana: await obtenerNumero("WHATSAPP_HORAS_ATENCION_HUMANA", 24),
      pendientes: (await modelo.listarConversaciones()).filter((c) => c.pendiente_respuesta && !config.esSimulado(c.telefono)).length,
    });
  })
);

router.post(
  "/probar",
  ...soloAdmin,
  asincrono(async (req, res) => {
    try {
      res.json({ ok: true, ...(await envio.probarConexion()) });
    } catch (err) {
      res.json({ ok: false, error: err.message });
    }
  })
);

router.put(
  "/config",
  ...soloAdmin,
  body("datosTransferencia").optional().isString().isLength({ max: 800 }).withMessage("Máximo 800 caracteres"),
  body("horasAtencionHumana").optional().isInt({ min: 1, max: 168 }).withMessage("Entre 1 y 168 horas"),
  manejarErrores,
  asincrono(async (req, res) => {
    if (req.body.datosTransferencia !== undefined) {
      await guardarValor("WHATSAPP_DATOS_TRANSFERENCIA", req.body.datosTransferencia.trim());
    }
    if (req.body.horasAtencionHumana !== undefined) {
      await guardarValor("WHATSAPP_HORAS_ATENCION_HUMANA", Number(req.body.horasAtencionHumana));
    }
    res.json({ ok: true });
  })
);

router.get(
  "/conversaciones",
  ...soloAdmin,
  asincrono(async (req, res) => {
    const datos = (await modelo.listarConversaciones()).map((c) => ({ ...c, simulador: config.esSimulado(c.telefono) }));
    res.json({ datos });
  })
);

router.get(
  "/conversaciones/:telefono",
  ...soloAdmin,
  telefonoParam,
  manejarErrores,
  asincrono(async (req, res) => {
    const sesion = await modelo.obtenerSesion(req.params.telefono);
    res.json({ sesion: { estado: sesion.estado, pendiente_respuesta: sesion.pendiente_respuesta }, mensajes: await modelo.historial(req.params.telefono) });
  })
);

/** La administradora escribe a la clienta: el agente queda en pausa con esa clienta */
router.post(
  "/conversaciones/:telefono/responder",
  ...soloAdmin,
  telefonoParam,
  body("texto").isString().trim().isLength({ min: 1, max: 4000 }).withMessage("Escribe un mensaje"),
  manejarErrores,
  asincrono(async (req, res) => {
    const telefono = req.params.telefono;
    const sesion = await modelo.obtenerSesion(telefono);
    await envio.enviar(telefono, M.texto(req.body.texto), { autor: "salon" });
    await modelo.guardarSesion(telefono, {
      estado: "HUMANO",
      datos: {},
      humano_desde: new Date().toISOString().slice(0, 19).replace("T", " "),
      pendiente_respuesta: 0,
    });
    const mensajes = await modelo.historial(telefono);
    const ultimo = mensajes[mensajes.length - 1];
    res.json({ ok: ultimo?.estado !== "error", error: ultimo?.error, estadoAnterior: sesion.estado, mensajes });
  })
);

/** Devuelve la conversacion al agente (la clienta vuelve a ver los menus) */
router.post(
  "/conversaciones/:telefono/bot",
  ...soloAdmin,
  telefonoParam,
  manejarErrores,
  asincrono(async (req, res) => {
    await modelo.guardarSesion(req.params.telefono, { estado: "MENU", datos: {}, humano_desde: null, pendiente_respuesta: 0 });
    res.json({ ok: true });
  })
);

router.post(
  "/conversaciones/:telefono/atendida",
  ...soloAdmin,
  telefonoParam,
  manejarErrores,
  asincrono(async (req, res) => {
    await modelo.marcarPendiente(req.params.telefono, false);
    res.json({ ok: true });
  })
);

/** Imagen o documento que envio la clienta (ej. comprobante de transferencia) */
router.get(
  "/media/:id",
  ...soloAdmin,
  param("id").matches(/^\d{5,30}$/),
  manejarErrores,
  asincrono(async (req, res) => {
    try {
      const archivo = await envio.descargarMedia(req.params.id);
      res.set("Content-Type", archivo.tipo || "application/octet-stream").send(archivo.datos);
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  })
);

// ------------------------------------------------------------------
// Simulador: probar el agente desde el panel, sin Meta
// ------------------------------------------------------------------

router.post(
  "/simulador",
  ...soloAdmin,
  body("telefono").matches(/^\d{8,15}$/).withMessage("Escribe el número con código de país, solo dígitos (ej. 56912345678)"),
  body("texto").optional().isString().isLength({ max: 1000 }),
  body("id_opcion").optional().isString().isLength({ max: 200 }),
  body("tipo").optional().isIn(["texto", "opcion", "imagen"]),
  manejarErrores,
  asincrono(async (req, res) => {
    const telefono = `${config.PREFIJO_SIMULADOR}${req.body.telefono}`;
    const tipo = req.body.tipo || (req.body.id_opcion ? "opcion" : "texto");
    const entrada = {
      wa_id: null,
      tipo,
      texto: tipo === "imagen" ? "[Imagen: comprobante de prueba]" : String(req.body.texto || ""),
      id_opcion: req.body.id_opcion,
    };
    await webhook.enCola(telefono, () => bot.recibir({ telefono, entrada, nombrePerfil: "Simulador" }));
    res.json({ mensajes: await modelo.historial(telefono) });
  })
);

router.get(
  "/simulador/:telefono",
  ...soloAdmin,
  param("telefono").matches(/^\d{8,15}$/),
  manejarErrores,
  asincrono(async (req, res) => {
    res.json({ mensajes: await modelo.historial(`${config.PREFIJO_SIMULADOR}${req.params.telefono}`) });
  })
);

router.delete(
  "/simulador/:telefono",
  ...soloAdmin,
  param("telefono").matches(/^\d{8,15}$/),
  manejarErrores,
  asincrono(async (req, res) => {
    await modelo.borrarConversacion(`${config.PREFIJO_SIMULADOR}${req.params.telefono}`);
    res.json({ ok: true });
  })
);

module.exports = router;
