// src/components/DatosInvitada.jsx
// Formulario para reservar o comprar sin cuenta. No obliga a registrarse: pide lo
// minimo para confirmar y contactar (nombre, correo y telefono) e invita a crear
// la cuenta despues.
import { Link } from "react-router-dom";

export default function DatosInvitada({ datos, onCambio, desde, accion = "reservar" }) {
  const cambiar = (campo) => (e) => onCambio({ ...datos, [campo]: e.target.value });
  return (
    <fieldset className="datos-invitada">
      <legend>Tus datos</legend>
      <p className="datos-invitada-ayuda">
        No necesitas cuenta para {accion}. Te enviaremos la confirmación a tu correo.{" "}
        <Link to="/login" state={{ desde }}>¿Ya tienes cuenta? Inicia sesión</Link>
      </p>
      <div className="datos-invitada-grilla">
        <div className="campo">
          <label htmlFor="inv-nombres">Nombre</label>
          <input id="inv-nombres" autoComplete="given-name" value={datos.nombres} onChange={cambiar("nombres")} maxLength={60} required />
        </div>
        <div className="campo">
          <label htmlFor="inv-apellidos">Apellido</label>
          <input id="inv-apellidos" autoComplete="family-name" value={datos.apellidos} onChange={cambiar("apellidos")} maxLength={60} required />
        </div>
        <div className="campo">
          <label htmlFor="inv-email">Correo</label>
          <input id="inv-email" type="email" autoComplete="email" value={datos.email} onChange={cambiar("email")} required />
        </div>
        <div className="campo">
          <label htmlFor="inv-telefono">Teléfono (WhatsApp)</label>
          <input
            id="inv-telefono"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="+56 9 1234 5678"
            value={datos.telefono}
            onChange={cambiar("telefono")}
            required
          />
        </div>
      </div>
      <p className="datos-invitada-pie">
        ¿Quieres ver tus citas y pedidos, y cambiar tu hora tú misma?{" "}
        <Link to="/registro" state={{ desde }}>Crea tu cuenta</Link> (también puedes hacerlo después con el mismo correo).
      </p>
    </fieldset>
  );
}
