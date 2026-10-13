// backend/diagnostico-calendar.js
// Revisa por qué una cita no aparece en Google Calendar.
// Uso (dentro de la carpeta backend):  node diagnostico-calendar.js NS-261013-370B
// No modifica nada salvo intentar escribir en Google las citas que falten.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("./db/connection");

const codigo = process.argv[2] || "NS-261013-370B";

(async () => {
  console.log("1) Configuración guardada en el panel:");
  console.table(db.prepare(`SELECT clave, valor FROM configuracion_sistema WHERE clave LIKE 'GOOGLE%'`).all());

  console.log("2) ¿Existe el servicio de sincronización de citas en este proyecto?");
  const ruta = path.join(__dirname, "src", "services", "calendarioCitas.service.js");
  console.log(fs.existsSync(ruta) ? "   Sí" : "   NO: falta src/services/calendarioCitas.service.js");

  console.log(`3) Datos de la cita ${codigo}:`);
  const columnas = db.prepare(`PRAGMA table_info(citas)`).all().map((c) => c.name);
  const extra = ["metodo_abono", "google_calendar_event_id", "google_calendar_calendario", "google_calendar_estado"]
    .filter((c) => columnas.includes(c))
    .join(", ");
  console.table([db.prepare(`SELECT codigo_cita, estado, fecha_hora_inicio, id_profesional, ${extra} FROM citas WHERE codigo_cita = ?`).get(codigo)]);

  if (fs.existsSync(ruta)) {
    console.log("4) Intentando sincronizar ahora con Google...");
    const calendarioCitas = require("./src/services/calendarioCitas.service");
    const resumen = await calendarioCitas.sincronizar();
    console.log("   Resultado:", resumen);
    console.table([db.prepare(`SELECT codigo_cita, google_calendar_event_id FROM citas WHERE codigo_cita = ?`).get(codigo)]);
  }
  process.exit(0);
})().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
