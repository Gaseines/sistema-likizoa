import { useEffect, useMemo, useState } from "react";
import "./recados.css";

import { useAuth } from "../contexts/AuthContext";
import { ehAdminOuGestor } from "../utils/permissoes";
import { buscarUsuarios } from "../services/firebase/usuarios";
import {
  atualizarRecado,
  buscarRecados,
  criarRecado,
  excluirRecado,
} from "../services/firebase/recados";

const FORM_INICIAL = {
  tipo: "dashboard",
  clienteId: "",
  clienteNome: "",
  destinatarioUid: "",
  destinatarioNome: "",
  destinatarioRole: "",
  referenciaVinculo: "",
  titulo: "",
  mensagem: "",
  ativo: true,
};

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase();
}

function obterRoleUsuario(usuario) {
  return normalizarTexto(usuario?.roles || usuario?.role);
}

function labelRole(role) {
  const roleNormalizada = normalizarTexto(role);

  const mapa = {
    operador: "Operador",
    analista: "Analista",
    assistente: "Assistente",
  };

  return mapa[roleNormalizada] || "-";
}

function podeReceberRecado(usuario) {
  const role = obterRoleUsuario(usuario);
  return ["operador", "analista", "assistente"].includes(role);
}

function ordenarUsuariosParaRecado(a, b) {
  const ativoA = a.ativo !== false;
  const ativoB = b.ativo !== false;

  if (ativoA !== ativoB) {
    return ativoA ? -1 : 1;
  }

  return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", {
    sensitivity: "base",
  });
}

