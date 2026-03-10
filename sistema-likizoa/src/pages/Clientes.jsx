import { useEffect, useMemo, useState } from "react";
import "./clientes.css";
import {
  atualizarCliente,
  buscarClientes,
  criarCliente,
  excluirCliente,
} from "../services/firebase/clientes";
import { buscarUsuarios } from "../services/firebase/usuarios";
import { ehAdminOuGestor } from "../utils/permissoes";
import { useAuth } from "../contexts/AuthContext";

const TIPOS_PROCESSAMENTO = ["A disposição", "Sem espera", "Espera"];

const CLIENTE_INICIAL = {
  nome: "",
  cnpj: "",
  tipoProcessamento: "A disposição",
  folgaFora: false,
  temDiarias: false,
  operadorId: "",
  operadorNome: "",
  assistenteId: "",
  assistenteNome: "",
  analistaId: "",
  analistaNome: "",
  envioSemanal: false,
  dataCorteDia: 20,
  observacao: "",
  clienteAcessaSistema: false,
  linkNossoSistema: "",
  regraEspecifica: "",
  ativo: true,
};

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

function formatarCNPJExibicao(valor) {
  if (!valor) return "-";

  const numeros = somenteNumeros(valor);

  if (numeros.length !== 14) {
    return valor;
  }

  return formatarCNPJ(numeros);
}

function booleanParaTexto(valor) {
  return valor ? "Sim" : "Não";
}

function resumirTexto(valor, limite = 40) {
  const texto = String(valor || "").trim();

  if (!texto) return "-";
  if (texto.length <= limite) return texto;

  return `${texto.slice(0, limite)}...`;
}

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase();
}

function obterRoleUsuario(usuario) {
  return normalizarTexto(usuario?.roles || usuario?.role);
}

function podeAssumirFuncaoNoCliente(usuario, funcao) {
  const role = obterRoleUsuario(usuario);

  if (funcao === "operador") {
    return ["operador", "gestor", "admin"].includes(role);
  }

  if (funcao === "analista") {
    return ["analista", "gestor", "admin"].includes(role);
  }

  if (funcao === "assistente") {
    return ["assistente", "gestor", "admin"].includes(role);
  }

  return false;
}

function ordenarUsuariosParaVinculo(a, b) {
  const ativoA = a.ativo !== false;
  const ativoB = b.ativo !== false;

  if (ativoA !== ativoB) {
    return ativoA ? -1 : 1;
  }

  return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", {
    sensitivity: "base",
  });
}

function obterLabelUsuarioVinculo(usuario) {
  if (!usuario) return "-";
  return usuario.ativo === false ? `${usuario.nome} (inativo)` : usuario.nome;
}

function montarUsuariosDisponiveis(
  usuarios,
  funcao,
  usuarioSelecionadoId = "",
) {
  return usuarios
    .filter(
      (usuario) =>
        podeAssumirFuncaoNoCliente(usuario, funcao) &&
        (usuario.ativo !== false || usuario.id === usuarioSelecionadoId),
    )
    .sort(ordenarUsuariosParaVinculo);
}

function normalizarClienteParaFormulario(cliente) {
  return {
    nome: cliente.nome || "",
    cnpj: formatarCNPJ(cliente.cnpj || ""),
    tipoProcessamento: cliente.tipoProcessamento || "A disposição",
    folgaFora: Boolean(cliente.folgaFora),
    temDiarias: Boolean(cliente.temDiarias),
    operadorId: cliente.operadorId || "",
    operadorNome: cliente.operadorNome || cliente.operador || "",
    assistenteId: cliente.assistenteId || "",
    assistenteNome: cliente.assistenteNome || cliente.assistente || "",
    analistaId: cliente.analistaId || "",
    analistaNome: cliente.analistaNome || cliente.analista || "",
    envioSemanal: Boolean(cliente.envioSemanal),
    dataCorteDia: cliente.dataCorteDia || 20,
    observacao: cliente.observacao || "",
    clienteAcessaSistema: Boolean(cliente.clienteAcessaSistema),
    linkNossoSistema: cliente.linkNossoSistema || "",
    regraEspecifica: cliente.regraEspecifica || "",
    ativo: cliente.ativo ?? true,
  };
}

