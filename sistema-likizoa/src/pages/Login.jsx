import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function Login() {
  const { user, signInUser } = useAuth();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  function getFriendlyError(errorCode) {
    switch (errorCode) {
      case "auth/invalid-credential":
        return "E-mail ou senha inválidos.";
      case "auth/too-many-requests":
        return "Muitas tentativas. Tente novamente em alguns minutos.";
      case "auth/network-request-failed":
        return "Erro de rede. Verifique sua internet.";
      default:
        return "Não foi possível entrar no sistema.";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setErro("");

    if (!email.trim() || !senha.trim()) {
      setErro("Preencha e-mail e senha.");
      return;
    }

    try {
      setCarregando(true);
      await signInUser(email, senha);
    } catch (error) {
      console.error("ERRO login:", error);
      setErro(getFriendlyError(error.code));
    } finally {
      setCarregando(false);
    }
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <p className="page-header__eyebrow">Likizoa</p>
        <h1>Entrar no sistema</h1>
        <p className="auth-card__text">
          Acesse com seu e-mail e senha cadastrados pela empresa.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              placeholder="seuemail@likizoa.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              placeholder="Digite sua senha"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
            />
          </div>

          {erro ? (
            <p style={{ margin: 0, color: "#D92D20", fontWeight: 600 }}>
              {erro}
            </p>
          ) : null}

          <button
            className="primary-button primary-button--full"
            type="submit"
            disabled={carregando}
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </section>
  );
}

export default Login;