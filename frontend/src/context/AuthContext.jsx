// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

const CLAVE_STORAGE = "nicolett_sesion";

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [token, setToken] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const guardado = localStorage.getItem(CLAVE_STORAGE);
    if (!guardado) {
      setCargando(false);
      return;
    }
    try {
      const { token: tokenGuardado } = JSON.parse(guardado);
      // Revalidamos el token contra el backend antes de confiar en el.
      api
        .perfil(tokenGuardado)
        .then((res) => {
          setUsuario(res.usuario);
          setToken(tokenGuardado);
        })
        .catch(() => {
          localStorage.removeItem(CLAVE_STORAGE);
        })
        .finally(() => setCargando(false));
    } catch {
      localStorage.removeItem(CLAVE_STORAGE);
      setCargando(false);
    }
  }, []);

  const guardarSesion = useCallback((datosUsuario, jwt) => {
    setUsuario(datosUsuario);
    setToken(jwt);
    localStorage.setItem(CLAVE_STORAGE, JSON.stringify({ token: jwt }));
  }, []);

  const iniciarSesion = useCallback(
    async ({ email, password }) => {
      const res = await api.login({ email, password });
      guardarSesion(res.usuario, res.token);
      return res.usuario;
    },
    [guardarSesion]
  );

  const registrarse = useCallback(
    async (payload) => {
      const res = await api.registro(payload);
      guardarSesion(res.usuario, res.token);
      return res.usuario;
    },
    [guardarSesion]
  );

  const cerrarSesion = useCallback(() => {
    setUsuario(null);
    setToken(null);
    localStorage.removeItem(CLAVE_STORAGE);
  }, []);

  // Actualiza el usuario en memoria (ej. despues de editar el propio perfil),
  // sin necesidad de volver a loguearse.
  const actualizarUsuarioEnSesion = useCallback((datosUsuario) => {
    setUsuario(datosUsuario);
  }, []);

  const valor = {
    usuario,
    token,
    cargando,
    estaAutenticado: Boolean(usuario && token),
    iniciarSesion,
    registrarse,
    cerrarSesion,
    actualizarUsuarioEnSesion,
  };

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error("useAuth debe usarse dentro de un <AuthProvider>");
  }
  return contexto;
}
