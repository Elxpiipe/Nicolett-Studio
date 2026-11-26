// src/whatsapp/bot.js
// Conversacion del agente de WhatsApp. Funciona con menus y botones (pensado para
// que cualquier persona, incluidas las clientas mayores, lo use sin problemas).
// Tambien entiende numeros escritos ("1", "2"...) y palabras sueltas ("reservar",
// "precios", "menu", "persona").
//
// Usa exactamente las mismas reglas que la pagina: reservas.service (abono, 48 horas,
// hora apartada mientras se paga) y el motor de disponibilidad con Google Calendar.
const crypto = require("crypto");
const db = require("../../db/connection");
const config = require("./config");
const modelo = require("./whatsapp.model");
const envio = require("./envio");
const M = require("./mensajes");
const F = require("./formato");
const reservas = require("../services/reservas.service");
const { diasDisponibles, horasLibres } = require("../services/disponibilidad.service");
const servicioModel = require("../models/servicio.model");
const categoriaModel = require("../models/categoria.model");
const profesionalModel = require("../models/profesional.model");
const usuarioModel = require("../models/usuario.model");
const { reglasAgenda, obtenerTexto, obtenerNumero } = require("../models/configuracion.model");
const { enviarCorreo } = require("../utils/mailer");
const { hashPassword } = require("../utils/password");
const { ROLES } = require("../utils/roles");
const { aMinutos, aHora, ahoraChile } = require("../utils/fechas");

const MINUTOS_SESION = 60; // sin escribir por mas de 1 hora, la conversacion parte de nuevo
const PIE = "Escribe MENÚ para volver al inicio";

const MENU = [
  { id: "menu:reservar", titulo: "Reservar una hora", descripcion: "Elige servicio, día y hora" },
  { id: "menu:citas", titulo: "Mis citas", descripcion: "Ver, cambiar o cancelar" },
  { id: "menu:precios", titulo: "Servicios y precios" },
  { id: "menu:horario", titulo: "Horario y dirección" },
  { id: "menu:persona", titulo: "Hablar con una persona", descripcion: "Te responde el equipo del salón" },
];

const B_MENU = { id: "menu:inicio", titulo: "Menú principal" };
const B_RESERVAR = { id: "menu:reservar", titulo: "Reservar una hora" };
const B_PERSONA = { id: "menu:persona", titulo: "Hablar con persona" };

// Palabras que la clienta puede escribir en cualquier momento
const PALABRAS_MENU = ["menu", "inicio", "volver", "salir", "cancelar", "0", "empezar", "comenzar"];
const SALUDOS = ["hola", "holi", "buenas", "buenos dias", "buenas tardes", "buenas noches", "alo", "hello"];
const PALABRAS_PERSONA = ["persona", "humano", "humana", "hablar con alguien", "operadora", "ejecutiva", "asesora"];

const ahoraUtc = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const msDesde = (fechaUtc) => (fechaUtc ? Date.now() - new Date(`${fechaUtc.replace(" ", "T")}Z`).getTime() : Infinity);

function errorDeNegocio(err) {
  return err && err.status && err.status < 500;
}

// ------------------------------------------------------------------
// Estado de una conversacion mientras se responde un mensaje
// ------------------------------------------------------------------

class Conversacion {
  constructor(telefono, sesion, usuario) {
    this.telefono = telefono;
    this.usuario = usuario; // clienta (o null si aun no sabemos quien es)
    this.estado = sesion.estado;
    this.datos = sesion.datos || {};
    this.humano_desde = sesion.humano_desde;
    this.pendiente = sesion.pendiente_respuesta;
    this.salida = [];
    this.avisoSalon = null;
  }

  enviar(mensaje) {
    this.salida.push(mensaje);
  }

  /** Envia una pregunta y recuerda sus opciones (para aceptar "1", "2"... escritos) */
  preguntar(estado, mensaje, extra = {}) {
    this.estado = estado;
    this.datos = { ...this.datos, ...extra, opciones: M.opcionesDe(mensaje), ultimo: mensaje };
    this.enviar(mensaje);
  }
}

/**
 * Lista con paginas: WhatsApp permite 10 filas por lista, asi que si hay mas
 * se muestran de a 9 con una fila "Ver más opciones".
 */
function preguntarLista(c, estado, { texto, boton = "Ver opciones", items, pagina = 0 }) {
  const porPagina = items.length > 10 ? 9 : 10;
  const paginas = Math.max(1, Math.ceil(items.length / porPagina));
  const p = ((pagina % paginas) + paginas) % paginas;
  const filas = items.slice(p * porPagina, (p + 1) * porPagina);
  if (paginas > 1) {
    filas.push({
      id: "mas",
      titulo: p + 1 < paginas ? "Ver más opciones" : "Volver al comienzo",
      descripcion: `Página ${p + 1} de ${paginas}`,
    });
  }
  const numeradas = filas.map((f, i) => `${i + 1}. ${f.titulo}`).join("\n");
  const cuerpo = `${texto}\n\n${numeradas}\n\nToca *${boton}* o responde con el número.`;
  c.preguntar(estado, M.lista(cuerpo, boton, filas, PIE), { lista: { estado, texto, boton, items, pagina: p } });
}

