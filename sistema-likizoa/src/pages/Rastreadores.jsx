import { useEffect, useMemo, useState } from "react";
import "./rastreadores.css";

import {
  atualizarRastreador,
  buscarRastreadores,
  criarRastreador,
  excluirRastreador,
  CLIENTE_NOSSO_ACESSO_ID,
  CLIENTE_NOSSO_ACESSO_NOME,
} from "../services/firebase/rastreadores";
import { buscarClientes } from "../services/firebase/clientes";
import { ehAdminOuGestor } from "../utils/permissoes";
import { useAuth } from "../contexts/AuthContext";

const RASTREADOR_INICIAL = {
  clienteId: "",
  clienteNome: "",
  rastreador: "",
  email: "",
  login: "",
  senha: "",
  linkAcesso: "",
  ativo: true,
};

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase();
}

function ehNossoAcesso(registro) {
  return (
    String(registro?.clienteId || "").trim() === CLIENTE_NOSSO_ACESSO_ID ||
    normalizarTexto(registro?.clienteNome) ===
      normalizarTexto(CLIENTE_NOSSO_ACESSO_NOME)
  );
}

function ordenarClientesComNossoAcessoPrimeiro(lista) {
  return [...lista].sort((a, b) => {
    const aNossoAcesso = ehNossoAcesso(a);
    const bNossoAcesso = ehNossoAcesso(b);

    if (aNossoAcesso !== bNossoAcesso) {
      return aNossoAcesso ? -1 : 1;
    }

    return String(a.nome || a.clienteNome || "").localeCompare(
      String(b.nome || b.clienteNome || ""),
      "pt-BR",
      {
        sensitivity: "base",
      },
    );
  });
}

function ordenarRastreadoresComNossoAcessoPrimeiro(lista) {
  return [...lista].sort((a, b) => {
    const aNossoAcesso = ehNossoAcesso(a);
    const bNossoAcesso = ehNossoAcesso(b);

    if (aNossoAcesso !== bNossoAcesso) {
      return aNossoAcesso ? -1 : 1;
    }

    const comparacaoCliente = String(a.clienteNome || "").localeCompare(
      String(b.clienteNome || ""),
      "pt-BR",
      {
        sensitivity: "base",
      },
    );

    if (comparacaoCliente !== 0) {
      return comparacaoCliente;
    }

    return String(a.rastreador || a.nome || a.plataforma || "").localeCompare(
      String(b.rastreador || b.nome || b.plataforma || ""),
      "pt-BR",
      {
        sensitivity: "base",
      },
    );
  });
}

function normalizarRastreadorParaFormulario(registro) {
  return {
    clienteId: ehNossoAcesso(registro)
      ? CLIENTE_NOSSO_ACESSO_ID
      : registro.clienteId || "",
    clienteNome: ehNossoAcesso(registro)
      ? CLIENTE_NOSSO_ACESSO_NOME
      : registro.clienteNome || "",
    rastreador:
      registro.rastreador || registro.nome || registro.plataforma || "",
    email: registro.email || "",
    login: registro.login || "",
    senha: registro.senha || "",
    linkAcesso: registro.linkAcesso || registro.urlAcesso || "",
    ativo: registro.ativo ?? true,
  };
}

async function copiarTextoParaAreaTransferencia(texto) {
  const valor = String(texto || "").trim();

  if (!valor) return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(valor);
      return true;
    }
  } catch {
    // tenta fallback abaixo
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = valor;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    return true;
  } catch {
    return false;
  }
}

