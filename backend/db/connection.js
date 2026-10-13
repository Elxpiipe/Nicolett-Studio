// db/connection.js
// Conexion unica (singleton) a la base de datos SQLite, usada por toda la app.

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { aplicarMigraciones } = require("./migraciones");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "nicolett.db");

if (!fs.existsSync(DB_PATH)) {
  throw new Error(
    `No existe la base de datos en ${DB_PATH}. Ejecuta primero: npm run db:init`
  );
}

const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

// Asegura que una BD creada con una version anterior del proyecto tenga
// las tablas/columnas nuevas (ej. servicios.imagen_url) sin perder datos.
aplicarMigraciones(db);

module.exports = db;