/** Entiende la respuesta: boton tocado, numero escrito o el nombre de la opcion */
function resolver(c, entrada) {
  const opciones = c.datos.opciones || [];
  // En una lista con paginas, se acepta cualquier opcion de la lista (no solo la pagina visible)
  const todas = [...opciones, ...((c.datos.lista && c.datos.lista.items) || [])];
  if (entrada.id_opcion) {
    if (entrada.id_opcion.startsWith("menu:")) return entrada.id_opcion;
    return todas.some((o) => o.id === entrada.id_opcion) ? entrada.id_opcion : null;
  }
  const t = F.normalizar(entrada.texto);
  if (!t) return null;
  // Los numeros se refieren a lo que la clienta esta viendo
  if (/^\d{1,2}$/.test(t)) return opciones[Number(t) - 1]?.id ?? null;
  if (/^(mas|ver mas|siguiente|otras|mas opciones|ver mas opciones)$/.test(t) && opciones.some((o) => o.id === "mas")) {
    return "mas";
  }
  // "si" / "no" escritos en una pregunta de confirmacion
  if (/^(si|sii|ok|dale|claro|bueno|confirmo|confirmar|de acuerdo|ya)$/.test(t) && opciones.some((o) => o.id === "si")) return "si";
  if (/^(no|nop|noo|mejor no)$/.test(t) && opciones.some((o) => o.id === "no")) return "no";
  const candidatas = todas.filter((o) => o.id !== "mas");
  const exacta = candidatas.find((o) => F.normalizar(o.titulo) === t);
  if (exacta) return exacta.id;
  if (t.length >= 3) {
    const parecidas = candidatas.filter((o) => {
      const titulo = F.normalizar(o.titulo);
      return titulo.includes(t) || (t.includes(titulo) && titulo.length >= 3);
    });
    const unicas = [...new Set(parecidas.map((o) => o.id))];
    if (unicas.length === 1) return unicas[0];
  }
  return null;
}

/** Que quiere hacer la clienta segun lo que escribio (desde el menu) */
function intencion(texto) {
  const t = F.normalizar(texto);
  if (!t) return null;
  if (PALABRAS_PERSONA.some((p) => t.includes(p))) return "menu:persona";
  if (/(mis citas|mi cita|mi hora|mi reserva|cancelar|cambiar|reagendar|anular)/.test(t)) return "menu:citas";
  if (/(reserv|agend|tomar hora|pedir hora|una hora|cita|turno)/.test(t)) return "menu:reservar";
  if (/(precio|valor|cuanto|cuesta|servicio|tarifa|catalogo)/.test(t)) return "menu:precios";
  if (/(horario|direccion|donde|ubica|abren|cierran|atienden|llegar|mapa)/.test(t)) return "menu:horario";
  return null;
}

async function noEntendi(c) {
  c.enviar(M.texto("No te entendí. Toca una de las opciones o responde con su número."));
  if (c.datos.ultimo) {
    c.enviar(c.datos.ultimo);
  } else {
    await menuPrincipal(c);
  }
}

// ------------------------------------------------------------------
// Quien escribe
// ------------------------------------------------------------------

async function identificar(telefono, nombrePerfil) {
  const contacto = await modelo.obtenerContacto(telefono);
  if (contacto?.id_usuario) {
    const u = await db
      .prepare(`SELECT id_usuario, nombres, apellidos, activo, id_rol FROM usuarios WHERE id_usuario = ?`)
      .get(contacto.id_usuario);
    if (u && u.activo && u.id_rol === ROLES.CLIENTE.id_rol) {
      if (nombrePerfil && nombrePerfil !== contacto.nombre_perfil) await modelo.guardarContacto(telefono, null, nombrePerfil);
      return u;
    }
  }
  // Clienta ya registrada en la pagina con este mismo numero
  const u = await modelo.buscarClientaPorTelefono(telefono.replace(/\D/g, ""));
  await modelo.guardarContacto(telefono, u?.id_usuario || null, nombrePerfil);
  return u || null;
}

/** Crea la ficha de una clienta nueva que escribio por WhatsApp (sin correo ni contraseña) */
async function crearClienta(telefono, nombres, apellidos) {
  const digitos = telefono.replace(/\D/g, "");
  const email = `wa${config.esSimulado(telefono) ? "-sim" : ""}-${digitos}@${config.DOMINIO_CORREO}`;
  let usuario = await usuarioModel.findByEmail(email);
  if (usuario) {
    await usuarioModel.actualizarUsuario(usuario.id_usuario, { nombres, apellidos, telefono: `+${digitos}` });
  } else {
    usuario = await usuarioModel.crearUsuarioConPerfil({
      id_rol: ROLES.CLIENTE.id_rol,
      nombres,
      apellidos,
      email,
      telefono: `+${digitos}`,
      password_hash: hashPassword(crypto.randomBytes(24).toString("hex")),
    });
    await usuarioModel.marcarInvitado(usuario.id_usuario, true);
  }
  await modelo.guardarContacto(telefono, usuario.id_usuario, null);
  return { id_usuario: usuario.id_usuario, nombres, apellidos };
}

// ------------------------------------------------------------------
// Menu principal
// ------------------------------------------------------------------

async function menuPrincipal(c, { saludo = false } = {}) {
  const nombre = c.usuario ? `, ${F.primerNombre(c.usuario.nombres)}` : "";
  const texto = saludo
    ? `¡Hola${nombre}! Soy el asistente virtual de *Nicolett Studio Fantasy*. Te ayudo a reservar tu hora, revisar tus citas o resolver dudas.\n\n¿Qué necesitas?`
    : "¿En qué te puedo ayudar?";
  c.datos = {};
  preguntarLista(c, "MENU", { texto, items: MENU });
}

async function opcionMenu(c, id) {
  switch (id) {
    case "menu:reservar":
      return iniciarReserva(c);
    case "menu:citas":
      return misCitas(c);
    case "menu:precios":
      return elegirCategoria(c, "P_CATEGORIA");
    case "menu:horario":
      return horario(c);
    case "menu:persona":
      return hablarConPersona(c);
    default:
      return menuPrincipal(c);
  }
}

// ------------------------------------------------------------------
// Catalogo
// ------------------------------------------------------------------

