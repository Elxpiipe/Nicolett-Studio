// backend/scripts/configurar.js
// Asistente de configuracion inicial (lo usa 1-instalar.bat):
//   1. Pide los datos de PostgreSQL (usuario y clave) y prueba la conexion
//   2. Crea la base "nicolett_studio" si no existe
//   3. Crea backend/.env desde .env.example con DATABASE_URL y un JWT_SECRET aleatorio
//   4. Crea frontend/.env si falta
// Se puede ejecutar varias veces: si el .env ya funciona, no cambia nada.
// Uso: node scripts/configurar.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const readline = require("readline");
const { Client } = require("pg");

const BACKEND = path.join(__dirname, "..");
const ENV = path.join(BACKEND, ".env");
const EJEMPLO = path.join(BACKEND, ".env.example");
const FRONT_ENV = path.join(BACKEND, "..", "frontend", ".env");
const FRONT_EJEMPLO = path.join(BACKEND, "..", "frontend", ".env.example");
const BASE = "nicolett_studio";

// ---------------- preguntas por consola ----------------

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
let oculto = false;
rl._writeToOutput = function (texto) {
  if (oculto && !/[\r\n]/.test(texto)) return; // no muestra la clave mientras se escribe
  rl.output.write(texto);
};

function preguntar(texto, { porDefecto = "", secreto = false } = {}) {
  return new Promise((resolve) => {
    const sufijo = porDefecto ? ` [${porDefecto}]` : "";
    rl.question(`${texto}${sufijo}: `, (respuesta) => {
      if (secreto) {
        oculto = false;
        rl.output.write("\n");
      }
      resolve(respuesta.trim() || porDefecto);
    });
    if (secreto) oculto = true;
  });
}

// ---------------- .env ----------------

function leerVariable(texto, clave) {
  const fila = texto.split(/\r?\n/).find((l) => l.startsWith(`${clave}=`));
  return fila ? fila.slice(clave.length + 1).trim() : "";
}

function fijarVariable(texto, clave, valor) {
  const regla = new RegExp(`^${clave}=.*$`, "m");
  if (regla.test(texto)) return texto.replace(regla, () => `${clave}=${valor}`);
  return `${texto.replace(/\s*$/, "")}\n${clave}=${valor}\n`;
}

// ---------------- PostgreSQL ----------------

async function probar(url) {
  const cliente = new Client({ connectionString: url, connectionTimeoutMillis: 8000 });
  await cliente.connect();
  return cliente;
}

function explicar(err) {
  if (err.code === "28P01") return "La clave no es correcta para ese usuario.";
  if (err.code === "ECONNREFUSED") {
    return "PostgreSQL no responde. Revisa que esté instalado y encendido (servicio postgresql-x64-XX en services.msc).";
  }
  if (err.code === "3D000") return "La base de datos no existe.";
  if (err.code === "ENOTFOUND") return "No se encontró ese servidor.";
  return err.message;
}

async function crearBaseSiFalta({ usuario, clave, servidor, puerto }) {
  const admin = await probar(
    `postgresql://${encodeURIComponent(usuario)}:${encodeURIComponent(clave)}@${servidor}:${puerto}/postgres`
  );
  try {
    const existe = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [BASE]);
    if (existe.rowCount) {
      console.log(`  La base "${BASE}" ya existe: se usará esa.`);
    } else {
      await admin.query(`CREATE DATABASE ${BASE}`);
      console.log(`  Base "${BASE}" creada.`);
    }
  } finally {
    await admin.end();
  }
}

// ---------------- principal ----------------

async function main() {
  console.log("\n=== Configuración de Nicolett Sync ===\n");

  if (!fs.existsSync(EJEMPLO)) throw new Error("No se encontró backend/.env.example");
  let texto = fs.existsSync(ENV) ? fs.readFileSync(ENV, "utf8") : fs.readFileSync(EJEMPLO, "utf8");

  // ¿El .env actual ya conecta?
  const actual = leerVariable(texto, "DATABASE_URL");
  let listo = false;
  if (fs.existsSync(ENV) && actual && !actual.includes("tu_clave")) {
    try {
      await (await probar(actual)).end();
      console.log("El archivo backend/.env ya tiene una conexión a PostgreSQL que funciona.");
      listo = true;
    } catch (err) {
      console.log(`La conexión guardada en backend/.env no funciona: ${explicar(err)}`);
    }
  }

  if (!listo) {
    console.log("Escribe los datos de PostgreSQL (presiona Enter para usar el valor entre corchetes).");
    console.log("La clave es la que pusiste al instalar PostgreSQL. No se verá mientras la escribes.\n");
    for (let intento = 1; ; intento++) {
      const usuario = await preguntar("Usuario", { porDefecto: "postgres" });
      const clave = await preguntar("Clave del usuario", { secreto: true });
      const servidor = await preguntar("Servidor", { porDefecto: "localhost" });
      const puerto = await preguntar("Puerto", { porDefecto: "5432" });
      try {
        await crearBaseSiFalta({ usuario, clave, servidor, puerto });
        const url = `postgresql://${encodeURIComponent(usuario)}:${encodeURIComponent(clave)}@${servidor}:${puerto}/${BASE}`;
        await (await probar(url)).end();
        texto = fijarVariable(texto, "DATABASE_URL", url);
        console.log("  Conexión correcta.");
        break;
      } catch (err) {
        console.log(`\n  No se pudo conectar: ${explicar(err)}\n`);
        if (err.code === "ECONNREFUSED" || intento >= 3) throw new Error("Configuración cancelada.");
        console.log("  Intenta de nuevo.\n");
      }
    }
  }

  // Secreto para las sesiones: si sigue el de ejemplo, se crea uno aleatorio
  const secreto = leerVariable(texto, "JWT_SECRET");
  if (!secreto || secreto.startsWith("cambia_esto")) {
    texto = fijarVariable(texto, "JWT_SECRET", crypto.randomBytes(48).toString("hex"));
    console.log("  Se generó un JWT_SECRET aleatorio.");
  }

  fs.writeFileSync(ENV, texto);
  console.log("  backend/.env guardado.");

  if (!fs.existsSync(FRONT_ENV) && fs.existsSync(FRONT_EJEMPLO)) {
    fs.copyFileSync(FRONT_EJEMPLO, FRONT_ENV);
    console.log("  frontend/.env creado.");
  }
  console.log("\nConfiguración lista.\n");
}

main()
  .catch((err) => {
    console.error(`\nERROR: ${err.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