function clientePertenceAoUsuario(cliente, user, userData) {
  const role = normalizarTexto(userData?.roles);
  const nomeUsuario = normalizarTexto(userData?.nome);
  const uid = user?.uid || "";

  if (!uid || !role) return false;

  if (role === "operador") {
    return (
      cliente.operadorId === uid ||
      (!cliente.operadorId &&
        normalizarTexto(cliente.operadorNome || cliente.operador) ===
          nomeUsuario)
    );
  }

  if (role === "analista") {
    return (
      cliente.analistaId === uid ||
      (!cliente.analistaId &&
        normalizarTexto(cliente.analistaNome || cliente.analista) ===
          nomeUsuario)
    );
  }

  if (role === "assistente") {
    return (
      cliente.assistenteId === uid ||
      (!cliente.assistenteId &&
        normalizarTexto(cliente.assistenteNome || cliente.assistente) ===
          nomeUsuario)
    );
  }

  return false;
}

function ordenarClientesPorDataCorte(a, b) {
  const corteA =
    Number.isFinite(Number(a.dataCorteDia)) && Number(a.dataCorteDia) > 0
      ? Number(a.dataCorteDia)
      : 999;

  const corteB =
    Number.isFinite(Number(b.dataCorteDia)) && Number(b.dataCorteDia) > 0
      ? Number(b.dataCorteDia)
      : 999;

  if (corteA !== corteB) {
    return corteA - corteB;
  }

  return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", {
    sensitivity: "base",
  });
}

