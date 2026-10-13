import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/auth.css";

const FORM_INICIAL = {
  nombres: "",
  apellidos: "",
  email: "",
  telefono: "",
  password: "",
  confirmarPassword: "",
};

export default function Registro() {
  const { registrarse } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const desde = location.state?.desde;
  const destino = desde?.pathname ? `${desde.pathname}${desde.search || ""}` : "/panel";

  const [form, setForm] = useState(FORM_INICIAL);
  const [errorGeneral, setErrorGeneral] = useState("");
  const [erroresCampo, setErroresCampo] = useState({});
  const [enviando, setEnviando] = useState(false);

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function validarLocal() {
    const errores = {};
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      errores.password = "Mínimo 8 caracteres, con letras y números";
    }
    if (form.password !== form.confirmarPassword) {
      errores.confirmarPassword = "Las contraseñas no coinciden";
    }
    return errores;
  }

  async function manejarEnvio(e) {
    e.preventDefault();
    setErrorGeneral("");

    const erroresLocales = validarLocal();
    setErroresCampo(erroresLocales);
    if (Object.keys(erroresLocales).length > 0) return;

    setEnviando(true);
    try {
      const { confirmarPassword, ...payload } = form;
      await registrarse(payload);
      navigate(destino, { replace: true });
    } catch (err) {
      if (err.detalles) {
        const mapa = {};
        err.detalles.forEach((d) => (mapa[d.campo] = d.mensaje));
        setErroresCampo(mapa);
      }
      setErrorGeneral(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="contenedor-centrado">
      <div className="auth-marco">
        <div className="auth-panel-marca">
          <div>
            <div className="auth-marca-nombre">
              Nicolett
              <br />
              Studio Fantasy
            </div>
            <div className="auth-marca-sub">Belleza a tu ritmo y sin barreras</div>
          </div>
          <div className="auth-marca-pie">
            Crea tu cuenta de clienta para reservar manicure, pestañas, peluquería y
            más, en los horarios que se ajustan a tu día.
          </div>
        </div>

        <div className="auth-panel-form">

          <Link to="/" className="auth-volver">← Volver al sitio</Link>
          <h1 className="auth-titulo">Crear cuenta</h1>
          <p className="auth-subtitulo">Regístrate como clienta para empezar a agendar.</p>

          {errorGeneral && <div className="auth-alerta">{errorGeneral}</div>}

          <form onSubmit={manejarEnvio} noValidate>
            <div className="auth-fila-dos">
              <div className="auth-campo">
                <label htmlFor="nombres">Nombres</label>
                <input
                  id="nombres"
                  value={form.nombres}
                  onChange={(e) => actualizarCampo("nombres", e.target.value)}
                  className={erroresCampo.nombres ? "con-error" : ""}
                  required
                />
                {erroresCampo.nombres && (
                  <div className="auth-error-campo">{erroresCampo.nombres}</div>
                )}
              </div>
              <div className="auth-campo">
                <label htmlFor="apellidos">Apellidos</label>
                <input
                  id="apellidos"
                  value={form.apellidos}
                  onChange={(e) => actualizarCampo("apellidos", e.target.value)}
                  className={erroresCampo.apellidos ? "con-error" : ""}
                  required
                />
                {erroresCampo.apellidos && (
                  <div className="auth-error-campo">{erroresCampo.apellidos}</div>
                )}
              </div>
            </div>

            <div className="auth-campo">
              <label htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => actualizarCampo("email", e.target.value)}
                className={erroresCampo.email ? "con-error" : ""}
                required
              />
              {erroresCampo.email && <div className="auth-error-campo">{erroresCampo.email}</div>}
            </div>

            <div className="auth-campo">
              <label htmlFor="telefono">Teléfono (opcional)</label>
              <input
                id="telefono"
                type="tel"
                placeholder="+56 9 1234 5678"
                value={form.telefono}
                onChange={(e) => actualizarCampo("telefono", e.target.value)}
              />
            </div>

            <div className="auth-fila-dos">
              <div className="auth-campo">
                <label htmlFor="password">Contraseña</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => actualizarCampo("password", e.target.value)}
                  className={erroresCampo.password ? "con-error" : ""}
                  required
                />
                {erroresCampo.password && (
                  <div className="auth-error-campo">{erroresCampo.password}</div>
                )}
              </div>
              <div className="auth-campo">
                <label htmlFor="confirmarPassword">Confirmar contraseña</label>
                <input
                  id="confirmarPassword"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirmarPassword}
                  onChange={(e) => actualizarCampo("confirmarPassword", e.target.value)}
                  className={erroresCampo.confirmarPassword ? "con-error" : ""}
                  required
                />
                {erroresCampo.confirmarPassword && (
                  <div className="auth-error-campo">{erroresCampo.confirmarPassword}</div>
                )}
              </div>
            </div>

            <button className="auth-boton" type="submit" disabled={enviando}>
              {enviando ? "Creando cuenta…" : "Crear cuenta"}
            </button>
          </form>

          <p className="auth-pie-form">
            ¿Ya tienes cuenta? <Link to="/login" state={location.state}>Inicia sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
