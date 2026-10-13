import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import BarraSitio from "../components/marca/BarraSitio";
import SubnavPanel from "../components/marca/SubnavPanel";
import PieMarca from "../components/marca/PieMarca";
import "../styles/marca.css";
import "../styles/panel.css";
import "../styles/cuenta.css";

export default function Panel() {
  const { usuario, token } = useAuth();

  return (
    <div className="pagina-marca">
      <BarraSitio />
      <SubnavPanel />

      <main className="panel-cuerpo">
        <TarjetaMiPerfil usuario={usuario} token={token} />

        <section className="panel-tarjeta panel-tarjeta-catalogo">
          <h2>Catálogo de servicios</h2>
          <p className="descripcion">
            {usuario.rol === "Administrador"
              ? "Administra categorías, fotos, precios y duración de cada servicio."
              : "Revisa nuestras listas de precios: manicura, pestañas, cejas, depilación y más."}
          </p>
          <Link to="/servicios" className="panel-boton-chico">
            {usuario.rol === "Administrador" ? "Gestionar catálogo" : "Ver catálogo"}
          </Link>
        </section>

        {usuario.rol === "Administrador" && (
          <section className="panel-tarjeta">
            <h2>Reservas y pedidos</h2>
            <p className="descripcion">
              Confirma las transferencias de abono, revisa las próximas citas y entrega los pedidos
              de la tienda.
            </p>
            <div className="panel-botones">
              <Link to="/panel/agenda" className="panel-boton-chico">Agenda del día</Link>
              <Link to="/panel/reservas" className="panel-boton-chico">Ver reservas</Link>
              <Link to="/panel/pedidos" className="panel-boton-chico">Ver pedidos</Link>
              <Link to="/tienda" className="panel-boton-chico">Administrar tienda</Link>
              <Link to="/panel/promociones" className="panel-boton-chico">Promociones</Link>
            </div>
          </section>
        )}

        {usuario.rol === "Administrador" && (
          <section className="panel-tarjeta">
            <h2>Equipo y horarios</h2>
            <p className="descripcion">
              Define qué servicios hace cada profesional, su horario semanal y sus bloqueos
              (vacaciones, trámites). Con eso se calculan las horas que ven las clientas.
            </p>
            <Link to="/panel/equipo" className="panel-boton-chico">
              Configurar equipo
            </Link>
          </section>
        )}

        {usuario.rol === "Administrador" && (
          <section className="panel-tarjeta">
            <h2>Google Calendar</h2>
            <p className="descripcion">
              Conecta la agenda con el calendario del salón para que las citas aparezcan allí y lo
              que se anote a mano bloquee las horas en la web.
            </p>
            <Link to="/panel/integraciones" className="panel-boton-chico">
              Configurar conexión
            </Link>
          </section>
        )}

        {usuario.rol === "Administrador" && <PanelAdministracionUsuarios token={token} />}

        {usuario.rol === "Profesional" && (
          <section className="panel-tarjeta">
            <h2>Tu agenda</h2>
            <p className="descripcion">
              Revisa tu horario semanal y bloquea tu agenda cuando no puedas atender
              (trámites, vacaciones). Tus citas aparecerán aquí en el próximo paso.
            </p>
            <div className="panel-botones">
              <Link to="/panel/agenda" className="panel-boton-chico">Mi agenda de hoy</Link>
              <Link to="/panel/equipo" className="panel-boton-chico">Ver mi horario</Link>
            </div>
          </section>
        )}

        {usuario.rol === "Cliente" && <ProximaCita token={token} />}
      </main>
      <PieMarca />
    </div>
  );
}

