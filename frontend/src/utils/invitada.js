// src/utils/invitada.js
// Reservas y compras SIN cuenta ("invitada"). El backend entrega una sesion corta
// (3 horas) que solo sirve para crear, pagar y ver la reserva o el pedido recien
// hechos. Se guarda en sessionStorage: sobrevive a la ida y vuelta a Webpay en la
// misma pestaña, pero se borra al cerrar el navegador.
import { api } from "../api/client";

const CLAVE = "nicolett_invitada";

export function leerInvitada() {
  try {
    const guardada = JSON.parse(sessionStorage.getItem(CLAVE) || "null");
    if (!guardada?.token) return guardada ? { ...guardada, token: null } : null;
    const { exp } = JSON.parse(atob(guardada.token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (exp * 1000 <= Date.now()) return { ...guardada, token: null }; // vencida: conserva solo los datos
    return guardada;
  } catch {
    return null;
  }
}

export function borrarInvitada() {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento disponible */
  }
}

/** Datos vacios del formulario (o los ultimos usados en esta pestaña) */
export function datosInvitadaIniciales() {
  const g = leerInvitada();
  return {
    nombres: g?.datos?.nombres || "",
    apellidos: g?.datos?.apellidos || "",
    email: g?.datos?.email || "",
    telefono: g?.datos?.telefono || "",
  };
}

/** Revisa el formulario antes de enviarlo. Devuelve un mensaje o "" si esta bien. */
export function validarDatosInvitada(d) {
  if (!d.nombres.trim() || !d.apellidos.trim()) return "Escribe tu nombre y apellido.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) return "Escribe un correo válido: ahí te llegará la confirmación.";
  if (!/^\+?\d{8,12}$/.test(d.telefono.replace(/[\s-]/g, ""))) return "Escribe un teléfono válido, por ejemplo +56 9 1234 5678.";
  return "";
}

/** Abre la sesion de invitada en el backend y la guarda. Devuelve el token. */
export async function iniciarSesionInvitada(datos) {
  const res = await api.sesionInvitada(datos);
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify({ token: res.token, datos: res.invitada }));
  } catch {
    /* sin almacenamiento: igual se puede pagar en esta pestaña */
  }
  return res.token;
}

/** Enlace a "Crear cuenta" con los datos de la invitada ya escritos */
export function enlaceCrearCuenta(datos) {
  const p = new URLSearchParams();
  for (const k of ["email", "nombres", "apellidos", "telefono"]) if (datos?.[k]) p.set(k, datos[k]);
  return `/registro?${p.toString()}`;
}
