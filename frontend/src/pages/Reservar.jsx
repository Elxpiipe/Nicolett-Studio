import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { formatearDuracion, formatearPrecio, leerLineas, textoPrecio } from "../utils/formato";
import { enlaceWhatsApp } from "../utils/contacto";
import { irAWebpay } from "../utils/webpay";
import BarraSitio from "../components/marca/BarraSitio";
import PieMarca from "../components/marca/PieMarca";
import { FotoPerfil } from "../components/marca/Fotos";
import { IconoCategoria, Loto } from "../components/marca/Iconos";
import "../styles/marca.css";
import "../styles/sitio.css";
import "../styles/catalogo.css";
import "../styles/reservar.css";

const PASOS = ["Servicio", "Profesional", "Día y hora", "Confirmar"];

/** "2026-10-05" -> "lunes 5 de octubre" */
export function fechaLarga(fecha) {
  return new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(`${fecha}T12:00:00`)
  );
}

export default function Reservar() {
  const { usuario, token } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [servicios, setServicios] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [reglas, setReglas] = useState(null);
  const [equipo, setEquipo] = useState([]);
  const [profesionales, setProfesionales] = useState(null);
  const [dias, setDias] = useState(null);
  const [horas, setHoras] = useState(null);
  const [metodo, setMetodo] = useState("WEBPAY");
  const [notas, setNotas] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  // La seleccion vive en la URL: sobrevive a recargar y a ir a iniciar sesion
  const sel = {
    servicio: Number(params.get("servicio")) || null,
    variante: Number(params.get("variante")) || null, // largo de cabello (S/M/L/XL)
    profesional: params.get("profesional"), // "cualquiera" | id
    fecha: params.get("fecha"),
    hora: params.get("hora"),
  };
  const servicioSel = servicios?.find((s) => s.id_servicio === sel.servicio);
  const faltaVariante = Boolean(servicioSel?.variantes?.length) && !servicioSel.variantes.some((v) => v.id_variante === sel.variante);
  const paso = !sel.servicio || faltaVariante ? 0 : !sel.profesional ? 1 : !sel.fecha || !sel.hora ? 2 : 3;
  const idProfesional = sel.profesional && sel.profesional !== "cualquiera" ? Number(sel.profesional) : undefined;

  function elegir(cambios, borrar = []) {
    const nuevos = new URLSearchParams(params);
    Object.entries(cambios).forEach(([k, v]) => nuevos.set(k, v));
    borrar.forEach((k) => nuevos.delete(k));
    setParams(nuevos);
    setError("");
    window.scrollTo({ top: 0 });
  }

  function irAPaso(n) {
    const borrar = [["servicio", "variante", "profesional", "fecha", "hora"], ["profesional", "fecha", "hora"], ["hora"]][n] || [];
    elegir({}, borrar);
  }

  useEffect(() => {
    api.listarServicios("activo=1").then((r) => setServicios(r.datos)).catch(() => setServicios([]));
    api.listarCategorias(true).then((r) => setCategorias(r.datos)).catch(() => {});
    api.reglasAgenda().then((r) => setReglas(r.reglas)).catch(() => {});
    api.equipoPublico().then((r) => setEquipo(r.datos)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!sel.servicio) return;
    setProfesionales(null);
    api
      .profesionalesPorServicio(sel.servicio)
      .then((r) => setProfesionales(r.datos))
      .catch(() => setProfesionales([]));
  }, [sel.servicio]);

  useEffect(() => {
    if (!sel.servicio || !sel.profesional) return;
    setDias(null);
    api
      .diasDisponibles({ id_servicio: sel.servicio, id_profesional: idProfesional, dias: 21 })
      .then((r) => setDias(r.datos))
      .catch(() => setDias([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.servicio, sel.profesional]);

  // Si no hay fecha elegida, se propone el primer dia con horas
  const fechaActiva = sel.fecha || dias?.find((d) => d.disponibles > 0)?.fecha || null;

  useEffect(() => {
    if (!sel.servicio || !sel.profesional || !fechaActiva) return;
    setHoras(null);
    api
      .horasLibres({ id_servicio: sel.servicio, fecha: fechaActiva, id_profesional: idProfesional })
      .then((r) => setHoras(r.horas))
      .catch(() => setHoras([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.servicio, sel.profesional, fechaActiva]);

  const servicio = servicioSel;
  const variante = servicio?.variantes?.find((v) => v.id_variante === sel.variante) || null;
  const precio = variante ? variante.precio : servicio?.precio ?? 0;
  const abono = servicio ? Math.min(servicio.abono_categoria ?? reglas?.abono ?? 5000, precio) : 0;
  const categoria = categorias.find((c) => c.id_categoria === servicio?.id_categoria);
  const indicaciones = leerLineas(categoria?.indicaciones);
  const profesionalElegida = profesionales?.find((p) => p.id_profesional === idProfesional);

  const porCategoria = useMemo(() => {
    const grupos = new Map();
    for (const s of servicios || []) {
      if (!grupos.has(s.categoria)) grupos.set(s.categoria, []);
      grupos.get(s.categoria).push(s);
    }
    return [...grupos.entries()];
  }, [servicios]);

  async function confirmar() {
    setError("");
    if (!usuario) {
      navigate("/login", { state: { desde: { pathname: "/reservar", search: `?${params.toString()}` } } });
      return;
    }
    setEnviando(true);
    try {
      const { reserva } = await api.crearReserva(
        {
          id_servicio: sel.servicio,
          id_variante: variante?.id_variante,
          fecha: sel.fecha,
          hora: sel.hora,
          id_profesional: idProfesional,
          metodo_abono: metodo,
          notas,
        },
        token
      );
      if (metodo === "WEBPAY") {
        irAWebpay(await api.iniciarWebpayReserva(reserva.codigo_cita, token));
      } else {
        navigate(`/reserva/resultado?codigo=${reserva.codigo_cita}&estado=transferencia`);
      }
    } catch (err) {
      setError(err.message);
      setEnviando(false);
      // Si la hora se tomo mientras decidia, vuelve a elegir hora
      if (err.status === 409 && /hora/i.test(err.message)) elegir({}, ["hora"]);
    }
  }

  return (
    <div className="pagina-marca">
      <BarraSitio />

      <main className="pagina-sitio reservar">
        <header className="seccion-cabecera cabecera-pagina">
          <p className="sobretitulo">Agenda tu hora</p>
          <h1 className="titulo-script">Reservar</h1>
        </header>

        <ol className="pasos-reserva" aria-label="Pasos de la reserva">
          {PASOS.map((nombre, i) => (
            <li key={nombre} className={i === paso ? "paso-actual" : i < paso ? "paso-hecho" : ""} aria-current={i === paso ? "step" : undefined}>
              {i < paso ? (
                <button type="button" onClick={() => irAPaso(i)}>
                  <span className="paso-circulo">✓</span>
                  <span className="paso-nombre">{nombre}</span>
                </button>
              ) : (
                <span>
                  <span className="paso-circulo">{i + 1}</span>
                  <span className="paso-nombre">{nombre}</span>
                </span>
              )}
            </li>
          ))}
        </ol>

        {servicio && paso > 0 && (
          <div className="resumen-eleccion">
            <IconoCategoria nombre={servicio.categoria} className="resumen-icono" />
            <div>
              <strong>
                {servicio.nombre}
                {variante && ` · ${variante.nombre}${variante.detalle ? ` (${variante.detalle})` : ""}`}
              </strong>
              <span>
                {formatearDuracion(servicio.duracion_minutos)} ·{" "}
                {servicio.tipo_precio === "DESDE" && !variante ? `desde ${formatearPrecio(precio)}` : formatearPrecio(precio)}
                {paso > 1 && ` · ${profesionalElegida ? profesionalElegida.nombre : "Cualquier profesional"}`}
                {paso > 2 && ` · ${fechaLarga(sel.fecha)}, ${sel.hora}`}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="aviso aviso-error" role="alert">
            <span>{error}</span>
          </div>
        )}

        {/* ---------- Paso 1: servicio ---------- */}
        {paso === 0 && servicio && faltaVariante && (
          <section aria-label="Elige el largo de tu cabello">
            <div className="resumen-eleccion">
              <IconoCategoria nombre={servicio.categoria} className="resumen-icono" />
              <div>
                <strong>{servicio.nombre}</strong>
                <span>{formatearDuracion(servicio.duracion_minutos)} · {textoPrecio(servicio)}</span>
              </div>
            </div>
            <h2 className="pregunta">¿Qué largo tiene tu cabello?</h2>
            <div className="opciones opciones-largo">
              {servicio.variantes.map((v) => (
                <button key={v.id_variante} type="button" className="opcion opcion-largo" onClick={() => elegir({ variante: v.id_variante })}>
                  <span className="largo-letra">{v.nombre}</span>
                  <span className="opcion-texto">
                    <strong>{v.detalle || `Largo ${v.nombre}`}</strong>
                  </span>
                  <span className="precio-pildora">{formatearPrecio(v.precio)}</span>
                </button>
              ))}
            </div>
            <p className="bloque-ayuda centrado">
              ¿Cabello extra largo o muy abundante (XXL)? El valor es según evaluación:{" "}
              <a href={enlaceWhatsApp(`Hola, quiero cotizar ${servicio.nombre} para cabello XXL.`)} target="_blank" rel="noreferrer">
                escríbenos por WhatsApp
              </a>
              .
            </p>
            <p className="centrado">
              <button type="button" className="boton-texto" onClick={() => irAPaso(0)}>
                ← Elegir otro servicio
              </button>
            </p>
          </section>
        )}

        {paso === 0 && !(servicio && faltaVariante) && (
          <section aria-label="Elige tu servicio">
            <h2 className="pregunta">¿Qué te quieres hacer?</h2>
            {servicios === null ? (
              <p className="estado-carga">Cargando servicios…</p>
            ) : (
              porCategoria.map(([categoria, lista]) => (
                <div key={categoria} className="grupo-reserva">
                  <h3 className="grupo-reserva-titulo">
                    <IconoCategoria nombre={categoria} className="grupo-reserva-icono" />
                    {categoria}
                  </h3>
                  <div className="opciones">
                    {lista.map((s) =>
                      s.tipo_precio === "EVALUACION" ? (
                        <a
                          key={s.id_servicio}
                          className="opcion opcion-evaluacion"
                          href={enlaceWhatsApp(`Hola, quiero cotizar ${s.nombre}. ¿Cuándo podría ir a una evaluación?`)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span className="opcion-texto">
                            <strong>{s.nombre}</strong>
                            <small>Según evaluación · se cotiza por WhatsApp</small>
                          </span>
                          <span className="precio-pildora precio-evaluacion">Cotizar</span>
                        </a>
                      ) : (
                        <button
                          key={s.id_servicio}
                          type="button"
                          className="opcion"
                          onClick={() => elegir({ servicio: s.id_servicio }, ["variante"])}
                        >
                          <span className="opcion-texto">
                            <strong>{s.nombre}</strong>
                            <small>
                              {formatearDuracion(s.duracion_minutos)}
                              {s.variantes?.length ? " · precio según largo" : ""}
                            </small>
                          </span>
                          <span className="precio-pildora">
                            {s.tipo_precio === "DESDE" || s.variantes?.length ? <small>Desde</small> : null}
                            {formatearPrecio(s.precio_desde ?? s.precio)}
                          </span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {/* ---------- Paso 2: profesional ---------- */}
        {paso === 1 && (
          <section aria-label="Elige profesional">
            <h2 className="pregunta">¿Con quién?</h2>
            {profesionales === null ? (
              <p className="estado-carga">Buscando profesionales…</p>
            ) : profesionales.length === 0 ? (
              <p className="estado-carga">Por ahora este servicio no tiene horas online. Escríbenos por WhatsApp.</p>
            ) : (
              <div className="opciones opciones-personas">
                <button type="button" className="opcion opcion-persona" onClick={() => elegir({ profesional: "cualquiera" })}>
                  <span className="persona-cualquiera">
                    <Loto />
                  </span>
                  <span className="opcion-texto">
                    <strong>La primera disponible</strong>
                    <small>Te mostramos todas las horas libres</small>
                  </span>
                </button>
                {profesionales.map((p) => (
                  <button key={p.id_profesional} type="button" className="opcion opcion-persona" onClick={() => elegir({ profesional: p.id_profesional })}>
                    <FotoPerfil profesional={equipo.find((e) => e.id_profesional === p.id_profesional) || { nombres: p.nombre, apellidos: "" }} tamano="mini" />
                    <span className="opcion-texto">
                      <strong>{p.nombre}</strong>
                      {equipo.find((e) => e.id_profesional === p.id_profesional)?.cargo && (
                        <small>{equipo.find((e) => e.id_profesional === p.id_profesional).cargo}</small>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ---------- Paso 3: dia y hora ---------- */}
        {paso === 2 && (
          <section aria-label="Elige día y hora">
            <h2 className="pregunta">¿Qué día y a qué hora?</h2>
            {dias === null ? (
              <p className="estado-carga">Buscando días disponibles…</p>
            ) : !dias.some((d) => d.disponibles > 0) ? (
              <p className="estado-carga">No quedan horas online en las próximas semanas. Escríbenos por WhatsApp.</p>
            ) : (
              <>
                <ul className="tira-dias tira-dias-grande">
                  {dias.map((d) => {
                    const f = new Date(`${d.fecha}T12:00:00`);
                    return (
                      <li key={d.fecha}>
                        <button
                          type="button"
                          className="tira-dia"
                          disabled={d.disponibles === 0}
                          aria-pressed={d.fecha === fechaActiva}
                          aria-label={`${fechaLarga(d.fecha)}${d.disponibles ? "" : ", sin horas"}`}
                          onClick={() => elegir({ fecha: d.fecha }, ["hora"])}
                        >
                          <span>{new Intl.DateTimeFormat("es-CL", { weekday: "short" }).format(f)}</span>
                          <strong>{f.getDate()}</strong>
                          <span>{new Intl.DateTimeFormat("es-CL", { month: "short" }).format(f)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {fechaActiva && <p className="dia-elegido">{fechaLarga(fechaActiva)}</p>}
                {horas === null ? (
                  <p className="estado-carga">Buscando horas…</p>
                ) : (
                  <div className="horas-reserva">
                    {horas.map((h) => (
                      <button key={h.hora} type="button" className="hora-boton" onClick={() => elegir({ fecha: fechaActiva, hora: h.hora })}>
                        {h.hora}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* ---------- Paso 4: confirmar ---------- */}
        {paso === 3 && servicio && (
          <section aria-label="Confirma tu reserva" className="confirmar">
            <h2 className="pregunta">Revisa y confirma</h2>

            <div className="confirmar-grilla">
              <div className="ticket">
                <p className="ticket-titulo">{servicio.nombre}</p>
                {variante && (
                  <p className="ticket-variante">
                    Largo {variante.nombre}
                    {variante.detalle ? ` · ${variante.detalle}` : ""}
                  </p>
                )}
                <dl>
                  <div><dt>Día</dt><dd>{fechaLarga(sel.fecha)}</dd></div>
                  <div><dt>Hora</dt><dd>{sel.hora} ({formatearDuracion(servicio.duracion_minutos)})</dd></div>
                  <div><dt>Profesional</dt><dd>{profesionalElegida ? profesionalElegida.nombre : "La primera disponible"}</dd></div>
                  <div>
                    <dt>Valor del servicio</dt>
                    <dd>{servicio.tipo_precio === "DESDE" ? `Desde ${formatearPrecio(precio)}` : formatearPrecio(precio)}</dd>
                  </div>
                  <div className="ticket-abono"><dt>Abono para reservar</dt><dd>{formatearPrecio(abono)}</dd></div>
                  <div>
                    <dt>Pagas en el salón</dt>
                    <dd>{servicio.tipo_precio === "DESDE" ? `Desde ${formatearPrecio(precio - abono)}` : formatearPrecio(precio - abono)}</dd>
                  </div>
                </dl>
                {servicio.tipo_precio === "DESDE" && (
                  <p className="ticket-nota">El valor final se confirma en el salón según tu caso, antes de comenzar.</p>
                )}
              </div>

              <div>
                {indicaciones.length > 0 && (
                  <div className="indicaciones antes-de-tu-cita">
                    <p className="notas-titulo">Antes de tu cita</p>
                    <ul>
                      {indicaciones.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="confirmar-subtitulo">¿Cómo pagas el abono?</p>
                <div className="metodos" role="radiogroup" aria-label="Método de pago del abono">
                  <label className={`metodo ${metodo === "WEBPAY" ? "metodo-activo" : ""}`}>
                    <input type="radio" name="metodo" checked={metodo === "WEBPAY"} onChange={() => setMetodo("WEBPAY")} />
                    <span>
                      <strong>Pagar ahora con tarjeta</strong>
                      <small>Débito o crédito en Webpay. Tu hora queda confirmada al instante.</small>
                    </span>
                  </label>
                  <label className={`metodo ${metodo === "TRANSFERENCIA" ? "metodo-activo" : ""}`}>
                    <input type="radio" name="metodo" checked={metodo === "TRANSFERENCIA"} onChange={() => setMetodo("TRANSFERENCIA")} />
                    <span>
                      <strong>Transferencia</strong>
                      <small>
                        Te guardamos la hora {reglas?.horasRetencionTransferencia ?? 2} horas y coordinamos el pago por WhatsApp.
                      </small>
                    </span>
                  </label>
                </div>

                <div className="campo">
                  <label htmlFor="res-notas">¿Algo que debamos saber? (opcional)</label>
                  <input id="res-notas" value={notas} maxLength={300} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: es mi primera vez" />
                </div>

                <div className="reglas reglas-compactas">
                  <p className="reglas-titulo">Reglas de agendamiento</p>
                  <ul>
                    <li>El abono se descuenta del total del servicio.</li>
                    <li>Cambio de hora solo con <strong>{reglas?.horasCambio ?? 48} horas</strong> de anticipación.</li>
                    <li className="regla-importante"><strong>¡Importante!</strong> Si no cumples el plazo, se pierde el abono.</li>
                  </ul>
                </div>
                <label className="interruptor aceptar">
                  <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
                  <span>
                    Leí y acepto las reglas de agendamiento{indicaciones.length > 0 ? " y las indicaciones del servicio" : ""}
                  </span>
                </label>

                {usuario && usuario.rol !== "Cliente" ? (
                  <p className="aviso aviso-error">Las reservas online se hacen con una cuenta de clienta.</p>
                ) : (
                  <button type="button" className="boton boton-cacao boton-reservar" onClick={confirmar} disabled={!acepta || enviando}>
                    {enviando
                      ? "Reservando…"
                      : !usuario
                      ? "Inicia sesión para reservar"
                      : metodo === "WEBPAY"
                      ? `Reservar y pagar ${formatearPrecio(abono)}`
                      : "Reservar y coordinar transferencia"}
                  </button>
                )}
                {!usuario && (
                  <p className="bloque-ayuda">
                    ¿No tienes cuenta? <Link to="/registro" state={{ desde: { pathname: "/reservar", search: `?${params.toString()}` } }}>Créala en un minuto</Link>. Tu elección queda guardada.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      <PieMarca />
    </div>
  );
}