/** Categorias activas con sus servicios activos, en el orden del catalogo */
async function catalogo() {
  const servicios = await servicioModel.listar({ soloActivos: true });
  const categorias = await categoriaModel.listar({ soloActivas: true });
  return categorias
    .map((cat) => ({ categoria: cat, servicios: servicios.filter((s) => s.id_categoria === cat.id_categoria) }))
    .filter((g) => g.servicios.length);
}

async function elegirCategoria(c, estado) {
  const grupos = await catalogo();
  if (!grupos.length) {
    c.estado = "MENU";
    c.enviar(M.botones("Por ahora no hay servicios disponibles en línea.", [B_PERSONA, B_MENU]));
    return;
  }
  const texto =
    estado === "R_CATEGORIA"
      ? "¿Qué te quieres hacer? Primero elige el tipo de servicio:"
      : "¿De qué tipo de servicio quieres ver los precios?";
  preguntarLista(c, estado, {
    texto,
    items: grupos.map((g) => ({
      id: `cat:${g.categoria.id_categoria}`,
      titulo: g.categoria.nombre,
      descripcion: `${g.servicios.length} servicio${g.servicios.length === 1 ? "" : "s"}`,
    })),
  });
}

// ------------------------------------------------------------------
// Reservar
// ------------------------------------------------------------------

async function iniciarReserva(c) {
  if (!c.usuario) {
    c.preguntar("NOMBRE", M.texto("Para reservar necesito saber quién eres. ¿Me escribes tu *nombre y apellido*?"), {
      despues: "reservar",
    });
    return;
  }
  c.datos = {};
  return elegirCategoria(c, "R_CATEGORIA");
}

async function pasoNombre(c, _eleccion, entrada) {
  const texto = String(entrada.texto || "").trim().replace(/\s+/g, " ");
  const valido = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{2,60}$/.test(texto) && (texto.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) || []).length >= 2;
  if (!valido) {
    c.enviar(M.texto("Escríbeme solo tu nombre y apellido, por ejemplo: *María González*."));
    return;
  }
  const palabras = texto.split(" ").map((p) => F.mayuscula(p.toLowerCase()));
  const nombres = palabras[0];
  const apellidos = palabras.slice(1).join(" ");
  c.usuario = await crearClienta(c.telefono, nombres, apellidos);
  c.enviar(M.texto(`¡Gracias, ${nombres}!`));
  c.datos = {};
  return elegirCategoria(c, "R_CATEGORIA");
}

async function elegirServicio(c, id_categoria) {
  const grupo = (await catalogo()).find((g) => g.categoria.id_categoria === id_categoria);
  if (!grupo) return elegirCategoria(c, "R_CATEGORIA");
  preguntarLista(c, "R_SERVICIO", {
    texto: `Servicios de *${grupo.categoria.nombre}*. ¿Cuál quieres?`,
    items: grupo.servicios.map((s) => {
      const detalle = `${F.mayuscula(F.precioServicio(s))} · ${F.duracion(s.duracion_minutos)}`;
      const largo = s.nombre.length > M.LIMITES.tituloFila;
      return { id: `srv:${s.id_servicio}`, titulo: s.nombre, descripcion: largo ? `${s.nombre} · ${detalle}` : detalle };
    }),
  });
  c.datos.id_categoria = id_categoria;
}

async function pasoCategoria(c, eleccion) {
  if (!eleccion?.startsWith("cat:")) return noEntendi(c);
  return elegirServicio(c, Number(eleccion.slice(4)));
}

async function pasoServicio(c, eleccion) {
  if (!eleccion?.startsWith("srv:")) return noEntendi(c);
  const s = await servicioModel.obtener(Number(eleccion.slice(4)));
  if (!s || !s.activo) return elegirCategoria(c, "R_CATEGORIA");
  c.datos.servicio = {
    id: s.id_servicio,
    nombre: s.nombre,
    precio: s.precio,
    duracion: s.duracion_minutos,
    abono_categoria: s.abono_categoria,
    id_categoria: s.id_categoria,
  };
  delete c.datos.variante;

  if (s.tipo_precio === "EVALUACION") {
    c.preguntar(
      "R_EVALUACION",
      M.botones(
        `*${s.nombre}* se cotiza según evaluación, así que lo agenda directamente el equipo del salón.`,
        [B_PERSONA, { id: "otro", titulo: "Ver otros servicios" }, B_MENU]
      )
    );
    return;
  }

  if (s.variantes?.length) {
    preguntarLista(c, "R_VARIANTE", {
      texto: `*${s.nombre}*: el valor depende del largo de tu cabello. ¿Cuál es tu caso?`,
      items: s.variantes.map((v) => ({
        id: `var:${v.id_variante}`,
        titulo: v.nombre,
        descripcion: [v.detalle, F.precio(v.precio)].filter(Boolean).join(" · "),
      })),
    });
    return;
  }
  return elegirProfesional(c);
}

async function pasoEvaluacion(c, eleccion) {
  if (eleccion === "otro") return elegirServicio(c, c.datos.servicio.id_categoria);
  return noEntendi(c);
}

async function pasoVariante(c, eleccion) {
  if (!eleccion?.startsWith("var:")) return noEntendi(c);
  const s = await servicioModel.obtener(c.datos.servicio.id);
  const v = s?.variantes.find((x) => x.id_variante === Number(eleccion.slice(4)));
  if (!v) return noEntendi(c);
  c.datos.variante = { id: v.id_variante, nombre: v.nombre, precio: v.precio };
  return elegirProfesional(c);
}

