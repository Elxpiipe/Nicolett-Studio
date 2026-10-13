// src/services/reservas.service.js
// Reserva de la clienta: valida la hora elegida contra el motor de
// disponibilidad y la aparta como PENDIENTE_ABONO mientras llega el abono.
const servicioModel = require("../models/servicio.model");
const profesionalModel = require("../models/profesional.model");
const citaModel = require("../models/cita.model");
const pagoModel = require("../models/pago.model");
const { reglasAgenda } = require("../models/configuracion.model");
const googleCalendar = require("./googleCalendar.service");
const calendarioCitas = require("./calendarioCitas.service");
const { notificar } = require("./notificaciones.service");
const { horasLibresProfesional } = require("./disponibilidad.service");
const { aMinutos, aHora, sumarDias, ahoraChile, chileADate, aTextoChile } = require("../utils/fechas");

/** Hasta cuando se puede cambiar la hora: inicio - 48 horas (en hora de Chile) */
function limiteCambio(fecha_hora_inicio, horasCambio) {
  return aTextoChile(new Date(chileADate(fecha_hora_inicio).getTime() - horasCambio * 3600000));
}

function errorHttp(status, mensaje) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

/**
 * Crea una reserva. datos = { id_usuario, id_servicio, fecha, hora,
 * id_profesional (opcional: "cualquiera disponible"), metodo_abono, notas }
 */
async function crearReserva(datos) {
  // 1) Lo unico asincrono (leer Google Calendar) va ANTES de validar y guardar
  const google = await googleCalendar.obtenerOcupacion();

  // 2) Desde aqui todo es sincronico: nadie mas puede tomar la hora entremedio
  const id_cliente = citaModel.clienteDeUsuario(datos.id_usuario);
  if (!id_cliente) throw errorHttp(403, "Solo las clientas pueden reservar desde la web");

  const servicio = servicioModel.obtener(datos.id_servicio);
  if (!servicio || !servicio.activo) throw errorHttp(404, "El servicio no existe o no está disponible");
  if (servicio.tipo_precio === "EVALUACION") {
    throw errorHttp(409, "Este servicio se cotiza según evaluación: escríbenos por WhatsApp para agendarlo.");
  }

  // Precio segun largo (S/M/L/XL): si el servicio tiene variantes, hay que elegir una
  let variante = null;
  if (servicio.variantes.length) {
    variante = servicio.variantes.find((v) => v.id_variante === datos.id_variante);
    if (!variante) throw errorHttp(400, "Elige el largo de tu cabello para calcular el valor.");
  }
  const precio = variante ? variante.precio : servicio.precio;

  const pendiente = citaModel.pendienteVigenteDeCliente(id_cliente);
  if (pendiente) {
    throw errorHttp(
      409,
      "Ya tienes una reserva esperando su abono. Complétala o espera a que venza antes de reservar otra."
    );
  }


  const reglas = reglasAgenda();
  const ahora = ahoraChile();
  if (datos.fecha < ahora.fecha || datos.fecha > sumarDias(ahora.fecha, reglas.diasMaximosReserva)) {
    throw errorHttp(400, "La fecha está fuera del rango en que se puede reservar");
  }

  let candidatas = profesionalModel.listarPorServicio(datos.id_servicio);
  if (datos.id_profesional) candidatas = candidatas.filter((p) => p.id_profesional === datos.id_profesional);

  const inicioMin = aMinutos(datos.hora);
  const elegida = candidatas.find((p) =>
    horasLibresProfesional(
      p.id_profesional,
      datos.fecha,
      servicio.duracion_minutos,
      reglas,
      ahora,
      googleCalendar.ocupadosDeProfesional(google, p.id_profesional)
    ).includes(inicioMin)
  );
  if (!elegida) throw errorHttp(409, "Esa hora ya no está disponible. Por favor elige otra.");

  const fecha_hora_inicio = `${datos.fecha} ${datos.hora}`;
  const fecha_hora_fin = `${datos.fecha} ${aHora(inicioMin + servicio.duracion_minutos)}`;

  // Plazo para pagar: 15 min en Webpay, 2 horas por transferencia (nunca despues de la cita)
  const minutosPlazo =
    datos.metodo_abono === "WEBPAY" ? reglas.minutosRetencionWebpay : reglas.horasRetencionTransferencia * 60;
  let fecha_expiracion_abono = ahoraChile(new Date(Date.now() + minutosPlazo * 60000)).texto;
  if (fecha_expiracion_abono > fecha_hora_inicio) fecha_expiracion_abono = fecha_hora_inicio;

  // Abono de la categoria (cabello $10.000) o el general ($5.000). Se descuenta
  // del total: si el servicio cuesta menos que el abono, se abona su precio completo.
  const monto_abono = Math.min(servicio.abono_categoria ?? reglas.abono, precio);

  const codigo = citaModel.crearReservaPendiente({
    id_cliente,
    id_profesional: elegida.id_profesional,
    id_servicio: servicio.id_servicio,
    id_variante: variante?.id_variante ?? null,
    variante: variante ? `${variante.nombre}${variante.detalle ? ` (${variante.detalle})` : ""}` : null,
    precio,
    duracion: servicio.duracion_minutos,
    fecha_hora_inicio,
    fecha_hora_fin,
    metodo_abono: datos.metodo_abono,
    fecha_expiracion_abono,
    monto_abono,
    notas: datos.notas,
  });

  calendarioCitas.sincronizarEnSegundoPlano(); // transferencia: evento amarillo "esperando abono"
  if (datos.metodo_abono === "TRANSFERENCIA") notificar("reservaApartada", codigo);
  return citaModel.obtenerPorCodigo(codigo);
}

