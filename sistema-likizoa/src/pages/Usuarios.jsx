import { useEffect, useMemo, useState } from "react";
import "./usuarios.css";

import { useAuth } from "../contexts/AuthContext";
import { ehAdminOuGestor } from "../utils/permissoes";
import {
  atualizarUsuario,
  buscarUsuarios,
  criarUsuario,
  excluirUsuario,
} from "../services/firebase/usuarios";

const ROLES_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "gestor", label: "Gestor" },
  { value: "operador", label: "Operador" },
  { value: "analista", label: "Analista" },
  { value: "assistente", label: "Assistente" },
];

const FORM_INICIAL = {
  nome: "",
  email: "",
  senha: "",
  roles: "operador",
  ativo: true,
};

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function labelRole(role) {
  const item = ROLES_OPTIONS.find(
    (option) => option.value === String(role || "").toLowerCase(),
  );

  return item?.label || "-";
}

function Usuarios() {
  const { user, userData, loading } = useAuth();
  const podeGerenciarUsuarios = ehAdminOuGestor(userData);

  const [usuarios, setUsuarios] = useState([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState("");

  const [busca, setBusca] = useState("");

  const [modalAberto, setModalAberto] = useState(false);
  const [usuarioEditandoId, setUsuarioEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [erroFormulario, setErroFormulario] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluindoId, setExcluindoId] = useState("");

  async function carregarUsuarios() {
    try {
      setCarregandoLista(true);
      setErroLista("");

      const dados = await buscarUsuarios();
      setUsuarios(dados);
    } catch (error) {
      console.error("ERRO ao buscar usuários:", error);
      setErroLista("Não foi possível carregar os usuários.");
    } finally {
      setCarregandoLista(false);
    }
  }

  useEffect(() => {
    if (!loading && podeGerenciarUsuarios) {
      carregarUsuarios();
    }
  }, [loading, podeGerenciarUsuarios]);

  const usuariosFiltrados = useMemo(() => {
    const textoBusca = busca.trim().toLowerCase();

    if (!textoBusca) {
      return usuarios;
    }

    return usuarios.filter((usuarioItem) => {
      const nomeMatch = String(usuarioItem.nome || "")
        .toLowerCase()
        .includes(textoBusca);

      const emailMatch = String(usuarioItem.email || "")
        .toLowerCase()
        .includes(textoBusca);

      const roleMatch = String(usuarioItem.roles || "")
        .toLowerCase()
        .includes(textoBusca);

      const statusMatch = usuarioItem.ativo
        ? "ativo".includes(textoBusca)
        : "inativo".includes(textoBusca);

      return nomeMatch || emailMatch || roleMatch || statusMatch;
    });
  }, [usuarios, busca]);

  function abrirNovoUsuario() {
    setUsuarioEditandoId(null);
    setForm(FORM_INICIAL);
    setErroFormulario("");
    setModalAberto(true);
  }

  function abrirEdicao(usuarioItem) {
    setUsuarioEditandoId(usuarioItem.id);
    setForm({
      nome: usuarioItem.nome || "",
      email: usuarioItem.email || "",
      senha: "",
      roles: usuarioItem.roles || "operador",
      ativo: usuarioItem.ativo ?? true,
    });
    setErroFormulario("");
    setModalAberto(true);
  }

  function fecharModal(forcarFechamento = false) {
    if (salvando && !forcarFechamento) return;

    setModalAberto(false);
    setUsuarioEditandoId(null);
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

  function validarFormulario() {
    if (!form.nome.trim()) {
      return "Preencha o nome do usuário.";
    }

    if (!validarEmail(form.email)) {
      return "Preencha um e-mail válido.";
    }

    if (!form.roles) {
      return "Selecione a função do usuário.";
    }

    if (!usuarioEditandoId && String(form.senha || "").length < 6) {
      return "A senha provisória deve ter pelo menos 6 caracteres.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!podeGerenciarUsuarios) {
      setErroFormulario("Você não tem permissão para salvar usuários.");
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

      if (usuarioEditandoId) {
        await atualizarUsuario(usuarioEditandoId, form);
      } else {
        await criarUsuario(form);
      }

      await carregarUsuarios();
      fecharModal(true);
    } catch (error) {
      console.error("ERRO ao salvar usuário:", error);

      if (error?.code === "auth/email-already-in-use") {
        setErroFormulario("Esse e-mail já está em uso.");
      } else if (error?.code === "auth/invalid-email") {
        setErroFormulario("O e-mail informado é inválido.");
      } else if (error?.code === "auth/weak-password") {
        setErroFormulario("A senha informada é fraca demais.");
      } else {
        setErroFormulario("Não foi possível salvar o usuário.");
      }
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir(usuarioItem) {
    if (!podeGerenciarUsuarios) {
      alert("Você não tem permissão para excluir usuários.");
      return;
    }

    if (usuarioItem.id === user?.uid) {
      alert("Você não pode excluir seu próprio usuário.");
      return;
    }

    const confirmou = window.confirm(
      `Deseja realmente excluir o usuário "${usuarioItem.nome}"?`,
    );

    if (!confirmou) return;

    try {
      setExcluindoId(usuarioItem.id);
      await excluirUsuario(usuarioItem.id, user?.uid || null);
      await carregarUsuarios();
    } catch (error) {
      console.error("ERRO ao excluir usuário:", error);
      alert("Não foi possível excluir o usuário.");
    } finally {
      setExcluindoId("");
    }
  }

  if (loading) {
    return (
      <section className="page">
        <div className="card">
          <div className="usuarios-feedback">
            <p>Carregando permissões...</p>
          </div>
        </div>
      </section>
    );
  }

  if (!podeGerenciarUsuarios) {
    return (
      <section className="page">
        <div className="page-header">
          <div>
            
            <h1>Usuários</h1>
            <p className="page-header__description">
              Cadastro interno de usuários do sistema.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="usuarios-feedback usuarios-feedback--erro">
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
          
          <h1>Usuários</h1>
          <p className="page-header__description">
            Aqui você cadastra e organiza os usuários internos do sistema.
          </p>
        </div>

        <button
          className="primary-button"
          type="button"
          onClick={abrirNovoUsuario}
        >
          + Novo usuário
        </button>
      </div>

      <div className="card">
        <div className="usuarios-toolbar">
          <div>
            <h3>Busca</h3>
            <p>Pesquise por nome, e-mail, função ou status.</p>
          </div>

          <div className="usuarios-search">
            <div className="field">
              <label htmlFor="busca-usuarios">Buscar</label>
              <input
                id="busca-usuarios"
                type="text"
                placeholder="Ex: Maria, maria@empresa.com, analista ou inativo"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="usuarios-toolbar">
          <div>
            <h3>Lista de usuários</h3>
            <p>{usuariosFiltrados.length} usuário(s) encontrado(s)</p>
          </div>
        </div>

        {carregandoLista ? (
          <div className="usuarios-feedback">
            <p>Carregando usuários...</p>
          </div>
        ) : erroLista ? (
          <div className="usuarios-feedback usuarios-feedback--erro">
            <p>{erroLista}</p>
          </div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="usuarios-empty">
            <h4>Nenhum usuário encontrado</h4>
            <p>Cadastre um novo usuário ou ajuste a busca.</p>
          </div>
        ) : (
          <>
            <div className="usuarios-table-wrapper">
              <table className="usuarios-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Função</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {usuariosFiltrados.map((usuarioItem) => (
                    <tr
                      key={usuarioItem.id}
                      className={usuarioItem.ativo ? "" : "usuarios-row--inativo"}
                    >
                      <td>
                        <div className="usuarios-stack">
                          <strong>{usuarioItem.nome || "-"}</strong>
                        </div>
                      </td>

                      <td>{usuarioItem.email || "-"}</td>

                      <td>
                        <span className="usuarios-role-badge">
                          {labelRole(usuarioItem.roles)}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            usuarioItem.ativo
                              ? "usuarios-status-badge usuarios-status-badge--ativo"
                              : "usuarios-status-badge usuarios-status-badge--inativo"
                          }
                        >
                          {usuarioItem.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>

                      <td>
                        <div className="usuarios-actions">
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => abrirEdicao(usuarioItem)}
                            disabled={excluindoId === usuarioItem.id}
                          >
                            Editar
                          </button>

                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => handleExcluir(usuarioItem)}
                            disabled={
                              excluindoId === usuarioItem.id ||
                              usuarioItem.id === user?.uid
                            }
                            title={
                              usuarioItem.id === user?.uid
                                ? "Você não pode excluir seu próprio usuário."
                                : ""
                            }
                          >
                            {excluindoId === usuarioItem.id
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

            <div className="usuarios-mobile-list">
              {usuariosFiltrados.map((usuarioItem) => (
                <article
                  key={usuarioItem.id}
                  className={`usuario-card ${
                    usuarioItem.ativo ? "" : "usuario-card--inativo"
                  }`}
                >
                  <div className="usuario-card__header">
                    <div>
                      <h4>{usuarioItem.nome || "-"}</h4>
                      <p>{usuarioItem.email || "-"}</p>
                    </div>

                    <div className="usuarios-actions">
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => abrirEdicao(usuarioItem)}
                        disabled={excluindoId === usuarioItem.id}
                      >
                        Editar
                      </button>

                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => handleExcluir(usuarioItem)}
                        disabled={
                          excluindoId === usuarioItem.id ||
                          usuarioItem.id === user?.uid
                        }
                      >
                        {excluindoId === usuarioItem.id
                          ? "Excluindo..."
                          : "Excluir"}
                      </button>
                    </div>
                  </div>

                  <div className="usuario-card__grid">
                    <div>
                      <span>Função</span>
                      <strong>{labelRole(usuarioItem.roles)}</strong>
                    </div>

                    <div>
                      <span>Status</span>
                      <strong className={usuarioItem.ativo ? "" : "usuario-texto--inativo"}>
                        {usuarioItem.ativo ? "Ativo" : "Inativo"}
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
          <div
            className="modal modal--medium"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal__header">
              <div className="modal__title-group">
                <p className="page-header__eyebrow">
                  {usuarioEditandoId ? "Editar usuário" : "Novo usuário"}
                </p>
                <h3>
                  {usuarioEditandoId
                    ? "Atualizar cadastro"
                    : "Cadastrar usuário"}
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
                  <label htmlFor="nome">Nome</label>
                  <input
                    id="nome"
                    name="nome"
                    type="text"
                    value={form.nome}
                    onChange={handleChange}
                    placeholder="Digite o nome do usuário"
                  />
                </div>

                <div className="field">
                  <label htmlFor="email">E-mail</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Digite o e-mail"
                    disabled={Boolean(usuarioEditandoId)}
                  />
                </div>

                {!usuarioEditandoId ? (
                  <div className="field">
                    <label htmlFor="senha">Senha provisória</label>
                    <input
                      id="senha"
                      name="senha"
                      type="password"
                      value={form.senha}
                      onChange={handleChange}
                      placeholder="Digite a senha inicial"
                    />
                  </div>
                ) : null}

                <div className="field">
                  <label htmlFor="roles">Função</label>
                  <select
                    id="roles"
                    name="roles"
                    value={form.roles}
                    onChange={handleChange}
                  >
                    {ROLES_OPTIONS.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="ativo">Status do usuário</label>
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
              </div>

              {usuarioEditandoId ? (
                <div className="usuarios-note">
                  <p>
                    Nesta versão, e-mail e senha do Auth ficam fora da edição do
                    módulo.
                  </p>
                </div>
              ) : null}

              {erroFormulario ? (
                <div className="usuarios-feedback usuarios-feedback--erro">
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
                    : usuarioEditandoId
                      ? "Salvar alterações"
                      : "Cadastrar usuário"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default Usuarios;