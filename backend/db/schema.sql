-- IMPORTANTE:
-- Versión preparada para DB Browser for SQLite.
-- Se eliminaron BEGIN TRANSACTION y COMMIT porque DB Browser
-- puede mantener una transacción activa al ejecutar el script completo.
--
-- ============================================================
-- Nicolett Studio Fantasy
-- Plataforma Integral de Agendamiento y CRM
-- Base de datos SQLite
-- Versión inicial para Proyecto de Título
-- ============================================================

PRAGMA foreign_keys = ON;


-- ============================================================
-- 1. USUARIOS Y SEGURIDAD
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
    id_rol INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1))
);

CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
    id_rol INTEGER NOT NULL,
    rut TEXT UNIQUE,
    nombres TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    telefono TEXT,
    password_hash TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS clientes (
    id_cliente INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER NOT NULL UNIQUE,
    fecha_nacimiento TEXT,
    preferencias TEXT,
    observaciones TEXT,
    fecha_registro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cliente_alergias (
    id_alergia INTEGER PRIMARY KEY AUTOINCREMENT,
    id_cliente INTEGER NOT NULL,
    alergia TEXT NOT NULL,
    descripcion TEXT,
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS segmentos_cliente (
    id_segmento INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1))
);

CREATE TABLE IF NOT EXISTS cliente_segmento (
    id_cliente INTEGER NOT NULL,
    id_segmento INTEGER NOT NULL,
    fecha_asignacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_cliente, id_segmento),
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    FOREIGN KEY (id_segmento) REFERENCES segmentos_cliente(id_segmento)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS profesionales (
    id_profesional INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER NOT NULL UNIQUE,
    descripcion TEXT,
    fecha_ingreso TEXT,
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

-- ============================================================
-- 2. SERVICIOS Y PROFESIONALES
-- ============================================================

CREATE TABLE IF NOT EXISTS categorias_servicio (
    id_categoria INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1))
);

CREATE TABLE IF NOT EXISTS servicios (
    id_servicio INTEGER PRIMARY KEY AUTOINCREMENT,
    id_categoria INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    duracion_minutos INTEGER NOT NULL CHECK (duracion_minutos > 0),
    precio INTEGER NOT NULL CHECK (precio >= 0),
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    FOREIGN KEY (id_categoria) REFERENCES categorias_servicio(id_categoria)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    UNIQUE (id_categoria, nombre)
);

