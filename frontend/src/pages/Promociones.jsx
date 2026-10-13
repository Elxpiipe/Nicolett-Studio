// Panel: promociones del carrusel del Inicio (crear, editar, ocultar, eliminar)
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, urlImagen } from "../api/client";
import { prepararImagen } from "../utils/formato";
import BarraSitio from "../components/marca/BarraSitio";
import SubnavPanel from "../components/marca/SubnavPanel";
import PieMarca from "../components/marca/PieMarca";
import Hoja from "../components/marca/Hoja";
import { IconoFoto } from "../components/marca/Iconos";
import "../styles/marca.css";
import "../styles/equipo.css";
import "../styles/catalogo.css";
import "../styles/gestion.css";
import "../styles/promociones.css";

const ENLACES = [
  { valor: "", texto: "Sin enlace" },
  { valor: "/reservar", texto: "Reservar hora" },
  { valor: "/servicios", texto: "Servicios y precios" },
  { valor: "/tienda", texto: "Tienda" },
  { valor: "/contacto", texto: "Contacto" },
];

function estadoPromo(p, hoy) {
  if (!p.activo) return { texto: "Oculta", tono: "neutro" };
  if (!p.imagen_url) return { texto: "Falta la imagen", tono: "error" };
  if (p.fecha_inicio && p.fecha_inicio > hoy) return { texto: `Programada desde el ${fecha(p.fecha_inicio)}`, tono: "espera" };
  if (p.fecha_fin && p.fecha_fin < hoy) return { texto: "Vencida", tono: "neutro" };
  return { texto: p.fecha_fin ? `Visible hasta el ${fecha(p.fecha_fin)}` : "Visible", tono: "ok" };
}

function fecha(f) {
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" }).format(new Date(`${f}T12:00:00`));
}

