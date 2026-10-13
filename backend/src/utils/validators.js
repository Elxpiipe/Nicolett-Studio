// src/utils/validators.js
const { body, param, query, validationResult } = require("express-validator");

function manejarErroresValidacion(req, res, next) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({
      error: "Datos invalidos",
      detalles: errores.array().map((e) => ({ campo: e.path, mensaje: e.msg })),
    });
  }
  next();
}

// Password: minimo 8 caracteres, al menos una letra y un numero
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

const validarRegistro = [
  body("nombres").trim().notEmpty().withMessage("Nombres es requerido"),
  body("apellidos").trim().notEmpty().withMessage("Apellidos es requerido"),
  body("email").trim().isEmail().withMessage("Email invalido").normalizeEmail(),
  body("password")
    .matches(PASSWORD_REGEX)
    .withMessage("La contrasena debe tener minimo 8 caracteres, con letras y numeros"),
  body("telefono").optional({ values: "falsy" }).trim().isLength({ max: 20 }),
  body("rut").optional({ values: "falsy" }).trim().isLength({ max: 15 }),
  body("fecha_nacimiento")
    .optional({ values: "falsy" })
    .isISO8601()
    .withMessage("Fecha de nacimiento debe tener formato AAAA-MM-DD"),
  manejarErroresValidacion,
];

const validarLogin = [
  body("email").trim().isEmail().withMessage("Email invalido").normalizeEmail(),
  body("password").notEmpty().withMessage("Contrasena requerida"),
  manejarErroresValidacion,
];

const validarCambioPassword = [
  body("password_actual").notEmpty().withMessage("Contrasena actual requerida"),
  body("password_nueva")
    .matches(PASSWORD_REGEX)
    .withMessage("La nueva contrasena debe tener minimo 8 caracteres, con letras y numeros"),
  manejarErroresValidacion,
];

const validarActualizarPerfil = [
  body("nombres").optional({ values: "falsy" }).trim().notEmpty(),
  body("apellidos").optional({ values: "falsy" }).trim().notEmpty(),
  body("telefono").optional({ values: "falsy" }).trim().isLength({ max: 20 }),
  manejarErroresValidacion,
];

const validarCrearUsuarioAdmin = [
  body("nombres").trim().notEmpty().withMessage("Nombres es requerido"),
  body("apellidos").trim().notEmpty().withMessage("Apellidos es requerido"),
  body("email").trim().isEmail().withMessage("Email invalido").normalizeEmail(),
  body("password")
    .matches(PASSWORD_REGEX)
    .withMessage("La contrasena debe tener minimo 8 caracteres, con letras y numeros"),
  body("id_rol")
    .isInt({ min: 1, max: 3 })
    .withMessage("id_rol debe ser 1 (Administrador), 2 (Profesional) o 3 (Cliente)"),
  body("telefono").optional({ values: "falsy" }).trim().isLength({ max: 20 }),
  body("rut").optional({ values: "falsy" }).trim().isLength({ max: 15 }),
  manejarErroresValidacion,
];

const validarOlvidePassword = [
  body("email").trim().isEmail().withMessage("Email invalido").normalizeEmail(),
  manejarErroresValidacion,
];

const validarRestablecerPassword = [
  body("token").trim().notEmpty().withMessage("Token requerido"),
  body("password_nueva")
    .matches(PASSWORD_REGEX)
    .withMessage("La nueva contrasena debe tener minimo 8 caracteres, con letras y numeros"),
  manejarErroresValidacion,
];

const validarActualizarUsuarioAdmin = [
  body("nombres").optional({ values: "falsy" }).trim().notEmpty(),
  body("apellidos").optional({ values: "falsy" }).trim().notEmpty(),
  body("telefono").optional({ values: "falsy" }).trim().isLength({ max: 20 }),
  body("rut").optional({ values: "falsy" }).trim().isLength({ max: 15 }),
  body("email")
    .optional({ values: "falsy" })
    .trim()
    .isEmail()
    .withMessage("Email invalido")
    .normalizeEmail(),
  manejarErroresValidacion,
];

const validarIdUsuarioParam = [
  param("id").isInt({ min: 1 }).withMessage("Id de usuario invalido"),
  manejarErroresValidacion,
];

const validarListadoUsuarios = [
  query("id_rol").optional().isInt({ min: 1, max: 3 }),
  query("activo").optional().isIn(["0", "1"]),
  query("pagina").optional().isInt({ min: 1 }),
  query("tamanoPagina").optional().isInt({ min: 1, max: 100 }),
  manejarErroresValidacion,
];

// --- Catalogo: categorias ---

