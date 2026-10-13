// Agenda del dia: citas por profesional, con "Atendida" / "No asistio".
// Administradora: todas las profesionales. Profesional: solo su agenda.
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { formatearPrecio } from "../utils/formato";
import BarraSitio from "../components/marca/BarraSitio";
import SubnavPanel from "../components/marca/SubnavPanel";
import PieMarca from "../components/marca/PieMarca";
import { FotoPerfil } from "../components/marca/Fotos";
import { IconoWhatsApp } from "../components/marca/Iconos";
import { fechaLarga } from "./Reservar";
import "../styles/marca.css";
import "../styles/equipo.css";
import "../styles/gestion.css";
import "../styles/agenda.css";

const hoyChile = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" }).format(new Date());

function moverDia(fecha, n) {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function whatsappClienta(telefono, mensaje) {
  if (!telefono) return null;
  let n = telefono.replace(/\D/g, "");
  if (n.length === 9) n = `56${n}`;
  return `https://wa.me/${n}?text=${encodeURIComponent(mensaje)}`;
}

const ESTADOS = {
  CONFIRMADA: { texto: "Por atender", tono: "espera" },
  PENDIENTE_ABONO: { texto: "Esperando abono", tono: "neutro" },
  ATENDIDA: { texto: "Atendida", tono: "ok" },
  NO_ASISTE: { texto: "No asistió", tono: "error" },
};

export default function Agenda() {
  const { usuario, token } = useAuth();
  const esAdmin = usuario.rol === "Administrador";
  const [fecha, setFecha] = useState(hoyChile());
  const [filtro, setFiltro] = useState(null); // id_profesional (solo admin)
  const [datos, setDatos] = useState(null);
  const [aviso, setAviso] = useState(null);

  async function cargar(silencioso = false) {
    if (!silencioso) setDatos(null);
    try {
      setDatos(await api.agendaDelDia({ fecha }, token));
    } catch (err) {
      setDatos({ profesionales: [] });
      setAviso({ tipo: "error", texto: err.message });
    }
  }

  useEffect(() => {
    cargar();
    // Se actualiza sola cada minuto (nuevas reservas, abonos confirmados)
    const t = setInterval(() => cargar(true), 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  const columnas = (datos?.profesionales || []).filter((p) => !filtro || p.id_profesional === filtro);
  const todas = columnas.flatMap((p) => p.citas);
  const porAtender = todas.filter((c) => c.estado === "CONFIRMADA");
  const porCobrar = porAtender.reduce((s, c) => s + (c.saldo || 0), 0);

  async function marcar(cita, estado, observaciones) {
    try {
      await api.marcarAtencion(cita.codigo_cita, estado, observaciones, token);
      setAviso({
        tipo: "exito",
        texto:
          estado === "ATENDIDA"
            ? `${cita.cliente}: atendida ✓`
            : estado === "NO_ASISTE"
            ? `${cita.cliente}: marcada como “no asistió” (el abono no se devuelve)`
            : "Marca deshecha",
      });
      cargar(true);
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    }
  }

  return (
    <div className="pagina-marca">
      <BarraSitio />
      <SubnavPanel />

      <main className="equipo agenda">
        <header className="equipo-cabecera">
          <h1>{esAdmin ? "Agenda del día" : "Mi agenda"}</h1>
        </header>

        <div className="agenda-dia" role="group" aria-label="Elegir día">
          <button type="button" className="boton boton-linea boton-chico" onClick={() => setFecha(moverDia(fecha, -1))} aria-label="Día anterior">
            ‹
          </button>
          <div className="agenda-fecha">
            <strong>{fechaLarga(fecha)}</strong>
            {fecha === hoyChile() ? <span>Hoy</span> : (
              <button type="button" className="boton-texto" onClick={() => setFecha(hoyChile())}>Volver a hoy</button>
            )}
          </div>
          <button type="button" className="boton boton-linea boton-chico" onClick={() => setFecha(moverDia(fecha, 1))} aria-label="Día siguiente">
            ›
          </button>
          <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} aria-label="Ir a una fecha" />
        </div>

        {esAdmin && datos?.profesionales?.length > 1 && (
          <div className="filtros-gestion" role="group" aria-label="Profesional">
            <button type="button" className="chip" aria-pressed={!filtro} onClick={() => setFiltro(null)}>Todas</button>
            {datos.profesionales.map((p) => (
              <button key={p.id_profesional} type="button" className="chip" aria-pressed={filtro === p.id_profesional} onClick={() => setFiltro(p.id_profesional)}>
                {p.nombre}
              </button>
            ))}
          </div>
        )}

        {aviso && (
          <div className={`aviso aviso-${aviso.tipo}`} role={aviso.tipo === "error" ? "alert" : "status"}>
            <span>{aviso.texto}</span>
            <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">×</button>
          </div>
        )}

        {datos && todas.length > 0 && (
          <div className="agenda-resumen">
            <div><strong>{todas.length}</strong><span>citas</span></div>
            <div><strong>{todas.filter((c) => c.estado === "ATENDIDA").length}</strong><span>atendidas</span></div>
            <div><strong>{porAtender.length}</strong><span>por atender</span></div>
            <div><strong>{formatearPrecio(porCobrar)}</strong><span>saldo por cobrar</span></div>
          </div>
        )}

        {datos === null ? (
          <p className="equipo-estado">Cargando agenda…</p>
        ) : columnas.length === 0 ? (
          <p className="gestion-vacio">No hay profesionales activas.</p>
        ) : (
          <div className={`agenda-columnas ${columnas.length === 1 ? "agenda-una" : ""}`}>
            {columnas.map((p) => (
              <section key={p.id_profesional} className="agenda-columna" aria-label={`Agenda de ${p.nombre}`}>
                <header className="agenda-profesional">
                  <FotoPerfil profesional={{ nombres: p.nombre.split(" ")[0], apellidos: p.nombre.split(" ").slice(1).join(" "), foto_url: p.foto_url }} tamano="mini" />
                  <div>
                    <strong>{p.nombre}</strong>
                    <span>{p.citas.length ? `${p.citas.length} cita(s)` : "Sin citas"}</span>
                  </div>
                </header>

                {p.bloqueos.map((b, i) => (
                  <div key={`b${i}`} className="agenda-bloqueo">
                    Bloqueado {b.fecha_hora_inicio.slice(11)}–{b.fecha_hora_fin.slice(0, 10) > fecha ? "fin del día" : b.fecha_hora_fin.slice(11)}
                  </div>
                ))}

                {p.citas.length === 0 ? (
                  <p className="agenda-libre">Día libre de reservas.</p>
                ) : (
                  <ol className="agenda-citas">
                    {p.citas.map((c) => (
                      <CitaAgenda key={c.codigo_cita} cita={c} onMarcar={marcar} />
                    ))}
                  </ol>
                )}
              </section>
            ))}
          </div>
        )}
      </main>

      <PieMarca />
    </div>
  );
}

function CitaAgenda({ cita: c, onMarcar }) {
  const [notas, setNotas] = useState(null); // null = cerrado; string = escribiendo observaciones
  const estado = ESTADOS[c.estado] || { texto: c.estado, tono: "neutro" };
  const wsp = whatsappClienta(c.telefono_cliente, `Hola ${c.cliente.split(" ")[0]}, te escribimos de Nicolett Studio Fantasy por tu hora de hoy a las ${c.fecha_hora_inicio.slice(11)}.`);

  return (
    <li className={`agenda-cita agenda-${c.estado.toLowerCase()}`}>
      <div className="agenda-hora">
        <strong>{c.fecha_hora_inicio.slice(11)}</strong>
        <span>{c.fecha_hora_fin.slice(11)}</span>
      </div>
      <div className="agenda-cuerpo">
        <div className="agenda-linea">
          <p className="agenda-servicio">{c.servicio}</p>
          <span className={`estado estado-${estado.tono}`}>{estado.texto}</span>
        </div>
        <p className="agenda-clienta">
          {c.cliente}
          {wsp && (
            <a href={wsp} target="_blank" rel="noreferrer" className="agenda-wsp" aria-label={`Escribir a ${c.cliente} por WhatsApp`}>
              <IconoWhatsApp />
            </a>
          )}
        </p>
        <p className="agenda-dinero">
          {c.estado_abono === "APROBADO" ? `Abono ${formatearPrecio(c.monto_abono)} pagado` : "Abono pendiente"} ·{" "}
          <strong>
            Cobrar {c.tipo_precio === "DESDE" ? "desde " : ""}
            {formatearPrecio(c.saldo)}
          </strong>
        </p>
        {c.notas_cliente && <p className="gestion-nota">“{c.notas_cliente}”</p>}
        {c.observaciones && <p className="agenda-obs">Observaciones: {c.observaciones}</p>}

        {c.puede_marcar && c.estado === "CONFIRMADA" && notas === null && (
          <div className="agenda-acciones">
            <button type="button" className="boton boton-cacao boton-chico" onClick={() => setNotas("")}>Atendida</button>
            <button type="button" className="boton boton-linea boton-chico" onClick={() => onMarcar(c, "NO_ASISTE")}>No asistió</button>
          </div>
        )}
        {notas !== null && (
          <div className="agenda-notas">
            <textarea
              rows={2}
              maxLength={1000}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones (opcional): tono usado, recomendaciones…"
              aria-label="Observaciones de la atención"
            />
            <div className="agenda-acciones">
              <button
                type="button"
                className="boton boton-cacao boton-chico"
                onClick={() => {
                  onMarcar(c, "ATENDIDA", notas);
                  setNotas(null);
                }}
              >
                Guardar como atendida
              </button>
              <button type="button" className="boton-texto" onClick={() => setNotas(null)}>Cancelar</button>
            </div>
          </div>
        )}
        {(c.estado === "ATENDIDA" || c.estado === "NO_ASISTE") && (
          <button type="button" className="boton-texto agenda-deshacer" onClick={() => onMarcar(c, "CONFIRMADA")}>
            Deshacer
          </button>
        )}
        {c.estado === "CONFIRMADA" && !c.puede_marcar && <p className="agenda-espera">Podrás marcarla desde las {c.fecha_hora_inicio.slice(11)}.</p>}
      </div>
    </li>
  );
}
