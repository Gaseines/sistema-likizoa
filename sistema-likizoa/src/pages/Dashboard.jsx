function Dashboard() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="page-header__eyebrow">Visão geral</p>
          <h1>Dashboard</h1>
          <p className="page-header__description">
            Essa será a tela inicial do sistema da Likizoa, com atalhos e
            resumos dos módulos principais.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-card__label">Clientes</span>
          <strong className="stat-card__value">0</strong>
          <p className="stat-card__text">Cadastro central da empresa</p>
        </div>

        <div className="stat-card">
          <span className="stat-card__label">E-mails</span>
          <strong className="stat-card__value">0</strong>
          <p className="stat-card__text">Contatos rápidos por cliente</p>
        </div>

        <div className="stat-card">
          <span className="stat-card__label">Rastreadores</span>
          <strong className="stat-card__value">0</strong>
          <p className="stat-card__text">Logins e links centralizados</p>
        </div>
      </div>

      <div className="card">
        <h3>Próximos passos</h3>
        <p>
          No próximo passo vamos conectar o Firebase e começar o primeiro módulo:
          cadastro de clientes com listagem, filtros e formulário.
        </p>
      </div>
    </section>
  );
}

export default Dashboard;