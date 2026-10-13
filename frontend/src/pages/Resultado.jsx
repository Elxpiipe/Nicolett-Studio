// Paginas a las que vuelve la clienta desde Webpay (o tras elegir transferencia):
//   /reserva/resultado?codigo=NS-...&estado=...
//   /compra/resultado?codigo=NV-...&estado=...
// El estado de la URL es solo una pista: lo que se muestra sale del backend.
import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCarrito } from "../context/CarritoContext";
import { api, urlImagen } from "../api/client";
import { formatearPrecio } from "../utils/formato";
import { irAWebpay } from "../utils/webpay";
import { enlaceWhatsApp } from "../utils/contacto";
import BarraSitio from "../components/marca/BarraSitio";
import PieMarca from "../components/marca/PieMarca";
import { IconoWhatsApp, Loto } from "../components/marca/Iconos";
import { fechaLarga } from "./Reservar";
import RecordatorioCita, { useRecordatorio } from "../components/RecordatorioCita";
import "../styles/catalogo.css";
import "../styles/marca.css";
import "../styles/sitio.css";
import "../styles/reservar.css";

const MENSAJE_PAGO = {
  rechazado: "El banco rechazó el pago. Puedes intentarlo otra vez con la misma u otra tarjeta.",
  anulado: "Cancelaste el pago en Webpay.",
  tiempo_agotado: "Se agotó el tiempo en el formulario de Webpay.",
  error: "No pudimos confirmar el pago con Transbank.",
};

const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" }).format(new Date());

function Marco({ tono, titulo, children }) {
  return (
    <section className={`resultado resultado-${tono}`}>
      <span className="resultado-sello" aria-hidden="true">
        {tono === "exito" ? "✓" : tono === "espera" ? "⏳" : <Loto />}
      </span>
      <h1 className="titulo-script">{titulo}</h1>
      {children}
    </section>
  );
}

export default function Resultado() {
  const { pathname } = useLocation();
  const esCompra = pathname.startsWith("/compra");
  const [params] = useSearchParams();
  const codigo = params.get("codigo");
  const pista = params.get("estado");
  const { usuario, token } = useAuth();
  const carrito = useCarrito();
  const [dato, setDato] = useState(null);
  const [error, setError] = useState("");
  const [reintentando, setReintentando] = useState(false);

  useEffect(() => {
    if (!usuario || !codigo) return;
    (esCompra ? api.obtenerPedido(codigo, token) : api.obtenerReserva(codigo, token))
      .then((r) => setDato(esCompra ? r.pedido : r.reserva))
      .catch((err) => setError(err.message));
  }, [usuario, codigo, esCompra, token]);

  // Compra pagada: se vacia el carrito
  useEffect(() => {
    if (esCompra && dato?.estado === "PAGADA") carrito.vaciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esCompra, dato?.estado]);

  async function reintentar() {
    setReintentando(true);
    setError("");
    try {
      irAWebpay(esCompra ? await api.iniciarWebpayCompra(codigo, token) : await api.iniciarWebpayReserva(codigo, token));
    } catch (err) {
      setError(err.message);
      setReintentando(false);
    }
  }

  let contenido;
  if (!usuario) {
    contenido = (
      <Marco tono="info" titulo="Inicia sesión">
        <p>Para ver el estado de tu {esCompra ? "compra" : "reserva"}, inicia sesión con tu cuenta.</p>
        <Link to="/login" state={{ desde: { pathname, search: `?${params.toString()}` } }} className="boton boton-cacao">
          Iniciar sesión
        </Link>
      </Marco>
    );
  } else if (error && !dato) {
    contenido = (
      <Marco tono="info" titulo="No encontramos el detalle">
        <p>{error}</p>
        <Link to="/" className="boton boton-linea">Volver al inicio</Link>
      </Marco>
    );
  } else if (!dato) {
    contenido = <p className="estado-carga">Revisando tu pago…</p>;
  } else if (esCompra) {
    contenido = <ResultadoCompra pedido={dato} pista={pista} onReintentar={reintentar} reintentando={reintentando} error={error} />;
  } else {
    contenido = <ResultadoReserva reserva={dato} pista={pista} onReintentar={reintentar} reintentando={reintentando} error={error} />;
  }

  return (
    <div className="pagina-marca">
      <BarraSitio />
      <main className="pagina-sitio">{contenido}</main>
      <PieMarca />
    </div>
  );
}

