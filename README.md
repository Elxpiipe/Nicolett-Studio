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
- **Agente de WhatsApp:** las clientas reservan, revisan sus citas y consultan precios
  por WhatsApp, con las mismas reglas y la misma agenda que la página.

**¿Primera vez?** En Windows basta con instalar Node.js y PostgreSQL y hacer doble clic
en `1-instalar.bat` y luego en `2-iniciar.bat`. Ver
[Instalar en un PC nuevo (Windows)](#instalar-en-un-pc-nuevo-windows).

---

## Índice

1. [Stack](#stack)
2. [Estado del proyecto](#estado-del-proyecto)
3. [Instalar en un PC nuevo (Windows)](#instalar-en-un-pc-nuevo-windows)
4. [Instalación manual (paso a paso)](#instalación-manual-paso-a-paso)
5. [Cuentas de prueba](#cuentas-de-prueba)
6. [Recorrido sugerido para la demo](#recorrido-sugerido-para-la-demo)
7. [Estructura de carpetas](#estructura-de-carpetas)
8. [Variables de entorno](#variables-de-entorno)
9. [Conectar Google Calendar](#conectar-google-calendar)
10. [Reservas y abono (Webpay)](#reservas-y-abono-webpay)
    - [Reservar o comprar sin cuenta (invitada)](#reservar-o-comprar-sin-cuenta-invitada)
    - [Mis citas y Mis pedidos](#mis-citas-y-mis-pedidos)
11. [Tienda online](#tienda-online)
12. [Agente de WhatsApp](#agente-de-whatsapp)
13. [Correo real con Gmail](#correo-real-con-gmail)
14. [Reglas de negocio](#reglas-de-negocio)
15. [API](#api)
16. [Datos pendientes de la clienta](#datos-pendientes-de-la-clienta)
17. [Próximos pasos](#próximos-pasos)
18. [Problemas comunes](#problemas-comunes)
19. [Trabajo en equipo con Git](#trabajo-en-equipo-con-git)
20. [Registro de cambios](#registro-de-cambios)

---

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 18 + Vite, React Router |
| Backend | Node.js + Express 4 |
| Base de datos | PostgreSQL 14 o superior (pg) |
| Autenticación | JWT + bcrypt |
| Archivos | multer (fotos de servicios y profesionales) |
| Correo | nodemailer (Gmail o cuenta de prueba Ethereal) |
| Calendario | Google Calendar API con cuenta de servicio (google-auth-library) |
| Pagos | Webpay Plus de Transbank (transbank-sdk), ambiente de integración |
| WhatsApp | WhatsApp Cloud API de Meta (webhook + envío de mensajes) |

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
| 4. Agente de WhatsApp (reservar, mis citas, precios, horario, hablar con una persona) | ✅ Probado con el número de prueba de Meta. Falta pasarlo al número del salón |
| Instalador para Windows (`1-instalar.bat`, `2-iniciar.bat`) | ✅ |

## Instalar en un PC nuevo (Windows)

Estos pasos sirven para un computador donde nunca se ha instalado nada del proyecto.

### 1. Instala los programas (una sola vez)

1. **Node.js 22 LTS:** descárgalo de <https://nodejs.org> (botón "LTS") e instálalo con
   las opciones que vienen marcadas.
2. **PostgreSQL** (versión 14 o más nueva; la 16, 17 o 18 sirven): descárgalo de
   <https://www.postgresql.org/download/windows/> (instalador de EDB). Durante la
   instalación:
   - deja el puerto **5432** y marca **pgAdmin**;
   - cuando pida la clave del usuario `postgres`, elige una sin símbolos raros
     (por ejemplo `Nicolett2026`) y **anótala**: el instalador del proyecto te la va a pedir;
   - al final, si ofrece abrir "Stack Builder", ciérralo: no hace falta.

### 2. Copia el proyecto

Descomprime el ZIP del proyecto (o clónalo con Git) en una carpeta, por ejemplo
`C:\Users\TuNombre\nicolett-sync`. Adentro deben quedar las carpetas `backend` y
`frontend` y los archivos `1-instalar.bat`, `2-iniciar.bat` y `3-whatsapp-ngrok.bat`.

Si vienes de otro PC con datos reales, mira además
[Llevar los datos y las fotos a otro PC](#llevar-los-datos-y-las-fotos-a-otro-pc).

### 3. Instala el proyecto: `1-instalar.bat`

Doble clic en **`1-instalar.bat`**. Hace todo esto solo:

1. Revisa que Node.js esté instalado.
2. Descarga las dependencias del backend (`npm install`).
3. Te pide el usuario y la **clave de PostgreSQL**, prueba la conexión, crea la base
   `nicolett_studio` y arma el archivo `backend/.env` (con un `JWT_SECRET` aleatorio).
4. Crea las tablas.
5. Pregunta si quieres **datos de demostración** (servicios, profesionales, productos y
   las [cuentas de prueba](#cuentas-de-prueba)). Si en `backend/db/` hay un `nicolett.db`
   antiguo, ofrece copiar esos datos.
6. Descarga las dependencias del frontend.

Tarda unos minutos la primera vez. Se puede volver a ejecutar sin perder datos: si el
`.env` ya funciona, no lo toca.

> Si Windows muestra "Windows protegió su PC", toca **Más información → Ejecutar de
> todas formas**. Pasa con cualquier `.bat` descargado de internet.

### 4. Abre el sistema: `2-iniciar.bat`

Doble clic en **`2-iniciar.bat`**. Abre dos ventanas negras (backend y frontend) y, cuando
todo está listo, el navegador en <http://localhost:5173>. No cierres esas ventanas
mientras uses el sistema; para apagarlo, ciérralas.

Cada vez que arranca, el backend ejecuta `npm run db:init`: si alguien agregó tablas o
columnas nuevas al proyecto, se crean solas sin borrar datos.

### 5. WhatsApp (opcional): `3-whatsapp-ngrok.bat`

Solo si vas a probar el agente con WhatsApp de verdad. Primero sigue
[Conectarlo a WhatsApp](#conectarlo-a-whatsapp-con-el-número-de-prueba-de-meta) para
crear la app en Meta, instalar ngrok y completar las variables `WHATSAPP_*` del `.env`.
Después, con el sistema corriendo, doble clic en **`3-whatsapp-ngrok.bat`** y deja esa
ventana abierta. Para probar el agente sin Meta no hace falta: usa el simulador del panel.

### Opcional: Google Calendar y correo

- **Google Calendar:** copia la carpeta `backend/credenciales/` (el JSON de la cuenta de
  servicio) desde un PC donde ya funcione, o crea una nueva con
  [Conectar Google Calendar](#conectar-google-calendar).
- **Correo real:** completa `SMTP_PASS` en `backend/.env` con la contraseña de aplicación
  de Gmail ([Correo real con Gmail](#correo-real-con-gmail)). Sin eso el sistema funciona,
  pero los correos solo se ven como "vista previa" en la ventana del backend.

### Llevar los datos y las fotos a otro PC

El instalador deja una base nueva. Para pasar **los datos reales** (clientas, citas,
productos) desde el PC donde ya están:

1. En el PC de origen, abre una terminal y respalda la base (cambia `18` por tu versión
   de PostgreSQL):
   ```
   "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -U postgres -F c -f nicolett.backup nicolett_studio
   ```
2. Copia al PC nuevo: el archivo `nicolett.backup`, la carpeta `backend/uploads/` (las
   fotos) y, si se usan, `backend/credenciales/` y los valores de `SMTP_*` y `WHATSAPP_*`
   del `.env`.
3. En el PC nuevo ejecuta `1-instalar.bat` y en "Datos iniciales" elige **no cargar
   datos de demostración**. Luego restaura:
   ```
   "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -U postgres -d nicolett_studio --clean --if-exists nicolett.backup
   ```
4. Ejecuta `2-iniciar.bat`.

Las fotos no viajan dentro de la base: la base solo guarda la ruta. Por eso hay que
copiar `backend/uploads/` aparte.

## Instalación manual (paso a paso)

Para macOS o Linux, o si prefieres hacerlo sin los `.bat`. Necesitas **Node.js 22 LTS**
y **PostgreSQL 14 o superior** instalados, y **dos terminales**: una para el backend y
otra para el frontend.

### 1. Backend (terminal 1)

```bash
cd backend
npm install
node scripts/configurar.js
```

`configurar.js` te pide la clave de PostgreSQL, crea la base `nicolett_studio` y el
archivo `backend/.env`. Si prefieres hacerlo a mano: copia `.env.example` como `.env`,
pon la clave de `postgres` en `DATABASE_URL`, cambia `JWT_SECRET` por un texto largo y
aleatorio, y crea la base con `createdb -U postgres nicolett_studio` (o en pgAdmin:
clic derecho en *Databases* → *Create* → `nicolett_studio`).

Crea las tablas con **datos de demostración** (servicios reales, 3 profesionales de
ejemplo con horario, productos, un admin y una clienta):

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
npm run seed:servicios        # opcional: servicios y precios reales
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
| raíz | `1-instalar.bat` | Instalación completa en Windows (dependencias, `.env`, base y datos) |
| raíz | `2-iniciar.bat` | Abre backend, frontend y el navegador |
| raíz | `3-whatsapp-ngrok.bat` | Abre el túnel de ngrok para WhatsApp |
| backend | `node scripts/configurar.js` | Pide la clave de PostgreSQL, crea la base y el `backend/.env` |
| backend | `npm run dev` | Servidor con recarga automática |
| backend | `npm start` | Servidor normal |
| backend | `npm run db:init` | Crea o actualiza las tablas en PostgreSQL (no borra datos) |
| backend | `npm run db:migrar-sqlite` | Copia los datos de un `nicolett.db` antiguo (SQLite) a PostgreSQL |
| backend | `npm run demo` | `db:init` + todos los datos de demostración |
| backend | `npm run seed:servicios` | Catálogo real de la clienta (11 categorías, precios, indicaciones y adicionales). Se puede volver a ejecutar: actualiza sin duplicar |
| backend | `npm run seed:demo` | 3 profesionales de ejemplo con servicios y horario |
| backend | `npm run seed:productos` | 21 productos reales de la clienta (Puluk, Dlux, Inoar, Richée) en 3 líneas; oculta los de ejemplo |
| backend | `npm run seed:productos-demo` | 5 productos de ejemplo (solo si se quieren para una demo) |
| backend | `npm run seed:promociones` | 3 promociones de ejemplo para el carrusel (con publicaciones de la clienta) |
| backend | `npm run crear-admin -- ...` | Crea un Administrador |
| frontend | `npm run dev` | Servidor de desarrollo de Vite |
| frontend | `npm run build` | Compila para producción en `frontend/dist` |

> Después de traer cambios de otra persona, ejecuta `npm run db:init` en `backend`
> (o abre el sistema con `2-iniciar.bat`, que lo hace solo): agrega tablas y columnas
> nuevas sin perder datos.

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
5. **WhatsApp** (como administradora): **Panel → WhatsApp → Simulador**. Escribe "hola",
   reserva una hora tocando las opciones, pide "hablar con una persona" y responde desde
   **Conversaciones**. Ver [Agente de WhatsApp](#agente-de-whatsapp).

## Estructura de carpetas

```
nicolett-sync/
├── 1-instalar.bat                   # Instalación en Windows
├── 2-iniciar.bat                    # Abre el sistema
├── 3-whatsapp-ngrok.bat             # Túnel para WhatsApp
├── backend/
│   ├── server.js                    # Arranque de Express y registro de rutas
│   ├── credenciales/                # JSON de Google (NO se sube a git)
│   ├── uploads/                     # Fotos subidas (servicios, profesionales)
│   ├── scripts/configurar.js        # Asistente: clave de PostgreSQL, base y .env
│   ├── db/
│   │   ├── schema.sql               # Modelo de datos original del informe (SQLite)
│   │   ├── schema.postgres.sql      # Esquema actual en PostgreSQL (incluye todos los cambios)
│   │   ├── connection.js            # Conexion a PostgreSQL (pool y transacciones)
│   │   ├── migrar-desde-sqlite.js   # npm run db:migrar-sqlite
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
│       ├── whatsapp/                # Agente de WhatsApp
│       │   ├── bot.js               # La conversación (menús, reservar, mis citas, precios...)
│       │   ├── webhook.js           # Recibe los mensajes que manda Meta
│       │   ├── envio.js             # Envía mensajes por la API de Meta
│       │   ├── avisos.js            # Abono confirmado / hora liberada, por el chat
│       │   └── mensajes.js, formato.js, config.js, whatsapp.model.js
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
| `DATABASE_URL` | Conexión a PostgreSQL: `postgresql://usuario:clave@localhost:5432/nicolett_studio` |
| `CORS_ORIGIN` / `FRONTEND_URL` | URL del frontend |
| `SMTP_*` | Correo (ver [Correo real con Gmail](#correo-real-con-gmail)) |
| `GOOGLE_SERVICE_ACCOUNT_FILE` | Ruta al JSON de la cuenta de servicio de Google |
| `BACKEND_URL` | URL pública del backend, a la que Webpay devuelve a la clienta (por defecto `http://localhost:4000`) |
| `WEBPAY_COMMERCE_CODE` / `WEBPAY_API_KEY` | **Solo producción.** Vacías = ambiente de integración (sin cobros reales) |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | Credenciales de la API de WhatsApp (Meta). Vacías = el agente solo funciona en el simulador |
| `WHATSAPP_VERIFY_TOKEN` | Palabra que eliges tú y escribes igual en Meta al configurar el webhook |
| `WHATSAPP_APP_SECRET` | Clave secreta de la app de Meta. Con ella el backend comprueba que los mensajes vienen de Meta |
| `WHATSAPP_API_VERSION` | Versión de la API de Meta (por defecto `v23.0`) |
| `WHATSAPP_NUMERO_PUBLICO` | Número del salón en WhatsApp, solo dígitos. Se usa en el botón "Volver a WhatsApp" después de pagar |
| `WHATSAPP_AVISO_EMAIL` | Correo que recibe el aviso cuando una clienta pide hablar con una persona (por defecto `SMTP_USER`) |

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

1. La clienta (con o sin cuenta) elige servicio, día, hora y profesional (o "cualquiera
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

### Reservar o comprar sin cuenta (invitada)

Cualquier persona puede reservar una hora o comprar en la tienda **sin registrarse**.
En el último paso (o en el carrito) se le piden sus datos básicos: **nombre, apellido,
correo y teléfono (WhatsApp)**, y se la invita a crear una cuenta.

- El backend crea una ficha de clienta marcada como *sin cuenta* (`usuarios.es_invitado = 1`)
  y entrega una sesión corta (**3 horas**) que **solo** sirve para crear, pagar y ver la
  reserva o el pedido hechos en esa misma visita. No da acceso a *Mis citas*, *Mis pedidos*
  ni al perfil.
- Si alguien escribe el correo de otra persona, no puede ver nada de lo que esa persona hizo
  antes: cada sesión solo ve lo creado durante ella.
- Si el correo ya tiene una cuenta, se le pide **iniciar sesión** (no se crea otra ficha).
- La confirmación por correo incluye el botón **"Crear mi cuenta"**, y la página de resultado
  también, con los datos ya escritos.
- **Crear la cuenta después:** al registrarse con ese mismo correo, el sistema envía un
  **enlace de activación** (válido 48 horas). Al crear la contraseña, todas sus reservas y
  compras anteriores quedan en su cuenta. Esto evita que alguien se apropie del historial de
  otra persona solo sabiendo su correo.
- En *Reservas → Clientas* las fichas sin cuenta aparecen con la etiqueta **"Sin cuenta"**.
- Para cambiar la hora, quien reservó sin cuenta escribe por WhatsApp (o crea su cuenta y
  lo hace desde *Mis citas*).

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

## Agente de WhatsApp

El asistente responde solo a las clientas por WhatsApp, con menús y botones (pensado
para que cualquier persona lo use, también clientas mayores). Entiende si tocan una
opción, si escriben su número ("1", "2"...) o palabras sueltas como "reservar",
"precios", "horario", "mis citas" o "persona". "MENÚ" vuelve siempre al inicio.

Qué puede hacer la clienta:

- **Reservar una hora:** tipo de servicio → servicio → largo de cabello (si aplica) →
  profesional (o "me da lo mismo") → día → hora → resumen con valor y abono → pago.
  Con **tarjeta** recibe un botón que abre Webpay; con **transferencia** recibe los datos
  de la cuenta y manda la foto del comprobante por el mismo chat.
- **Mis citas:** ver sus próximas citas, pagar un abono pendiente, cambiar la hora
  (con la regla de 48 horas) o cancelar.
- **Servicios y precios** por categoría, y **horario y dirección** con enlace al mapa.
- **Hablar con una persona:** el asistente queda en pausa con esa clienta, la conversación
  aparece "por responder" en el panel y llega un correo de aviso. La administradora
  responde desde el panel y, cuando termina, toca **Devolver al asistente**.

Además, el asistente avisa solo por el chat cuando el abono se confirma (Webpay o
transferencia confirmada en el panel) y cuando una hora se libera porque el abono no llegó.

Usa **exactamente las mismas reglas** que la página: mismo cálculo de horas libres,
mismo Google Calendar, mismos abonos y plazos. Una hora tomada por WhatsApp desaparece
de la web y viceversa. Si el número de quien escribe coincide con el de una clienta
registrada, el asistente la reconoce. Si no, le pide su nombre y crea su ficha (aparece
en Clientas como "Sin cuenta" y "Llegó por WhatsApp").

### Probarlo sin Meta (simulador)

**Panel → WhatsApp → Simulador.** Funciona sin ninguna credencial: escribes como si fueras
una clienta y ves las respuestas con sus botones. Las reservas que hagas son reales en la
agenda (cancélalas después), pero ningún mensaje sale por WhatsApp. Si pones el teléfono
de una clienta registrada, el asistente la reconoce. Es la forma más segura de mostrarlo
en la demo.

En **Configuración** se escriben los datos bancarios que el asistente entrega para pagar
por transferencia.

### Conectarlo a WhatsApp con el número de prueba de Meta

Meta entrega gratis un número de prueba que puede escribir hasta a 5 celulares
registrados. Los nombres de los menús de Meta pueden cambiar un poco con el tiempo.

1. **Crea la app.** Entra a <https://developers.facebook.com> con una cuenta de Facebook →
   **Mis apps → Crear app**. Elige el caso de uso de WhatsApp ("Conectar con clientes por
   WhatsApp") y asóciala a un portafolio comercial (se puede crear en el momento).
2. **Copia los datos de prueba.** En la app, **WhatsApp → Configuración de la API**:
   - **Identificador del número de teléfono** → `WHATSAPP_PHONE_NUMBER_ID`
   - **Token de acceso temporal** → `WHATSAPP_TOKEN` (dura 24 horas; abajo está cómo
     sacar uno permanente)
   - En **Para**, agrega los celulares del equipo y confírmalos con el código que llega
     por WhatsApp. El número de prueba solo puede escribirle a esos números.
3. **Copia la clave secreta.** **Configuración de la app → Básica → Clave secreta de la
   app** → `WHATSAPP_APP_SECRET`.
4. **Inventa un token de verificación**, por ejemplo `nicolett-2026-webhook`, y ponlo en
   `WHATSAPP_VERIFY_TOKEN`.
5. **Haz público tu backend con ngrok** (Meta y el celular de la clienta no pueden entrar a
   `localhost`). Instala ngrok (<https://ngrok.com/download>), crea una cuenta gratis y en
   otra terminal ejecuta:

   ```bash
   ngrok http 4000
   ```

   Copia la URL `https://...ngrok-free.app` que aparece y ponla en `BACKEND_URL` en
   `backend/.env`. Reinicia el backend.
6. **Configura el webhook en Meta.** **WhatsApp → Configuración → Webhook → Editar**:
   - URL de devolución de llamada: `https://...ngrok-free.app/api/whatsapp/webhook`
     (está lista para copiar en Panel → WhatsApp → Configuración)
   - Token de verificación: el mismo de `WHATSAPP_VERIFY_TOKEN`
   - Toca **Verificar y guardar** y luego, en **Campos del webhook**, suscríbete a `messages`.
7. **Prueba.** En Panel → WhatsApp → Configuración toca **Probar conexión**. Luego, desde un
   celular de la lista "Para", escríbele "hola" al número de prueba.

> Con ngrok gratis la URL cambia cada vez que lo reinicias: hay que actualizar
> `BACKEND_URL` y la URL del webhook en Meta.

**Token permanente** (para no renovarlo cada 24 horas): en <https://business.facebook.com>
→ **Configuración del negocio → Usuarios del sistema** → crea un usuario administrador,
asígnale la app y la cuenta de WhatsApp, y toca **Generar token** con los permisos
`whatsapp_business_messaging` y `whatsapp_business_management`.

### Pasar a producción

1. **Verificar el negocio** en Meta (Configuración del negocio → Centro de seguridad).
   Lo hace la dueña con los datos del salón; puede tardar algunos días.
2. **Elegir el número del asistente.** El número que se conecta a la API queda dedicado a
   ella: lo más simple es usar un número nuevo para el asistente y dejar el actual
   (+56 9 4032 2551) para la atención personal. Se agrega en **WhatsApp → Configuración
   de la API → Agregar número de teléfono** y Meta revisa el nombre que se mostrará.
3. **Agregar un método de pago** en la cuenta de WhatsApp. Meta cobra algunos tipos de
   mensaje; responder a una clienta dentro de las 24 horas desde su último mensaje no se
   cobraba según los precios vigentes a la fecha de este README. Revisa
   <https://developers.facebook.com/docs/whatsapp/pricing> antes de activar.
4. **Servidor con URL fija y https** (en vez de ngrok) para `BACKEND_URL` y el webhook.
5. Token permanente, `WHATSAPP_NUMERO_PUBLICO` con el número nuevo y datos de
   transferencia reales en el panel.

### Límites que pone WhatsApp

- Solo se puede escribirle a una clienta dentro de las **24 horas** siguientes a su último
  mensaje. Por eso los avisos del asistente (abono confirmado, hora liberada) llegan bien,
  pero un recordatorio el día antes de la cita necesitaría una plantilla aprobada por Meta
  (queda como próximo paso).
- Listas de máximo 10 opciones: si hay más (días, horas), el asistente muestra 9 y una
  opción "Ver más opciones".
- Audios y stickers no se entienden: el asistente vuelve a mostrar el menú.

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
| POST | `/auth/invitada` (nombres, apellidos, email, telefono) | Público: sesión de 3 h para reservar o comprar sin cuenta. `409 CUENTA_EXISTENTE` si el correo ya tiene cuenta |
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
| GET/POST | `/whatsapp/webhook` | Público (lo llama Meta; el POST se verifica con `WHATSAPP_APP_SECRET`) |
| GET | `/whatsapp/pagar/:codigo?f=` | Público con firma: abre Webpay para pagar el abono de una reserva hecha por WhatsApp |
| GET | `/whatsapp/pago-resultado?estado=` | Público: página que ve la clienta al volver de Webpay |
| GET | `/whatsapp/estado`, POST `/whatsapp/probar`, PUT `/whatsapp/config` | Admin |
| GET | `/whatsapp/conversaciones`, `/whatsapp/conversaciones/:telefono` | Admin |
| POST | `/whatsapp/conversaciones/:telefono/responder`, `/bot`, `/atendida` | Admin |
| GET | `/whatsapp/media/:id` | Admin (foto que mandó la clienta, ej. comprobante) |
| GET/POST/DELETE | `/whatsapp/simulador`, `/whatsapp/simulador/:telefono` | Admin |

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
3. **WhatsApp en producción:** que la clienta verifique su negocio en Meta y defina qué
   número usará el asistente (ver [Pasar a producción](#pasar-a-producción)). Conviene
   iniciar ese trámite con tiempo.
4. **Recordatorio el día antes por WhatsApp:** necesita una plantilla aprobada por Meta,
   porque WhatsApp no deja escribirle a alguien que no ha escrito en las últimas 24 horas.

## Problemas comunes

| Problema | Solución |
|----------|----------|
| `1-instalar.bat` dice que no encuentra Node.js | Instala Node.js 22 LTS, **cierra y vuelve a abrir** el `.bat` (Windows solo reconoce Node en ventanas nuevas). |
| `1-instalar.bat` dice "PostgreSQL no responde" | PostgreSQL no está instalado o su servicio está detenido: Windows + R → `services.msc` → `postgresql-x64-XX` → Iniciar. |
| "La clave no es correcta para ese usuario" | Es la clave que elegiste al instalar PostgreSQL. Si no la recuerdas, entra a pgAdmin (suele tenerla guardada), abre **Query Tool** y ejecuta `ALTER USER postgres PASSWORD 'NuevaClave';`. |
| `2-iniciar.bat` abre el navegador pero sale "Failed to fetch" | Mira la ventana "Backend": ahí aparece el error. Lo más común es PostgreSQL detenido. |
| `Falta JWT_SECRET en las variables de entorno` | No existe `backend/.env`. Ejecuta `1-instalar.bat` o `node scripts/configurar.js`. |
| `No se pudo usar PostgreSQL (password authentication failed...)` | La clave de `DATABASE_URL` no es la del usuario `postgres`. |
| `No se pudo usar PostgreSQL (database "nicolett_studio" does not exist)` | Falta crear la base: ejecuta `node scripts/configurar.js` en `backend` (o `createdb -U postgres nicolett_studio`). |
| `La base de datos no tiene las tablas` | Ejecuta `npm run db:init` (o `npm run demo`). |
| Aviso al instalar `better-sqlite3` | Solo se usa para `npm run db:migrar-sqlite`. Si falla (por ejemplo con Node 24), la app funciona igual. |
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
| Meta dice que no pudo validar la URL del webhook | El backend debe estar corriendo y ser público (ngrok), y `WHATSAPP_VERIFY_TOKEN` debe ser idéntico al que escribiste en Meta. Si reiniciaste ngrok, la URL cambió. |
| El asistente no contesta en el celular | Revisa la terminal del backend. En Meta, el webhook debe estar suscrito al campo `messages`. Con el número de prueba, tu celular debe estar en la lista "Para". |
| En el panel sale "Sin conexión con Meta" | Faltan `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID` en `backend/.env`, o no reiniciaste el backend. |
| Error de Meta código 190 | El token venció. El token temporal dura 24 horas: genera otro o usa uno permanente. |
| Error de Meta código 131030 | Ese celular no está en la lista "Para" del número de prueba. |
| Al pagar desde el celular aparece una página de ngrok | Es el aviso de la versión gratuita de ngrok. Toca "Visit Site" y sigue al pago. |
| Quiero empezar de cero | Detén el backend, borra la base (`dropdb -U postgres nicolett_studio`), créala de nuevo (`createdb -U postgres nicolett_studio`) y ejecuta `npm run demo`. |

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
(ver [Instalar en un PC nuevo](#instalar-en-un-pc-nuevo-windows)):

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

> Si alguien agrega tablas o columnas, las escribe en `db/schema.postgres.sql`
> (con `IF NOT EXISTS`). Al traer sus cambios basta con `npm install`, `npm run db:init`
> y `npm run dev`. Cada persona tiene su propia base PostgreSQL: nunca compartan claves.

## Registro de cambios

### Noviembre 2026 · Instalador para Windows y aviso de pago por WhatsApp

| Archivo | Qué cambió |
|---------|------------|
| `1-instalar.bat`, `2-iniciar.bat`, `3-whatsapp-ngrok.bat` | **Nuevos:** instalar y abrir el sistema con doble clic en un PC desde cero |
| `backend/scripts/configurar.js` | **Nuevo:** pide la clave de PostgreSQL, crea la base y el `backend/.env` |
| `backend/src/controllers/pagos.controller.js` | Al aprobarse el pago de una reserva hecha por WhatsApp, envía el aviso "Tu hora está confirmada" directamente |
| `backend/src/whatsapp/avisos.js` | El aviso no se repite si se dispara dos veces, y la ventana del backend muestra si se envió o por qué no |
| `README.md` | Instalación en un PC nuevo, uso de los `.bat` y cómo llevar datos y fotos a otro PC |

**Para actualizar:** copia los archivos encima del proyecto y abre el sistema con
`2-iniciar.bat`. No hay cambios en la base de datos.

### Noviembre 2026 · Agente de WhatsApp

| Archivo | Qué cambió |
|---------|------------|
| `backend/src/whatsapp/` | **Nuevo:** el agente (conversación, webhook de Meta, envío, avisos) |
| `backend/src/routes/whatsapp.routes.js` | **Nuevo:** webhook, enlace de pago del abono, panel y simulador |
| `backend/db/schema.postgres.sql` | Tablas `whatsapp_contactos`, `whatsapp_sesiones`, `whatsapp_mensajes`; columna `citas.origen` (WEB o WHATSAPP); configuración de datos de transferencia |
| `backend/server.js` | Rutas `/api/whatsapp` y lectura de la firma de Meta |
| `backend/src/services/notificaciones.service.js` | El abono confirmado también se avisa por WhatsApp si la reserva vino de ahí |
| `backend/src/jobs/vencimientos.js` | Avisa por WhatsApp cuando una hora se libera por falta de abono |
| `backend/src/controllers/pagos.controller.js` | Al volver de Webpay, las reservas de WhatsApp ven una página simple |
| `backend/src/services/reservas.service.js` | Exporta `citaDeLaClienta` (lo usa el agente) |
| `backend/src/utils/mailer.js` | No envía correos a las clientas creadas por WhatsApp (no tienen correo) |
| `backend/.env.example` | Variables `WHATSAPP_*` |
| `frontend/src/pages/WhatsApp.jsx`, `styles/whatsapp.css` | **Nuevo:** Panel → WhatsApp (conversaciones, simulador, configuración) |
| `frontend/src/App.jsx`, `components/marca/SubnavPanel.jsx`, `api/client.js` | Ruta, pestaña y llamadas del panel de WhatsApp |
| `frontend/src/utils/formato.js`, `pages/Gestion.jsx`, `pages/Panel.jsx` | Clientas de WhatsApp aparecen como "Llegó por WhatsApp (sin correo)" |

**Después de actualizar:** detén el backend, `cd backend` y `npm run db:init` (agrega las
tablas nuevas sin tocar tus datos), luego `npm run dev`. Reinicia también el frontend.
Para conectarlo a Meta, sigue [Agente de WhatsApp](#agente-de-whatsapp).

### Octubre 2026 · Base de datos: de SQLite a PostgreSQL

Mismas 30 tablas, 40 llaves foráneas, 58 reglas CHECK, índices y datos. Las fechas siguen
guardándose como texto `AAAA-MM-DD HH:MM`, así que la lógica de agenda no cambió.

| Archivo | Qué cambió |
|---------|------------|
| `backend/db/schema.postgres.sql` | **Nuevo:** esquema completo para PostgreSQL (reemplaza a `migrations.sql` y `migraciones.js`, que se eliminaron) |
| `backend/db/connection.js` | Conexión a PostgreSQL con `pg`. Mantiene `db.prepare(...).get/all/run` y `db.transaction`, ahora con `await` |
| `backend/db/migrar-desde-sqlite.js` | **Nuevo:** `npm run db:migrar-sqlite` copia los datos de `nicolett.db` y los verifica fila por fila |
| `backend/db/init.js` y `seed-*.js` | Usan PostgreSQL |
| `backend/src/models/*`, `services/*`, `controllers/*`, `routes/*`, `jobs/*`, `middleware/auth.middleware.js` | Consultas asíncronas (`await`). Reservar, cambiar hora, confirmar abono y comprar corren en transacciones, para que dos personas no tomen la misma hora ni las últimas unidades |
| `backend/server.js` | Revisa la conexión a PostgreSQL antes de arrancar |
| `backend/package.json`, `.env.example` | `pg` y `DATABASE_URL` en lugar de `DB_PATH` |

**Para pasar tus datos actuales:**

1. Instala PostgreSQL y crea la base: `createdb -U postgres nicolett_studio`.
2. En `backend/.env` agrega `DATABASE_URL` (ver `.env.example`).
3. `cd backend`, `npm install` y `npm run db:migrar-sqlite`. Lee `db/nicolett.db`, copia
   todo y muestra cuántas filas pasó por tabla.
4. `npm run dev`. El archivo `nicolett.db` queda como respaldo; ya no se usa.

### Octubre 2026 · Pantalla completa, fotos más grandes y reservas/compras sin cuenta

| Archivo | Qué cambió |
|---------|------------|
| `frontend/src/styles/global.css` | Variables `--ancho-pagina` y `--margen-lateral`: las páginas usan todo el ancho de la pantalla |
| `frontend/src/styles/sitio.css`, `catalogo.css`, `agenda.css`, `cuenta.css`, `equipo.css`, `panel.css`, `reservar.css` | Ancho completo con márgenes laterales proporcionales; fotos de servicios más grandes |
| `frontend/src/styles/marca.css` | Ancho de la barra y la hoja lateral; estilos del formulario "Tus datos" y la etiqueta "Sin cuenta" |
| `backend/db/migraciones.js` | Nueva columna `usuarios.es_invitado` (se agrega sola al iniciar) |
| `backend/src/controllers/auth.controller.js`, `routes/auth.routes.js`, `utils/validators.js`, `utils/jwt.js`, `utils/mailer.js` | `POST /auth/invitada` y activación de cuenta para quien ya reservó o compró sin cuenta |
| `backend/src/middleware/auth.middleware.js` | La sesión de invitada solo sirve en las rutas de reservar, comprar y pagar |
| `backend/src/controllers/reservas.controller.js`, `tienda.controller.js`, `pagos.controller.js` y sus rutas | Aceptan la sesión de invitada, limitada a lo creado en esa visita |
| `backend/src/models/usuario.model.js`, `routes/clientes.routes.js` | Marca de clienta sin cuenta |
| `backend/src/services/notificaciones.service.js` | Correo con botón "Crear mi cuenta" para quien no tiene cuenta |
| `frontend/src/components/DatosInvitada.jsx`, `utils/invitada.js` | **Nuevos:** formulario "Tus datos" y sesión de invitada |
| `frontend/src/pages/Reservar.jsx`, `components/tienda/CarritoHoja.jsx` | Reservar y pagar sin cuenta |
| `frontend/src/pages/Resultado.jsx`, `components/RecordatorioCita.jsx` | Resultado para invitada con invitación a crear cuenta |
| `frontend/src/pages/Registro.jsx`, `RestablecerPassword.jsx`, `context/AuthContext.jsx`, `api/client.js` | Registro con datos ya escritos y activación ("Crea tu contraseña") |
| `frontend/src/pages/Gestion.jsx` | Etiqueta "Sin cuenta" en Clientas |

**Después de actualizar:** reinicia backend y frontend. No hay que correr ningún seed: la
columna nueva se crea sola y no se tocan `.env`, `nicolett.db`, `uploads/` ni `credenciales/`.

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