/** Resumen de la clienta: su proxima cita y accesos a Mis citas / Mis pedidos */
function ProximaCita({ token }) {
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    api
      .misCitas(token)
      .then(setDatos)
      .catch(() => setDatos({ proximas: [], historial: [] }));
  }, [token]);

  const proxima = datos?.proximas[0];
  const fecha = proxima
    ? new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" }).format(
        new Date(`${proxima.fecha_hora_inicio.slice(0, 10)}T12:00:00`)
      )
    : null;

  return (
    <section className="panel-tarjeta panel-proxima">
      <h2>Tu próxima cita</h2>
      {datos === null ? (
        <p className="descripcion">Cargando…</p>
      ) : proxima ? (
        <div className="proxima">
          <p className="proxima-cuando">
            {fecha}, {proxima.fecha_hora_inicio.slice(11)}
          </p>
          <p className="descripcion">
            {proxima.servicio} con {proxima.profesional}
            {proxima.estado === "PENDIENTE_ABONO" && " · esperando abono"}
          </p>
          {datos.proximas.length > 1 && (
            <p className="descripcion">Y {datos.proximas.length - 1} cita(s) más agendada(s).</p>
          )}
        </div>
      ) : (
        <p className="descripcion">No tienes horas agendadas. ¡Te esperamos!</p>
      )}
      <div className="panel-botones">
        <Link to="/reservar" className="panel-boton-chico">Reservar hora</Link>
        <Link to="/panel/mis-citas" className="panel-boton-chico">Mis citas</Link>
        <Link to="/panel/mis-pedidos" className="panel-boton-chico">Mis pedidos</Link>
      </div>
    </section>
  );
}

function TarjetaMiPerfil({ usuario, token }) {
  const { actualizarUsuarioEnSesion } = useAuth();
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({
    nombres: usuario.nombres,
    apellidos: usuario.apellidos,
    telefono: usuario.telefono || "",
  });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  function empezarEdicion() {
    setForm({
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      telefono: usuario.telefono || "",
    });
    setError("");
    setEditando(true);
  }

  async function guardar(e) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      const res = await api.actualizarPerfil(form, token);
      actualizarUsuarioEnSesion(res.usuario);
      setEditando(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="panel-tarjeta">
      <div className="panel-tarjeta-encabezado">
        <div>
          <h2>Hola, {usuario.nombres}</h2>
          <p className="descripcion">Este es tu perfil registrado en la plataforma.</p>
        </div>
        {!editando && (
          <button className="panel-boton-chico" onClick={empezarEdicion}>
            Editar mis datos
          </button>
        )}
      </div>

      {error && <div className="auth-alerta">{error}</div>}

      {editando ? (
        <form onSubmit={guardar} className="panel-form-edicion">
          <div className="panel-form-fila">
            <div className="panel-campo">
              <label>Nombres</label>
              <input
                value={form.nombres}
                onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))}
                required
              />
            </div>
            <div className="panel-campo">
              <label>Apellidos</label>
              <input
                value={form.apellidos}
                onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))}
                required
              />
            </div>
            <div className="panel-campo">
              <label>Teléfono</label>
              <input
                value={form.telefono}
                onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                placeholder="+56 9 1234 5678"
              />
            </div>
          </div>
          <div className="panel-form-acciones">
            <button type="button" className="panel-boton-chico" onClick={() => setEditando(false)}>
              Cancelar
            </button>
            <button type="submit" className="auth-boton panel-boton-guardar" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      ) : (
        <div className="panel-dato-grid">
          <div className="panel-dato">
            <label>Correo</label>
            <span>{usuario.email}</span>
          </div>
          <div className="panel-dato">
            <label>Teléfono</label>
            <span>{usuario.telefono || "No registrado"}</span>
          </div>
          <div className="panel-dato">
            <label>Rol</label>
            <span>{usuario.rol}</span>
          </div>
          <div className="panel-dato">
            <label>Miembro desde</label>
            <span>{new Date(usuario.fecha_creacion).toLocaleDateString("es-CL")}</span>
          </div>
        </div>
      )}

      {!editando && (
        <p className="descripcion panel-nota-correo">
          ¿Necesitas cambiar tu correo o RUT? Eso solo lo puede hacer un Administrador
          desde la tabla de usuarios.
        </p>
      )}
    </section>
  );
}