/** Datos que la clienta puede ver de su reserva (sin ids internos) */
function vistaPublica(cita) {
  const ahora = ahoraChile().texto;
  const { horasCambio } = reglasAgenda();
  const limite = limiteCambio(cita.fecha_hora_inicio, horasCambio);
  const vigente = ["PENDIENTE_ABONO", "CONFIRMADA"].includes(cita.estado) && cita.fecha_hora_inicio > ahora;
  return {
    id_servicio: cita.id_servicio,
    id_profesional: cita.id_profesional,
    variante: cita.variante,
    tipo_precio: cita.tipo_precio,
    indicaciones: cita.indicaciones, // cuidados antes de la cita (ej. pestanas limpias)
    observaciones: cita.observaciones,
    categoria: cita.categoria,
    duracion_minutos: cita.duracion_minutos,
    notas_cliente: cita.notas_cliente,
    motivo_cancelacion: cita.motivo_cancelacion,
    veces_reagendada: cita.veces_reagendada,
    // Regla de las 48 horas
    limite_cambio: limite,
    puede_reagendar: cita.estado === "CONFIRMADA" && ahora < limite,
    puede_cancelar: vigente,
    // Ya paso la hora de la cita (para el historial)
    pasada: cita.fecha_hora_fin <= ahora,
    codigo_cita: cita.codigo_cita,
    estado: cita.estado,
    servicio: cita.servicio,
    profesional: cita.profesional,
    fecha_hora_inicio: cita.fecha_hora_inicio,
    fecha_hora_fin: cita.fecha_hora_fin,
    precio: cita.precio,
    monto_abono: cita.monto_abono,
    saldo: cita.precio - (cita.estado_abono === "APROBADO" ? cita.monto_abono : 0),
    metodo_abono: cita.metodo_abono,
    estado_abono: cita.estado_abono,
    fecha_expiracion_abono: cita.fecha_expiracion_abono,
    // true si sigue pendiente pero ya se le paso el plazo para pagar
    vencida:
      cita.estado === "PENDIENTE_ABONO" &&
      !!cita.fecha_expiracion_abono &&
      cita.fecha_expiracion_abono <= ahoraChile().texto,
  };
}

/** Vista para el panel: agrega los datos de contacto de la clienta */
function vistaAdmin(cita) {
  return {
    ...vistaPublica(cita),
    cliente: cita.cliente,
    email_cliente: cita.email_cliente,
    telefono_cliente: cita.telefono_cliente,
    notas_cliente: cita.notas_cliente,
    motivo_cancelacion: cita.motivo_cancelacion,
  };
}

/** ¿Otra cita vigente ocupa la misma hora de la misma profesional? */
function horaTomadaPorOtra(cita) {
  return profesionalModel
    .citasQueTocan(cita.id_profesional, cita.fecha_hora_inicio, cita.fecha_hora_fin)
    .some((c) => c.id_cita !== cita.id_cita);
}

/**
 * La administracion confirma que llego la transferencia del abono.
 * Funciona aunque el plazo de 2 horas ya haya vencido (la transferencia pudo
 * llegar tarde), siempre que nadie mas haya tomado la hora.
 */
function confirmarTransferencia(codigo_cita, id_usuario_admin, referencia) {
  const cita = citaModel.obtenerPorCodigo(codigo_cita);
  if (!cita) throw errorHttp(404, "Reserva no encontrada");
  if (cita.metodo_abono !== "TRANSFERENCIA") throw errorHttp(409, "Esta reserva no se abona por transferencia");
  if (cita.estado === "CONFIRMADA") throw errorHttp(409, "Esta reserva ya está confirmada");

  const vencida = cita.estado === "CANCELADA" && cita.motivo_cancelacion === "Plazo de abono vencido";
  if (cita.estado !== "PENDIENTE_ABONO" && !vencida) {
    throw errorHttp(409, "Esta reserva no está esperando abono");
  }
  if (horaTomadaPorOtra(cita)) {
    throw errorHttp(409, "Esa hora ya fue tomada por otra reserva. Coordina un cambio de hora con la clienta.");
  }

  pagoModel.aprobarAbono(cita.id_pago, cita.id_cita, {
    confirmado_por: id_usuario_admin,
    referencia: referencia || null,
    fecha_confirmacion: ahoraChile().texto,
  });
  calendarioCitas.sincronizarEnSegundoPlano(); // el evento pasa a verde (o se crea)
  notificar("reservaConfirmada", codigo_cita);
  return citaModel.obtenerPorCodigo(codigo_cita);
}

