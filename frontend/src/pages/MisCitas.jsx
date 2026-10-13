// Mis citas (clienta): proximas con cambio de hora (regla de 48 horas) y
// cancelacion, e historial con "reservar de nuevo".
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { formatearDuracion, formatearPrecio } from "../utils/formato";
import { enlaceWhatsApp } from "../utils/contacto";
import { irAWebpay } from "../utils/webpay";
import BarraSitio from "../components/marca/BarraSitio";
import SubnavPanel from "../components/marca/SubnavPanel";
import PieMarca from "../components/marca/PieMarca";
import Hoja from "../components/marca/Hoja";
import { IconoCategoria, IconoWhatsApp } from "../components/marca/Iconos";
import { fechaLarga } from "./Reservar";
import "../styles/marca.css";
import "../styles/equipo.css";
import "../styles/reservar.css";
import "../styles/cuenta.css";

/** '2026-10-12 10:00' -> 'domingo 12 de octubre a las 10:00' */
function momento(texto) {
  return `${fechaLarga(texto.slice(0, 10))} a las ${texto.slice(11)}`;
}

/** ¿La hora 'AAAA-MM-DD HH:MM' (Chile) queda a menos de 48 horas de ahora? */
function menosDe48(texto) {
  const limite = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Santiago",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(Date.now() + 48 * 3600000));
  return texto < limite;
}

function estadoHistorial(c) {
  if (c.estado === "CANCELADA") {
    if (c.motivo_cancelacion === "Plazo de abono vencido") return { texto: "Venció sin abono", tono: "neutro" };
    return { texto: "Cancelada", tono: "neutro" };
  }
  if (c.estado === "NO_ASISTE") return { texto: "No asististe", tono: "error" };
  if (c.estado === "PENDIENTE_ABONO") return { texto: "Venció sin abono", tono: "neutro" };
  return { texto: "Realizada", tono: "ok" };
}

