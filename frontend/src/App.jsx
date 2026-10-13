import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CarritoProvider } from "./context/CarritoContext";
import IrArriba from "./components/IrArriba";
import RutaProtegida from "./components/RutaProtegida";
import Login from "./pages/Login";
import Registro from "./pages/Registro";
import OlvidePassword from "./pages/OlvidePassword";
import RestablecerPassword from "./pages/RestablecerPassword";
import Panel from "./pages/Panel";
import Catalogo from "./pages/Catalogo";
import Equipo from "./pages/Equipo";
import Inicio from "./pages/Inicio";
import Nosotras from "./pages/Nosotras";
import Contacto from "./pages/Contacto";
import Integraciones from "./pages/Integraciones";
import Tienda from "./pages/Tienda";
import Reservar from "./pages/Reservar";
import Resultado from "./pages/Resultado";
import { GestionPedidos, GestionReservas } from "./pages/Gestion";
import MisCitas from "./pages/MisCitas";
import MisPedidos from "./pages/MisPedidos";
import Agenda from "./pages/Agenda";
import Promociones from "./pages/Promociones";
import "./styles/global.css";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CarritoProvider>
          <IrArriba />
        <Routes>
          {/* Sitio publico */}
          <Route path="/" element={<Inicio />} />
          <Route path="/servicios" element={<Catalogo />} />
          <Route path="/nosotras" element={<Nosotras />} />
          <Route path="/contacto" element={<Contacto />} />
          <Route path="/tienda" element={<Tienda />} />
          <Route path="/reservar" element={<Reservar />} />
          <Route path="/reserva/resultado" element={<Resultado />} />
          <Route path="/compra/resultado" element={<Resultado />} />
          {/* Cuentas */}
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/olvide-password" element={<OlvidePassword />} />
          <Route path="/restablecer-password" element={<RestablecerPassword />} />
          {/* Panel (con sesion) */}
          <Route path="/panel/catalogo" element={<Navigate to="/servicios" replace />} />
          <Route
            path="/panel/agenda"
            element={
              <RutaProtegida rolesPermitidos={["Administrador", "Profesional"]}>
                <Agenda />
              </RutaProtegida>
            }
          />
          <Route
            path="/panel/promociones"
            element={
              <RutaProtegida rolesPermitidos={["Administrador"]}>
                <Promociones />
              </RutaProtegida>
            }
          />
          <Route
            path="/panel/mis-citas"
            element={
              <RutaProtegida rolesPermitidos={["Cliente"]}>
                <MisCitas />
              </RutaProtegida>
            }
          />
          <Route
            path="/panel/mis-pedidos"
            element={
              <RutaProtegida rolesPermitidos={["Cliente"]}>
                <MisPedidos />
              </RutaProtegida>
            }
          />
          <Route
            path="/panel/reservas"
            element={
              <RutaProtegida rolesPermitidos={["Administrador"]}>
                <GestionReservas />
              </RutaProtegida>
            }
          />
          <Route
            path="/panel/pedidos"
            element={
              <RutaProtegida rolesPermitidos={["Administrador"]}>
                <GestionPedidos />
              </RutaProtegida>
            }
          />
          <Route
            path="/panel/integraciones"
            element={
              <RutaProtegida rolesPermitidos={["Administrador"]}>
                <Integraciones />
              </RutaProtegida>
            }
          />
          <Route
            path="/panel/equipo"
            element={
              <RutaProtegida rolesPermitidos={["Administrador", "Profesional"]}>
                <Equipo />
              </RutaProtegida>
            }
          />
          <Route
            path="/panel"
            element={
              <RutaProtegida>
                <Panel />
              </RutaProtegida>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </CarritoProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