function DatosReserva({ r }) {
  return (
    <div className="ticket ticket-centrado">
      <p className="ticket-titulo">{r.servicio}</p>
      <dl>
        <div><dt>Código</dt><dd>{r.codigo_cita}</dd></div>
        <div><dt>Día</dt><dd>{fechaLarga(r.fecha_hora_inicio.slice(0, 10))}</dd></div>
        <div><dt>Hora</dt><dd>{r.fecha_hora_inicio.slice(11)} a {r.fecha_hora_fin.slice(11)}</dd></div>
        <div><dt>Profesional</dt><dd>{r.profesional}</dd></div>
        <div className="ticket-abono">
          <dt>Abono</dt>
          <dd>{formatearPrecio(r.monto_abono)} {r.estado_abono === "APROBADO" ? "· pagado" : "· pendiente"}</dd>
        </div>
        <div><dt>Pagas en el salón</dt><dd>{formatearPrecio(r.saldo)}</dd></div>
      </dl>
    </div>
  );
}

function ResultadoReserva(props) {
  const recordatorio = useRecordatorio(props.reserva);
  const vigente =
    props.reserva.estado === "CONFIRMADA" || (props.reserva.estado === "PENDIENTE_ABONO" && !props.reserva.vencida);
  return (
    <>
      <ContenidoReserva {...props} />
      {vigente && (
        <p className="centrado">
          <button type="button" className="boton-texto" onClick={recordatorio.abrir}>
            Ver indicaciones y reglas de tu cita
          </button>
        </p>
      )}
      {recordatorio.abierto && <RecordatorioCita reserva={props.reserva} onCerrar={recordatorio.cerrar} />}
    </>
  );
}

function ContenidoReserva({ reserva: r, pista, onReintentar, reintentando, error }) {
  const whatsapp = enlaceWhatsApp(
    `Hola, reservé ${r.servicio} para el ${fechaLarga(r.fecha_hora_inicio.slice(0, 10))} a las ${r.fecha_hora_inicio.slice(11)} ` +
      `(código ${r.codigo_cita}). Quiero pagar el abono de ${formatearPrecio(r.monto_abono)} por transferencia, ¿me envían los datos?`
  );

  if (r.estado === "CONFIRMADA") {
    return (
      <Marco tono="exito" titulo="¡Tu hora está confirmada!">
        <p>Te esperamos. Recuerda que los cambios de hora son con 48 horas de anticipación.</p>
        <DatosReserva r={r} />
        <Link to="/panel/mis-citas" className="boton boton-linea">Ver mis citas</Link>
      </Marco>
    );
  }

  if (r.estado === "PENDIENTE_ABONO" && !r.vencida && r.metodo_abono === "TRANSFERENCIA") {
    return (
      <Marco tono="espera" titulo="Tu hora está apartada">
        <p>
          Te la guardamos hasta las <strong>{r.fecha_expiracion_abono?.slice(11)}</strong>
          {r.fecha_expiracion_abono?.slice(0, 10) === hoy() ? " de hoy" : ` del ${fechaLarga(r.fecha_expiracion_abono?.slice(0, 10))}`}. Escríbenos
          por WhatsApp para recibir los datos de transferencia y envíanos el comprobante.
        </p>
        <a href={whatsapp} target="_blank" rel="noreferrer" className="boton boton-cacao boton-whatsapp">
          <IconoWhatsApp className="boton-icono" />
          Coordinar transferencia por WhatsApp
        </a>
        <DatosReserva r={r} />
      </Marco>
    );
  }

  if (r.estado === "PENDIENTE_ABONO" && !r.vencida) {
    return (
      <Marco tono="info" titulo="El pago no se completó">
        <p>{MENSAJE_PAGO[pista] || "Tu abono aún no está pagado."} Tu hora sigue apartada hasta las {r.fecha_expiracion_abono?.slice(11)}.</p>
        {error && <p className="aviso aviso-error">{error}</p>}
        <div className="resultado-acciones">
          <button type="button" className="boton boton-cacao" onClick={onReintentar} disabled={reintentando}>
            {reintentando ? "Conectando…" : `Pagar ${formatearPrecio(r.monto_abono)} otra vez`}
          </button>
          <a href={whatsapp} target="_blank" rel="noreferrer" className="boton boton-linea">Prefiero transferir</a>
        </div>
        <DatosReserva r={r} />
      </Marco>
    );
  }

  if (r.estado === "CANCELADA" && r.estado_abono === "APROBADO") {
    return (
      <Marco tono="info" titulo="Recibimos tu pago">
        <p>Tu abono llegó justo después de que venciera el plazo y la hora ya había sido tomada. No te preocupes: te contactaremos para darte otra hora o devolverte el abono.</p>
        <a href={enlaceWhatsApp(`Hola, pagué el abono de la reserva ${r.codigo_cita} pero la hora ya estaba tomada.`)} target="_blank" rel="noreferrer" className="boton boton-cacao">
          Escribirnos por WhatsApp
        </a>
      </Marco>
    );
  }

  return (
    <Marco tono="info" titulo="La reserva venció">
      <p>No recibimos el abono dentro del plazo y la hora quedó libre. Puedes reservar otra hora cuando quieras.</p>
      <Link to="/reservar" className="boton boton-cacao">Reservar otra hora</Link>
    </Marco>
  );
}

