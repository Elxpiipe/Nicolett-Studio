import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/auth.css";

export default function Login() {
  const { iniciarSesion } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Vuelve a donde estaba (ej. /reservar?servicio=9 o el carrito), con sus parametros
  const desde = location.state?.desde;
  const destino = desde?.pathname ? `${desde.pathname}${desde.search || ""}` : "/panel";

  function actualizarCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function manejarEnvio(e) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      await iniciarSesion(form);
      navigate(destino, { replace: true });
    } catch (err) {
      setError(err.message);
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
            Agenda tus servicios, revisa tu historial y gestiona tus citas desde un
            solo lugar. Buin.
          </div>
        </div>

        <div className="auth-panel-form">

          <Link to="/" className="auth-volver">← Volver al sitio</Link>
          <h1 className="auth-titulo">Iniciar sesión</h1>
          <p className="auth-subtitulo">Ingresa con tu correo y contraseña para continuar.</p>

          {error && <div className="auth-alerta">{error}</div>}

          <form onSubmit={manejarEnvio} noValidate>
            <div className="auth-campo">
              <label htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => actualizarCampo("email", e.target.value)}
                required
              />
            </div>

            <div className="auth-campo">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => actualizarCampo("password", e.target.value)}
                required
              />
              <div className="auth-olvide-link">
                <Link to="/olvide-password">¿Olvidaste tu contraseña?</Link>
              </div>
            </div>

            <button className="auth-boton" type="submit" disabled={enviando}>
              {enviando ? "Ingresando…" : "Ingresar"}
            </button>
          </form>

          <p className="auth-pie-form">
            ¿Aún no tienes cuenta? <Link to="/registro" state={location.state}>Regístrate</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
