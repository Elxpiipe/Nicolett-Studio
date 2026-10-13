// src/utils/mailer.js
//
// Envio de correos para recuperacion de contrasena.
//
// - Si defines SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS en .env, se usa ese
//   servidor SMTP real (Gmail, Mailtrap, SendGrid, el que sea).
// - Si NO configuras nada, se usa automaticamente una cuenta de prueba de
//   Ethereal (https://ethereal.email): el correo "se envia" pero en realidad
//   queda atrapado en una bandeja de prueba, y esta funcion imprime en la
//   consola un link de vista previa para que puedas ver el correo tal cual
//   lo recibiria el usuario. Ideal mientras el proyecto no tiene un correo
//   corporativo real configurado.

const nodemailer = require("nodemailer");

let transporterPromise = null;

function usaSmtpReal() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function obtenerTransporter() {
  if (transporterPromise) return transporterPromise;

  if (usaSmtpReal()) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
    );
    console.log("Mailer: usando SMTP real configurado en .env");
  } else {
    transporterPromise = nodemailer.createTestAccount().then((cuenta) => {
      console.log("Mailer: no hay SMTP configurado, usando cuenta de prueba Ethereal");
      console.log(`Mailer: usuario de prueba -> ${cuenta.user}`);
      return nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: { user: cuenta.user, pass: cuenta.pass },
      });
    });
  }

  return transporterPromise;
}

async function enviarCorreoRecuperacion({ destinatario, nombre, enlaceRecuperacion }) {
  const datosCorreo = {
    from: process.env.SMTP_FROM || '"Nicolett Studio Fantasy" <no-responder@nicolett.cl>',
    to: destinatario,
    subject: "Recupera tu contraseña — Nicolett Studio Fantasy",
    text: `Hola ${nombre},\n\nRecibimos una solicitud para restablecer tu contraseña. Este enlace es valido por 30 minutos:\n${enlaceRecuperacion}\n\nSi tu no pediste esto, ignora este correo.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2 style="color:#211d17;">Recupera tu contraseña</h2>
        <p>Hola ${nombre},</p>
        <p>Recibimos una solicitud para restablecer tu contraseña en Nicolett Studio Fantasy. Este enlace es valido por <strong>30 minutos</strong>:</p>
        <p><a href="${enlaceRecuperacion}" style="background:#211d17;color:#faf6ef;padding:10px 18px;border-radius:3px;text-decoration:none;">Restablecer contraseña</a></p>
        <p style="color:#777;font-size:13px;">Si tu no pediste esto, puedes ignorar este correo.</p>
      </div>
    `,
  };

  if (usaSmtpReal()) {
    const transporter = await obtenerTransporter();
    await transporter.sendMail(datosCorreo);
    return {};
  }

  // Modo desarrollo (sin SMTP configurado): intentamos con Ethereal para
  // simular el envio real. Si Ethereal no esta disponible por cualquier
  // motivo (sin internet, servicio caido, limite de uso alcanzado), no
  // bloqueamos el flujo: mostramos el enlace directamente en la consola
  // para poder seguir probando el proyecto sin depender de un tercero.
  try {
    const transporter = await obtenerTransporter();
    const info = await transporter.sendMail(datosCorreo);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log("Mailer: correo de prueba enviado. Vista previa:", previewUrl);
    return { previewUrl };
  } catch (err) {
    transporterPromise = null; // para reintentar la proxima vez, no quedar pegado en un fallo
    console.warn(
      "Mailer: no se pudo usar el servicio de correo de prueba (Ethereal). Mostrando el enlace directamente:"
    );
    console.log(`Mailer (modo consola) -> ${destinatario}: ${enlaceRecuperacion}`);
    return { enlaceDirecto: enlaceRecuperacion };
  }
}

/**
 * Envio generico (confirmaciones de reserva y compra). Igual que la recuperacion:
 * con SMTP real si esta configurado; si no, Ethereal (vista previa en consola).
 * Nunca lanza error: un correo que falla no debe romper una reserva.
 */
async function enviarCorreo({ destinatario, asunto, texto, html }) {
  if (!destinatario) return {};
  const datosCorreo = {
    from: process.env.SMTP_FROM || '"Nicolett Studio Fantasy" <no-responder@nicolett.cl>',
    to: destinatario,
    subject: asunto,
    text: texto,
    html,
  };
  try {
    const transporter = await obtenerTransporter();
    const info = await transporter.sendMail(datosCorreo);
    if (!usaSmtpReal()) {
      console.log(`Mailer: "${asunto}" -> ${destinatario}. Vista previa:`, nodemailer.getTestMessageUrl(info));
    }
    return { ok: true };
  } catch (err) {
    transporterPromise = null;
    console.warn(`Mailer: no se pudo enviar "${asunto}" a ${destinatario}: ${err.message}`);
    return { ok: false };
  }
}

module.exports = { enviarCorreoRecuperacion, enviarCorreo };