function ItemsPedido({ p }) {
  return (
    <div className="ticket ticket-centrado">
      <p className="ticket-titulo">Pedido {p.codigo_venta}</p>
      <ul className="ticket-items">
        {p.items.map((i) => (
          <li key={i.id_producto}>
            {i.imagen_url ? <img src={urlImagen(i.imagen_url)} alt="" /> : <Loto />}
            <span>{i.cantidad} × {i.descripcion}</span>
            <strong>{formatearPrecio(i.subtotal)}</strong>
          </li>
        ))}
      </ul>
      <dl>
        <div className="ticket-abono"><dt>Total</dt><dd>{formatearPrecio(p.total)}</dd></div>
      </dl>
    </div>
  );
}

function ResultadoCompra({ pedido: p, pista, onReintentar, reintentando, error }) {
  if (p.estado === "PAGADA") {
    return (
      <Marco tono="exito" titulo="¡Gracias por tu compra!">
        <p>Tu pago está confirmado. Retira tu pedido en el salón, Avenida Bernardo O'Higgins 979, Buin, mostrando el código de tu pedido.</p>
        <ItemsPedido p={p} />
        <div className="resultado-acciones">
          <Link to="/panel/mis-pedidos" className="boton boton-linea">Ver mis pedidos</Link>
          <Link to="/tienda" className="boton-texto">Seguir comprando</Link>
        </div>
      </Marco>
    );
  }
  if (p.estado === "PENDIENTE" && p.fecha_expiracion_pago && p.fecha_expiracion_pago > new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short" }).format(new Date())) {
    return (
      <Marco tono="info" titulo="El pago no se completó">
        <p>{MENSAJE_PAGO[pista] || "Tu pedido aún no está pagado."} Tus productos siguen apartados hasta las {p.fecha_expiracion_pago.slice(11)}.</p>
        {error && <p className="aviso aviso-error">{error}</p>}
        <button type="button" className="boton boton-cacao" onClick={onReintentar} disabled={reintentando}>
          {reintentando ? "Conectando…" : `Pagar ${formatearPrecio(p.total)} otra vez`}
        </button>
        <ItemsPedido p={p} />
      </Marco>
    );
  }
  if (p.estado === "ANULADA" && p.estado_pago === "APROBADO") {
    return (
      <Marco tono="info" titulo="Recibimos tu pago">
        <p>Tu pago llegó después de que venciera el plazo y algún producto se agotó. Te contactaremos para reponerlo o devolverte el dinero.</p>
        <a href={enlaceWhatsApp(`Hola, pagué el pedido ${p.codigo_venta} pero quedó en revisión.`)} target="_blank" rel="noreferrer" className="boton boton-cacao">
          Escribirnos por WhatsApp
        </a>
      </Marco>
    );
  }
  return (
    <Marco tono="info" titulo="El pedido venció">
      <p>No se completó el pago a tiempo y los productos volvieron a la tienda. Tu carrito sigue guardado: puedes intentarlo de nuevo.</p>
      <Link to="/tienda?carrito=1" className="boton boton-cacao">Volver al carrito</Link>
    </Marco>
  );
}
