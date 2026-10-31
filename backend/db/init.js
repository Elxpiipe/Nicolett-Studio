// db/init.js
// Crea (o completa) las tablas en PostgreSQL a partir de schema.postgres.sql.
// No borra tablas ni datos: se puede ejecutar todas las veces que se quiera.
// Uso: npm run db:init

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("./connection");

const SCHEMA_PATH = path.join(__dirname, "schema.postgres.sql");

async function main() {
  if (!fs.existsSync(SCHEMA_PATH)) {
    throw new Error(`No se encontro schema.postgres.sql en ${SCHEMA_PATH}`);
  }
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  console.log("Aplicando schema.postgres.sql en", process.env.DATABASE_URL.replace(/:[^:@/]*@/, ":****@"), "...");
  // Sin los avisos "ya existe" de las tablas que ya estaban creadas
  await db.exec(`SET client_min_messages TO warning;\n${schema}`);
  console.log("Base de datos inicializada correctamente.");
}

main()
  .catch((err) => {
    console.error("No se pudo inicializar la base de datos:", err.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
