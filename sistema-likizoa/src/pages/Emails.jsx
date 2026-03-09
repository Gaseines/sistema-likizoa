import { useEffect, useMemo, useState } from "react";
import "./emails.css";

import { buscarClientes } from "../services/firebase/clientes";
import {
  atualizarEmailsCliente,
  buscarEmailsClientes,
  criarEmailsCliente,
} from "../services/firebase/emailsClientes";

const FORM_INICIAL = {
  clienteId: "",
  clienteNome: "",
  emailsTexto: "",
  ativo: true,
};

function extrairEmails(valor) {
  return [...new Set(
    String(valor || "")
      .split(/[\n,;]+/)
      .map((email) => email.trim())
      .filter(Boolean)
  )];
}

function emailsParaTexto(emails) {
  if (!Array.isArray(emails) || emails.length === 0) {
    return "";
  }

  return emails.join("\n");
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function Emails() {
  const [registros, setRegistros] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");

  const [busca, setBusca] = useState("");

  const [modalAberto, setModalAberto] = useState(false);
  const [registroEditandoId, setRegistroEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [erroFormulario, setErroFormulario] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [copiadoId, setCopiadoId] = useState("");

  async function carregarDados() {
    try {
      setCarregando(true);
      setErroLista("");

      const [dadosEmails, dadosClientes] = await Promise.all([
        buscarEmailsClientes(),
        buscarClientes(),
      ]);

      setRegistros(dadosEmails);
      setClientes(dadosClientes);
    } catch (error) {
      console.error("ERRO ao carregar e-mails:", error);
      setErroLista("Não foi possível carregar os e-mails dos clientes.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  const clientesDisponiveis = useMemo(() => {
    return [...clientes].sort((a, b) =>
      String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", {
        sensitivity: "base",
      })
    );
  }, [clientes]);

  const registrosFiltrados = useMemo(() => {
    const textoBusca = busca.trim().toLowerCase();

    if (!textoBusca) {
      return registros;
    }

    return registros.filter((registro) => {
      const clienteMatch = String(registro.clienteNome || "")
        .toLowerCase()
        .includes(textoBusca);

      const emailMatch = Array.isArray(registro.emails)
        ? registro.emails.some((email) =>
            String(email).toLowerCase().includes(textoBusca)
          )
        : false;

      return clienteMatch || emailMatch;
    });
  }, [registros, busca]);

  function abrirNovoRegistro() {
    setRegistroEditandoId(null);
    setForm(FORM_INICIAL);
    setErroFormulario("");
    setModalAberto(true);
  }

  function abrirEdicao(registro) {
    setRegistroEditandoId(registro.id);
    setForm({
      clienteId: registro.clienteId || "",
      clienteNome: registro.clienteNome || "",
      emailsTexto: emailsParaTexto(registro.emails),
      ativo: registro.ativo ?? true,
    });
    setErroFormulario("");
    setModalAberto(true);
  }

  function fecharModal(forcarFechamento = false) {
    if (salvando && !forcarFechamento) return;

    setModalAberto(false);
    setRegistroEditandoId(null);
    setForm(FORM_INICIAL);
    setErroFormulario("");
  }

  function handleClienteChange(event) {
    const clienteId = event.target.value;
    const clienteSelecionado = clientesDisponiveis.find(
      (cliente) => cliente.id === clienteId
    );

    setForm((estadoAtual) => ({
      ...estadoAtual,
      clienteId,
      clienteNome: clienteSelecionado?.nome || "",
    }));
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((estadoAtual) => ({
      ...estadoAtual,
      [name]: value,
    }));
  }

  function validarFormulario() {
    const emails = extrairEmails(form.emailsTexto);

    if (!form.clienteId) {
      return "Selecione um cliente.";
    }

    if (emails.length === 0) {
      return "Informe pelo menos um e-mail.";
    }

    const emailInvalido = emails.find((email) => !validarEmail(email));

    if (emailInvalido) {
      return `O e-mail "${emailInvalido}" é inválido.`;
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const mensagemErro = validarFormulario();

    if (mensagemErro) {
      setErroFormulario(mensagemErro);
      return;
    }

    const payload = {
      clienteId: form.clienteId,
      clienteNome: form.clienteNome,
      emails: extrairEmails(form.emailsTexto),
      ativo: form.ativo,
    };

    try {
      setSalvando(true);
      setErroFormulario("");

      if (registroEditandoId) {
        await atualizarEmailsCliente(registroEditandoId, payload);
      } else {
        await criarEmailsCliente(payload);
      }

      await carregarDados();
      fecharModal(true);
    } catch (error) {
      console.error("ERRO ao salvar e-mails do cliente:", error);
      setErroFormulario("Não foi possível salvar os e-mails.");
    } finally {
      setSalvando(false);
    }
  }

  async function copiarEmails(registro) {
    try {
      const texto = Array.isArray(registro.emails)
        ? registro.emails.join("; ")
        : "";

      await navigator.clipboard.writeText(texto);
      setCopiadoId(registro.id);

      window.setTimeout(() => {
        setCopiadoId("");
      }, 1800);
    } catch (error) {
      console.error("ERRO ao copiar e-mails:", error);
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="page-header__eyebrow">Módulo 02</p>
          <h1>E-mails</h1>
          <p className="page-header__description">
            Aqui você guarda os e-mails de cada cliente para consultar e copiar
            rapidamente no dia a dia.
          </p>
        </div>

        <button className="primary-button" type="button" onClick={abrirNovoRegistro}>
          + Novo registro
        </button>
      </div>

      <div className="card">
        <div className="emails-toolbar">
          <div>
            <h3>Busca</h3>
            <p>Pesquise por nome do cliente ou por um endereço de e-mail.</p>
          </div>

          <div className="emails-search">
            <div className="field">
              <label htmlFor="busca-email-cliente">Buscar</label>
              <input
                id="busca-email-cliente"
                type="text"
                placeholder="Ex: Cliente XPTO ou financeiro@cliente.com"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="emails-toolbar">
          <div>
            <h3>Lista de e-mails</h3>
            <p>{registrosFiltrados.length} registro(s) encontrado(s)</p>
          </div>
        </div>

        {carregando ? (
          <div className="emails-feedback">
            <p>Carregando e-mails...</p>
          </div>
        ) : erroLista ? (
          <div className="emails-feedback emails-feedback--erro">
            <p>{erroLista}</p>
          </div>
        ) : registrosFiltrados.length === 0 ? (
          <div className="emails-empty">
            <h4>Nenhum registro encontrado</h4>
            <p>Cadastre um novo registro ou ajuste a busca.</p>
          </div>
        ) : (
          <>
            <div className="emails-table-wrapper">
              <table className="emails-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Qtd.</th>
                    <th>E-mails</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {registrosFiltrados.map((registro) => (
                    <tr key={registro.id}>
                      <td>
                        <div className="emails-stack">
                          <strong>{registro.clienteNome || "-"}</strong>
                        </div>
                      </td>

                      <td>{Array.isArray(registro.emails) ? registro.emails.length : 0}</td>

                      <td>
                        <div className="email-tags">
                          {Array.isArray(registro.emails) && registro.emails.length > 0 ? (
                            registro.emails.map((email) => (
                              <span key={email} className="email-chip">
                                {email}
                              </span>
                            ))
                          ) : (
                            <span>-</span>
                          )}
                        </div>
                      </td>

                      <td>{registro.ativo ? "Ativo" : "Inativo"}</td>

                      <td>
                        <div className="emails-actions">
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => copiarEmails(registro)}
                          >
                            {copiadoId === registro.id ? "Copiado!" : "Copiar"}
                          </button>

                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => abrirEdicao(registro)}
                          >
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="emails-mobile-list">
              {registrosFiltrados.map((registro) => (
                <article key={registro.id} className="email-card">
                  <div className="email-card__header">
                    <div>
                      <h4>{registro.clienteNome || "-"}</h4>
                      <p>
                        {Array.isArray(registro.emails)
                          ? `${registro.emails.length} e-mail(s)`
                          : "0 e-mails"}
                      </p>
                    </div>

                    <div className="emails-actions">
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => copiarEmails(registro)}
                      >
                        {copiadoId === registro.id ? "Copiado!" : "Copiar"}
                      </button>

                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => abrirEdicao(registro)}
                      >
                        Editar
                      </button>
                    </div>
                  </div>

                  <div className="email-card__body">
                    {Array.isArray(registro.emails) && registro.emails.length > 0 ? (
                      registro.emails.map((email) => (
                        <span key={email} className="email-chip">
                          {email}
                        </span>
                      ))
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      {modalAberto ? (
        <div className="modal-backdrop" onClick={() => fecharModal()}>
          <div className="modal modal--medium" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <div className="modal__title-group">
                <p className="page-header__eyebrow">
                  {registroEditandoId ? "Editar registro" : "Novo registro"}
                </p>
                <h3>
                  {registroEditandoId ? "Atualizar e-mails" : "Cadastrar e-mails"}
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
                <div className="field field--full">
                  <label htmlFor="clienteId">Cliente</label>
                  <select
                    id="clienteId"
                    name="clienteId"
                    value={form.clienteId}
                    onChange={handleClienteChange}
                  >
                    <option value="">Selecione um cliente</option>
                    {clientesDisponiveis.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field field--full">
                  <label htmlFor="emailsTexto">
                    E-mails do cliente
                  </label>
                  <textarea
                    id="emailsTexto"
                    name="emailsTexto"
                    rows="8"
                    value={form.emailsTexto}
                    onChange={handleChange}
                    placeholder={`Digite um e-mail por linha\nou separe por vírgula / ponto e vírgula`}
                  />
                </div>

                <div className="field">
                  <label htmlFor="ativo">Status do registro</label>
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

              {erroFormulario ? (
                <div className="emails-feedback emails-feedback--erro">
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

                <button className="primary-button" type="submit" disabled={salvando}>
                  {salvando
                    ? "Salvando..."
                    : registroEditandoId
                      ? "Salvar alterações"
                      : "Cadastrar e-mails"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default Emails;