// src/pages/WhatsApp.jsx
// Panel del agente de WhatsApp (Administrador):
//  - Conversaciones: ver lo que escriben las clientas y responder como salón
//  - Simulador: probar el agente sin Meta (útil para la demo)
//  - Configuración: estado de la conexión, datos de transferencia
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, descargarMediaWhatsapp } from "../api/client";
import BarraSitio from "../components/marca/BarraSitio";
import SubnavPanel from "../components/marca/SubnavPanel";
import PieMarca from "../components/marca/PieMarca";
import "../styles/marca.css";
import "../styles/equipo.css";
import "../styles/integraciones.css";
import "../styles/whatsapp.css";

const PESTANAS = [
  { valor: "conversaciones", texto: "Conversaciones" },
  { valor: "simulador", texto: "Simulador" },
  { valor: "configuracion", texto: "Configuración" },
];

const TELEFONO_SIMULADOR = "56900000001";

// ---------------- utilidades ----------------

/** "56912345678" o "sim-56912345678" -> "+56 9 1234 5678" */
function formatoTelefono(telefono) {
  const d = String(telefono || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("569")) return `+56 9 ${d.slice(3, 7)} ${d.slice(7)}`;
  return d ? `+${d}` : "";
}

/** Fecha guardada en UTC ('AAAA-MM-DD HH:MM:SS') -> hora local legible */
function formatoFecha(utc, { conDia = false } = {}) {
  if (!utc) return "";
  const fecha = new Date(`${utc.replace(" ", "T")}Z`);
  const hoy = new Date().toDateString() === fecha.toDateString();
  return new Intl.DateTimeFormat("es-CL", {
    ...(conDia || !hoy ? { day: "numeric", month: "short" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
}

/** Negritas de WhatsApp (*texto*) y saltos de linea */
function TextoWhatsApp({ texto }) {
  return String(texto || "")
    .split("\n")
    .map((linea, i, todas) => (
      <Fragment key={i}>
        {linea.split(/(\*[^*\n]+\*)/g).map((parte, j) =>
          /^\*[^*]+\*$/.test(parte) ? <strong key={j}>{parte.slice(1, -1)}</strong> : <Fragment key={j}>{parte}</Fragment>
        )}
        {i < todas.length - 1 && <br />}
      </Fragment>
    ));
}

const ESTADOS_ENVIO = {
  enviado: "Enviado",
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
  failed: "No se pudo entregar",
  error: "No se pudo enviar",
  sin_conexion: "Sin conexión con Meta",
};

// ---------------- burbuja de mensaje ----------------

function Burbuja({ mensaje, onOpcion, token }) {
  const [listaAbierta, setListaAbierta] = useState(false);
  const [imagen, setImagen] = useState(null);
  const [errorImagen, setErrorImagen] = useState("");
  const c = mensaje.contenido || {};
  const entrada = mensaje.direccion === "entrada";
  const texto = entrada ? mensaje.texto : c.texto ?? mensaje.texto;

  async function verImagen() {
    try {
      setImagen(await descargarMediaWhatsapp(c.media_id, token));
    } catch (err) {
      setErrorImagen(err.message);
    }
  }

  const estado = !entrada && ESTADOS_ENVIO[mensaje.estado];
  const falla = ["error", "failed", "sin_conexion"].includes(mensaje.estado);

  return (
    <li className={`wa-burbuja ${entrada ? "wa-entrada" : "wa-salida"} ${mensaje.autor === "salon" ? "wa-salon" : ""}`}>
      {mensaje.autor === "salon" && <span className="wa-autor">Respuesta del salón</span>}
      <div className="wa-texto">
        <TextoWhatsApp texto={texto} />
      </div>

      {entrada && c.media_id && (
        <div className="wa-adjunto">
          {imagen ? (
            <a href={imagen} target="_blank" rel="noreferrer">
              <img src={imagen} alt="Archivo enviado por la clienta" />
            </a>
          ) : (
            <button type="button" className="boton-texto" onClick={verImagen}>
              Ver archivo
            </button>
          )}
          {errorImagen && <small className="wa-error">{errorImagen}</small>}
        </div>
      )}

      {!entrada && c.tipo === "botones" && (
        <div className="wa-botones">
          {c.botones.map((b) => (
            <button key={b.id} type="button" disabled={!onOpcion} onClick={() => onOpcion?.(b)}>
              {b.titulo}
            </button>
          ))}
        </div>
      )}

      {!entrada && c.tipo === "lista" && (
        <div className="wa-botones">
          <button type="button" onClick={() => setListaAbierta((a) => !a)} aria-expanded={listaAbierta}>
            {c.boton || "Ver opciones"}
          </button>
          {listaAbierta && (
            <ul className="wa-filas">
              {c.filas.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    disabled={!onOpcion}
                    onClick={() => {
                      setListaAbierta(false);
                      onOpcion?.(f);
                    }}
                  >
                    <strong>{f.titulo}</strong>
                    {f.descripcion && <small>{f.descripcion}</small>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!entrada && c.tipo === "enlace" && (
        <div className="wa-botones">
          <a href={c.url} target="_blank" rel="noreferrer">
            {c.boton}
          </a>
        </div>
      )}

      <span className={`wa-hora ${falla ? "wa-error" : ""}`} title={mensaje.error || undefined}>
        {formatoFecha(mensaje.fecha)}
        {estado && mensaje.estado !== "simulado" && ` · ${estado}`}
        {falla && mensaje.error && ` (${mensaje.error})`}
      </span>
    </li>
  );
}

function Historial({ mensajes, onOpcion, token, vacio }) {
  const fin = useRef(null);
  useEffect(() => {
    fin.current?.scrollIntoView({ block: "nearest" });
  }, [mensajes.length]);
  if (!mensajes.length) return <p className="wa-vacio">{vacio}</p>;
  return (
    <ul className="wa-historial">
      {mensajes.map((m) => (
        <Burbuja key={m.id_mensaje} mensaje={m} onOpcion={onOpcion} token={token} />
      ))}
      <li ref={fin} aria-hidden="true" />
    </ul>
  );
}

// ---------------- Conversaciones ----------------

function Conversaciones({ token, onAviso }) {
  const [lista, setLista] = useState([]);
  const [filtro, setFiltro] = useState("pendientes");
  const [verSimulador, setVerSimulador] = useState(false);
  const [activa, setActiva] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cargarLista = useCallback(async () => {
    try {
      setLista((await api.whatsappConversaciones(token)).datos);
    } catch (err) {
      onAviso({ tipo: "error", texto: err.message });
    }
  }, [token, onAviso]);

  const cargarDetalle = useCallback(async () => {
    if (!activa) return;
    try {
      setDetalle(await api.whatsappConversacion(activa, token));
    } catch (err) {
      onAviso({ tipo: "error", texto: err.message });
    }
  }, [activa, token, onAviso]);

  useEffect(() => {
    cargarLista();
    const id = setInterval(cargarLista, 8000);
    return () => clearInterval(id);
  }, [cargarLista]);

  useEffect(() => {
    setDetalle(null);
    cargarDetalle();
    const id = setInterval(cargarDetalle, 5000);
    return () => clearInterval(id);
  }, [cargarDetalle]);

  const visibles = lista
    .filter((c) => verSimulador || !c.simulador)
    .filter((c) => filtro === "todas" || c.pendiente_respuesta);
  const actual = lista.find((c) => c.telefono === activa);

  async function responder(e) {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      const r = await api.whatsappResponder(activa, texto.trim(), token);
      setDetalle((d) => ({ ...d, mensajes: r.mensajes, sesion: { ...d?.sesion, estado: "HUMANO", pendiente_respuesta: 0 } }));
      setTexto("");
      if (!r.ok) onAviso({ tipo: "error", texto: `El mensaje no salió: ${r.error}` });
      cargarLista();
    } catch (err) {
      onAviso({ tipo: "error", texto: err.message });
    } finally {
      setEnviando(false);
    }
  }

  async function devolverAlBot() {
    try {
      await api.whatsappDevolverAlBot(activa, token);
      onAviso({ tipo: "exito", texto: "Listo: el asistente vuelve a responder a esta clienta." });
      cargarDetalle();
      cargarLista();
    } catch (err) {
      onAviso({ tipo: "error", texto: err.message });
    }
  }

  async function marcarAtendida() {
    try {
      await api.whatsappMarcarAtendida(activa, token);
      cargarDetalle();
      cargarLista();
    } catch (err) {
      onAviso({ tipo: "error", texto: err.message });
    }
  }

  const enManos = detalle?.sesion?.estado === "HUMANO";

  return (
    <div className="wa-grilla">
      <section className="bloque wa-lista" aria-label="Conversaciones">
        <div className="wa-filtros" role="group" aria-label="Filtro">
          <button type="button" className="chip" aria-pressed={filtro === "pendientes"} onClick={() => setFiltro("pendientes")}>
            Por responder
          </button>
          <button type="button" className="chip" aria-pressed={filtro === "todas"} onClick={() => setFiltro("todas")}>
            Todas
          </button>
        </div>
        <label className="wa-check">
          <input type="checkbox" checked={verSimulador} onChange={(e) => setVerSimulador(e.target.checked)} />
          Mostrar pruebas del simulador
        </label>

        {visibles.length === 0 ? (
          <p className="wa-vacio">
            {filtro === "pendientes" ? "No hay clientas esperando respuesta." : "Aún no hay conversaciones."}
          </p>
        ) : (
          <ul className="wa-conversaciones">
            {visibles.map((c) => (
              <li key={c.telefono}>
                <button
                  type="button"
                  className={`wa-conv ${c.telefono === activa ? "wa-conv-activa" : ""}`}
                  onClick={() => setActiva(c.telefono)}
                >
                  <span className="wa-conv-nombre">
                    {c.nombre || c.nombre_perfil || formatoTelefono(c.telefono)}
                    {c.pendiente_respuesta ? <span className="wa-punto" aria-label="Por responder" /> : null}
                  </span>
                  <span className="wa-conv-meta">
                    {formatoTelefono(c.telefono)}
                    {c.simulador && " · simulador"}
                    {c.estado === "HUMANO" && " · atención humana"}
                  </span>
                  <span className="wa-conv-ultimo">{(c.ultimo_texto || "").split("\n")[0].replace(/\*/g, "")}</span>
                  <span className="wa-conv-hora">{formatoFecha(c.ultima_fecha)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bloque wa-chat" aria-label="Conversación">
        {!activa ? (
          <p className="wa-vacio">Elige una conversación para ver los mensajes y responder.</p>
        ) : (
          <>
            <header className="wa-chat-cabecera">
              <div>
                <h3>{actual?.nombre || actual?.nombre_perfil || formatoTelefono(activa)}</h3>
                <small>
                  {formatoTelefono(activa)} · {enManos ? "La atiende una persona (el asistente está en pausa)" : "La atiende el asistente"}
                </small>
              </div>
              <div className="wa-chat-acciones">
                {detalle?.sesion?.pendiente_respuesta ? (
                  <button type="button" className="boton boton-linea" onClick={marcarAtendida}>
                    Marcar como atendida
                  </button>
                ) : null}
                {enManos && (
                  <button type="button" className="boton boton-linea" onClick={devolverAlBot}>
                    Devolver al asistente
                  </button>
                )}
              </div>
            </header>

            <div className="wa-pantalla">
              <Historial mensajes={detalle?.mensajes || []} token={token} vacio="Cargando…" />
            </div>

            <form className="wa-responder" onSubmit={responder}>
              <label htmlFor="wa-respuesta" className="sr-only">
                Respuesta
              </label>
              <textarea
                id="wa-respuesta"
                rows={2}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escribe tu respuesta. Al enviarla, el asistente queda en pausa con esta clienta."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) responder(e);
                }}
              />
              <button type="submit" className="boton boton-cacao" disabled={enviando || !texto.trim()}>
                {enviando ? "Enviando…" : "Enviar"}
              </button>
            </form>
            <p className="bloque-ayuda">
              WhatsApp solo permite responder dentro de las 24 horas siguientes al último mensaje de la clienta.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

// ---------------- Simulador ----------------

function Simulador({ token, onAviso }) {
  const [telefono, setTelefono] = useState(TELEFONO_SIMULADOR);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const valido = /^\d{8,15}$/.test(telefono);

  useEffect(() => {
    if (!valido) return;
    api
      .whatsappSimulacion(telefono, token)
      .then((r) => setMensajes(r.mensajes))
      .catch(() => {});
  }, [telefono, valido, token]);

  async function enviar(payload) {
    if (!valido) return;
    setOcupado(true);
    try {
      const r = await api.whatsappSimular({ telefono, ...payload }, token);
      setMensajes(r.mensajes);
    } catch (err) {
      onAviso({ tipo: "error", texto: err.message });
    } finally {
      setOcupado(false);
    }
  }

  async function reiniciar() {
    try {
      await api.whatsappReiniciarSimulacion(telefono, token);
      setMensajes([]);
    } catch (err) {
      onAviso({ tipo: "error", texto: err.message });
    }
  }

  return (
    <div className="wa-sim-grilla">
      <section className="bloque">
        <h3>Probar el asistente</h3>
        <p className="bloque-ayuda">
          Escribe como si fueras una clienta. Las reservas que hagas aquí son reales en la agenda (puedes
          cancelarlas después), pero ningún mensaje sale por WhatsApp.
        </p>
        <div className="campo">
          <label htmlFor="sim-tel">Número de la clienta (con 56, solo dígitos)</label>
          <input
            id="sim-tel"
            inputMode="numeric"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ""))}
          />
          <small className="bloque-ayuda">
            Si usas el teléfono de una clienta registrada, el asistente la reconoce y muestra sus citas.
          </small>
        </div>
        <div className="bloque-acciones wa-sim-acciones">
          <button type="button" className="boton boton-linea" onClick={() => enviar({ tipo: "imagen" })} disabled={ocupado || !valido}>
            Enviar foto de comprobante
          </button>
          <button type="button" className="boton boton-linea" onClick={reiniciar} disabled={ocupado || !valido}>
            Empezar de nuevo
          </button>
        </div>
        <p className="bloque-ayuda">
          Prueba escribir: <em>hola</em>, <em>quiero reservar</em>, <em>precios</em>, <em>mis citas</em>,{" "}
          <em>horario</em>, <em>hablar con una persona</em> o un número del menú.
        </p>
      </section>

      <section className="wa-telefono" aria-label="Simulador de WhatsApp">
        <header className="wa-telefono-barra">
          <span className="wa-avatar" aria-hidden="true">
            N
          </span>
          <div>
            <strong>Nicolett Studio Fantasy</strong>
            <small>{ocupado ? "escribiendo…" : "asistente virtual"}</small>
          </div>
        </header>
        <div className="wa-pantalla">
          <Historial
            mensajes={mensajes}
            token={token}
            onOpcion={ocupado ? null : (op) => enviar({ id_opcion: op.id, texto: op.titulo })}
            vacio="Escribe “hola” para empezar."
          />
        </div>
        <form
          className="wa-responder"
          onSubmit={(e) => {
            e.preventDefault();
            if (!texto.trim()) return;
            enviar({ texto: texto.trim() });
            setTexto("");
          }}
        >
          <label htmlFor="sim-texto" className="sr-only">
            Mensaje
          </label>
          <input id="sim-texto" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Mensaje" autoComplete="off" />
          <button type="submit" className="boton boton-cacao" disabled={ocupado || !texto.trim() || !valido}>
            Enviar
          </button>
        </form>
      </section>
    </div>
  );
}

// ---------------- Configuracion ----------------

function Configuracion({ token, estado, onRecargar, onAviso }) {
  const [datos, setDatos] = useState(estado.datosTransferencia || "");
  const [horas, setHoras] = useState(estado.horasAtencionHumana || 24);
  const [guardando, setGuardando] = useState(false);
  const [prueba, setPrueba] = useState(null);
  const [probando, setProbando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      await api.whatsappGuardarConfig({ datosTransferencia: datos, horasAtencionHumana: Number(horas) }, token);
      onAviso({ tipo: "exito", texto: "Configuración guardada" });
      onRecargar();
    } catch (err) {
      onAviso({ tipo: "error", texto: err.detalles?.[0]?.mensaje || err.message });
    } finally {
      setGuardando(false);
    }
  }

  async function probar() {
    setProbando(true);
    try {
      setPrueba(await api.whatsappProbar(token));
    } catch (err) {
      setPrueba({ ok: false, error: err.message });
    } finally {
      setProbando(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(estado.urlWebhook);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* la URL sigue visible para copiarla a mano */
    }
  }

  const Fila = ({ ok, children }) => <li className={ok ? "wa-ok" : "wa-falta"}>{children}</li>;

  return (
    <div className="integ-grilla wa-config">
      <section className="bloque">
        <h3>Conexión con WhatsApp</h3>
        <ul className="wa-revision">
          <Fila ok={estado.conectado}>
            {estado.conectado
              ? `Credenciales de Meta cargadas (número terminado en …${estado.idNumeroFinal})`
              : "Faltan WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID en el .env (mientras tanto, usa el simulador)"}
          </Fila>
          <Fila ok={estado.tokenVerificacionDefinido}>
            {estado.tokenVerificacionDefinido ? "Token de verificación definido" : "Falta WHATSAPP_VERIFY_TOKEN en el .env"}
          </Fila>
          <Fila ok={estado.secretoAppDefinido}>
            {estado.secretoAppDefinido
              ? "Clave secreta de la app definida (se comprueba que los avisos vienen de Meta)"
              : "Falta WHATSAPP_APP_SECRET: sin ella cualquiera podría enviar avisos falsos al webhook"}
          </Fila>
          <Fila ok={estado.backendPublico}>
            {estado.backendPublico
              ? "BACKEND_URL es pública"
              : "BACKEND_URL apunta a localhost: Meta y el celular de la clienta no pueden llegar (usa ngrok en las pruebas)"}
          </Fila>
        </ul>

        <p className="bloque-ayuda">URL del webhook para configurar en Meta:</p>
        <div className="integ-correo">
          <code>{estado.urlWebhook}</code>
          <button type="button" className="boton-texto" onClick={copiar}>
            {copiado ? "¡Copiada!" : "Copiar"}
          </button>
        </div>

        <div className="bloque-acciones">
          <button type="button" className="boton boton-cacao" onClick={probar} disabled={probando || !estado.conectado}>
            {probando ? "Probando…" : "Probar conexión"}
          </button>
        </div>
        {prueba &&
          (prueba.ok ? (
            <p className="integ-ok">
              Conectado a {prueba.numero} ({prueba.nombre}).
            </p>
          ) : (
            <p className="integ-error">{prueba.error}</p>
          ))}
        <p className="bloque-ayuda">Los pasos para obtener las credenciales están en el README, sección “Agente de WhatsApp”.</p>
      </section>

      <form className="bloque" onSubmit={guardar}>
        <h3>Lo que responde el asistente</h3>
        <div className="campo">
          <label htmlFor="wa-datos">Datos para transferir el abono</label>
          <textarea
            id="wa-datos"
            rows={6}
            maxLength={800}
            value={datos}
            onChange={(e) => setDatos(e.target.value)}
            placeholder="Ej.: banco, tipo de cuenta, número de cuenta, nombre, RUT y correo para enviar el comprobante"
          />
          <small className="bloque-ayuda">
            Se envían a la clienta cuando elige pagar por transferencia. Si lo dejas vacío, el asistente le dice que
            el salón le escribirá con los datos y la conversación queda “por responder”.
          </small>
        </div>
        <div className="campo">
          <label htmlFor="wa-horas">Horas que el asistente queda en pausa cuando atiende una persona</label>
          <input id="wa-horas" type="number" min={1} max={168} value={horas} onChange={(e) => setHoras(e.target.value)} />
        </div>
        <div className="bloque-acciones">
          <button type="submit" className="boton boton-cacao" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------- Pagina ----------------

export default function WhatsApp() {
  const { token } = useAuth();
  const [pestana, setPestana] = useState("conversaciones");
  const [estado, setEstado] = useState(null);
  const [aviso, setAviso] = useState(null);

  const cargarEstado = useCallback(() => {
    api
      .whatsappEstado(token)
      .then(setEstado)
      .catch((err) => setAviso({ tipo: "error", texto: err.message }));
  }, [token]);

  useEffect(() => {
    cargarEstado();
  }, [cargarEstado]);

  return (
    <div className="pagina-marca">
      <BarraSitio />
      <SubnavPanel />

      <main className="equipo whatsapp">
        <header className="equipo-cabecera">
          <h1>WhatsApp</h1>
          <p>
            El asistente responde solo a las clientas: reserva horas, muestra sus citas, precios y horario. Cuando
            alguien pide hablar con una persona, la conversación aparece aquí para que la respondas.
          </p>
          {estado && (
            <p className={`wa-estado ${estado.conectado ? "wa-estado-ok" : ""}`}>
              {estado.conectado ? "Conectado a WhatsApp" : "Modo prueba: sin conexión con Meta, usa el simulador"}
              {estado.pendientes > 0 && ` · ${estado.pendientes} por responder`}
            </p>
          )}
        </header>

        {aviso && (
          <div className={`aviso aviso-${aviso.tipo}`} role={aviso.tipo === "error" ? "alert" : "status"}>
            <span>{aviso.texto}</span>
            <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
              ×
            </button>
          </div>
        )}

        <div className="wa-pestanas" role="tablist" aria-label="Secciones de WhatsApp">
          {PESTANAS.map((p) => (
            <button
              key={p.valor}
              type="button"
              role="tab"
              className="chip"
              aria-selected={pestana === p.valor}
              aria-pressed={pestana === p.valor}
              onClick={() => setPestana(p.valor)}
            >
              {p.texto}
            </button>
          ))}
        </div>

        {pestana === "conversaciones" && <Conversaciones token={token} onAviso={setAviso} />}
        {pestana === "simulador" && <Simulador token={token} onAviso={setAviso} />}
        {pestana === "configuracion" &&
          (estado ? (
            <Configuracion token={token} estado={estado} onRecargar={cargarEstado} onAviso={setAviso} />
          ) : (
            <p className="equipo-estado">Revisando conexión…</p>
          ))}
      </main>

      <PieMarca />
    </div>
  );
}
