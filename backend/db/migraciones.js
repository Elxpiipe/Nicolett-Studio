// db/migraciones.js
// Aplica los cambios incrementales sobre la base de datos (sin tocar schema.sql).
// Es idempotente: se puede ejecutar todas las veces que se quiera. Se llama
// automaticamente al iniciar el servidor (db/connection.js) y desde db/init.js,
// asi una base de datos que ya existia recibe las columnas/tablas nuevas sin
// tener que recrearla ni perder datos.

const fs = require("fs");
const path = require("path");

const MIGRATIONS_PATH = path.join(__dirname, "migrations.sql");

function columnaExiste(db, tabla, columna) {
  return db
    .prepare(`PRAGMA table_info(${tabla})`)
    .all()
    .some((c) => c.name === columna);
}

function aplicarMigraciones(db) {
  // 1) Cambios en SQL puro (tablas nuevas, categorias adicionales, etc.)
  if (fs.existsSync(MIGRATIONS_PATH)) {
    db.exec(fs.readFileSync(MIGRATIONS_PATH, "utf8"));
  }

  // 2) Columnas nuevas. SQLite no soporta "ADD COLUMN IF NOT EXISTS",
  //    por eso se revisa primero con PRAGMA table_info.
  if (!columnaExiste(db, "servicios", "imagen_url")) {
    db.exec(`ALTER TABLE servicios ADD COLUMN imagen_url TEXT`);
    console.log("Migracion: columna servicios.imagen_url agregada");
  }

  // Perfil publico de profesionales ("Nosotras") y su calendario de Google
  const columnasProfesional = [
    ["foto_url", "TEXT"],
    ["cargo", "TEXT"],
    ["es_destacada", "INTEGER NOT NULL DEFAULT 0"],
    ["visible_sitio", "INTEGER NOT NULL DEFAULT 1"],
    ["orden", "INTEGER NOT NULL DEFAULT 0"],
    // Palabras que identifican a la profesional en el titulo de un evento de
    // Google Calendar anotado a mano (modo calendario compartido). Ej: "Nico, Nicole"
    ["alias_calendario", "TEXT"],
    // Calendario propio de la profesional (modo un calendario por profesional)
    ["google_calendar_id", "TEXT"],
  ];
  for (const [columna, tipo] of columnasProfesional) {
    if (!columnaExiste(db, "profesionales", columna)) {
      db.exec(`ALTER TABLE profesionales ADD COLUMN ${columna} ${tipo}`);
      console.log(`Migracion: columna profesionales.${columna} agregada`);
    }
  }

  // Modulo 3.2: reserva + abono
  const columnasCita = [
    // 'WEBPAY' o 'TRANSFERENCIA': como eligio pagar el abono la clienta
    ["metodo_abono", "TEXT"],
    // 'AAAA-MM-DD HH:MM' (hora de Chile). Mientras la cita este PENDIENTE_ABONO,
    // la hora queda apartada hasta este momento; despues se libera sola.
    ["fecha_expiracion_abono", "TEXT"],
  ];
  for (const [columna, tipo] of columnasCita) {
    if (!columnaExiste(db, "citas", columna)) {
      db.exec(`ALTER TABLE citas ADD COLUMN ${columna} ${tipo}`);
      console.log(`Migracion: columna citas.${columna} agregada`);
    }
  }
  // Busquedas rapidas de reservas pendientes que vencen
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_citas_estado_expiracion
       ON citas (estado, fecha_expiracion_abono)`
  );

  // Abono por categoria (NULL = usa el abono general ABONO_CITA).
  // Las publicaciones del salon indican $10.000 para servicios de cabello.
  if (!columnaExiste(db, "categorias_servicio", "abono")) {
    db.exec(`ALTER TABLE categorias_servicio ADD COLUMN abono INTEGER`);
    const info = db
      .prepare(
        `UPDATE categorias_servicio SET abono = 10000
         WHERE lower(nombre) LIKE '%pelu%' OR lower(nombre) LIKE '%capilar%' OR lower(nombre) LIKE '%cabello%'`
      )
      .run();
    console.log(`Migracion: columna categorias_servicio.abono agregada (${info.changes} categoria(s) de cabello con $10.000)`);
  }

  // Sincronizacion de citas con Google Calendar: en que calendario quedo el
  // evento y con que estado se escribio (para saber cuando actualizarlo)
  for (const columna of ["google_calendar_calendario", "google_calendar_estado"]) {
    if (!columnaExiste(db, "citas", columna)) {
      db.exec(`ALTER TABLE citas ADD COLUMN ${columna} TEXT`);
      console.log(`Migracion: columna citas.${columna} agregada`);
    }
  }

  // Tienda: foto, marca y linea de los productos
  for (const [columna, tipo] of [["imagen_url", "TEXT"], ["marca", "TEXT"], ["linea", "TEXT"]]) {
    if (!columnaExiste(db, "productos", columna)) {
      db.exec(`ALTER TABLE productos ADD COLUMN ${columna} ${tipo}`);
      console.log(`Migracion: columna productos.${columna} agregada`);
    }
  }
  // Tienda: pedidos web (la tabla ventas del modelo original tambien sirve para
  // ventas en el local; canal distingue una de otra)
  const columnasVenta = [
    ["codigo_venta", "TEXT"], // NV-260930-4F2A
    ["canal", "TEXT NOT NULL DEFAULT 'LOCAL'"], // 'WEB' | 'LOCAL'
    ["fecha_expiracion_pago", "TEXT"], // hasta cuando se aparta el stock mientras paga
    ["stock_reservado", "INTEGER NOT NULL DEFAULT 0"], // 1 = el stock ya se desconto
    ["fecha_pago", "TEXT"],
    ["fecha_entrega", "TEXT"], // cuando la clienta retiro el pedido en el salon
    ["notas", "TEXT"],
    ["motivo_anulacion", "TEXT"],
  ];
  for (const [columna, tipo] of columnasVenta) {
    if (!columnaExiste(db, "ventas", columna)) {
      db.exec(`ALTER TABLE ventas ADD COLUMN ${columna} ${tipo}`);
      console.log(`Migracion: columna ventas.${columna} agregada`);
    }
  }
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ventas_codigo ON ventas (codigo_venta)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ventas_estado_expiracion ON ventas (estado, fecha_expiracion_pago)`);

  // Modulo 3.3: cuantas veces la clienta cambio la hora de su cita
  if (!columnaExiste(db, "citas", "veces_reagendada")) {
    db.exec(`ALTER TABLE citas ADD COLUMN veces_reagendada INTEGER NOT NULL DEFAULT 0`);
    console.log("Migracion: columna citas.veces_reagendada agregada");
  }

  // ---------------------------------------------------------------
  // Catalogo segun las listas de precios de la clienta
  // ---------------------------------------------------------------
  // Reglas que se muestran antes de reservar (ej. "ven con tus pestanas limpias")
  // y adicionales que se cobran en el salon (ej. "Francesa o degrade | + $5.000")
  for (const columna of ["indicaciones", "adicionales"]) {
    if (!columnaExiste(db, "categorias_servicio", columna)) {
      db.exec(`ALTER TABLE categorias_servicio ADD COLUMN ${columna} TEXT`);
      console.log(`Migracion: columna categorias_servicio.${columna} agregada`);
    }
  }
  // Orden de las categorias en la pagina de servicios
  if (!columnaExiste(db, "categorias_servicio", "orden")) {
    db.exec(`ALTER TABLE categorias_servicio ADD COLUMN orden INTEGER NOT NULL DEFAULT 0`);
    console.log("Migracion: columna categorias_servicio.orden agregada");
  }
  // FIJO = precio exacto · DESDE = precio base ("Desde $89.990") ·
  // EVALUACION = sin precio fijo, no se reserva online (se cotiza por WhatsApp)
  if (!columnaExiste(db, "servicios", "tipo_precio")) {
    db.exec(`ALTER TABLE servicios ADD COLUMN tipo_precio TEXT NOT NULL DEFAULT 'FIJO'`);
    console.log("Migracion: columna servicios.tipo_precio agregada");
  }
  if (!columnaExiste(db, "servicios", "orden")) {
    db.exec(`ALTER TABLE servicios ADD COLUMN orden INTEGER NOT NULL DEFAULT 0`);
    console.log("Migracion: columna servicios.orden agregada");
  }
  // Precio segun largo de cabello (S/M/L/XL): mismo servicio y duracion, distinto valor
  db.exec(`
    CREATE TABLE IF NOT EXISTS servicio_variantes (
      id_variante INTEGER PRIMARY KEY AUTOINCREMENT,
      id_servicio INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      detalle TEXT,
      precio INTEGER NOT NULL CHECK (precio >= 0),
      orden INTEGER NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
      FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio) ON UPDATE CASCADE ON DELETE CASCADE,
      UNIQUE (id_servicio, nombre)
    )`);
  for (const [columna, tipo] of [["id_variante", "INTEGER REFERENCES servicio_variantes(id_variante)"], ["variante", "TEXT"]]) {
    if (!columnaExiste(db, "cita_servicio", columna)) {
      db.exec(`ALTER TABLE cita_servicio ADD COLUMN ${columna} ${tipo}`);
      console.log(`Migracion: columna cita_servicio.${columna} agregada`);
    }
  }

  // Agenda del dia: cuando y quien marco la cita como atendida / no asistio
  for (const [columna, tipo] of [["fecha_atencion", "TEXT"], ["id_usuario_atencion", "INTEGER REFERENCES usuarios(id_usuario)"]]) {
    if (!columnaExiste(db, "citas", columna)) {
      db.exec(`ALTER TABLE citas ADD COLUMN ${columna} ${tipo}`);
      console.log(`Migracion: columna citas.${columna} agregada`);
    }
  }

  // Carrusel de promociones del Inicio (con fechas de vigencia)
  db.exec(`
    CREATE TABLE IF NOT EXISTS promociones (
      id_promocion INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      descripcion TEXT,
      imagen_url TEXT,
      enlace TEXT,
      fecha_inicio TEXT,
      fecha_fin TEXT,
      orden INTEGER NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
      fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

  // Respuesta de Webpay (codigo de autorizacion, ultimos 4 digitos, etc.) en JSON
  if (!columnaExiste(db, "pagos", "detalle_pasarela")) {
    db.exec(`ALTER TABLE pagos ADD COLUMN detalle_pasarela TEXT`);
    console.log("Migracion: columna pagos.detalle_pasarela agregada");
  }
}

module.exports = { aplicarMigraciones };
