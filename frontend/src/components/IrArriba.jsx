// src/components/IrArriba.jsx
// Al cambiar de pagina (Inicio, Servicios, Tienda...) vuelve al tope, en vez de
// quedar a mitad de pagina. Si la URL trae un #ancla (ej. una categoria), se respeta.
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function IrArriba() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash]);
  return null;
}
