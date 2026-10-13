// Panel del Administrador: reservas (confirmar transferencias) y pedidos de la tienda.
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, urlImagen } from "../api/client";
import { formatearPrecio } from "../utils/formato";
import BarraSitio from "../components/marca/BarraSitio";
import SubnavPanel from "../components/marca/SubnavPanel";
import PieMarca from "../components/marca/PieMarca";
import { IconoCategoria, IconoWhatsApp, Loto } from "../components/marca/Iconos";
import Hoja from "../components/marca/Hoja";
import { fechaLarga } from "./Reservar";
import "../styles/marca.css";
import "../styles/equipo.css";
import "../styles/gestion.css";
import "../styles/cuenta.css";
import "../styles/catalogo.css";

function hoyChile() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" }).format(new Date());
}

/** Link de WhatsApp a la clienta (telefono chileno en cualquier formato) */
function whatsappClienta(telefono, mensaje) {
  if (!telefono) return null;
  let n = telefono.replace(/\D/g, "");
  if (n.length === 9) n = `56${n}`;
  return `https://wa.me/${n}?text=${encodeURIComponent(mensaje)}`;
}

function Estado({ texto, tono }) {
  return <span className={`estado estado-${tono}`}>{texto}</span>;
}

function Pagina({ titulo, bajada, filtros, filtro, setFiltro, aviso, setAviso, children }) {
  return (
    <div className="pagina-marca">
      <BarraSitio />
      <SubnavPanel />
      <main className="equipo">
        <header className="equipo-cabecera">
          <h1>{titulo}</h1>
          <p>{bajada}</p>
        </header>
        <div className="filtros-gestion" role="group" aria-label="Filtros">
          {filtros.map((f) => (
            <button key={f.valor} type="button" className="chip" aria-pressed={filtro === f.valor} onClick={() => setFiltro(f.valor)}>
              {f.texto}
            </button>
          ))}
        </div>
        {aviso && (
          <div className={`aviso aviso-${aviso.tipo}`} role={aviso.tipo === "error" ? "alert" : "status"}>
            <span>{aviso.texto}</span>
            <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">×</button>
          </div>
        )}
        {children}
      </main>
      <PieMarca />
    </div>
  );
}

/* ================= Reservas ================= */

const FILTROS_RESERVAS = [
  { valor: "por_confirmar", texto: "Transferencias por confirmar" },
  { valor: "proximas", texto: "Próximas confirmadas" },
  { valor: "revision", texto: "Canceladas" },
  { valor: "clientas", texto: "Clientas" },
];

