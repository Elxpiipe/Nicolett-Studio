// db/seed-admin.js
// Crea el primer usuario Administrador del sistema.
// El registro publico (/api/auth/registro) SOLO crea Clientes por diseno,
// asi que el primer admin se crea una vez, desde este script.
//
// Uso:
//   node db/seed-admin.js "Nombre" "Apellido" "correo@dominio.cl" "PasswordSegura1"

require("dotenv").config();
const usuarioModel = require("../src/models/usuario.model");
const { hashPassword } = require("../src/utils/password");
const { ROLES } = require("../src/utils/roles");

const [, , nombres, apellidos, email, password] = process.argv;

if (!nombres || !apellidos || !email || !password) {
  console.error(
    'Uso: node db/seed-admin.js "Nombre" "Apellido" "correo@dominio.cl" "PasswordSegura1"'
  );
  process.exit(1);
}

const existente = usuarioModel.findByEmail(email);
if (existente) {
  console.error("Ya existe un usuario con ese email.");
  process.exit(1);
}

const usuario = usuarioModel.crearUsuarioConPerfil({
  id_rol: ROLES.ADMINISTRADOR.id_rol,
  nombres,
  apellidos,
  email,
  password_hash: hashPassword(password),
});

console.log("Administrador creado:", {
  id_usuario: usuario.id_usuario,
  email: usuario.email,
  rol: usuario.rol,
});