const validarCrearCategoria = [
  body("indicaciones").optional({ values: "null" }).isString().isLength({ max: 2000 }).withMessage("Indicaciones muy largas (máx. 2000)"),
  body("adicionales").optional({ values: "null" }).isString().isLength({ max: 2000 }).withMessage("Adicionales muy largos (máx. 2000)"),
  body("nombre").trim().notEmpty().withMessage("Nombre es requerido").isLength({ max: 60 }),
  body("descripcion").optional({ values: "falsy" }).trim().isLength({ max: 255 }),
  body("abono")
    .optional({ values: "null" })
    .custom((v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 1000 && Number(v) <= 100000))
    .withMessage("El abono debe ser un monto entre $1.000 y $100.000 (o vacío para usar el general)"),
  manejarErroresValidacion,
];

const validarActualizarCategoria = [
  body("orden").optional({ values: "falsy" }).isInt({ min: 0, max: 999 }),
  body("indicaciones").optional({ values: "null" }).isString().isLength({ max: 2000 }).withMessage("Indicaciones muy largas (máx. 2000)"),
  body("adicionales").optional({ values: "null" }).isString().isLength({ max: 2000 }).withMessage("Adicionales muy largos (máx. 2000)"),
  body("nombre").optional({ values: "falsy" }).trim().notEmpty().isLength({ max: 60 }),
  body("descripcion").optional({ values: "falsy" }).trim().isLength({ max: 255 }),
  body("abono")
    .optional({ values: "null" })
    .custom((v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 1000 && Number(v) <= 100000))
    .withMessage("El abono debe ser un monto entre $1.000 y $100.000 (o vacío para usar el general)"),
  manejarErroresValidacion,
];

const validarIdCategoriaParam = [
  param("id").isInt({ min: 1 }).withMessage("Id de categoria invalido"),
  manejarErroresValidacion,
];

// --- Catalogo: servicios ---

const validarCrearServicio = [
  body("id_categoria").isInt({ min: 1 }).withMessage("Debes indicar una categoria valida"),
  body("nombre").trim().notEmpty().withMessage("Nombre es requerido").isLength({ max: 80 }),
  body("descripcion").optional({ values: "falsy" }).trim().isLength({ max: 400 }),
  body("duracion_minutos")
    .isInt({ min: 1 })
    .withMessage("La duracion debe ser un numero de minutos mayor a 0"),
  body("precio").isInt({ min: 0 }).withMessage("El precio debe ser un numero mayor o igual a 0"),
  body("tipo_precio").optional().isIn(["FIJO", "DESDE", "EVALUACION"]).withMessage("Tipo de precio inválido"),
  body("orden").optional().isInt({ min: 0, max: 999 }),
  body("variantes").optional().isArray({ max: 12 }).withMessage("Máximo 12 variantes"),
  body("variantes.*.nombre").trim().notEmpty().withMessage("Cada variante necesita un nombre").isLength({ max: 40 }),
  body("variantes.*.detalle").optional({ values: "null" }).trim().isLength({ max: 60 }),
  body("variantes.*.precio").isInt({ min: 0 }).withMessage("Cada variante necesita un precio válido"),
  manejarErroresValidacion,
];

const validarActualizarServicio = [
  body("id_categoria").optional().isInt({ min: 1 }),
  body("nombre").optional({ values: "falsy" }).trim().notEmpty().isLength({ max: 80 }),
  body("descripcion").optional({ values: "falsy" }).trim().isLength({ max: 400 }),
  body("duracion_minutos").optional().isInt({ min: 1 }),
  body("precio").optional().isInt({ min: 0 }),
  body("tipo_precio").optional().isIn(["FIJO", "DESDE", "EVALUACION"]).withMessage("Tipo de precio inválido"),
  body("orden").optional().isInt({ min: 0, max: 999 }),
  body("variantes").optional().isArray({ max: 12 }).withMessage("Máximo 12 variantes"),
  body("variantes.*.nombre").trim().notEmpty().withMessage("Cada variante necesita un nombre").isLength({ max: 40 }),
  body("variantes.*.detalle").optional({ values: "null" }).trim().isLength({ max: 60 }),
  body("variantes.*.precio").isInt({ min: 0 }).withMessage("Cada variante necesita un precio válido"),
  manejarErroresValidacion,
];

const validarIdServicioParam = [
  param("id").isInt({ min: 1 }).withMessage("Id de servicio invalido"),
  manejarErroresValidacion,
];

const validarListadoServicios = [
  query("id_categoria").optional().isInt({ min: 1 }),
  query("activo").optional().isIn(["0", "1"]),
  manejarErroresValidacion,
];