function Clientes() {
  const { user, userData, loading } = useAuth();

  const [clientes, setClientes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState("");

  const [filtroAnalista, setFiltroAnalista] = useState("Todos");
  const [filtroCorte, setFiltroCorte] = useState("Todos");
  const [filtroOperador, setFiltroOperador] = useState("Todos");
  const [busca, setBusca] = useState("");

  const [modalAberto, setModalAberto] = useState(false);
  const [clienteEditandoId, setClienteEditandoId] = useState(null);
  const [form, setForm] = useState(CLIENTE_INICIAL);
  const [erroFormulario, setErroFormulario] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluindoId, setExcluindoId] = useState(null);

  const podeGerenciarClientes = ehAdminOuGestor(userData);

  async function carregarDados() {
    try {
      setCarregandoLista(true);
      setErroLista("");

      const dadosClientes = await buscarClientes({
        role: userData?.roles,
        uid: user?.uid,
        isAdminOuGestor: podeGerenciarClientes,
      });
      setClientes(dadosClientes);

      if (podeGerenciarClientes) {
        const dadosUsuarios = await buscarUsuarios();
        setUsuarios(dadosUsuarios);
      } else {
        setUsuarios([]);
      }
    } catch (error) {
      console.error("ERRO ao buscar clientes:", error);
      setErroLista("Não foi possível carregar os clientes.");
    } finally {
      setCarregandoLista(false);
    }
  }

  useEffect(() => {
    if (!loading) {
      carregarDados();
    }
  }, [loading, podeGerenciarClientes]);

  const clientesVisiveis = useMemo(() => {
    if (podeGerenciarClientes) {
      return clientes;
    }

    return clientes.filter((cliente) =>
      clientePertenceAoUsuario(cliente, user, userData),
    );
  }, [clientes, podeGerenciarClientes, user, userData]);

  const analistasDisponiveis = useMemo(() => {
    return [
      ...new Set(
        clientesVisiveis
          .map((cliente) => cliente.analistaNome || cliente.analista)
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [clientesVisiveis]);

  const datasCorteDisponiveis = useMemo(() => {
    return [
      ...new Set(
        clientesVisiveis.map((cliente) => cliente.dataCorteDia).filter(Boolean),
      ),
    ].sort((a, b) => a - b);
  }, [clientesVisiveis]);

  const operadoresFiltroDisponiveis = useMemo(() => {
    return [
      ...new Set(
        clientesVisiveis
          .map((cliente) => cliente.operadorNome || cliente.operador)
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [clientesVisiveis]);

  const operadoresDisponiveis = useMemo(() => {
    return montarUsuariosDisponiveis(usuarios, "operador", form.operadorId);
  }, [usuarios, form.operadorId]);

  const analistasCadastroDisponiveis = useMemo(() => {
    return montarUsuariosDisponiveis(usuarios, "analista", form.analistaId);
  }, [usuarios, form.analistaId]);

  const assistentesDisponiveis = useMemo(() => {
    return montarUsuariosDisponiveis(usuarios, "assistente", form.assistenteId);
  }, [usuarios, form.assistenteId]);

  const clientesFiltrados = useMemo(() => {
    const textoBusca = busca.trim().toLowerCase();
    const buscaNumerica = somenteNumeros(busca);

    return clientesVisiveis
      .filter((cliente) => {
        const nomeMatch = String(cliente.nome || "")
          .toLowerCase()
          .includes(textoBusca);

        const cnpjMatch = String(cliente.cnpj || "").includes(buscaNumerica);

        const passouBusca =
          !textoBusca || nomeMatch || (buscaNumerica.length > 0 && cnpjMatch);

        const nomeAnalista = cliente.analistaNome || cliente.analista || "";

        const passouAnalista =
          filtroAnalista === "Todos" || nomeAnalista === filtroAnalista;

        const passouCorte =
          filtroCorte === "Todos" ||
          Number(cliente.dataCorteDia) === Number(filtroCorte);

        const nomeOperador = cliente.operadorNome || cliente.operador || "";

        const passouOperador =
          filtroOperador === "Todos" || nomeOperador === filtroOperador;

        return passouBusca && passouAnalista && passouCorte && passouOperador;
      })
      .sort(ordenarClientesPorDataCorte);
  }, [
    clientesVisiveis,
    busca,
    filtroAnalista,
    filtroCorte,
    filtroOperador,
  ]);

  function abrirNovoCliente() {
    if (!podeGerenciarClientes) {
      alert("Você não tem permissão para cadastrar clientes.");
      return;
    }

    setClienteEditandoId(null);
    setForm(CLIENTE_INICIAL);
    setErroFormulario("");
    setModalAberto(true);
  }

  function abrirEdicao(cliente) {
    if (!podeGerenciarClientes) {
      alert("Você não tem permissão para editar clientes.");
      return;
    }

    setClienteEditandoId(cliente.id);
    setForm(normalizarClienteParaFormulario(cliente));
    setErroFormulario("");
    setModalAberto(true);
  }

  function fecharModal(forcarFechamento = false) {
    if (salvando && !forcarFechamento) return;

    setModalAberto(false);
    setClienteEditandoId(null);
    setForm(CLIENTE_INICIAL);
    setErroFormulario("");
  }

  function limparFiltros() {
    setFiltroAnalista("Todos");
    setFiltroCorte("Todos");
    setFiltroOperador("Todos");
    setBusca("");
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    if (name === "cnpj") {
      setForm((estadoAtual) => ({
        ...estadoAtual,
        cnpj: formatarCNPJ(value),
      }));
      return;
    }

    if (name === "dataCorteDia") {
      setForm((estadoAtual) => ({
        ...estadoAtual,
        dataCorteDia: value === "" ? "" : Number(value),
      }));
      return;
    }

    setForm((estadoAtual) => ({
      ...estadoAtual,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleUsuarioVinculadoChange(campoId, campoNome, listaUsuarios) {
    return (event) => {
      const usuarioId = event.target.value;
      const usuarioSelecionado = listaUsuarios.find(
        (usuarioItem) => usuarioItem.id === usuarioId,
      );

      setForm((estadoAtual) => ({
        ...estadoAtual,
        [campoId]: usuarioId,
        [campoNome]: usuarioSelecionado?.nome || "",
      }));
    };
  }

  function validarFormulario() {
    if (!form.nome.trim()) {
      return "Preencha o nome do cliente.";
    }

    if (somenteNumeros(form.cnpj).length !== 14) {
      return "Preencha um CNPJ válido com 14 números.";
    }

    if (!form.analistaId) {
      return "Selecione o analista do cliente.";
    }

    if (
      !form.dataCorteDia ||
      Number(form.dataCorteDia) < 1 ||
      Number(form.dataCorteDia) > 31
    ) {
      return "Informe uma data de corte entre 1 e 31.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!podeGerenciarClientes) {
      setErroFormulario("Você não tem permissão para salvar clientes.");
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

      if (clienteEditandoId) {
        await atualizarCliente(clienteEditandoId, form);
      } else {
        await criarCliente(form);
      }

      await carregarDados();
      fecharModal(true);
    } catch (error) {
      console.error("ERRO ao salvar cliente:", error);
      setErroFormulario("Não foi possível salvar o cliente.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir(cliente) {
    if (!podeGerenciarClientes) {
      alert("Você não tem permissão para excluir clientes.");
      return;
    }

    const confirmou = window.confirm(
      `Deseja realmente excluir o cliente "${cliente.nome}"?`,
    );

    if (!confirmou) return;

    try {
      setExcluindoId(cliente.id);
      await excluirCliente(cliente.id, user?.uid || null);
      await carregarDados();
    } catch (error) {
      console.error("ERRO ao excluir cliente:", error);
      alert("Não foi possível excluir o cliente.");
    } finally {
      setExcluindoId(null);
    }
  }

  if (loading) {
    return (
      <section className="page">
        <div className="card">
          <div className="clientes-feedback">
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
          <h1>Clientes</h1>
          <p className="page-header__description">
            Aqui você cadastra, edita, filtra e organiza todos os clientes da
            empresa.
          </p>
        </div>

        {podeGerenciarClientes ? (
          <button
            className="primary-button"
            type="button"
            onClick={abrirNovoCliente}
          >
            + Novo cliente
          </button>
        ) : null}
      </div>

      <div className="card filters-card">
        <div className="clientes-toolbar">
          <div>
            <h3>Filtros</h3>
            <p>Use os filtros para localizar clientes com mais rapidez.</p>
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
            <label htmlFor="filtro-analista">Analista</label>
            <select
              id="filtro-analista"
              value={filtroAnalista}
              onChange={(event) => setFiltroAnalista(event.target.value)}
            >
              <option value="Todos">Todos</option>
              {analistasDisponiveis.map((analista) => (
                <option key={analista} value={analista}>
                  {analista}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="filtro-corte">Data de corte</label>
            <select
              id="filtro-corte"
              value={filtroCorte}
              onChange={(event) => setFiltroCorte(event.target.value)}
            >
              <option value="Todos">Todos</option>
              {datasCorteDisponiveis.map((dia) => (
                <option key={dia} value={dia}>
                  Dia {dia}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="filtro-operador">Operador</label>
            <select
              id="filtro-operador"
              value={filtroOperador}
              onChange={(event) => setFiltroOperador(event.target.value)}
            >
              <option value="Todos">Todos</option>
              {operadoresFiltroDisponiveis.map((operador) => (
                <option key={operador} value={operador}>
                  {operador}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="filtro-busca">Busca</label>
            <input
              id="filtro-busca"
              type="text"
              placeholder="Buscar por nome ou CNPJ"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="clientes-toolbar">
          <div>
            <h3>Lista de clientes</h3>
            <p>{clientesFiltrados.length} cliente(s) encontrado(s)</p>
          </div>
        </div>

        {carregandoLista ? (
          <div className="clientes-feedback">
            <p>Carregando clientes...</p>
          </div>
        ) : erroLista ? (
          <div className="clientes-feedback clientes-feedback--erro">
            <p>{erroLista}</p>
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="clientes-empty">
            <h4>Nenhum cliente encontrado</h4>
            <p>
              Cadastre um cliente novo ou ajuste os filtros para visualizar os
              resultados.
            </p>
          </div>
        ) : (
          <>
            <div className="clientes-table-wrapper">
              <table className="clientes-table">
                <thead>
                  <tr>
                    {podeGerenciarClientes ? <th>Ações</th> : null}
                    <th>Cliente</th>
                    <th>CNPJ</th>
                    <th>Analista</th>
                    <th>Assistente</th>
                    <th>Operador</th>
                    <th>Processamento</th>
                    <th>Folga fora</th>
                    <th>Tem diárias</th>
                    <th>Envio semanal</th>
                    <th>Cliente acessa sistema</th>
                    <th>Data corte</th>
                    <th>Status</th>
                    <th>Observação</th>
                    <th>Regra específica</th>
                  </tr>
                </thead>

                <tbody>
                  {clientesFiltrados.map((cliente) => (
                    <tr
                      key={cliente.id}
                      className={
                        cliente.ativo ? "" : "clientes-table__row--inativo"
                      }
                    >
                      {podeGerenciarClientes ? (
                        <td>
                          <div className="clientes-actions">
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => abrirEdicao(cliente)}
                              disabled={excluindoId === cliente.id}
                            >
                              Editar
                            </button>

                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => handleExcluir(cliente)}
                              disabled={excluindoId === cliente.id}
                            >
                              {excluindoId === cliente.id
                                ? "Excluindo..."
                                : "Excluir"}
                            </button>
                          </div>
                        </td>
                      ) : null}

                      <td>
                        <div className="clientes-stack">
                          <strong>{cliente.nome}</strong>
                        </div>
                      </td>

                      <td>{formatarCNPJExibicao(cliente.cnpj)}</td>
                      <td>{cliente.analistaNome || cliente.analista || "-"}</td>
                      <td>
                        {cliente.assistenteNome || cliente.assistente || "-"}
                      </td>
                      <td>{cliente.operadorNome || cliente.operador || "-"}</td>

                      <td>
                        <span className="clientes-badge">
                          {cliente.tipoProcessamento || "-"}
                        </span>
                      </td>

                      <td>{booleanParaTexto(cliente.folgaFora)}</td>
                      <td>{booleanParaTexto(cliente.temDiarias)}</td>
                      <td>{booleanParaTexto(cliente.envioSemanal)}</td>
                      <td>{booleanParaTexto(cliente.clienteAcessaSistema)}</td>
                      <td>Dia {cliente.dataCorteDia || "-"}</td>
                      <td>
                        <span
                          className={`clientes-status ${
                            cliente.ativo
                              ? "clientes-status--ativo"
                              : "clientes-status--inativo"
                          }`}
                        >
                          {cliente.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>

                      <td title={cliente.observacao || ""}>
                        {resumirTexto(cliente.observacao, 35)}
                      </td>

                      <td title={cliente.regraEspecifica || ""}>
                        {resumirTexto(cliente.regraEspecifica, 35)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="clientes-mobile-list">
              {clientesFiltrados.map((cliente) => (
                <article
                  key={cliente.id}
                  className={`cliente-card ${
                    cliente.ativo ? "" : "cliente-card--inativo"
                  }`}
                >
                  <div className="cliente-card__header">
                    <div>
                      <h4>{cliente.nome}</h4>
                      <p>{formatarCNPJExibicao(cliente.cnpj)}</p>
                    </div>

                    {podeGerenciarClientes ? (
                      <div className="clientes-actions">
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => abrirEdicao(cliente)}
                          disabled={excluindoId === cliente.id}
                        >
                          Editar
                        </button>

                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => handleExcluir(cliente)}
                          disabled={excluindoId === cliente.id}
                        >
                          {excluindoId === cliente.id
                            ? "Excluindo..."
                            : "Excluir"}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="cliente-card__grid">
                    <div>
                      <span>Analista</span>
                      <strong>
                        {cliente.analistaNome || cliente.analista || "-"}
                      </strong>
                    </div>

                    <div>
                      <span>Assistente</span>
                      <strong>
                        {cliente.assistenteNome || cliente.assistente || "-"}
                      </strong>
                    </div>

                    <div>
                      <span>Operador</span>
                      <strong>
                        {cliente.operadorNome || cliente.operador || "-"}
                      </strong>
                    </div>

                    <div>
                      <span>Processamento</span>
                      <strong>{cliente.tipoProcessamento || "-"}</strong>
                    </div>

                    <div>
                      <span>Folga fora</span>
                      <strong>{booleanParaTexto(cliente.folgaFora)}</strong>
                    </div>

                    <div>
                      <span>Tem diárias</span>
                      <strong>{booleanParaTexto(cliente.temDiarias)}</strong>
                    </div>

                    <div>
                      <span>Envio semanal</span>
                      <strong>{booleanParaTexto(cliente.envioSemanal)}</strong>
                    </div>

                    <div>
                      <span>Cliente acessa sistema</span>
                      <strong>
                        {booleanParaTexto(cliente.clienteAcessaSistema)}
                      </strong>
                    </div>

                    <div>
                      <span>Data de corte</span>
                      <strong>Dia {cliente.dataCorteDia || "-"}</strong>
                    </div>

                    <div>
                      <span>Status</span>
                      <strong>
                        <span
                          className={`clientes-status ${
                            cliente.ativo
                              ? "clientes-status--ativo"
                              : "clientes-status--inativo"
                          }`}
                        >
                          {cliente.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </strong>
                    </div>

                    <div>
                      <span>Observação</span>
                      <strong>{cliente.observacao || "-"}</strong>
                    </div>

                    <div>
                      <span>Regra específica</span>
                      <strong>{cliente.regraEspecifica || "-"}</strong>
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
                  {clienteEditandoId ? "Editar cliente" : "Novo cliente"}
                </p>
                <h3>
                  {clienteEditandoId
                    ? "Atualizar cadastro"
                    : "Cadastrar cliente"}
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
                  <label htmlFor="nome">Nome do cliente</label>
                  <input
                    id="nome"
                    name="nome"
                    type="text"
                    value={form.nome}
                    onChange={handleChange}
                    placeholder="Digite o nome do cliente"
                  />
                </div>

                <div className="field">
                  <label htmlFor="cnpj">CNPJ</label>
                  <input
                    id="cnpj"
                    name="cnpj"
                    type="text"
                    value={form.cnpj}
                    onChange={handleChange}
                    placeholder="00.000.000/0000-00"
                  />
                </div>

                <div className="field">
                  <label htmlFor="tipoProcessamento">
                    Tipo de processamento
                  </label>
                  <select
                    id="tipoProcessamento"
                    name="tipoProcessamento"
                    value={form.tipoProcessamento}
                    onChange={handleChange}
                  >
                    {TIPOS_PROCESSAMENTO.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="dataCorteDia">Data de corte</label>
                  <input
                    id="dataCorteDia"
                    name="dataCorteDia"
                    type="number"
                    min="1"
                    max="31"
                    value={form.dataCorteDia}
                    onChange={handleChange}
                    placeholder="Ex: 20"
                  />
                </div>

                <div className="field">
                  <label htmlFor="operadorId">Operador</label>
                  <select
                    id="operadorId"
                    name="operadorId"
                    value={form.operadorId}
                    onChange={handleUsuarioVinculadoChange(
                      "operadorId",
                      "operadorNome",
                      operadoresDisponiveis,
                    )}
                  >
                    <option value="">Selecione um responsável</option>
                    {operadoresDisponiveis.map((usuarioItem) => (
                      <option key={usuarioItem.id} value={usuarioItem.id}>
                        {obterLabelUsuarioVinculo(usuarioItem)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="assistenteId">Assistente</label>
                  <select
                    id="assistenteId"
                    name="assistenteId"
                    value={form.assistenteId}
                    onChange={handleUsuarioVinculadoChange(
                      "assistenteId",
                      "assistenteNome",
                      assistentesDisponiveis,
                    )}
                  >
                    <option value="">Selecione um responsável</option>
                    {assistentesDisponiveis.map((usuarioItem) => (
                      <option key={usuarioItem.id} value={usuarioItem.id}>
                        {obterLabelUsuarioVinculo(usuarioItem)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="analistaId">Analista</label>
                  <select
                    id="analistaId"
                    name="analistaId"
                    value={form.analistaId}
                    onChange={handleUsuarioVinculadoChange(
                      "analistaId",
                      "analistaNome",
                      analistasCadastroDisponiveis,
                    )}
                  >
                    <option value="">Selecione um responsável</option>
                    {analistasCadastroDisponiveis.map((usuarioItem) => (
                      <option key={usuarioItem.id} value={usuarioItem.id}>
                        {obterLabelUsuarioVinculo(usuarioItem)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="ativo">Status do cliente</label>
                  <select
                    id="ativo"
                    name="ativo"
                    value={String(form.ativo)}
                    onChange={(event) =>
                      setForm((estadoAtual) => ({
                        ...estadoAtual,
                        ativo: event.target.value === "true",
                      }))
                    }
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>

                <div className="field field--full">
                  <label htmlFor="linkNossoSistema">Link nosso sistema</label>
                  <input
                    id="linkNossoSistema"
                    name="linkNossoSistema"
                    type="url"
                    value={form.linkNossoSistema}
                    onChange={handleChange}
                    placeholder="https://..."
                  />
                </div>

                <div className="field field--full">
                  <label htmlFor="observacao">Observação</label>
                  <textarea
                    id="observacao"
                    name="observacao"
                    rows="3"
                    value={form.observacao}
                    onChange={handleChange}
                    placeholder="Observações gerais do cliente"
                  />
                </div>

                <div className="field field--full">
                  <label htmlFor="regraEspecifica">Regra específica</label>
                  <textarea
                    id="regraEspecifica"
                    name="regraEspecifica"
                    rows="3"
                    value={form.regraEspecifica}
                    onChange={handleChange}
                    placeholder="Digite a regra específica do cliente"
                  />
                </div>
              </div>

              <div className="checkbox-grid">
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    name="folgaFora"
                    checked={form.folgaFora}
                    onChange={handleChange}
                  />
                  <span>Folga fora</span>
                </label>

                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    name="temDiarias"
                    checked={form.temDiarias}
                    onChange={handleChange}
                  />
                  <span>Tem diárias</span>
                </label>

                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    name="envioSemanal"
                    checked={form.envioSemanal}
                    onChange={handleChange}
                  />
                  <span>Envio semanal</span>
                </label>

                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    name="clienteAcessaSistema"
                    checked={form.clienteAcessaSistema}
                    onChange={handleChange}
                  />
                  <span>Cliente acessa nosso sistema</span>
                </label>
              </div>

              {erroFormulario ? (
                <div className="clientes-feedback clientes-feedback--erro">
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
                    : clienteEditandoId
                      ? "Salvar alterações"
                      : "Cadastrar cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default Clientes;