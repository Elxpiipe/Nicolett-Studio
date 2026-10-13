// src/components/marca/Hoja.jsx
// Panel emergente (drawer lateral en escritorio, hoja inferior en celular).
// Cierra con Escape o clic en el fondo, y bloquea el scroll de la pagina.
import { useEffect, useRef } from "react";

export default function Hoja({ titulo, onCerrar, children, ancho = "angosta" }) {
  const refPanel = useRef(null);
  // Se guarda en una ref para no re-ejecutar el efecto (y perder el foco)
  // cada vez que el padre vuelve a renderizar.
  const refCerrar = useRef(onCerrar);
  refCerrar.current = onCerrar;

  useEffect(() => {
    const focoAnterior = document.activeElement;
    refPanel.current?.focus();
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function alPresionar(e) {
      if (e.key === "Escape") refCerrar.current();
    }
    document.addEventListener("keydown", alPresionar);
    return () => {
      document.removeEventListener("keydown", alPresionar);
      document.body.style.overflow = overflowAnterior;
      focoAnterior?.focus?.();
    };
  }, []);

  return (
    <div className="hoja-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div
        ref={refPanel}
        className={`hoja hoja-${ancho}`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
      >
        <button type="button" className="hoja-cerrar" onClick={onCerrar} aria-label="Cerrar">
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
