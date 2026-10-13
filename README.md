# Nicolett Sync

Plataforma web de agendamiento y gestión de clientas para **Nicolett Studio Fantasy**,
salón de belleza en Buin (Proyecto APT, DUOC UC).

- **Sitio público:** Inicio, Servicios con listas de precios, Nosotras (equipo) y Contacto con mapa.
- **Cuentas:** registro, inicio de sesión y recuperación de contraseña, con 3 roles:
  Cliente, Profesional y Administrador.
- **Panel de administración:** catálogo con fotos, equipo (perfiles, servicios y
  horarios), bloqueos de agenda y conexión con Google Calendar.
- **Agenda:** motor de disponibilidad que cruza horarios, bloqueos, citas y los eventos
  anotados a mano en Google Calendar.
- **Reservas con abono:** la clienta aparta una hora en 4 pasos y paga el abono con
  **Webpay Plus** o por transferencia; las citas se escriben solas en Google Calendar.
- **Tienda online:** productos de cuidado capilar con carrito, pago con Webpay y retiro
  en el salón; stock administrable.

---

## Índice

1. [Stack](#stack)
2. [Estado del proyecto](#estado-del-proyecto)
3. [Requisitos](#requisitos)
4. [Levantar el proyecto (paso a paso)](#levantar-el-proyecto-paso-a-paso)
5. [Cuentas de prueba](#cuentas-de-prueba)
6. [Recorrido sugerido para la demo](#recorrido-sugerido-para-la-demo)
7. [Estructura de carpetas](#estructura-de-carpetas)
8. [Variables de entorno](#variables-de-entorno)
9. [Conectar Google Calendar](#conectar-google-calendar)
10. [Reservas y abono (Webpay)](#reservas-y-abono-webpay)
    - [Mis citas y Mis pedidos](#mis-citas-y-mis-pedidos)
11. [Tienda online](#tienda-online)
12. [Correo real con Gmail](#correo-real-con-gmail)
13. [Reglas de negocio](#reglas-de-negocio)
14. [API](#api)
15. [Datos pendientes de la clienta](#datos-pendientes-de-la-clienta)
16. [Próximos pasos](#próximos-pasos)
17. [Problemas comunes](#problemas-comunes)
18. [Trabajo en equipo con Git](#trabajo-en-equipo-con-git)
19. [Registro de cambios](#registro-de-cambios)

---

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 18 + Vite, React Router |
| Backend | Node.js + Express 4 |
| Base de datos | SQLite (better-sqlite3) |
| Autenticación | JWT + bcrypt |
| Archivos | multer (fotos de servicios y profesionales) |
| Correo | nodemailer (Gmail o cuenta de prueba Ethereal) |
| Calendario | Google Calendar API con cuenta de servicio (google-auth-library) |
| Pagos | Webpay Plus de Transbank (transbank-sdk), ambiente de integración |

## Estado del proyecto

| Módulo | Estado |
|--------|--------|
| 1. Registro, login, roles y recuperación de contraseña | ✅ |
| 2. Catálogo de servicios con fotos | ✅ |
| Sitio público (Inicio, Servicios, Nosotras, Contacto) | ✅ |
| 3.1 Agenda base: equipo, horarios, bloqueos, disponibilidad | ✅ |
| 3.1b Conexión con Google Calendar (lectura y escritura de citas) | ✅ Probada con la cuenta de prueba `nicolettstudio86@gmail.com` |
| 3.2 Reserva + abono (Webpay Plus / transferencia): backend | ✅ Webpay probado contra Transbank (integración) |
| 3.2 Reserva + abono: frontend (4 pasos, resultado, panel de transferencias) | ✅ |
| Abono por categoría ($10.000 cabello, $5.000 resto) | ✅ Editable en el catálogo |
| Tienda: productos, carrito, pago con Webpay, stock y pedidos | ✅ |
| 3.3 Mis citas (cambiar hora con regla de 48 h, cancelar, historial) y Mis pedidos (repetir pedido) | ✅ |
| 4. Agente de WhatsApp | ⏳ Pendiente |

## Requisitos

- **Node.js 22 LTS**: <https://nodejs.org>. Verifica con `node -v`.
  ⚠️ **No uses Node 24**: `better-sqlite3` no trae binario para esa versión y la
  instalación falla pidiendo Visual Studio. En Windows puedes tener varias versiones con
  [nvm-windows](https://github.com/coreybutler/nvm-windows) (`nvm install 22` y `nvm use 22`).
- **npm** (viene con Node).
- **Git**.
- Opcional: [DB Browser for SQLite](https://sqlitebrowser.org/) para mirar la base de datos.

## Levantar el proyecto (paso a paso)

Se necesitan **dos terminales**: una para el backend y otra para el frontend.

### 1. Backend (terminal 1)

```bash
cd backend
npm install
```

Crea el archivo `.env` copiando el de ejemplo:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env
# macOS / Linux
cp .env.example .env
```

Abre `backend/.env` y cambia `JWT_SECRET` por cualquier texto largo y aleatorio.
Lo demás funciona tal cual para desarrollo.

Crea la base de datos con **datos de demostración** (servicios reales de Instagram,
3 profesionales de ejemplo con horario, productos de ejemplo, un admin y una clienta):

```bash
npm run demo
```

Levanta el servidor:

```bash
npm run dev
```

Debe decir `Nicolett Sync backend escuchando en http://localhost:4000`.
Puedes comprobarlo abriendo <http://localhost:4000/api/salud>.

<details>
<summary>¿Prefieres una base vacía, sin datos de demo?</summary>

```bash
npm run db:init
npm run seed:servicios        # opcional: servicios y precios reales de Instagram
npm run crear-admin -- "Nombre" "Apellido" "correo@dominio.cl" "ClaveSegura1"
```
</details>

### 2. Frontend (terminal 2)

```bash
cd frontend
npm install
cp .env.example .env          # en PowerShell: Copy-Item .env.example .env
npm run dev
```

Abre <http://localhost:5173>.

### Scripts disponibles

| Dónde | Comando | Qué hace |
|-------|---------|----------|
| backend | `npm run dev` | Servidor con recarga automática |
| backend | `npm start` | Servidor normal |
| backend | `npm run db:init` | Crea o actualiza la base de datos (no borra datos) |
| backend | `npm run demo` | `db:init` + todos los datos de demostración |
| backend | `npm run seed:servicios` | Catálogo real de la clienta (11 categorías, precios, indicaciones y adicionales). Se puede volver a ejecutar: actualiza sin duplicar |
| backend | `npm run seed:demo` | 3 profesionales de ejemplo con servicios y horario |
| backend | `npm run seed:productos` | 21 productos reales de la clienta (Puluk, Dlux, Inoar, Richée) en 3 líneas; oculta los de ejemplo |
| backend | `npm run seed:productos-demo` | 5 productos de ejemplo (solo si se quieren para una demo) |
| backend | `npm run seed:promociones` | 3 promociones de ejemplo para el carrusel (con publicaciones de la clienta) |
| backend | `npm run crear-admin -- ...` | Crea un Administrador |
| frontend | `npm run dev` | Servidor de desarrollo de Vite |
| frontend | `npm run build` | Compila para producción en `frontend/dist` |

> La base de datos se migra sola al iniciar el backend: si alguien actualiza el
> proyecto, las columnas nuevas se agregan sin perder datos.

## Cuentas de prueba

Creadas por `npm run demo`:

| Rol | Correo | Clave |
|-----|--------|-------|
| **Administradora y profesional** (la dueña: una sola cuenta) | `demo.duena@nicolett.cl` | `Demo12345` |
| Cliente | `clienta.demo@nicolett.cl` | `Cliente12345` |
| Profesional | `demo.unas@nicolett.cl` | `Demo12345` |
| Profesional | `demo.mirada@nicolett.cl` | `Demo12345` |

⚠️ Son solo para desarrollo. Nunca las crees en producción.

## Recorrido sugerido para la demo

1. **Sitio público** (sin iniciar sesión): Inicio → Servicios (listas de precios por
   categoría, ficha con botón de WhatsApp) → Nosotras → Contacto (mapa y horario).
2. **Administradora** (`demo.duena@nicolett.cl`, que también atiende clientas) → **Mi panel**:
   - **Agenda del día**: citas por profesional; marca "Atendida" (con observaciones) o "No asistió".
   - **Promociones**: sube una imagen con fechas de vigencia y mírala en el carrusel del Inicio.
   - **Catálogo**: toca un servicio, súbele una foto y cambia su precio. Se ve al instante.
   - **Equipo y horarios**: crea una profesional, súbele foto, márcala o desmárcala
     en "Nosotras"; cambia su horario semanal; crea un bloqueo y mira cómo desaparecen
     esas horas en "Así verán las clientas su agenda".
   - **Google Calendar**: ver [la sección siguiente](#conectar-google-calendar).
3. **Profesional** (`demo.unas@nicolett.cl`): ve su horario en solo lectura y puede
   bloquear su propia agenda.
4. **Clienta** (`clienta.demo@nicolett.cl`): en **Mi panel → Mis citas** puede cambiar la
   hora (48 h antes) o cancelar; en **Mis pedidos**, repetir una compra. **Reservar hora** → servicio → profesional →
   día y hora → abono. Con Webpay usa las [tarjetas de prueba](#probar-un-pago-con-webpay-ambiente-de-integración);
   con transferencia, la reserva aparece en **Panel → Reservas** para que la
   administradora la confirme. En la **Tienda**, agrega productos al carrito y paga.

## Estructura de carpetas

```
nicolett-sync/
├── backend/
│   ├── server.js                    # Arranque de Express y registro de rutas
│   ├── credenciales/                # JSON de Google (NO se sube a git)
│   ├── uploads/                     # Fotos subidas (servicios, profesionales)
│   ├── db/
│   │   ├── schema.sql               # Modelo de datos original del informe
│   │   ├── migrations.sql           # Cambios posteriores (SQL)
│   │   ├── migraciones.js           # Aplica migraciones al iniciar (idempotente)
│   │   ├── init.js                  # npm run db:init
│   │   └── seed-*.js                # Datos de ejemplo
│   └── src/
│       ├── routes/                  # URLs y permisos por rol
│       ├── controllers/             # Lógica de cada endpoint
│       ├── models/                  # Consultas SQL
│       ├── services/
│       │   ├── disponibilidad.service.js   # Cálculo de horas libres
│       │   ├── reservas.service.js         # Reservar y confirmar transferencias
│       │   ├── webpay.service.js           # Pago del abono con Webpay Plus
│       │   ├── googleCalendar.service.js   # Conexión con Google (leer y escribir)
│       │   └── calendarioCitas.service.js  # Citas -> eventos de Google Calendar
│       ├── jobs/vencimientos.js     # Cada minuto: vence reservas y sincroniza Google
│       ├── middleware/              # JWT, roles, subida de archivos
│       └── utils/                   # Fechas (hora de Chile), validaciones, correo
└── frontend/
    └── src/
        ├── pages/                   # Inicio, Catalogo, Nosotras, Contacto, Panel, Equipo, Integraciones, auth
        ├── components/marca/        # Barra, pie, íconos, fotos en arco, hoja emergente
        ├── api/client.js            # Todas las llamadas al backend
        ├── context/AuthContext.jsx  # Sesión
        └── styles/                  # Tokens de marca y estilos por página
```

## Variables de entorno

**`backend/.env`**

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto del backend (4000) |
| `JWT_SECRET` | Secreto para firmar sesiones. **Cámbialo.** |
| `JWT_EXPIRES_IN` | Duración de la sesión (ej. `8h`) |
| `DB_PATH` | Ruta del archivo SQLite |
| `CORS_ORIGIN` / `FRONTEND_URL` | URL del frontend |
| `SMTP_*` | Correo (ver [Correo real con Gmail](#correo-real-con-gmail)) |
| `GOOGLE_SERVICE_ACCOUNT_FILE` | Ruta al JSON de la cuenta de servicio de Google |
| `BACKEND_URL` | URL pública del backend, a la que Webpay devuelve a la clienta (por defecto `http://localhost:4000`) |
| `WEBPAY_COMMERCE_CODE` / `WEBPAY_API_KEY` | **Solo producción.** Vacías = ambiente de integración (sin cobros reales) |

**`frontend/.env`**

| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | URL de la API (`http://localhost:4000/api`) |

> `.env`, la base de datos, las fotos subidas y las credenciales de Google están en
> `.gitignore`. **Nunca los subas al repositorio.**

## Conectar Google Calendar

La base de datos es la agenda principal y Google Calendar se sincroniza **en ambos
sentidos**:

- **Hacia Google:** las citas del sistema aparecen como eventos:
  - ✓ **verde**: confirmada (abono pagado), con clienta, teléfono, precio y saldo.
  - ⏳ **amarillo**: esperando la transferencia del abono (la hora está apartada hasta 2 h).
  - ✔ gris: atendida · ✗ rojo: no asistió.
  - Si la reserva vence o se cancela, el evento **se borra**. Las reservas con Webpay
    pendiente no se escriben (duran 15 minutos); aparecen al confirmarse el pago.
  - Se sincroniza al instante tras cada cambio y además cada minuto, así que si Google
    falla, se corrige solo cuando vuelve. **Una reserva nunca falla por culpa de Google.**
  - Si alguien borra el evento a mano en Google, el sistema lo vuelve a crear la próxima
    vez que la cita cambie (hora, estado o profesional). Las citas se mueven o cancelan
    **desde el sistema**, no desde Google.
  - **Sin duplicados:** si una misma cita llega a escribirse dos veces (por ejemplo, con
    dos backends corriendo a la vez), la sincronización de cada minuto detecta la copia y
    la borra; en la terminal aparece `duplicados: 1`.
- **Desde Google:** todo lo que la dueña anote a mano (clientas por teléfono o
  presenciales, trámites) se considera ocupado y **no se ofrece** en la web.

Se usa una **cuenta de servicio**: la dueña del calendario solo lo **comparte** con un
correo técnico. No se guardan claves de Gmail y los permisos no vencen.

### Modos (se eligen en Panel → Google Calendar)

| Modo | Cuándo usarlo | Cómo se bloquea la agenda |
|------|---------------|---------------------------|
| Sin conexión | Por defecto | Solo con la agenda propia |
| **Un calendario para todo el salón** | La dueña anota todo en un solo calendario | Un evento bloquea a la profesional cuyo **nombre o alias** aparece en el título. Si no nombra a nadie, bloquea a **todo el salón** |
| **Un calendario por profesional** | Cada una tiene su calendario | Todo lo de su calendario bloquea solo su agenda |

El **alias** se configura en Equipo y horarios → Perfil en el sitio → Calendario de
Google. Ejemplo: alias `Nico, Nicole` → el evento "Uñas Sra. Rosa - Nico" bloquea solo
a esa profesional. Si se deja vacío, se usa su primer nombre. **Si dos profesionales
comparten nombre, hay que ponerles alias distintos.**

Los eventos marcados como **"Disponible"** en Google no bloquean nada.

### Configuración con la cuenta de pruebas `nicolettstudio86@gmail.com`

**A. Crear la cuenta de servicio (una sola vez, ~10 minutos)**

1. Entra a <https://console.cloud.google.com> con `nicolettstudio86@gmail.com`.
2. Arriba, en el selector de proyectos → **Proyecto nuevo** → nombre `Nicolett Sync` → **Crear**.
3. Menú → **APIs y servicios → Biblioteca** → busca **Google Calendar API** → **Habilitar**.
4. Menú → **IAM y administración → Cuentas de servicio** → **Crear cuenta de servicio**.
   Nombre: `nicolett-sync`. No necesita roles → **Listo**.
5. Abre la cuenta creada → pestaña **Claves** → **Agregar clave → Crear clave nueva → JSON**.
   Se descarga un archivo `.json`.
6. Renómbralo a `google-service-account.json` y cópialo en `backend/credenciales/`.
7. Reinicia el backend.

> El JSON es una **llave privada**: no lo compartas por WhatsApp ni lo subas a git. Si
> se filtra, bórrala en Google Cloud (pestaña Claves) y crea otra.

**B. Compartir el calendario**

1. Abre <https://calendar.google.com> con la misma cuenta. En **Configuración → General**,
   verifica que la zona horaria sea **Chile (Santiago)**.
2. En **Configuración**, a la izquierda, elige el calendario → **Compartir con personas o
   grupos específicos** → **Agregar personas**.
3. Pega el correo de la cuenta de servicio (termina en `...iam.gserviceaccount.com`;
   también aparece en el panel con un botón **Copiar**) → permiso
   **"Hacer cambios en eventos"** → **Enviar**.

**C. Activar en el sistema**

1. Inicia sesión como Administrador → **Mi panel → Google Calendar**.
2. El Paso 1 debe decir *"Credenciales cargadas correctamente"*.
3. Paso 2: elige **"Un calendario para todo el salón"**. ID del calendario:
   `nicolettstudio86@gmail.com` (el calendario principal de una cuenta usa el mismo
   correo como ID) → **Guardar**.
4. Paso 3: el calendario debe aparecer en **verde**. Pulsa **Crear evento de prueba**:
   debe aparecer en Google Calendar en unos segundos.

**D. Demostrar la lectura (lo anotado a mano bloquea la web)**

1. En Google Calendar crea un evento para mañana de 11:00 a 12:00 llamado
   `Clienta por teléfono - Uñas`.
2. En el panel, pulsa **Ver lo que se está leyendo de Google**: aparece el evento
   bloqueando a *Demo Uñas*.
3. Ve a **Equipo y horarios → Demo Uñas → Así verán las clientas su agenda**, elige
   mañana: las horas que chocan con el evento ya no aparecen.
4. Cambia el título a `Trámite` (sin nombre) y verás que ahora bloquea a **todas**.

> La lectura se guarda en caché 60 segundos: si no ves el cambio, espera un minuto.
> Si Google no responde, las reservas **siguen funcionando** con la agenda propia y la
> respuesta indica `sincronizado: false` para poder mostrar un aviso.

**Recomendaciones para la dueña**

- Al anotar a mano una cita en Google, escribir en el título el **nombre o alias** de la profesional (`Uñas Sra. Rosa - Caro`). Sin nombre, el evento bloquea a **todas**.
- Varias citas a la misma hora con distintas profesionales conviven sin problema en el mismo calendario: las citas creadas por el sistema llevan una marca interna y no bloquean a las demás.
- El backend debe estar encendido para que se sincronice; si estuvo apagado, se pone al día solo en el primer minuto.

**Para producción:** la clienta comparte **su** calendario con el correo de la cuenta de
servicio (idealmente creada en un proyecto de Google Cloud de ella) y se cambia el ID en
el panel.

## Reservas y abono (Webpay)

### Flujo

1. La clienta (con sesión) elige servicio, día, hora y profesional (o "cualquiera
   disponible") y cómo pagará el abono: **Webpay** o **transferencia**.
2. El backend vuelve a verificar la hora contra la disponibilidad real (horario,
   bloqueos, otras citas y Google Calendar) y la aparta como `PENDIENTE_ABONO`.
3. La hora queda apartada **15 minutos** con Webpay o **2 horas** con transferencia.
4. **Webpay:** al pagar, el backend confirma el pago directamente con Transbank
   (`commit`, verificando estado y monto) y la cita pasa a `CONFIRMADA`.
5. **Transferencia:** la administración confirma el abono (con referencia opcional) y la
   cita pasa a `CONFIRMADA`. Se puede confirmar aunque llegue tarde, si nadie tomó la hora.
6. Si vence el plazo sin pago, la hora vuelve a ofrecerse y una tarea que corre cada minuto
   cancela la reserva con el motivo *"Plazo de abono vencido"*.

Las reservas se identifican con un código legible, por ejemplo `NS-261005-6A8F`.

### Reglas implementadas

- Solo usuarias con rol **Cliente** pueden reservar.
- Una clienta no puede tener dos reservas esperando abono al mismo tiempo.
- Dos clientas no pueden tomar la misma hora aunque reserven en el mismo instante.
- El saldo solo descuenta el abono cuando está `APROBADO`.
- Si alguien paga en Webpay justo después de vencer su plazo, se confirma si la hora sigue
  libre; si otra clienta ya la tomó, el pago queda registrado y la cita se cancela con el
  motivo *"reagendar o devolver"* para que la administración lo resuelva.
- El abono depende de la categoría: **$10.000** para cabello (según la publicación de
  abonos del salón) y **$5.000** para el resto. Si el servicio cuesta menos (ej. Mentón
  $3.000), se abona su precio.

### Mis citas y Mis pedidos

La clienta ve todo desde **Mi panel** (tarjeta "Tu próxima cita") y sus pestañas:

- **Mis citas** (`/panel/mis-citas`)
  - **Próximas:** fecha, hora, profesional, abono y saldo. Muestra hasta cuándo puede
    cambiar la hora.
  - **Cambiar hora:** solo citas `CONFIRMADA` y hasta **48 horas antes**. Puede mantener a
    la misma profesional o elegir "quien esté disponible". Su propia hora no cuenta como
    ocupada (se puede mover 30 minutos). El abono se mantiene y el evento de Google
    Calendar se mueve solo. Si elige una hora dentro de las próximas 48 horas, se le
    advierte que después no podrá volver a cambiarla.
  - **Dentro de las 48 horas:** ya no puede cambiarla; se le ofrece escribir por WhatsApp.
  - **Cancelar:** siempre se puede antes de la cita, pero el **abono pagado no se
    devuelve** (se le ofrece cambiar la hora en su lugar). Si aún no pagaba, la hora
    simplemente se libera.
  - **Pendientes de abono:** botón para pagar con Webpay o coordinar la transferencia.
  - **Historial:** realizadas, canceladas y vencidas, con **Reservar de nuevo** (mismo
    servicio y profesional).
- **Mis pedidos** (`/panel/mis-pedidos`): compras de la tienda con estado (pagado y listo
  para retirar, entregado, en revisión…). **Repetir pedido** vuelve a cargar el carrito con
  los **precios y stock de hoy** y avisa si algo se agotó o alcanza menos.

### Probar un pago con Webpay (ambiente de integración)

| Resultado | Tarjeta | Número | CVV |
|-----------|---------|--------|-----|
| Aprobada | VISA | `4051 8856 0044 6623` | `123` |
| Rechazada | Mastercard | `5186 0595 5959 0568` | `123` |

Cualquier fecha de vencimiento futura sirve. Si pide autenticación del banco: RUT
`11.111.111-1`, clave `123`.

> En producción, Transbank debe poder llegar a `BACKEND_URL`: el backend tiene que estar
> publicado en internet (no sirve `localhost`) y se configuran `WEBPAY_COMMERCE_CODE` y
> `WEBPAY_API_KEY` con los datos del contrato del salón.

## Tienda online

- **Página pública `/tienda`:** productos con foto, marca, línea (Matizadores,
  Tratamientos…), precio y disponibilidad ("¡Últimas 3!", "Agotado"). Filtro por línea.
- **Carrito:** botón con bolsa en la barra superior, en todas las páginas. Se guarda en el
  navegador (sobrevive a recargar e iniciar sesión) y siempre valida precio y stock con el
  backend.
- **Pago:** con Webpay (débito o crédito). Solo cuentas de **Cliente**. La entrega es
  **retiro en el salón**.
- **Stock sin sobreventa:** al ir a pagar, el stock se **aparta** (se descuenta) dentro de
  la misma transacción que verifica que alcance. Si el pago no se completa en 15 minutos,
  el pedido se anula y el stock vuelve solo. Si llega un pago tarde y ya no hay stock, el
  pedido queda "en revisión" para reponer o devolver.
- **Administración** (en la misma `/tienda` con sesión de Administrador): crear, editar,
  ocultar/mostrar productos, subir foto y fijar el stock. Cada cambio de stock queda en
  `movimientos_inventario` (entrada, ajuste o salida por venta).
- **Panel → Pedidos:** pagados por entregar, entregados y en revisión; botón
  **Marcar entregado** y enlace para avisarle a la clienta por WhatsApp.

### Productos reales de la clienta

`npm run seed:productos` (archivo `backend/db/seed-productos-nicolett.js`) carga 21 productos en tres líneas: **Pestañas y Cejas** (Puluk, Dlux), **Tratamientos Capilares** (Inoar) y **Capilar Profesional** (Richée Professional). Se puede ejecutar varias veces: omite los que ya existen.

- Los 4 productos con precio **"Por definir"** quedan sin precio: el Administrador los ve en `/tienda` como "Precio por definir", pero la tienda pública no los muestra hasta que se les ponga precio.
- El stock parte en **0** (aparecen como "Agotado"): hay que fijarlo en `/tienda` (modo Administrador), o cambiar `STOCK_INICIAL` en el script antes de ejecutarlo.
- Las fotos se suben desde `/tienda` tocando cada producto.
- Los 5 productos de ejemplo quedan **ocultos** (no se borran, por si tienen ventas de prueba).

Usa las tablas del modelo original (`productos`, `ventas`, `venta_detalle`,
`movimientos_inventario`, `pagos` con `tipo_pago = 'PAGO_VENTA'`). Los pedidos web se
distinguen con `ventas.canal = 'WEB'` y código `NV-AAMMDD-XXXX`.

## Catálogo, agenda del día y promociones

### Catálogo según las listas de precios de la clienta

`npm run seed:servicios` carga el catálogo de sus publicaciones: Manicura, Pedicure,
Podología clínica, Pestañas, Cejas, Depilación, Depilación masculina, Corte y peinado,
Color e iluminación, Tratamientos capilares y Alisado. Además deshabilita Facial y
Masajes, que no aparecen en sus listas. Las **duraciones son estimadas**: hay que confirmarlas.

| Concepto | Cómo se modela | Ejemplo |
|----------|----------------|---------|
| **Precio por largo** | `servicio_variantes` (S, M, L, XL). La clienta elige su largo al reservar | Nanobotox: S $35.000 · M $40.000 · L $45.000 · XL $55.000 |
| **Precio "desde"** | `servicios.tipo_precio = 'DESDE'`. El valor final se confirma en el salón | Balayage desde $89.990 |
| **Según evaluación** | `tipo_precio = 'EVALUACION'`. No se reserva online: botón "Cotizar por WhatsApp" | Decoloración global, Corrección de color |
| **Indicaciones** | `categorias_servicio.indicaciones` (una por línea). Se muestran en la carta y antes de confirmar la reserva | "Ven con tus pestañas limpias…" |
| **Adicionales** | `categorias_servicio.adicionales` con formato `nombre \| precio \| detalle`. Se cobran en el salón | Francesa o degradé \| + $5.000 |
| **Abono por categoría** | `categorias_servicio.abono`: $10.000 en Corte y peinado, Color, Tratamientos y Alisado | — |
| **Orden** | `categorias_servicio.orden` y `servicios.orden` | — |

Todo se edita en **Servicios** con sesión de Administrador: en "Editar categoría"
(abono, posición, indicaciones y adicionales) y en cada servicio (tipo de precio y
precios por largo, con el botón "Usar precios por largo de cabello").

### Agenda del día (`/panel/agenda`)

- **Administradora:** ve una columna por profesional (filtro "Todas" o una). **Profesional:** solo su agenda ("Mi agenda").
- **Resumen del día:** citas, atendidas, por atender y **saldo por cobrar**.
- **Marcar la cita:** desde su hora de inicio, como **Atendida** (con observaciones opcionales, que se guardan en la tabla `atenciones`) o **No asistió** (el abono no se devuelve). Se puede **deshacer**.
- **Google Calendar:** el evento cambia de color solo (gris = atendida, rojo = no asistió).
- **Actualización:** la página se recarga sola cada minuto.

### Promociones (`/panel/promociones`)

- **Contenido:** imagen vertical (como un post de Instagram), título, texto corto, enlace opcional ("Reservar hora", "Tienda" u otra página) y fechas de vigencia.
- **Dónde aparece:** en el carrusel del Inicio **solo mientras está vigente**. Sin fechas, se muestra siempre.
- **Estados en el panel:** visible, programada, vencida u oculta. Se puede ocultar o eliminar.
- **Carrusel:** muestra las imágenes completas (sin recortar el texto), avanza solo y se pausa al pasar el mouse; al tocar una imagen se ve en grande.

### Una sola cuenta para la dueña

Una cuenta de **Administradora** puede tener además perfil de **profesional**: aparece en
"Nosotras", recibe reservas y tiene su columna en la agenda, sin necesidad de una segunda
cuenta ni de recordar otra contraseña.

- **Activar el perfil:** en **Equipo y horarios**, la administradora toca **"Sí, yo también atiendo"** (`POST /api/profesionales/yo`).
- **Dar acceso a otra profesional:** **"Dar acceso de administradora"** (`PUT /api/profesionales/:id/administradora`). Nadie puede quitarse el acceso a sí misma, y el sistema siempre conserva al menos una administradora.

### Historial de clientas (Reservas → Clientas)

Listado alfabético con buscador (nombre, correo o teléfono). Al hacer clic en una clienta
se abre su ficha:

- **Resumen:** citas atendidas, próximas, no asistió, canceladas y total gastado en servicios y tienda, además de su servicio más frecuente.
- **Historial:** todas sus citas, con las observaciones de cada atención, y sus compras en la tienda.

Endpoints: `GET /api/clientes?busqueda=` y `GET /api/clientes/:id` (solo administradora).

### Correos automáticos a la clienta

| Cuándo | Correo |
|--------|--------|
| Reserva pagada con Webpay o transferencia confirmada | "Tu hora está confirmada" (con los cuidados del servicio y las reglas) |
| Reserva con transferencia | "Tu hora está apartada" (hasta qué hora y botón de WhatsApp) |
| Cambio de hora | "Tu nueva hora" |
| Cancelación | "Tu reserva fue cancelada" |
| Compra pagada | "Gracias por tu compra" (detalle y retiro en el salón) |

- **Sin costo:** se envían por Gmail (hasta ~500 correos al día) y en segundo plano. Si un correo falla, la reserva o la compra no se ven afectadas.
- **En desarrollo** (sin `SMTP_PASS`), la consola muestra un enlace de vista previa de cada correo. Para que lleguen de verdad, ver [Correo real con Gmail](#correo-real-con-gmail).

Además, al terminar una reserva aparece una **ventana con los cuidados del servicio**
(ej. pestañas limpias) y las reglas de agendamiento, una vez por reserva.

## Correo real con Gmail

Mientras `SMTP_PASS` esté vacío, los correos (recuperación de contraseña) se envían a
una cuenta de prueba **Ethereal** y el backend muestra en consola un link para verlos.

Para enviarlos de verdad desde `nicolettstudio86@gmail.com`:

1. Activa la **verificación en 2 pasos** en <https://myaccount.google.com/security>.
2. Crea una **contraseña de aplicación** en <https://myaccount.google.com/apppasswords>
   (nombre: `Nicolett Sync`). Google muestra 16 letras.
3. En `backend/.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=nicolettstudio86@gmail.com
   SMTP_PASS=las16letrassinespacios
   ```
4. Reinicia el backend.

## Reglas de negocio

### Agendamiento (acordadas con la clienta)

| Regla | Dónde vive |
|-------|------------|
| Abono de **$5.000**, descontable del total del servicio | `configuracion_sistema.ABONO_CITA` (abono general) |
| Servicios de **cabello: $10.000** de abono | `categorias_servicio.abono` (editable en "Editar categoría"; vacío = general) |
| Si el servicio cuesta **menos** que el abono, se abona su precio | Regla fija |
| Cambio de hora solo con **48 horas** de anticipación | `HORAS_CANCELACION` |
| Fuera de plazo **se pierde el abono** | ✅ No se puede cambiar la hora; al cancelar, el abono queda cobrado |
| Mientras paga en Webpay, la hora se aparta **15 minutos** | `MINUTOS_RETENCION_WEBPAY` |
| El abono **nunca se devuelve**, ni cancelando a tiempo: solo se puede reagendar | `ABONO_REEMBOLSABLE = 0` |
| Abono con **débito en la página** (Webpay Plus) | ✅ backend |
| O **transferencia por WhatsApp**: la hora se guarda **2 horas** | `HORAS_RETENCION_TRANSFERENCIA` |
| Horas de inicio cada 30 minutos, mínimo 60 minutos de anticipación, hasta 60 días | `INTERVALO_AGENDA_MIN`, `ANTICIPACION_MINIMA_MIN`, `DIAS_MAXIMOS_RESERVA` |

Todos los valores están en la tabla `configuracion_sistema` y se pueden cambiar sin
tocar el código. Las horas se manejan en **hora de Chile** (`America/Santiago`,
considerando el horario de verano) y se guardan como texto `AAAA-MM-DD HH:MM`.

### Otras reglas

- **Roles:** el Cliente se registra solo; Profesionales y Administradores los crea un Administrador.
- **Catálogo:** no se puede deshabilitar una categoría con servicios activos. Las fotos
  aceptan JPG, PNG o WEBP de hasta 5 MB y el navegador las achica antes de subirlas.
- **Profesionales:** una desactivada no aparece en el sitio ni recibe reservas (su cuenta
  sigue existiendo). Solo una puede ser "destacada" (la dueña). Sin foto se muestra una
  imagen genérica de la marca.
- **Horario del salón** (página Contacto): se calcula solo, uniendo los horarios de las
  profesionales activas.

## API

Base: `http://localhost:4000/api`. Las rutas protegidas usan el encabezado
`Authorization: Bearer <token>`.

| Método | Ruta | Acceso |
|--------|------|--------|
| POST | `/auth/registro`, `/auth/login`, `/auth/olvide-password`, `/auth/restablecer-password` | Público |
| GET/PUT | `/auth/perfil`, PUT `/auth/password` | Con sesión |
| GET/POST/PUT/DELETE | `/usuarios` | Admin |
| GET | `/categorias`, `/servicios` | Público |
| POST/PUT/DELETE | `/categorias`, `/servicios`, `/servicios/:id/imagen` | Admin |
| GET | `/sitio/equipo`, `/sitio/horario` | Público |
| GET | `/agenda/reglas`, `/agenda/profesionales?id_servicio=` | Público |
| GET | `/agenda/horas-libres?id_servicio=&fecha=&id_profesional=&excluir=` | Público (`excluir`: código de la cita que se está cambiando) |
| GET | `/agenda/dias-disponibles?id_servicio=&id_profesional=&dias=` | Público |
| GET | `/profesionales` | Admin (todas) / Profesional (la suya) |
| POST | `/profesionales` | Admin |
| PUT | `/profesionales/:id`, `/:id/estado`, `/:id/servicios`, `/:id/horario` | Admin |
| POST/DELETE | `/profesionales/:id/foto` | Admin |
| GET/POST/DELETE | `/profesionales/:id/bloqueos` | Admin / la propia Profesional |
| POST | `/reservas` | Cliente |
| GET | `/reservas/mias` | Cliente (próximas e historial) |
| GET | `/reservas/agenda?fecha=&id_profesional=` | Admin (todas) / Profesional (la suya) |
| POST | `/reservas/:codigo/atencion` `{ estado: ATENDIDA\|NO_ASISTE\|CONFIRMADA, observaciones }` | Admin / la profesional de la cita |
| GET | `/reservas/:codigo` | La dueña de la reserva o Admin |
| POST | `/reservas/:codigo/reagendar` | Cliente dueña (regla de 48 h) |
| POST | `/reservas/:codigo/cancelar` | Cliente dueña (abono pagado no se devuelve) |
| GET | `/reservas?estado=&metodo_abono=&desde=&hasta=` | Admin |
| POST | `/reservas/:codigo/confirmar-abono` | Admin |
| POST | `/pagos/webpay/iniciar` | Cliente (abono) |
| POST | `/pagos/webpay/iniciar-compra` | Cliente (pedido de la tienda) |
| POST | `/profesionales/yo` | Admin (activa su propio perfil de profesional) |
| PUT | `/profesionales/:id/administradora` | Admin |
| GET | `/clientes?busqueda=`, `/clientes/:id` | Admin |
| GET | `/promociones` | Público (vigentes hoy) |
| GET | `/promociones/admin` | Admin |
| POST/PUT/DELETE | `/promociones`, `/promociones/:id` | Admin |
| POST | `/promociones/:id/imagen` | Admin |
| GET | `/productos` | Público |
| GET | `/productos/admin` | Admin (incluye ocultos) |
| POST/PUT | `/productos`, `/productos/:id`, `/productos/:id/estado` | Admin |
| POST/DELETE | `/productos/:id/imagen` | Admin |
| POST | `/pedidos` | Cliente (aparta stock) |
| GET | `/pedidos/mios` | Cliente (historial de compras) |
| GET | `/pedidos/:codigo` | La dueña del pedido o Admin |
| GET | `/pedidos?estado=&entregada=0\|1` | Admin |
| POST | `/pedidos/:codigo/entregar` | Admin |
| GET/POST | `/pagos/webpay/retorno` | Público (lo llama Transbank; el pago se verifica con Transbank) |
| GET/PUT | `/integraciones/google` | Admin |
| POST/DELETE | `/integraciones/google/prueba` | Admin |
| GET | `/integraciones/google/ocupacion` | Admin |

## Datos pendientes de la clienta

Todo está hecho de forma genérica y se ajusta desde el panel cuando lleguen los datos:

- [x] Google Calendar: un solo calendario para todo el salón (probado con la cuenta de prueba).
- [ ] Calendario definitivo de la clienta y cómo nombra a cada profesional al anotar a mano
      (para configurar los alias).
- [ ] Nombres, fotos, cargos y descripciones de la dueña y las profesionales.
- [ ] Horario real de atención y colación.
- [ ] Duración real de cada servicio (las cargadas son estimadas).
- [ ] Fotos reales de los trabajos para cada servicio.
- [ ] Número que usará el agente de WhatsApp (el actual del salón o uno nuevo).
- [ ] **Duraciones reales** de los ~58 servicios (hoy estimadas).
- [ ] Nombres de las 2 trabajadoras actuales, qué servicios hace cada una y su horario
      (asignar en Equipo y horarios). La lista de podología menciona a una podóloga clínica.
- [ ] Confirmar abonos por categoría ($10.000 cabello / $5.000 resto).
- [x] Productos reales de la tienda: nombres y precios cargados (`npm run seed:productos`).
- [ ] Productos: fotos, stock y precio de 4 productos "Por definir".
- [ ] Datos de transferencia del salón (banco, cuenta, RUT) para enviarlos por WhatsApp.

## Próximos pasos

1. **Pasar Google Calendar al calendario real del salón:** la dueña comparte su
   calendario con la cuenta de servicio y se cambia el ID en el panel (ver
   [Conectar Google Calendar](#conectar-google-calendar)).
2. **Productos:** subir fotos, fijar stock y poner precio a los 4 productos "Por definir".
3. **Agente de WhatsApp (4):** WhatsApp Business Platform (Meta) con número de prueba
   gratuito para desarrollo. Usará **las mismas funciones** que la web (horas libres,
   reservar, abono), por lo que queda conectado al **mismo Google Calendar**. Estará
   pensado para personas mayores: botones y listas, un paso a la vez y opción de hablar
   con una persona. Para producción la clienta debe verificar su negocio en Meta
   (conviene iniciar ese trámite con tiempo).

## Problemas comunes

| Problema | Solución |
|----------|----------|
| `Falta JWT_SECRET en las variables de entorno` | No existe `backend/.env`. Cópialo desde `.env.example`. |
| Error al instalar `better-sqlite3` (pide Python o Visual Studio Build Tools) | Estás usando Node 24. Instala **Node 22 LTS**, borra `node_modules` y vuelve a ejecutar `npm install`. |
| Webpay vuelve a una página que no carga | El frontend debe estar corriendo en `FRONTEND_URL` y el backend en `BACKEND_URL`. |
| El frontend muestra "Failed to fetch" | El backend no está corriendo, o `VITE_API_URL` no apunta a `http://localhost:4000/api`. |
| Error de CORS | `CORS_ORIGIN` en `backend/.env` debe ser exactamente la URL del frontend. |
| Quiero volver a cargar la demo | `npm run demo` se puede ejecutar varias veces: no duplica datos. |
| Google: "no encuentra ese calendario" | El ID está mal o el calendario no se compartió con la cuenta de servicio. |
| Google: "no tiene permiso" | Al compartir, el permiso debe ser **"Hacer cambios en eventos"**. |
| Google no permite crear la clave JSON | Pasa en cuentas de organizaciones con esa política bloqueada. Usa una cuenta Gmail personal (como la de pruebas). |
| El evento de prueba sale a otra hora | Revisa la zona horaria del calendario en Google (debe ser Chile). |
| Una cita aparece **dos veces** en Google | Revisa que haya **un solo backend** corriendo. La copia se borra sola en el siguiente minuto (`duplicados: 1` en la terminal); no la borres a mano. |
| Una cita confirmada no aparece en Google | Espera un minuto y revisa la terminal **del backend** (no la del frontend): debe decir `Citas sincronizadas` o un error `No se pudo sincronizar NS-…`. Las reservas con Webpay sin pagar no se escriben. |
| Quiero empezar de cero | Detén el backend, borra `backend/db/nicolett.db` y ejecuta `npm run demo`. |

### Correo: `self-signed certificate in certificate chain`

Lo provoca un antivirus que revisa el correo saliente (por ejemplo, el **Escudo de correo de Avast**). Para comprobarlo:

```bash
node -e "require('tls').connect(465,'smtp.gmail.com',{servername:'smtp.gmail.com'},function(){console.log(this.getPeerCertificate().issuer);this.end()})"
```

Si el emisor no es **Google Trust Services** (por ejemplo, "Avast Web/Mail Shield Root"), desactiva en el antivirus el análisis del correo saliente (SMTP) y reinicia el backend. No desactives la verificación TLS en el código.

## Trabajo en equipo con Git

Para no pasarse el proyecto en archivos ZIP (y perder cambios al mezclarlos), usen un
repositorio **privado** en GitHub. El `.gitignore` ya protege lo que nunca debe subirse:
`.env`, la base de datos, las fotos subidas y las credenciales de Google.

**Una sola persona crea el repositorio** (desde la carpeta `nicolett-sync`):

```bash
git init
git add .
git commit -m "Proyecto unificado: sitio, agenda, Google Calendar y reservas con Webpay"
git branch -M main
git remote add origin https://github.com/USUARIO/nicolett-sync.git   # repo privado creado en github.com
git push -u origin main
```

Luego agrega a sus compañeros en GitHub → Settings → Collaborators.

**Cada integrante** clona el repositorio y crea **sus propios** `.env` y base de datos
(ver [Levantar el proyecto](#levantar-el-proyecto-paso-a-paso)):

```bash
git clone https://github.com/USUARIO/nicolett-sync.git
```

**Día a día**, trabajen cada uno en una rama y únanla con un *Pull Request*:

```bash
git pull origin main                     # traer lo último antes de empezar
git checkout -b modulo-3-2-frontend      # una rama por tarea
# ... cambios ...
git add .
git commit -m "Flujo de reserva en el frontend"
git push -u origin modulo-3-2-frontend   # luego abrir el Pull Request en GitHub
```

> Las columnas nuevas de la base de datos se agregan solas al iniciar el backend
> (`db/migraciones.js`), así que al traer cambios de otra persona basta con
> `npm install` y `npm run dev`. Nunca compartan el archivo `nicolett.db`.

## Registro de cambios

### Octubre 2026 · Productos reales y Google Calendar en funcionamiento

| Archivo | Qué cambió |
|---------|------------|
| `backend/db/seed-productos-nicolett.js` | **Nuevo:** carga los 21 productos reales de la clienta |
| `backend/package.json` | `npm run seed:productos` usa los productos reales; los de ejemplo pasan a `npm run seed:productos-demo` |
| `backend/src/services/calendarioCitas.service.js` | Detecta y borra eventos duplicados en Google Calendar |
| `backend/src/services/googleCalendar.service.js` | Lista los eventos creados por el sistema (para el control de duplicados) |
| `frontend/src/pages/Tienda.jsx` | Muestra "Precio por definir" en vez de $0 a la administradora |
| `README.md` | Productos reales, Google Calendar probado, recomendaciones para la dueña y problemas comunes |

**Después de actualizar** (no se tocan `.env`, `nicolett.db`, `uploads/` ni `credenciales/`):

1. Detén el backend.
2. `cd backend` y `npm run seed:productos`. Carga los productos y **oculta** los 5 de ejemplo
   (no los borra: si quieres mantener alguno, reactívalo en `/tienda` como Administradora).
3. `npm run dev`. Si había una cita duplicada en Google, en 1 minuto la terminal mostrará
   `duplicados: 1` y quedará un solo evento.
4. Reinicia también el frontend.

