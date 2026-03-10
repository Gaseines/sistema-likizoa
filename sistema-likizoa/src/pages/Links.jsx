import { useEffect, useMemo, useState } from "react";
import "./links.css";

import { useAuth } from "../contexts/AuthContext";
import { ehAdminOuGestor } from "../utils/permissoes";
import { buscarClientes } from "../services/firebase/clientes";

const ABAS = [
  { key: "clientes", label: "Links clientes" },
  { key: "tempo-real", label: "Links em tempo real" },
  { key: "faturamento", label: "Link faturamento" },
];

const LINKS_TEMPO_REAL = [
  {
    id: "rtm-interticio",
    grupo: "RTM",
    titulo: "Intertício",
    url: "http://likizoa-rtm.jornadatrabalho2.com.br/src/controller/CalculadoraJornadaController.php?mod=grid_status_atual_view2",
    aliasesClientes: ["rtm"],
  },
  {
    id: "rtm-jornada",
    grupo: "RTM",
    titulo: "Jornada",
    url: "https://likizoa-rtm.jornadatrabalho.com.br/src/controller/CalculadoraJornadaController.php?mod=grid_status_atual_view",
    aliasesClientes: ["rtm"],
  },
  {
    id: "pedrao-interticio",
    grupo: "Pedrão",
    titulo: "Intertício",
    url: "http://likizoa-pedrotc.jornadatrabalho2.com.br/src/controller/CalculadoraJornadaController.php?mod=grid_status_atual_view2",
    aliasesClientes: ["pedrao", "pedrão", "pedrotc"],
  },
  {
    id: "pedrao-jornada",
    grupo: "Pedrão",
    titulo: "Jornada",
    url: "https://likizoa-pedrotc.jornadatrabalho.com.br/src/controller/CalculadoraJornadaController.php?mod=grid_status_atual_view",
    aliasesClientes: ["pedrao", "pedrão", "pedrotc"],
  },
  {
    id: "outros-alertas",
    grupo: "Outros Links",
    titulo: "Alertas",
    url: "https://alertas.jornadatrabalho.com.br",
    aliasesClientes: [],
  },
  {
    id: "outros-chamados",
    grupo: "Outros Links",
    titulo: "Chamados",
    url: "http://chamado.jornadatrabalho2.com.br",
    aliasesClientes: [],
  },
];

