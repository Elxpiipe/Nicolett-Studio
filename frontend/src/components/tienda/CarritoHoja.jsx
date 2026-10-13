// src/components/tienda/CarritoHoja.jsx
// Carrito lateral: cantidades, total y pago con Webpay. Siempre valida precios y
// stock con el backend (el carrito del navegador solo guarda ids y cantidades).
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCarrito } from "../../context/CarritoContext";
import { api, urlImagen } from "../../api/client";
import { formatearPrecio } from "../../utils/formato";
import { irAWebpay } from "../../utils/webpay";
import { CONTACTO } from "../../utils/contacto";
import Hoja from "../marca/Hoja";
import { Loto } from "../marca/Iconos";

export default function CarritoHoja() {
  const { items, cambiarCantidad, quitar, cerrar } = useCarrito();
  const { usuario, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [productos, setProductos] = useState(null);
  const [notas, setNotas] = useState("");
  const [pagando, setPagando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .listarProductos()
      .then((res) => setProductos(res.datos))
      .catch(() => setProductos([]));
  }, []);

  const lineas = productos
    ? items.map((i) => ({ ...i, producto: productos.find((p) => p.id_producto === i.id_producto) }))
    : [];
  const disponibles = lineas.filter((l) => l.producto && l.producto.stock > 0);
  const problemas = lineas.filter((l) => !l.producto || l.producto.stock < l.cantidad);
  const total = disponibles.reduce((s, l) => s + l.producto.precio * Math.min(l.cantidad, l.producto.stock), 0);

  async function pagar() {
    setError("");
    if (!usuario) {
      cerrar();
      navigate("/login", { state: { desde: { pathname: "/tienda", search: "?carrito=1" } } });
      return;
    }
    if (usuario.rol !== "Cliente") {
      setError("Las compras se hacen con una cuenta de clienta. Inicia sesión con una.");
      return;
    }
    setPagando(true);
    try {
      const { pedido } = await api.crearPedido(
        { items: items.map(({ id_producto, cantidad }) => ({ id_producto, cantidad })), notas },
        token
      );
      irAWebpay(await api.iniciarWebpayCompra(pedido.codigo_venta, token));
    } catch (err) {
      setError(err.message);
      setPagando(false);
      api.listarProductos().then((res) => setProductos(res.datos)); // refresca stock
    }
  }

  return (
    <Hoja titulo="Tu carrito" onCerrar={cerrar}>
      <div className="carrito">
        <p className="editor-sobretitulo">Tienda</p>
        <h2 className="editor-titulo">Tu carrito</h2>

        {productos === null ? (
          <p className="bloque-ayuda">Cargando…</p>
        ) : items.length === 0 ? (
          <div className="carrito-vacio">
            <Loto className="carrito-vacio-loto" />
            <p>Tu carrito está vacío.</p>
            <button
              type="button"
              className="boton boton-cacao"
              onClick={() => {
                cerrar();
                if (location.pathname !== "/tienda") navigate("/tienda");
              }}
            >
              Ver productos
            </button>
          </div>
        ) : (
          <>
            <ul className="carrito-lista">
              {lineas.map((l) => {
                const p = l.producto;
                const sinStock = !p || p.stock === 0;
                return (
                  <li key={l.id_producto} className={sinStock ? "carrito-item-agotado" : ""}>
                    <span className="carrito-foto">
                      {p?.imagen_url ? <img src={urlImagen(p.imagen_url)} alt="" /> : <Loto />}
                    </span>
                    <div className="carrito-info">
                      <strong>{p ? p.nombre : "Producto no disponible"}</strong>
                      {p && <small>{formatearPrecio(p.precio)} c/u</small>}
                      {sinStock ? (
                        <small className="carrito-alerta">Agotado: quítalo para continuar</small>
                      ) : (
                        p.stock < l.cantidad && <small className="carrito-alerta">Solo quedan {p.stock}</small>
                      )}
                      {!sinStock && (
                        <div className="cantidad" aria-label={`Cantidad de ${p.nombre}`}>
                          <button type="button" onClick={() => cambiarCantidad(l.id_producto, l.cantidad - 1)} aria-label="Quitar uno">
                            −
                          </button>
                          <span>{l.cantidad}</span>
                          <button
                            type="button"
                            onClick={() => cambiarCantidad(l.id_producto, l.cantidad + 1)}
                            disabled={l.cantidad >= p.stock}
                            aria-label="Agregar uno"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="carrito-derecha">
                      {p && !sinStock && <span className="carrito-subtotal">{formatearPrecio(p.precio * l.cantidad)}</span>}
                      <button type="button" className="boton-texto" onClick={() => quitar(l.id_producto)}>
                        Quitar
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="carrito-retiro">
              <strong>Retiro en el salón</strong>
              <span>{CONTACTO.direccion}. Te avisamos cuando tu pedido esté listo.</span>
            </div>

            <div className="campo">
              <label htmlFor="carrito-notas">Nota para el salón (opcional)</label>
              <input
                id="carrito-notas"
                value={notas}
                maxLength={300}
                placeholder="Ej: lo retiro el sábado en la mañana"
                onChange={(e) => setNotas(e.target.value)}
              />
            </div>

            {error && (
              <div className="aviso aviso-error" role="alert">
                <span>{error}</span>
              </div>
            )}

            <div className="carrito-total">
              <span>Total</span>
              <span className="precio-pildora precio-grande">{formatearPrecio(total)}</span>
            </div>

            <button
              type="button"
              className="boton boton-cacao carrito-pagar"
              onClick={pagar}
              disabled={pagando || problemas.length > 0 || total === 0}
            >
              {pagando ? "Conectando con Webpay…" : usuario ? "Pagar con Webpay" : "Inicia sesión para pagar"}
            </button>
            <p className="bloque-ayuda carrito-nota">
              Pagas con débito o crédito en Webpay (Transbank). Tus productos quedan apartados 15 minutos
              mientras pagas.
            </p>
          </>
        )}
      </div>
    </Hoja>
  );
}
