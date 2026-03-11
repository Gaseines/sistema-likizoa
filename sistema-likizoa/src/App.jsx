import { Navigate, Route, Routes } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import Emails from "./pages/Emails";
import Rastreadores from "./pages/Rastreadores";
import Usuarios from "./pages/Usuarios";
import Links from "./pages/Links";
import Acesso from "./pages/Acesso";

import ProtectedRoute from "./routes/ProtectedRoute";
import ModuleRoute from "./routes/ModuleRoute";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Acesso />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<MainLayout />}>
          <Route
            index
            element={
              <ModuleRoute moduleKey="dashboard">
                <Dashboard />
              </ModuleRoute>
            }
          />

          <Route
            path="clientes"
            element={
              <ModuleRoute moduleKey="clientes">
                <Clientes />
              </ModuleRoute>
            }
          />

          <Route
            path="emails"
            element={
              <ModuleRoute moduleKey="emails">
                <Emails />
              </ModuleRoute>
            }
          />

          <Route
            path="rastreadores"
            element={
              <ModuleRoute moduleKey="rastreadores">
                <Rastreadores />
              </ModuleRoute>
            }
          />

          <Route
            path="links"
            element={
              <ModuleRoute moduleKey="links">
                <Links />
              </ModuleRoute>
            }
          />

          <Route
            path="usuarios"
            element={
              <ModuleRoute moduleKey="usuarios">
                <Usuarios />
              </ModuleRoute>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;