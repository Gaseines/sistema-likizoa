import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./dashboard.css";

import { useAuth } from "../contexts/AuthContext";
import { ehAdminOuGestor } from "../utils/permissoes";
import { buscarClientes } from "../services/firebase/clientes";
import { buscarRecados } from "../services/firebase/recados";

function formatarData(data) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(data);
}

function criarDataComDiaValido(ano, mes, dia) {
  const ultimoDiaDoMes = new Date(ano, mes + 1, 0).getDate();
  return new Date(ano, mes, Math.min(Number(dia), ultimoDiaDoMes));
}

function calcularProximoCorte(diaCorte) {
  const hoje = new Date();
  const hojeSemHora = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate(),
  );

  let proximaData = criarDataComDiaValido(
    hojeSemHora.getFullYear(),
    hojeSemHora.getMonth(),
    diaCorte,
  );

  if (proximaData < hojeSemHora) {
    proximaData = criarDataComDiaValido(
      hojeSemHora.getFullYear(),
      hojeSemHora.getMonth() + 1,
      diaCorte,
    );
  }

  const diferencaMs = proximaData.getTime() - hojeSemHora.getTime();
  const diasRestantes = Math.round(diferencaMs / (1000 * 60 * 60 * 24));

  return {
    data: proximaData,
    diasRestantes,
  };
}

function ehRoleOperacional(role) {
  return ["operador", "analista", "assistente"].includes(
    String(role || "")
      .trim()
      .toLowerCase(),
  );
}