export default function MisCitas() {
  const { token } = useAuth();
  const [datos, setDatos] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [hoja, setHoja] = useState(null); // { tipo: "cambiar" | "cancelar", cita }
  const [pagando, setPagando] = useState(null);

  async function cargar() {
    try {
      setDatos(await api.misCitas(token));
    } catch (err) {
      setDatos({ proximas: [], historial: [] });
      setAviso({ tipo: "error", texto: err.message });
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pagar(c) {
    setPagando(c.codigo_cita);
    try {
      irAWebpay(await api.iniciarWebpayReserva(c.codigo_cita, token));
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
      setPagando(null);
    }
  }

  function terminar(texto) {
    setHoja(null);
    setAviso({ tipo: "exito", texto });
    cargar();
  }

  return (
    <div className="pagina-marca">
      <BarraSitio />
      <SubnavPanel />

      <main className="equipo cuenta">
        <header className="equipo-cabecera">
          <h1>Mis citas</h1>
          <p>Revisa tus próximas horas, cámbialas con 48 horas de anticipación o reserva de nuevo.</p>
        </header>

        {aviso && (
          <div className={`aviso aviso-${aviso.tipo}`} role={aviso.tipo === "error" ? "alert" : "status"}>
            <span>{aviso.texto}</span>
            <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">×</button>
          </div>
        )}

        {datos === null ? (
          <p className="equipo-estado">Cargando tus citas…</p>
        ) : (
          <>
            <section aria-labelledby="titulo-proximas">
              <h2 id="titulo-proximas" className="cuenta-subtitulo">Próximas</h2>
              {datos.proximas.length === 0 ? (
                <div className="gestion-vacio">
                  <p>No tienes horas agendadas.</p>
                  <Link to="/reservar" className="boton boton-cacao">Reservar hora</Link>
                </div>
              ) : (
                <ul className="citas">
                  {datos.proximas.map((c) => (
                    <li key={c.codigo_cita} className={`cita ${c.estado === "PENDIENTE_ABONO" ? "cita-pendiente" : ""}`}>
                      <div className="cita-fecha">
                        <span className="cita-dia">{new Date(`${c.fecha_hora_inicio.slice(0, 10)}T12:00:00`).getDate()}</span>
                        <span className="cita-mes">
                          {new Intl.DateTimeFormat("es-CL", { month: "short" }).format(new Date(`${c.fecha_hora_inicio.slice(0, 10)}T12:00:00`))}
                        </span>
                        <span className="cita-hora">{c.fecha_hora_inicio.slice(11)}</span>
                      </div>

                      <div className="cita-cuerpo">
                        <p className="cita-servicio">
                          <IconoCategoria nombre={c.categoria} className="cita-icono" />
                          {c.servicio}
                        </p>
                        <p className="cita-detalle">
                          {fechaLarga(c.fecha_hora_inicio.slice(0, 10))} · {c.fecha_hora_inicio.slice(11)} a {c.fecha_hora_fin.slice(11)} ·
                          con {c.profesional}
                        </p>
                        <p className="cita-detalle">
                          Abono {formatearPrecio(c.monto_abono)} {c.estado_abono === "APROBADO" ? "pagado" : "pendiente"} · pagas en el
                          salón {formatearPrecio(c.saldo)} · <code>{c.codigo_cita}</code>
                        </p>

                        {c.estado === "CONFIRMADA" && c.puede_reagendar && (
                          <p className="cita-regla">Puedes cambiar la hora hasta el {momento(c.limite_cambio)}.</p>
                        )}
                        {c.estado === "CONFIRMADA" && !c.puede_reagendar && (
                          <p className="cita-regla cita-regla-cerrada">
                            Faltan menos de 48 horas: ya no se puede cambiar la hora. Si no puedes venir, avísanos por
                            WhatsApp (el abono no se devuelve).
                          </p>
                        )}
                        {c.estado === "PENDIENTE_ABONO" && (
                          <p className="cita-regla cita-regla-cerrada">
                            Hora apartada hasta las {c.fecha_expiracion_abono?.slice(11)}: si no llega el abono, se libera.
                          </p>
                        )}
                      </div>

                      <div className="cita-acciones">
                        <span className={`estado estado-${c.estado === "CONFIRMADA" ? "ok" : "espera"}`}>
                          {c.estado === "CONFIRMADA" ? "Confirmada" : "Esperando abono"}
                        </span>
                        {c.estado === "PENDIENTE_ABONO" && c.metodo_abono === "WEBPAY" && (
                          <button type="button" className="boton boton-cacao boton-chico" onClick={() => pagar(c)} disabled={pagando === c.codigo_cita}>
                            {pagando === c.codigo_cita ? "Conectando…" : `Pagar ${formatearPrecio(c.monto_abono)}`}
                          </button>
                        )}
                        {c.estado === "PENDIENTE_ABONO" && c.metodo_abono === "TRANSFERENCIA" && (
                          <a
                            className="boton boton-cacao boton-chico"
                            target="_blank"
                            rel="noreferrer"
                            href={enlaceWhatsApp(
                              `Hola, quiero pagar el abono de ${formatearPrecio(c.monto_abono)} de mi reserva ${c.codigo_cita} (${c.servicio}, ${momento(c.fecha_hora_inicio)}). ¿Me envían los datos de transferencia?`
                            )}
                          >
                            Coordinar transferencia
                          </a>
                        )}
                        {c.puede_reagendar && (
                          <button type="button" className="boton boton-linea boton-chico" onClick={() => setHoja({ tipo: "cambiar", cita: c })}>
                            Cambiar hora
                          </button>
                        )}
                        {c.estado === "CONFIRMADA" && !c.puede_reagendar && (
                          <a
                            className="boton-texto cita-wsp"
                            target="_blank"
                            rel="noreferrer"
                            href={enlaceWhatsApp(`Hola, tengo la reserva ${c.codigo_cita} (${c.servicio}, ${momento(c.fecha_hora_inicio)}) y necesito hablar con ustedes.`)}
                          >
                            <IconoWhatsApp className="boton-icono" /> Escribirnos
                          </a>
                        )}
                        {c.puede_cancelar && (
                          <button type="button" className="boton-texto cita-cancelar" onClick={() => setHoja({ tipo: "cancelar", cita: c })}>
                            Cancelar
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="titulo-historial" className="cuenta-seccion">
              <h2 id="titulo-historial" className="cuenta-subtitulo">Historial</h2>
              {datos.historial.length === 0 ? (
                <p className="bloque-ayuda">Aquí verás tus citas anteriores.</p>
              ) : (
                <ul className="historial">
                  {datos.historial.map((c) => {
                    const e = estadoHistorial(c);
                    return (
                      <li key={c.codigo_cita}>
                        <IconoCategoria nombre={c.categoria} className="historial-icono" />
                        <div className="historial-texto">
                          <strong>{c.servicio}</strong>
                          <span>
                            {fechaLarga(c.fecha_hora_inicio.slice(0, 10))}, {c.fecha_hora_inicio.slice(11)} · {c.profesional}
                          </span>
                        </div>
                        <span className={`estado estado-${e.tono}`}>{e.texto}</span>
                        <Link
                          to={`/reservar?servicio=${c.id_servicio}&profesional=${c.id_profesional}`}
                          className="boton-texto historial-repetir"
                        >
                          Reservar de nuevo
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      <PieMarca />

      {hoja?.tipo === "cambiar" && (
        <Hoja titulo="Cambiar hora" onCerrar={() => setHoja(null)}>
          <CambiarHora cita={hoja.cita} token={token} onCancelar={() => setHoja(null)} onListo={terminar} />
        </Hoja>
      )}
      {hoja?.tipo === "cancelar" && (
        <Hoja titulo="Cancelar reserva" onCerrar={() => setHoja(null)}>
          <CancelarCita cita={hoja.cita} token={token} onVolver={() => setHoja(null)} onListo={terminar} onCambiar={() => setHoja({ tipo: "cambiar", cita: hoja.cita })} />
        </Hoja>
      )}
    </div>
  );
}

function CambiarHora({ cita, token, onCancelar, onListo }) {
  const [quien, setQuien] = useState("misma"); // "misma" | "cualquiera"
  const [dias, setDias] = useState(null);
  const [fecha, setFecha] = useState(null);
  const [horas, setHoras] = useState(null);
  const [hora, setHora] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const id_profesional = quien === "misma" ? cita.id_profesional : undefined;

  useEffect(() => {
    setDias(null);
    setHora(null);
    api
      .diasDisponibles({ id_servicio: cita.id_servicio, id_profesional, dias: 28, excluir: cita.codigo_cita })
      .then((r) => {
        setDias(r.datos);
        setFecha((actual) => (r.datos.some((d) => d.fecha === actual && d.disponibles) ? actual : r.datos.find((d) => d.disponibles)?.fecha || null));
      })
      .catch(() => setDias([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quien]);

  useEffect(() => {
    if (!fecha) return;
    setHoras(null);
    setHora(null);
    api
      .horasLibres({ id_servicio: cita.id_servicio, fecha, id_profesional, excluir: cita.codigo_cita })
      // no se ofrece la misma hora que ya tiene
      .then((r) => setHoras(r.horas.filter((h) => !(`${fecha} ${h.hora}` === cita.fecha_hora_inicio && (quien === "misma" || h.profesionales.some((p) => p.id_profesional === cita.id_profesional))))))
      .catch(() => setHoras([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, quien]);

  async function confirmar() {
    setGuardando(true);
    setError("");
    try {
      const { reserva } = await api.reagendarReserva(cita.codigo_cita, { fecha, hora, id_profesional }, token);
      onListo(`Listo: tu hora quedó para el ${momento(reserva.fecha_hora_inicio)} con ${reserva.profesional}.`);
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <div className="editor">
      <p className="editor-sobretitulo">{cita.servicio}</p>
      <h2 className="editor-titulo">Cambiar hora</h2>
      <p className="bloque-ayuda">
        Hoy tienes el {momento(cita.fecha_hora_inicio)} con {cita.profesional}. Tu abono se mantiene
        ({formatearDuracion(cita.duracion_minutos)} de servicio).
      </p>

      <div className="interruptores-quien" role="radiogroup" aria-label="Con quién">
        <label className={`metodo ${quien === "misma" ? "metodo-activo" : ""}`}>
          <input type="radio" name="quien" checked={quien === "misma"} onChange={() => setQuien("misma")} />
          <span><strong>Con {cita.profesional}</strong></span>
        </label>
        <label className={`metodo ${quien === "cualquiera" ? "metodo-activo" : ""}`}>
          <input type="radio" name="quien" checked={quien === "cualquiera"} onChange={() => setQuien("cualquiera")} />
          <span><strong>Con quien esté disponible</strong></span>
        </label>
      </div>

      {dias === null ? (
        <p className="bloque-ayuda">Buscando días…</p>
      ) : !dias.some((d) => d.disponibles) ? (
        <p className="bloque-ayuda">No hay horas libres en las próximas semanas. Escríbenos por WhatsApp.</p>
      ) : (
        <>
          <ul className="tira-dias tira-dias-grande">
            {dias.map((d) => {
              const f = new Date(`${d.fecha}T12:00:00`);
              return (
                <li key={d.fecha}>
                  <button type="button" className="tira-dia" disabled={!d.disponibles} aria-pressed={d.fecha === fecha} onClick={() => setFecha(d.fecha)} aria-label={fechaLarga(d.fecha)}>
                    <span>{new Intl.DateTimeFormat("es-CL", { weekday: "short" }).format(f)}</span>
                    <strong>{f.getDate()}</strong>
                    <span>{new Intl.DateTimeFormat("es-CL", { month: "short" }).format(f)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {fecha && <p className="dia-elegido">{fechaLarga(fecha)}</p>}
          {horas === null ? (
            <p className="bloque-ayuda">Buscando horas…</p>
          ) : horas.length === 0 ? (
            <p className="bloque-ayuda">No quedan horas este día.</p>
          ) : (
            <div className="horas-reserva">
              {horas.map((h) => (
                <button key={h.hora} type="button" className={`hora-boton ${hora === h.hora ? "hora-elegida" : ""}`} aria-pressed={hora === h.hora} onClick={() => setHora(h.hora)}>
                  {h.hora}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {hora && menosDe48(`${fecha} ${hora}`) && (
        <p className="cita-regla cita-regla-cerrada">
          Ojo: esta hora es dentro de las próximas 48 horas, así que después ya no podrás volver a cambiarla.
        </p>
      )}
      {error && <p className="aviso aviso-error" role="alert">{error}</p>}

      <div className="editor-acciones">
        <button type="button" className="boton boton-linea" onClick={onCancelar} disabled={guardando}>Volver</button>
        <button type="button" className="boton boton-cacao" onClick={confirmar} disabled={!hora || guardando}>
          {guardando ? "Cambiando…" : hora ? `Confirmar: ${fechaLarga(fecha).replace(",", "")}, ${hora}` : "Elige una hora"}
        </button>
      </div>
    </div>
  );
}

function CancelarCita({ cita, token, onVolver, onListo, onCambiar }) {
  const [cancelando, setCancelando] = useState(false);
  const [error, setError] = useState("");
  const pagado = cita.estado_abono === "APROBADO";

  async function cancelar() {
    setCancelando(true);
    try {
      await api.cancelarReserva(cita.codigo_cita, token);
      onListo(pagado ? "Tu reserva fue cancelada. El abono no es reembolsable." : "Tu reserva fue cancelada y la hora quedó libre.");
    } catch (err) {
      setError(err.message);
      setCancelando(false);
    }
  }

  return (
    <div className="editor">
      <p className="editor-sobretitulo">{cita.servicio}</p>
      <h2 className="editor-titulo">¿Cancelar tu hora?</h2>
      <p>
        {momento(cita.fecha_hora_inicio)} con {cita.profesional}.
      </p>
      {pagado ? (
        <div className="reglas reglas-compactas">
          <ul>
            <li className="regla-importante">
              <strong>El abono de {formatearPrecio(cita.monto_abono)} no se devuelve.</strong> Es la regla del salón para todas
              nuestras clientas.
            </li>
            {cita.puede_reagendar && <li>Si no puedes venir ese día, puedes <strong>cambiar la hora</strong> y conservar tu abono.</li>}
          </ul>
        </div>
      ) : (
        <p className="bloque-ayuda">Aún no pagas el abono, así que no pierdes nada: la hora simplemente queda libre.</p>
      )}
      {error && <p className="aviso aviso-error" role="alert">{error}</p>}
      <div className="editor-acciones">
        {pagado && cita.puede_reagendar && (
          <button type="button" className="boton boton-cacao" onClick={onCambiar}>Mejor cambio la hora</button>
        )}
        <button type="button" className="boton boton-linea" onClick={onVolver} disabled={cancelando}>Volver</button>
        <button type="button" className="boton-texto cita-cancelar" onClick={cancelar} disabled={cancelando}>
          {cancelando ? "Cancelando…" : pagado ? "Sí, cancelar y perder el abono" : "Sí, cancelar"}
        </button>
      </div>
    </div>
  );
}
