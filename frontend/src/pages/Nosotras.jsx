import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import BarraSitio from "../components/marca/BarraSitio";
import PieMarca from "../components/marca/PieMarca";
import { FotoPerfil } from "../components/marca/Fotos";
import { IconoCategoria } from "../components/marca/Iconos";
import "../styles/marca.css";
import "../styles/sitio.css";

function Especialidades({ categorias }) {
  if (!categorias?.length) return null;
  return (
    <ul className="especialidades" aria-label="Servicios que entrega">
      {categorias.map((c) => (
        <li key={c}>
          <IconoCategoria nombre={c} className="especialidad-icono" />
          {c}
        </li>
      ))}
    </ul>
  );
}

export default function Nosotras() {
  const [equipo, setEquipo] = useState(null);

  useEffect(() => {
    api
      .equipoPublico()
      .then((res) => setEquipo(res.datos))
      .catch(() => setEquipo([]));
  }, []);

  const destacada = equipo?.find((p) => p.es_destacada);
  const resto = equipo?.filter((p) => p !== destacada) || [];

  return (
    <div className="pagina-marca">
      <BarraSitio />

      <main className="pagina-sitio">
        <header className="seccion-cabecera cabecera-pagina">
          <p className="sobretitulo">Quiénes somos</p>
          <h1 className="titulo-script">Nosotras</h1>
          <p className="cabecera-bajada">
            En Nicolett Studio Fantasy creemos que la belleza tiene que ser a tu ritmo y sin
            barreras: un espacio elegante y cercano, donde cada detalle está pensado para ti.
          </p>
        </header>

        {equipo === null ? (
          <p className="estado-carga">Cargando equipo…</p>
        ) : equipo.length === 0 ? (
          <p className="estado-carga">Muy pronto conocerás a nuestro equipo.</p>
        ) : (
          <>
            {destacada && (
              <section className="destacada" aria-labelledby="nombre-destacada">
                <FotoPerfil profesional={destacada} tamano="grande" />
                <div className="destacada-texto">
                  <p className="destacada-cargo">{destacada.cargo || "Fundadora"}</p>
                  <h2 id="nombre-destacada" className="nombre-caps">
                    {destacada.nombres} {destacada.apellidos}
                  </h2>
                  {destacada.descripcion && <p className="destacada-descripcion">{destacada.descripcion}</p>}
                  <Especialidades categorias={destacada.categorias} />
                </div>
              </section>
            )}

            {resto.length > 0 && (
              <section className="seccion">
                <header className="seccion-cabecera">
                  <h2 className="titulo-script">Nuestro equipo</h2>
                </header>
                <ul className="equipo-publico">
                  {resto.map((p) => (
                    <li key={p.id_profesional} className="tarjeta-profesional">
                      <FotoPerfil profesional={p} />
                      <h3 className="nombre-caps">
                        {p.nombres} {p.apellidos}
                      </h3>
                      {p.cargo && <p className="tarjeta-cargo">{p.cargo}</p>}
                      {p.descripcion && <p className="tarjeta-descripcion">{p.descripcion}</p>}
                      <Especialidades categorias={p.categorias} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="cta-centrado">
              <Link to="/servicios" className="boton boton-cacao">
                Ver servicios y precios
              </Link>
            </div>
          </>
        )}
      </main>

      <PieMarca />
    </div>
  );
}
