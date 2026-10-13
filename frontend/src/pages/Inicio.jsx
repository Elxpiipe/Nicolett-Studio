import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { formatearPrecio } from "../utils/formato";
import { enlaceWhatsApp } from "../utils/contacto";
import BarraSitio from "../components/marca/BarraSitio";
import PieMarca from "../components/marca/PieMarca";
import { FotoArco, FotoPerfil } from "../components/marca/Fotos";
import CarruselPromos from "../components/marca/CarruselPromos";
import {
  IconoCategoria,
  IconoCorazon,
  IconoDiamante,
  IconoEscudo,
  IconoWhatsApp,
  Loto,
} from "../components/marca/Iconos";
import fotoSalon from "../assets/salon-nicolett.jpg";
import "../styles/marca.css";
import "../styles/sitio.css";

// Los mismos 4 valores que la clienta muestra al pie de sus publicaciones
const VALORES = [
  { icono: IconoDiamante, titulo: "Productos premium", texto: "Trabajamos con insumos de calidad profesional." },
  { icono: IconoEscudo, titulo: "Profesionales certificadas", texto: "Formación constante en cada técnica." },
  { icono: Loto, titulo: "Resultados naturales y duraderos", texto: "Realzamos tu belleza, sin exagerar." },
  { icono: IconoCorazon, titulo: "Tu belleza en manos expertas", texto: "Un espacio elegante y relajante, pensado para ti." },
];