const LINKS_FATURAMENTO = [
  {
    id: "faturamento",
    grupo: "Faturamento",
    titulo: "Faturamento",
    url: "https://gaseines.github.io/Faturamento/",
  },
];

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function linkValido(valor) {
  const texto = String(valor || "").trim();

  if (!texto) return false;

  try {
    const url = new URL(texto);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function abrirLink(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function clienteExistePorAlias(clientes, aliases = []) {
  if (!Array.isArray(aliases) || aliases.length === 0) {
    return true;
  }

  const nomesClientes = clientes.map((cliente) => normalizarTexto(cliente.nome));

  return aliases.some((alias) => {
    const aliasNormalizado = normalizarTexto(alias);

    return nomesClientes.some((nomeCliente) =>
      nomeCliente.includes(aliasNormalizado),
    );
  });
}

function obterPlaceholderBusca(abaAtiva) {
  if (abaAtiva === "clientes") {
    return "Ex: Barcellos Comex";
  }

  if (abaAtiva === "tempo-real") {
    return "Ex: RTM, Pedrão, Jornada ou Chamados";
  }

  return "Ex: Faturamento";
}

function filtrarLinksFixos(items, busca) {
  const textoBusca = normalizarTexto(busca);

  if (!textoBusca) {
    return items;
  }

  return items.filter((item) => {
    return (
      normalizarTexto(item.grupo).includes(textoBusca) ||
      normalizarTexto(item.titulo).includes(textoBusca) ||
      normalizarTexto(item.url).includes(textoBusca)
    );
  });
}

function Links() {
  const { user, userData, loading } = useAuth();
  const podeGerenciarLinks = ehAdminOuGestor(userData);

  const [clientesPermitidos, setClientesPermitidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");
  const [busca, setBusca] = useState("");
  const [abaAtiva, setAbaAtiva] = useState("clientes");

  async function carregarLinks() {
    try {
      setCarregando(true);
      setErroLista("");

      const dadosClientes = await buscarClientes({
        role: userData?.roles,
        uid: user?.uid,
        isAdminOuGestor: podeGerenciarLinks,
      });

      setClientesPermitidos(dadosClientes);
    } catch (error) {
      console.error("ERRO ao carregar links:", error);
      setErroLista("Não foi possível carregar os links dos clientes.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (!loading) {
      carregarLinks();
    }
  }, [loading, user?.uid, userData?.roles, podeGerenciarLinks]);

  const clientesComLink = useMemo(() => {
    return clientesPermitidos.filter((cliente) =>
      linkValido(cliente.linkNossoSistema),
    );
  }, [clientesPermitidos]);

  const linksClientesFiltrados = useMemo(() => {
    const textoBusca = normalizarTexto(busca);

    if (!textoBusca) {
      return clientesComLink;
    }

    return clientesComLink.filter((cliente) =>
      normalizarTexto(cliente.nome).includes(textoBusca),
    );
  }, [clientesComLink, busca]);

  const linksTempoRealVisiveis = useMemo(() => {
    return LINKS_TEMPO_REAL.filter((item) =>
      clienteExistePorAlias(clientesPermitidos, item.aliasesClientes),
    );
  }, [clientesPermitidos]);

  const linksTempoRealFiltrados = useMemo(() => {
    return filtrarLinksFixos(linksTempoRealVisiveis, busca);
  }, [linksTempoRealVisiveis, busca]);

  const linksFaturamentoFiltrados = useMemo(() => {
    return filtrarLinksFixos(LINKS_FATURAMENTO, busca);
  }, [busca]);

  const quantidadeAbaAtiva = useMemo(() => {
    if (abaAtiva === "clientes") {
      return linksClientesFiltrados.length;
    }

    if (abaAtiva === "tempo-real") {
      return linksTempoRealFiltrados.length;
    }

    return linksFaturamentoFiltrados.length;
  }, [
    abaAtiva,
    linksClientesFiltrados.length,
    linksTempoRealFiltrados.length,
    linksFaturamentoFiltrados.length,
  ]);

  if (loading) {
    return (
      <section className="page">
        <div className="card">
          <div className="links-feedback">
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
          
          <h1>Links</h1>
          <p className="page-header__description">
            Aqui você acessa rapidamente os links úteis do sistema e dos clientes.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="links-tabs">
          {ABAS.map((aba) => (
            <button
              key={aba.key}
              type="button"
              className={`links-tab ${
                abaAtiva === aba.key ? "links-tab--active" : ""
              }`}
              onClick={() => setAbaAtiva(aba.key)}
            >
              {aba.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="links-toolbar">
          <div>
            <h3>Busca</h3>
            <p>
              {abaAtiva === "clientes"
                ? "Pesquise pelo nome do cliente para encontrar o link mais rápido."
                : abaAtiva === "tempo-real"
                  ? "Pesquise por grupo ou nome do link em tempo real."
                  : "Pesquise pelo nome do link de faturamento."}
            </p>
          </div>

          <div className="links-search">
            <div className="field">
              <label htmlFor="busca-links">Buscar</label>
              <input
                id="busca-links"
                type="text"
                placeholder={obterPlaceholderBusca(abaAtiva)}
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="links-toolbar">
          <div>
            <h3>
              {abaAtiva === "clientes"
                ? "Links dos clientes"
                : abaAtiva === "tempo-real"
                  ? "Links em tempo real"
                  : "Link faturamento"}
            </h3>
            <p>{quantidadeAbaAtiva} item(ns) encontrado(s)</p>
          </div>
        </div>

        {carregando ? (
          <div className="links-feedback">
            <p>Carregando links...</p>
          </div>
        ) : erroLista ? (
          <div className="links-feedback links-feedback--erro">
            <p>{erroLista}</p>
          </div>
        ) : abaAtiva === "clientes" ? (
          linksClientesFiltrados.length === 0 ? (
            <div className="links-empty">
              <h4>Nenhum link encontrado</h4>
              <p>
                Nenhum cliente disponível com link cadastrado ou ajuste a busca.
              </p>
            </div>
          ) : (
            <>
              <div className="links-table-wrapper">
                <table className="links-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Status</th>
                      <th>Ação</th>
                    </tr>
                  </thead>

                  <tbody>
                    {linksClientesFiltrados.map((cliente) => (
                      <tr key={cliente.id}>
                        <td>
                          <div className="links-stack">
                            <strong>{cliente.nome || "-"}</strong>
                          </div>
                        </td>

                        <td>{cliente.ativo ? "Ativo" : "Inativo"}</td>

                        <td>
                          <div className="links-actions">
                            <button
                              className="primary-button"
                              type="button"
                              onClick={() => abrirLink(cliente.linkNossoSistema)}
                            >
                              Acessar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="links-mobile-list">
                {linksClientesFiltrados.map((cliente) => (
                  <article key={cliente.id} className="link-card">
                    <div className="link-card__header">
                      <div>
                        <h4>{cliente.nome || "-"}</h4>
                        <p>{cliente.ativo ? "Ativo" : "Inativo"}</p>
                      </div>

                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => abrirLink(cliente.linkNossoSistema)}
                      >
                        Acessar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )
        ) : abaAtiva === "tempo-real" ? (
          linksTempoRealFiltrados.length === 0 ? (
            <div className="links-empty">
              <h4>Nenhum link encontrado</h4>
              <p>Nenhum link em tempo real disponível para sua visualização.</p>
            </div>
          ) : (
            <>
              <div className="links-table-wrapper">
                <table className="links-table">
                  <thead>
                    <tr>
                      <th>Grupo</th>
                      <th>Link</th>
                      <th>Ação</th>
                    </tr>
                  </thead>

                  <tbody>
                    {linksTempoRealFiltrados.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="links-stack">
                            <strong>{item.grupo}</strong>
                          </div>
                        </td>

                        <td>{item.titulo}</td>

                        <td>
                          <div className="links-actions">
                            <button
                              className="primary-button"
                              type="button"
                              onClick={() => abrirLink(item.url)}
                            >
                              Acessar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="links-mobile-list">
                {linksTempoRealFiltrados.map((item) => (
                  <article key={item.id} className="link-card">
                    <div className="link-card__header">
                      <div>
                        <h4>{item.titulo}</h4>
                        <p>{item.grupo}</p>
                      </div>

                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => abrirLink(item.url)}
                      >
                        Acessar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )
        ) : linksFaturamentoFiltrados.length === 0 ? (
          <div className="links-empty">
            <h4>Nenhum link encontrado</h4>
            <p>Nenhum link de faturamento disponível.</p>
          </div>
        ) : (
          <>
            <div className="links-table-wrapper">
              <table className="links-table">
                <thead>
                  <tr>
                    <th>Grupo</th>
                    <th>Link</th>
                    <th>Ação</th>
                  </tr>
                </thead>

                <tbody>
                  {linksFaturamentoFiltrados.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="links-stack">
                          <strong>{item.grupo}</strong>
                        </div>
                      </td>

                      <td>{item.titulo}</td>

                      <td>
                        <div className="links-actions">
                          <button
                            className="primary-button"
                            type="button"
                            onClick={() => abrirLink(item.url)}
                          >
                            Acessar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="links-mobile-list">
              {linksFaturamentoFiltrados.map((item) => (
                <article key={item.id} className="link-card">
                  <div className="link-card__header">
                    <div>
                      <h4>{item.titulo}</h4>
                      <p>{item.grupo}</p>
                    </div>

                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => abrirLink(item.url)}
                    >
                      Acessar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default Links;