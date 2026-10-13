// src/services/webpay.service.js
// Abono con Webpay Plus (Transbank). Por defecto usa el AMBIENTE DE INTEGRACION
// con las credenciales publicas de prueba: no se cobra dinero real.
// Para produccion se definen WEBPAY_COMMERCE_CODE y WEBPAY_API_KEY en .env.
const {
  WebpayPlus,
  Options,
  IntegrationCommerceCodes,
  IntegrationApiKeys,
  Environment,
} = require("transbank-sdk");
const citaModel = require("../models/cita.model");
const pagoModel = require("../models/pago.model");
const profesionalModel = require("../models/profesional.model");
const { reglasAgenda } = require("../models/configuracion.model");
const { ahoraChile } = require("../utils/fechas");
const { errorHttp } = require("./reservas.service");
const calendarioCitas = require("./calendarioCitas.service");
const ventaModel = require("../models/venta.model");
const { notificar } = require("./notificaciones.service");

function transaccion() {
  const produccion = process.env.WEBPAY_COMMERCE_CODE && process.env.WEBPAY_API_KEY;
  return new WebpayPlus.Transaction(
    produccion
      ? new Options(process.env.WEBPAY_COMMERCE_CODE, process.env.WEBPAY_API_KEY, Environment.Production)
      : new Options(IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY, Environment.Integration)
  );
}

/** Crea la transaccion en Transbank con un mensaje claro si Webpay no responde */
async function crearTransaccion(ordenCompra, sesion, monto) {
  try {
    return await transaccion().create(ordenCompra, sesion, monto, `${urlBackend()}/api/pagos/webpay/retorno`);
  } catch (err) {
    console.error(`Webpay create fallo (${ordenCompra}):`, err.message);
    throw errorHttp(502, "No pudimos conectar con Webpay. Intenta de nuevo en unos minutos.");
  }
}

const urlBackend = () => process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 4000}`;
const urlFrontend = () => process.env.FRONTEND_URL || "http://localhost:5173";

/**
 * Inicia el pago del abono de una reserva de la clienta.
 * Devuelve { url, token }: el navegador debe enviar un formulario POST a `url`
 * con el campo token_ws = token (asi lo exige Webpay).
 */
async function iniciarPago(codigo_cita, id_usuario) {
  const cita = citaModel.obtenerPorCodigo(codigo_cita);
  if (!cita || cita.id_cliente !== citaModel.clienteDeUsuario(id_usuario)) {
    throw errorHttp(404, "Reserva no encontrada");
  }
  if (cita.estado !== "PENDIENTE_ABONO") throw errorHttp(409, "Esta reserva no está esperando abono");
  if (cita.metodo_abono !== "WEBPAY") throw errorHttp(409, "Esta reserva se abona por transferencia");
  if (cita.fecha_expiracion_abono && cita.fecha_expiracion_abono <= ahoraChile().texto) {
    throw errorHttp(410, "El plazo para pagar esta reserva venció. Por favor reserva de nuevo.");
  }

  // Orden de compra unica por intento (max 26 caracteres): si un pago se rechaza,
  // la clienta puede reintentar sin repetir la orden. Ej: NS-260930-K7Q2-LX3F9
  const ordenCompra = `${cita.codigo_cita}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
  const respuesta = await crearTransaccion(ordenCompra, `S-${cita.id_cita}`, cita.monto_abono);

  // Mientras la clienta esta en Webpay, la hora se mantiene apartada 15 minutos mas
  const { minutosRetencionWebpay } = reglasAgenda();
  let expira = ahoraChile(new Date(Date.now() + minutosRetencionWebpay * 60000)).texto;
  if (expira > cita.fecha_hora_inicio) expira = cita.fecha_hora_inicio;
  pagoModel.registrarInicioWebpay(cita.id_pago, cita.id_cita, respuesta.token, expira);

  return { url: respuesta.url, token: respuesta.token };
}

/** ¿Otra cita vigente tomo la hora mientras esta estaba vencida? */
function horaTomadaPorOtra(cita) {
  return profesionalModel
    .citasQueTocan(cita.id_profesional, cita.fecha_hora_inicio, cita.fecha_hora_fin)
    .some((c) => c.id_cita !== cita.id_cita);
}

/**
 * Transbank devuelve a la clienta a esta URL. Hay tres casos:
 *  - token_ws: termino el formulario -> se confirma (commit) el pago
 *  - TBK_TOKEN sin token_ws: la clienta anulo el pago
 *  - solo TBK_ORDEN_COMPRA: se agoto el tiempo en el formulario
 * Devuelve la URL del frontend a la que se redirige a la clienta.
 */