export default function Inicio() {
  const [categorias, setCategorias] = useState([]);
  const [destacada, setDestacada] = useState(null);
  const [reglas, setReglas] = useState(null);

  useEffect(() => {
    Promise.all([api.listarCategorias(true), api.listarServicios("activo=1")])
      .then(([resCat, resSrv]) => {
        // Solo categorias con servicios publicados, con su precio "desde"
        const lista = resCat.datos
          .map((c) => {
            // Precio "desde": el menor entre servicios con precio (sin los "segun evaluacion")
            const precios = resSrv.datos
              .filter((s) => s.id_categoria === c.id_categoria && s.tipo_precio !== "EVALUACION")
              .map((s) => s.precio_desde ?? s.precio);
            return { ...c, desde: precios.length ? Math.min(...precios) : null };
          })
          .filter((c) => c.desde !== null);
        setCategorias(lista);
      })
      .catch(() => {});
    api
      .equipoPublico()
      .then((res) => setDestacada(res.datos.find((p) => p.es_destacada) || res.datos[0] || null))
      .catch(() => {});
    api
      .reglasAgenda()
      .then((res) => setReglas(res.reglas))
      .catch(() => {});
  }, []);

  const abono = reglas ? formatearPrecio(reglas.abono) : "$5.000";
  const horasCambio = reglas?.horasCambio ?? 48;

  return (
    <div className="pagina-marca">
      <BarraSitio />

      <main>
        {/* ---------- Portada ---------- */}
        <section className="inicio-portada">
          <div className="inicio-portada-texto">
            <p className="sobretitulo">Salón de belleza en Buin</p>
            <h1 className="inicio-lema">Belleza a tu ritmo y sin barreras</h1>
            <p className="inicio-bajada">
              Manicura, pedicure, pestañas, cabello, depilación y podología clínica, en un espacio
              elegante y relajante.
              Revisa nuestros precios y agenda tu hora.
            </p>
            <div className="inicio-acciones">
              <Link to="/reservar" className="boton boton-cacao">
                Reservar hora
              </Link>
              <Link to="/servicios" className="boton boton-linea">
                Ver servicios y precios
              </Link>
              <a
                href={enlaceWhatsApp("Hola, quiero agendar una hora en Nicolett Studio Fantasy.")}
                className="boton-texto inicio-wsp"
                target="_blank"
                rel="noreferrer"
              >
                <IconoWhatsApp className="boton-icono" />
                ¿Prefieres WhatsApp?
              </a>
            </div>
          </div>
          <FotoArco src={fotoSalon} alt="Recepción del salón Nicolett Studio Fantasy" />
        </section>

        {/* ---------- Promociones (carrusel administrable) ---------- */}
        <CarruselPromos />

        {/* ---------- Categorias ---------- */}
        {categorias.length > 0 && (
          <section className="seccion">
            <header className="seccion-cabecera">
              <p className="sobretitulo">Lo que hacemos</p>
              <h2 className="titulo-script">Nuestros servicios</h2>
            </header>
            <ul className="inicio-categorias">
              {categorias.map((c) => (
                <li key={c.id_categoria}>
                  <Link to={`/servicios#categoria-${c.id_categoria}`} className="tarjeta-categoria">
                    <span className="tarjeta-categoria-icono">
                      <IconoCategoria nombre={c.nombre} />
                    </span>
                    <span className="tarjeta-categoria-nombre">{c.nombre}</span>
                    <span className="tarjeta-categoria-precio">desde {formatearPrecio(c.desde)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ---------- Valores ---------- */}
        <section className="seccion seccion-valores">
          <ul className="valores">
            {VALORES.map(({ icono: Icono, titulo, texto }) => (
              <li key={titulo}>
                <span className="valor-icono">
                  <Icono />
                </span>
                <h3>{titulo}</h3>
                <p>{texto}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- Como reservar + reglas ---------- */}
        <section className="seccion">
          <header className="seccion-cabecera">
            <p className="sobretitulo">Agenda en 3 pasos</p>
            <h2 className="titulo-script">¿Cómo reservar?</h2>
          </header>
          <div className="reservar-inicio">
            <ol className="pasos">
              <li>
                <span className="paso-numero">1</span>
                <div>
                  <h3>Elige tu servicio</h3>
                  <p>Revisa nuestras listas de precios y escoge lo que quieres hacerte.</p>
                </div>
              </li>
              <li>
                <span className="paso-numero">2</span>
                <div>
                  <h3>Escoge día y hora</h3>
                  <p>Con la profesional que prefieras o con la primera disponible.</p>
                </div>
              </li>
              <li>
                <span className="paso-numero">3</span>
                <div>
                  <h3>Confirma con tu abono</h3>
                  <p>Paga el abono con tarjeta en Webpay o coordina una transferencia por WhatsApp.</p>
                </div>
              </li>
            </ol>

            <aside className="reglas">
              <p className="reglas-titulo">Reglas de agendamiento</p>
              <ul>
                <li>
                  Abono de <strong>{abono}</strong> (servicios de cabello <strong>$10.000</strong>), descontable
                  del total del servicio.
                </li>
                <li>
                  Cambio de hora solo con <strong>{horasCambio} horas</strong> de anticipación.
                </li>
                <li className="regla-importante">
                  <strong>¡Importante!</strong> Si no cumples el plazo, se pierde el abono.
                </li>
              </ul>
            </aside>
          </div>
        </section>

        {/* ---------- Tienda ---------- */}
        <section className="seccion">
          <div className="inicio-tienda">
            <div>
              <p className="sobretitulo">Tienda</p>
              <h2 className="titulo-script">Cuida tu cabello en casa</h2>
              <p>Matizadores, tratamientos y más productos que usamos en el salón. Pagas online y retiras en Buin.</p>
            </div>
            <Link to="/tienda" className="boton boton-oro">
              Ver productos
            </Link>
          </div>
        </section>

        {/* ---------- Equipo ---------- */}
        {destacada && (
          <section className="seccion">
            <div className="inicio-equipo">
              <FotoPerfil profesional={destacada} tamano="grande" />
              <div>
                <p className="sobretitulo">Quiénes somos</p>
                <h2 className="titulo-script">Tu belleza en manos expertas</h2>
                <p className="inicio-equipo-texto">
                  {destacada.descripcion ||
                    "Un equipo de profesionales dedicado a que vivas tu momento de belleza a tu ritmo."}
                </p>
                <Link to="/nosotras" className="boton boton-linea">
                  Conoce al equipo
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ---------- Contacto ---------- */}
        <section className="seccion">
          <div className="inicio-contacto">
            <p className="titulo-script">¿Te esperamos?</p>
            <p>Estamos en Avenida Bernardo O'Higgins 979, Buin.</p>
            <Link to="/contacto" className="boton boton-oro">
              Cómo llegar y horarios
            </Link>
          </div>
        </section>
      </main>

      <PieMarca />
    </div>
  );
}