function PanelAdministracionUsuarios({ token }) {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [idEditando, setIdEditando] = useState(null);

  async function cargarUsuarios() {
    setCargando(true);
    setError("");
    try {
      const res = await api.listarUsuarios("", token);
      setUsuarios(res.datos);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function alternarEstado(u) {
    try {
      if (u.activo) {
        await api.deshabilitarUsuario(u.id_usuario, token);
      } else {
        await api.reactivarUsuario(u.id_usuario, token);
      }
      cargarUsuarios();
    } catch (err) {
      setError(err.message);
    }
  }

  async function guardarEdicion(id_usuario, cambios) {
    await api.actualizarUsuario(id_usuario, cambios, token);
    setIdEditando(null);
    await cargarUsuarios();
  }

  return (
    <section className="panel-tarjeta">
      <h2>Usuarios registrados</h2>
      <p className="descripcion">
        Gestión de Clientes, Profesionales y Administradores (CRUD completo vía API).
        Corrige nombre, teléfono, RUT o correo de cualquier usuario, incluido el tuyo.
      </p>

      {error && <div className="auth-alerta">{error}</div>}

      {cargando ? (
        <p>Cargando…</p>
      ) : (
        <table className="panel-tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Teléfono</th>
              <th>RUT</th>
              <th>Rol</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) =>
              idEditando === u.id_usuario ? (
                <FilaEdicionUsuario
                  key={u.id_usuario}
                  usuario={u}
                  onCancelar={() => setIdEditando(null)}
                  onGuardar={(cambios) => guardarEdicion(u.id_usuario, cambios)}
                  onError={setError}
                />
              ) : (
                <tr key={u.id_usuario}>
                  <td>{u.nombres} {u.apellidos}</td>
                  <td>{u.email}</td>
                  <td>{u.telefono || "—"}</td>
                  <td>{u.rut || "—"}</td>
                  <td>{u.rol}</td>
                  <td>
                    <span className={`estado-pill ${u.activo ? "estado-activo" : "estado-inactivo"}`}>
                      {u.activo ? "Activo" : "Deshabilitado"}
                    </span>
                  </td>
                  <td className="panel-tabla-acciones">
                    <button className="panel-boton-chico" onClick={() => setIdEditando(u.id_usuario)}>
                      Editar
                    </button>
                    <button className="panel-boton-chico" onClick={() => alternarEstado(u)}>
                      {u.activo ? "Deshabilitar" : "Reactivar"}
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}

function FilaEdicionUsuario({ usuario, onCancelar, onGuardar, onError }) {
  const [form, setForm] = useState({
    nombres: usuario.nombres,
    apellidos: usuario.apellidos,
    email: usuario.email,
    telefono: usuario.telefono || "",
    rut: usuario.rut || "",
  });
  const [guardando, setGuardando] = useState(false);

  async function manejarGuardar() {
    setGuardando(true);
    try {
      await onGuardar(form);
    } catch (err) {
      onError(err.message);
      setGuardando(false);
    }
  }

  return (
    <tr className="fila-edicion">
      <td>
        <div className="panel-fila-doble">
          <input
            value={form.nombres}
            onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))}
            placeholder="Nombres"
          />
          <input
            value={form.apellidos}
            onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))}
            placeholder="Apellidos"
          />
        </div>
      </td>
      <td>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
      </td>
      <td>
        <input
          value={form.telefono}
          onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
          placeholder="+56 9…"
        />
      </td>
      <td>
        <input
          value={form.rut}
          onChange={(e) => setForm((f) => ({ ...f, rut: e.target.value }))}
          placeholder="11.111.111-1"
        />
      </td>
      <td>{usuario.rol}</td>
      <td>
        <span className={`estado-pill ${usuario.activo ? "estado-activo" : "estado-inactivo"}`}>
          {usuario.activo ? "Activo" : "Deshabilitado"}
        </span>
      </td>
      <td className="panel-tabla-acciones">
        <button className="panel-boton-chico" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
        <button className="panel-boton-chico panel-boton-primario" onClick={manejarGuardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </td>
    </tr>
  );
}
