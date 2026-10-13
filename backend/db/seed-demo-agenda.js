// db/seed-demo-agenda.js
//
// SOLO PARA DEMOS: crea 3 profesionales de ejemplo (duena destacada + 2) con
// (la duena es Administradora y profesional con la MISMA cuenta)
// servicios, horario y perfil publico para "Nosotras",
// para poder mostrar la agenda funcionando. Las profesionales reales se crean
// desde el panel (Usuarios -> rol Profesional) y se configuran en "Equipo".
//
// Horario usado (ESTIMADO, confirmar con la clienta):
//   Lunes a viernes 10:00-14:00 y 15:00-19:00 (colacion 14-15), sabado 10:00-15:00.
//
// Uso: node db/seed-demo-agenda.js

require("dotenv").config();
const db = require("./connection");
const { hashPassword } = require("../src/utils/password");
const profesionalModel = require("../src/models/profesional.model");

const HORARIO = [
  ...[1, 2, 3, 4, 5].flatMap((dia) => [
    { dia_semana: dia, hora_inicio: "10:00", hora_fin: "14:00" },
    { dia_semana: dia, hora_inicio: "15:00", hora_fin: "19:00" },
  ]),
  { dia_semana: 6, hora_inicio: "10:00", hora_fin: "15:00" },
];

// Textos GENERICOS de ejemplo: reemplazar desde Panel -> Equipo con los datos reales.
const DEMO = [
  {
    nombres: "Demo",
    apellidos: "Dueña",
    email: "demo.duena@nicolett.cl",
    cargo: "Fundadora y profesional principal",
    descripcion:
      "Creó Nicolett Studio Fantasy para que cada clienta viva su momento de belleza a su ritmo y sin barreras. Se especializa en mirada y uñas. (Texto de ejemplo)",
    alias: "Dueña",
    destacada: true,
    // La duena usa UNA sola cuenta: administra el sistema y tambien atiende clientas
    administradora: true,
    orden: 0,
    categorias: ["Pestañas", "Cejas", "Manicura", "Corte y peinado", "Color e iluminación", "Tratamientos capilares", "Alisado"],
  },
  {
    nombres: "Demo",
    apellidos: "Uñas",
    email: "demo.unas@nicolett.cl",
    cargo: "Manicurista",
    descripcion: "Esmaltado permanente, soft gel y diseños a mano alzada. (Texto de ejemplo)",
    alias: "Uñas",
    orden: 1,
    categorias: ["Manicura", "Pedicure", "Podología clínica"],
  },
  {
    nombres: "Demo",
    apellidos: "Mirada",
    email: "demo.mirada@nicolett.cl",
    cargo: "Lashista y depiladora",
    descripcion: "Extensiones de pestañas, laminado de cejas y depilación con cera de abeja. (Texto de ejemplo)",
    alias: "Mirada",
    orden: 2,
    categorias: ["Pestañas", "Cejas", "Depilación", "Depilación masculina"],
  },
];

async function main() {
  const passwordHash = await hashPassword("Demo12345");

  for (const d of DEMO) {
    let usuario = db.prepare(`SELECT id_usuario FROM usuarios WHERE email = ?`).get(d.email);
    if (!usuario) {
      const info = db
        .prepare(
          `INSERT INTO usuarios (id_rol, nombres, apellidos, email, password_hash) VALUES (?, ?, ?, ?, ?)`
        )
        .run(d.administradora ? 1 : 2, d.nombres, d.apellidos, d.email, passwordHash);
      db.prepare(`INSERT INTO profesionales (id_usuario, descripcion) VALUES (?, ?)`).run(
        info.lastInsertRowid,
        d.descripcion
      );
      usuario = { id_usuario: info.lastInsertRowid };
      console.log(`Creada ${d.nombres} ${d.apellidos} (${d.email} / Demo12345)`);
    } else {
      console.log(`Ya existe ${d.email}, se actualizan sus servicios y horario.`);
    }

    if (d.administradora) profesionalModel.cambiarRolUsuario(usuario.id_usuario, true);
    const profesional = profesionalModel.obtenerPorUsuario(usuario.id_usuario);
    const servicios = db
      .prepare(
        `SELECT s.id_servicio FROM servicios s JOIN categorias_servicio c ON c.id_categoria = s.id_categoria
         WHERE s.activo = 1 AND c.nombre IN (${d.categorias.map(() => "?").join(",")})`
      )
      .all(...d.categorias)
      .map((s) => s.id_servicio);

    profesionalModel.reemplazarServicios(profesional.id_profesional, servicios);
    profesionalModel.actualizarPerfil(profesional.id_profesional, {
      cargo: d.cargo,
      descripcion: d.descripcion,
      // Alias para reconocerla en eventos anotados a mano en Google Calendar
      alias_calendario: d.alias,
      es_destacada: Boolean(d.destacada),
      orden: d.orden,
      visible_sitio: true,
    });
    profesionalModel.reemplazarHorario(profesional.id_profesional, HORARIO);
    console.log(`  ${servicios.length} servicio(s) asignados y horario cargado.`);
  }
  console.log("\nListo. Revisa y ajusta todo en Panel -> Equipo y horarios.");
}

main();