async function elegirProfesional(c) {
  const pros = await profesionalModel.listarPorServicio(c.datos.servicio.id);
  if (!pros.length) {
    c.estado = "MENU";
    c.datos = {};
    c.enviar(
      M.botones("Por ahora no tengo horas en línea para este servicio. El equipo del salón te puede ayudar a agendarlo.", [
        B_PERSONA,
        B_RESERVAR,
        B_MENU,
      ])
    );
    return;
  }
  if (pros.length === 1) {
    c.datos.id_profesional = pros[0].id_profesional;
    c.datos.nombre_profesional = `${pros[0].nombres} ${pros[0].apellidos}`.trim();
    return elegirDia(c, "reserva");
  }
  preguntarLista(c, "R_PROFESIONAL", {
    texto: "¿Con quién te quieres atender?",
    items: [
      { id: "pro:0", titulo: "Me da lo mismo", descripcion: "La primera profesional disponible (más horarios)" },
      ...pros.map((p) => ({
        id: `pro:${p.id_profesional}`,
        titulo: `${p.nombres} ${p.apellidos}`.trim(),
        descripcion: p.descripcion || undefined,
      })),
    ],
  });
}

async function pasoProfesional(c, eleccion) {
  if (!eleccion?.startsWith("pro:")) return noEntendi(c);
  const id = Number(eleccion.slice(4));
  if (id === 0) {
    c.datos.id_profesional = null;
    c.datos.nombre_profesional = null;
  } else {
    const p = (await profesionalModel.listarPorServicio(c.datos.servicio.id)).find((x) => x.id_profesional === id);
    if (!p) return noEntendi(c);
    c.datos.id_profesional = id;
    c.datos.nombre_profesional = `${p.nombres} ${p.apellidos}`.trim();
  }
  return elegirDia(c, "reserva");
}

/** Parametros de disponibilidad segun si es una reserva nueva o un cambio de hora */
function consultaDe(c, modo) {
  if (modo === "cambio") return { id_servicio: c.datos.cambio.id_servicio, excluirIdCita: c.datos.cambio.id_cita };
  return { id_servicio: c.datos.servicio.id, id_profesional: c.datos.id_profesional || undefined };
}

async function elegirDia(c, modo) {
  const estado = modo === "cambio" ? "C_DIA" : "R_DIA";
  const dias = (await diasDisponibles({ ...consultaDe(c, modo), dias: 21 })).filter((d) => d.disponibles > 0);
  if (!dias.length) {
    c.estado = "MENU";
    c.enviar(
      M.botones("No encontré horas libres en las próximas 3 semanas. El equipo del salón te puede ayudar a buscar una.", [
        B_PERSONA,
        B_MENU,
      ])
    );
    return;
  }
  preguntarLista(c, estado, {
    texto: modo === "cambio" ? "¿Para qué día quieres cambiar tu hora?" : "¿Qué día te acomoda?",
    items: dias.map((d) => {
      const rel = F.relativo(d.fecha);
      const horas = `${d.disponibles} hora${d.disponibles === 1 ? "" : "s"} libre${d.disponibles === 1 ? "" : "s"}`;
      return { id: `dia:${d.fecha}`, titulo: F.fechaCorta(d.fecha), descripcion: rel ? `${rel} · ${horas}` : horas };
    }),
  });
}

function nombresProfesionales(lista) {
  const nombres = lista.map((p) => F.primerNombre(p.nombre));
  if (nombres.length === 1) return `Con ${nombres[0]}`;
  return `Con ${nombres.slice(0, -1).join(", ")} o ${nombres[nombres.length - 1]}`;
}

async function elegirHora(c, fecha, modo) {
  const estado = modo === "cambio" ? "C_HORA" : "R_HORA";
  const { horas } = await horasLibres({ ...consultaDe(c, modo), fecha });
  if (!horas.length) {
    c.enviar(M.texto("Ese día se acaba de llenar. Elige otro, por favor."));
    return elegirDia(c, modo);
  }
  const conNombres = modo === "reserva" && !c.datos.id_profesional;
  preguntarLista(c, estado, {
    texto: `Horas libres para el *${F.fechaLarga(fecha)}*. ¿Cuál prefieres?`,
    items: horas.map((h) => ({
      id: `hora:${h.hora}`,
      titulo: h.hora,
      descripcion: conNombres ? nombresProfesionales(h.profesionales) : undefined,
    })),
  });
  c.datos.fecha = fecha;
}

async function pasoDia(c, eleccion) {
  if (!eleccion?.startsWith("dia:")) return noEntendi(c);
  const fecha = eleccion.slice(4);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return noEntendi(c);
  return elegirHora(c, fecha, c.estado === "C_DIA" ? "cambio" : "reserva");
}

