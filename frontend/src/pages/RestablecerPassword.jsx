import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import "../styles/auth.css";

export default function RestablecerPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [form, setForm] = useState({ password_nueva: "", confirmar: "" });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);

  async function manejarEnvio(e) {
    e.preventDefault();
    setError("");

    if (form.password_nueva !== form.confirmar) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setEnviando(true);
    try {
      await api.restablecerPassword({ token, password_nueva: form.password_nueva });
      setExito(true);
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (!token) {
    return (
      <div className="contenedor-centrado">
        <div className="auth-marco">
          <div className="auth-panel-marca">
            <div className="auth-marca-nombre">
              Nicolett
              <br />
              Studio Fantasy
            </div>
          </div>
          <div className="auth-panel-form">
            <Link to="/" className="auth-volver">← Volver al sitio</Link>
            <h1 className="auth-titulo">Enlace incompleto</h1>
            <div className="auth-alerta">
              Este enlace no incluye un token válido. Solicita uno nuevo.
            </div>
            <p className="auth-pie-form">
              <Link to="/olvide-password">Solicitar enlace de recuperación</Link>
            </p>
          </div>
        </div>
      </div>
    );
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
        </div>

        <div className="auth-panel-form">

          <Link to="/" className="auth-volver">← Volver al sitio</Link>
          <h1 className="auth-titulo">Nueva contraseña</h1>
          <p className="auth-subtitulo">Este enlace es válido por 30 minutos.</p>

          {error && <div className="auth-alerta">{error}</div>}

          {exito ? (
            <div className="auth-alerta auth-alerta-exito">
              Contraseña actualizada. Redirigiendo al inicio de sesión…
            </div>
          ) : (
            <form onSubmit={manejarEnvio} noValidate>
              <div className="auth-campo">
                <label htmlFor="password_nueva">Nueva contraseña</label>
                <input
                  id="password_nueva"
                  type="password"
                  autoComplete="new-password"
                  value={form.password_nueva}
                  onChange={(e) => setForm((f) => ({ ...f, password_nueva: e.target.value }))}
                  required
                />
              </div>
              <div className="auth-campo">
                <label htmlFor="confirmar">Confirmar contraseña</label>
                <input
                  id="confirmar"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirmar}
                  onChange={(e) => setForm((f) => ({ ...f, confirmar: e.target.value }))}
                  required
                />
              </div>

              <button className="auth-boton" type="submit" disabled={enviando}>
                {enviando ? "Guardando…" : "Restablecer contraseña"}
              </button>
            </form>
          )}

          <p className="auth-pie-form">
            <Link to="/login">Volver a iniciar sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
