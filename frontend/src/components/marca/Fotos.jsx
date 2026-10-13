// src/components/marca/Fotos.jsx
import { urlImagen } from "../../api/client";
import { Loto } from "./Iconos";

/** Foto en arco con el aro dorado del logo (portadas) */
export function FotoArco({ src, alt, className = "" }) {
  return (
    <figure className={`foto-arco ${className}`}>
      <svg className="foto-arco-aro" viewBox="0 0 400 480" aria-hidden="true">
        <path d="M334 76 A 190 232 0 1 0 334 404" />
        <path d="M361 88 A 204 246 0 1 0 361 392" />
      </svg>
      <div className="foto-arco-marco">
        <img src={src} alt={alt} />
      </div>
    </figure>
  );
}

/**
 * Foto de una profesional en arco. Si aun no tiene foto, muestra una imagen
 * generica de la marca (loto + iniciales) en vez de una silueta vacia.
 */
export function FotoPerfil({ profesional, className = "", tamano = "normal" }) {
  const url = urlImagen(profesional?.foto_url);
  const iniciales = `${profesional?.nombres?.[0] || ""}${profesional?.apellidos?.[0] || ""}`.toUpperCase();
  return (
    <div className={`foto-perfil foto-perfil-${tamano} ${className}`}>
      {url ? (
        <img src={url} alt={`${profesional.nombres} ${profesional.apellidos}`} />
      ) : (
        <div className="foto-generica" role="img" aria-label={`Foto de ${profesional?.nombres || "profesional"} pendiente`}>
          <Loto className="foto-generica-loto" />
          <span>{iniciales}</span>
        </div>
      )}
    </div>
  );
}