async function pasoHora(c, eleccion) {
  if (!eleccion?.startsWith("hora:")) return noEntendi(c);
  const hora = eleccion.slice(5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return noEntendi(c);
  c.datos.hora = hora;
  return c.estado === "C_HORA" ? confirmarCambio(c) : confirmarReserva(c);
}

async function confirmarReserva(c) {
  const d = c.datos;
  const reglas = await reglasAgenda();
  const precio = d.variante ? d.variante.precio : d.servicio.precio;
  const abono = Math.min(d.servicio.abono_categoria ?? reglas.abono, precio);
  d.abono = abono;
  const servicio = d.variante ? `${d.servicio.nombre} · ${d.variante.nombre}` : d.servicio.nombre;
  const texto = [
    "Revisa tu reserva:",
    "",
    `*Servicio:* ${servicio}`,
    `*Día:* ${F.mayuscula(F.fechaLarga(d.fecha))} a las ${d.hora}`,
    `*Profesional:* ${d.nombre_profesional || "la primera disponible"}`,
    `*Valor:* ${F.precio(precio)}`,
    `*Abono:* ${F.precio(abono)} (se descuenta del total)`,
    "",
    `Recuerda: los cambios de hora son con ${reglas.horasCambio} horas de anticipación y el abono no se devuelve.`,
    "",
    "Para confirmar tu hora se paga el abono. ¿Cómo lo quieres pagar?",
  ].join("\n");
  c.preguntar(
    "R_CONFIRMAR",
    M.botones(texto, [
      { id: "pag:WEBPAY", titulo: "Tarjeta (Webpay)" },
      { id: "pag:TRANSFERENCIA", titulo: "Transferencia" },
      { id: "menu:inicio", titulo: "Cancelar" },
    ])
  );
}

async function pasoConfirmar(c, eleccion) {
  if (eleccion !== "pag:WEBPAY" && eleccion !== "pag:TRANSFERENCIA") return noEntendi(c);
  const metodo = eleccion.slice(4);
  const d = c.datos;
  let cita;
  try {
    cita = await reservas.crearReserva({
      id_usuario: c.usuario.id_usuario,
      id_servicio: d.servicio.id,
      fecha: d.fecha,
      hora: d.hora,
      id_profesional: d.id_profesional || undefined,
      id_variante: d.variante?.id,
      metodo_abono: metodo,
      notas: "Reservada por WhatsApp",
    });
  } catch (err) {
    if (!errorDeNegocio(err)) throw err;
    if (/esperando su abono/i.test(err.message)) {
      c.estado = "MENU";
      c.datos = {};
      c.enviar(M.botones(err.message, [{ id: "menu:citas", titulo: "Ver mis citas" }, B_MENU]));
      return;
    }
    if (/ya no está disponible/i.test(err.message)) {
      c.enviar(M.texto("Esa hora la acaban de tomar. Te muestro las que siguen libres:"));
      return elegirHora(c, d.fecha, "reserva");
    }
    c.estado = "MENU";
    c.enviar(M.botones(err.message, [B_RESERVAR, B_MENU]));
    return;
  }
  await db.prepare(`UPDATE citas SET origen = 'WHATSAPP' WHERE codigo_cita = ?`).run(cita.codigo_cita);
  return instruccionesDePago(c, cita, { nueva: true });
}

/** Mensaje para pagar el abono (enlace Webpay o datos de transferencia) */
async function instruccionesDePago(c, cita, { nueva = false } = {}) {
  const nombre = F.primerNombre(c.usuario.nombres);
  const abono = F.precio(cita.monto_abono);
  const encabezado = nueva ? `¡Listo, ${nombre}! Tu hora quedó apartada.\n\n${F.detalleCita(cita)}\n\n` : "";
  c.datos = { codigo: cita.codigo_cita };

  if (cita.metodo_abono === "WEBPAY") {
    const { minutosRetencionWebpay } = await reglasAgenda();
    c.estado = "MENU";
    c.datos.opciones = [];
    c.enviar(
      M.enlace(
        `${encabezado}Para confirmarla paga el abono de *${abono}* con tarjeta de débito o crédito. Tienes ${minutosRetencionWebpay} minutos. Apenas se apruebe el pago te aviso por aquí.`,
        "Pagar abono",
        F.enlacePago(cita.codigo_cita)
      )
    );
    return;
  }

  const datosCuenta = (await obtenerTexto("WHATSAPP_DATOS_TRANSFERENCIA", "")).trim();
  const exp = cita.fecha_expiracion_abono || "";
  // "hasta las 18:30" si es hoy; "hasta el Vie 21 nov a las 09:00" si es otro dia
  const hasta = exp.slice(0, 10) === ahoraChile().fecha ? `las ${exp.slice(11, 16)}` : `el ${F.fechaCorta(exp)} a las ${exp.slice(11, 16)}`;
  const instrucciones = datosCuenta
    ? `Para confirmarla transfiere el abono de *${abono}* a esta cuenta:\n\n${datosCuenta}\n\nDespués envíame por aquí una *foto del comprobante*.`
    : `Para confirmarla debes transferir el abono de *${abono}*. En unos minutos el equipo del salón te escribirá por aquí con los datos de la cuenta.`;
  if (!datosCuenta) c.pendiente = 1;
  c.estado = "ESPERA_COMPROBANTE";
  c.datos.opciones = [];
  c.enviar(
    M.texto(
      `${encabezado}${instrucciones}\n\nTe guardamos la hora hasta ${hasta}. Si el abono no llega a tiempo, la hora se libera.`
    )
  );
}

// ------------------------------------------------------------------
// Mis citas
// ------------------------------------------------------------------

async function misCitas(c) {
  if (!c.usuario) {
    c.estado = "MENU";
    c.enviar(
      M.botones(
        `No encontré citas asociadas a este número de WhatsApp.\n\nSi reservaste en la página con otro número, puedes verlas en tu cuenta: ${config.urlFrontend()}/panel/mis-citas`,
        [B_RESERVAR, B_PERSONA, B_MENU]
      )
    );
    return;
  }
  const { proximas } = await reservas.misCitas(c.usuario.id_usuario);
  if (!proximas.length) {
    c.estado = "MENU";
    c.datos = {};
    c.preguntar("MENU", M.botones("No tienes citas próximas.", [B_RESERVAR, B_MENU]));
    return;
  }
  if (proximas.length === 1) return mostrarCita(c, proximas[0].codigo_cita);
  preguntarLista(c, "C_LISTA", {
    texto: `Tienes ${proximas.length} citas próximas. ¿Cuál quieres revisar?`,
    items: proximas.map((x) => ({
      id: `cita:${x.codigo_cita}`,
      titulo: `${F.fechaCorta(x.fecha_hora_inicio)} ${x.fecha_hora_inicio.slice(11, 16)}`,
      descripcion: `${x.servicio} · ${F.estadoCita(x)}`,
    })),
  });
}

async function citaPropia(c, codigo) {
  return reservas.vistaPublica(await reservas.citaDeLaClienta(codigo, c.usuario.id_usuario));
}

async function mostrarCita(c, codigo) {
  const v = await citaPropia(c, codigo);
  const lineas = [F.detalleCita(v), `Estado: ${F.estadoCita(v)}`];
  if (v.estado_abono === "APROBADO") {
    lineas.push(`Abono pagado: ${F.precio(v.monto_abono)}. Pagas ${F.precio(v.saldo)} en el salón.`);
  } else if (v.estado === "PENDIENTE_ABONO" && !v.vencida) {
    lineas.push(`Abono pendiente: ${F.precio(v.monto_abono)} (plazo hasta las ${(v.fecha_expiracion_abono || "").slice(11, 16)}).`);
  }
  const { horasCambio } = await reglasAgenda();
  if (v.estado === "CONFIRMADA" && !v.puede_reagendar && v.puede_cancelar) {
    lineas.push(`\nYa no se puede cambiar la hora: los cambios son con ${horasCambio} horas de anticipación.`);
  }

  const acciones = [];
  if (v.estado === "PENDIENTE_ABONO" && !v.vencida) {
    acciones.push(
      v.metodo_abono === "WEBPAY"
        ? { id: "acc:pagar", titulo: "Pagar abono" }
        : { id: "acc:transferir", titulo: "Datos transferencia" }
    );
  }
  if (v.puede_reagendar) acciones.push({ id: "acc:cambiar", titulo: "Cambiar hora" });
  if (v.puede_cancelar) acciones.push({ id: "acc:cancelar", titulo: "Cancelar cita" });
  if (acciones.length < 3) acciones.push(B_MENU);

  c.preguntar("C_DETALLE", M.botones(lineas.join("\n"), acciones), { codigo });
}

async function pasoListaCitas(c, eleccion) {
  if (!eleccion?.startsWith("cita:")) return noEntendi(c);
  return mostrarCita(c, eleccion.slice(5));
}

async function pasoDetalleCita(c, eleccion) {
  const codigo = c.datos.codigo;
  if (eleccion === "acc:pagar" || eleccion === "acc:transferir") {
    const cita = await reservas.citaDeLaClienta(codigo, c.usuario.id_usuario);
    if (cita.estado !== "PENDIENTE_ABONO") return mostrarCita(c, codigo);
    return instruccionesDePago(c, cita);
  }
  if (eleccion === "acc:cambiar") {
    const cita = await reservas.citaDeLaClienta(codigo, c.usuario.id_usuario);
    c.datos.cambio = { id_servicio: cita.id_servicio, id_cita: cita.id_cita, servicio: cita.servicio };
    return elegirDia(c, "cambio");
  }
  if (eleccion === "acc:cancelar") {
    const v = await citaPropia(c, codigo);
    const pagado = v.estado_abono === "APROBADO";
    const texto = pagado
      ? `¿Seguro que quieres cancelar tu cita del ${F.fechaHoraLarga(v.fecha_hora_inicio)}?\n\nSegún las reglas del salón, el abono de ${F.precio(v.monto_abono)} no se devuelve.${
          v.puede_reagendar ? " Si lo que necesitas es otro día, te conviene cambiar la hora." : ""
        }`
      : `¿Seguro que quieres cancelar tu cita del ${F.fechaHoraLarga(v.fecha_hora_inicio)}?`;
    const botones = [
      { id: "si", titulo: "Sí, cancelar" },
      { id: "no", titulo: "No, mantenerla" },
    ];
    if (pagado && v.puede_reagendar) botones.push({ id: "acc:cambiar", titulo: "Cambiar hora" });
    c.preguntar("C_CANCELAR", M.botones(texto, botones));
    return;
  }
  return noEntendi(c);
}

async function pasoCancelar(c, eleccion) {
  if (eleccion === "no") return mostrarCita(c, c.datos.codigo);
  if (eleccion === "acc:cambiar") return pasoDetalleCita(c, "acc:cambiar");
  if (eleccion !== "si") return noEntendi(c);
  try {
    await reservas.cancelar(c.datos.codigo, c.usuario.id_usuario);
  } catch (err) {
    if (!errorDeNegocio(err)) throw err;
    c.estado = "MENU";
    c.enviar(M.botones(err.message, [B_PERSONA, B_MENU]));
    return;
  }
  c.datos = {};
  c.preguntar("MENU", M.botones("Listo, tu cita quedó cancelada.", [{ id: "menu:reservar", titulo: "Reservar otra hora" }, B_MENU]));
}

async function confirmarCambio(c) {
  const d = c.datos;
  c.preguntar(
    "C_CONF_CAMBIO",
    M.botones(`¿Cambiamos tu cita de *${d.cambio.servicio}* al *${F.fechaLarga(d.fecha)} a las ${d.hora}*?`, [
      { id: "si", titulo: "Sí, cambiar" },
      { id: "no", titulo: "No" },
    ])
  );
}

async function pasoConfirmarCambio(c, eleccion) {
  if (eleccion === "no") return mostrarCita(c, c.datos.codigo);
  if (eleccion !== "si") return noEntendi(c);
  let cita;
  try {
    cita = await reservas.reagendar(c.datos.codigo, c.usuario.id_usuario, { fecha: c.datos.fecha, hora: c.datos.hora });
  } catch (err) {
    if (!errorDeNegocio(err)) throw err;
    if (/ya no está disponible/i.test(err.message)) {
      c.enviar(M.texto("Esa hora la acaban de tomar. Te muestro las que siguen libres:"));
      return elegirHora(c, c.datos.fecha, "cambio");
    }
    c.estado = "MENU";
    c.enviar(M.botones(err.message, [B_PERSONA, B_MENU]));
    return;
  }
  c.datos = {};
  c.preguntar(
    "MENU",
    M.botones(`¡Listo! Tu nueva hora es el ${F.fechaHoraLarga(cita.fecha_hora_inicio)} con ${cita.profesional}. Tu abono se mantiene.`, [
      { id: "menu:citas", titulo: "Ver mis citas" },
      B_MENU,
    ])
  );
}

// ------------------------------------------------------------------
// Precios, horario y atencion de una persona
// ------------------------------------------------------------------

async function pasoPrecios(c, eleccion) {
  if (!eleccion?.startsWith("cat:")) return noEntendi(c);
  const grupo = (await catalogo()).find((g) => g.categoria.id_categoria === Number(eleccion.slice(4)));
  if (!grupo) return elegirCategoria(c, "P_CATEGORIA");
  const lineas = grupo.servicios.map((s) => `• ${s.nombre}: ${F.precioServicio(s)}`);
  const nota = grupo.servicios.some((s) => s.variantes?.length || s.tipo_precio === "EVALUACION")
    ? "\n\nAlgunos valores dependen del largo del cabello o de una evaluación en el salón."
    : "";
  c.enviar(M.texto(`*${grupo.categoria.nombre}*\n\n${lineas.join("\n")}${nota}`));
  c.datos = {};
  c.preguntar(
    "MENU",
    M.botones("¿Qué quieres hacer ahora?", [B_RESERVAR, { id: "menu:precios", titulo: "Otra categoría" }, B_MENU])
  );
}

/** Horario del salon: union de los horarios de las profesionales activas */
async function textoHorario() {
  const porDia = new Map();
  for (const t of await profesionalModel.tramosActivos()) {
    if (!porDia.has(t.dia_semana)) porDia.set(t.dia_semana, []);
    porDia.get(t.dia_semana).push([aMinutos(t.hora_inicio), aMinutos(t.hora_fin)]);
  }
  const NOMBRES = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const textoDia = [];
  for (let dia = 1; dia <= 7; dia++) {
    const unidos = [];
    for (const [ini, fin] of (porDia.get(dia) || []).sort((a, b) => a[0] - b[0])) {
      const ultimo = unidos[unidos.length - 1];
      if (ultimo && ini <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], fin);
      else unidos.push([ini, fin]);
    }
    textoDia[dia] = unidos.length ? unidos.map(([a, b]) => `${aHora(a)} a ${aHora(b)}`).join(" y ") : "cerrado";
  }
  // Junta los dias seguidos con el mismo horario: "Lunes a sábado: 10:00 a 19:00"
  const lineas = [];
  let desde = 1;
  for (let dia = 2; dia <= 8; dia++) {
    if (dia === 8 || textoDia[dia] !== textoDia[desde]) {
      const hasta = dia - 1;
      const dias = desde === hasta ? NOMBRES[desde] : `${NOMBRES[desde]} a ${NOMBRES[hasta].toLowerCase()}`;
      lineas.push(`${dias}: ${textoDia[desde]}`);
      desde = dia;
    }
  }
  return lineas.join("\n");
}

