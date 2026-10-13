import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCarrito } from "../context/CarritoContext";
import { api, urlImagen } from "../api/client";
import { formatearPrecio, prepararImagen } from "../utils/formato";
import BarraSitio from "../components/marca/BarraSitio";
import SubnavPanel from "../components/marca/SubnavPanel";
import PieMarca from "../components/marca/PieMarca";
import Hoja from "../components/marca/Hoja";
import { IconoFoto, Loto } from "../components/marca/Iconos";
import "../styles/marca.css";
import "../styles/sitio.css";
import "../styles/catalogo.css";
import "../styles/tienda.css";

function textoStock(stock) {
  if (stock <= 0) return { texto: "Agotado", clase: "stock-agotado" };
  if (stock <= 3) return { texto: `¡Últimas ${stock}!`, clase: "stock-poco" };
  return { texto: "Disponible", clase: "stock-ok" };
}

export default function Tienda() {
  const { usuario, token } = useAuth();
  const esAdmin = usuario?.rol === "Administrador";
  const carrito = useCarrito();
  const [params, setParams] = useSearchParams();
  const [productos, setProductos] = useState(null);
  const [linea, setLinea] = useState("Todas");
  const [hoja, setHoja] = useState(null); // { tipo: "detalle"|"editor", producto? }
  const [aviso, setAviso] = useState(null);

  async function cargar() {
    try {
      const res = esAdmin ? await api.listarProductosAdmin(token) : await api.listarProductos();
      setProductos(res.datos);
    } catch (err) {
      setProductos([]);
      setAviso({ tipo: "error", texto: err.message });
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esAdmin]);

  // Vuelve de iniciar sesion con ?carrito=1: abre el carrito para pagar
  useEffect(() => {
    if (params.get("carrito") === "1") {
      carrito.abrir();
      params.delete("carrito");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (aviso?.tipo !== "exito") return;
    const t = setTimeout(() => setAviso(null), 3000);
    return () => clearTimeout(t);
  }, [aviso]);

  const lineas = useMemo(
    () => ["Todas", ...new Set((productos || []).map((p) => p.linea).filter(Boolean))],
    [productos]
  );
  const visibles = (productos || []).filter((p) => linea === "Todas" || p.linea === linea);

  function agregar(p, cantidad = 1) {
    const enCarrito = carrito.items.find((i) => i.id_producto === p.id_producto)?.cantidad || 0;
    if (enCarrito + cantidad > p.stock) {
      setAviso({ tipo: "error", texto: `Solo hay ${p.stock} unidad(es) de ${p.nombre}.` });
      return;
    }
    carrito.agregar(p.id_producto, cantidad, p.stock);
    setAviso({ tipo: "exito", texto: `${p.nombre} agregado al carrito` });
  }

  function alGuardar(texto) {
    setHoja(null);
    setAviso({ tipo: "exito", texto });
    cargar();
  }

  return (
    <div className="pagina-marca">
      <BarraSitio />
      {esAdmin && <SubnavPanel />}

      <main className="pagina-sitio">
        <header className="seccion-cabecera cabecera-pagina">
          <p className="sobretitulo">Cuida tu belleza en casa</p>
          <h1 className="titulo-script">Tienda</h1>
          <p className="cabecera-bajada">
            {esAdmin
              ? "Así ven tus clientas la tienda. Toca un producto para cambiar su foto, precio o stock."
              : "Los productos que usamos en el salón, para mantener tus resultados. Pagas online y retiras en el salón."}
          </p>
        </header>

        {esAdmin && (
          <div className="catalogo-herramientas">
            <p>Los productos desactivados se ven atenuados y solo los ves tú.</p>
            <button type="button" className="boton boton-cacao" onClick={() => setHoja({ tipo: "editor" })}>
              + Nuevo producto
            </button>
          </div>
        )}

        {aviso && (
          <div className={`aviso aviso-${aviso.tipo} aviso-flotante`} role={aviso.tipo === "error" ? "alert" : "status"}>
            <span>{aviso.texto}</span>
            {aviso.tipo === "exito" && !esAdmin && (
              <button type="button" className="boton-texto" onClick={carrito.abrir}>
                Ver carrito
              </button>
            )}
            <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
              ×
            </button>
          </div>
        )}

        {lineas.length > 2 && (
          <div className="filtros-linea" role="group" aria-label="Filtrar por línea">
            {lineas.map((l) => (
              <button key={l} type="button" className="chip" aria-pressed={linea === l} onClick={() => setLinea(l)}>
                {l}
              </button>
            ))}
          </div>
        )}

        {productos === null ? (
          <p className="estado-carga">Cargando productos…</p>
        ) : visibles.length === 0 ? (
          <p className="estado-carga">
            {esAdmin ? "Aún no hay productos. Crea el primero con “Nuevo producto”." : "Muy pronto tendremos productos disponibles."}
          </p>
        ) : (
          <ul className="productos">
            {visibles.map((p) => {
              const st = textoStock(p.stock);
              return (
                <li key={p.id_producto} className={`producto ${p.activo ? "" : "producto-inactivo"}`}>
                  <button
                    type="button"
                    className="producto-foto"
                    onClick={() => setHoja({ tipo: esAdmin ? "editor" : "detalle", producto: p })}
                    aria-label={esAdmin ? `Editar ${p.nombre}` : `Ver ${p.nombre}`}
                  >
                    {p.imagen_url ? <img src={urlImagen(p.imagen_url)} alt="" loading="lazy" /> : <Loto className="producto-sin-foto" />}
                    <span className={`producto-stock ${st.clase}`}>{esAdmin ? `Stock: ${p.stock}` : st.texto}</span>
                  </button>
                  <div className="producto-cuerpo">
                    {p.marca && <span className="producto-marca">{p.marca}</span>}
                    <h2 className="producto-nombre">{p.nombre}</h2>
                    {p.linea && <span className="producto-linea">{p.linea}</span>}
                    <div className="producto-pie">
                      <span className="precio-pildora">{p.precio == null ? "Precio por definir" : formatearPrecio(p.precio)}</span>
                      {esAdmin ? (
                        <button type="button" className="boton boton-linea boton-chico" onClick={() => setHoja({ tipo: "editor", producto: p })}>
                          Editar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="boton boton-cacao boton-chico"
                          disabled={p.stock <= 0}
                          onClick={() => agregar(p)}
                        >
                          {p.stock <= 0 ? "Agotado" : "Agregar"}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <PieMarca />

      {hoja?.tipo === "detalle" && (
        <Hoja titulo={hoja.producto.nombre} onCerrar={() => setHoja(null)} ancho="ancha">
          <DetalleProducto
            producto={hoja.producto}
            onAgregar={(cantidad) => {
              agregar(hoja.producto, cantidad);
              setHoja(null);
            }}
          />
        </Hoja>
      )}
      {hoja?.tipo === "editor" && (
        <Hoja titulo={hoja.producto ? `Editar ${hoja.producto.nombre}` : "Nuevo producto"} onCerrar={() => setHoja(null)}>
          <EditorProducto token={token} producto={hoja.producto} onCancelar={() => setHoja(null)} onGuardado={alGuardar} />
        </Hoja>
      )}
    </div>
  );
}

function DetalleProducto({ producto: p, onAgregar }) {
  const [cantidad, setCantidad] = useState(1);
  const st = textoStock(p.stock);
  return (
    <article className="detalle">
      <div className="detalle-foto producto-detalle-foto">
        {p.imagen_url ? <img src={urlImagen(p.imagen_url)} alt={p.nombre} /> : <span className="detalle-foto-vacia"><Loto /></span>}
      </div>
      <div className="detalle-cuerpo">
        <p className="detalle-categoria">{p.linea || "Tienda"}</p>
        <h2 className="detalle-nombre">{p.nombre}</h2>
        {p.marca && <p className="producto-marca">{p.marca}</p>}
        {p.descripcion && <p className="detalle-descripcion">{p.descripcion}</p>}
        <p className={`producto-stock-texto ${st.clase}`}>{st.texto}</p>
        <div className="detalle-datos">
          <span className="precio-pildora precio-grande">{formatearPrecio(p.precio)}</span>
        </div>
        {p.stock > 0 && (
          <div className="detalle-compra">
            <div className="cantidad" aria-label="Cantidad">
              <button type="button" onClick={() => setCantidad((c) => Math.max(1, c - 1))} aria-label="Quitar uno">−</button>
              <span>{cantidad}</span>
              <button type="button" onClick={() => setCantidad((c) => Math.min(p.stock, c + 1))} disabled={cantidad >= p.stock} aria-label="Agregar uno">+</button>
            </div>
            <button type="button" className="boton boton-cacao" onClick={() => onAgregar(cantidad)}>
              Agregar al carrito
            </button>
          </div>
        )}
        <p className="bloque-ayuda">Pagas online con Webpay y retiras en el salón, en Buin.</p>
      </div>
    </article>
  );
}

function EditorProducto({ token, producto, onCancelar, onGuardado }) {
  const esNuevo = !producto;
  const [form, setForm] = useState({
    nombre: producto?.nombre || "",
    marca: producto?.marca || "",
    linea: producto?.linea || "",
    descripcion: producto?.descripcion || "",
    precio: producto?.precio ?? "",
    stock: producto?.stock ?? 0,
  });
  const [archivo, setArchivo] = useState(null);
  const [vista, setVista] = useState(urlImagen(producto?.imagen_url));
  const [quitarFoto, setQuitarFoto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const refInput = useRef(null);
  const cambiar = (c) => (e) => setForm((f) => ({ ...f, [c]: e.target.value }));

  useEffect(() => () => vista?.startsWith("blob:") && URL.revokeObjectURL(vista), [vista]);

  async function elegirFoto(f) {
    if (!f) return;
    try {
      const listo = await prepararImagen(f, { maxLado: 1200 });
      setArchivo(listo);
      setVista(URL.createObjectURL(listo));
      setQuitarFoto(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function guardar(e) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    const payload = { ...form, precio: Number(form.precio), stock: Number(form.stock) };
    try {
      const res = esNuevo ? await api.crearProducto(payload, token) : await api.actualizarProducto(producto.id_producto, payload, token);
      const id = res.producto.id_producto;
      if (archivo) await api.subirImagenProducto(id, archivo, token);
      else if (quitarFoto && producto?.imagen_url) await api.quitarImagenProducto(id, token);
      onGuardado(esNuevo ? `“${payload.nombre}” agregado a la tienda` : "Cambios guardados");
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  async function alternarActivo() {
    setGuardando(true);
    try {
      await api.cambiarEstadoProducto(producto.id_producto, !producto.activo, token);
      onGuardado(producto.activo ? `“${producto.nombre}” oculto de la tienda` : `“${producto.nombre}” visible otra vez`);
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <form className="editor" onSubmit={guardar}>
      <p className="editor-sobretitulo">{esNuevo ? "Nuevo producto" : "Editar producto"}</p>
      <h2 className="editor-titulo">Tienda</h2>
      {error && (
        <div className="aviso aviso-error" role="alert">
          <span>{error}</span>
        </div>
      )}

      <div className={`zona-foto zona-foto-producto ${vista ? "zona-foto-con-imagen" : ""}`}>
        {vista ? (
          <img src={vista} alt="Foto del producto" />
        ) : (
          <div className="zona-foto-vacia">
            <IconoFoto className="zona-foto-icono" />
            <p>
              Arrastra una foto o <strong>elige una desde tu equipo</strong>
            </p>
            <small>Idealmente con fondo claro. JPG, PNG o WEBP.</small>
          </div>
        )}
        <input
          ref={refInput}
          id="foto-producto"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="zona-foto-input"
          onChange={(e) => elegirFoto(e.target.files?.[0])}
          onDrop={(e) => {
            e.preventDefault();
            elegirFoto(e.dataTransfer.files?.[0]);
          }}
          aria-label="Elegir foto del producto"
        />
      </div>
      {vista && (
        <div className="zona-foto-acciones">
          <label htmlFor="foto-producto" className="boton-texto">Cambiar foto</label>
          <button
            type="button"
            className="boton-texto"
            onClick={() => {
              setArchivo(null);
              setVista(null);
              setQuitarFoto(true);
              if (refInput.current) refInput.current.value = "";
            }}
          >
            Quitar foto
          </button>
        </div>
      )}

      <div className="campo">
        <label htmlFor="pr-nombre">Nombre</label>
        <input id="pr-nombre" value={form.nombre} onChange={cambiar("nombre")} maxLength={100} required placeholder="Ej: Shampoo matizador 400 ml" />
      </div>
      <div className="campo-fila">
        <div className="campo">
          <label htmlFor="pr-marca">Marca</label>
          <input id="pr-marca" value={form.marca} onChange={cambiar("marca")} maxLength={60} />
        </div>
        <div className="campo">
          <label htmlFor="pr-linea">Línea</label>
          <input id="pr-linea" value={form.linea} onChange={cambiar("linea")} maxLength={60} placeholder="Ej: Matizadores" list="lineas-sugeridas" />
          <datalist id="lineas-sugeridas">
            <option value="Matizadores" />
            <option value="Tratamientos" />
            <option value="Cuidado diario" />
            <option value="Uñas" />
            <option value="Pestañas y cejas" />
          </datalist>
        </div>
      </div>
      <div className="campo">
        <label htmlFor="pr-desc">
          Descripción <span className="campo-contador">{form.descripcion.length}/600</span>
        </label>
        <textarea id="pr-desc" rows={3} maxLength={600} value={form.descripcion} onChange={cambiar("descripcion")} />
      </div>
      <div className="campo-fila">
        <div className="campo">
          <label htmlFor="pr-precio">Precio (CLP)</label>
          <input id="pr-precio" type="number" min="1" step="1" value={form.precio} onChange={cambiar("precio")} required />
        </div>
        <div className="campo">
          <label htmlFor="pr-stock">Stock (unidades)</label>
          <input id="pr-stock" type="number" min="0" step="1" value={form.stock} onChange={cambiar("stock")} required />
        </div>
      </div>
      {!esNuevo && (
        <p className="bloque-ayuda">
          Al cambiar el stock se registra el movimiento en el historial de inventario. Las unidades apartadas
          por pedidos en curso ya están descontadas.
        </p>
      )}

      <div className="editor-acciones">
        {!esNuevo && (
          <button type="button" className="boton-texto editor-estado" onClick={alternarActivo} disabled={guardando}>
            {producto.activo ? "Ocultar de la tienda" : "Mostrar en la tienda"}
          </button>
        )}
        <button type="button" className="boton boton-linea" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
        <button type="submit" className="boton boton-cacao" disabled={guardando}>
          {guardando ? "Guardando…" : esNuevo ? "Agregar producto" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