/** Carga una cita y verifica que sea de la clienta con sesion */
function citaDeLaClienta(codigo_cita, id_usuario) {
  const cita = citaModel.obtenerPorCodigo(codigo_cita);
  if (!cita || cita.id_cliente !== citaModel.clienteDeUsuario(id_usuario)) {
    throw errorHttp(404, "Reserva no encontrada");
  }
  return cita;
}

/**
 * La clienta cambia su hora. Regla del salon: solo con 48 horas de anticipacion
 * (fuera de plazo no se puede cambiar y, si no asiste, pierde el abono).
 * datos = { fecha, hora, id_profesional (opcional: "cualquiera disponible") }
 */
async function reagendar(codigo_cita, id_usuario, datos) {
  const google = await googleCalendar.obtenerOcupacion(); // lo unico asincrono, antes de validar

  const cita = citaDeLaClienta(codigo_cita, id_usuario);
  if (cita.estado !== "CONFIRMADA") {
    throw errorHttp(409, "Solo se puede cambiar la hora de una reserva confirmada.");
  }
  const reglas = reglasAgenda();
  const ahora = ahoraChile();
  if (ahora.texto >= limiteCambio(cita.fecha_hora_inicio, reglas.horasCambio)) {
    throw errorHttp(
      409,
      `Los cambios de hora son con ${reglas.horasCambio} horas de anticipación y ese plazo ya pasó. Escríbenos por WhatsApp.`
    );
  }
  if (datos.fecha < ahora.fecha || datos.fecha > sumarDias(ahora.fecha, reglas.diasMaximosReserva)) {
    throw errorHttp(400, "La fecha está fuera del rango en que se puede reservar");
  }

  const nuevoInicio = `${datos.fecha} ${datos.hora}`;
  if (nuevoInicio === cita.fecha_hora_inicio && (!datos.id_profesional || datos.id_profesional === cita.id_profesional)) {
    throw errorHttp(409, "Elegiste la misma hora que ya tienes.");
  }

  let candidatas = profesionalModel.listarPorServicio(cita.id_servicio);
  if (datos.id_profesional) candidatas = candidatas.filter((p) => p.id_profesional === datos.id_profesional);
  // Con "cualquiera", se prefiere mantener a la misma profesional si esta libre
  candidatas.sort((a, b) => (b.id_profesional === cita.id_profesional) - (a.id_profesional === cita.id_profesional));

  const inicioMin = aMinutos(datos.hora);
  const elegida = candidatas.find((p) =>
    horasLibresProfesional(
      p.id_profesional,
      datos.fecha,
      cita.duracion_minutos,
      reglas,
      ahora,
      googleCalendar.ocupadosDeProfesional(google, p.id_profesional),
      cita.id_cita
    ).includes(inicioMin)
  );
  if (!elegida) throw errorHttp(409, "Esa hora ya no está disponible. Por favor elige otra.");

  citaModel.moverCita(cita.id_cita, {
    id_profesional: elegida.id_profesional,
    fecha_hora_inicio: nuevoInicio,
    fecha_hora_fin: `${datos.fecha} ${aHora(inicioMin + cita.duracion_minutos)}`,
  });
  calendarioCitas.sincronizarEnSegundoPlano(); // el evento se mueve en Google
  notificar("citaReagendada", codigo_cita);
  return citaModel.obtenerPorCodigo(codigo_cita);
}

/**
 * La clienta cancela. Si el abono estaba pagado NO se devuelve (regla del salon:
 * solo se puede reagendar). Si aun no pagaba, simplemente se libera la hora.
 */
function cancelar(codigo_cita, id_usuario) {
  const cita = citaDeLaClienta(codigo_cita, id_usuario);
  if (!["PENDIENTE_ABONO", "CONFIRMADA"].includes(cita.estado) || cita.fecha_hora_inicio <= ahoraChile().texto) {
    throw errorHttp(409, "Esta reserva ya no se puede cancelar.");
  }
  const pagado = cita.estado_abono === "APROBADO";
  citaModel.cancelarPorCliente(
    cita.id_cita,
    pagado ? "Cancelada por la clienta (abono no reembolsable)" : "Cancelada por la clienta"
  );
  calendarioCitas.sincronizarEnSegundoPlano(); // se borra de Google
  notificar("citaCancelada", codigo_cita);
  return citaModel.obtenerPorCodigo(codigo_cita);
}

