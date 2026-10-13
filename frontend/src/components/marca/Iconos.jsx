// src/components/marca/Iconos.jsx
// Iconos de linea fina, en el mismo estilo que usan las publicaciones de
// Instagram del salon (trazo dorado, sin relleno). Heredan el color con
// currentColor, asi que se tiñen desde el CSS.

const trazo = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

/** Flor de loto con la "N" del logo. */
export function Loto({ className, titulo }) {
  return (
    <svg
      viewBox="0 0 48 40"
      className={className}
      role={titulo ? "img" : undefined}
      aria-hidden={titulo ? undefined : true}
      aria-label={titulo}
    >
      <g {...trazo}>
        <path d="M24 4c5.5 6.5 5.5 17 0 27-5.5-10-5.5-20.5 0-27z" />
        <path d="M24 31c-2.5-8-8.5-13.5-16-15 .5 8.5 7 14.5 16 15z" />
        <path d="M24 31c2.5-8 8.5-13.5 16-15-.5 8.5-7 14.5-16 15z" />
        <path d="M24 31c-6-3.5-13-4-19.5-1.5 5.5 4 13 5 19.5 1.5z" />
        <path d="M24 31c6-3.5 13-4 19.5-1.5-5.5 4-13 5-19.5 1.5z" />
        <path d="M19.5 14.5v12M28.5 14.5v12M19.5 14.5l9 12" strokeWidth="1.1" />
      </g>
    </svg>
  );
}

const DIBUJOS = {
  manicure: (
    <>
      <rect x="19" y="5" width="10" height="12" rx="2" />
      <path d="M17 17h14v4H17z" />
      <rect x="13" y="21" width="22" height="22" rx="6" />
      <path d="M18 30c3.5 2 8.5 2 12 0" />
    </>
  ),
  pedicure: (
    <>
      <path d="M21 43c-6 0-8-5-7-11 1-5 2.5-8 2.5-12.5 0-4 2.5-6.5 6-6.5 4 0 6.5 3 6.5 8 0 5-2 8.5-2 12.5 0 4.5 1 9.5-6 9.5z" />
      <circle cx="31" cy="11" r="2.6" />
      <circle cx="35.5" cy="14.5" r="1.9" />
      <circle cx="38" cy="19" r="1.6" />
      <circle cx="39" cy="23.5" r="1.3" />
      <circle cx="28" cy="7" r="1.1" />
    </>
  ),
  pestanas: (
    <>
      <path d="M7 21c9 10 25 10 34 0" />
      <path d="M11 25.5l-3 4.5M17 28.5l-2 5M24 29.5v5.5M31 28.5l2 5M37 25.5l3 4.5" />
    </>
  ),
  cejas: (
    <>
      <path d="M9 17c8-7.5 22-8.5 30-2" strokeWidth="2.2" />
      <path d="M10 30c8-8 20-8 28 0-8 8-20 8-28 0z" />
      <circle cx="24" cy="30" r="3.5" />
    </>
  ),
  peluqueria: (
    <>
      <circle cx="14" cy="37" r="5" />
      <circle cx="34" cy="37" r="5" />
      <path d="M17.5 33.5L34 7M30.5 33.5L14 7" />
      <circle cx="24" cy="22" r="0.9" />
    </>
  ),
  masajes: (
    <>
      <ellipse cx="24" cy="38" rx="14" ry="4.5" />
      <ellipse cx="24" cy="28.5" rx="10" ry="4" />
      <ellipse cx="24" cy="20" rx="6.5" ry="3.3" />
      <path d="M24 16.5c0-5 3-8.5 7.5-9.5-1 5-3.5 8.5-7.5 9.5z" />
    </>
  ),
  facial: (
    <>
      <path d="M24 5c-8 0-13 7-13 16.5S16 42 24 42s13-11 13-20.5S32 5 24 5z" />
      <path d="M16.5 21c1.8 1.6 4.7 1.6 6.5 0M25 21c1.8 1.6 4.7 1.6 6.5 0" />
      <path d="M20.5 31.5c2.2 1.6 4.8 1.6 7 0" />
    </>
  ),
  // Color e iluminacion: pincel de tinte y bowl
  color: (
    <>
      <path d="M9 30h30l-3.5 10.5a3 3 0 0 1-2.8 2H15.3a3 3 0 0 1-2.8-2z" />
      <path d="M8 30h32" />
      <path d="M30 26l9-19 3 1.5-7 20" />
      <path d="M14 26c2-3 6-4 9-2" />
    </>
  ),
  // Tratamientos y alisado: mechones de cabello
  cabello: (
    <>
      <path d="M14 6c-4 8 4 14 0 22s4 14 2 15" />
      <path d="M24 5c-4 8 4 14 0 22s4 14 2 16" />
      <path d="M34 6c-4 8 4 14 0 22s4 14 2 15" />
    </>
  ),
  depilacion: (
    <>
      <path d="M24 5c6 9 11.5 15 11.5 22.5a11.5 11.5 0 0 1-23 0C12.5 20 18 14 24 5z" />
      <path d="M17.5 28c0 3.5 2.5 6.5 6 7" />
    </>
  ),
};

