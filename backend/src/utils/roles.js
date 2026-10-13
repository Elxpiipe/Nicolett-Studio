// src/utils/roles.js
// Coincide con los registros insertados en db/schema.sql -> tabla roles

const ROLES = {
  ADMINISTRADOR: { id_rol: 1, nombre: "Administrador" },
  PROFESIONAL: { id_rol: 2, nombre: "Profesional" },
  CLIENTE: { id_rol: 3, nombre: "Cliente" },
};

const NOMBRES_ROL_POR_ID = {
  1: "Administrador",
  2: "Profesional",
  3: "Cliente",
};

module.exports = { ROLES, NOMBRES_ROL_POR_ID };
