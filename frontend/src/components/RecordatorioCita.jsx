// src/components/RecordatorioCita.jsx
// Ventana que aparece al terminar una reserva con los cuidados del servicio
// (ej. pestanas limpias) y las reglas del salon. Se muestra una vez por reserva
// y se puede volver a abrir con "Ver indicaciones".
import { useEffect, useState } from "react";
import { formatearPrecio, leerLineas } from "../utils/formato";
import Hoja from "./marca/Hoja";

const CLAVE = (codigo) => `nicolett_recordatorio_${codigo}`;

export function useRecordatorio(reserva) {
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    if (!reserva) return;
    const vigente = reserva.estado === "CONFIRMADA" || (reserva.estado === "PENDIENTE_ABONO" && !reserva.vencida);
    let visto = false;
    try {
      visto = localStorage.getItem(CLAVE(reserva.codigo_cita)) === "1";
    } catch {
      /* sin almacenamiento: se muestra igual */
    }
    if (vigente && !visto) setAbierto(true);
  }, [reserva]);

  function cerrar() {
    try {
      localStorage.setItem(CLAVE(reserva.codigo_cita), "1");
    } catch {
      /* nada */
    }
    setAbierto(false);
  }
  return { abierto, abrir: () => setAbierto(true), cerrar };
}

export default function RecordatorioCita({ reserva, onCerrar, horasCambio = 48 }) {
  const indicaciones = leerLineas(reserva.indicaciones);
  return (
    <Hoja titulo="Antes de tu cita" onCerrar={onCerrar}>
      <div className="recordatorio">
        <p className="editor-sobretitulo">{reserva.servicio}</p>
        <h2 className="editor-titulo">Antes de tu cita</h2>

        {indicaciones.length > 0 && (
          <section className="indicaciones recordatorio-bloque">
            <p className="notas-titulo">Cuidados para tu servicio</p>
            <ul>
              {indicaciones.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="reglas reglas-compactas recordatorio-bloque">
          <p className="reglas-titulo">Reglas de agendamiento</p>
          <ul>
            <li>
              Tu abono de <strong>{formatearPrecio(reserva.monto_abono)}</strong> se descuenta del total del servicio.
            </li>
            <li>
              Si necesitas cambiar la hora, hazlo desde <strong>Mis citas</strong> con al menos{" "}
              <strong>{horasCambio} horas</strong> de anticipación.
            </li>
            <li className="regla-importante">
              <strong>¡Importante!</strong> Si no cumples el plazo o no asistes, se pierde el abono.
            </li>
          </ul>
        </section>

        {reserva.tipo_precio === "DESDE" && (
          <p className="bloque-ayuda">El valor final se confirma en el salón según tu caso, antes de comenzar.</p>
        )}

        <div className="editor-acciones">
          <button type="button" className="boton boton-cacao" onClick={onCerrar}>
            Entendido
          </button>
        </div>
      </div>
    </Hoja>
  );
}