function Recados() {
  const { user, userData, loading } = useAuth();
  const podeGerenciarRecados = ehAdminOuGestor(userData);

  const [recados, setRecados] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState("");

  const [busca, setBusca] = useState("");

  const [modalAberto, setModalAberto] = useState(false);
  const [recadoEditandoId, setRecadoEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [erroFormulario, setErroFormulario] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluindoId, setExcluindoId] = useState("");

  async function carregarDados() {
    try {
      setCarregandoLista(true);
      setErroLista("");

      const [dadosRecados, dadosUsuarios] = await Promise.all([
        buscarRecados({ tipo: "dashboard" }),
        buscarUsuarios(),
      ]);

      setRecados(dadosRecados);
      setUsuarios(dadosUsuarios.sort(ordenarUsuariosParaRecado));
    } catch (error) {
      console.error("ERRO ao buscar recados:", error);
      setErroLista("Não foi possível carregar os recados.");
    } finally {
      setCarregandoLista(false);
    }
  }

  useEffect(() => {
    if (!loading && podeGerenciarRecados) {
      carregarDados();
    }
  }, [loading, podeGerenciarRecados]);

  const usuariosDisponiveis = useMemo(() => {
    return usuarios
      .filter((usuarioItem) => podeReceberRecado(usuarioItem))
      .filter((usuarioItem) => {
        if (usuarioItem.ativo !== false) return true;
        return usuarioItem.id === form.destinatarioUid;
      })
      .sort(ordenarUsuariosParaRecado);
  }, [usuarios, form.destinatarioUid]);

  const recadosFiltrados = useMemo(() => {
    const textoBusca = busca.trim().toLowerCase();

    if (!textoBusca) {
      return recados;
    }

    return recados.filter((recado) => {
      const destinatarioMatch = String(recado.destinatarioNome || "")
        .toLowerCase()
        .includes(textoBusca);

      const roleMatch = String(recado.destinatarioRole || "")
        .toLowerCase()
        .includes(textoBusca);

      const tituloMatch = String(recado.titulo || "")
        .toLowerCase()
        .includes(textoBusca);

      const mensagemMatch = String(recado.mensagem || "")
        .toLowerCase()
        .includes(textoBusca);

      const statusMatch =
        recado.ativo === true
          ? "ativo".includes(textoBusca)
          : "inativo".includes(textoBusca);

      return (
        destinatarioMatch ||
        roleMatch ||
        tituloMatch ||
        mensagemMatch ||
        statusMatch
      );
    });
  }, [recados, busca]);

  function abrirNovoRecado() {
    setRecadoEditandoId(null);
    setForm(FORM_INICIAL);
    setErroFormulario("");
    setModalAberto(true);
  }

  function abrirEdicao(recado) {
    setRecadoEditandoId(recado.id);
    setForm({
      tipo: recado.tipo || "dashboard",
      clienteId: recado.clienteId || "",
      clienteNome: recado.clienteNome || "",
      destinatarioUid: recado.destinatarioUid || "",
      destinatarioNome: recado.destinatarioNome || "",
      destinatarioRole: recado.destinatarioRole || "",
      referenciaVinculo: recado.referenciaVinculo || "",
      titulo: recado.titulo || "",
      mensagem: recado.mensagem || "",
      ativo: recado.ativo ?? true,
    });
    setErroFormulario("");
    setModalAberto(true);
  }

  function fecharModal(forcarFechamento = false) {
    if (salvando && !forcarFechamento) return;

    setModalAberto(false);
    setRecadoEditandoId(null);
    setForm(FORM_INICIAL);
    setErroFormulario("");
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((estadoAtual) => ({
      ...estadoAtual,
      [name]: value,
    }));
  }

  function handleDestinatarioChange(event) {
    const usuarioId = event.target.value;
    const usuarioSelecionado = usuarios.find(
      (usuarioItem) => usuarioItem.id === usuarioId,
    );

    setForm((estadoAtual) => ({
      ...estadoAtual,
      destinatarioUid: usuarioId,
      destinatarioNome: usuarioSelecionado?.nome || "",
      destinatarioRole: usuarioSelecionado?.roles || "",
    }));
  }

  function validarFormulario() {
    if (!form.destinatarioUid) {
      return "Selecione para quem o recado será enviado.";
    }

    if (!String(form.mensagem || "").trim()) {
      return "Digite a mensagem do recado.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!podeGerenciarRecados) {
      setErroFormulario("Você não tem permissão para salvar recados.");
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

      const payload = {
        ...form,
        tipo: "dashboard",
        createdByUid: user?.uid || "",
        createdByNome: userData?.nome || "",
      };

      if (recadoEditandoId) {
        await atualizarRecado(recadoEditandoId, payload);
      } else {
        await criarRecado(payload);
      }

      await carregarDados();
      fecharModal(true);
    } catch (error) {
      console.error("ERRO ao salvar recado:", error);
      setErroFormulario("Não foi possível salvar o recado.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir(recado) {
    if (!podeGerenciarRecados) {
      alert("Você não tem permissão para excluir recados.");
      return;
    }

    const confirmou = window.confirm(
      `Deseja realmente excluir o recado para "${recado.destinatarioNome}"?`,
    );

    if (!confirmou) return;

    try {
      setExcluindoId(recado.id);
      await excluirRecado(recado.id, user?.uid || null);
      await carregarDados();
    } catch (error) {
      console.error("ERRO ao excluir recado:", error);
      alert("Não foi possível excluir o recado.");
    } finally {
      setExcluindoId("");
    }
  }

  if (loading) {
    return (
      <section className="page">
        <div className="card">
          <div className="recados-feedback">
            <p>Carregando permissões...</p>
          </div>
        </div>
      </section>
    );
  }

  if (!podeGerenciarRecados) {
    return (
      <section className="page">
        <div className="page-header">
          <div>
            <h1>Recados</h1>
            <p className="page-header__description">
              Gestão de recados internos para os usuários do sistema.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="recados-feedback recados-feedback--erro">
            <p>Você não tem permissão para acessar este módulo.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Recados</h1>
          <p className="page-header__description">
            Aqui você cria recados gerais que aparecerão no dashboard dos
            operadores, analistas e assistentes.
          </p>
        </div>

        <button
          className="primary-button"
          type="button"
          onClick={abrirNovoRecado}
        >
          + Novo recado
        </button>
      </div>

      <div className="card">
        <div className="recados-toolbar">
          <div>
            <h3>Busca</h3>
            <p>
              Pesquise por destinatário, função, título, mensagem ou status.
            </p>
          </div>

          <div className="recados-search">
            <div className="field">
              <label htmlFor="busca-recados">Buscar</label>
              <input
                id="busca-recados"
                type="text"
                placeholder="Ex: Maria, operador, atraso, ativo..."
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="recados-toolbar">
          <div>
            <h3>Lista de recados</h3>
            <p>{recadosFiltrados.length} recado(s) encontrado(s)</p>
          </div>
        </div>

        {carregandoLista ? (
          <div className="recados-feedback">
            <p>Carregando recados...</p>
          </div>
        ) : erroLista ? (
          <div className="recados-feedback recados-feedback--erro">
            <p>{erroLista}</p>
          </div>
        ) : recadosFiltrados.length === 0 ? (
          <div className="recados-empty">
            <h4>Nenhum recado encontrado</h4>
            <p>Cadastre um novo recado ou ajuste a busca.</p>
          </div>
        ) : (
          <>
            <div className="recados-table-wrapper">
              <table className="recados-table">
                <thead>
                  <tr>
                    <th>Destinatário</th>
                    <th>Função</th>
                    <th>Título</th>
                    <th>Mensagem</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {recadosFiltrados.map((recado) => (
                    <tr
                      key={recado.id}
                      className={recado.ativo ? "" : "recados-row--inativo"}
                    >
                      <td>
                        <div className="recados-stack">
                          <strong>{recado.destinatarioNome || "-"}</strong>
                        </div>
                      </td>

                      <td>
                        <span className="recados-role-badge">
                          {labelRole(recado.destinatarioRole)}
                        </span>
                      </td>

                      <td>{recado.titulo || "-"}</td>
                      <td>{recado.mensagem || "-"}</td>

                      <td>
                        <span
                          className={
                            recado.ativo
                              ? "recados-status-badge recados-status-badge--ativo"
                              : "recados-status-badge recados-status-badge--inativo"
                          }
                        >
                          {recado.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>

                      <td>
                        <div className="recados-actions">
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => abrirEdicao(recado)}
                            disabled={excluindoId === recado.id}
                          >
                            Editar
                          </button>

                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => handleExcluir(recado)}
                            disabled={excluindoId === recado.id}
                          >
                            {excluindoId === recado.id
                              ? "Excluindo..."
                              : "Excluir"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="recados-mobile-list">
              {recadosFiltrados.map((recado) => (
                <article
                  key={recado.id}
                  className={`recado-card ${
                    recado.ativo ? "" : "recado-card--inativo"
                  }`}
                >
                  <div className="recado-card__header">
                    <div>
                      <h4>{recado.destinatarioNome || "-"}</h4>
                      <p>{labelRole(recado.destinatarioRole)}</p>
                    </div>

                    <div className="recados-actions">
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => abrirEdicao(recado)}
                        disabled={excluindoId === recado.id}
                      >
                        Editar
                      </button>

                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => handleExcluir(recado)}
                        disabled={excluindoId === recado.id}
                      >
                        {excluindoId === recado.id ? "Excluindo..." : "Excluir"}
                      </button>
                    </div>
                  </div>

                  <div className="recado-card__grid">
                    <div>
                      <span>Título</span>
                      <strong>{recado.titulo || "-"}</strong>
                    </div>

                    <div>
                      <span>Mensagem</span>
                      <strong>{recado.mensagem || "-"}</strong>
                    </div>

                    <div>
                      <span>Status</span>
                      <strong>{recado.ativo ? "Ativo" : "Inativo"}</strong>
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
          <div
            className="modal modal--medium"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal__header">
              <div className="modal__title-group">
                <p className="page-header__eyebrow">
                  {recadoEditandoId ? "Editar recado" : "Novo recado"}
                </p>
                <h3>
                  {recadoEditandoId ? "Atualizar recado" : "Cadastrar recado"}
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
                  <label htmlFor="destinatarioUid">Destinatário</label>
                  <select
                    id="destinatarioUid"
                    name="destinatarioUid"
                    value={form.destinatarioUid}
                    onChange={handleDestinatarioChange}
                  >
                    <option value="">Selecione um usuário</option>
                    {usuariosDisponiveis.map((usuarioItem) => (
                      <option key={usuarioItem.id} value={usuarioItem.id}>
                        {usuarioItem.nome}
                        {usuarioItem.ativo === false ? " (inativo)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="titulo">Título</label>
                  <input
                    id="titulo"
                    name="titulo"
                    type="text"
                    value={form.titulo}
                    onChange={handleChange}
                    placeholder="Ex.: Atenção para pendências"
                  />
                </div>

                <div className="field">
                  <label htmlFor="ativo">Status do recado</label>
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
                  <label htmlFor="mensagem">Mensagem</label>
                  <textarea
                    id="mensagem"
                    name="mensagem"
                    rows="5"
                    value={form.mensagem}
                    onChange={handleChange}
                    placeholder="Digite o recado que aparecerá no dashboard do usuário"
                  />
                </div>
              </div>

              {erroFormulario ? (
                <div className="recados-feedback recados-feedback--erro">
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
                    : recadoEditandoId
                      ? "Salvar alterações"
                      : "Cadastrar recado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default Recados;
