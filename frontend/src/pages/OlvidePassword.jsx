import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import "../styles/auth.css";

export default function OlvidePassword() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [enlaceDirecto, setEnlaceDirecto] = useState(null);

  async function manejarEnvio(e) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const res = await api.olvidePassword({ email });
      setEnviado(true);
      setPreviewUrl(res.previewUrl || null);
      setEnlaceDirecto(res.enlaceDirecto || null);
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
            Te enviaremos un enlace a tu correo para que puedas crear una nueva
            contraseña de forma segura.
          </div>
        </div>

        <div className="auth-panel-form">

          <Link to="/" className="auth-volver">← Volver al sitio</Link>
          <h1 className="auth-titulo">¿Olvidaste tu contraseña?</h1>
          <p className="auth-subtitulo">
            Escribe tu correo y te enviaremos un enlace para restablecerla.
          </p>

          {error && <div className="auth-alerta">{error}</div>}

          {enviado ? (
            <div>
              <div className="auth-alerta auth-alerta-exito">
                Si el correo está registrado, te enviamos un enlace para restablecer tu
                contraseña. Revisa tu bandeja de entrada (y spam).
              </div>
              {previewUrl && (
                <p className="auth-nota-dev">
                  Modo desarrollo: aún no hay un servidor de correo real conectado, así
                  que puedes ver el correo simulado aquí:{" "}
                  <a href={previewUrl} target="_blank" rel="noreferrer">
                    ver correo de prueba
                  </a>
                </p>
              )}
              {enlaceDirecto && (
                <p className="auth-nota-dev">
                  Modo desarrollo: el servicio de correo de prueba no estuvo disponible,
                  así que aquí tienes el enlace directo:{" "}
                  <a href={enlaceDirecto}>{enlaceDirecto}</a>
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={manejarEnvio} noValidate>
              <div className="auth-campo">
                <label htmlFor="email">Correo electrónico</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button className="auth-boton" type="submit" disabled={enviando}>
                {enviando ? "Enviando…" : "Enviar enlace de recuperación"}
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