CREATE TABLE IF NOT EXISTS profesional_servicio (
    id_profesional INTEGER NOT NULL,
    id_servicio INTEGER NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    PRIMARY KEY (id_profesional, id_servicio),
    FOREIGN KEY (id_profesional) REFERENCES profesionales(id_profesional)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

-- ============================================================
-- 3. DISPONIBILIDAD Y AGENDA
-- ============================================================

CREATE TABLE IF NOT EXISTS disponibilidad_profesional (
    id_disponibilidad INTEGER PRIMARY KEY AUTOINCREMENT,
    id_profesional INTEGER NOT NULL,
    dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
    hora_inicio TEXT NOT NULL,
    hora_fin TEXT NOT NULL,
    fecha_desde TEXT,
    fecha_hasta TEXT,
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    CHECK (hora_inicio < hora_fin),
    CHECK (fecha_hasta IS NULL OR fecha_desde IS NULL OR fecha_desde <= fecha_hasta),
    FOREIGN KEY (id_profesional) REFERENCES profesionales(id_profesional)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bloqueos_agenda (
    id_bloqueo INTEGER PRIMARY KEY AUTOINCREMENT,
    id_profesional INTEGER NOT NULL,
    fecha_hora_inicio TEXT NOT NULL,
    fecha_hora_fin TEXT NOT NULL,
    motivo TEXT,
    fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (fecha_hora_inicio < fecha_hora_fin),
    FOREIGN KEY (id_profesional) REFERENCES profesionales(id_profesional)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS citas (
    id_cita INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_cita TEXT NOT NULL UNIQUE,
    id_cliente INTEGER NOT NULL,
    id_profesional INTEGER NOT NULL,
    fecha_hora_inicio TEXT NOT NULL,
    fecha_hora_fin TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'PENDIENTE_ABONO'
        CHECK (estado IN ('PENDIENTE_ABONO','CONFIRMADA','ATENDIDA','CANCELADA','NO_ASISTE')),
    notas_cliente TEXT,
    fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_cancelacion TEXT,
    motivo_cancelacion TEXT,
    google_calendar_event_id TEXT UNIQUE,
    CHECK (fecha_hora_inicio < fecha_hora_fin),
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    FOREIGN KEY (id_profesional) REFERENCES profesionales(id_profesional)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS cita_servicio (
    id_cita_servicio INTEGER PRIMARY KEY AUTOINCREMENT,
    id_cita INTEGER NOT NULL,
    id_servicio INTEGER NOT NULL,
    precio_aplicado INTEGER NOT NULL CHECK (precio_aplicado >= 0),
    duracion_minutos INTEGER NOT NULL CHECK (duracion_minutos > 0),
    FOREIGN KEY (id_cita) REFERENCES citas(id_cita)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    UNIQUE (id_cita, id_servicio)
);

-- ============================================================
-- 4. CRM / FICHA CLÍNICO-ESTÉTICA
-- ============================================================

CREATE TABLE IF NOT EXISTS atenciones (
    id_atencion INTEGER PRIMARY KEY AUTOINCREMENT,
    id_cita INTEGER NOT NULL UNIQUE,
    observaciones TEXT,
    resultado TEXT,
    recomendaciones TEXT,
    fecha_registro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_cita) REFERENCES citas(id_cita)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS notas_interactivas (
    id_nota INTEGER PRIMARY KEY AUTOINCREMENT,
    id_atencion INTEGER NOT NULL,
    tipo_esquema TEXT NOT NULL,
    datos_json TEXT,
    imagen_url TEXT,
    fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_atencion) REFERENCES atenciones(id_atencion)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

-- ============================================================
-- 5. INVENTARIO
-- ============================================================

CREATE TABLE IF NOT EXISTS productos (
    id_producto INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    precio_compra INTEGER CHECK (precio_compra IS NULL OR precio_compra >= 0),
    precio_venta INTEGER CHECK (precio_venta IS NULL OR precio_venta >= 0),
    stock_actual REAL NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo REAL NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
    unidad_medida TEXT NOT NULL DEFAULT 'unidad',
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1))
);

CREATE TABLE IF NOT EXISTS atencion_producto (
    id_atencion_producto INTEGER PRIMARY KEY AUTOINCREMENT,
    id_atencion INTEGER NOT NULL,
    id_producto INTEGER NOT NULL,
    cantidad REAL NOT NULL CHECK (cantidad > 0),
    observacion TEXT,
    FOREIGN KEY (id_atencion) REFERENCES atenciones(id_atencion)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- ============================================================
-- 6. CAJA Y VENTAS
-- ============================================================

CREATE TABLE IF NOT EXISTS ventas (
    id_venta INTEGER PRIMARY KEY AUTOINCREMENT,
    id_cliente INTEGER,
    id_cita INTEGER,
    id_usuario_cajero INTEGER NOT NULL,
    subtotal INTEGER NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    descuento INTEGER NOT NULL DEFAULT 0 CHECK (descuento >= 0),
    total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
    estado TEXT NOT NULL DEFAULT 'PENDIENTE'
        CHECK (estado IN ('PENDIENTE','PAGADA','ANULADA')),
    fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (descuento <= subtotal),
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    FOREIGN KEY (id_cita) REFERENCES citas(id_cita)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    FOREIGN KEY (id_usuario_cajero) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS venta_detalle (
    id_detalle INTEGER PRIMARY KEY AUTOINCREMENT,
    id_venta INTEGER NOT NULL,
    tipo_item TEXT NOT NULL CHECK (tipo_item IN ('PRODUCTO','SERVICIO')),
    id_producto INTEGER,
    id_servicio INTEGER,
    descripcion TEXT NOT NULL,
    cantidad REAL NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    precio_unitario INTEGER NOT NULL CHECK (precio_unitario >= 0),
    descuento INTEGER NOT NULL DEFAULT 0 CHECK (descuento >= 0),
    subtotal INTEGER NOT NULL CHECK (subtotal >= 0),
    CHECK (
        (tipo_item = 'PRODUCTO' AND id_producto IS NOT NULL AND id_servicio IS NULL)
        OR
        (tipo_item = 'SERVICIO' AND id_servicio IS NOT NULL AND id_producto IS NULL)
    ),
    FOREIGN KEY (id_venta) REFERENCES ventas(id_venta)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS pagos (
    id_pago INTEGER PRIMARY KEY AUTOINCREMENT,
    id_cita INTEGER,
    id_venta INTEGER,
    tipo_pago TEXT NOT NULL
        CHECK (tipo_pago IN ('ABONO_CITA','PAGO_VENTA','DEVOLUCION')),
    monto INTEGER NOT NULL CHECK (monto > 0),
    metodo_pago TEXT NOT NULL
        CHECK (metodo_pago IN ('EFECTIVO','DEBITO','CREDITO','TRANSFERENCIA','PASARELA_WEB')),
    estado TEXT NOT NULL DEFAULT 'PENDIENTE'
        CHECK (estado IN ('PENDIENTE','APROBADO','RECHAZADO','ANULADO')),
    id_transaccion_externa TEXT UNIQUE,
    fecha_pago TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (tipo_pago = 'ABONO_CITA' AND id_cita IS NOT NULL)
        OR
        (tipo_pago = 'PAGO_VENTA' AND id_venta IS NOT NULL)
        OR
        (tipo_pago = 'DEVOLUCION' AND (id_cita IS NOT NULL OR id_venta IS NOT NULL))
    ),
    FOREIGN KEY (id_cita) REFERENCES citas(id_cita)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    FOREIGN KEY (id_venta) REFERENCES ventas(id_venta)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id_movimiento INTEGER PRIMARY KEY AUTOINCREMENT,
    id_producto INTEGER NOT NULL,
    tipo TEXT NOT NULL
        CHECK (tipo IN ('ENTRADA_COMPRA','SALIDA_VENTA','SALIDA_SERVICIO','AJUSTE','MERMA')),
    cantidad REAL NOT NULL CHECK (cantidad > 0),
    motivo TEXT,
    id_usuario INTEGER NOT NULL,
    id_venta INTEGER,
    id_atencion INTEGER,
    fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    FOREIGN KEY (id_venta) REFERENCES ventas(id_venta)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    FOREIGN KEY (id_atencion) REFERENCES atenciones(id_atencion)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

-- ============================================================
-- 7. FIDELIZACIÓN Y MARKETING
-- ============================================================

CREATE TABLE IF NOT EXISTS cupones (
    id_cupon INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE COLLATE NOCASE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    tipo_descuento TEXT NOT NULL CHECK (tipo_descuento IN ('PORCENTAJE','MONTO')),
    valor_descuento INTEGER NOT NULL CHECK (valor_descuento > 0),
    fecha_inicio TEXT NOT NULL,
    fecha_fin TEXT NOT NULL,
    max_usos INTEGER CHECK (max_usos IS NULL OR max_usos > 0),
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    CHECK (fecha_inicio <= fecha_fin),
    CHECK (
        (tipo_descuento = 'PORCENTAJE' AND valor_descuento BETWEEN 1 AND 100)
        OR
        (tipo_descuento = 'MONTO' AND valor_descuento > 0)
    )
);

CREATE TABLE IF NOT EXISTS cliente_cupon (
    id_cliente_cupon INTEGER PRIMARY KEY AUTOINCREMENT,
    id_cliente INTEGER NOT NULL,
    id_cupon INTEGER NOT NULL,
    fecha_asignacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_vencimiento TEXT NOT NULL,
    fecha_uso TEXT,
    id_venta INTEGER,
    estado TEXT NOT NULL DEFAULT 'DISPONIBLE'
        CHECK (estado IN ('DISPONIBLE','UTILIZADO','VENCIDO')),
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    FOREIGN KEY (id_cupon) REFERENCES cupones(id_cupon)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    FOREIGN KEY (id_venta) REFERENCES ventas(id_venta)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS alertas_crm (
    id_alerta INTEGER PRIMARY KEY AUTOINCREMENT,
    id_cliente INTEGER NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('CLIENTE_INACTIVA','CUMPLEANOS','OTRA')),
    mensaje TEXT NOT NULL,
    fecha_generacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado TEXT NOT NULL DEFAULT 'PENDIENTE'
        CHECK (estado IN ('PENDIENTE','GESTIONADA','DESCARTADA')),
    fecha_gestion TEXT,
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

-- ============================================================
-- 8. CONTENIDO Y CONFIGURACIÓN
-- ============================================================

CREATE TABLE IF NOT EXISTS contenido_landing (
    id_contenido INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL CHECK (tipo IN ('BANNER','TEXTO','IMAGEN','PROMOCION')),
    titulo TEXT,
    texto TEXT,
    imagen_url TEXT,
    orden INTEGER NOT NULL DEFAULT 0 CHECK (orden >= 0),
    activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    fecha_actualizacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_usuario_actualizacion INTEGER,
    FOREIGN KEY (id_usuario_actualizacion) REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS configuracion_sistema (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    descripcion TEXT,
    fecha_actualizacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- ÍNDICES RECOMENDADOS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_usuarios_rol
    ON usuarios(id_rol);

CREATE INDEX IF NOT EXISTS idx_citas_cliente
    ON citas(id_cliente);

CREATE INDEX IF NOT EXISTS idx_citas_profesional_fecha
    ON citas(id_profesional, fecha_hora_inicio, fecha_hora_fin);

CREATE INDEX IF NOT EXISTS idx_citas_estado
    ON citas(estado);

CREATE INDEX IF NOT EXISTS idx_disponibilidad_profesional
    ON disponibilidad_profesional(id_profesional, dia_semana);

CREATE INDEX IF NOT EXISTS idx_bloqueos_profesional_fecha
    ON bloqueos_agenda(id_profesional, fecha_hora_inicio, fecha_hora_fin);

CREATE INDEX IF NOT EXISTS idx_pagos_cita
    ON pagos(id_cita);

CREATE INDEX IF NOT EXISTS idx_pagos_venta
    ON pagos(id_venta);

CREATE INDEX IF NOT EXISTS idx_atenciones_cita
    ON atenciones(id_cita);

CREATE INDEX IF NOT EXISTS idx_movimientos_producto_fecha
    ON movimientos_inventario(id_producto, fecha);

CREATE INDEX IF NOT EXISTS idx_ventas_cliente_fecha
    ON ventas(id_cliente, fecha);

CREATE INDEX IF NOT EXISTS idx_cliente_cupon_cliente_estado
    ON cliente_cupon(id_cliente, estado);

CREATE INDEX IF NOT EXISTS idx_alertas_cliente_estado
    ON alertas_crm(id_cliente, estado);

-- ============================================================
-- DATOS MAESTROS INICIALES
-- ============================================================

INSERT OR IGNORE INTO roles (id_rol, nombre, descripcion) VALUES
(1, 'Administrador', 'Control total del sistema'),
(2, 'Profesional', 'Gestiona su agenda y fichas de sus atenciones'),
(3, 'Cliente', 'Agenda, paga abonos y consulta su historial');

INSERT OR IGNORE INTO categorias_servicio (nombre, descripcion) VALUES
('Manicure', 'Servicios de manicure'),
('Pedicure', 'Servicios de pedicure'),
('Pestañas', 'Lashista y lifting de pestañas'),
('Peluquería', 'Cortes, alisados, balayage y tratamientos capilares'),
('Masajes', 'Servicios de masajes');

INSERT OR IGNORE INTO segmentos_cliente (nombre, descripcion) VALUES
('Mamá sin red de apoyo', 'Clientas que requieren flexibilidad por cuidado de hijos'),
('Trabajadora con turnos', 'Clientas con horarios laborales variables'),
('Ejecutiva / profesional', 'Clientas que requieren atención periódica'),
('Eventos especiales', 'Clientas que reservan para ocasiones o celebraciones');

INSERT OR IGNORE INTO configuracion_sistema (clave, valor, descripcion) VALUES
('ABONO_CITA', '5000', 'Monto mínimo de abono obligatorio para confirmar una cita'),
('HORAS_CANCELACION', '24', 'Horas mínimas de anticipación para cancelación automática'),
('DIAS_CLIENTE_INACTIVA', '30', 'Días sin agendar antes de generar alerta CRM');

-- ============================================================
-- VISTA ÚTIL PARA AGENDA
-- ============================================================

CREATE VIEW IF NOT EXISTS vw_agenda_detalle AS
SELECT
    c.id_cita,
    c.codigo_cita,
    c.fecha_hora_inicio,
    c.fecha_hora_fin,
    c.estado,
    uc.nombres || ' ' || uc.apellidos AS cliente,
    up.nombres || ' ' || up.apellidos AS profesional,
    GROUP_CONCAT(s.nombre, ', ') AS servicios
FROM citas c
JOIN clientes cl ON cl.id_cliente = c.id_cliente
JOIN usuarios uc ON uc.id_usuario = cl.id_usuario
JOIN profesionales p ON p.id_profesional = c.id_profesional
JOIN usuarios up ON up.id_usuario = p.id_usuario
LEFT JOIN cita_servicio cs ON cs.id_cita = c.id_cita
LEFT JOIN servicios s ON s.id_servicio = cs.id_servicio
GROUP BY
    c.id_cita,
    c.codigo_cita,
    c.fecha_hora_inicio,
    c.fecha_hora_fin,
    c.estado,
    uc.nombres,
    uc.apellidos,
    up.nombres,
    up.apellidos;


-- ============================================================
-- REGLAS QUE DEBEN VALIDARSE EN EL BACKEND
-- ============================================================
-- 1) Evitar solapamientos de citas para una misma profesional.
-- 2) Validar disponibilidad y bloqueos antes de confirmar una cita.
-- 3) Cambiar estado a CONFIRMADA solo al registrar el abono requerido.
-- 4) Aplicar política de cancelación según HORAS_CANCELACION.
-- 5) Una profesional solo puede consultar/modificar su propia agenda.
-- 6) Validar que la profesional esté habilitada para cada servicio solicitado.
-- 7) Registrar movimientos de inventario al vender o utilizar productos.
-- 8) Actualizar stock_actual mediante lógica transaccional del backend.
