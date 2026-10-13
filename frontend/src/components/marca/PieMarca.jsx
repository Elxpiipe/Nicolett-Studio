// src/components/marca/PieMarca.jsx
// Pie con los datos de contacto, al estilo de la franja inferior de las
// publicaciones de Instagram del salon.
import { CONTACTO } from "../../utils/contacto";
import { IconoInstagram, IconoUbicacion, IconoWhatsApp } from "./Iconos";

export default function PieMarca() {
  return (
    <footer className="pie-marca">
      <div className="pie-franja">
        <a href={CONTACTO.mapa} target="_blank" rel="noreferrer">
          <span className="pie-icono"><IconoUbicacion /></span>
          {CONTACTO.direccion}
        </a>
        <a href={`https://wa.me/${CONTACTO.whatsappNumero}`} target="_blank" rel="noreferrer">
          <span className="pie-icono"><IconoWhatsApp /></span>
          {CONTACTO.whatsappVisible}
        </a>
        <a href={CONTACTO.instagramUrl} target="_blank" rel="noreferrer">
          <span className="pie-icono"><IconoInstagram /></span>
          {CONTACTO.instagram}
        </a>
      </div>
      <p className="pie-lema">Cuida tu belleza, siempre ♡</p>
    </footer>
  );
}
