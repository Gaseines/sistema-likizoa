function Rastreadores() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="page-header__eyebrow">Módulo 03</p>
          <h1>Rastreadores</h1>
          <p className="page-header__description">
            Área para armazenar acessos dos rastreadores dos clientes e também
            os acessos gerais da empresa.
          </p>
        </div>

        <button className="primary-button" type="button">
          + Novo acesso
        </button>
      </div>

      <div className="card">
        <h3>Campos previstos</h3>
        <ul className="simple-list">
          <li>Nome do cliente / Nosso acesso</li>
          <li>Nome do rastreador / tecnologia</li>
          <li>Email</li>
          <li>Login</li>
          <li>Senha</li>
          <li>Link de acesso</li>
        </ul>
      </div>
    </section>
  );
}

export default Rastreadores;