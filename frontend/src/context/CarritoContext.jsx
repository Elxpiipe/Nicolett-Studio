// src/context/CarritoContext.jsx
// Carrito de la tienda. Se guarda en el navegador (localStorage) para que no se
// pierda al recargar o al ir a iniciar sesion. Solo guarda ids y cantidades:
// precios y stock siempre se leen frescos desde el backend.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const CLAVE = "nicolett_carrito";
const MAXIMO_POR_PRODUCTO = 20;
const CarritoContext = createContext(null);

function leer() {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE) || "[]");
    return Array.isArray(datos) ? datos.filter((i) => i.id_producto && i.cantidad > 0) : [];
  } catch {
    return [];
  }
}

export function CarritoProvider({ children }) {
  const [items, setItems] = useState(leer);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(items));
    } catch {
      /* sin almacenamiento: el carrito vive solo en esta pestaña */
    }
  }, [items]);

  const agregar = useCallback((id_producto, cantidad = 1, stock = MAXIMO_POR_PRODUCTO) => {
    setItems((actual) => {
      const tope = Math.min(stock, MAXIMO_POR_PRODUCTO);
      const existente = actual.find((i) => i.id_producto === id_producto);
      if (existente) {
        return actual.map((i) =>
          i.id_producto === id_producto ? { ...i, cantidad: Math.min(i.cantidad + cantidad, tope) } : i
        );
      }
      return [...actual, { id_producto, cantidad: Math.min(cantidad, tope) }];
    });
  }, []);

  const cambiarCantidad = useCallback((id_producto, cantidad) => {
    setItems((actual) =>
      cantidad <= 0
        ? actual.filter((i) => i.id_producto !== id_producto)
        : actual.map((i) => (i.id_producto === id_producto ? { ...i, cantidad: Math.min(cantidad, MAXIMO_POR_PRODUCTO) } : i))
    );
  }, []);

  const quitar = useCallback((id_producto) => setItems((a) => a.filter((i) => i.id_producto !== id_producto)), []);
  const vaciar = useCallback(() => setItems([]), []);

  const valor = useMemo(
    () => ({
      items,
      unidades: items.reduce((s, i) => s + i.cantidad, 0),
      agregar,
      cambiarCantidad,
      quitar,
      vaciar,
      abierto,
      abrir: () => setAbierto(true),
      cerrar: () => setAbierto(false),
    }),
    [items, abierto, agregar, cambiarCantidad, quitar, vaciar]
  );

  return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>;
}

export function useCarrito() {
  return useContext(CarritoContext);
}