export function GestionReservas() {
  const { token } = useAuth();
  const [filtro, setFiltro] = useState("por_confirmar");
  const [datos, setDatos] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [confirmando, setConfirmando] = useState(null); // codigo en edicion
  const [referencia, setReferencia] = useState("");

  async function cargar() {
    if (filtro === "clientas") return; // la pestana Clientas carga lo suyo
    setDatos(null);
    const filtros =
      filtro === "por_confirmar"
        ? { estado: "PENDIENTE_ABONO", metodo_abono: "TRANSFERENCIA" }
        : filtro === "proximas"
        ? { estado: "CONFIRMADA", desde: hoyChile() }
        : { estado: "CANCELADA" };
    try {
      const res = await api.listarReservas(filtros, token);
      // Canceladas: primero las que requieren accion (pagaron y la hora estaba tomada)
      setDatos(
        filtro === "revision"
          ? res.datos.sort((a, b) => (b.estado_abono === "APROBADO") - (a.estado_abono === "APROBADO"))
          : res.datos
      );
    } catch (err) {
      setDatos([]);
      setAviso({ tipo: "error", texto: err.message });
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  async function confirmar(r) {
    try {
      await api.confirmarAbono(r.codigo_cita, referencia, token);
      setAviso({ tipo: "exito", texto: `Abono de ${r.cliente} confirmado: la hora quedó CONFIRMADA.` });
      setConfirmando(null);
      setReferencia("");
      cargar();
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    }
  }

  return (
    <Pagina
      titulo="Reservas"
      bajada="Confirma las transferencias de abono y revisa las próximas citas."
      filtros={FILTROS_RESERVAS}
      filtro={filtro}
      setFiltro={setFiltro}
      aviso={aviso}
      setAviso={setAviso}
    >
      {filtro === "clientas" ? (
        <ListaClientas token={token} />
      ) : datos === null ? (
        <p className="equipo-estado">Cargando…</p>
      ) : datos.length === 0 ? (
        <p className="gestion-vacio">
          {filtro === "por_confirmar" ? "No hay transferencias esperando confirmación." : "No hay reservas en esta lista."}
        </p>
      ) : (
        <ul className="gestion-lista">
          {datos.map((r) => {
            const wsp = whatsappClienta(
              r.telefono_cliente,
              `Hola ${r.cliente.split(" ")[0]}, te escribimos de Nicolett Studio Fantasy por tu reserva ${r.codigo_cita}.`
            );
            const accionPendiente = r.estado === "CANCELADA" && r.estado_abono === "APROBADO";
            return (
              <li key={r.codigo_cita} className={`gestion-item ${accionPendiente ? "gestion-alerta" : ""}`}>
                <div className="gestion-fecha">
                  <strong>{r.fecha_hora_inicio.slice(11)}</strong>
                  <span>{fechaLarga(r.fecha_hora_inicio.slice(0, 10))}</span>
                </div>
                <div className="gestion-cuerpo">
                  <p className="gestion-titulo">
                    {r.servicio} <small>con {r.profesional}</small>
                  </p>
                  <p className="gestion-meta">
                    {r.cliente} · {r.telefono_cliente || r.email_cliente} · <code>{r.codigo_cita}</code>
                  </p>
                  <p className="gestion-meta">
                    Abono {formatearPrecio(r.monto_abono)} ({r.metodo_abono === "WEBPAY" ? "Webpay" : "transferencia"}) ·
                    saldo {formatearPrecio(r.saldo)}
                  </p>
                  {r.notas_cliente && <p className="gestion-nota">“{r.notas_cliente}”</p>}
                  {r.estado === "CANCELADA" && <p className="gestion-nota">{r.motivo_cancelacion}</p>}
                </div>
                <div className="gestion-acciones">
                  {r.estado === "PENDIENTE_ABONO" && (
                    <Estado tono={r.vencida ? "error" : "espera"} texto={r.vencida ? "Plazo vencido" : `Apartada hasta ${r.fecha_expiracion_abono?.slice(11)}`} />
                  )}
                  {r.estado === "CONFIRMADA" && <Estado tono="ok" texto="Confirmada" />}
                  {accionPendiente && <Estado tono="error" texto="Pagó: reagendar o devolver" />}
                  {r.estado === "CANCELADA" && !accionPendiente && <Estado tono="neutro" texto="Cancelada" />}

                  {r.estado === "PENDIENTE_ABONO" &&
                    (confirmando === r.codigo_cita ? (
                      <div className="confirmar-abono">
                        <input
                          value={referencia}
                          onChange={(e) => setReferencia(e.target.value)}
                          placeholder="N° de operación (opcional)"
                          maxLength={100}
                          aria-label="Número de operación de la transferencia"
                        />
                        <button type="button" className="boton boton-cacao boton-chico" onClick={() => confirmar(r)}>
                          Confirmar {formatearPrecio(r.monto_abono)}
                        </button>
                        <button type="button" className="boton-texto" onClick={() => setConfirmando(null)}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="boton boton-cacao boton-chico" onClick={() => setConfirmando(r.codigo_cita)}>
                        Llegó la transferencia
                      </button>
                    ))}
                  {wsp && (
                    <a href={wsp} target="_blank" rel="noreferrer" className="boton-texto gestion-wsp">
                      <IconoWhatsApp className="boton-icono" /> Escribirle
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Pagina>
  );
}

/* ================= Clientas: listado e historial ================= */

const ESTADO_CITA = {
  ATENDIDA: { texto: "Atendida", tono: "ok" },
  CONFIRMADA: { texto: "Confirmada", tono: "espera" },
  PENDIENTE_ABONO: { texto: "Esperando abono", tono: "espera" },
  NO_ASISTE: { texto: "No asistió", tono: "error" },
  CANCELADA: { texto: "Cancelada", tono: "neutro" },
};

function ListaClientas({ token }) {
  const [busqueda, setBusqueda] = useState("");
  const [clientas, setClientas] = useState(null);
  const [abierta, setAbierta] = useState(null);

  useEffect(() => {
    // Espera a que termine de escribir antes de buscar
    const t = setTimeout(() => {
      api
        .listarClientes(busqueda.trim(), token)
        .then((r) => setClientas(r.datos))
        .catch(() => setClientas([]));
    }, 250);
    return () => clearTimeout(t);
  }, [busqueda, token]);

  // Agrupadas por inicial: A, B, C...
  const grupos = new Map();
  for (const c of clientas || []) {
    const letra = (c.nombres[0] || "#").toUpperCase();
    if (!grupos.has(letra)) grupos.set(letra, []);
    grupos.get(letra).push(c);
  }

  return (
    <div className="clientas">
      <input
        type="search"
        className="clientas-buscar"
        placeholder="Buscar por nombre, correo o teléfono…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        aria-label="Buscar clienta"
      />
      {clientas === null ? (
        <p className="equipo-estado">Cargando clientas…</p>
      ) : clientas.length === 0 ? (
        <p className="gestion-vacio">{busqueda ? "No hay clientas con esa búsqueda." : "Aún no hay clientas registradas."}</p>
      ) : (
        <>
          <p className="bloque-ayuda">{clientas.length} clienta(s). Haz clic en un nombre para ver su historial.</p>
          {[...grupos].map(([letra, lista]) => (
            <section key={letra} className="clientas-grupo" aria-label={`Clientas con ${letra}`}>
              <h3 className="clientas-letra">{letra}</h3>
              <ul className="clientas-lista">
                {lista.map((c) => (
                  <li key={c.id_cliente}>
                    <button type="button" className="clienta-boton" onClick={() => setAbierta(c.id_cliente)}>
                      <span className="clienta-nombre">
                        {c.nombres} {c.apellidos}
                      </span>
                      <span className="clienta-meta">
                        {c.total_citas ? `${c.total_citas} cita(s)` : "Sin citas"}
                        {c.ultima_cita ? ` · última ${c.ultima_cita.slice(0, 10).split("-").reverse().join("/")}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
      {abierta && (
        <Hoja titulo="Historial de la clienta" onCerrar={() => setAbierta(null)} ancho="ancha">
          <FichaClienta id={abierta} token={token} />
        </Hoja>
      )}
    </div>
  );
}

function FichaClienta({ id, token }) {
  const [ficha, setFicha] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .fichaCliente(id, token)
      .then(setFicha)
      .catch((err) => setError(err.message));
  }, [id, token]);

  if (error) return <p className="aviso aviso-error">{error}</p>;
  if (!ficha) return <p className="bloque-ayuda">Cargando historial…</p>;
  const { cliente: c, resumen: r, citas, pedidos } = ficha;
  const wsp = whatsappClienta(c.telefono, `Hola ${c.nombres.split(" ")[0]}, te escribimos de Nicolett Studio Fantasy.`);

  return (
    <div className="ficha-clienta">
      <p className="editor-sobretitulo">Clienta desde {c.fecha_creacion?.slice(0, 10).split("-").reverse().join("/")}</p>
      <h2 className="editor-titulo">
        {c.nombres} {c.apellidos}
      </h2>
      <p className="ficha-contacto">
        {c.email}
        {c.telefono && ` · ${c.telefono}`}
        {wsp && (
          <a href={wsp} target="_blank" rel="noreferrer" className="boton-texto gestion-wsp">
            <IconoWhatsApp className="boton-icono" /> Escribirle
          </a>
        )}
      </p>

      <div className="ficha-resumen">
        <div><strong>{r.atendidas}</strong><span>atendidas</span></div>
        <div><strong>{r.proximas}</strong><span>próximas</span></div>
        <div><strong>{r.no_asistio}</strong><span>no asistió</span></div>
        <div><strong>{r.canceladas}</strong><span>canceladas</span></div>
        <div><strong>{formatearPrecio(r.total_servicios + r.total_tienda)}</strong><span>total en el salón</span></div>
      </div>
      {r.servicio_favorito && <p className="bloque-ayuda">Servicio más frecuente: <strong>{r.servicio_favorito}</strong></p>}

      <h3 className="ficha-subtitulo">Historial de citas</h3>
      {citas.length === 0 ? (
        <p className="bloque-ayuda">Aún no tiene citas.</p>
      ) : (
        <ul className="historial">
          {citas.map((ci) => {
            const e = ESTADO_CITA[ci.estado] || { texto: ci.estado, tono: "neutro" };
            return (
              <li key={ci.codigo_cita} className="historial-con-obs">
                <IconoCategoria nombre={ci.categoria} className="historial-icono" />
                <div className="historial-texto">
                  <strong>{ci.servicio}</strong>
                  <span>
                    {fechaLarga(ci.fecha_hora_inicio.slice(0, 10))}, {ci.fecha_hora_inicio.slice(11)} · {ci.profesional} ·{" "}
                    {formatearPrecio(ci.precio)}
                  </span>
                  {ci.observaciones && <span className="historial-obs">Observaciones: {ci.observaciones}</span>}
                  {ci.notas_cliente && <span className="historial-obs">Nota de la clienta: “{ci.notas_cliente}”</span>}
                </div>
                <span className={`estado estado-${e.tono}`}>{e.texto}</span>
              </li>
            );
          })}
        </ul>
      )}

      {pedidos.length > 0 && (
        <>
          <h3 className="ficha-subtitulo">Compras en la tienda</h3>
          <ul className="historial">
            {pedidos.map((p) => (
              <li key={p.codigo_venta}>
                <Loto className="historial-icono" />
                <div className="historial-texto">
                  <strong>{p.items.map((i) => `${i.cantidad} × ${i.descripcion}`).join(", ")}</strong>
                  <span>{(p.fecha || "").slice(0, 10).split("-").reverse().join("/")} · {p.codigo_venta}</span>
                </div>
                <span className="estado estado-ok">{formatearPrecio(p.total)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* ================= Pedidos ================= */

const FILTROS_PEDIDOS = [
  { valor: "por_entregar", texto: "Pagados por entregar" },
  { valor: "entregados", texto: "Entregados" },
  { valor: "revision", texto: "Anulados / en revisión" },
];

export function GestionPedidos() {
  const { token } = useAuth();
  const [filtro, setFiltro] = useState("por_entregar");
  const [datos, setDatos] = useState(null);
  const [aviso, setAviso] = useState(null);

  async function cargar() {
    setDatos(null);
    const filtros =
      filtro === "por_entregar"
        ? { estado: "PAGADA", entregada: "0" }
        : filtro === "entregados"
        ? { estado: "PAGADA", entregada: "1" }
        : { estado: "ANULADA" };
    try {
      setDatos((await api.listarPedidos(filtros, token)).datos);
    } catch (err) {
      setDatos([]);
      setAviso({ tipo: "error", texto: err.message });
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  async function entregar(p) {
    try {
      await api.entregarPedido(p.codigo_venta, token);
      setAviso({ tipo: "exito", texto: `Pedido ${p.codigo_venta} marcado como entregado.` });
      cargar();
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    }
  }

  return (
    <Pagina
      titulo="Pedidos"
      bajada="Compras de la tienda online. Las clientas retiran en el salón mostrando su código."
      filtros={FILTROS_PEDIDOS}
      filtro={filtro}
      setFiltro={setFiltro}
      aviso={aviso}
      setAviso={setAviso}
    >
      {datos === null ? (
        <p className="equipo-estado">Cargando…</p>
      ) : datos.length === 0 ? (
        <p className="gestion-vacio">No hay pedidos en esta lista.</p>
      ) : (
        <ul className="gestion-lista">
          {datos.map((p) => {
            const revision = p.estado === "ANULADA" && p.estado_pago === "APROBADO";
            const wsp = whatsappClienta(
              p.telefono_cliente,
              `Hola ${p.cliente?.split(" ")[0] || ""}, tu pedido ${p.codigo_venta} de Nicolett Studio Fantasy está listo para retirar.`
            );
            return (
              <li key={p.codigo_venta} className={`gestion-item ${revision ? "gestion-alerta" : ""}`}>
                <div className="gestion-fecha">
                  <strong>{formatearPrecio(p.total)}</strong>
                  <span>{(p.fecha_pago || p.fecha || "").slice(0, 16)}</span>
                </div>
                <div className="gestion-cuerpo">
                  <p className="gestion-titulo">
                    {p.cliente} <small><code>{p.codigo_venta}</code></small>
                  </p>
                  <ul className="gestion-items">
                    {p.items.map((i) => (
                      <li key={i.id_producto}>
                        {i.imagen_url ? <img src={urlImagen(i.imagen_url)} alt="" /> : <Loto />}
                        {i.cantidad} × {i.descripcion}
                      </li>
                    ))}
                  </ul>
                  <p className="gestion-meta">{p.telefono_cliente || p.email_cliente}</p>
                  {p.notas && <p className="gestion-nota">“{p.notas}”</p>}
                  {p.motivo_anulacion && <p className="gestion-nota">{p.motivo_anulacion}</p>}
                </div>
                <div className="gestion-acciones">
                  {p.estado === "PAGADA" && !p.fecha_entrega && (
                    <>
                      <Estado tono="espera" texto="Por entregar" />
                      <button type="button" className="boton boton-cacao boton-chico" onClick={() => entregar(p)}>
                        Marcar entregado
                      </button>
                    </>
                  )}
                  {p.fecha_entrega && <Estado tono="ok" texto={`Entregado ${p.fecha_entrega.slice(0, 10)}`} />}
                  {revision && <Estado tono="error" texto="Pagó: reponer o devolver" />}
                  {p.estado === "ANULADA" && !revision && <Estado tono="neutro" texto="Anulado" />}
                  {wsp && (
                    <a href={wsp} target="_blank" rel="noreferrer" className="boton-texto gestion-wsp">
                      <IconoWhatsApp className="boton-icono" /> Avisarle
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Pagina>
  );
}
