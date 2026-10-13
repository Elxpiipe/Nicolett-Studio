// src/components/marca/SubnavPanel.jsx
// Pestañas de las paginas internas del panel, segun el rol.
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function SubnavPanel() {
  const { usuario } = useAuth();
  if (!usuario) return null;

  const enlaces = [{ to: "/panel", texto: "Resumen", exacta: true }];
  if (usuario.rol === "Administrador") {
    enlaces.push(
      { to: "/panel/agenda", texto: "Agenda del día" },
      { to: "/panel/reservas", texto: "Reservas" },
      { to: "/panel/pedidos", texto: "Pedidos" },
      { to: "/servicios", texto: "Catálogo" },
      { to: "/tienda", texto: "Tienda" },
      { to: "/panel/promociones", texto: "Promociones" },
      { to: "/panel/equipo", texto: "Equipo y horarios" },
      { to: "/panel/integraciones", texto: "Google Calendar" }
    );
  }
  if (usuario.rol === "Profesional") {
    enlaces.push({ to: "/panel/agenda", texto: "Mi agenda" }, { to: "/panel/equipo", texto: "Mi horario" });
  }
  if (usuario.rol === "Cliente") {
    enlaces.push({ to: "/panel/mis-citas", texto: "Mis citas" }, { to: "/panel/mis-pedidos", texto: "Mis pedidos" });
  }

  if (enlaces.length === 1) return null;

  return (
    <nav className="subnav-panel" aria-label="Secciones del panel">
      <span className="subnav-rol">{usuario.rol}</span>
      {enlaces.map((e) => (
        <NavLink key={e.to} to={e.to} end={e.exacta}>
          {e.texto}
        </NavLink>
      ))}
    </nav>
  );
}
