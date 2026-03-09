import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function ProtectedRoute() {
  const { user, userData, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <section className="auth-page">
        <div className="auth-card">
          <p className="page-header__eyebrow">Likizoa</p>
          <h1>Carregando...</h1>
          <p className="auth-card__text">
            Estamos verificando seu acesso ao sistema.
          </p>
        </div>
      </section>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!userData) {
    return (
      <section className="auth-page">
        <div className="auth-card">
          <p className="page-header__eyebrow">Acesso pendente</p>
          <h1>Usuário autenticado, mas ainda sem cadastro interno</h1>
          <p className="auth-card__text">
            Seu login existe no Firebase Authentication, mas ainda falta criar
            seu documento na coleção <strong>usuarios</strong> do Firestore.
          </p>

          <div style={{ marginTop: "16px" }}>
            <p style={{ margin: "0 0 8px" }}>
              <strong>UID:</strong> {user.uid}
            </p>
            <p style={{ margin: 0 }}>
              <strong>E-mail:</strong> {user.email}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return <Outlet />;
}

export default ProtectedRoute;