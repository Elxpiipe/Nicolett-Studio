// src/middleware/upload.middleware.js
// Subida de imagenes con multer. Cada tipo de imagen tiene su carpeta dentro de
// backend/uploads/ y se sirve como estatico en /uploads/<carpeta>/...

const path = require("path");
const fs = require("fs");
const multer = require("multer");

const RAIZ_UPLOADS = path.join(__dirname, "..", "..", "uploads");

const TIPOS_PERMITIDOS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const TAMANO_MAXIMO_MB = 5;

/**
 * Crea el middleware de subida para una carpeta. Ej: crearSubida("servicios", "servicio")
 * guarda en uploads/servicios/servicio-<id>-<fecha>.jpg (campo del formulario: "imagen").
 */
function crearSubida(carpeta, prefijo) {
  const destino = path.join(RAIZ_UPLOADS, carpeta);
  fs.mkdirSync(destino, { recursive: true });

  const subir = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, destino),
      // Nombre generado por el servidor: nunca se usa el nombre original del archivo
      filename: (req, file, cb) =>
        cb(null, `${prefijo}-${req.params.id}-${Date.now()}.${TIPOS_PERMITIDOS[file.mimetype]}`),
    }),
    limits: { fileSize: TAMANO_MAXIMO_MB * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
      if (!TIPOS_PERMITIDOS[file.mimetype]) {
        const error = new Error("Formato no permitido. Usa una imagen JPG, PNG o WEBP.");
        error.status = 400;
        return cb(error);
      }
      cb(null, true);
    },
  }).single("imagen");

  // Traduce los errores de multer a respuestas 400 en espanol
  return function manejarSubida(req, res, next) {
    subir(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: `La imagen supera el maximo de ${TAMANO_MAXIMO_MB} MB.` });
      }
      return res.status(err.status || 400).json({ error: err.message });
    });
  };
}

/** URL publica de un archivo recien subido */
function urlArchivo(carpeta, archivo) {
  return `/uploads/${carpeta}/${archivo.filename}`;
}

/**
 * Borra del disco una imagen guardada (ruta tipo /uploads/<carpeta>/xxx.jpg).
 * Solo borra archivos dentro de la carpeta uploads.
 */
function borrarImagenGuardada(url) {
  if (!url || !url.startsWith("/uploads/")) return;
  const ruta = path.normalize(path.join(RAIZ_UPLOADS, url.slice("/uploads/".length)));
  if (ruta.startsWith(RAIZ_UPLOADS + path.sep) && fs.existsSync(ruta)) {
    fs.unlink(ruta, () => {});
  }
}

// Compatibilidad con el modulo de servicios
const manejarSubidaImagen = crearSubida("servicios", "servicio");

module.exports = { crearSubida, urlArchivo, manejarSubidaImagen, borrarImagenGuardada };
