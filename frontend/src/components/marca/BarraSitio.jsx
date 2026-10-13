// src/components/marca/BarraSitio.jsx
// Encabezado unico del sitio: navegacion publica + botones de sesion.
// En celular se convierte en un menu desplegable.
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCarrito } from "../../context/CarritoContext";
import { Loto } from "./Iconos";
import CarritoHoja from "../tienda/CarritoHoja";

function IconoBolsa(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 8h14l-1 12H6z" />
        <path d="M9 10V7a3 3 0 0 1 6 0v3" />
      </g>
    </svg>
  );
}

const SECCIONES = [
  { to: "/", texto: "Inicio", exacta: true },
  { to: "/servicios", texto: "Servicios" },
  { to: "/tienda", texto: "Tienda" },
  { to: "/nosotras", texto: "Nosotras" },
  { to: "/contacto", texto: "Contacto" },
];

export default function BarraSitio() {
  const { usuario, cerrarSesion } = useAuth();
  const carrito = useCarrito();
  const [abierto, setAbierto] = useState(false);
  const { pathname } = useLocation();

  // Cierra el menu del celular al cambiar de pagina
  useEffect(() => setAbierto(false), [pathname]);

  return (
    <>
    <header className={`barra-sitio ${abierto ? "barra-abierta" : ""}`}>
      <Link to="/" className="barra-logo" aria-label="Nicolett Studio Fantasy, ir al inicio">
        <Loto className="barra-loto" />
        <span className="barra-nombre">
          Nicolett
          <small>Studio Fantasy</small>
        </span>
      </Link>

      <button
        type="button"
        className="barra-carrito"
        onClick={carrito.abrir}
        aria-label={`Carrito, ${carrito.unidades} producto(s)`}
      >
        <IconoBolsa className="barra-carrito-icono" />
        {carrito.unidades > 0 && <span className="barra-carrito-numero">{carrito.unidades}</span>}
      </button>

      <button
        type="button"
        className="barra-menu"
        aria-expanded={abierto}
        aria-controls="menu-sitio"
        onClick={() => setAbierto((a) => !a)}
      >
        <span className="barra-menu-lineas" aria-hidden="true" />
        <span className="barra-menu-texto">{abierto ? "Cerrar" : "Menú"}</span>
      </button>

      <div id="menu-sitio" className="barra-contenido">
        <nav className="barra-nav" aria-label="Secciones del sitio">
          {SECCIONES.map((s) => (
            <NavLink key={s.to} to={s.to} end={s.exacta}>
              {s.texto}
            </NavLink>
          ))}
        </nav>

        <div className="barra-sesion">
          {usuario ? (
            <>
              <Link
                to="/panel"
                className={`boton boton-cacao boton-chico ${pathname.startsWith("/panel") ? "boton-actual" : ""}`}
              >
                Mi panel
              </Link>
              <span className="barra-usuario-nombre" title={usuario.rol}>
                {usuario.nombres}
              </span>
              <button type="button" className="boton boton-linea boton-chico" onClick={cerrarSesion}>
                Salir
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="boton boton-linea boton-chico">
                Iniciar sesión
              </Link>
              <Link to="/registro" className="boton boton-cacao boton-chico">
                Crear cuenta
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
    {/* Fuera del header: su backdrop-filter romperia el position: fixed de la hoja */}
    {carrito.abierto && <CarritoHoja />}
    </>
  );
}
