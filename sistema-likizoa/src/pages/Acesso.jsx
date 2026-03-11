import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./acesso.css";

import { useAuth } from "../contexts/AuthContext";
import { buscarAcessoClientePorCnpj } from "../services/firebase/acessoCliente";
import logoLikizoa from "../assets/logo-likizoa.png";

function somenteNumeros(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function formatarCNPJ(valor) {
  const numeros = somenteNumeros(valor).slice(0, 14);

  return numeros
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function abrirLinkComPost(url, campos = {}) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = url;
  
  form.style.display = "none";

  Object.entries(campos).forEach(([nome, valor]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = nome;
    input.value = String(valor ?? "");
    form.appendChild(input);
  });

  document.body.appendChild(form);

  if (typeof form.requestSubmit === "function") {
    form.requestSubmit();
  } else {
    form.submit();
  }

  document.body.removeChild(form);
}

function Acesso() {
  const navigate = useNavigate();
  const { user, loading, signInUser } = useAuth();

  const [modo, setModo] = useState("escolha");

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });
  const [loginErro, setLoginErro] = useState("");
  const [loginCarregando, setLoginCarregando] = useState(false);

  const [clienteForm, setClienteForm] = useState({
    cnpj: "",
  });
  const [clienteErro, setClienteErro] = useState("");
  const [clienteCarregando, setClienteCarregando] = useState(false);
  const [clienteSucesso, setClienteSucesso] = useState("");

  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [loading, user, navigate]);

  const tituloModo = useMemo(() => {
    if (modo === "funcionario") return "Acesso Do Funcionário";
    if (modo === "cliente") return "Acesso Do Cliente";
    return "Acesso Ao Sistema";
  }, [modo]);

  function voltarEscolha() {
    setModo("escolha");

    setLoginForm({
      email: "",
      password: "",
    });
    setLoginErro("");

    setClienteForm({
      cnpj: "",
    });
    setClienteErro("");
    setClienteSucesso("");
  }

  function handleLoginChange(event) {
    const { name, value } = event.target;

    setLoginForm((estadoAtual) => ({
      ...estadoAtual,
      [name]: value,
    }));

    setLoginErro("");
  }

  function handleClienteChange(event) {
    const { value } = event.target;

    setClienteForm({
      cnpj: formatarCNPJ(value),
    });

    setClienteErro("");
    setClienteSucesso("");
  }

  async function handleSubmitLogin(event) {
    event.preventDefault();

    const email = String(loginForm.email || "").trim();
    const password = String(loginForm.password || "").trim();

    if (!email || !password) {
      setLoginErro("Preencha e-mail e senha.");
      return;
    }

    try {
      setLoginCarregando(true);
      setLoginErro("");

      await signInUser(email, password);
      navigate("/", { replace: true });
    } catch (error) {
      console.error("ERRO ao entrar como funcionário:", error);

      let mensagem = "Não foi possível entrar.";

      if (
        error?.code === "auth/invalid-credential" ||
        error?.code === "auth/wrong-password" ||
        error?.code === "auth/user-not-found"
      ) {
        mensagem = "E-mail ou senha inválidos.";
      } else if (error?.code === "auth/too-many-requests") {
        mensagem =
          "Muitas tentativas detectadas. Aguarde um pouco e tente novamente.";
      } else if (error?.code === "auth/network-request-failed") {
        mensagem = "Erro de conexão. Verifique sua internet e tente novamente.";
      }

      setLoginErro(mensagem);
    } finally {
      setLoginCarregando(false);
    }
  }

  async function handleSubmitCliente(event) {
    event.preventDefault();

    const cnpj = somenteNumeros(clienteForm.cnpj);

    if (cnpj.length !== 14) {
      setClienteErro("Informe um CNPJ válido com 14 números.");
      setClienteSucesso("");
      return;
    }

    try {
      setClienteCarregando(true);
      setClienteErro("");
      setClienteSucesso("");

      const resultado = await buscarAcessoClientePorCnpj(cnpj);

      if (!resultado?.url) {
        throw new Error("Link não encontrado para este cliente.");
      }

      setClienteSucesso(
        `Acesso encontrado para ${resultado.nome || "cliente"}. Abrindo sistema...`,
      );

      abrirLinkComPost(resultado.url, {
        acesso_externo: "1",
      });
    } catch (error) {
      console.error("ERRO ao acessar como cliente:", error);

      const mensagem =
        (typeof error?.message === "string" && error.message.trim()) ||
        "Não foi possível localizar o acesso desse cliente.";

      setClienteErro(mensagem);
      setClienteSucesso("");
    } finally {
      setClienteCarregando(false);
    }
  }

  return (
    <section className="acesso-page">
      <div className="acesso-shell">
        <div className="acesso-brand">
          <div className="acesso-brand__logo-wrap">
            <img
              src={logoLikizoa}
              alt="Likizoa"
              className="acesso-brand__logo"
            />
          </div>

          <div>
            <p className="acesso-brand__eyebrow">Likizoa</p>
            <h1 className="acesso-brand__title">{tituloModo}</h1>
            <p className="acesso-brand__description">
              {modo === "escolha"
                ? "Selecione como deseja acessar."
                : modo === "funcionario"
                  ? "Entre com seu e-mail e senha para acessar a área interna."
                  : "Digite o CNPJ da empresa para acessar o sistema liberado para seu cliente."}
            </p>
          </div>
        </div>

        {modo === "escolha" ? (
          <div className="acesso-choice-grid">
            <button
              type="button"
              className="acesso-choice-card"
              onClick={() => setModo("funcionario")}
            >
              <span className="acesso-choice-card__eyebrow">Área Interna</span>
              <strong className="acesso-choice-card__title">
                Sou Funcionário
              </strong>
              <p className="acesso-choice-card__text">
                Acesse com e-mail e senha para entrar no sistema da Likizoa.
              </p>
            </button>

            <button
              type="button"
              className="acesso-choice-card"
              onClick={() => setModo("cliente")}
            >
              <span className="acesso-choice-card__eyebrow">
                Acesso Externo
              </span>
              <strong className="acesso-choice-card__title">Sou Cliente</strong>
              <p className="acesso-choice-card__text">
                Informe o CNPJ da sua empresa e acesse o sistema vinculado.
              </p>
            </button>
          </div>
        ) : modo === "funcionario" ? (
          <div className="acesso-card">
            <div className="acesso-card__header">
              <div>
                <h3>Login Do Funcionário</h3>
                <p>Use suas credenciais para continuar.</p>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={voltarEscolha}
              >
                Voltar
              </button>
            </div>

            <form className="acesso-form" onSubmit={handleSubmitLogin}>
              <div className="field">
                <label htmlFor="email">E-mail</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={loginForm.email}
                  onChange={handleLoginChange}
                  placeholder="seuemail@likizoa.com.br"
                />
              </div>

              <div className="field">
                <label htmlFor="password">Senha</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={loginForm.password}
                  onChange={handleLoginChange}
                  placeholder="Digite sua senha"
                />
              </div>

              {loginErro ? (
                <div className="acesso-feedback acesso-feedback--erro">
                  <p>{loginErro}</p>
                </div>
              ) : null}

              <button
                type="submit"
                className="primary-button acesso-form__submit"
                disabled={loginCarregando}
              >
                {loginCarregando ? "Entrando..." : "Entrar Como Funcionário"}
              </button>
            </form>
          </div>
        ) : (
          <div className="acesso-card">
            <div className="acesso-card__header">
              <div>
                <h3>Acesso Do Cliente</h3>
                <p>Digite o CNPJ da empresa para continuar.</p>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={voltarEscolha}
              >
                Voltar
              </button>
            </div>

            <form className="acesso-form" onSubmit={handleSubmitCliente}>
              <div className="field">
                <label htmlFor="cnpj">CNPJ</label>
                <input
                  id="cnpj"
                  name="cnpj"
                  type="text"
                  value={clienteForm.cnpj}
                  onChange={handleClienteChange}
                  placeholder="00.000.000/0000-00"
                />
              </div>

              {clienteErro ? (
                <div className="acesso-feedback acesso-feedback--erro">
                  <p>{clienteErro}</p>
                </div>
              ) : null}

              {clienteSucesso ? (
                <div className="acesso-feedback acesso-feedback--sucesso">
                  <p>{clienteSucesso}</p>
                </div>
              ) : null}

              <button
                type="submit"
                className="primary-button acesso-form__submit"
                disabled={clienteCarregando}
              >
                {clienteCarregando ? "Localizando..." : "Acessar Meu Sistema"}
              </button>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}

export default Acesso;
