import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import BarraSitio from "../components/marca/BarraSitio";
import SubnavPanel from "../components/marca/SubnavPanel";
import Hoja from "../components/marca/Hoja";
import { FotoPerfil } from "../components/marca/Fotos";
import { prepararImagen } from "../utils/formato";
import PieMarca from "../components/marca/PieMarca";
import { IconoCategoria } from "../components/marca/Iconos";
import { formatearDuracion } from "../utils/formato";
import "../styles/marca.css";
import "../styles/equipo.css";

const DIAS = [
  { n: 1, nombre: "Lunes" },
  { n: 2, nombre: "Martes" },
  { n: 3, nombre: "Miércoles" },
  { n: 4, nombre: "Jueves" },
  { n: 5, nombre: "Viernes" },
  { n: 6, nombre: "Sábado" },
  { n: 7, nombre: "Domingo" },
];

// Opciones de hora cada 15 minutos (07:00 a 22:00), siempre en formato 24 h
const OPCIONES_HORA = Array.from({ length: (22 - 7) * 4 + 1 }, (_, i) => {
  const minutos = 7 * 60 + i * 15;
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
});

function SelectorHora({ value, onChange, etiqueta }) {
  const opciones = OPCIONES_HORA.includes(value) ? OPCIONES_HORA : [value, ...OPCIONES_HORA].sort();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={etiqueta}>
      {opciones.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
  );
}

