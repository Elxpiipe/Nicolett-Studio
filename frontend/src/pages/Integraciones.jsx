import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import BarraSitio from "../components/marca/BarraSitio";
import SubnavPanel from "../components/marca/SubnavPanel";
import PieMarca from "../components/marca/PieMarca";
import "../styles/marca.css";
import "../styles/equipo.css";
import "../styles/integraciones.css";

const MODOS = [
  {
    valor: "desactivado",
    titulo: "Sin conexión",
    texto: "El sistema usa solo su propia agenda.",
  },
  {
    valor: "compartido",
    titulo: "Un calendario para todo el salón",
    texto:
      "Las citas se anotan en un solo calendario. Un evento anotado a mano bloquea a la profesional que nombre en el título; si no nombra a nadie, bloquea a todo el salón.",
  },
  {
    valor: "por_profesional",
    titulo: "Un calendario por profesional",
    texto: "Cada profesional tiene su propio calendario. Su ID se configura en Equipo y horarios.",
  },
];

export default function Integraciones() {
  const { token } = useAuth();
  const [estado, setEstado] = useState(null);
  const [modo, setModo] = useState("desactivado");
  const [calendario, setCalendario] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [pruebas, setPruebas] = useState([]);
  const [ocupacion, setOcupacion] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [nombres, setNombres] = useState({}); // id_profesional -> nombre

  function aplicarEstado(e) {
    setEstado(e);
    setModo(e.modo);
    setCalendario(e.calendarioCompartido || "");
  }

  useEffect(() => {
    api
      .estadoGoogle(token)
      .then(aplicarEstado)
      .catch((err) => setAviso({ tipo: "error", texto: err.message }));
    api
      .listarProfesionales(token)
      .then((res) =>
        setNombres(Object.fromEntries(res.datos.map((p) => [p.id_profesional, `${p.nombres} ${p.apellidos}`])))
      )
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setAviso(null);
    try {
      const nuevo = await api.guardarGoogle({ modo, calendarioCompartido: calendario }, token);
      aplicarEstado(nuevo);
      const conError = nuevo.calendarios.filter((c) => !c.ok);
      setAviso(
        conError.length
          ? { tipo: "error", texto: `Guardado, pero hay un problema: ${conError[0].error}` }
          : { tipo: "exito", texto: "Configuración guardada" }
      );
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    } finally {
      setGuardando(false);
    }
  }

  async function probar() {
    setProbando(true);
    setAviso(null);
    try {
      const res = await api.probarGoogle(token);
      setPruebas(res.resultados);
      const ok = res.resultados.filter((r) => r.ok).length;
      setAviso(
        ok === res.resultados.length
          ? { tipo: "exito", texto: "Evento de prueba creado. Revisa tu Google Calendar: debería aparecer en unos segundos." }
          : { tipo: "error", texto: res.resultados.find((r) => !r.ok)?.error }
      );
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    } finally {
      setProbando(false);
    }
  }

  async function borrarPrueba(p) {
    try {
      await api.borrarPruebaGoogle({ calendarId: p.calendarId, eventId: p.eventId }, token);
      setPruebas((lista) => lista.filter((x) => x.eventId !== p.eventId));
      setAviso({ tipo: "exito", texto: "Evento de prueba eliminado de Google Calendar" });
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    }
  }

  async function verOcupacion() {
    try {
      setOcupacion(await api.ocupacionGoogle(token));
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    }
  }

  async function copiarCorreo() {
    try {
      await navigator.clipboard.writeText(estado.cuentaServicio);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* el correo sigue visible para copiarlo a mano */
    }
  }

  const eventosLeidos = ocupacion
    ? [
        ...ocupacion.general.map((e) => ({ ...e, quien: "Todo el salón" })),
        ...Object.entries(ocupacion.porProfesional).flatMap(([id, lista]) =>
          lista.map((e) => ({ ...e, quien: nombres[id] || `Profesional #${id}` }))
        ),
      ].sort((a, b) => a.fecha_hora_inicio.localeCompare(b.fecha_hora_inicio))
    : [];

  return (
    <div className="pagina-marca">
      <BarraSitio />
      <SubnavPanel />

      <main className="equipo">
        <header className="equipo-cabecera">
          <h1>Google Calendar</h1>
          <p>
            Conecta la agenda con el calendario de la clienta: las citas de la web aparecen en
            Google, y lo que ella anote a mano en Google se bloquea en la web.
          </p>
        </header>

        {aviso && (
          <div className={`aviso aviso-${aviso.tipo}`} role={aviso.tipo === "error" ? "alert" : "status"}>
            <span>{aviso.texto}</span>
            <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
              ×
            </button>
          </div>
        )}

        {!estado ? (
          <p className="equipo-estado">Revisando conexión…</p>
        ) : (
          <div className="integ-grilla">
            {/* ---------- Paso 1: credenciales ---------- */}
            <section className="bloque">
              <p className="integ-paso">Paso 1</p>
              <h3>Cuenta de servicio</h3>
              {estado.credencialesCargadas ? (
                <>
                  <p className="integ-ok">Credenciales cargadas correctamente.</p>
                  <p className="bloque-ayuda">
                    Comparte el calendario con este correo, con el permiso{" "}
                    <strong>“Hacer cambios en eventos”</strong>:
                  </p>
                  <div className="integ-correo">
                    <code>{estado.cuentaServicio}</code>
                    <button type="button" className="boton-texto" onClick={copiarCorreo}>
                      {copiado ? "¡Copiado!" : "Copiar"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="integ-pendiente">Aún no hay credenciales en el servidor.</p>
                  <p className="bloque-ayuda">
                    Descarga la clave JSON de la cuenta de servicio desde Google Cloud y guárdala en{" "}
                    <code>backend/credenciales/google-service-account.json</code>. Luego reinicia el
                    backend. Los pasos detallados están en el README, sección “Conectar Google Calendar”.
                  </p>
                </>
              )}
              {estado.error && <p className="integ-error">{estado.error}</p>}
            </section>

            {/* ---------- Paso 2: modo ---------- */}
            <form className="bloque" onSubmit={guardar}>
              <p className="integ-paso">Paso 2</p>
              <h3>¿Cómo usa el calendario el salón?</h3>
              <div className="integ-modos" role="radiogroup" aria-label="Modo de calendario">
                {MODOS.map((m) => (
                  <label key={m.valor} className={`integ-modo ${modo === m.valor ? "integ-modo-activo" : ""}`}>
                    <input
                      type="radio"
                      name="modo"
                      value={m.valor}
                      checked={modo === m.valor}
                      onChange={() => setModo(m.valor)}
                    />
                    <span>
                      <strong>{m.titulo}</strong>
                      <small>{m.texto}</small>
                    </span>
                  </label>
                ))}
              </div>

              {modo === "compartido" && (
                <div className="campo">
                  <label htmlFor="cal-id">ID del calendario</label>
                  <input
                    id="cal-id"
                    value={calendario}
                    onChange={(e) => setCalendario(e.target.value)}
                    placeholder="nicolettstudio86@gmail.com"
                    required
                  />
                  <small className="bloque-ayuda">
                    Si es el calendario principal de la cuenta, el ID es el mismo correo de Gmail. Si es
                    otro calendario, está en Google Calendar → Configuración → “Integrar el calendario”.
                  </small>
                </div>
              )}

              {modo === "por_profesional" && (
                <p className="bloque-ayuda">
                  Ingresa el ID del calendario de cada profesional en{" "}
                  <Link to="/panel/equipo">Equipo y horarios</Link> → Calendario de Google.
                </p>
              )}

              <div className="bloque-acciones">
                <button type="submit" className="boton boton-cacao" disabled={guardando}>
                  {guardando ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>

            {/* ---------- Paso 3: comprobar ---------- */}
            {estado.modo !== "desactivado" && (
              <section className="bloque integ-ancho">
                <p className="integ-paso">Paso 3</p>
                <h3>Comprobar la conexión</h3>

                {estado.calendarios.length === 0 ? (
                  <p className="bloque-ayuda">Aún no hay calendarios configurados.</p>
                ) : (
                  <ul className="integ-calendarios">
                    {estado.calendarios.map((c) => (
                      <li key={c.calendarId} className={c.ok ? "cal-ok" : "cal-error"}>
                        <span className="cal-punto" aria-hidden="true" />
                        <div>
                          <strong>{c.etiqueta}</strong>
                          <small>{c.calendarId}</small>
                          {c.ok ? (
                            <small>
                              Conectado a “{c.nombre}” ({c.zonaHoraria})
                            </small>
                          ) : (
                            <small className="integ-error">{c.error}</small>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="integ-acciones">
                  <button
                    type="button"
                    className="boton boton-cacao"
                    onClick={probar}
                    disabled={probando || !estado.credencialesCargadas}
                  >
                    {probando ? "Creando…" : "Crear evento de prueba"}
                  </button>
                  <button
                    type="button"
                    className="boton boton-linea"
                    onClick={verOcupacion}
                    disabled={!estado.credencialesCargadas}
                  >
                    Ver lo que se está leyendo de Google
                  </button>
                </div>

                {pruebas.filter((p) => p.ok).length > 0 && (
                  <ul className="integ-pruebas">
                    {pruebas
                      .filter((p) => p.ok)
                      .map((p) => (
                        <li key={p.eventId}>
                          <a href={p.htmlLink} target="_blank" rel="noreferrer">
                            Abrir el evento en Google Calendar
                          </a>
                          <button type="button" className="boton-texto" onClick={() => borrarPrueba(p)}>
                            Eliminar evento de prueba
                          </button>
                        </li>
                      ))}
                  </ul>
                )}

                {ocupacion && (
                  <div className="integ-ocupacion">
                    {ocupacion.error ? (
                      <p className="integ-error">{ocupacion.error}</p>
                    ) : eventosLeidos.length === 0 ? (
                      <p className="bloque-ayuda">
                        No hay eventos anotados a mano en los próximos días. Crea uno en Google Calendar
                        y vuelve a revisar: esas horas dejarán de ofrecerse en la web.
                      </p>
                    ) : (
                      <>
                        <p className="bloque-ayuda">
                          Estos eventos de Google bloquean horas en la web (las citas creadas por el
                          sistema no se muestran aquí):
                        </p>
                        <table className="integ-tabla">
                          <thead>
                            <tr>
                              <th>Evento</th>
                              <th>Desde</th>
                              <th>Hasta</th>
                              <th>Bloquea a</th>
                            </tr>
                          </thead>
                          <tbody>
                            {eventosLeidos.map((e, i) => (
                              <tr key={i}>
                                <td>{e.titulo || "(sin título)"}</td>
                                <td>{e.fecha_hora_inicio}</td>
                                <td>{e.fecha_hora_fin}</td>
                                <td>{e.quien}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>

      <PieMarca />
    </div>
  );
}