/** Citas de la clienta: proximas (vigentes) e historial */
function misCitas(id_usuario) {
  const id_cliente = citaModel.clienteDeUsuario(id_usuario);
  if (!id_cliente) throw errorHttp(403, "Solo las clientas tienen reservas");
  const ahora = ahoraChile().texto;
  const todas = citaModel.listarDeCliente(id_cliente).map(vistaPublica);
  const esProxima = (c) =>
    (c.estado === "CONFIRMADA" || (c.estado === "PENDIENTE_ABONO" && !c.vencida)) && c.fecha_hora_fin > ahora;
  return {
    proximas: todas.filter(esProxima).sort((a, b) => a.fecha_hora_inicio.localeCompare(b.fecha_hora_inicio)),
    historial: todas.filter((c) => !esProxima(c)),
  };
}

// ------------------------------------------------------------------
// Agenda del dia (Administradora y Profesionales)
// ------------------------------------------------------------------

function vistaAgenda(cita) {
  return {
    ...vistaPublica(cita),
    cliente: cita.cliente,
    telefono_cliente: cita.telefono_cliente,
    email_cliente: cita.email_cliente,
    fecha_atencion: cita.fecha_atencion,
    // Se puede marcar desde la hora de inicio de la cita
    puede_marcar: ["CONFIRMADA", "ATENDIDA", "NO_ASISTE"].includes(cita.estado) && cita.fecha_hora_inicio <= ahoraChile().texto,
  };
}

/**
 * Agenda de un dia. Administradora: todas las profesionales (o una). Profesional: solo la suya.
 * Devuelve { fecha, profesionales: [{ id_profesional, nombre, foto_url, citas, bloqueos }] }
 */
function agendaDelDia(usuario, fecha, id_profesional) {
  let profesionales;
  if (usuario.rol === "Profesional") {
    const propia = profesionalModel.obtenerPorUsuario(usuario.id_usuario);
    if (!propia) throw errorHttp(404, "No encontramos tu perfil de profesional");
    profesionales = [propia];
  } else {
    profesionales = profesionalModel.listar({ soloActivos: true });
    if (id_profesional) profesionales = profesionales.filter((p) => p.id_profesional === id_profesional);
  }
  const ahora = ahoraChile().texto;
  const finDia = `${sumarDias(fecha, 1)} 00:00`;
  return {
    fecha,
    ahora,
    profesionales: profesionales.map((p) => ({
      id_profesional: p.id_profesional,
      nombre: `${p.nombres} ${p.apellidos}`,
      foto_url: p.foto_url,
      citas: citaModel.citasDelDia(fecha, p.id_profesional, ahora).map(vistaAgenda),
      bloqueos: profesionalModel.bloqueosQueTocan(p.id_profesional, `${fecha} 00:00`, finDia),
    })),
  };
}

/**
 * Marca la cita como ATENDIDA o NO_ASISTE (o la vuelve a CONFIRMADA si fue un error).
 * Pueden hacerlo la Administradora o la profesional de la cita, desde la hora de inicio.
 */
function marcarAtencion(codigo_cita, usuario, estado, observaciones) {
  const cita = citaModel.obtenerPorCodigo(codigo_cita);
  if (!cita) throw errorHttp(404, "Reserva no encontrada");
  if (usuario.rol === "Profesional") {
    const propia = profesionalModel.obtenerPorUsuario(usuario.id_usuario);
    if (!propia || propia.id_profesional !== cita.id_profesional) throw errorHttp(403, "Esta cita no es de tu agenda");
  }
  if (!["CONFIRMADA", "ATENDIDA", "NO_ASISTE"].includes(cita.estado)) {
    throw errorHttp(409, cita.estado === "PENDIENTE_ABONO" ? "Esta cita aún no tiene el abono confirmado." : "Esta cita fue cancelada.");
  }
  const ahora = ahoraChile().texto;
  if (estado !== "CONFIRMADA" && cita.fecha_hora_inicio > ahora) {
    throw errorHttp(409, "Solo se puede marcar desde la hora de inicio de la cita.");
  }
  citaModel.registrarAtencion(cita.id_cita, estado, observaciones, usuario.id_usuario, ahora);
  calendarioCitas.sincronizarEnSegundoPlano(); // cambia el color del evento en Google
  return vistaAgenda(citaModel.obtenerPorCodigo(codigo_cita));
}

module.exports = {
  agendaDelDia,
  marcarAtencion,
  crearReserva,
  confirmarTransferencia,
  reagendar,
  cancelar,
  misCitas,
  vistaPublica,
  vistaAdmin,
  errorHttp,
};