function Dashboard() {
  const { user, userData, loading, hasPermission } = useAuth();

  const [clientes, setClientes] = useState([]);
  const [recadosDashboard, setRecadosDashboard] = useState([]);
  const [carregandoResumo, setCarregandoResumo] = useState(true);
  const [erroResumo, setErroResumo] = useState("");

  const podeGerenciarTudo = ehAdminOuGestor(userData);
  const deveMostrarRecadosDashboard =
    !podeGerenciarTudo && ehRoleOperacional(userData?.roles);

  useEffect(() => {
    async function carregarResumo() {
      try {
        setCarregandoResumo(true);
        setErroResumo("");

        const promessas = [
          buscarClientes({
            role: userData?.roles,
            uid: user?.uid,
            isAdminOuGestor: podeGerenciarTudo,
          }),
        ];

        if (deveMostrarRecadosDashboard && user?.uid) {
          promessas.push(
            buscarRecados({
              tipo: "dashboard",
              destinatarioUid: user.uid,
              somenteAtivos: true,
            }),
          );
        } else {
          promessas.push(Promise.resolve([]));
        }

        const [dadosClientes, dadosRecados] = await Promise.all(promessas);

        setClientes(dadosClientes);
        setRecadosDashboard(dadosRecados);
      } catch (error) {
        console.error("ERRO ao carregar dashboard:", error);
        setErroResumo("Não foi possível carregar os dados do dashboard.");
      } finally {
        setCarregandoResumo(false);
      }
    }

    if (!loading) {
      carregarResumo();
    }
  }, [
    loading,
    user?.uid,
    userData?.roles,
    podeGerenciarTudo,
    deveMostrarRecadosDashboard,
  ]);

  const cardsResumo = useMemo(() => {
    return [
      {
        label: "Clientes visíveis",
        value: clientes.length,
        text: "Clientes liberados para o seu usuário",
      },
      {
        label: "Clientes ativos",
        value: clientes.filter((cliente) => cliente.ativo !== false).length,
        text: "Cadastros ativos no sistema",
      },
      {
        label: "Envio semanal",
        value: clientes.filter((cliente) => cliente.envioSemanal).length,
        text: "Clientes com rotina semanal marcada",
      },
    ];
  }, [clientes]);

  const proximosCortes = useMemo(() => {
    return clientes
      .filter((cliente) => Number(cliente.dataCorteDia) >= 1)
      .map((cliente) => {
        const corte = calcularProximoCorte(cliente.dataCorteDia);

        return {
          ...cliente,
          proximaDataCorte: corte.data,
          diasRestantes: corte.diasRestantes,
        };
      })
      .sort((a, b) => a.proximaDataCorte - b.proximaDataCorte)
      .slice(0, 8);
  }, [clientes]);

  const atalhos = useMemo(() => {
    const lista = [
      {
        key: "clientes",
        titulo: "Clientes",
        descricao: "Cadastros, vínculos e regras específicas",
        to: "/clientes",
      },
      {
        key: "emails",
        titulo: "E-mails",
        descricao: "Contatos por cliente",
        to: "/emails",
      },
      {
        key: "rastreadores",
        titulo: "Rastreadores",
        descricao: "Logins, senhas e links de acesso",
        to: "/rastreadores",
      },
      {
        key: "links",
        titulo: "Links",
        descricao: "Links fixos e acessos rápidos",
        to: "/links",
      },
      {
        key: "recados",
        titulo: "Recados",
        descricao: "Recados gerais para os usuários do sistema",
        to: "/recados",
      },
      {
        key: "usuarios",
        titulo: "Usuários",
        descricao: "Permissões, roles e status",
        to: "/usuarios",
      },
    ];

    return lista.filter((item) => hasPermission(item.key));
  }, [hasPermission]);

  if (loading) {
    return (
      <section className="page">
        <div className="card">
          <div className="dashboard-feedback">
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
          <p className="page-header__eyebrow">Visão geral</p>
          <h1>Dashboard</h1>
          <p className="page-header__description">
            Resumo rápido dos módulos principais e dos clientes visíveis para o
            seu usuário.
          </p>
        </div>
      </div>

      {carregandoResumo ? (
        <div className="card">
          <div className="dashboard-feedback">
            <p>Carregando dados do dashboard...</p>
          </div>
        </div>
      ) : erroResumo ? (
        <div className="card">
          <div className="dashboard-feedback dashboard-feedback--erro">
            <p>{erroResumo}</p>
          </div>
        </div>
      ) : (
        <>
          {deveMostrarRecadosDashboard && recadosDashboard.length > 0 ? (
            <div className="card dashboard-notices-card">
              <div className="dashboard-section-header">
                <div>
                  <h3>Recados</h3>
                  <p>Mensagens direcionadas ao seu usuário.</p>
                </div>
              </div>

              <div className="dashboard-postits-grid">
                {recadosDashboard.map((recado) => (
                  <article key={recado.id} className="dashboard-postit">
                    <span
                      className="dashboard-postit__tape"
                      aria-hidden="true"
                    />

                    {recado.titulo ? (
                      <strong className="dashboard-postit__title">
                        {recado.titulo}
                      </strong>
                    ) : (
                      <strong className="dashboard-postit__title">
                        Recado
                      </strong>
                    )}

                    <p className="dashboard-postit__text">
                      {recado.mensagem || "-"}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          <div className="dashboard-stats-grid">
            {cardsResumo.map((card) => (
              <div key={card.label} className="card dashboard-stat-card">
                <span className="dashboard-stat-card__label">{card.label}</span>
                <strong className="dashboard-stat-card__value">
                  {card.value}
                </strong>
                <p className="dashboard-stat-card__text">{card.text}</p>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="dashboard-section-header">
              <div>
                <h3>Próximas datas de corte</h3>
                <p>Clientes organizados pelas datas mais próximas.</p>
              </div>
            </div>

            {proximosCortes.length === 0 ? (
              <div className="dashboard-empty">
                <h4>Nenhuma data de corte encontrada</h4>
                <p>
                  Assim que os clientes tiverem data de corte cadastrada, eles
                  aparecerão aqui.
                </p>
              </div>
            ) : (
              <>
                <div className="dashboard-table-wrapper">
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Analista</th>
                        <th>Processamento</th>
                        <th>Data de corte</th>
                        <th>Próxima ocorrência</th>
                        <th>Faltam</th>
                      </tr>
                    </thead>

                    <tbody>
                      {proximosCortes.map((cliente) => (
                        <tr key={cliente.id}>
                          <td>
                            <div className="dashboard-stack">
                              <strong>{cliente.nome}</strong>
                            </div>
                          </td>
                          <td>
                            {cliente.analistaNome || cliente.analista || "-"}
                          </td>
                          <td>{cliente.tipoProcessamento || "-"}</td>
                          <td>Dia {cliente.dataCorteDia || "-"}</td>
                          <td>{formatarData(cliente.proximaDataCorte)}</td>
                          <td>
                            {cliente.diasRestantes === 0
                              ? "Hoje"
                              : `${cliente.diasRestantes} dia(s)`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="dashboard-mobile-list">
                  {proximosCortes.map((cliente) => (
                    <article key={cliente.id} className="dashboard-cutoff-card">
                      <div className="dashboard-cutoff-card__header">
                        <h4>{cliente.nome}</h4>
                        <span className="dashboard-badge">
                          Dia {cliente.dataCorteDia || "-"}
                        </span>
                      </div>

                      <div className="dashboard-cutoff-card__grid">
                        <div>
                          <span>Analista</span>
                          <strong>
                            {cliente.analistaNome || cliente.analista || "-"}
                          </strong>
                        </div>

                        <div>
                          <span>Processamento</span>
                          <strong>{cliente.tipoProcessamento || "-"}</strong>
                        </div>

                        <div>
                          <span>Próxima ocorrência</span>
                          <strong>
                            {formatarData(cliente.proximaDataCorte)}
                          </strong>
                        </div>

                        <div>
                          <span>Faltam</span>
                          <strong>
                            {cliente.diasRestantes === 0
                              ? "Hoje"
                              : `${cliente.diasRestantes} dia(s)`}
                          </strong>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="card">
            <div className="dashboard-section-header">
              <div>
                <h3>Acesso rápido</h3>
                <p>Atalhos para os módulos liberados para o seu perfil.</p>
              </div>
            </div>

            <div className="dashboard-shortcuts-grid">
              {atalhos.map((atalho) => (
                <Link
                  key={atalho.key}
                  to={atalho.to}
                  className="dashboard-shortcut-card"
                >
                  <span className="dashboard-shortcut-card__eyebrow">
                    Módulo
                  </span>
                  <strong className="dashboard-shortcut-card__title">
                    {atalho.titulo}
                  </strong>
                  <p className="dashboard-shortcut-card__text">
                    {atalho.descricao}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default Dashboard;
