// db/init.js
// Crea (o recrea) la base de datos SQLite a partir de schema.sql
// Uso: npm run db:init

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { aplicarMigraciones } = require("./migraciones");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "nicolett.db");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");

if (!fs.existsSync(SCHEMA_PATH)) {
  console.error("No se encontro schema.sql en", SCHEMA_PATH);
  process.exit(1);
}

const schema = fs.readFileSync(SCHEMA_PATH, "utf8");

const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

console.log("Aplicando schema.sql sobre", DB_PATH, "...");
db.exec(schema);

console.log("Aplicando migraciones (cambios adicionales) ...");
aplicarMigraciones(db);

console.log("Base de datos inicializada correctamente.");

db.close();
