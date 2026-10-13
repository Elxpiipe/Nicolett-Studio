// Mis pedidos (clienta): historial de compras de la tienda y "Repetir pedido".
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCarrito } from "../context/CarritoContext";
import { api, urlImagen } from "../api/client";
import { formatearPrecio } from "../utils/formato";
import { enlaceWhatsApp } from "../utils/contacto";
import { irAWebpay } from "../utils/webpay";
import BarraSitio from "../components/marca/BarraSitio";
import SubnavPanel from "../components/marca/SubnavPanel";
import PieMarca from "../components/marca/PieMarca";
import { Loto } from "../components/marca/Iconos";
import "../styles/marca.css";
import "../styles/equipo.css";
import "../styles/gestion.css";
import "../styles/cuenta.css";

const ahoraChile = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short" }).format(new Date());

function estadoPedido(p) {
  if (p.estado === "PAGADA" && p.fecha_entrega) return { texto: `Entregado el ${p.fecha_entrega.slice(0, 10)}`, tono: "ok" };
  if (p.estado === "PAGADA") return { texto: "Pagado · listo para retirar", tono: "espera" };
  if (p.estado === "PENDIENTE" && p.fecha_expiracion_pago > ahoraChile()) return { texto: "Esperando pago", tono: "espera" };
  if (p.estado_pago === "APROBADO") return { texto: "En revisión", tono: "error" };
  return { texto: "No se completó el pago", tono: "neutro" };
}

function fechaCorta(texto) {
  if (!texto) return "";
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${texto.slice(0, 10)}T12:00:00`)
  );
}

export default function MisPedidos() {
  const { token } = useAuth();
  const carrito = useCarrito();
  const [pedidos, setPedidos] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [trabajando, setTrabajando] = useState(null);

  useEffect(() => {
    api
      .misPedidos(token)
      .then((r) => setPedidos(r.datos))
      .catch((err) => {
        setPedidos([]);
        setAviso({ tipo: "error", texto: err.message });
      });
  }, [token]);

  /**
   * Vuelve a cargar el carrito con los productos del pedido, usando el stock y
   * precio de HOY. Avisa de los que se agotaron, se ocultaron o alcanzan menos.
   */
  async function repetir(p) {
    setTrabajando(p.codigo_venta);
    try {
      const { datos: productos } = await api.listarProductos();
      const agregados = [];
      const faltantes = [];
      for (const item of p.items) {
        const prod = productos.find((x) => x.id_producto === item.id_producto);
        const enCarrito = carrito.items.find((i) => i.id_producto === item.id_producto)?.cantidad || 0;
        const disponible = prod ? prod.stock - enCarrito : 0;
        if (!prod || disponible <= 0) {
          faltantes.push(`${item.descripcion} (sin stock)`);
          continue;
        }
        const cantidad = Math.min(item.cantidad, disponible);
        carrito.agregar(prod.id_producto, cantidad, prod.stock);
        agregados.push(prod.nombre);
        if (cantidad < item.cantidad) faltantes.push(`${prod.nombre} (solo ${cantidad} de ${item.cantidad})`);
      }
      if (agregados.length === 0) {
        setAviso({ tipo: "error", texto: "Ninguno de los productos de ese pedido está disponible por ahora." });
      } else {
        setAviso(
          faltantes.length
            ? { tipo: "error", texto: `Agregamos lo disponible. No alcanzó para: ${faltantes.join(", ")}.` }
            : { tipo: "exito", texto: "Agregamos los productos a tu carrito, con los precios de hoy." }
        );
        carrito.abrir();
      }
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    } finally {
      setTrabajando(null);
    }
  }

  async function pagar(p) {
    setTrabajando(p.codigo_venta);
    try {
      irAWebpay(await api.iniciarWebpayCompra(p.codigo_venta, token));
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
      setTrabajando(null);
    }
  }

  return (
    <div className="pagina-marca">
      <BarraSitio />
      <SubnavPanel />

      <main className="equipo cuenta">
        <header className="equipo-cabecera">
          <h1>Mis pedidos</h1>
          <p>Tus compras de la tienda. Los pedidos pagados se retiran en el salón mostrando su código.</p>
        </header>

        {aviso && (
          <div className={`aviso aviso-${aviso.tipo}`} role={aviso.tipo === "error" ? "alert" : "status"}>
            <span>{aviso.texto}</span>
            <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">×</button>
          </div>
        )}

        {pedidos === null ? (
          <p className="equipo-estado">Cargando tus pedidos…</p>
        ) : pedidos.length === 0 ? (
          <div className="gestion-vacio">
            <p>Aún no has comprado en la tienda.</p>
            <Link to="/tienda" className="boton boton-cacao">Ver productos</Link>
          </div>
        ) : (
          <ul className="pedidos">
            {pedidos.map((p) => {
              const e = estadoPedido(p);
              const pendienteVigente = p.estado === "PENDIENTE" && p.fecha_expiracion_pago > ahoraChile();
              return (
                <li key={p.codigo_venta} className="pedido">
                  <header className="pedido-cabecera">
                    <div>
                      <p className="pedido-codigo">Pedido <code>{p.codigo_venta}</code></p>
                      <p className="pedido-fecha">{fechaCorta(p.fecha_pago || p.fecha)}</p>
                    </div>
                    <span className={`estado estado-${e.tono}`}>{e.texto}</span>
                  </header>

                  <ul className="pedido-items">
                    {p.items.map((i) => (
                      <li key={i.id_producto}>
                        <span className="pedido-foto">{i.imagen_url ? <img src={urlImagen(i.imagen_url)} alt="" /> : <Loto />}</span>
                        <span className="pedido-nombre">{i.descripcion}</span>
                        <span className="pedido-cantidad">× {i.cantidad}</span>
                        <span className="pedido-subtotal">{formatearPrecio(i.subtotal)}</span>
                      </li>
                    ))}
                  </ul>

                  <footer className="pedido-pie">
                    <span className="pedido-total">
                      Total <strong>{formatearPrecio(p.total)}</strong>
                    </span>
                    <div className="pedido-acciones">
                      {e.texto === "En revisión" && (
                        <a className="boton-texto" target="_blank" rel="noreferrer" href={enlaceWhatsApp(`Hola, mi pedido ${p.codigo_venta} quedó en revisión.`)}>
                          Escribirnos
                        </a>
                      )}
                      {pendienteVigente ? (
                        <button type="button" className="boton boton-cacao boton-chico" onClick={() => pagar(p)} disabled={trabajando === p.codigo_venta}>
                          {trabajando === p.codigo_venta ? "Conectando…" : "Pagar ahora"}
                        </button>
                      ) : (
                        <button type="button" className="boton boton-cacao boton-chico" onClick={() => repetir(p)} disabled={trabajando === p.codigo_venta}>
                          {trabajando === p.codigo_venta ? "Revisando stock…" : "Repetir pedido"}
                        </button>
                      )}
                    </div>
                  </footer>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <PieMarca />
    </div>
  );
}