async function horario(c) {
  c.enviar(M.texto(`*Horario de atención*\n${await textoHorario()}\n\n*Dirección*\n${F.DIRECCION}\n${F.MAPA}`));
  c.datos = {};
  c.preguntar("MENU", M.botones("¿Te ayudo con algo más?", [B_RESERVAR, B_PERSONA, B_MENU]));
}

async function hablarConPersona(c) {
  c.estado = "HUMANO";
  c.humano_desde = ahoraUtc();
  c.pendiente = 1;
  c.datos = {};
  c.avisoSalon = "pidió hablar con una persona";
  c.enviar(
    M.texto(
      "Listo. Le avisé al equipo del salón y te responderán por este mismo chat lo antes posible, dentro del horario de atención.\n\nSi quieres volver al asistente, escribe *MENÚ*."
    )
  );
}

/** La clienta mando una foto o documento (normalmente el comprobante de transferencia) */
async function recibirArchivo(c) {
  c.pendiente = 1;
  let pendiente = null;
  if (c.usuario) {
    const { proximas } = await reservas.misCitas(c.usuario.id_usuario);
    pendiente = proximas.find((x) => x.estado === "PENDIENTE_ABONO" && x.metodo_abono === "TRANSFERENCIA");
  }
  c.datos = {};
  if (pendiente) {
    c.avisoSalon = `envió el comprobante de transferencia de la reserva ${pendiente.codigo_cita}`;
    c.preguntar(
      "MENU",
      M.botones(
        "¡Gracias! Recibí tu comprobante. El equipo del salón lo revisará y te confirmaré tu hora por este chat.",
        [B_MENU]
      )
    );
    return;
  }
  c.avisoSalon = "envió un archivo";
  c.preguntar("MENU", M.botones("Recibí tu archivo y se lo dejé al equipo del salón.", [B_PERSONA, B_MENU]));
}

