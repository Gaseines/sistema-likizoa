import { useAuth } from "../contexts/AuthContext";

function ModuleRoute({ moduleKey, children }) {
  const { hasPermission, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!hasPermission(moduleKey)) {
    return (
      <section className="page">
        <div className="card">
          <h3>Sem permissão</h3>
          <p>
            Seu usuário não tem acesso a este módulo no momento.
          </p>
        </div>
      </section>
    );
  }

  return children;
}

export default ModuleRoute;