function Rastreadores() {
  const { user, userData, loading } = useAuth();

  const [rastreadores, setRastreadores] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState("");

  const [filtroCliente, setFiltroCliente] = useState("Todos");
  const [busca, setBusca] = useState("");

  const [modalAberto, setModalAberto] = useState(false);
  const [rastreadorEditandoId, setRastreadorEditandoId] = useState(null);
  const [form, setForm] = useState(RASTREADOR_INICIAL);
  const [erroFormulario, setErroFormulario] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluindoId, setExcluindoId] = useState(null);

  const [copiadoChave, setCopiadoChave] = useState("");

  const roleUsuario = normalizarTexto(userData?.roles || userData?.role);
  const usuarioEhOperador = roleUsuario === "operador";
  const podeGerenciarRastreadores = ehAdminOuGestor(userData);

  async function carregarDados() {
    try {
      setCarregandoLista(true);
      setErroLista("");

      const dadosClientes = await buscarClientes({
        role: userData?.roles,
        uid: user?.uid,
        isAdminOuGestor: podeGerenciarRastreadores,
      });

      const clientesComNossoAcesso = ordenarClientesComNossoAcessoPrimeiro([
        {
          id: CLIENTE_NOSSO_ACESSO_ID,
          nome: CLIENTE_NOSSO_ACESSO_NOME,
        },
        ...dadosClientes.filter(
          (cliente) =>
            String(cliente.id || "").trim() !== CLIENTE_NOSSO_ACESSO_ID,
        ),
      ]);

      const clienteIdsParaBusca = usuarioEhOperador
        ? [CLIENTE_NOSSO_ACESSO_ID]
        : [
            ...new Set([
              CLIENTE_NOSSO_ACESSO_ID,
              ...dadosClientes
                .map((cliente) => String(cliente.id || "").trim())
                .filter(Boolean),
            ]),
          ];

      setClientes(
        usuarioEhOperador
          ? [
              {
                id: CLIENTE_NOSSO_ACESSO_ID,
                nome: CLIENTE_NOSSO_ACESSO_NOME,
              },
            ]
          : clientesComNossoAcesso,
      );

      const dadosRastreadores = await buscarRastreadores({
        isAdminOuGestor: podeGerenciarRastreadores,
        clienteIds: clienteIdsParaBusca,
      });

      setRastreadores(
        ordenarRastreadoresComNossoAcessoPrimeiro(dadosRastreadores),
      );
    } catch (error) {
      console.error("ERRO ao buscar rastreadores:", error);
      setErroLista("Não foi possível carregar os rastreadores.");
    } finally {
      setCarregandoLista(false);
    }
  }

  useEffect(() => {
    if (!loading) {
      carregarDados();
    }
  }, [loading, podeGerenciarRastreadores, usuarioEhOperador]);

  const clientesDisponiveisFiltro = useMemo(() => {
    return ordenarClientesComNossoAcessoPrimeiro(clientes);
  }, [clientes]);

  const rastreadoresFiltrados = useMemo(() => {
    const textoBusca = busca.trim().toLowerCase();

    const rastreadoresBase = usuarioEhOperador
      ? rastreadores.filter((registro) => ehNossoAcesso(registro))
      : rastreadores;

    return ordenarRastreadoresComNossoAcessoPrimeiro(
      rastreadoresBase.filter((registro) => {
        const clienteMatch = String(registro.clienteNome || "")
          .toLowerCase()
          .includes(textoBusca);

        const rastreadorMatch = String(
          registro.rastreador || registro.nome || registro.plataforma || "",
        )
          .toLowerCase()
          .includes(textoBusca);

        const emailMatch = String(registro.email || "")
          .toLowerCase()
          .includes(textoBusca);

        const loginMatch = String(registro.login || "")
          .toLowerCase()
          .includes(textoBusca);

        const passouBusca =
          !textoBusca ||
          clienteMatch ||
          rastreadorMatch ||
          emailMatch ||
          loginMatch;

        const passouCliente =
          filtroCliente === "Todos" || registro.clienteId === filtroCliente;

        return passouBusca && passouCliente;
      }),
    );
  }, [rastreadores, busca, filtroCliente, usuarioEhOperador]);

  function abrirNovoRastreador() {
    if (!podeGerenciarRastreadores) {
      alert("Você não tem permissão para cadastrar rastreadores.");
      return;
    }

    setRastreadorEditandoId(null);
    setForm(RASTREADOR_INICIAL);
    setErroFormulario("");
    setModalAberto(true);
  }

  function abrirEdicao(registro) {
    if (!podeGerenciarRastreadores) {
      alert("Você não tem permissão para editar rastreadores.");
      return;
    }

    setRastreadorEditandoId(registro.id);
    setForm(normalizarRastreadorParaFormulario(registro));
    setErroFormulario("");
    setModalAberto(true);
  }

  function fecharModal(forcarFechamento = false) {
    if (salvando && !forcarFechamento) return;

    setModalAberto(false);
    setRastreadorEditandoId(null);
    setForm(RASTREADOR_INICIAL);
    setErroFormulario("");
  }

  function limparFiltros() {
    setFiltroCliente("Todos");
    setBusca("");
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((estadoAtual) => {
      const novoEstado = {
        ...estadoAtual,
        [name]: value,
      };

      if (name === "login" && !String(value || "").trim()) {
        novoEstado.senha = "";
      }

      return novoEstado;
    });
  }

  function handleClienteChange(event) {
    const clienteId = event.target.value;
    const clienteSelecionado = clientes.find(
      (cliente) => cliente.id === clienteId,
    );

    const ehSelecionadoNossoAcesso =
      clienteId === CLIENTE_NOSSO_ACESSO_ID ||
      clienteSelecionado?.nome === CLIENTE_NOSSO_ACESSO_NOME;

    setForm((estadoAtual) => ({
      ...estadoAtual,
      clienteId: ehSelecionadoNossoAcesso ? CLIENTE_NOSSO_ACESSO_ID : clienteId,
      clienteNome: ehSelecionadoNossoAcesso
        ? CLIENTE_NOSSO_ACESSO_NOME
        : clienteSelecionado?.nome || "",
    }));
  }

  function handleStatusChange(event) {
    setForm((estadoAtual) => ({
      ...estadoAtual,
      ativo: event.target.value === "true",
    }));
  }

  async function handleCopiar(valor, chave) {
    const copiou = await copiarTextoParaAreaTransferencia(valor);

    if (!copiou) {
      alert("Não foi possível copiar a informação.");
      return;
    }

    setCopiadoChave(chave);
    window.setTimeout(() => {
      setCopiadoChave((estadoAtual) =>
        estadoAtual === chave ? "" : estadoAtual,
      );
    }, 1800);
  }

  function validarFormulario() {
    const email = String(form.email || "").trim();
    const login = String(form.login || "").trim();
    const senha = String(form.senha || "").trim();

    if (!form.clienteId) {
      return "Selecione o cliente.";
    }

    if (!form.rastreador.trim()) {
      return "Informe qual é o rastreador.";
    }

    if (!email && !login) {
      return "Preencha pelo menos o e-mail ou o login.";
    }

    if (email && !validarEmail(email)) {
      return "Informe um e-mail válido.";
    }

    if (login && !senha) {
      return "Ao informar o login, a senha também é obrigatória.";
    }

    if (!form.linkAcesso.trim()) {
      return "Preencha o link de acesso.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!podeGerenciarRastreadores) {
      setErroFormulario("Você não tem permissão para salvar rastreadores.");
      return;
    }

    const mensagemErro = validarFormulario();

    if (mensagemErro) {
      setErroFormulario(mensagemErro);
      return;
    }

    try {
      setSalvando(true);
      setErroFormulario("");

      if (rastreadorEditandoId) {
        await atualizarRastreador(rastreadorEditandoId, form);
      } else {
        await criarRastreador(form);
      }

      await carregarDados();
      fecharModal(true);
    } catch (error) {
      console.error("ERRO ao salvar rastreador:", error);
      setErroFormulario("Não foi possível salvar o rastreador.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir(registro) {
    if (!podeGerenciarRastreadores) {
      alert("Você não tem permissão para excluir rastreadores.");
      return;
    }

    const confirmou = window.confirm(
      `Deseja realmente excluir o rastreador "${
        registro.rastreador || registro.nome || "-"
      }"?`,
    );

    if (!confirmou) return;

    try {
      setExcluindoId(registro.id);
      await excluirRastreador(registro.id, user?.uid || null);
      await carregarDados();
    } catch (error) {
      console.error("ERRO ao excluir rastreador:", error);
      alert("Não foi possível excluir o rastreador.");
    } finally {
      setExcluindoId(null);
    }
  }

  if (loading) {
    return (
      <section className="page">
        <div className="card">
          <div className="rastreadores-feedback">
            <p>Carregando permissões...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Rastreadores</h1>
          <p className="page-header__description">
            Aqui você cadastra, edita e organiza os acessos de rastreadores por
            cliente.
          </p>
        </div>

        {podeGerenciarRastreadores ? (
          <button
            className="primary-button"
            type="button"
            onClick={abrirNovoRastreador}
          >
            + Novo rastreador
          </button>
        ) : null}
      </div>

      <div className="card filters-card">
        <div className="rastreadores-toolbar">
          <div>
            <h3>Filtros</h3>
            <p>Use os filtros para localizar rastreadores com mais rapidez.</p>
          </div>

          <button
            className="secondary-button secondary-button--filters"
            type="button"
            onClick={limparFiltros}
          >
            <span className="secondary-button--filters__icon">↺</span>
            <span>Limpar filtros</span>
          </button>
        </div>

        <div className="filters-grid">
          <div className="field">
            <label htmlFor="filtro-cliente">Cliente</label>
            <select
              id="filtro-cliente"
              value={filtroCliente}
              onChange={(event) => setFiltroCliente(event.target.value)}
            >
              <option value="Todos">Todos</option>
              {clientesDisponiveisFiltro.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="filtro-busca-rastreadores">Busca</label>
            <input
              id="filtro-busca-rastreadores"
              type="text"
              placeholder="Buscar por cliente, rastreador, e-mail ou login"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="rastreadores-toolbar">
          <div>
            <h3>Lista de rastreadores</h3>
            <p>{rastreadoresFiltrados.length} rastreador(es) encontrado(s)</p>
          </div>
        </div>

        {carregandoLista ? (
          <div className="rastreadores-feedback">
            <p>Carregando rastreadores...</p>
          </div>
        ) : erroLista ? (
          <div className="rastreadores-feedback rastreadores-feedback--erro">
            <p>{erroLista}</p>
          </div>
        ) : rastreadoresFiltrados.length === 0 ? (
          <div className="rastreadores-empty">
            <h4>Nenhum rastreador encontrado</h4>
            <p>
              Cadastre um novo rastreador ou ajuste os filtros para visualizar
              os resultados.
            </p>
          </div>
        ) : (
          <>
            <div className="rastreadores-table-wrapper">
              <table className="rastreadores-table">
                <thead>
                  <tr>
                    {podeGerenciarRastreadores ? <th>Ações</th> : null}
                    <th>Cliente</th>
                    <th>Rastreador</th>
                    <th>E-mail</th>
                    <th>Login</th>
                    <th>Senha</th>
                    <th>Link</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {rastreadoresFiltrados.map((registro) => (
                    <tr key={registro.id}>
                      {podeGerenciarRastreadores ? (
                        <td>
                          <div className="rastreadores-actions">
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => abrirEdicao(registro)}
                              disabled={excluindoId === registro.id}
                            >
                              Editar
                            </button>

                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => handleExcluir(registro)}
                              disabled={excluindoId === registro.id}
                            >
                              {excluindoId === registro.id
                                ? "Excluindo..."
                                : "Excluir"}
                            </button>
                          </div>
                        </td>
                      ) : null}

                      <td>
                        <div className="rastreadores-stack">
                          <strong>{registro.clienteNome || "-"}</strong>
                        </div>
                      </td>

                      <td>
                        {registro.rastreador ||
                          registro.nome ||
                          registro.plataforma ||
                          "-"}
                      </td>

                      <td>
                        {registro.email ? (
                          <div className="rastreadores-copy-field">
                            <span>{registro.email}</span>
                            <button
                              className="rastreadores-copy-button"
                              type="button"
                              onClick={() =>
                                handleCopiar(
                                  registro.email,
                                  `${registro.id}-email`,
                                )
                              }
                              title="Copiar e-mail"
                            >
                              {copiadoChave === `${registro.id}-email`
                                ? "Copiado!"
                                : "Copiar"}
                            </button>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td>
                        {registro.login ? (
                          <div className="rastreadores-copy-field">
                            <span>{registro.login}</span>
                            <button
                              className="rastreadores-copy-button"
                              type="button"
                              onClick={() =>
                                handleCopiar(
                                  registro.login,
                                  `${registro.id}-login`,
                                )
                              }
                              title="Copiar login"
                            >
                              {copiadoChave === `${registro.id}-login`
                                ? "Copiado!"
                                : "Copiar"}
                            </button>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td>
                        {registro.senha ? (
                          <div className="rastreadores-copy-field">
                            <span>{registro.senha}</span>
                            <button
                              className="rastreadores-copy-button"
                              type="button"
                              onClick={() =>
                                handleCopiar(
                                  registro.senha,
                                  `${registro.id}-senha`,
                                )
                              }
                              title="Copiar senha"
                            >
                              {copiadoChave === `${registro.id}-senha`
                                ? "Copiado!"
                                : "Copiar"}
                            </button>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td>
                        {registro.linkAcesso || registro.urlAcesso ? (
                          <a
                            className="rastreadores-link"
                            href={registro.linkAcesso || registro.urlAcesso}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Abrir link
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td>
                        <span className="rastreadores-badge">
                          {registro.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rastreadores-mobile-list">
              {rastreadoresFiltrados.map((registro) => (
                <article key={registro.id} className="rastreador-card">
                  <div className="rastreador-card__header">
                    <div>
                      <h4>
                        {registro.rastreador ||
                          registro.nome ||
                          registro.plataforma ||
                          "-"}
                      </h4>
                      <p>{registro.clienteNome || "-"}</p>
                    </div>

                    {podeGerenciarRastreadores ? (
                      <div className="rastreadores-actions">
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => abrirEdicao(registro)}
                          disabled={excluindoId === registro.id}
                        >
                          Editar
                        </button>

                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => handleExcluir(registro)}
                          disabled={excluindoId === registro.id}
                        >
                          {excluindoId === registro.id
                            ? "Excluindo..."
                            : "Excluir"}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="rastreador-card__grid">
                    <div>
                      <span>E-mail</span>
                      <strong>
                        {registro.email ? (
                          <div className="rastreadores-copy-field">
                            <span>{registro.email}</span>
                            <button
                              className="rastreadores-copy-button"
                              type="button"
                              onClick={() =>
                                handleCopiar(
                                  registro.email,
                                  `${registro.id}-email`,
                                )
                              }
                              title="Copiar e-mail"
                            >
                              {copiadoChave === `${registro.id}-email`
                                ? "Copiado!"
                                : "Copiar"}
                            </button>
                          </div>
                        ) : (
                          "-"
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Login</span>
                      <strong>
                        {registro.login ? (
                          <div className="rastreadores-copy-field">
                            <span>{registro.login}</span>
                            <button
                              className="rastreadores-copy-button"
                              type="button"
                              onClick={() =>
                                handleCopiar(
                                  registro.login,
                                  `${registro.id}-login`,
                                )
                              }
                              title="Copiar login"
                            >
                              {copiadoChave === `${registro.id}-login`
                                ? "Copiado!"
                                : "Copiar"}
                            </button>
                          </div>
                        ) : (
                          "-"
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Senha</span>
                      <strong>
                        {registro.senha ? (
                          <div className="rastreadores-copy-field">
                            <span>{registro.senha}</span>
                            <button
                              className="rastreadores-copy-button"
                              type="button"
                              onClick={() =>
                                handleCopiar(
                                  registro.senha,
                                  `${registro.id}-senha`,
                                )
                              }
                              title="Copiar senha"
                            >
                              {copiadoChave === `${registro.id}-senha`
                                ? "Copiado!"
                                : "Copiar"}
                            </button>
                          </div>
                        ) : (
                          "-"
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Status</span>
                      <strong>{registro.ativo ? "Ativo" : "Inativo"}</strong>
                    </div>

                    <div>
                      <span>Link</span>
                      <strong>
                        {registro.linkAcesso || registro.urlAcesso ? (
                          <a
                            className="rastreadores-link"
                            href={registro.linkAcesso || registro.urlAcesso}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Abrir link
                          </a>
                        ) : (
                          "-"
                        )}
                      </strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      {modalAberto ? (
        <div className="modal-backdrop" onClick={() => fecharModal()}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <div className="modal__title-group">
                <p className="page-header__eyebrow">
                  {rastreadorEditandoId
                    ? "Editar rastreador"
                    : "Novo rastreador"}
                </p>
                <h3>
                  {rastreadorEditandoId
                    ? "Atualizar cadastro"
                    : "Cadastrar rastreador"}
                </h3>
              </div>

              <button
                className="ghost-button"
                type="button"
                onClick={() => fecharModal()}
              >
                Fechar
              </button>
            </div>

            <form className="modal__form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="clienteId">Cliente</label>
                  <select
                    id="clienteId"
                    name="clienteId"
                    value={form.clienteId}
                    onChange={handleClienteChange}
                  >
                    <option value="">Selecione um cliente</option>
                    {clientesDisponiveisFiltro.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="rastreador">Qual rastreador</label>
                  <input
                    id="rastreador"
                    name="rastreador"
                    type="text"
                    value={form.rastreador}
                    onChange={handleChange}
                    placeholder="Ex.: Sascar, Omnilink, Autotrac..."
                  />
                </div>

                <div className="field">
                  <label htmlFor="email">
                    E-mail
                    {!String(form.login || "").trim() ? (
                      <span className="field__required"> (ou login)</span>
                    ) : null}
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Opcional se houver login"
                  />
                  <small className="field__hint">
                    {String(form.login || "").trim()
                      ? "Como o login foi preenchido, o e-mail é opcional."
                      : "Preencha este campo ou o login."}
                  </small>
                </div>

                <div className="field">
                  <label htmlFor="login">
                    Login
                    {!String(form.email || "").trim() ? (
                      <span className="field__required"> (ou e-mail)</span>
                    ) : null}
                  </label>
                  <input
                    id="login"
                    name="login"
                    type="text"
                    value={form.login}
                    onChange={handleChange}
                    placeholder="Opcional se houver e-mail"
                  />
                  <small className="field__hint">
                    {String(form.email || "").trim()
                      ? "Como o e-mail foi preenchido, o login é opcional."
                      : "Preencha este campo ou o e-mail."}
                  </small>
                </div>

                <div className="field">
                  <label htmlFor="senha">
                    Senha
                    {String(form.login || "").trim() ? (
                      <span className="field__required">
                        {" "}
                        (obrigatória com login)
                      </span>
                    ) : null}
                  </label>
                  <input
                    id="senha"
                    name="senha"
                    type="text"
                    value={form.senha}
                    onChange={handleChange}
                    placeholder={
                      String(form.login || "").trim()
                        ? "Digite a senha"
                        : "Preencha primeiro o login"
                    }
                    disabled={!String(form.login || "").trim()}
                  />
                  <small className="field__hint">
                    {String(form.login || "").trim()
                      ? "Como o login foi informado, a senha é obrigatória."
                      : "A senha só é necessária quando houver login."}
                  </small>
                </div>

                <div className="field">
                  <label htmlFor="ativo">Status</label>
                  <select
                    id="ativo"
                    name="ativo"
                    value={String(form.ativo)}
                    onChange={handleStatusChange}
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>

                <div className="field field--full">
                  <label htmlFor="linkAcesso">
                    Link para acessar o rastreador
                  </label>
                  <input
                    id="linkAcesso"
                    name="linkAcesso"
                    type="url"
                    value={form.linkAcesso}
                    onChange={handleChange}
                    placeholder="https://..."
                  />
                </div>
              </div>

              {erroFormulario ? (
                <div className="rastreadores-feedback rastreadores-feedback--erro">
                  <p>{erroFormulario}</p>
                </div>
              ) : null}

              <div className="modal__actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => fecharModal()}
                  disabled={salvando}
                >
                  Cancelar
                </button>

                <button
                  className="primary-button"
                  type="submit"
                  disabled={salvando}
                >
                  {salvando
                    ? "Salvando..."
                    : rastreadorEditandoId
                      ? "Salvar alterações"
                      : "Cadastrar rastreador"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default Rastreadores;