async function procesarRetorno(datos) {
  // NS-... = abono de una reserva (/reserva/resultado); NV-... = compra de la tienda (/compra/resultado)
  const resultado = (codigo, estado) => {
    const pagina = String(codigo || "").startsWith("NV-") ? "compra" : "reserva";
    return `${urlFrontend()}/${pagina}/resultado?codigo=${encodeURIComponent(codigo || "")}&estado=${estado}`;
  };

  const token = datos.token_ws;
  if (!token) {
    const estado = datos.TBK_TOKEN ? "anulado" : "tiempo_agotado";
    // La orden de compra es "codigo-intento": los primeros 14 caracteres son el codigo
    return resultado((datos.TBK_ORDEN_COMPRA || "").slice(0, 14), estado);
  }

  const pago = pagoModel.obtenerPorToken(token);
  if (!pago) return resultado("", "error");
  if (pago.tipo_pago === "PAGO_VENTA") return procesarRetornoVenta(pago, token, resultado);
  // Si la clienta recarga la pagina, no se confirma dos veces
  if (pago.estado === "APROBADO") return resultado(pago.codigo_cita, "aprobado");

  let respuesta;
  try {
    respuesta = await transaccion().commit(token);
  } catch (err) {
    // Si el navegador envio el retorno dos veces, la primera solicitud pudo
    // aprobarlo y esta segunda falla en Transbank: se revisa antes de dar error.
    if (pagoModel.obtenerPorToken(token)?.estado === "APROBADO") return resultado(pago.codigo_cita, "aprobado");
    console.error("Webpay commit fallo:", err.message);
    return resultado(pago.codigo_cita, "error");
  }

  const detalle = {
    status: respuesta.status,
    response_code: respuesta.response_code,
    authorization_code: respuesta.authorization_code,
    payment_type_code: respuesta.payment_type_code,
    card_number: respuesta.card_detail && respuesta.card_detail.card_number,
    amount: respuesta.amount,
    transaction_date: respuesta.transaction_date,
  };

  const aprobado =
    respuesta.response_code === 0 && respuesta.status === "AUTHORIZED" && respuesta.amount === pago.monto;
  if (!aprobado) {
    pagoModel.rechazarPago(pago.id_pago, detalle);
    return resultado(pago.codigo_cita, "rechazado");
  }

  // Si la cita vencio mientras la clienta pagaba (el plazo corrio o ya se cancelo
  // por vencimiento), se confirma igual siempre que nadie haya tomado la hora.
  const cita = citaModel.obtenerPorCodigo(pago.codigo_cita);
  if (cita.estado !== "CONFIRMADA" && horaTomadaPorOtra(cita)) {
    // Caso muy raro: pago tarde y otra clienta alcanzo a tomar la hora.
    // El abono queda registrado para que la administracion reagende o devuelva.
    pagoModel.registrarAbonoFueraDePlazo(pago.id_pago, pago.id_cita, detalle);
    calendarioCitas.sincronizarEnSegundoPlano();
    console.warn(`Reserva ${cita.codigo_cita}: abono pagado pero la hora ya fue tomada. Revisar.`);
    return resultado(pago.codigo_cita, "revision");
  }

  pagoModel.aprobarAbono(pago.id_pago, pago.id_cita, detalle);
  calendarioCitas.sincronizarEnSegundoPlano(); // la cita confirmada aparece en Google
  notificar("reservaConfirmada", pago.codigo_cita);
  return resultado(pago.codigo_cita, "aprobado");
}

// ------------------------------------------------------------------
// Tienda: pago de un pedido
// ------------------------------------------------------------------

/** Inicia el pago de un pedido de la tienda. Devuelve { url, token } */
async function iniciarPagoVenta(codigo_venta, id_usuario) {
  const venta = ventaModel.obtenerPorCodigo(codigo_venta);
  if (!venta || venta.id_cliente !== citaModel.clienteDeUsuario(id_usuario)) {
    throw errorHttp(404, "Pedido no encontrado");
  }
  if (venta.estado !== "PENDIENTE") throw errorHttp(409, "Este pedido no está esperando pago");
  if (venta.fecha_expiracion_pago && venta.fecha_expiracion_pago <= ahoraChile().texto) {
    throw errorHttp(410, "El plazo para pagar este pedido venció. Vuelve a intentarlo desde el carrito.");
  }

  const ordenCompra = `${venta.codigo_venta}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
  const respuesta = await crearTransaccion(ordenCompra, `V-${venta.id_venta}`, venta.total);

  // Mientras paga, el stock se mantiene apartado 15 minutos mas
  const { minutosRetencionWebpay } = reglasAgenda();
  ventaModel.extenderPlazo(venta.id_venta, ahoraChile(new Date(Date.now() + minutosRetencionWebpay * 60000)).texto);
  pagoModel.registrarInicioWebpayVenta(venta.id_pago, respuesta.token);
  return { url: respuesta.url, token: respuesta.token };
}

async function procesarRetornoVenta(pago, token, resultado) {
  if (pago.estado === "APROBADO") return resultado(pago.codigo_venta, "aprobado");

  let respuesta;
  try {
    respuesta = await transaccion().commit(token);
  } catch (err) {
    if (pagoModel.obtenerPorToken(token)?.estado === "APROBADO") return resultado(pago.codigo_venta, "aprobado");
    console.error("Webpay commit (tienda) fallo:", err.message);
    return resultado(pago.codigo_venta, "error");
  }

  const detalle = {
    status: respuesta.status,
    response_code: respuesta.response_code,
    authorization_code: respuesta.authorization_code,
    payment_type_code: respuesta.payment_type_code,
    card_number: respuesta.card_detail && respuesta.card_detail.card_number,
    amount: respuesta.amount,
    transaction_date: respuesta.transaction_date,
  };
  const aprobado =
    respuesta.response_code === 0 && respuesta.status === "AUTHORIZED" && respuesta.amount === pago.monto;
  if (!aprobado) {
    pagoModel.rechazarPago(pago.id_pago, detalle);
    return resultado(pago.codigo_venta, "rechazado");
  }

  const estado = ventaModel.aprobarPago(pago.id_pago, pago.id_venta, detalle);
  if (estado === "revision") console.warn(`Pedido ${pago.codigo_venta}: pagado fuera de plazo y sin stock. Revisar.`);
  else notificar("compraPagada", pago.codigo_venta);
  return resultado(pago.codigo_venta, estado === "pagado" ? "aprobado" : "revision");
}

module.exports = { iniciarPago, procesarRetorno, iniciarPagoVenta };