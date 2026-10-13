import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Envuelve rutas que requieren sesion iniciada.
 * Si se pasa `rolesPermitidos`, ademas exige que el usuario tenga uno de esos roles.
 */
export default function RutaProtegida({ children, rolesPermitidos }) {
  const { estaAutenticado, usuario, cargando } = useAuth();
  const location = useLocation();

  if (cargando) {
    return <div className="contenedor-centrado">Cargando…</div>;
  }

  if (!estaAutenticado) {
    return <Navigate to="/login" state={{ desde: location }} replace />;
  }

  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    return <Navigate to="/panel" replace />;
  }

  return children;
}
