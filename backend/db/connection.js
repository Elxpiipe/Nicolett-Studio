// db/connection.js
// Conexion unica a PostgreSQL (pool), usada por toda la app.
//
// Mantiene la misma forma de uso que tenia better-sqlite3, pero asincrona:
//   await db.prepare(sql).get(...params)   -> primera fila (o undefined)
//   await db.prepare(sql).all(...params)   -> todas las filas
//   await db.prepare(sql).run(...params)   -> { changes, lastInsertRowid }
//   const tx = db.transaction(async (...) => { ... });  await tx(...)
//
// Parametros: se siguen escribiendo con ? (posicionales) o @nombre (con un objeto),
// y aqui se traducen a $1, $2... de PostgreSQL.
// lastInsertRowid: el INSERT debe terminar en "RETURNING id_..."; se toma esa columna.

require("dotenv").config();
const { AsyncLocalStorage } = require("async_hooks");
const { Pool, types } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error(
    "Falta DATABASE_URL en el .env (ej. postgresql://postgres:clave@localhost:5432/nicolett_studio). " +
      "Despues ejecuta: npm run db:init"
  );
}

// COUNT(*) y SUM(...) llegan como bigint/numeric; SQLite los devolvia como numero.
types.setTypeParser(20, (v) => (v === null ? null : Number(v))); // bigint
types.setTypeParser(1700, (v) => (v === null ? null : Number(v))); // numeric

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on("error", (err) => console.error("[PostgreSQL] Error en una conexion inactiva:", err.message));

// Transaccion en curso (si la hay) para la cadena de llamadas actual
const contexto = new AsyncLocalStorage();

// Toda transaccion toma este candado: se ejecutan de a una, como en SQLite.
// Asi "validar hora libre + guardar la reserva" sigue siendo atomico.
const LLAVE_TRANSACCIONES = 7710;

function conexionActual() {
  const tx = contexto.getStore();
  return tx && !tx.terminada ? tx.cliente : pool;
}

/** Traduce ? y @nombre a $1, $2... (sin tocar textos entre comillas ni comentarios) */
function traducir(sql, args) {
  const nombrados = args.length === 1 && args[0] !== null && typeof args[0] === "object" && !Array.isArray(args[0]) && !Buffer.isBuffer(args[0]);
  const posicionales = nombrados ? [] : args.flat();
  const valores = [];
  const indicePorNombre = new Map();
  let salida = "";
  let posicion = 0;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'" || c === '"') {
      const fin = sql.indexOf(c, i + 1);
      const hasta = fin === -1 ? sql.length : fin + 1;
      salida += sql.slice(i, hasta);
      i = hasta - 1;
    } else if (c === "-" && sql[i + 1] === "-") {
      const fin = sql.indexOf("\n", i);
      const hasta = fin === -1 ? sql.length : fin;
      salida += sql.slice(i, hasta);
      i = hasta - 1;
    } else if (c === "?") {
      if (posicion >= posicionales.length) throw new Error(`Faltan parametros para la consulta: ${sql}`);
      valores.push(posicionales[posicion++]);
      salida += `$${valores.length}`;
    } else if (c === "@" && /[A-Za-z_]/.test(sql[i + 1] || "")) {
      const nombre = /^[A-Za-z_][A-Za-z0-9_]*/.exec(sql.slice(i + 1))[0];
      if (!nombrados) throw new Error(`La consulta usa @${nombre} pero no se paso un objeto: ${sql}`);
      if (!indicePorNombre.has(nombre)) {
        valores.push(args[0][nombre]);
        indicePorNombre.set(nombre, valores.length);
      }
      salida += `$${indicePorNombre.get(nombre)}`;
      i += nombre.length;
    } else {
      salida += c;
    }
  }
  if (!nombrados && posicion < posicionales.length) {
    throw new Error(`Sobran parametros (${posicionales.length - posicion}) para la consulta: ${sql}`);
  }
  // undefined -> NULL (better-sqlite3 hacia lo mismo con parametros con nombre)
  return {
    texto: salida,
    valores: valores.map((v) => (v === undefined ? null : typeof v === "bigint" ? v.toString() : v)),
  };
}

async function consultar(sql, args) {
  const { texto, valores } = traducir(sql, args);
  return conexionActual().query(texto, valores);
}

function prepare(sql) {
  return {
    async get(...args) {
      return (await consultar(sql, args)).rows[0];
    },
    async all(...args) {
      return (await consultar(sql, args)).rows;
    },
    async run(...args) {
      const r = await consultar(sql, args);
      const primera = r.rows && r.rows[0];
      return { changes: r.rowCount, lastInsertRowid: primera ? Object.values(primera)[0] : undefined };
    },
  };
}

/** Ejecuta uno o varios comandos SQL sin parametros (ej. un archivo .sql completo) */
async function exec(sql) {
  await conexionActual().query(sql);
}

/**
 * Envuelve fn en una transaccion. Todas las consultas que haga fn (aunque esten en
 * otros modelos) van por la misma conexion. Si fn lanza un error, se deshace todo.
 * Una transaccion dentro de otra usa un SAVEPOINT, como better-sqlite3.
 */
function transaction(fn) {
  return async (...args) => {
    const actual = contexto.getStore();
    if (actual && !actual.terminada) {
      const punto = `sp_${++actual.nivel}`;
      await actual.cliente.query(`SAVEPOINT ${punto}`);
      try {
        const resultado = await fn(...args);
        await actual.cliente.query(`RELEASE SAVEPOINT ${punto}`);
        return resultado;
      } catch (err) {
        await actual.cliente.query(`ROLLBACK TO SAVEPOINT ${punto}`);
        throw err;
      } finally {
        actual.nivel--;
      }
    }

    const cliente = await pool.connect();
    const tx = { cliente, terminada: false, nivel: 0 };
    try {
      await cliente.query("BEGIN");
      await cliente.query("SELECT pg_advisory_xact_lock($1)", [LLAVE_TRANSACCIONES]);
      const resultado = await contexto.run(tx, () => fn(...args));
      await cliente.query("COMMIT");
      return resultado;
    } catch (err) {
      await cliente.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      tx.terminada = true;
      cliente.release();
    }
  };
}

/**
 * Ejecuta fn despues de la respuesta y FUERA de cualquier transaccion
 * (correos, sincronizacion con Google). Reemplaza a setImmediate en esos casos.
 */
function enSegundoPlano(fn) {
  contexto.exit(() => setImmediate(fn));
}

/** Cierra el pool (para scripts que deben terminar, como los seeds) */
function close() {
  return pool.end();
}

module.exports = { prepare, exec, transaction, enSegundoPlano, close, pool };