export default function Promociones() {
  const { token } = useAuth();
  const [datos, setDatos] = useState(null);
  const [hoy, setHoy] = useState("");
  const [hoja, setHoja] = useState(null); // { promo? }
  const [aviso, setAviso] = useState(null);

  async function cargar() {
    try {
      const r = await api.promocionesAdmin(token);
      setDatos(r.datos);
      setHoy(r.hoy);
    } catch (err) {
      setDatos([]);
      setAviso({ tipo: "error", texto: err.message });
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function eliminar(p) {
    if (!window.confirm(`¿Eliminar la promoción “${p.titulo}”? Esta acción no se puede deshacer.`)) return;
    try {
      await api.eliminarPromocion(p.id_promocion, token);
      setAviso({ tipo: "exito", texto: "Promoción eliminada" });
      cargar();
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    }
  }

  async function alternar(p) {
    try {
      await api.actualizarPromocion(p.id_promocion, { activo: !p.activo }, token);
      cargar();
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    }
  }

  return (
    <div className="pagina-marca">
      <BarraSitio />
      <SubnavPanel />

      <main className="equipo">
        <header className="equipo-cabecera">
          <h1>Promociones</h1>
          <p>Las imágenes que subas aparecen en el carrusel del Inicio durante las fechas que elijas.</p>
        </header>

        <div className="catalogo-herramientas">
          <p>Usa imágenes verticales, como tus publicaciones de Instagram (se muestran completas).</p>
          <button type="button" className="boton boton-cacao" onClick={() => setHoja({})}>
            + Nueva promoción
          </button>
        </div>

        {aviso && (
          <div className={`aviso aviso-${aviso.tipo}`} role={aviso.tipo === "error" ? "alert" : "status"}>
            <span>{aviso.texto}</span>
            <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">×</button>
          </div>
        )}

        {datos === null ? (
          <p className="equipo-estado">Cargando…</p>
        ) : datos.length === 0 ? (
          <p className="gestion-vacio">Aún no hay promociones. Crea la primera con “Nueva promoción”.</p>
        ) : (
          <ul className="promos-admin">
            {datos.map((p) => {
              const e = estadoPromo(p, hoy);
              return (
                <li key={p.id_promocion} className={p.activo ? "" : "promo-oculta"}>
                  <button type="button" className="promo-admin-imagen" onClick={() => setHoja({ promo: p })} aria-label={`Editar ${p.titulo}`}>
                    {p.imagen_url ? <img src={urlImagen(p.imagen_url)} alt="" /> : <IconoFoto />}
                  </button>
                  <div className="promo-admin-texto">
                    <span className={`estado estado-${e.tono}`}>{e.texto}</span>
                    <strong>{p.titulo}</strong>
                    {p.descripcion && <small>{p.descripcion}</small>}
                    <div className="promo-admin-acciones">
                      <button type="button" className="boton-texto" onClick={() => setHoja({ promo: p })}>Editar</button>
                      <button type="button" className="boton-texto" onClick={() => alternar(p)}>{p.activo ? "Ocultar" : "Mostrar"}</button>
                      <button type="button" className="boton-texto cita-cancelar" onClick={() => eliminar(p)}>Eliminar</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <PieMarca />

      {hoja && (
        <Hoja titulo={hoja.promo ? "Editar promoción" : "Nueva promoción"} onCerrar={() => setHoja(null)}>
          <EditorPromocion
            token={token}
            promo={hoja.promo}
            onCancelar={() => setHoja(null)}
            onGuardado={(texto) => {
              setHoja(null);
              setAviso({ tipo: "exito", texto });
              cargar();
            }}
          />
        </Hoja>
      )}
    </div>
  );
}

function EditorPromocion({ token, promo, onCancelar, onGuardado }) {
  const [form, setForm] = useState({
    titulo: promo?.titulo || "",
    descripcion: promo?.descripcion || "",
    enlace: promo?.enlace || "",
    fecha_inicio: promo?.fecha_inicio || "",
    fecha_fin: promo?.fecha_fin || "",
    orden: promo?.orden ?? 0,
    activo: promo ? Boolean(promo.activo) : true,
  });
  const [archivo, setArchivo] = useState(null);
  const [vista, setVista] = useState(urlImagen(promo?.imagen_url));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const refInput = useRef(null);
  const cambiar = (c) => (e) => setForm((f) => ({ ...f, [c]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const enlacePropio = form.enlace && !ENLACES.some((x) => x.valor === form.enlace);

  useEffect(() => () => vista?.startsWith("blob:") && URL.revokeObjectURL(vista), [vista]);

  async function elegirFoto(f) {
    if (!f) return;
    try {
      // Imagen vertical de buena calidad: se permite un poco mas grande que las fotos de servicios
      const lista = await prepararImagen(f, { maxLado: 1600, calidad: 0.88 });
      setArchivo(lista);
      setVista(URL.createObjectURL(lista));
    } catch (err) {
      setError(err.message);
    }
  }

  async function guardar(e) {
    e.preventDefault();
    setError("");
    if (!vista) {
      setError("Sube la imagen de la promoción.");
      return;
    }
    setGuardando(true);
    try {
      const payload = { ...form, orden: Number(form.orden) || 0 };
      const res = promo
        ? await api.actualizarPromocion(promo.id_promocion, payload, token)
        : await api.crearPromocion(payload, token);
      if (archivo) await api.subirImagenPromocion(res.promocion.id_promocion, archivo, token);
      onGuardado(promo ? "Promoción actualizada" : "Promoción creada");
    } catch (err) {
      setError(err.detalles?.map((d) => d.mensaje).join(". ") || err.message);
      setGuardando(false);
    }
  }

  return (
    <form className="editor" onSubmit={guardar}>
      <p className="editor-sobretitulo">Carrusel del Inicio</p>
      <h2 className="editor-titulo">{promo ? "Editar promoción" : "Nueva promoción"}</h2>
      {error && (
        <div className="aviso aviso-error" role="alert">
          <span>{error}</span>
        </div>
      )}

      <div className={`zona-foto zona-foto-promo ${vista ? "zona-foto-con-imagen" : ""}`}>
        {vista ? (
          <img src={vista} alt="Imagen de la promoción" />
        ) : (
          <div className="zona-foto-vacia">
            <IconoFoto className="zona-foto-icono" />
            <p>
              Arrastra la imagen o <strong>elígela desde tu equipo</strong>
            </p>
            <small>Vertical, como un post de Instagram. JPG, PNG o WEBP.</small>
          </div>
        )}
        <input
          ref={refInput}
          id="foto-promo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="zona-foto-input"
          onChange={(e) => elegirFoto(e.target.files?.[0])}
          aria-label="Elegir imagen de la promoción"
        />
      </div>
      {vista && (
        <div className="zona-foto-acciones">
          <label htmlFor="foto-promo" className="boton-texto">Cambiar imagen</label>
        </div>
      )}

      <div className="campo">
        <label htmlFor="pr-titulo">Título</label>
        <input id="pr-titulo" value={form.titulo} onChange={cambiar("titulo")} maxLength={80} required placeholder="Ej: Mes de la pestaña" />
      </div>
      <div className="campo">
        <label htmlFor="pr-desc">
          Texto corto (opcional) <span className="campo-contador">{form.descripcion.length}/200</span>
        </label>
        <input id="pr-desc" value={form.descripcion} onChange={cambiar("descripcion")} maxLength={200} placeholder="Ej: 20% de descuento en lifting durante octubre" />
      </div>
      <div className="campo">
        <label htmlFor="pr-enlace">Al tocar “Ver más” lleva a…</label>
        <select
          id="pr-enlace"
          value={enlacePropio ? "__otro" : form.enlace}
          onChange={(e) => setForm((f) => ({ ...f, enlace: e.target.value === "__otro" ? "https://" : e.target.value }))}
        >
          {ENLACES.map((x) => (
            <option key={x.valor} value={x.valor}>{x.texto}</option>
          ))}
          <option value="__otro">Otra dirección…</option>
        </select>
        {enlacePropio && (
          <input
            className="campo-extra"
            value={form.enlace}
            onChange={cambiar("enlace")}
            placeholder="/reservar?servicio=12  o  https://..."
            aria-label="Dirección del enlace"
          />
        )}
      </div>
      <div className="campo-fila">
        <div className="campo">
          <label htmlFor="pr-desde">Mostrar desde</label>
          <input id="pr-desde" type="date" value={form.fecha_inicio} onChange={cambiar("fecha_inicio")} />
        </div>
        <div className="campo">
          <label htmlFor="pr-hasta">Hasta</label>
          <input id="pr-hasta" type="date" value={form.fecha_fin} min={form.fecha_inicio || undefined} onChange={cambiar("fecha_fin")} />
        </div>
      </div>
      <p className="bloque-ayuda">Sin fechas, se muestra siempre (mientras esté visible).</p>
      <div className="perfil-opciones">
        <label className="interruptor">
          <input type="checkbox" checked={form.activo} onChange={cambiar("activo")} />
          <span>Visible en el Inicio</span>
        </label>
        <label className="perfil-orden">
          Orden
          <input type="number" min="0" max="999" value={form.orden} onChange={cambiar("orden")} />
        </label>
      </div>

      <div className="editor-acciones">
        <button type="button" className="boton boton-linea" onClick={onCancelar} disabled={guardando}>Cancelar</button>
        <button type="submit" className="boton boton-cacao" disabled={guardando}>
          {guardando ? "Guardando…" : promo ? "Guardar cambios" : "Crear promoción"}
        </button>
      </div>
    </form>
  );
}
