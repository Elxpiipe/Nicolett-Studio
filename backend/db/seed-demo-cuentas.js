// db/seed-demo-cuentas.js
// SOLO PARA DEMOS: crea una cuenta de Administrador y una de Cliente de prueba.
// Si ya existen, no hace nada. Uso: node db/seed-demo-cuentas.js
require("dotenv").config();
const usuarioModel = require("../src/models/usuario.model");
const { ROLES } = require("../src/utils/roles");
const { hashPassword } = require("../src/utils/password");

// La administradora de la demo es "Demo Dueña" (demo.duena@nicolett.cl), creada en
// seed-demo-agenda.js: una sola cuenta para administrar y atender.
const CUENTAS = [
  { rol: ROLES.CLIENTE, nombres: "Clienta", apellidos: "Demo", email: "clienta.demo@nicolett.cl", password: "Cliente12345" },
];

(async () => {
  for (const c of CUENTAS) {
    if (usuarioModel.findByEmail(c.email)) {
      console.log(`Ya existe ${c.email}`);
      continue;
    }
    usuarioModel.crearUsuarioConPerfil({
      id_rol: c.rol.id_rol,
      nombres: c.nombres,
      apellidos: c.apellidos,
      email: c.email,
      password_hash: await hashPassword(c.password),
    });
    console.log(`Creada ${c.email} / ${c.password} (${c.rol.nombre})`);
  }
})();
