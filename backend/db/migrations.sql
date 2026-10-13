-- db/migrations.sql
-- Cambios adicionales sobre schema.sql (que se deja intacto, tal como lo entregaron).
-- Se aplica automaticamente despues de schema.sql en db/init.js.
-- Usa IF NOT EXISTS para poder correrse varias veces sin error.

CREATE TABLE IF NOT EXISTS tokens_recuperacion_password (
  id_token INTEGER PRIMARY KEY AUTOINCREMENT,
  id_usuario INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  fecha_expiracion DATETIME NOT NULL,
  usado INTEGER NOT NULL DEFAULT 0,
  fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

CREATE INDEX IF NOT EXISTS idx_tokens_recuperacion_usuario
  ON tokens_recuperacion_password (id_usuario);

-- Categorias adicionales, alineadas con la pagina de referencia del cliente
-- (Manicure, Pedicure, Pestañas, Peluqueria y Masajes ya venian en schema.sql)
INSERT OR IGNORE INTO categorias_servicio (nombre, descripcion) VALUES
('Cejas', 'Perfilado, laminado y henna de cejas'),
('Facial', 'Limpieza facial profunda e hidratacion');

-- Depilacion con cera de abeja hipoalergenica: aparece como servicio propio
-- en las publicaciones de Instagram de la clienta (lista de precios dedicada).
INSERT OR IGNORE INTO categorias_servicio (nombre, descripcion) VALUES
('Depilación', 'Cera de abeja hipoalergénica: suave con tu piel');

-- Nota: la columna servicios.imagen_url se agrega desde db/migraciones.js
-- (SQLite no permite ADD COLUMN IF NOT EXISTS en SQL puro).


-- ------------------------------------------------------------
-- Modulo 3: Agendamiento (reglas acordadas con la clienta)
-- ------------------------------------------------------------
-- Cambio de hora solo con 48 horas de anticipacion (el schema original traia 24).
-- Solo se actualiza si sigue con el valor original, para no pisar cambios posteriores.
UPDATE configuracion_sistema
   SET valor = '48',
       descripcion = 'Horas minimas de anticipacion para cambiar la hora. Fuera de plazo el abono se pierde'
 WHERE clave = 'HORAS_CANCELACION' AND valor = '24';

INSERT OR IGNORE INTO configuracion_sistema (clave, valor, descripcion) VALUES
('HORAS_RETENCION_TRANSFERENCIA', '2', 'Horas que se guarda una hora pagada por transferencia antes de liberarla si no llega el abono'),
('ABONO_REEMBOLSABLE', '0', 'El abono no se devuelve nunca: solo se puede reagendar con la anticipacion minima'),
('INTERVALO_AGENDA_MIN', '30', 'Cada cuantos minutos se ofrecen horas de inicio'),
('ANTICIPACION_MINIMA_MIN', '60', 'Minutos minimos entre el momento de reservar y el inicio de la cita'),
('DIAS_MAXIMOS_RESERVA', '60', 'Con cuantos dias de anticipacion maxima se puede reservar');

-- ------------------------------------------------------------
-- Integracion con Google Calendar (configurable desde el panel)
-- ------------------------------------------------------------
INSERT OR IGNORE INTO configuracion_sistema (clave, valor, descripcion) VALUES
('GOOGLE_CAL_MODO', 'desactivado', 'desactivado | compartido (un calendario para todo el salon) | por_profesional'),
('GOOGLE_CAL_ID', '', 'Id del calendario compartido del salon (modo compartido)');

-- ------------------------------------------------------------
-- Modulo 3.2: Reserva de la clienta + abono
-- ------------------------------------------------------------
-- Mientras la clienta paga en Webpay, la hora queda apartada unos minutos.
-- Si no termina el pago a tiempo, la hora se libera sola.
INSERT OR IGNORE INTO configuracion_sistema (clave, valor, descripcion) VALUES
('MINUTOS_RETENCION_WEBPAY', '15', 'Minutos que se aparta la hora mientras la clienta paga el abono en Webpay');
-- Nota: las columnas nuevas de citas y pagos (y su indice) se agregan desde
-- db/migraciones.js, porque este archivo se ejecuta antes que ellas.
