import { useEffect, useState } from "react";
import { api } from "../api/client";
import { CONTACTO, enlaceWhatsApp } from "../utils/contacto";
import BarraSitio from "../components/marca/BarraSitio";
import PieMarca from "../components/marca/PieMarca";
import { IconoInstagram, IconoReloj, IconoUbicacion, IconoWhatsApp } from "../components/marca/Iconos";
import "../styles/marca.css";
import "../styles/sitio.css";

const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// Mapa de Google embebido (no requiere clave de API)
const MAPA_EMBED = `https://maps.google.com/maps?q=${encodeURIComponent(
  "Avenida Bernardo O'Higgins 979, Buin, Chile"
)}&z=16&output=embed`;
const COMO_LLEGAR = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
  "Avenida Bernardo O'Higgins 979, Buin, Chile"
)}`;

/** Agrupa dias consecutivos con el mismo horario: "Lunes a viernes" */
function agruparHorario(datos) {
  const grupos = [];
  for (const d of datos) {
    const texto = d.tramos.length ? d.tramos.map((t) => `${t.desde} – ${t.hasta}`).join(" · ") : "Cerrado";
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.texto === texto && ultimo.hasta === d.dia_semana - 1) ultimo.hasta = d.dia_semana;
    else grupos.push({ desde: d.dia_semana, hasta: d.dia_semana, texto });
  }
  return grupos.map((g) => ({
    dias: g.desde === g.hasta ? DIAS[g.desde] : `${DIAS[g.desde]} a ${DIAS[g.hasta].toLowerCase()}`,
    texto: g.texto,
    cerrado: g.texto === "Cerrado",
  }));
}

export default function Contacto() {
  const [horario, setHorario] = useState(null);

  useEffect(() => {
    api
      .horarioSalon()
      .then((res) => setHorario(agruparHorario(res.datos)))
      .catch(() => setHorario([]));
  }, []);

  const hayHorario = horario?.some((h) => !h.cerrado);

  return (
    <div className="pagina-marca">
      <BarraSitio />

      <main className="pagina-sitio">
        <header className="seccion-cabecera cabecera-pagina">
          <p className="sobretitulo">Te esperamos</p>
          <h1 className="titulo-script">Contacto</h1>
          <p className="cabecera-bajada">Escríbenos, síguenos o ven a vernos a Buin.</p>
        </header>

        <div className="contacto">
          <div className="contacto-mapa">
            <iframe
              title="Mapa: Avenida Bernardo O'Higgins 979, Buin"
              src={MAPA_EMBED}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          <div className="contacto-tarjetas">
            <article className="tarjeta-contacto">
              <span className="tarjeta-contacto-icono">
                <IconoUbicacion />
              </span>
              <div>
                <h2>Dirección</h2>
                <p>{CONTACTO.direccion}</p>
                <a href={COMO_LLEGAR} target="_blank" rel="noreferrer" className="boton-texto">
                  Cómo llegar
                </a>
              </div>
            </article>

            <article className="tarjeta-contacto tarjeta-contacto-principal">
              <span className="tarjeta-contacto-icono">
                <IconoWhatsApp />
              </span>
              <div>
                <h2>WhatsApp</h2>
                <p>{CONTACTO.whatsappVisible}</p>
                <a
                  href={enlaceWhatsApp("Hola, tengo una consulta para Nicolett Studio Fantasy.")}
                  target="_blank"
                  rel="noreferrer"
                  className="boton boton-cacao boton-chico"
                >
                  Escríbenos
                </a>
              </div>
            </article>

            <article className="tarjeta-contacto">
              <span className="tarjeta-contacto-icono">
                <IconoInstagram />
              </span>
              <div>
                <h2>Instagram</h2>
                <p>{CONTACTO.instagram}</p>
                <a href={CONTACTO.instagramUrl} target="_blank" rel="noreferrer" className="boton-texto">
                  Ver nuestros trabajos
                </a>
              </div>
            </article>

            <article className="tarjeta-contacto">
              <span className="tarjeta-contacto-icono">
                <IconoReloj />
              </span>
              <div className="contacto-horario">
                <h2>Horario de atención</h2>
                {horario === null ? (
                  <p>Cargando…</p>
                ) : !hayHorario ? (
                  <p>Consúltanos por WhatsApp.</p>
                ) : (
                  <dl>
                    {horario.map((h) => (
                      <div key={h.dias} className={h.cerrado ? "horario-cerrado" : ""}>
                        <dt>{h.dias}</dt>
                        <dd>{h.texto}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </article>
          </div>
        </div>
      </main>

      <PieMarca />
    </div>
  );
}
