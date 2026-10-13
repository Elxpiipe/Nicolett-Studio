import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, urlImagen } from "../api/client";
import { formatearDuracion, formatearPrecio, leerAdicionales, leerLineas, prepararImagen, textoPrecio } from "../utils/formato";
import { enlaceWhatsApp } from "../utils/contacto";
import { Link, useLocation } from "react-router-dom";
import BarraSitio from "../components/marca/BarraSitio";
import SubnavPanel from "../components/marca/SubnavPanel";
import { FotoArco } from "../components/marca/Fotos";
import PieMarca from "../components/marca/PieMarca";
import Hoja from "../components/marca/Hoja";
import { IconoCategoria, IconoFoto, IconoWhatsApp } from "../components/marca/Iconos";
import logo from "../assets/logo-nicolett.png";
import fotoSalon from "../assets/salon-nicolett.jpg";
import "../styles/marca.css";
import "../styles/catalogo.css";

export default function Catalogo() {
  // Pagina publica: cualquiera la ve; el Administrador ademas puede editar
  const { usuario, token } = useAuth();
  const esAdmin = usuario?.rol === "Administrador";
  const { hash } = useLocation();

  const [categorias, setCategorias] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState(null); // { tipo: "error" | "exito", texto }
  // null | { tipo: "detalle", servicio } | { tipo: "servicio", servicio?, idCategoria } | { tipo: "categoria", categoria? }
  const [hoja, setHoja] = useState(null);
  const [categoriaActiva, setCategoriaActiva] = useState(null);

  async function cargarTodo() {
    setCargando(true);
    try {
      const [resCategorias, resServicios] = await Promise.all([
        api.listarCategorias(!esAdmin),
        api.listarServicios(esAdmin ? "" : "activo=1"),
      ]);
      setCategorias(resCategorias.datos);
      setServicios(resServicios.datos);
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El aviso de exito desaparece solo
  useEffect(() => {
    if (aviso?.tipo !== "exito") return;
    const t = setTimeout(() => setAviso(null), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  const categoriasVisibles = useMemo(
    () =>
      esAdmin
        ? categorias
        : categorias.filter(
            (c) => c.activo && servicios.some((s) => s.id_categoria === c.id_categoria)
          ),
    [categorias, servicios, esAdmin]
  );

  // Llega desde el Inicio con #categoria-N: baja hasta esa lista de precios
  useEffect(() => {
    if (!hash || cargando) return;
    const t = setTimeout(() => document.querySelector(hash)?.scrollIntoView({ block: "start" }), 50);
    return () => clearTimeout(t);
  }, [hash, cargando]);

  // Resalta en la barra de categorias la que se esta viendo
  useEffect(() => {
    if (!categoriasVisibles.length || !("IntersectionObserver" in window)) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.find((e) => e.isIntersecting);
        if (visible) setCategoriaActiva(Number(visible.target.dataset.id));
      },
      { rootMargin: "-35% 0px -55% 0px" }
    );
    document.querySelectorAll(".carta[data-id]").forEach((el) => observador.observe(el));
    return () => observador.disconnect();
  }, [categoriasVisibles]);

  function irACategoria(id) {
    const reducirMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(`categoria-${id}`)
      ?.scrollIntoView({ behavior: reducirMovimiento ? "auto" : "smooth", block: "start" });
  }

  function alGuardar(texto) {
    setHoja(null);
    setAviso({ tipo: "exito", texto });
    cargarTodo();
  }

  const cerrarHoja = () => setHoja(null);

  return (
    <div className="pagina-marca">
      <BarraSitio />
      {esAdmin && <SubnavPanel />}

      <section className="portada">
        <div className="portada-texto">
          <img
            className="portada-logo"
            src={logo}
            alt="Nicolett Studio Fantasy. Belleza a tu ritmo y sin barreras. Buin."
          />
          <h1 className="portada-titulo">Nuestros servicios</h1>
          <p className="portada-bajada">
            {esAdmin
              ? "Así ven tus clientas el catálogo. Toca cualquier servicio para cambiar su foto, precio o duración."
              : "Elige un servicio para ver el detalle y consultarlo directo con nosotras."}
          </p>
        </div>

        <FotoArco src={fotoSalon} alt="Recepción del salón Nicolett Studio Fantasy en Buin" />
      </section>

      {categoriasVisibles.length > 0 && (
        <nav className="riel" aria-label="Categorías de servicios">
          <ul className="riel-lista">
            {categoriasVisibles.map((c) => (
              <li key={c.id_categoria}>
                <button
                  type="button"
                  className="medallon"
                  aria-current={categoriaActiva === c.id_categoria ? "true" : undefined}
                  onClick={() => irACategoria(c.id_categoria)}
                >
                  <span className="medallon-circulo">
                    <IconoCategoria nombre={c.nombre} className="medallon-icono" />
                  </span>
                  <span className="medallon-nombre">{c.nombre}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <main className="catalogo">
        {esAdmin && (
          <div className="catalogo-herramientas">
            <p>Las categorías y servicios deshabilitados se ven atenuados y solo los ves tú.</p>
            <button
              type="button"
              className="boton boton-linea"
              onClick={() => setHoja({ tipo: "categoria" })}
            >
              Nueva categoría
            </button>
          </div>
        )}

        {aviso && (
          <div className={`aviso aviso-${aviso.tipo}`} role={aviso.tipo === "error" ? "alert" : "status"}>
            <span>{aviso.texto}</span>
            <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
              ×
            </button>
          </div>
        )}

        {cargando && categorias.length === 0 ? (
          <p className="catalogo-estado">Cargando servicios…</p>
        ) : categoriasVisibles.length === 0 ? (
          <p className="catalogo-estado">
            {esAdmin
              ? "Aún no hay categorías. Crea la primera con “Nueva categoría”."
              : "Pronto publicaremos nuestros servicios. Mientras, escríbenos por WhatsApp."}
          </p>
        ) : (
          <div className="cartas">
            {categoriasVisibles.map((categoria) => (
              <CartaPrecios
                key={categoria.id_categoria}
                categoria={categoria}
                servicios={servicios.filter((s) => s.id_categoria === categoria.id_categoria)}
                esAdmin={esAdmin}
                token={token}
                onAbrirServicio={(servicio) =>
                  setHoja(
                    esAdmin
                      ? { tipo: "servicio", servicio, idCategoria: servicio.id_categoria }
                      : { tipo: "detalle", servicio }
                  )
                }
                onNuevoServicio={() =>
                  setHoja({ tipo: "servicio", idCategoria: categoria.id_categoria })
                }
                onEditarCategoria={() => setHoja({ tipo: "categoria", categoria })}
                onCambio={alGuardar}
                onError={(texto) => setAviso({ tipo: "error", texto })}
              />
            ))}
          </div>
        )}
      </main>

      <PieMarca />

      {hoja?.tipo === "detalle" && (
        <Hoja titulo={hoja.servicio.nombre} onCerrar={cerrarHoja} ancho="ancha">
          <DetalleServicio
            servicio={hoja.servicio}
            categoria={categorias.find((c) => c.id_categoria === hoja.servicio.id_categoria)}
          />
        </Hoja>
      )}

      {hoja?.tipo === "servicio" && (
        <Hoja
          titulo={hoja.servicio ? `Editar ${hoja.servicio.nombre}` : "Nuevo servicio"}
          onCerrar={cerrarHoja}
        >
          <EditorServicio
            token={token}
            servicio={hoja.servicio}
            idCategoriaInicial={hoja.idCategoria}
            categorias={categorias}
            onCancelar={cerrarHoja}
            onGuardado={alGuardar}
          />
        </Hoja>
      )}

      {hoja?.tipo === "categoria" && (
        <Hoja
          titulo={hoja.categoria ? `Editar ${hoja.categoria.nombre}` : "Nueva categoría"}
          onCerrar={cerrarHoja}
        >
          <EditorCategoria
            token={token}
            categoria={hoja.categoria}
            onCancelar={cerrarHoja}
            onGuardado={alGuardar}
          />
        </Hoja>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Carta de precios: una por categoria, como las listas de Instagram  */
/* ------------------------------------------------------------------ */

function CartaPrecios({
  categoria,
  servicios,
  esAdmin,
  token,
  onAbrirServicio,
  onNuevoServicio,
  onEditarCategoria,
  onCambio,
  onError,
}) {
  async function alternarEstado() {
    try {
      if (categoria.activo) {
        await api.deshabilitarCategoria(categoria.id_categoria, token);
        onCambio(`Categoría “${categoria.nombre}” deshabilitada`);
      } else {
        await api.reactivarCategoria(categoria.id_categoria, token);
        onCambio(`Categoría “${categoria.nombre}” reactivada`);
      }
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <section
      id={`categoria-${categoria.id_categoria}`}
      data-id={categoria.id_categoria}
      className={`carta ${categoria.activo ? "" : "carta-inactiva"}`}
      aria-labelledby={`titulo-categoria-${categoria.id_categoria}`}
    >
      <header className="carta-cabecera">
        <span className="carta-medallon">
          <IconoCategoria nombre={categoria.nombre} />
        </span>
        <p className="carta-sobretitulo">Lista de precios</p>
        <h2 className="carta-titulo" id={`titulo-categoria-${categoria.id_categoria}`}>
          {categoria.nombre}
        </h2>
        {categoria.descripcion && <p className="carta-descripcion">{categoria.descripcion}</p>}
        <span className="divisor" aria-hidden="true">
          <span>♥</span>
        </span>

        {esAdmin && (
          <div className="carta-admin">
            {!categoria.activo && <span className="etiqueta-inactiva">Deshabilitada</span>}
            <span className="etiqueta-abono">Abono {formatearPrecio(categoria.abono ?? 5000)}</span>
            <button type="button" className="boton-texto" onClick={onEditarCategoria}>
              Editar categoría
            </button>
            <button type="button" className="boton-texto" onClick={alternarEstado}>
              {categoria.activo ? "Deshabilitar" : "Reactivar"}
            </button>
          </div>
        )}
      </header>

      {servicios.length > 0 && (
        <ul className="carta-lista">
          {servicios.map((servicio) => (
            <li key={servicio.id_servicio}>
              <FilaServicio
                servicio={servicio}
                nombreCategoria={categoria.nombre}
                esAdmin={esAdmin}
                onClick={() => onAbrirServicio(servicio)}
              />
            </li>
          ))}
        </ul>
      )}

      <NotasCategoria categoria={categoria} />

      {esAdmin && (
        <button type="button" className="carta-agregar" onClick={onNuevoServicio}>
          + Agregar servicio a {categoria.nombre}
        </button>
      )}
    </section>
  );
}

/** Adicionales e indicaciones de la categoria, como en las listas de precios de Instagram */
function NotasCategoria({ categoria, compacta = false }) {
  const adicionales = leerAdicionales(categoria.adicionales);
  const indicaciones = leerLineas(categoria.indicaciones);
  if (!adicionales.length && !indicaciones.length) return null;
  return (
    <div className={`notas-categoria ${compacta ? "notas-compactas" : ""}`}>
      {adicionales.length > 0 && (
        <div className="adicionales">
          <p className="notas-titulo">Adicionales</p>
          <ul>
            {adicionales.map((a) => (
              <li key={a.nombre}>
                <span>
                  <strong>{a.nombre}</strong>
                  {a.detalle && <small>{a.detalle}</small>}
                </span>
                {a.precio && <span className="adicional-precio">{a.precio}</span>}
              </li>
            ))}
          </ul>
          {!compacta && <p className="notas-pie">Se agregan en el salón, al momento de tu atención.</p>}
        </div>
      )}
      {indicaciones.length > 0 && (
        <div className="indicaciones">
          <p className="notas-titulo">Importante</p>
          <ul>
            {indicaciones.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Chips con el precio por largo: S $25.000 · M $30.000 ... */
function ChipsVariantes({ variantes }) {
  if (!variantes?.length) return null;
  return (
    <span className="chips-variantes">
      {variantes.map((v) => (
        <span key={v.id_variante ?? v.nombre} className="chip-variante" title={v.detalle || undefined}>
          <b>{v.nombre}</b> {formatearPrecio(v.precio)}
        </span>
      ))}
    </span>
  );
}

/**
 * Una fila de la lista de precios. Se usa en la carta y tambien como
 * "vista previa" dentro del editor (con `soloVista`).
 */
function FilaServicio({ servicio, nombreCategoria, esAdmin, onClick, soloVista = false }) {
  const imagen = urlImagen(servicio.imagen_url);
  const contenido = (
    <>
      <span className="fila-foto">
        {imagen ? (
          <img src={imagen} alt="" loading="lazy" />
        ) : (
          <span className="fila-foto-vacia">
            <IconoCategoria nombre={nombreCategoria} />
          </span>
        )}
      </span>
      <span className="fila-texto">
        <span className="fila-nombre">{servicio.nombre || "Nombre del servicio"}</span>
        {servicio.descripcion && <span className="fila-descripcion">{servicio.descripcion}</span>}
        <ChipsVariantes variantes={servicio.variantes} />
        <span className="fila-duracion">
          {formatearDuracion(servicio.duracion_minutos)}
          {esAdmin && servicio.activo === 0 && <span className="etiqueta-inactiva">Deshabilitado</span>}
          {esAdmin && !imagen && !soloVista && <span className="etiqueta-sin-foto">Sin foto</span>}
        </span>
      </span>
      <span className={`precio-pildora ${servicio.tipo_precio === "EVALUACION" ? "precio-evaluacion" : ""}`}>
        {servicio.tipo_precio === "DESDE" || servicio.variantes?.length ? <small>Desde</small> : null}
        {servicio.tipo_precio === "EVALUACION"
          ? "Según evaluación"
          : formatearPrecio(servicio.precio_desde ?? servicio.precio)}
      </span>
    </>
  );

  if (soloVista) {
    return <div className="fila-servicio fila-vista">{contenido}</div>;
  }

  return (
    <button
      type="button"
      className={`fila-servicio ${servicio.activo === 0 ? "fila-inactiva" : ""}`}
      onClick={onClick}
      aria-label={`${servicio.nombre}, ${textoPrecio(servicio)}${esAdmin ? ". Editar" : ". Ver detalle"}`}
    >
      {contenido}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Detalle para Cliente / Profesional                                 */
/* ------------------------------------------------------------------ */

function DetalleServicio({ servicio, categoria }) {
  const imagen = urlImagen(servicio.imagen_url);
  const evaluacion = servicio.tipo_precio === "EVALUACION";
  const mensaje = evaluacion
    ? `Hola, quiero cotizar ${servicio.nombre}. ¿Cuándo podría ir a una evaluación?`
    : `Hola, quiero agendar ${servicio.nombre} (${textoPrecio(servicio)}). ¿Qué horas tienen disponibles?`;
  const abono = Math.min(servicio.abono_categoria ?? 5000, servicio.precio_desde ?? servicio.precio);

  return (
    <article className="detalle">
      <div className="detalle-foto">
        {imagen ? (
          <img src={imagen} alt={servicio.nombre} />
        ) : (
          <span className="detalle-foto-vacia">
            <IconoCategoria nombre={servicio.categoria} />
          </span>
        )}
      </div>
      <div className="detalle-cuerpo">
        <p className="detalle-categoria">{servicio.categoria}</p>
        <h2 className="detalle-nombre">{servicio.nombre}</h2>
        {servicio.descripcion && <p className="detalle-descripcion">{servicio.descripcion}</p>}
        <dl className="detalle-datos">
          <div>
            <dt>Duración aproximada</dt>
            <dd>{formatearDuracion(servicio.duracion_minutos)}</dd>
          </div>
          <div>
            <dt>Valor</dt>
            <dd>
              {servicio.variantes?.length ? (
                <table className="tabla-variantes">
                  <tbody>
                    {servicio.variantes.map((v) => (
                      <tr key={v.id_variante}>
                        <th>{v.nombre}</th>
                        <td>{v.detalle}</td>
                        <td><span className="precio-pildora">{formatearPrecio(v.precio)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <span className={`precio-pildora precio-grande ${evaluacion ? "precio-evaluacion" : ""}`}>{textoPrecio(servicio)}</span>
              )}
            </dd>
          </div>
        </dl>
        {evaluacion ? (
          <>
            <a className="boton boton-cacao detalle-whatsapp" href={enlaceWhatsApp(mensaje)} target="_blank" rel="noreferrer">
              <IconoWhatsApp className="boton-icono" /> Cotizar por WhatsApp
            </a>
            <p className="detalle-abono">El valor se define en una evaluación previa.</p>
          </>
        ) : (
          <>
            <Link className="boton boton-cacao detalle-whatsapp" to={`/reservar?servicio=${servicio.id_servicio}`}>
              Reservar online
            </Link>
            <p className="detalle-abono">Para reservar se abona {formatearPrecio(abono)}, que se descuenta del total.</p>
            <a className="boton-texto detalle-consulta" href={enlaceWhatsApp(mensaje)} target="_blank" rel="noreferrer">
              <IconoWhatsApp className="boton-icono" /> ¿Dudas? Consúltanos por WhatsApp
            </a>
          </>
        )}
        {categoria && <NotasCategoria categoria={categoria} compacta />}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Editor de servicio (Administrador) con foto y vista previa          */
/* ------------------------------------------------------------------ */

function EditorServicio({ token, servicio, idCategoriaInicial, categorias, onCancelar, onGuardado }) {
  const esNuevo = !servicio;
  const [form, setForm] = useState({
    id_categoria: servicio?.id_categoria || idCategoriaInicial,
    nombre: servicio?.nombre || "",
    descripcion: servicio?.descripcion || "",
    duracion_minutos: servicio?.duracion_minutos || 60,
    precio: servicio?.precio ?? "",
    tipo_precio: servicio?.tipo_precio || "FIJO",
    orden: servicio?.orden ?? 0,
  });
  // Precios por largo de cabello (S/M/L/XL). Vacio = precio unico.
  const [variantes, setVariantes] = useState(
    (servicio?.variantes || []).map((v) => ({ id_variante: v.id_variante, nombre: v.nombre, detalle: v.detalle || "", precio: v.precio }))
  );
  const [archivo, setArchivo] = useState(null); // File listo para subir
  const [vistaFoto, setVistaFoto] = useState(urlImagen(servicio?.imagen_url));
  const [quitarFoto, setQuitarFoto] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const refInput = useRef(null);

  // Libera la URL temporal de la vista previa cuando cambia o se cierra el editor
  useEffect(() => {
    return () => {
      if (vistaFoto?.startsWith("blob:")) URL.revokeObjectURL(vistaFoto);
    };
  }, [vistaFoto]);

  const categoriaActual = categorias.find((c) => c.id_categoria === Number(form.id_categoria));

  function cambiar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function elegirFoto(archivoElegido) {
    if (!archivoElegido) return;
    setError("");
    setProcesandoFoto(true);
    try {
      const listo = await prepararImagen(archivoElegido);
      setArchivo(listo);
      setVistaFoto(URL.createObjectURL(listo));
      setQuitarFoto(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesandoFoto(false);
    }
  }

  function alSoltar(e) {
    e.preventDefault();
    setArrastrando(false);
    elegirFoto(e.dataTransfer.files?.[0]);
  }

  function eliminarFoto() {
    setArchivo(null);
    setVistaFoto(null);
    setQuitarFoto(true);
    if (refInput.current) refInput.current.value = "";
  }

  async function alternarEstado() {
    setGuardando(true);
    try {
      if (servicio.activo) {
        await api.deshabilitarServicio(servicio.id_servicio, token);
        onGuardado(`“${servicio.nombre}” deshabilitado: ya no se muestra a las clientas`);
      } else {
        await api.reactivarServicio(servicio.id_servicio, token);
        onGuardado(`“${servicio.nombre}” reactivado`);
      }
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  async function guardar(e) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    const listaVariantes = variantes
      .filter((v) => v.nombre.trim() && v.precio !== "")
      .map((v) => ({ ...v, precio: Number(v.precio) }));
    const payload = {
      ...form,
      id_categoria: Number(form.id_categoria),
      duracion_minutos: Number(form.duracion_minutos),
      orden: Number(form.orden) || 0,
      // Con variantes, el precio base es el menor; "segun evaluacion" no tiene precio
      precio:
        form.tipo_precio === "EVALUACION"
          ? 0
          : listaVariantes.length
          ? Math.min(...listaVariantes.map((v) => v.precio))
          : Number(form.precio),
      variantes: form.tipo_precio === "EVALUACION" ? [] : listaVariantes,
    };

    try {
      const res = esNuevo
        ? await api.crearServicio(payload, token)
        : await api.actualizarServicio(servicio.id_servicio, payload, token);
      const id = res.servicio.id_servicio;

      if (archivo) {
        await api.subirImagenServicio(id, archivo, token);
      } else if (quitarFoto && servicio?.imagen_url) {
        await api.quitarImagenServicio(id, token);
      }

      onGuardado(esNuevo ? `“${payload.nombre}” agregado al catálogo` : "Cambios guardados");
    } catch (err) {
      const detalle = err.detalles?.map((d) => d.mensaje).join(". ");
      setError(detalle || err.message);
      setGuardando(false);
    }
  }

  return (
    <form className="editor" onSubmit={guardar}>
      <p className="editor-sobretitulo">{esNuevo ? "Nuevo servicio" : "Editar servicio"}</p>
      <h2 className="editor-titulo">{categoriaActual?.nombre || "Servicio"}</h2>

      {error && (
        <div className="aviso aviso-error" role="alert">
          <span>{error}</span>
        </div>
      )}

      <div
        className={`zona-foto ${arrastrando ? "zona-foto-activa" : ""} ${vistaFoto ? "zona-foto-con-imagen" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={alSoltar}
      >
        {vistaFoto ? (
          <img src={vistaFoto} alt="Foto del servicio" />
        ) : (
          <div className="zona-foto-vacia">
            <IconoFoto className="zona-foto-icono" />
            <p>
              Arrastra una foto aquí o <strong>elige una desde tu equipo</strong>
            </p>
            <small>JPG, PNG o WEBP. Se ajusta sola al tamaño correcto.</small>
          </div>
        )}
        <input
          ref={refInput}
          id="foto-servicio"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="zona-foto-input"
          onChange={(e) => elegirFoto(e.target.files?.[0])}
          aria-label="Elegir foto del servicio"
        />
        {procesandoFoto && <span className="zona-foto-cargando">Preparando foto…</span>}
      </div>
      {vistaFoto && (
        <div className="zona-foto-acciones">
          <label htmlFor="foto-servicio" className="boton-texto">
            Cambiar foto
          </label>
          <button type="button" className="boton-texto" onClick={eliminarFoto}>
            Quitar foto
          </button>
        </div>
      )}

      <div className="campo">
        <label htmlFor="srv-nombre">Nombre</label>
        <input
          id="srv-nombre"
          value={form.nombre}
          maxLength={80}
          onChange={(e) => cambiar("nombre", e.target.value)}
          placeholder="Ej: Soft Gel"
          required
        />
      </div>

      <div className="campo">
        <label htmlFor="srv-categoria">Categoría</label>
        <select
          id="srv-categoria"
          value={form.id_categoria}
          onChange={(e) => cambiar("id_categoria", e.target.value)}
        >
          {categorias.map((c) => (
            <option key={c.id_categoria} value={c.id_categoria}>
              {c.nombre}
              {c.activo ? "" : " (deshabilitada)"}
            </option>
          ))}
        </select>
      </div>

      <div className="campo">
        <label htmlFor="srv-descripcion">
          Descripción <span className="campo-contador">{form.descripcion.length}/400</span>
        </label>
        <textarea
          id="srv-descripcion"
          rows={3}
          maxLength={400}
          value={form.descripcion}
          onChange={(e) => cambiar("descripcion", e.target.value)}
          placeholder="Ej: Un solo tono + 2 diseños simples."
        />
      </div>

      <div className="campo-fila">
        <div className="campo">
          <label htmlFor="srv-duracion">Duración (minutos)</label>
          <input
            id="srv-duracion"
            type="number"
            min="5"
            max="600"
            step="5"
            value={form.duracion_minutos}
            onChange={(e) => cambiar("duracion_minutos", e.target.value)}
            required
          />
        </div>
        <div className="campo">
          <label htmlFor="srv-tipo">Tipo de precio</label>
          <select id="srv-tipo" value={form.tipo_precio} onChange={(e) => cambiar("tipo_precio", e.target.value)}>
            <option value="FIJO">Precio fijo</option>
            <option value="DESDE">Desde (precio base)</option>
            <option value="EVALUACION">Según evaluación</option>
          </select>
        </div>
      </div>

      {form.tipo_precio === "EVALUACION" ? (
        <p className="bloque-ayuda">
          Se muestra como “Según evaluación” y no se reserva online: la clienta lo cotiza por WhatsApp.
        </p>
      ) : (
        <div className="editor-variantes">
          {variantes.length === 0 ? (
            <div className="campo">
              <label htmlFor="srv-precio">Precio (CLP)</label>
              <input
                id="srv-precio"
                type="number"
                min="0"
                step="1"
                value={form.precio}
                onChange={(e) => cambiar("precio", e.target.value)}
                placeholder="15000"
                required
              />
            </div>
          ) : (
            <div className="variantes-tabla" role="group" aria-label="Precios por largo">
              <p className="variantes-titulo">Precio según largo</p>
              {variantes.map((v, i) => (
                <div key={i} className="variante-fila">
                  <input
                    aria-label="Nombre (ej. S)"
                    value={v.nombre}
                    maxLength={40}
                    onChange={(e) => setVariantes((l) => l.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))}
                    placeholder="S"
                  />
                  <input
                    aria-label="Detalle (ej. Hasta hombros)"
                    value={v.detalle}
                    maxLength={60}
                    onChange={(e) => setVariantes((l) => l.map((x, j) => (j === i ? { ...x, detalle: e.target.value } : x)))}
                    placeholder="Hasta hombros"
                  />
                  <input
                    aria-label="Precio"
                    type="number"
                    min="0"
                    step="1"
                    value={v.precio}
                    onChange={(e) => setVariantes((l) => l.map((x, j) => (j === i ? { ...x, precio: e.target.value } : x)))}
                    placeholder="25000"
                  />
                  <button type="button" className="tramo-quitar" aria-label="Quitar" onClick={() => setVariantes((l) => l.filter((_, j) => j !== i))}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="variantes-acciones">
            {variantes.length === 0 && (
              <button
                type="button"
                className="boton-texto"
                onClick={() =>
                  setVariantes([
                    { nombre: "S", detalle: "Hasta hombros", precio: form.precio || "" },
                    { nombre: "M", detalle: "Hasta axila", precio: "" },
                    { nombre: "L", detalle: "Hasta codo", precio: "" },
                    { nombre: "XL", detalle: "Bajo codo", precio: "" },
                  ])
                }
              >
                Usar precios por largo de cabello (S, M, L, XL)
              </button>
            )}
            {variantes.length > 0 && (
              <button type="button" className="boton-texto" onClick={() => setVariantes((l) => [...l, { nombre: "", detalle: "", precio: "" }])}>
                + Agregar largo
              </button>
            )}
          </div>
        </div>
      )}

      <div className="editor-vista">
        <p>Así se verá en la lista de precios</p>
        <FilaServicio
          soloVista
          nombreCategoria={categoriaActual?.nombre}
          servicio={{
            ...form,
            imagen_url: vistaFoto,
            variantes: form.tipo_precio === "EVALUACION" ? [] : variantes.filter((v) => v.nombre && v.precio !== "").map((v) => ({ ...v, precio: Number(v.precio) })),
            precio_desde: variantes.filter((v) => v.precio !== "").length
              ? Math.min(...variantes.filter((v) => v.precio !== "").map((v) => Number(v.precio)))
              : Number(form.precio),
          }}
        />
      </div>

      <div className="editor-acciones">
        {!esNuevo && (
          <button
            type="button"
            className="boton-texto editor-estado"
            onClick={alternarEstado}
            disabled={guardando}
          >
            {servicio.activo ? "Deshabilitar servicio" : "Reactivar servicio"}
          </button>
        )}
        <button type="button" className="boton boton-linea" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
        <button type="submit" className="boton boton-cacao" disabled={guardando || procesandoFoto}>
          {guardando ? "Guardando…" : esNuevo ? "Agregar servicio" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Editor de categoria (Administrador)                                */
/* ------------------------------------------------------------------ */

function EditorCategoria({ token, categoria, onCancelar, onGuardado }) {
  const [form, setForm] = useState({
    nombre: categoria?.nombre || "",
    descripcion: categoria?.descripcion || "",
    abono: categoria?.abono ?? "",
    indicaciones: categoria?.indicaciones || "",
    adicionales: categoria?.adicionales || "",
    orden: categoria?.orden ?? 0,
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function guardar(e) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      if (categoria) {
        await api.actualizarCategoria(categoria.id_categoria, { ...form, abono: form.abono === "" ? null : Number(form.abono) }, token);
        onGuardado("Categoría actualizada");
      } else {
        await api.crearCategoria({ ...form, abono: form.abono === "" ? null : Number(form.abono) }, token);
        onGuardado(`Categoría “${form.nombre}” creada`);
      }
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <form className="editor" onSubmit={guardar}>
      <p className="editor-sobretitulo">{categoria ? "Editar categoría" : "Nueva categoría"}</p>
      <h2 className="editor-titulo">{form.nombre || "Categoría"}</h2>

      {error && (
        <div className="aviso aviso-error" role="alert">
          <span>{error}</span>
        </div>
      )}

      <div className="campo">
        <label htmlFor="cat-nombre">Nombre</label>
        <input
          id="cat-nombre"
          value={form.nombre}
          maxLength={60}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          placeholder="Ej: Pedicura y podología"
          required
        />
      </div>
      <div className="campo">
        <label htmlFor="cat-descripcion">Descripción (opcional)</label>
        <input
          id="cat-descripcion"
          value={form.descripcion}
          maxLength={255}
          onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
          placeholder="Una frase corta que aparece bajo el título"
        />
      </div>
      <div className="campo">
        <label htmlFor="cat-abono">Abono para reservar (CLP)</label>
        <input
          id="cat-abono"
          type="number"
          min="1000"
          step="500"
          value={form.abono}
          onChange={(e) => setForm((f) => ({ ...f, abono: e.target.value }))}
          placeholder="Vacío = abono general ($5.000)"
        />
        <small className="bloque-ayuda">
          Ej: $10.000 para servicios de cabello. Si un servicio cuesta menos que el abono, se abona su precio.
        </small>
      </div>
      <div className="campo">
        <label htmlFor="cat-orden">Posición en la página (1 = primera)</label>
        <input
          id="cat-orden"
          type="number"
          min="0"
          max="999"
          value={form.orden}
          onChange={(e) => setForm((f) => ({ ...f, orden: e.target.value }))}
        />
      </div>
      <div className="campo">
        <label htmlFor="cat-indicaciones">
          Indicaciones importantes <span className="campo-contador">una por línea</span>
        </label>
        <textarea
          id="cat-indicaciones"
          rows={4}
          maxLength={2000}
          value={form.indicaciones}
          onChange={(e) => setForm((f) => ({ ...f, indicaciones: e.target.value }))}
          placeholder="Ej: Ven con tus pestañas limpias, sin maquillaje 24 horas antes."
        />
        <small className="bloque-ayuda">Se muestran en la lista de precios y antes de confirmar la reserva.</small>
      </div>
      <div className="campo">
        <label htmlFor="cat-adicionales">
          Adicionales <span className="campo-contador">nombre | precio | detalle</span>
        </label>
        <textarea
          id="cat-adicionales"
          rows={3}
          maxLength={2000}
          value={form.adicionales}
          onChange={(e) => setForm((f) => ({ ...f, adicionales: e.target.value }))}
          placeholder={"Francesa o degradé | + $5.000 | + 2 diseños simples\nDiseños aparte | $1.000 el par"}
        />
      </div>

      <div className="editor-acciones">
        <button type="button" className="boton boton-linea" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
        <button type="submit" className="boton boton-cacao" disabled={guardando}>
          {guardando ? "Guardando…" : categoria ? "Guardar cambios" : "Crear categoría"}
        </button>
      </div>
    </form>
  );
}
