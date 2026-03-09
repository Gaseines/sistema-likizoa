import { Navigate, Route, Routes } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import Emails from "./pages/Emails";
import Rastreadores from "./pages/Rastreadores";
import Login from "./pages/Login";

import ProtectedRoute from "./routes/ProtectedRoute";
import ModuleRoute from "./routes/ModuleRoute";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

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
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;