// --- Agenda ---

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const validarIdProfesionalParam = [
  param("id").isInt({ min: 1 }).withMessage("Id de profesional invalido"),
  manejarErroresValidacion,
];

const validarAsignarServicios = [
  body("servicios").isArray().withMessage("Debes enviar la lista de servicios"),
  body("servicios.*").isInt({ min: 1 }).withMessage("Id de servicio invalido"),
  manejarErroresValidacion,
];

const validarHorario = [
  body("tramos").isArray({ max: 50 }).withMessage("Debes enviar la lista de tramos"),
  manejarErroresValidacion,
];

const validarBloqueo = [
  body("fecha_hora_inicio").notEmpty().withMessage("Indica el inicio del bloqueo"),
  body("fecha_hora_fin").notEmpty().withMessage("Indica el termino del bloqueo"),
  body("motivo").optional({ values: "falsy" }).trim().isLength({ max: 120 }),
  manejarErroresValidacion,
];

const validarConsultaServicio = [
  query("id_servicio").isInt({ min: 1 }).withMessage("Indica un servicio valido"),
  query("id_profesional").optional({ values: "falsy" }).isInt({ min: 1 }),
  manejarErroresValidacion,
];

const validarHorasLibres = [
  ...validarConsultaServicio.slice(0, 2),
  query("fecha").matches(FECHA_REGEX).withMessage("La fecha debe tener formato AAAA-MM-DD"),
  manejarErroresValidacion,
];

const validarDiasDisponibles = [
  ...validarConsultaServicio.slice(0, 2),
  query("desde").optional({ values: "falsy" }).matches(FECHA_REGEX),
  query("dias").optional().isInt({ min: 1, max: 42 }),
  manejarErroresValidacion,
];

const validarCrearProfesional = [
  body("nombres").trim().notEmpty().withMessage("El nombre es obligatorio").isLength({ max: 60 }),
  body("apellidos").trim().notEmpty().withMessage("El apellido es obligatorio").isLength({ max: 60 }),
  body("email").trim().isEmail().withMessage("Correo invalido").normalizeEmail({ gmail_remove_dots: false }),
  body("telefono").optional({ values: "falsy" }).trim().isLength({ max: 20 }),
  body("password").isLength({ min: 8 }).withMessage("La clave temporal debe tener al menos 8 caracteres"),
  body("cargo").optional({ values: "falsy" }).trim().isLength({ max: 80 }),
  body("descripcion").optional({ values: "falsy" }).trim().isLength({ max: 500 }),
  manejarErroresValidacion,
];

const validarPerfilProfesional = [
  body("nombres").optional().trim().notEmpty().isLength({ max: 60 }),
  body("apellidos").optional().trim().notEmpty().isLength({ max: 60 }),
  body("cargo").optional({ values: "null" }).trim().isLength({ max: 80 }).withMessage("Cargo muy largo (max. 80)"),
  body("descripcion")
    .optional({ values: "null" })
    .trim()
    .isLength({ max: 500 })
    .withMessage("La descripcion puede tener hasta 500 caracteres"),
  body("es_destacada").optional().isBoolean(),
  body("visible_sitio").optional().isBoolean(),
  body("orden").optional().isInt({ min: 0, max: 999 }),
  body("alias_calendario").optional({ values: "null" }).trim().isLength({ max: 120 }),
  body("google_calendar_id").optional({ values: "null" }).trim().isLength({ max: 255 }),
  manejarErroresValidacion,
];

const validarEstadoProfesional = [body("activo").isBoolean(), manejarErroresValidacion];

const validarConfigGoogle = [
  body("modo").isIn(["desactivado", "compartido", "por_profesional"]).withMessage("Modo invalido"),
  body("calendarioCompartido").optional({ values: "null" }).trim().isLength({ max: 255 }),
  manejarErroresValidacion,
];

module.exports = {
  validarCrearProfesional,
  validarPerfilProfesional,
  validarEstadoProfesional,
  validarConfigGoogle,
  validarIdProfesionalParam,
  validarAsignarServicios,
  validarHorario,
  validarBloqueo,
  validarConsultaServicio,
  validarHorasLibres,
  validarDiasDisponibles,
  validarRegistro,
  validarLogin,
  validarCambioPassword,
  validarActualizarPerfil,
  validarOlvidePassword,
  validarRestablecerPassword,
  validarCrearUsuarioAdmin,
  validarActualizarUsuarioAdmin,
  validarIdUsuarioParam,
  validarListadoUsuarios,
  validarCrearCategoria,
  validarActualizarCategoria,
  validarIdCategoriaParam,
  validarCrearServicio,
  validarActualizarServicio,
  validarIdServicioParam,
  validarListadoServicios,
};