export default function Equipo() {
  const { usuario, token } = useAuth();
  const esAdmin = usuario.rol === "Administrador";

  const [profesionales, setProfesionales] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [idSeleccionada, setIdSeleccionada] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState(null);
  const [creando, setCreando] = useState(false);

  async function cargar() {
    try {
      const [resPro, resSrv] = await Promise.all([
        api.listarProfesionales(token),
        api.listarServicios("activo=1"),
      ]);
      setProfesionales(resPro.datos);
      setServicios(resSrv.datos);
      setIdSeleccionada((actual) => actual ?? resPro.datos[0]?.id_profesional ?? null);
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (aviso?.tipo !== "exito") return;
    const t = setTimeout(() => setAviso(null), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  const seleccionada = profesionales.find((p) => p.id_profesional === idSeleccionada);

  // Al guardar, se reemplaza la ficha actualizada sin recargar todo
  function actualizarFicha(ficha, texto) {
    setProfesionales((lista) => lista.map((p) => (p.id_profesional === ficha.id_profesional ? ficha : p)));
    if (texto) setAviso({ tipo: "exito", texto });
  }

  const avisarError = (texto) => setAviso({ tipo: "error", texto });

  async function activarMiPerfil() {
    try {
      const { profesional } = await api.crearPerfilPropio({ cargo: "Fundadora" }, token);
      setProfesionales((lista) => [...lista, profesional]);
      setIdSeleccionada(profesional.id_profesional);
      setAviso({
        tipo: "exito",
        texto: "Listo: ya eres parte del equipo. Asígnate servicios y horario, y marca tu perfil como destacado en “Nosotras”.",
      });
    } catch (err) {
      avisarError(err.message);
    }
  }

  return (
    <div className="pagina-marca">
      <BarraSitio />
      <SubnavPanel />

      <main className="equipo">
        <header className="equipo-cabecera">
          <h1>{esAdmin ? "Equipo y horarios" : "Mi horario"}</h1>
          <p>
            {esAdmin
              ? "Lo que configures aquí define las horas que las clientas pueden reservar."
              : "Tu horario lo define la administración. Tú puedes bloquear tu agenda cuando no puedas atender."}
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

        {esAdmin && !cargando && !profesionales.some((p) => p.id_usuario === usuario.id_usuario) && (
          <div className="yo-atiendo">
            <div>
              <strong>¿Tú también atiendes clientas?</strong>
              <span>
                Activa tu perfil de profesional con esta misma cuenta: aparecerás en “Nosotras” y podrás recibir
                reservas, sin necesidad de una segunda cuenta.
              </span>
            </div>
            <button type="button" className="boton boton-cacao" onClick={activarMiPerfil}>
              Sí, yo también atiendo
            </button>
          </div>
        )}

        {cargando ? (
          <p className="equipo-estado">Cargando equipo…</p>
        ) : profesionales.length === 0 ? (
          <div className="equipo-vacio">
            <p>
              {esAdmin
                ? "Aún no hay profesionales. Crea la primera para configurar sus servicios, horario y su perfil en la página “Nosotras”."
                : "Tu perfil de profesional no está disponible. Contacta a la administración."}
            </p>
            {esAdmin && (
              <button type="button" className="boton boton-cacao" onClick={() => setCreando(true)}>
                + Nueva profesional
              </button>
            )}
          </div>
        ) : (
          <>
            {esAdmin && (
              <nav className="selector-equipo" aria-label="Profesionales">
                <button type="button" className="selector-nueva" onClick={() => setCreando(true)}>
                  + Nueva profesional
                </button>
                {profesionales.map((p) => (
                  <button
                    key={p.id_profesional}
                    type="button"
                    className={`selector-persona ${p.activo ? "" : "selector-inactiva"}`}
                    aria-pressed={p.id_profesional === idSeleccionada}
                    onClick={() => setIdSeleccionada(p.id_profesional)}
                  >
                    <FotoPerfil profesional={p} tamano="mini" />
                    <span className="selector-texto">
                      <span className="selector-nombre">
                        {p.nombres} {p.apellidos}
                        {Boolean(p.es_administradora) && <span className="insignia-admin">Admin</span>}
                      </span>
                      <span className="selector-meta">
                        {!p.activo
                          ? "Desactivada"
                          : !p.usuario_activo
                          ? "Cuenta deshabilitada"
                          : p.horario.length === 0
                          ? "Sin horario"
                          : p.servicios.length === 0
                          ? "Sin servicios"
                          : `${p.servicios.length} servicio(s)`}
                      </span>
                    </span>
                  </button>
                ))}
              </nav>
            )}

            {seleccionada && (
              <FichaProfesional
                key={seleccionada.id_profesional}
                profesional={seleccionada}
                servicios={servicios}
                esAdmin={esAdmin}
                esYo={seleccionada.id_usuario === usuario.id_usuario}
                token={token}
                onActualizada={actualizarFicha}
                onError={avisarError}
                onExito={(texto) => setAviso({ tipo: "exito", texto })}
              />
            )}
          </>
        )}
      </main>

      <PieMarca />

      {creando && (
        <Hoja titulo="Nueva profesional" onCerrar={() => setCreando(false)}>
          <NuevaProfesional
            token={token}
            onCancelar={() => setCreando(false)}
            onCreada={(ficha) => {
              setCreando(false);
              setProfesionales((lista) => [...lista, ficha]);
              setIdSeleccionada(ficha.id_profesional);
              setAviso({ tipo: "exito", texto: `${ficha.nombres} fue creada. Ahora asígnale servicios y horario.` });
            }}
          />
        </Hoja>
      )}
    </div>
  );
}

function FichaProfesional({ profesional, servicios, esAdmin, esYo, token, onActualizada, onError, onExito }) {
  // Sube cada vez que cambian los bloqueos, para refrescar la vista previa de horas
  const [versionAgenda, setVersionAgenda] = useState(0);
  const listaPara = !profesional.usuario_activo
    ? "Su cuenta está deshabilitada: no recibe reservas."
    : profesional.horario.length === 0 || profesional.servicios.length === 0
    ? "Aún no recibe reservas: necesita al menos un servicio y un horario."
    : null;

  async function alternarAdmin() {
    const dar = !profesional.es_administradora;
    const texto = dar
      ? `¿Dar acceso de administradora a ${profesional.nombres}? Podrá ver y cambiar todo el sistema (reservas, precios, equipo).`
      : `¿Quitar el acceso de administradora a ${profesional.nombres}? Seguirá atendiendo como profesional.`;
    if (!window.confirm(texto)) return;
    try {
      const res = await api.cambiarAccesoAdmin(profesional.id_profesional, dar, token);
      onActualizada(res.profesional, dar ? `${profesional.nombres} ahora también es administradora` : "Acceso de administradora quitado");
    } catch (err) {
      onError(err.message);
    }
  }

  async function alternarActiva() {
    try {
      const res = await api.cambiarEstadoProfesional(profesional.id_profesional, !profesional.activo, token);
      onActualizada(
        res.profesional,
        res.profesional.activo
          ? `${profesional.nombres} está activa otra vez`
          : `${profesional.nombres} fue desactivada: ya no aparece en el sitio ni recibe reservas`
      );
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <section className="ficha" aria-label={`${profesional.nombres} ${profesional.apellidos}`}>
      <div className="ficha-titulo">
        <div>
          <h2>
            {profesional.nombres} {profesional.apellidos}
          </h2>
          {profesional.cargo && <p>{profesional.cargo}</p>}
          {Boolean(profesional.es_administradora) && (
            <p className="ficha-admin">
              {esYo ? "Esta es tu cuenta: administras el sistema y también atiendes." : "También es administradora del sistema."}
            </p>
          )}
          {!profesional.activo ? (
            <p className="ficha-alerta">Desactivada: no aparece en el sitio ni recibe reservas.</p>
          ) : (
            listaPara && <p className="ficha-alerta">{listaPara}</p>
          )}
        </div>
        {esAdmin && (
          <div className="ficha-botones">
            {!esYo && (
              <button type="button" className="boton-texto" onClick={alternarAdmin}>
                {profesional.es_administradora ? "Quitar acceso de administradora" : "Dar acceso de administradora"}
              </button>
            )}
            <button type="button" className="boton boton-linea" onClick={alternarActiva}>
              {profesional.activo ? "Desactivar profesional" : "Reactivar profesional"}
            </button>
          </div>
        )}
      </div>

      {esAdmin && (
        <PerfilPublico
          profesional={profesional}
          token={token}
          onGuardado={(ficha, texto) => onActualizada(ficha, texto)}
          onError={onError}
        />
      )}

      <div className="ficha-grilla">
        <HorarioSemanal
          profesional={profesional}
          editable={esAdmin}
          token={token}
          onGuardado={(ficha) => onActualizada(ficha, "Horario guardado")}
          onError={onError}
        />

        <div className="ficha-columna">
          <ServiciosProfesional
            profesional={profesional}
            servicios={servicios}
            editable={esAdmin}
            token={token}
            onGuardado={(ficha) => onActualizada(ficha, "Servicios actualizados")}
            onError={onError}
          />
          <Bloqueos
            profesional={profesional}
            token={token}
            onError={onError}
            onExito={(texto) => {
              onExito(texto);
              setVersionAgenda((v) => v + 1);
            }}
          />
          <ProbarDisponibilidad profesional={profesional} servicios={servicios} version={versionAgenda} />
        </div>
      </div>
    </section>
  );
}

/* ---------------- Horario semanal ---------------- */

function agruparHorario(horario) {
  const porDia = {};
  for (const d of DIAS) porDia[d.n] = [];
  for (const t of horario) porDia[t.dia_semana].push({ hora_inicio: t.hora_inicio, hora_fin: t.hora_fin });
  return porDia;
}

function HorarioSemanal({ profesional, editable, token, onGuardado, onError }) {
  const [dias, setDias] = useState(() => agruparHorario(profesional.horario));
  const [guardando, setGuardando] = useState(false);
  const original = useMemo(() => JSON.stringify(agruparHorario(profesional.horario)), [profesional.horario]);
  const hayCambios = JSON.stringify(dias) !== original;

  function cambiarTramo(dia, i, campo, valor) {
    setDias((d) => ({ ...d, [dia]: d[dia].map((t, j) => (j === i ? { ...t, [campo]: valor } : t)) }));
  }

  function agregarTramo(dia) {
    setDias((d) => {
      const ultimo = d[dia][d[dia].length - 1];
      const nuevo = ultimo ? { hora_inicio: ultimo.hora_fin, hora_fin: "19:00" } : { hora_inicio: "10:00", hora_fin: "19:00" };
      return { ...d, [dia]: [...d[dia], nuevo] };
    });
  }

  function quitarTramo(dia, i) {
    setDias((d) => ({ ...d, [dia]: d[dia].filter((_, j) => j !== i) }));
  }

  function copiarLunes() {
    setDias((d) => {
      const copia = { ...d };
      for (const n of [2, 3, 4, 5]) copia[n] = d[1].map((t) => ({ ...t }));
      return copia;
    });
  }

  async function guardar() {
    setGuardando(true);
    const tramos = DIAS.flatMap(({ n }) => dias[n].map((t) => ({ dia_semana: n, ...t })));
    try {
      const res = await api.guardarHorarioProfesional(profesional.id_profesional, tramos, token);
      setDias(agruparHorario(res.profesional.horario)); // queda ordenado como en la BD
      onGuardado(res.profesional);
    } catch (err) {
      onError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="bloque bloque-horario">
      <div className="bloque-cabecera">
        <h3>Horario semanal</h3>
        {editable && dias[1].length > 0 && (
          <button type="button" className="boton-texto" onClick={copiarLunes}>
            Copiar lunes a martes–viernes
          </button>
        )}
      </div>
      <p className="bloque-ayuda">
        {editable
          ? "Agrega dos tramos en un mismo día para dejar la colación fuera de la agenda."
          : "Si necesitas un cambio permanente, pídeselo a la administración."}
      </p>

      <ul className="semana">
        {DIAS.map(({ n, nombre }) => {
          const tramos = dias[n];
          const abierto = tramos.length > 0;
          return (
            <li key={n} className={`dia ${abierto ? "" : "dia-cerrado"}`}>
              <span className="dia-nombre">{nombre}</span>
              <div className="dia-tramos">
                {!abierto && <span className="dia-libre">Cerrado</span>}
                {tramos.map((t, i) =>
                  editable ? (
                    <span key={i} className="tramo">
                      <SelectorHora
                        value={t.hora_inicio}
                        etiqueta={`${nombre}, inicio del tramo ${i + 1}`}
                        onChange={(v) => cambiarTramo(n, i, "hora_inicio", v)}
                      />
                      <span aria-hidden="true">a</span>
                      <SelectorHora
                        value={t.hora_fin}
                        etiqueta={`${nombre}, término del tramo ${i + 1}`}
                        onChange={(v) => cambiarTramo(n, i, "hora_fin", v)}
                      />
                      <button
                        type="button"
                        className="tramo-quitar"
                        onClick={() => quitarTramo(n, i)}
                        aria-label={`Quitar tramo ${i + 1} del ${nombre}`}
                      >
                        ×
                      </button>
                    </span>
                  ) : (
                    <span key={i} className="tramo tramo-lectura">
                      {t.hora_inicio} a {t.hora_fin}
                    </span>
                  )
                )}
              </div>
              {editable && (
                <button type="button" className="boton-texto dia-agregar" onClick={() => agregarTramo(n)}>
                  {abierto ? "+ tramo" : "Abrir"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {editable && (
        <div className="bloque-acciones">
          {hayCambios && (
            <button
              type="button"
              className="boton boton-linea"
              onClick={() => setDias(agruparHorario(profesional.horario))}
              disabled={guardando}
            >
              Descartar
            </button>
          )}
          <button type="button" className="boton boton-cacao" onClick={guardar} disabled={!hayCambios || guardando}>
            {guardando ? "Guardando…" : "Guardar horario"}
          </button>
        </div>
      )}
    </section>
  );
}

/* ---------------- Servicios que realiza ---------------- */

function ServiciosProfesional({ profesional, servicios, editable, token, onGuardado, onError }) {
  const inicial = useMemo(() => new Set(profesional.servicios.map((s) => s.id_servicio)), [profesional.servicios]);
  const [elegidos, setElegidos] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const hayCambios =
    elegidos.size !== inicial.size || [...elegidos].some((id) => !inicial.has(id));

  const porCategoria = useMemo(() => {
    const grupos = new Map();
    for (const s of servicios) {
      if (!grupos.has(s.categoria)) grupos.set(s.categoria, []);
      grupos.get(s.categoria).push(s);
    }
    return [...grupos.entries()];
  }, [servicios]);

  function alternar(id) {
    setElegidos((actual) => {
      const nuevo = new Set(actual);
      nuevo.has(id) ? nuevo.delete(id) : nuevo.add(id);
      return nuevo;
    });
  }

  function alternarCategoria(lista) {
    const todos = lista.every((s) => elegidos.has(s.id_servicio));
    setElegidos((actual) => {
      const nuevo = new Set(actual);
      lista.forEach((s) => (todos ? nuevo.delete(s.id_servicio) : nuevo.add(s.id_servicio)));
      return nuevo;
    });
  }

  async function guardar() {
    setGuardando(true);
    try {
      const res = await api.asignarServiciosProfesional(profesional.id_profesional, [...elegidos], token);
      onGuardado(res.profesional);
    } catch (err) {
      onError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!editable) {
    return (
      <section className="bloque">
        <h3>Servicios que realizas</h3>
        {profesional.servicios.length === 0 ? (
          <p className="bloque-ayuda">Aún no tienes servicios asignados.</p>
        ) : (
          <ul className="chips">
            {profesional.servicios.map((s) => (
              <li key={s.id_servicio} className="chip chip-activo">
                {s.nombre}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <section className="bloque">
      <div className="bloque-cabecera">
        <h3>Servicios que realiza</h3>
        <span className="bloque-contador">{elegidos.size} elegidos</span>
      </div>
      <div className="categorias-servicios">
        {porCategoria.map(([categoria, lista]) => {
          const todos = lista.every((s) => elegidos.has(s.id_servicio));
          return (
            <div key={categoria} className="grupo-servicios">
              <div className="grupo-cabecera">
                <IconoCategoria nombre={categoria} className="grupo-icono" />
                <span>{categoria}</span>
                <button type="button" className="boton-texto" onClick={() => alternarCategoria(lista)}>
                  {todos ? "Quitar todos" : "Todos"}
                </button>
              </div>
              <ul className="chips">
                {lista.map((s) => (
                  <li key={s.id_servicio}>
                    <button
                      type="button"
                      className={`chip ${elegidos.has(s.id_servicio) ? "chip-activo" : ""}`}
                      aria-pressed={elegidos.has(s.id_servicio)}
                      onClick={() => alternar(s.id_servicio)}
                    >
                      {s.nombre}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="bloque-acciones">
        <button type="button" className="boton boton-cacao" onClick={guardar} disabled={!hayCambios || guardando}>
          {guardando ? "Guardando…" : "Guardar servicios"}
        </button>
      </div>
    </section>
  );
}

/* ---------------- Bloqueos ---------------- */

function hoyChile() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" }).format(new Date());
}

function formatearRango(inicio, fin) {
  const fmt = (texto) =>
    new Intl.DateTimeFormat("es-CL", { weekday: "short", day: "numeric", month: "short" }).format(
      new Date(`${texto.slice(0, 10)}T12:00:00`)
    );
  const mismoDia = inicio.slice(0, 10) === fin.slice(0, 10);
  const todoElDia = inicio.slice(11) === "00:00" && (fin.slice(11) === "23:59" || fin.slice(11) === "00:00");
  if (mismoDia && todoElDia) return `${fmt(inicio)}, todo el día`;
  if (mismoDia) return `${fmt(inicio)}, ${inicio.slice(11)} a ${fin.slice(11)}`;
  return `${fmt(inicio)} ${inicio.slice(11)} al ${fmt(fin)} ${fin.slice(11)}`;
}

function Bloqueos({ profesional, token, onError, onExito }) {
  const [bloqueos, setBloqueos] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({
    desde: hoyChile(),
    hasta: hoyChile(),
    todoElDia: true,
    horaDesde: "10:00",
    horaHasta: "13:00",
    motivo: "",
  });
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    try {
      const res = await api.listarBloqueos(profesional.id_profesional, token);
      setBloqueos(res.datos);
    } catch (err) {
      onError(err.message);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profesional.id_profesional]);

  async function crear(e) {
    e.preventDefault();
    setGuardando(true);
    const payload = {
      fecha_hora_inicio: `${form.desde} ${form.todoElDia ? "00:00" : form.horaDesde}`,
      fecha_hora_fin: `${form.todoElDia ? form.hasta : form.desde} ${form.todoElDia ? "23:59" : form.horaHasta}`,
      motivo: form.motivo,
    };
    try {
      const res = await api.crearBloqueo(profesional.id_profesional, payload, token);
      onExito(
        res.citasAfectadas > 0
          ? `Bloqueo creado. Ojo: hay ${res.citasAfectadas} cita(s) ya tomadas en ese horario; reagéndalas con las clientas.`
          : "Bloqueo creado: esas horas ya no se ofrecen"
      );
      setAbierto(false);
      setForm((f) => ({ ...f, motivo: "" }));
      cargar();
    } catch (err) {
      onError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(bloqueo) {
    try {
      await api.eliminarBloqueo(profesional.id_profesional, bloqueo.id_bloqueo, token);
      onExito("Bloqueo eliminado: esas horas vuelven a estar disponibles");
      cargar();
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <section className="bloque">
      <div className="bloque-cabecera">
        <h3>Bloqueos de agenda</h3>
        {!abierto && (
          <button type="button" className="boton-texto" onClick={() => setAbierto(true)}>
            + Bloquear horario
          </button>
        )}
      </div>

      {abierto && (
        <form className="form-bloqueo" onSubmit={crear}>
          <label className="interruptor">
            <input
              type="checkbox"
              checked={form.todoElDia}
              onChange={(e) => setForm((f) => ({ ...f, todoElDia: e.target.checked }))}
            />
            <span>Días completos</span>
          </label>

          {form.todoElDia ? (
            <div className="campo-fila">
              <div className="campo">
                <label htmlFor="bq-desde">Desde</label>
                <input
                  id="bq-desde"
                  type="date"
                  min={hoyChile()}
                  value={form.desde}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, desde: e.target.value, hasta: f.hasta < e.target.value ? e.target.value : f.hasta }))
                  }
                  required
                />
              </div>
              <div className="campo">
                <label htmlFor="bq-hasta">Hasta</label>
                <input
                  id="bq-hasta"
                  type="date"
                  min={form.desde}
                  value={form.hasta}
                  onChange={(e) => setForm((f) => ({ ...f, hasta: e.target.value }))}
                  required
                />
              </div>
            </div>
          ) : (
            <>
              <div className="campo">
                <label htmlFor="bq-dia">Día</label>
                <input
                  id="bq-dia"
                  type="date"
                  min={hoyChile()}
                  value={form.desde}
                  onChange={(e) => setForm((f) => ({ ...f, desde: e.target.value }))}
                  required
                />
              </div>
              <div className="campo-fila">
                <div className="campo">
                  <label>Desde las</label>
                  <SelectorHora
                    value={form.horaDesde}
                    etiqueta="Desde las"
                    onChange={(v) => setForm((f) => ({ ...f, horaDesde: v }))}
                  />
                </div>
                <div className="campo">
                  <label>Hasta las</label>
                  <SelectorHora
                    value={form.horaHasta}
                    etiqueta="Hasta las"
                    onChange={(v) => setForm((f) => ({ ...f, horaHasta: v }))}
                  />
                </div>
              </div>
            </>
          )}

          <div className="campo">
            <label htmlFor="bq-motivo">Motivo (opcional, no lo ven las clientas)</label>
            <input
              id="bq-motivo"
              value={form.motivo}
              maxLength={120}
              placeholder="Ej: Vacaciones, trámite, capacitación"
              onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
            />
          </div>

          <div className="bloque-acciones">
            <button type="button" className="boton boton-linea" onClick={() => setAbierto(false)} disabled={guardando}>
              Cancelar
            </button>
            <button type="submit" className="boton boton-cacao" disabled={guardando}>
              {guardando ? "Guardando…" : "Bloquear"}
            </button>
          </div>
        </form>
      )}

      {bloqueos.length === 0 ? (
        !abierto && <p className="bloque-ayuda">No hay bloqueos próximos.</p>
      ) : (
        <ul className="lista-bloqueos">
          {bloqueos.map((b) => (
            <li key={b.id_bloqueo}>
              <span>
                <strong>{formatearRango(b.fecha_hora_inicio, b.fecha_hora_fin)}</strong>
                {b.motivo && <small>{b.motivo}</small>}
              </span>
              <button type="button" className="boton-texto" onClick={() => eliminar(b)}>
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------- Probar disponibilidad ---------------- */

function ProbarDisponibilidad({ profesional, servicios, version }) {
  const propios = servicios.filter((s) => profesional.servicios.some((p) => p.id_servicio === s.id_servicio));
  const [idServicio, setIdServicio] = useState(propios[0]?.id_servicio || "");
  const [dias, setDias] = useState([]);
  const [fecha, setFecha] = useState(null);
  const [horas, setHoras] = useState([]);
  const [cargando, setCargando] = useState(false);

  const servicio = propios.find((s) => s.id_servicio === Number(idServicio));

  useEffect(() => {
    if (!idServicio) return;
    api
      .diasDisponibles({ id_servicio: idServicio, id_profesional: profesional.id_profesional, dias: 14 })
      .then((res) => {
        setDias(res.datos);
        // Mantiene el dia elegido si sigue teniendo horas; si no, salta al primero con horas
        setFecha((actual) => {
          const sigue = res.datos.find((d) => d.fecha === actual && d.disponibles > 0);
          return sigue ? actual : res.datos.find((d) => d.disponibles > 0)?.fecha || null;
        });
      })
      .catch(() => setDias([]));
  }, [idServicio, profesional.id_profesional, profesional.horario, version]);

  useEffect(() => {
    if (!idServicio || !fecha) {
      setHoras([]);
      return;
    }
    setCargando(true);
    api
      .horasLibres({ id_servicio: idServicio, fecha, id_profesional: profesional.id_profesional })
      .then((res) => setHoras(res.horas))
      .catch(() => setHoras([]))
      .finally(() => setCargando(false));
  }, [idServicio, fecha, profesional.id_profesional, version, profesional.horario]);

  if (propios.length === 0) return null;

  return (
    <section className="bloque bloque-prueba">
      <h3>Así verán las clientas su agenda</h3>
      <div className="campo">
        <label htmlFor="pd-servicio">Servicio</label>
        <select id="pd-servicio" value={idServicio} onChange={(e) => setIdServicio(Number(e.target.value))}>
          {propios.map((s) => (
            <option key={s.id_servicio} value={s.id_servicio}>
              {s.nombre} ({formatearDuracion(s.duracion_minutos)})
            </option>
          ))}
        </select>
      </div>

      <ul className="tira-dias">
        {dias.map((d) => {
          const f = new Date(`${d.fecha}T12:00:00`);
          return (
            <li key={d.fecha}>
              <button
                type="button"
                className="tira-dia"
                disabled={d.disponibles === 0}
                aria-pressed={d.fecha === fecha}
                onClick={() => setFecha(d.fecha)}
              >
                <span>{new Intl.DateTimeFormat("es-CL", { weekday: "short" }).format(f)}</span>
                <strong>{f.getDate()}</strong>
              </button>
            </li>
          );
        })}
      </ul>

      {!fecha ? (
        <p className="bloque-ayuda">No hay horas libres en los próximos 14 días.</p>
      ) : cargando ? (
        <p className="bloque-ayuda">Buscando horas…</p>
      ) : (
        <>
          <ul className="horas">
            {horas.map((h) => (
              <li key={h.hora} className="hora">
                {h.hora}
              </li>
            ))}
          </ul>
          {servicio && (
            <p className="bloque-ayuda">
              {horas.length} hora(s) de inicio para {servicio.nombre}, que dura {formatearDuracion(servicio.duracion_minutos)}.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/* ---------------- Nueva profesional ---------------- */

function NuevaProfesional({ token, onCancelar, onCreada }) {
  const [form, setForm] = useState({ nombres: "", apellidos: "", email: "", telefono: "", password: "", cargo: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  async function crear(e) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      const res = await api.crearProfesional(form, token);
      onCreada(res.profesional);
    } catch (err) {
      setError(err.detalles?.map((d) => d.mensaje).join(". ") || err.message);
      setGuardando(false);
    }
  }

  return (
    <form className="editor" onSubmit={crear}>
      <p className="editor-sobretitulo">Equipo</p>
      <h2 className="editor-titulo">Nueva profesional</h2>
      <p className="bloque-ayuda">
        Se crea su cuenta con rol Profesional. Con el correo y la clave temporal podrá entrar a ver su
        horario y bloquear su agenda.
      </p>
      {error && (
        <div className="aviso aviso-error" role="alert">
          <span>{error}</span>
        </div>
      )}
      <div className="campo-fila">
        <div className="campo">
          <label htmlFor="np-nombres">Nombres</label>
          <input id="np-nombres" value={form.nombres} onChange={cambiar("nombres")} required maxLength={60} />
        </div>
        <div className="campo">
          <label htmlFor="np-apellidos">Apellidos</label>
          <input id="np-apellidos" value={form.apellidos} onChange={cambiar("apellidos")} required maxLength={60} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="np-cargo">Cargo (se muestra en “Nosotras”)</label>
        <input id="np-cargo" value={form.cargo} onChange={cambiar("cargo")} placeholder="Ej: Lashista" maxLength={80} />
      </div>
      <div className="campo">
        <label htmlFor="np-email">Correo</label>
        <input id="np-email" type="email" value={form.email} onChange={cambiar("email")} required />
      </div>
      <div className="campo-fila">
        <div className="campo">
          <label htmlFor="np-telefono">Teléfono (opcional)</label>
          <input id="np-telefono" value={form.telefono} onChange={cambiar("telefono")} maxLength={20} />
        </div>
        <div className="campo">
          <label htmlFor="np-password">Clave temporal</label>
          <input
            id="np-password"
            type="text"
            value={form.password}
            onChange={cambiar("password")}
            minLength={8}
            required
            autoComplete="off"
            placeholder="Mínimo 8 caracteres"
          />
        </div>
      </div>
      <div className="editor-acciones">
        <button type="button" className="boton boton-linea" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
        <button type="submit" className="boton boton-cacao" disabled={guardando}>
          {guardando ? "Creando…" : "Crear profesional"}
        </button>
      </div>
    </form>
  );
}

/* ---------------- Perfil publico (Nosotras) + calendario ---------------- */

function PerfilPublico({ profesional, token, onGuardado, onError }) {
  const inicial = {
    nombres: profesional.nombres || "",
    apellidos: profesional.apellidos || "",
    cargo: profesional.cargo || "",
    descripcion: profesional.descripcion || "",
    es_destacada: Boolean(profesional.es_destacada),
    visible_sitio: Boolean(profesional.visible_sitio),
    orden: profesional.orden ?? 0,
    alias_calendario: profesional.alias_calendario || "",
    google_calendar_id: profesional.google_calendar_id || "",
  };
  const [form, setForm] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const hayCambios = JSON.stringify(form) !== JSON.stringify(inicial);
  const cambiar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      const res = await api.actualizarProfesional(
        profesional.id_profesional,
        { ...form, orden: Number(form.orden) || 0 },
        token
      );
      onGuardado(res.profesional, "Perfil guardado");
    } catch (err) {
      onError(err.detalles?.map((d) => d.mensaje).join(". ") || err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function elegirFoto(archivo) {
    if (!archivo) return;
    setSubiendo(true);
    try {
      const lista = await prepararImagen(archivo, { maxLado: 1000 });
      const res = await api.subirFotoProfesional(profesional.id_profesional, lista, token);
      onGuardado(res.profesional, "Foto actualizada");
    } catch (err) {
      onError(err.message);
    } finally {
      setSubiendo(false);
    }
  }

  async function quitarFoto() {
    try {
      const res = await api.quitarFotoProfesional(profesional.id_profesional, token);
      onGuardado(res.profesional, "Foto eliminada: se muestra la imagen genérica");
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <form className="bloque perfil-publico" onSubmit={guardar}>
      <div className="bloque-cabecera">
        <h3>Perfil en el sitio</h3>
        <a href="/nosotras" target="_blank" rel="noreferrer" className="boton-texto">
          Ver “Nosotras”
        </a>
      </div>

      <div className="perfil-grilla">
        <div className="perfil-foto">
          <FotoPerfil profesional={profesional} />
          <div className="perfil-foto-acciones">
            <label className="boton boton-linea boton-chico">
              {subiendo ? "Subiendo…" : profesional.foto_url ? "Cambiar foto" : "Subir foto"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="visualmente-oculto"
                onChange={(e) => {
                  elegirFoto(e.target.files?.[0]);
                  e.target.value = "";
                }}
                disabled={subiendo}
              />
            </label>
            {profesional.foto_url && (
              <button type="button" className="boton-texto" onClick={quitarFoto}>
                Quitar
              </button>
            )}
          </div>
        </div>

        <div>
          <div className="campo-fila">
            <div className="campo">
              <label htmlFor={`pp-nom-${profesional.id_profesional}`}>Nombres</label>
              <input
                id={`pp-nom-${profesional.id_profesional}`}
                value={form.nombres}
                onChange={(e) => cambiar("nombres", e.target.value)}
                required
              />
            </div>
            <div className="campo">
              <label htmlFor={`pp-ape-${profesional.id_profesional}`}>Apellidos</label>
              <input
                id={`pp-ape-${profesional.id_profesional}`}
                value={form.apellidos}
                onChange={(e) => cambiar("apellidos", e.target.value)}
                required
              />
            </div>
          </div>
          <div className="campo">
            <label htmlFor={`pp-cargo-${profesional.id_profesional}`}>Cargo</label>
            <input
              id={`pp-cargo-${profesional.id_profesional}`}
              value={form.cargo}
              maxLength={80}
              placeholder="Ej: Fundadora y lashista"
              onChange={(e) => cambiar("cargo", e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor={`pp-desc-${profesional.id_profesional}`}>
              Descripción <span className="campo-contador">{form.descripcion.length}/500</span>
            </label>
            <textarea
              id={`pp-desc-${profesional.id_profesional}`}
              rows={3}
              maxLength={500}
              value={form.descripcion}
              onChange={(e) => cambiar("descripcion", e.target.value)}
            />
          </div>
          <div className="perfil-opciones">
            <label className="interruptor">
              <input
                type="checkbox"
                checked={form.visible_sitio}
                onChange={(e) => cambiar("visible_sitio", e.target.checked)}
              />
              <span>Mostrar en “Nosotras”</span>
            </label>
            <label className="interruptor">
              <input
                type="checkbox"
                checked={form.es_destacada}
                onChange={(e) => cambiar("es_destacada", e.target.checked)}
              />
              <span>Destacada (dueña / principal)</span>
            </label>
            <label className="perfil-orden">
              Orden
              <input
                type="number"
                min="0"
                max="999"
                value={form.orden}
                onChange={(e) => cambiar("orden", e.target.value)}
              />
            </label>
          </div>

          <details className="perfil-calendario">
            <summary>Calendario de Google</summary>
            <div className="campo">
              <label htmlFor={`pp-alias-${profesional.id_profesional}`}>Alias en el calendario compartido</label>
              <input
                id={`pp-alias-${profesional.id_profesional}`}
                value={form.alias_calendario}
                placeholder={`Ej: ${profesional.nombres}`}
                onChange={(e) => cambiar("alias_calendario", e.target.value)}
              />
              <small className="bloque-ayuda">
                Palabras con que se la nombra al anotar a mano en Google (separadas por coma). Si un
                evento las incluye en el título, solo bloquea su agenda. Si se deja vacío se usa su
                primer nombre.
              </small>
            </div>
            <div className="campo">
              <label htmlFor={`pp-cal-${profesional.id_profesional}`}>ID de su calendario propio</label>
              <input
                id={`pp-cal-${profesional.id_profesional}`}
                value={form.google_calendar_id}
                placeholder="correo@gmail.com"
                onChange={(e) => cambiar("google_calendar_id", e.target.value)}
              />
              <small className="bloque-ayuda">Solo se usa en el modo “un calendario por profesional”.</small>
            </div>
          </details>
        </div>
      </div>

      <div className="bloque-acciones">
        {hayCambios && (
          <button type="button" className="boton boton-linea" onClick={() => setForm(inicial)} disabled={guardando}>
            Descartar
          </button>
        )}
        <button type="submit" className="boton boton-cacao" disabled={!hayCambios || guardando}>
          {guardando ? "Guardando…" : "Guardar perfil"}
        </button>
      </div>
    </form>
  );
}