/** Normaliza "Pestañas" -> "pestanas", "Peluquería" -> "peluqueria", etc. */
function clave(nombre = "") {
  const limpio = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (limpio.startsWith("manicur")) return "manicure";
  if (limpio.startsWith("pedicur") || limpio.includes("podolog")) return "pedicure";
  if (limpio.includes("pestan") || limpio.includes("lash")) return "pestanas";
  if (limpio.includes("ceja")) return "cejas";
  if (limpio.includes("color") || limpio.includes("ilumin") || limpio.includes("decolor")) return "color";
  if (limpio.includes("capilar") || limpio.includes("alisado") || limpio.includes("tratamiento")) return "cabello";
  if (limpio.includes("pelu") || limpio.includes("corte") || limpio.includes("peinado") || limpio.includes("cabello")) return "peluqueria";
  if (limpio.includes("masaj")) return "masajes";
  if (limpio.includes("facial") || limpio.includes("rostro")) return "facial";
  if (limpio.includes("depila") || limpio.includes("cera")) return "depilacion";
  return null;
}

/** Icono de categoria por nombre; si no se reconoce, muestra el loto. */
export function IconoCategoria({ nombre, className }) {
  const dibujo = DIBUJOS[clave(nombre)];
  if (!dibujo) return <Loto className={className} />;
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <g {...trazo}>{dibujo}</g>
    </svg>
  );
}

export function IconoUbicacion(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <g {...trazo} strokeWidth="1.6">
        <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </g>
    </svg>
  );
}

export function IconoWhatsApp(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <g {...trazo} strokeWidth="1.6">
        <path d="M4 20l1.3-4A8 8 0 1 1 8.3 19z" />
        <path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.5-2-1-1 1c-1.2-.5-2.3-1.6-2.8-2.8l1-1-1-2z" strokeWidth="1.2" />
      </g>
    </svg>
  );
}

export function IconoInstagram(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <g {...trazo} strokeWidth="1.6">
        <rect x="4" y="4" width="16" height="16" rx="5" />
        <circle cx="12" cy="12" r="3.7" />
        <circle cx="17" cy="7" r="0.6" />
      </g>
    </svg>
  );
}

export function IconoFoto(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <g {...trazo} strokeWidth="1.5">
        <rect x="3" y="6" width="18" height="14" rx="3" />
        <path d="M8.5 6l1.5-2.5h4L15.5 6" />
        <circle cx="12" cy="13" r="3.5" />
      </g>
    </svg>
  );
}

/* Iconos de los "valores" que la marca muestra en sus publicaciones */
export function IconoDiamante(props) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <g {...trazo}>
        <path d="M8 18l7-9h18l7 9-16 21z" />
        <path d="M8 18h32M15 9l4 9 5-9 5 9 4-9M19 18l5 21 5-21" />
      </g>
    </svg>
  );
}

export function IconoEscudo(props) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <g {...trazo}>
        <path d="M24 5l15 6v11c0 10-6.5 17-15 21-8.5-4-15-11-15-21V11z" />
        <path d="M17 24l5 5 9-10" />
      </g>
    </svg>
  );
}

export function IconoCorazon(props) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <g {...trazo}>
        <path d="M24 40S7 29.5 7 18.5A8.5 8.5 0 0 1 24 14a8.5 8.5 0 0 1 17 4.5C41 29.5 24 40 24 40z" />
      </g>
    </svg>
  );
}

export function IconoReloj(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <g {...trazo} strokeWidth="1.6">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </g>
    </svg>
  );
}
