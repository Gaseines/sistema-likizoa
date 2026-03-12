import { useEffect, useMemo, useState } from "react";
import "./clientes.css";
import {
  atualizarCliente,
  buscarClientes,
  criarCliente,
  excluirCliente,
} from "../services/firebase/clientes";
import { buscarUsuarios } from "../services/firebase/usuarios";
import {
  atualizarRecado,
  buscarRecados,
  criarRecado,
  excluirRecado,
} from "../services/firebase/recados";
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
  operador2Id: "",
  operador2Nome: "",
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

const RECADO_CLIENTE_INICIAL = {
  destinatarioUid: "",
  destinatarioNome: "",
  destinatarioRole: "",
  referenciaVinculo: "",
  titulo: "",
  mensagem: "",
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

function abrirLinkComPost(url, parametros = {}) {
  if (!url) return;

  const form = document.createElement("form");
  form.method = "POST";
  form.action = url;
  form.target = "_blank";
  form.style.display = "none";

  Object.entries(parametros).forEach(([chave, valor]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = chave;
    input.value = String(valor ?? "");
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

function obterRoleUsuario(usuario) {
  return normalizarTexto(usuario?.roles || usuario?.role);
}

function ehRoleVisualizavel(usuario) {
  return ["operador", "analista", "assistente"].includes(
    obterRoleUsuario(usuario),
  );
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

function obterNomesOperadoresCliente(cliente) {
  return [
    cliente.operadorNome || cliente.operador || "",
    cliente.operador2Nome || cliente.operador2 || "",
  ]
    .map((nome) => String(nome || "").trim())
    .filter(Boolean);
}

function obterVinculosRecadoCliente(cliente) {
  return [
    {
      key: "operador",
      label: "Operador",
      uid: cliente.operadorId || "",
      nome: cliente.operadorNome || cliente.operador || "",
      role: "operador",
    },
    {
      key: "operador2",
      label: "Operador 2",
      uid: cliente.operador2Id || "",
      nome: cliente.operador2Nome || cliente.operador2 || "",
      role: "operador",
    },
    {
      key: "analista",
      label: "Analista",
      uid: cliente.analistaId || "",
      nome: cliente.analistaNome || cliente.analista || "",
      role: "analista",
    },
    {
      key: "assistente",
      label: "Assistente",
      uid: cliente.assistenteId || "",
      nome: cliente.assistenteNome || cliente.assistente || "",
      role: "assistente",
    },
  ].filter((item) => item.uid && item.nome);
}

function obterLabelRecadoCliente(recado) {
  const nome = String(recado.destinatarioNome || "").trim();
  const referencia = String(recado.referenciaVinculo || "").trim().toLowerCase();

  const mapa = {
    operador: "Operador",
    operador2: "Operador 2",
    analista: "Analista",
    assistente: "Assistente",
  };

  if (!nome) return "-";
  if (!referencia || !mapa[referencia]) return nome;

  return `${mapa[referencia]} • ${nome}`;
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
    operador2Id: cliente.operador2Id || "",
    operador2Nome: cliente.operador2Nome || cliente.operador2 || "",
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
      cliente.operador2Id === uid ||
      (!cliente.operadorId &&
        normalizarTexto(cliente.operadorNome || cliente.operador) ===
          nomeUsuario) ||
      (!cliente.operador2Id &&
        normalizarTexto(cliente.operador2Nome || cliente.operador2) ===
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
  const [filtroEnvioSemanal, setFiltroEnvioSemanal] = useState("Todos");
  const [filtroVisualizarComo, setFiltroVisualizarComo] = useState("Eu");
  const [busca, setBusca] = useState("");

  const [modalAberto, setModalAberto] = useState(false);
  const [clienteEditandoId, setClienteEditandoId] = useState(null);
  const [form, setForm] = useState(CLIENTE_INICIAL);
  const [erroFormulario, setErroFormulario] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluindoId, setExcluindoId] = useState(null);

  const [clienteDetalhes, setClienteDetalhes] = useState(null);
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false);
  const [recadosDetalhes, setRecadosDetalhes] = useState([]);
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(false);

  const [recadosDoCliente, setRecadosDoCliente] = useState([]);
  const [recadoForm, setRecadoForm] = useState(RECADO_CLIENTE_INICIAL);
  const [recadoEditandoId, setRecadoEditandoId] = useState(null);
  const [erroRecado, setErroRecado] = useState("");
  const [salvandoRecado, setSalvandoRecado] = useState(false);
  const [carregandoRecadosCliente, setCarregandoRecadosCliente] = useState(false);
  const [excluindoRecadoId, setExcluindoRecadoId] = useState(null);

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

  const usuariosVisualizacaoDisponiveis = useMemo(() => {
    return usuarios
      .filter((usuarioItem) => ehRoleVisualizavel(usuarioItem))
      .sort(ordenarUsuariosParaVinculo);
  }, [usuarios]);

  const usuarioVisualizado = useMemo(() => {
    if (!podeGerenciarClientes || filtroVisualizarComo === "Eu") {
      return null;
    }

    return (
      usuariosVisualizacaoDisponiveis.find(
        (usuarioItem) => usuarioItem.id === filtroVisualizarComo,
      ) || null
    );
  }, [
    podeGerenciarClientes,
    filtroVisualizarComo,
    usuariosVisualizacaoDisponiveis,
  ]);

  const modoVisualizacaoAtivo = Boolean(usuarioVisualizado);

  const contextoVisualizacao = useMemo(() => {
    if (modoVisualizacaoAtivo && usuarioVisualizado) {
      return {
        userContexto: { uid: usuarioVisualizado.id },
        userDataContexto: {
          nome: usuarioVisualizado.nome || "",
          roles: usuarioVisualizado.roles || "",
        },
      };
    }

    return {
      userContexto: user,
      userDataContexto: userData,
    };
  }, [modoVisualizacaoAtivo, usuarioVisualizado, user, userData]);

  const podeAbrirDetalhesCliente = !podeGerenciarClientes || modoVisualizacaoAtivo;

  const clientesVisiveis = useMemo(() => {
    if (podeGerenciarClientes && !modoVisualizacaoAtivo) {
      return clientes;
    }

    return clientes.filter((cliente) =>
      clientePertenceAoUsuario(
        cliente,
        contextoVisualizacao.userContexto,
        contextoVisualizacao.userDataContexto,
      ),
    );
  }, [
    clientes,
    podeGerenciarClientes,
    modoVisualizacaoAtivo,
    contextoVisualizacao,
  ]);

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
        clientesVisiveis.flatMap((cliente) => obterNomesOperadoresCliente(cliente)),
      ),
    ].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [clientesVisiveis]);

  const operadoresDisponiveis = useMemo(() => {
    return montarUsuariosDisponiveis(usuarios, "operador", form.operadorId);
  }, [usuarios, form.operadorId]);

  const operadores2Disponiveis = useMemo(() => {
    return montarUsuariosDisponiveis(usuarios, "operador", form.operador2Id);
  }, [usuarios, form.operador2Id]);

  const analistasCadastroDisponiveis = useMemo(() => {
    return montarUsuariosDisponiveis(usuarios, "analista", form.analistaId);
  }, [usuarios, form.analistaId]);

  const assistentesDisponiveis = useMemo(() => {
    return montarUsuariosDisponiveis(usuarios, "assistente", form.assistenteId);
  }, [usuarios, form.assistenteId]);

  const destinatariosRecadoDisponiveis = useMemo(() => {
    return obterVinculosRecadoCliente(form);
  }, [form]);

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

        const nomesOperadores = obterNomesOperadoresCliente(cliente);

        const passouOperador =
          filtroOperador === "Todos" || nomesOperadores.includes(filtroOperador);

        const passouEnvioSemanal =
          filtroEnvioSemanal === "Todos" ||
          (filtroEnvioSemanal === "Sim"
            ? Boolean(cliente.envioSemanal)
            : !Boolean(cliente.envioSemanal));

        return (
          passouBusca &&
          passouAnalista &&
          passouCorte &&
          passouOperador &&
          passouEnvioSemanal
        );
      })
      .sort(ordenarClientesPorDataCorte);
  }, [
    clientesVisiveis,
    busca,
    filtroAnalista,
    filtroCorte,
    filtroOperador,
    filtroEnvioSemanal,
  ]);

  function limparFormularioRecado() {
    setRecadoForm(RECADO_CLIENTE_INICIAL);
    setRecadoEditandoId(null);
    setErroRecado("");
  }

  async function carregarRecadosDoCliente(clienteId) {
    if (!clienteId) {
      setRecadosDoCliente([]);
      return;
    }

    try {
      setCarregandoRecadosCliente(true);
      const dados = await buscarRecados({
        tipo: "cliente",
        clienteId,
      });
      setRecadosDoCliente(dados);
    } catch (error) {
      console.error("ERRO ao buscar recados do cliente:", error);
      setRecadosDoCliente([]);
    } finally {
      setCarregandoRecadosCliente(false);
    }
  }

  function abrirNovoCliente() {
    if (!podeGerenciarClientes) {
      alert("Você não tem permissão para cadastrar clientes.");
      return;
    }

    setClienteEditandoId(null);
    setForm(CLIENTE_INICIAL);
    setErroFormulario("");
    setRecadosDoCliente([]);
    limparFormularioRecado();
    setModalAberto(true);
  }

  async function abrirEdicao(cliente) {
    if (!podeGerenciarClientes) {
      alert("Você não tem permissão para editar clientes.");
      return;
    }

    setClienteEditandoId(cliente.id);
    setForm(normalizarClienteParaFormulario(cliente));
    setErroFormulario("");
    limparFormularioRecado();
    setModalAberto(true);
    await carregarRecadosDoCliente(cliente.id);
  }

  function fecharModal(forcarFechamento = false) {
    if (salvando && !forcarFechamento) return;

    setModalAberto(false);
    setClienteEditandoId(null);
    setForm(CLIENTE_INICIAL);
    setErroFormulario("");
    setRecadosDoCliente([]);
    limparFormularioRecado();
  }

  function fecharModalDetalhes() {
    setModalDetalhesAberto(false);
    setClienteDetalhes(null);
    setRecadosDetalhes([]);
    setCarregandoDetalhes(false);
  }

  function limparFiltros() {
    setFiltroAnalista("Todos");
    setFiltroCorte("Todos");
    setFiltroOperador("Todos");
    setFiltroEnvioSemanal("Todos");
    setFiltroVisualizarComo("Eu");
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

  function handleRecadoChange(event) {
    const { name, value } = event.target;

    setRecadoForm((estadoAtual) => ({
      ...estadoAtual,
      [name]: value,
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

  function handleDestinatarioRecadoChange(event) {
    const usuarioId = event.target.value;
    const itemSelecionado = destinatariosRecadoDisponiveis.find(
      (item) => item.uid === usuarioId,
    );

    setRecadoForm((estadoAtual) => ({
      ...estadoAtual,
      destinatarioUid: usuarioId,
      destinatarioNome: itemSelecionado?.nome || "",
      destinatarioRole: itemSelecionado?.role || "",
      referenciaVinculo: itemSelecionado?.key || "",
    }));
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
      form.operadorId &&
      form.operador2Id &&
      form.operadorId === form.operador2Id
    ) {
      return "Selecione operadores diferentes para Operador 1 e Operador 2.";
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

  function validarFormularioRecado() {
    if (!clienteEditandoId) {
      return "Salve o cliente primeiro para cadastrar recados.";
    }

    if (!recadoForm.destinatarioUid) {
      return "Selecione para quem o recado será enviado.";
    }

    if (!String(recadoForm.mensagem || "").trim()) {
      return "Digite a mensagem do recado.";
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

  async function handleSubmitRecadoCliente(event) {
    event.preventDefault();

    if (!podeGerenciarClientes) {
      setErroRecado("Você não tem permissão para salvar recados.");
      return;
    }

    const mensagemErro = validarFormularioRecado();

    if (mensagemErro) {
      setErroRecado(mensagemErro);
      return;
    }

    try {
      setSalvandoRecado(true);
      setErroRecado("");

      const payload = {
        tipo: "cliente",
        clienteId: clienteEditandoId,
        clienteNome: form.nome,
        destinatarioUid: recadoForm.destinatarioUid,
        destinatarioNome: recadoForm.destinatarioNome,
        destinatarioRole: recadoForm.destinatarioRole,
        referenciaVinculo: recadoForm.referenciaVinculo,
        titulo: recadoForm.titulo,
        mensagem: recadoForm.mensagem,
        ativo: recadoForm.ativo,
        createdByUid: user?.uid || "",
        createdByNome: userData?.nome || "",
      };

      if (recadoEditandoId) {
        await atualizarRecado(recadoEditandoId, payload);
      } else {
        await criarRecado(payload);
      }

      await carregarRecadosDoCliente(clienteEditandoId);
      limparFormularioRecado();
    } catch (error) {
      console.error("ERRO ao salvar recado do cliente:", error);
      setErroRecado("Não foi possível salvar o recado do cliente.");
    } finally {
      setSalvandoRecado(false);
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

  async function handleExcluirRecadoCliente(recado) {
    if (!podeGerenciarClientes) {
      alert("Você não tem permissão para excluir recados.");
      return;
    }

    const confirmou = window.confirm(
      `Deseja realmente excluir o recado para "${recado.destinatarioNome}"?`,
    );

    if (!confirmou) return;

    try {
      setExcluindoRecadoId(recado.id);
      await excluirRecado(recado.id, user?.uid || null);
      await carregarRecadosDoCliente(clienteEditandoId);
      if (recadoEditandoId === recado.id) {
        limparFormularioRecado();
      }
    } catch (error) {
      console.error("ERRO ao excluir recado do cliente:", error);
      alert("Não foi possível excluir o recado do cliente.");
    } finally {
      setExcluindoRecadoId(null);
    }
  }

  function abrirEdicaoRecadoCliente(recado) {
    setRecadoEditandoId(recado.id);
    setRecadoForm({
      destinatarioUid: recado.destinatarioUid || "",
      destinatarioNome: recado.destinatarioNome || "",
      destinatarioRole: recado.destinatarioRole || "",
      referenciaVinculo: recado.referenciaVinculo || "",
      titulo: recado.titulo || "",
      mensagem: recado.mensagem || "",
      ativo: recado.ativo ?? true,
    });
    setErroRecado("");
  }

  async function abrirDetalhesCliente(cliente) {
    if (!podeAbrirDetalhesCliente) return;

    const destinatarioUid = modoVisualizacaoAtivo
      ? usuarioVisualizado?.id || ""
      : user?.uid || "";

    setClienteDetalhes(cliente);
    setModalDetalhesAberto(true);
    setRecadosDetalhes([]);
    setCarregandoDetalhes(true);

    try {
      if (!destinatarioUid) {
        setRecadosDetalhes([]);
        return;
      }

      const dadosRecados = await buscarRecados({
        tipo: "cliente",
        clienteId: cliente.id,
        destinatarioUid,
        somenteAtivos: true,
      });

      setRecadosDetalhes(dadosRecados);
    } catch (error) {
      console.error("ERRO ao buscar detalhes do cliente:", error);
      setRecadosDetalhes([]);
    } finally {
      setCarregandoDetalhes(false);
    }
  }

  function handleAbrirSistemaCliente(cliente) {
    const url = String(cliente?.linkNossoSistema || "").trim();

    if (!url) {
      alert("Este cliente não possui link do sistema cadastrado.");
      return;
    }

    abrirLinkComPost(url, {
      acesso_externo: 1,
    });
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
            <label htmlFor="filtro-envio-semanal">Envio semanal</label>
            <select
              id="filtro-envio-semanal"
              value={filtroEnvioSemanal}
              onChange={(event) => setFiltroEnvioSemanal(event.target.value)}
            >
              <option value="Todos">Todos</option>
              <option value="Sim">Sim</option>
              <option value="Não">Não</option>
            </select>
          </div>

          {podeGerenciarClientes ? (
            <div className="field">
              <label htmlFor="filtro-visualizar-como">Visualizar como</label>
              <select
                id="filtro-visualizar-como"
                value={filtroVisualizarComo}
                onChange={(event) => setFiltroVisualizarComo(event.target.value)}
              >
                <option value="Eu">Eu</option>
                {usuariosVisualizacaoDisponiveis.map((usuarioItem) => (
                  <option key={usuarioItem.id} value={usuarioItem.id}>
                    {usuarioItem.nome} ({String(usuarioItem.roles || "").trim()})
                  </option>
                ))}
              </select>
            </div>
          ) : null}

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
            {modoVisualizacaoAtivo ? (
              <p className="clientes-visualizando-como">
                Visualizando como: <strong>{usuarioVisualizado?.nome}</strong>
              </p>
            ) : null}
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
                    <th>Operador 2</th>
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
                      className={`${cliente.ativo ? "" : "clientes-table__row--inativo"} ${
                        podeAbrirDetalhesCliente
                          ? "clientes-table__row--clickable"
                          : ""
                      }`}
                      onClick={
                        podeAbrirDetalhesCliente
                          ? () => abrirDetalhesCliente(cliente)
                          : undefined
                      }
                    >
                      {podeGerenciarClientes ? (
                        <td>
                          <div className="clientes-actions">
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                abrirEdicao(cliente);
                              }}
                              disabled={excluindoId === cliente.id}
                            >
                              Editar
                            </button>

                            <button
                              className="ghost-button"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleExcluir(cliente);
                              }}
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
                      <td>{cliente.operador2Nome || cliente.operador2 || "-"}</td>

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
                  } ${podeAbrirDetalhesCliente ? "cliente-card--clickable" : ""}`}
                  onClick={
                    podeAbrirDetalhesCliente
                      ? () => abrirDetalhesCliente(cliente)
                      : undefined
                  }
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
                          onClick={(event) => {
                            event.stopPropagation();
                            abrirEdicao(cliente);
                          }}
                          disabled={excluindoId === cliente.id}
                        >
                          Editar
                        </button>

                        <button
                          className="ghost-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleExcluir(cliente);
                          }}
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
                      <span>Operador 2</span>
                      <strong>
                        {cliente.operador2Nome || cliente.operador2 || "-"}
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

      {modalDetalhesAberto && clienteDetalhes ? (
        <div className="modal-backdrop" onClick={fecharModalDetalhes}>
          <div
            className="modal modal--medium"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal__header">
              <div className="modal__title-group">
                <p className="page-header__eyebrow">
                  {modoVisualizacaoAtivo
                    ? `Visualizando como ${usuarioVisualizado?.nome || ""}`
                    : "Detalhes do cliente"}
                </p>
                <h3>{clienteDetalhes.nome}</h3>
              </div>

              <button
                className="ghost-button"
                type="button"
                onClick={fecharModalDetalhes}
              >
                Fechar
              </button>
            </div>

            <div className="clientes-detalhes">
              <div className="clientes-detalhes__grid">
                <div>
                  <span>CNPJ</span>
                  <strong>{formatarCNPJExibicao(clienteDetalhes.cnpj)}</strong>
                </div>

                <div>
                  <span>Analista</span>
                  <strong>
                    {clienteDetalhes.analistaNome ||
                      clienteDetalhes.analista ||
                      "-"}
                  </strong>
                </div>

                <div>
                  <span>Assistente</span>
                  <strong>
                    {clienteDetalhes.assistenteNome ||
                      clienteDetalhes.assistente ||
                      "-"}
                  </strong>
                </div>

                <div>
                  <span>Operador</span>
                  <strong>
                    {clienteDetalhes.operadorNome ||
                      clienteDetalhes.operador ||
                      "-"}
                  </strong>
                </div>

                <div>
                  <span>Operador 2</span>
                  <strong>
                    {clienteDetalhes.operador2Nome ||
                      clienteDetalhes.operador2 ||
                      "-"}
                  </strong>
                </div>

                <div>
                  <span>Processamento</span>
                  <strong>{clienteDetalhes.tipoProcessamento || "-"}</strong>
                </div>

                <div>
                  <span>Folga fora</span>
                  <strong>{booleanParaTexto(clienteDetalhes.folgaFora)}</strong>
                </div>

                <div>
                  <span>Tem diárias</span>
                  <strong>{booleanParaTexto(clienteDetalhes.temDiarias)}</strong>
                </div>

                <div>
                  <span>Envio semanal</span>
                  <strong>{booleanParaTexto(clienteDetalhes.envioSemanal)}</strong>
                </div>

                <div>
                  <span>Cliente acessa sistema</span>
                  <strong>
                    {booleanParaTexto(clienteDetalhes.clienteAcessaSistema)}
                  </strong>
                </div>

                <div>
                  <span>Data de corte</span>
                  <strong>Dia {clienteDetalhes.dataCorteDia || "-"}</strong>
                </div>

                <div>
                  <span>Status</span>
                  <strong>{clienteDetalhes.ativo ? "Ativo" : "Inativo"}</strong>
                </div>
              </div>

              <div className="clientes-detalhes__blocos">
                <div className="clientes-detalhes__bloco">
                  <span>Observação</span>
                  <p>{clienteDetalhes.observacao || "-"}</p>
                </div>

                <div className="clientes-detalhes__bloco">
                  <span>Regra específica</span>
                  <p>{clienteDetalhes.regraEspecifica || "-"}</p>
                </div>

                <div className="clientes-detalhes__bloco">
                  <span>Link do sistema</span>
                  <p>
                    {clienteDetalhes.linkNossoSistema ? (
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => handleAbrirSistemaCliente(clienteDetalhes)}
                      >
                        Abrir sistema
                      </button>
                    ) : (
                      "-"
                    )}
                  </p>
                </div>
              </div>

              <div className="clientes-detalhes__recados">
                <div className="clientes-toolbar clientes-toolbar--interno">
                  <div>
                    <h3>
                      {modoVisualizacaoAtivo
                        ? `Recados para ${usuarioVisualizado?.nome || ""}`
                        : "Recados para você"}
                    </h3>
                    <p>Recados vinculados especificamente a este cliente.</p>
                  </div>
                </div>

                {carregandoDetalhes ? (
                  <div className="clientes-feedback">
                    <p>Carregando recados...</p>
                  </div>
                ) : recadosDetalhes.length === 0 ? (
                  <div className="clientes-empty clientes-empty--compacto">
                    <h4>Nenhum recado encontrado</h4>
                    <p>Não há recados direcionados para este cliente.</p>
                  </div>
                ) : (
                  <div className="clientes-recados-lista">
                    {recadosDetalhes.map((recado) => (
                      <article
                        key={recado.id}
                        className="clientes-recado-card"
                      >
                        {recado.titulo ? <strong>{recado.titulo}</strong> : null}
                        <p>{recado.mensagem || "-"}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
                  <label htmlFor="operador2Id">Operador 2</label>
                  <select
                    id="operador2Id"
                    name="operador2Id"
                    value={form.operador2Id}
                    onChange={handleUsuarioVinculadoChange(
                      "operador2Id",
                      "operador2Nome",
                      operadores2Disponiveis,
                    )}
                  >
                    <option value="">Selecione um responsável</option>
                    {operadores2Disponiveis.map((usuarioItem) => (
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

            {clienteEditandoId ? (
              <div className="clientes-recados-admin">
                <div className="clientes-toolbar clientes-toolbar--interno">
                  <div>
                    <h3>Recados do cliente</h3>
                    <p>
                      Cadastre recados direcionados aos vínculos deste cliente.
                    </p>
                  </div>
                </div>

                {carregandoRecadosCliente ? (
                  <div className="clientes-feedback">
                    <p>Carregando recados do cliente...</p>
                  </div>
                ) : recadosDoCliente.length === 0 ? (
                  <div className="clientes-empty clientes-empty--compacto">
                    <h4>Nenhum recado cadastrado</h4>
                    <p>Adicione o primeiro recado deste cliente abaixo.</p>
                  </div>
                ) : (
                  <div className="clientes-recados-admin__lista">
                    {recadosDoCliente.map((recado) => (
                      <article
                        key={recado.id}
                        className={`clientes-recado-admin-card ${
                          recado.ativo ? "" : "clientes-recado-admin-card--inativo"
                        }`}
                      >
                        <div className="clientes-recado-admin-card__header">
                          <div>
                            <strong>{obterLabelRecadoCliente(recado)}</strong>
                            {recado.titulo ? <p>{recado.titulo}</p> : null}
                          </div>

                          <div className="clientes-actions">
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => abrirEdicaoRecadoCliente(recado)}
                              disabled={excluindoRecadoId === recado.id}
                            >
                              Editar
                            </button>

                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => handleExcluirRecadoCliente(recado)}
                              disabled={excluindoRecadoId === recado.id}
                            >
                              {excluindoRecadoId === recado.id
                                ? "Excluindo..."
                                : "Excluir"}
                            </button>
                          </div>
                        </div>

                        <p>{recado.mensagem || "-"}</p>
                      </article>
                    ))}
                  </div>
                )}

                <form
                  className="clientes-recado-form"
                  onSubmit={handleSubmitRecadoCliente}
                >
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="destinatarioUid">Recado para</label>
                      <select
                        id="destinatarioUid"
                        name="destinatarioUid"
                        value={recadoForm.destinatarioUid}
                        onChange={handleDestinatarioRecadoChange}
                      >
                        <option value="">Selecione um vínculo</option>
                        {destinatariosRecadoDisponiveis.map((item) => (
                          <option key={`${item.key}-${item.uid}`} value={item.uid}>
                            {item.label} - {item.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor="recadoTitulo">Título</label>
                      <input
                        id="recadoTitulo"
                        name="titulo"
                        type="text"
                        value={recadoForm.titulo}
                        onChange={handleRecadoChange}
                        placeholder="Opcional"
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="recadoAtivo">Status do recado</label>
                      <select
                        id="recadoAtivo"
                        name="ativo"
                        value={String(recadoForm.ativo)}
                        onChange={(event) =>
                          setRecadoForm((estadoAtual) => ({
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
                      <label htmlFor="recadoMensagem">Mensagem</label>
                      <textarea
                        id="recadoMensagem"
                        name="mensagem"
                        rows="4"
                        value={recadoForm.mensagem}
                        onChange={handleRecadoChange}
                        placeholder="Digite o recado para aparecer no card do cliente"
                      />
                    </div>
                  </div>

                  {erroRecado ? (
                    <div className="clientes-feedback clientes-feedback--erro">
                      <p>{erroRecado}</p>
                    </div>
                  ) : null}

                  <div className="modal__actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={limparFormularioRecado}
                      disabled={salvandoRecado}
                    >
                      Limpar recado
                    </button>

                    <button
                      className="primary-button"
                      type="submit"
                      disabled={salvandoRecado}
                    >
                      {salvandoRecado
                        ? "Salvando recado..."
                        : recadoEditandoId
                          ? "Salvar recado"
                          : "Adicionar recado"}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default Clientes;