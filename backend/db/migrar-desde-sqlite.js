// db/migrar-desde-sqlite.js
// Copia TODOS los datos de la base SQLite antigua (nicolett.db) a PostgreSQL,
// con los mismos ids, y deja los contadores de id donde iban.
//
// Uso:  npm run db:migrar-sqlite                      (usa ./db/nicolett.db)
//       npm run db:migrar-sqlite -- ruta/a/otra.db
//       npm run db:migrar-sqlite -- --reemplazar      (si PostgreSQL ya tiene usuarios)
//
// Todo corre en una transaccion: si algo falla, PostgreSQL queda como estaba.
// Al final compara fila por fila SQLite contra PostgreSQL.

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("./connection");

const args = process.argv.slice(2);
const reemplazar = args.includes("--reemplazar");
const rutaDb = path.resolve(args.find((a) => !a.startsWith("--")) || path.join(__dirname, "nicolett.db"));
// Equivale a los INSERT OR IGNORE / UPDATE de migrations.sql (no toca filas que ya existan)
const DATOS_DE_ARRANQUE = `
INSERT INTO categorias_servicio (nombre, descripcion)
SELECT v.nombre, v.descripcion FROM (VALUES
  ('Cejas', 'Perfilado, laminado y henna de cejas'),
  ('Facial', 'Limpieza facial profunda e hidratacion'),
  ('Depilación', 'Cera de abeja hipoalergénica: suave con tu piel')
) AS v(nombre, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM categorias_servicio c WHERE c.nombre = v.nombre);

UPDATE configuracion_sistema
   SET valor = '48', descripcion = 'Horas minimas de anticipacion para cambiar la hora. Fuera de plazo el abono se pierde'
 WHERE clave = 'HORAS_CANCELACION' AND valor = '24';

INSERT INTO configuracion_sistema (clave, valor, descripcion) VALUES
('HORAS_RETENCION_TRANSFERENCIA', '2', 'Horas que se guarda una hora pagada por transferencia antes de liberarla si no llega el abono'),
('ABONO_REEMBOLSABLE', '0', 'El abono no se devuelve nunca: solo se puede reagendar con la anticipacion minima'),
('INTERVALO_AGENDA_MIN', '30', 'Cada cuantos minutos se ofrecen horas de inicio'),
('ANTICIPACION_MINIMA_MIN', '60', 'Minutos minimos entre el momento de reservar y el inicio de la cita'),
('DIAS_MAXIMOS_RESERVA', '60', 'Con cuantos dias de anticipacion maxima se puede reservar'),
('GOOGLE_CAL_MODO', 'desactivado', 'desactivado | compartido (un calendario para todo el salon) | por_profesional'),
('GOOGLE_CAL_ID', '', 'Id del calendario compartido del salon (modo compartido)'),
('MINUTOS_RETENCION_WEBPAY', '15', 'Minutos que se aparta la hora mientras la clienta paga el abono en Webpay')
ON CONFLICT DO NOTHING;
`;

const q = (nombre) => `"${nombre.replace(/"/g, '""')}"`;

function abrirSqlite() {
  let Database;
  try {
    Database = require("better-sqlite3");
  } catch {
    throw new Error("Falta better-sqlite3 para leer la base antigua. Ejecuta: npm install better-sqlite3");
  }
  if (!fs.existsSync(rutaDb)) throw new Error(`No existe ${rutaDb}`);
  return new Database(rutaDb, { readonly: true, fileMustExist: true });
}

