// server.js
require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./src/routes/auth.routes");
const usuariosRoutes = require("./src/routes/usuarios.routes");
const categoriasRoutes = require("./src/routes/categorias.routes");
const serviciosRoutes = require("./src/routes/servicios.routes");
const profesionalesRoutes = require("./src/routes/profesionales.routes");
const agendaRoutes = require("./src/routes/agenda.routes");
const sitioRoutes = require("./src/routes/sitio.routes");
const integracionesRoutes = require("./src/routes/integraciones.routes");
const reservasRoutes = require("./src/routes/reservas.routes");
const pagosRoutes = require("./src/routes/pagos.routes");
const tiendaRoutes = require("./src/routes/tienda.routes");
const promocionesRoutes = require("./src/routes/promociones.routes");
const clientesRoutes = require("./src/routes/clientes.routes");
const { iniciarVencimientos } = require("./src/jobs/vencimientos");

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  })
);
app.use(express.json());
// Webpay puede devolver a la clienta con un formulario POST (token_ws)
app.use(express.urlencoded({ extended: false }));

// Imagenes subidas (fotos de servicios). Publicas: se muestran en el catalogo.
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), { maxAge: "7d", fallthrough: false })
);

app.get("/api/salud", (req, res) => {
  res.json({ estado: "ok", servicio: "nicolett-sync-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/categorias", categoriasRoutes);
app.use("/api/servicios", serviciosRoutes);
app.use("/api/profesionales", profesionalesRoutes);
app.use("/api/agenda", agendaRoutes);
app.use("/api/sitio", sitioRoutes);
app.use("/api/integraciones", integracionesRoutes);
app.use("/api/reservas", reservasRoutes);
app.use("/api/pagos", pagosRoutes);
app.use("/api/productos", tiendaRoutes.productos);
app.use("/api/pedidos", tiendaRoutes.pedidos);
app.use("/api/promociones", promocionesRoutes);
app.use("/api/clientes", clientesRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// Manejador de errores centralizado
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (!err.status || err.status >= 500) console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Error interno del servidor" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Nicolett Sync backend escuchando en http://localhost:${PORT}`);
  iniciarVencimientos();
});
