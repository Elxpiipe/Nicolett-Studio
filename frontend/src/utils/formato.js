// src/utils/formato.js

const formateadorCLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export function formatearPrecio(precio) {
  return formateadorCLP.format(Number(precio) || 0);
}

export function formatearDuracion(minutos) {
  const m = Number(minutos) || 0;
  if (m < 60) return `${m} min`;
  const horas = Math.floor(m / 60);
  const resto = m % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp"];

/**
 * Achica la foto en el navegador antes de subirla (las fotos de celular
 * suelen pesar 4-10 MB). Devuelve un JPG de maximo `maxLado` px.
 */
export async function prepararImagen(archivo, { maxLado = 1400, calidad = 0.86 } = {}) {
  if (!TIPOS_IMAGEN.includes(archivo.type)) {
    throw new Error("Formato no permitido. Usa una foto JPG, PNG o WEBP.");
  }

  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));

  // Si ya es chica y liviana, se sube tal cual
  if (escala === 1 && archivo.size <= 1.5 * 1024 * 1024) {
    bitmap.close?.();
    return archivo;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; // fondo blanco para PNG con transparencia
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", calidad));
  if (!blob) throw new Error("No se pudo procesar la imagen.");
  return new File([blob], "foto-servicio.jpg", { type: "image/jpeg" });
}

/**
 * Texto del precio de un servicio:
 *  - "Según evaluación" (se cotiza por WhatsApp)
 *  - "Desde $25.000" (tiene precios por largo o es un precio base)
 *  - "$15.000"
 */
export function textoPrecio(servicio) {
  if (servicio.tipo_precio === "EVALUACION") return "Según evaluación";
  const desde = servicio.precio_desde ?? servicio.precio;
  if (servicio.tipo_precio === "DESDE" || servicio.variantes?.length) return `Desde ${formatearPrecio(desde)}`;
  return formatearPrecio(desde);
}

/** "Francesa | + $5.000 | detalle" (una por linea) -> [{ nombre, precio, detalle }] */
export function leerAdicionales(texto) {
  return (texto || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [nombre, precio, detalle] = l.split("|").map((x) => x?.trim());
      return { nombre, precio, detalle };
    });
}

/** Texto con saltos de linea -> lista de reglas */
export function leerLineas(texto) {
  return (texto || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}