/** Tablas de PostgreSQL ordenadas: primero las que no dependen de otras */
async function tablasEnOrden() {
  const tablas = (
    await db.prepare(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`).all()
  ).map((f) => f.t);
  const relaciones = await db
    .prepare(
      `SELECT tc.table_name AS t, ccu.table_name AS ref
         FROM information_schema.table_constraints tc
         JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`
    )
    .all();
  const depende = new Map(tablas.map((t) => [t, new Set()]));
  for (const r of relaciones) if (r.t !== r.ref) depende.get(r.t).add(r.ref);
  const orden = [];
  while (orden.length < tablas.length) {
    const siguiente = tablas.find((t) => !orden.includes(t) && [...depende.get(t)].every((d) => orden.includes(d)));
    if (!siguiente) throw new Error("Dependencias circulares entre tablas");
    orden.push(siguiente);
  }
  return orden;
}

/** Valor comparable entre SQLite y PostgreSQL */
function normalizar(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return Number(v);
  if (Buffer.isBuffer(v)) return v.toString("hex");
  return v;
}

async function main() {
  const sqlite = abrirSqlite();
  if (sqlite.prepare("PRAGMA integrity_check").pluck().get() !== "ok") throw new Error("La base SQLite esta danada (integrity_check).");
  const fkRotas = sqlite.prepare("PRAGMA foreign_key_check").all();
  if (fkRotas.length) {
    console.error(fkRotas);
    throw new Error("Hay filas en SQLite con llaves foraneas rotas: corregirlas antes de migrar.");
  }

  // Asegura que las tablas existan en PostgreSQL
  await db.exec(`SET client_min_messages TO warning;\n${fs.readFileSync(path.join(__dirname, "schema.postgres.sql"), "utf8")}`);

  const conUsuarios = (await db.prepare(`SELECT COUNT(*) AS n FROM usuarios`).get()).n;
  if (conUsuarios && !reemplazar) {
    throw new Error(
      `PostgreSQL ya tiene ${conUsuarios} usuario(s). Para borrar todo y copiar de nuevo desde SQLite, agrega --reemplazar.`
    );
  }

  const tablasSqlite = new Set(
    sqlite.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).pluck().all()
  );
  const orden = await tablasEnOrden();
  const desconocidas = [...tablasSqlite].filter((t) => !orden.includes(t));
  if (desconocidas.length) throw new Error(`Tablas de SQLite que no existen en PostgreSQL: ${desconocidas.join(", ")}`);
  const secuencias = new Map(
    tablasSqlite.size ? sqlite.prepare(`SELECT name, seq FROM sqlite_sequence`).all().map((r) => [r.name, Number(r.seq)]) : []
  );

  const resumen = [];
  await db.transaction(async () => {
    // Se parte de cero: SQLite manda (incluye roles, categorias y configuracion)
    await db.exec(`TRUNCATE ${orden.map(q).join(", ")} RESTART IDENTITY CASCADE`);

    for (const tabla of orden) {
      if (!tablasSqlite.has(tabla)) {
        resumen.push({ tabla, filas: 0, nota: "no existe en SQLite" });
        continue;
      }
      const columnas = sqlite.prepare(`PRAGMA table_info(${q(tabla)})`).all();
      const nombres = columnas.map((c) => c.name);
      const columnasPg = await db
        .prepare(`SELECT column_name AS c, is_identity AS identidad FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ?`)
        .all(tabla);
      const enPg = new Set(columnasPg.map((c) => c.c));
      const faltan = nombres.filter((n) => !enPg.has(n));
      if (faltan.length) throw new Error(`En PostgreSQL falta ${tabla}.${faltan.join(", ")}`);
      const identidad = columnasPg.find((c) => c.identidad === "YES")?.c;

      const filas = sqlite.prepare(`SELECT ${nombres.map(q).join(", ")} FROM ${q(tabla)}`).raw().all();
      const LOTE = 500;
      for (let i = 0; i < filas.length; i += LOTE) {
        const lote = filas.slice(i, i + LOTE);
        const marcas = lote.map((f) => `(${f.map(() => "?").join(", ")})`).join(", ");
        try {
          await db
            .prepare(
              `INSERT INTO ${q(tabla)} (${nombres.map(q).join(", ")}) ${identidad ? "OVERRIDING SYSTEM VALUE" : ""} VALUES ${marcas}`
            )
            .run(...lote.flat().map(normalizar));
        } catch (err) {
          throw new Error(`Error copiando ${tabla} (filas ${i + 1} a ${i + lote.length}): ${err.message}`);
        }
      }

      // El contador sigue desde el mayor entre MAX(id) y sqlite_sequence (no reutiliza ids borrados)
      let proximo = "-";
      if (identidad) {
        const maximo = Number(sqlite.prepare(`SELECT COALESCE(MAX(${q(identidad)}), 0) FROM ${q(tabla)}`).pluck().get());
        proximo = Math.max(maximo, secuencias.get(tabla) || 0) + 1;
        await db.prepare(`SELECT setval(pg_get_serial_sequence(?, ?), ?, false)`).get(tabla, identidad, proximo);
      }

      // Verificacion fila por fila
      const pk = columnas.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => q(c.name));
      const ordenPk = (pk.length ? pk : nombres.map(q)).join(", ");
      const deSqlite = sqlite.prepare(`SELECT ${nombres.map(q).join(", ")} FROM ${q(tabla)} ORDER BY ${ordenPk}`).all();
      const dePg = await db.prepare(`SELECT ${nombres.map(q).join(", ")} FROM ${q(tabla)} ORDER BY ${ordenPk}`).all();
      if (deSqlite.length !== dePg.length) throw new Error(`${tabla}: SQLite tiene ${deSqlite.length} filas y PostgreSQL ${dePg.length}`);
      deSqlite.forEach((filaS, i) => {
        for (const n of nombres) {
          const a = normalizar(filaS[n]);
          const b = normalizar(dePg[i][n]);
          if (a !== b && !(typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 1e-9)) {
            throw new Error(`${tabla}, fila ${i + 1}, columna ${n}: SQLite=${JSON.stringify(a)} PostgreSQL=${JSON.stringify(b)}`);
          }
        }
      });
      resumen.push({ tabla, filas: filas.length, proximo_id: proximo });
    }

    // Lo que la app con SQLite agregaba sola al arrancar (migrations.sql), por si la base es antigua
    await db.exec(DATOS_DE_ARRANQUE);
  })();

  sqlite.close();
  console.table(resumen);
  const total = resumen.reduce((s, r) => s + r.filas, 0);
  console.log(`Listo: ${total} filas copiadas desde ${rutaDb} y verificadas una por una.`);
}

main()
  .catch((err) => {
    console.error("\nMigracion cancelada, PostgreSQL quedo sin cambios.");
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