// ------------------------------------------------------------------
// Entrada principal
// ------------------------------------------------------------------

const PASOS = {
  MENU: null, // se resuelve aparte
  ESPERA_COMPROBANTE: null,
  NOMBRE: pasoNombre,
  R_CATEGORIA: pasoCategoria,
  R_SERVICIO: pasoServicio,
  R_EVALUACION: pasoEvaluacion,
  R_VARIANTE: pasoVariante,
  R_PROFESIONAL: pasoProfesional,
  R_DIA: pasoDia,
  R_HORA: pasoHora,
  R_CONFIRMAR: pasoConfirmar,
  C_LISTA: pasoListaCitas,
  C_DETALLE: pasoDetalleCita,
  C_CANCELAR: pasoCancelar,
  C_DIA: pasoDia,
  C_HORA: pasoHora,
  C_CONF_CAMBIO: pasoConfirmarCambio,
  P_CATEGORIA: pasoPrecios,
};

async function atender(c, entrada, sesion) {
  const t = F.normalizar(entrada.texto);
  const esMenu = PALABRAS_MENU.includes(t) || (entrada.id_opcion || "").startsWith("menu:");

  // 1) Una persona del salon esta atendiendo: el agente no responde
  if (c.estado === "HUMANO") {
    const horas = await obtenerNumero("WHATSAPP_HORAS_ATENCION_HUMANA", 24);
    const vigente = msDesde(c.humano_desde) < horas * 3600000;
    if (vigente && !esMenu) {
      c.pendiente = 1;
      return;
    }
    c.humano_desde = null;
    c.pendiente = 0;
    c.estado = "MENU";
    c.datos = {};
    if (!esMenu) return menuPrincipal(c, { saludo: true });
  }

  // 2) Conversacion nueva o abandonada hace rato: parte desde el menu
  const reinicio = sesion.nueva || msDesde(sesion.fecha_actualizacion) > MINUTOS_SESION * 60000;
  if (reinicio && c.estado !== "MENU") {
    c.estado = "MENU";
    c.datos = {};
  }

  // 3) Fotos y documentos
  if (entrada.tipo === "imagen" || entrada.tipo === "documento") return recibirArchivo(c);

  // 4) Palabras que funcionan siempre
  if (entrada.id_opcion?.startsWith("menu:")) return opcionMenu(c, entrada.id_opcion);
  if (esMenu || SALUDOS.includes(t)) return menuPrincipal(c, { saludo: reinicio || SALUDOS.includes(t) });
  if (PALABRAS_PERSONA.some((p) => t.includes(p))) return hablarConPersona(c);

  // 5) Paso actual de la conversacion
  if (c.estado === "MENU" || c.estado === "ESPERA_COMPROBANTE" || !PASOS[c.estado]) {
    const eleccion = resolver(c, entrada);
    if (eleccion === "mas" && c.datos.lista) return preguntarLista(c, c.datos.lista.estado, { ...c.datos.lista, pagina: c.datos.lista.pagina + 1 });
    if (eleccion?.startsWith("menu:")) return opcionMenu(c, eleccion);
    const quiere = intencion(entrada.texto);
    if (quiere) return opcionMenu(c, quiere);
    return menuPrincipal(c, { saludo: reinicio });
  }

  if (c.estado === "NOMBRE") return pasoNombre(c, null, entrada);
  const eleccion = resolver(c, entrada);
  if (eleccion === "mas" && c.datos.lista) {
    return preguntarLista(c, c.datos.lista.estado, { ...c.datos.lista, pagina: c.datos.lista.pagina + 1 });
  }
  if (eleccion?.startsWith("menu:")) return opcionMenu(c, eleccion);
  // No eligio ninguna opcion pero escribio un tema ("horario", "precios"...): se va ahi
  if (!eleccion && !entrada.id_opcion) {
    const quiere = intencion(entrada.texto);
    if (quiere) return opcionMenu(c, quiere);
  }
  return PASOS[c.estado](c, eleccion, entrada);
}

