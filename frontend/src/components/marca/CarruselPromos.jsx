// src/components/marca/CarruselPromos.jsx
// Carrusel de promociones del Inicio. Las publicaciones del salon son verticales
// (formato Instagram), asi que se muestran completas, sin recortar su texto.
// Avanza solo cada 6 s (se pausa al pasar el mouse o con "reducir movimiento").
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, urlImagen } from "../../api/client";
import Hoja from "./Hoja";

function EnlacePromo({ enlace, children, className }) {
  if (!enlace) return null;
  return enlace.startsWith("/") ? (
    <Link to={enlace} className={className}>
      {children}
    </Link>
  ) : (
    <a href={enlace} className={className} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export default function CarruselPromos() {
  const [promos, setPromos] = useState([]);
  const [actual, setActual] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [ampliada, setAmpliada] = useState(null);
  const [desborda, setDesborda] = useState(false); // hay mas promos de las que caben
  const pista = useRef(null);

  // Flechas y puntos solo si hay algo que desplazar
  useEffect(() => {
    const el = pista.current;
    if (!el) return;
    const medir = () => setDesborda(el.scrollWidth > el.clientWidth + 4);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [promos.length]);

  useEffect(() => {
    api
      .promocionesVigentes()
      .then((r) => setPromos(r.datos))
      .catch(() => {});
  }, []);

  function irA(i) {
    const el = pista.current;
    if (!el || !promos.length) return;
    const destino = (i + promos.length) % promos.length;
    const tarjeta = el.children[destino];
    el.scrollTo({ left: tarjeta.offsetLeft - el.offsetLeft, behavior: "smooth" });
    setActual(destino);
  }

  // Sincroniza el punto activo cuando la persona desliza con el dedo
  function alDesplazar() {
    const el = pista.current;
    if (!el || !el.children.length) return;
    const ancho = el.children[0].offsetWidth + 18;
    setActual(Math.min(promos.length - 1, Math.round(el.scrollLeft / ancho)));
  }

  useEffect(() => {
    if (!desborda || pausado || ampliada) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = pista.current;
    const t = setInterval(() => {
      // Si ya se ve todo (pocas promos en pantalla ancha), no hay nada que avanzar
      if (el && el.scrollWidth <= el.clientWidth + 4) return;
      const alFinal = el && el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      irA(alFinal ? 0 : actual + 1);
    }, 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desborda, pausado, ampliada, actual]);

  if (!promos.length) return null;

  return (
    <section className="seccion promos" aria-roledescription="carrusel" aria-label="Promociones">
      <header className="seccion-cabecera">
        <p className="sobretitulo">No te lo pierdas</p>
        <h2 className="titulo-script">Promociones</h2>
      </header>

      <div
        className="promos-marco"
        onMouseEnter={() => setPausado(true)}
        onMouseLeave={() => setPausado(false)}
        onFocus={() => setPausado(true)}
        onBlur={() => setPausado(false)}
      >
        {desborda && (
          <button type="button" className="promos-flecha promos-anterior" onClick={() => irA(actual - 1)} aria-label="Promoción anterior">
            ‹
          </button>
        )}

        <ul className="promos-pista" ref={pista} onScroll={alDesplazar}>
          {promos.map((p, i) => (
            <li key={p.id_promocion} className="promo" aria-roledescription="diapositiva" aria-label={`${i + 1} de ${promos.length}: ${p.titulo}`}>
              <button type="button" className="promo-imagen" onClick={() => setAmpliada(p)} aria-label={`Ver ${p.titulo} en grande`}>
                <img src={urlImagen(p.imagen_url)} alt={p.titulo} loading={i < 3 ? "eager" : "lazy"} />
              </button>
              <div className="promo-texto">
                <h3>{p.titulo}</h3>
                {p.descripcion && <p>{p.descripcion}</p>}
                {p.fecha_fin && (
                  <small>
                    Válida hasta el{" "}
                    {new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long" }).format(new Date(`${p.fecha_fin}T12:00:00`))}
                  </small>
                )}
                <EnlacePromo enlace={p.enlace} className="boton-texto">
                  Ver más
                </EnlacePromo>
              </div>
            </li>
          ))}
        </ul>

        {desborda && (
          <button type="button" className="promos-flecha promos-siguiente" onClick={() => irA(actual + 1)} aria-label="Promoción siguiente">
            ›
          </button>
        )}
      </div>

      {desborda && (
        <div className="promos-puntos" role="tablist" aria-label="Elegir promoción">
          {promos.map((p, i) => (
            <button
              key={p.id_promocion}
              type="button"
              role="tab"
              aria-selected={i === actual}
              aria-label={p.titulo}
              className="promos-punto"
              onClick={() => irA(i)}
            />
          ))}
        </div>
      )}

      {ampliada && (
        <Hoja titulo={ampliada.titulo} onCerrar={() => setAmpliada(null)} ancho="ancha">
          <div className="promo-ampliada">
            <img src={urlImagen(ampliada.imagen_url)} alt={ampliada.titulo} />
            <div>
              <h2 className="titulo-script">{ampliada.titulo}</h2>
              {ampliada.descripcion && <p>{ampliada.descripcion}</p>}
              <EnlacePromo enlace={ampliada.enlace} className="boton boton-cacao">
                Ver más
              </EnlacePromo>
            </div>
          </div>
        </Hoja>
      )}
    </section>
  );
}