/** Correo a la administracion cuando alguien pide una persona o manda un comprobante */
async function avisarAlSalon(c, motivo) {
  const destinatario = config.correoAviso();
  if (!destinatario || config.esSimulado(c.telefono)) return;
  const quien = c.usuario ? `${c.usuario.nombres} ${c.usuario.apellidos || ""}`.trim() : "Una persona";
  const numero = `+${c.telefono.replace(/\D/g, "")}`;
  const enlace = `${config.urlFrontend()}/panel/whatsapp`;
  await enviarCorreo({
    destinatario,
    asunto: `WhatsApp: ${quien} ${motivo}`,
    texto: `${quien} (${numero}) ${motivo}.\n\nResponde desde el panel: ${enlace}`,
    html: `<p><b>${quien}</b> (${numero}) ${motivo}.</p><p><a href="${enlace}">Responder desde el panel</a></p>`,
  });
}

/**
 * Procesa un mensaje que llego a WhatsApp (o al simulador) y responde.
 * entrada = { wa_id, tipo: 'texto'|'imagen'|'documento'|'otro', texto, id_opcion, media_id }
 */
async function recibir({ telefono, entrada, nombrePerfil }) {
  const id = await modelo.registrarMensaje({
    telefono,
    direccion: "entrada",
    autor: "clienta",
    tipo: entrada.tipo,
    texto: entrada.texto,
    contenido: entrada,
    wa_id: entrada.wa_id,
    estado: "recibido",
  });
  if (id === null) return []; // Meta reenvio un mensaje que ya respondimos

  const sesion = await modelo.obtenerSesion(telefono);
  const usuario = await identificar(telefono, nombrePerfil);
  const c = new Conversacion(telefono, sesion, usuario);

  try {
    await atender(c, entrada, sesion);
  } catch (err) {
    console.error(`[WhatsApp] Error atendiendo a ${telefono}:`, err);
    c.salida = [];
    c.estado = "MENU";
    c.datos = {};
    c.preguntar(
      "MENU",
      M.botones("Uy, tuve un problema al revisar eso. Inténtalo de nuevo en un momento o pide ayuda a una persona.", [
        B_PERSONA,
        B_MENU,
      ])
    );
  }

  await modelo.guardarSesion(telefono, {
    estado: c.estado,
    datos: c.datos,
    humano_desde: c.humano_desde,
    pendiente_respuesta: c.pendiente,
  });
  if (c.salida.length) await envio.enviar(telefono, c.salida);
  if (c.avisoSalon) avisarAlSalon(c, c.avisoSalon).catch((err) => console.warn("[WhatsApp] Aviso al salón:", err.message));
  return c.salida;
}

module.exports = { recibir, textoHorario };
