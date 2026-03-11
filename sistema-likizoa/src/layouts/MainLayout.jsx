import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import logoLikizoa from "../assets/logo-likizoa.png";

function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 13.5h7V20H4zM13 4h7v9h-7zM13 15h7v5h-7zM4 4h7v7.5H4z" />
    </svg>
  );
}

function IconClientes() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 1a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 2c-3.314 0-6 2.015-6 4.5V20h12v-1.5c0-2.485-2.686-4.5-6-4.5ZM8 14c-2.673 0-5 1.493-5 3.5V20h5v-1.5A4.8 4.8 0 0 1 9.7 14.6 5.5 5.5 0 0 0 8 14Z" />
    </svg>
  );
}

function IconEmails() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm0 2v.2l8 5.2 8-5.2V8l-8 5-8-5Z" />
    </svg>
  );
}

function IconRastreadores() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm0 2a7 7 0 0 1 6.93 6H17a5 5 0 0 0-4-4.9V5.07A7.7 7.7 0 0 1 12 5Zm-1 1.07V12a1 1 0 0 0 .293.707l3.5 3.5 1.414-1.414L13 11.586V6.07A5.7 5.7 0 0 0 11 6.07ZM5.07 13A7 7 0 0 1 11 5.07V7.1A5 5 0 0 0 7.1 11H5.07ZM12 19a7 7 0 0 1-6.93-6H7.1A5 5 0 0 0 11 16.9v2.03A7.7 7.7 0 0 1 12 19Zm1-2.03A5 5 0 0 0 16.9 13h2.03A7 7 0 0 1 13 18.93Z" />
    </svg>
  );
}

function IconLinks() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.59 13.41a1 1 0 0 1 0-1.41l3.59-3.59a3 3 0 1 1 4.24 4.24l-2.12 2.12-1.41-1.41 2.12-2.12a1 1 0 1 0-1.41-1.41L11.99 13.4a1 1 0 0 1-1.4.01ZM13.41 10.59a1 1 0 0 1 0 1.41l-3.59 3.59a3 3 0 1 1-4.24-4.24l2.12-2.12 1.41 1.41-2.12 2.12a1 1 0 1 0 1.41 1.41l3.59-3.59a1 1 0 0 1 1.41 0Z" />
    </svg>
  );
}

function IconUsuarios() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Zm0 2c-4.136 0-7.5 2.462-7.5 5.5V21h15v-1.5C19.5 16.462 16.136 14 12 14Z" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5v-2H5V6h5Zm7.586 3.586L16.172 9H10v2h6.172l1.414 1.414L19 11l-4-4-1.414 1.414ZM10 13v2h6.172l-1.414 1.414L16.172 18 20 14l-3.828-4-1.414 1.414L16.172 13Z" />
    </svg>
  );
}

const menuItems = [
  {
    label: "Dashboard",
    path: "/",
    moduleKey: "dashboard",
    icon: IconDashboard,
  },
  {
    label: "Clientes",
    path: "/clientes",
    moduleKey: "clientes",
    icon: IconClientes,
  },
  {
    label: "E-mails",
    path: "/emails",
    moduleKey: "emails",
    icon: IconEmails,
  },
  {
    label: "Rastreadores",
    path: "/rastreadores",
    moduleKey: "rastreadores",
    icon: IconRastreadores,
  },
  {
    label: "Links",
    path: "/links",
    moduleKey: "links",
    icon: IconLinks,
  },
  {
    label: "Usuários",
    path: "/usuarios",
    moduleKey: "usuarios",
    icon: IconUsuarios,
  },
];

function formatarRole(role) {
  const roleNormalizada = String(role || "").trim().toLowerCase();

  const mapa = {
    admin: "Admin",
    gestor: "Gestor",
    operador: "Operador",
    analista: "Analista",
    assistente: "Assistente",
  };

  return mapa[roleNormalizada] || "Usuário";
}

function validarFormatoEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function MainLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const [emailForm, setEmailForm] = useState({
    currentPassword: "",
    newEmail: "",
  });
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const location = useLocation();
  const {
    user,
    userData,
    hasPermission,
    signOutUser,
    changePasswordUser,
    changeEmailUser,
  } = useAuth();

  const visibleMenuItems = useMemo(() => {
    return menuItems.filter((item) => hasPermission(item.moduleKey));
  }, [hasPermission]);

  const currentPageTitle = useMemo(() => {
    const currentItem = menuItems.find((item) => item.path === location.pathname);
    return currentItem?.label || "Likizoa";
  }, [location.pathname]);

  useEffect(() => {
    setMenuOpen(false);
    setProfileMenuOpen(false);
  }, [location.pathname]);

  const handleCloseMenu = () => setMenuOpen(false);

  function abrirPerfil() {
    setProfileMenuOpen(false);
    setProfileModalOpen(true);
    setEmailError("");
    setEmailSuccess("");
    setPasswordError("");
    setPasswordSuccess("");
  }

  function fecharPerfil() {
    if (savingPassword || savingEmail) return;

    setProfileModalOpen(false);
    setEmailForm({
      currentPassword: "",
      newEmail: "",
    });
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setEmailError("");
    setEmailSuccess("");
    setPasswordError("");
    setPasswordSuccess("");
  }

  function handleEmailChange(event) {
    const { name, value } = event.target;

    setEmailForm((estadoAtual) => ({
      ...estadoAtual,
      [name]: value,
    }));
  }

  function handlePasswordChange(event) {
    const { name, value } = event.target;

    setPasswordForm((estadoAtual) => ({
      ...estadoAtual,
      [name]: value,
    }));
  }

  async function handleLogout() {
    try {
      await signOutUser();
      handleCloseMenu();
      setProfileMenuOpen(false);
    } catch (error) {
      console.error("ERRO ao sair:", error);
    }
  }

  function validarEmail() {
    const { currentPassword, newEmail } = emailForm;
    const emailAtual = String(user?.email || "").trim().toLowerCase();
    const emailNovo = String(newEmail || "").trim().toLowerCase();

    if (!String(currentPassword || "").trim()) {
      return "Preencha sua senha atual.";
    }

    if (!emailNovo) {
      return "Preencha o novo e-mail.";
    }

    if (!validarFormatoEmail(emailNovo)) {
      return "Informe um e-mail válido.";
    }

    if (emailNovo === emailAtual) {
      return "O novo e-mail precisa ser diferente do atual.";
    }

    return "";
  }

  function validarSenha() {
    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (!String(currentPassword || "").trim()) {
      return "Preencha sua senha atual.";
    }

    if (!String(newPassword || "").trim()) {
      return "Preencha a nova senha.";
    }

    if (String(newPassword).trim().length < 6) {
      return "A nova senha deve ter pelo menos 6 caracteres.";
    }

    if (!String(confirmPassword || "").trim()) {
      return "Confirme a nova senha.";
    }

    if (newPassword !== confirmPassword) {
      return "A confirmação da nova senha não confere.";
    }

    if (currentPassword === newPassword) {
      return "A nova senha precisa ser diferente da senha atual.";
    }

    return "";
  }

  async function handleSubmitEmail(event) {
    event.preventDefault();

    const mensagemErro = validarEmail();

    if (mensagemErro) {
      setEmailError(mensagemErro);
      setEmailSuccess("");
      return;
    }

    try {
      setSavingEmail(true);
      setEmailError("");
      setEmailSuccess("");

      await changeEmailUser(emailForm.currentPassword, emailForm.newEmail.trim());

      setEmailSuccess(
        "Enviamos um link de confirmação para o novo e-mail. A troca só será concluída após a verificação.",
      );
      setEmailForm({
        currentPassword: "",
        newEmail: "",
      });
    } catch (error) {
      console.error("ERRO ao alterar e-mail:", error);

      let mensagem = "Não foi possível alterar o e-mail.";

      if (
        error?.code === "auth/wrong-password" ||
        error?.code === "auth/invalid-credential"
      ) {
        mensagem = "A senha atual informada está incorreta.";
      } else if (error?.code === "auth/invalid-email") {
        mensagem = "O novo e-mail informado é inválido.";
      } else if (error?.code === "auth/email-already-in-use") {
        mensagem = "Este e-mail já está sendo usado por outra conta.";
      } else if (error?.code === "auth/requires-recent-login") {
        mensagem = "Faça login novamente e tente alterar o e-mail.";
      } else if (error?.code === "auth/too-many-requests") {
        mensagem =
          "Muitas tentativas detectadas. Aguarde um pouco e tente novamente.";
      } else if (error?.code === "auth/network-request-failed") {
        mensagem = "Erro de conexão. Verifique sua internet e tente novamente.";
      }

      setEmailError(mensagem);
      setEmailSuccess("");
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleSubmitPassword(event) {
    event.preventDefault();

    const mensagemErro = validarSenha();

    if (mensagemErro) {
      setPasswordError(mensagemErro);
      setPasswordSuccess("");
      return;
    }

    try {
      setSavingPassword(true);
      setPasswordError("");
      setPasswordSuccess("");

      await changePasswordUser(
        passwordForm.currentPassword,
        passwordForm.newPassword,
      );

      setPasswordSuccess("Senha alterada com sucesso.");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      console.error("ERRO ao alterar senha:", error);

      let mensagem = "Não foi possível alterar a senha.";

      if (
        error?.code === "auth/wrong-password" ||
        error?.code === "auth/invalid-credential"
      ) {
        mensagem = "A senha atual informada está incorreta.";
      } else if (error?.code === "auth/weak-password") {
        mensagem = "A nova senha é muito fraca.";
      } else if (error?.code === "auth/requires-recent-login") {
        mensagem = "Faça login novamente e tente alterar a senha.";
      } else if (error?.code === "auth/too-many-requests") {
        mensagem =
          "Muitas tentativas detectadas. Aguarde um pouco e tente novamente.";
      } else if (error?.code === "auth/network-request-failed") {
        mensagem = "Erro de conexão. Verifique sua internet e tente novamente.";
      }

      setPasswordError(mensagem);
      setPasswordSuccess("");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar--open" : ""}`}>
        <div className="sidebar__brand-card">
          <div className="sidebar__brand-logo-wrapper">
            <img
              src={logoLikizoa}
              alt="Likizoa"
              className="sidebar__brand-logo"
            />
          </div>

          <div>
            <p className="sidebar__eyebrow">Likizoa</p>
            <h1 className="sidebar__title">Sistema Interno</h1>
            <p className="sidebar__subtitle">
              Gestão operacional, acessos e cadastros em um só lugar.
            </p>
          </div>

          <button
            className="sidebar__close"
            onClick={handleCloseMenu}
            aria-label="Fechar menu"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="sidebar__section-label">Navegação</div>

        <nav className="sidebar__nav">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
                }
                onClick={handleCloseMenu}
              >
                <span className="sidebar__link-icon">
                  <Icon />
                </span>
                <span className="sidebar__link-text">{item.label}</span>
              </NavLink>
            );
          })}

          <button
            type="button"
            className="sidebar__link sidebar__link--logout"
            onClick={handleLogout}
          >
            <span className="sidebar__link-icon">
              <IconLogout />
            </span>
            <span className="sidebar__link-text">Sair</span>
          </button>
        </nav>

        <div className="sidebar__footer-card">
          <div className="sidebar__footer-avatar">
            {(userData?.nome || user?.email || "L").charAt(0).toUpperCase()}
          </div>

          <div className="sidebar__footer-user">
            <strong>{userData?.nome || "Usuário"}</strong>
            <p>{user?.email || "Likizoa"}</p>
            <span className="status-badge">{formatarRole(userData?.roles)}</span>
          </div>
        </div>
      </aside>

      {menuOpen ? <div className="sidebar-backdrop" onClick={handleCloseMenu} /> : null}

      <div className="content-area">
        <header className="topbar">
          <div className="topbar__left">
            <button
              className="menu-button"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
              type="button"
            >
              ☰
            </button>

            <div>
              <p className="topbar__label">Área interna</p>
              <h2 className="topbar__title">{currentPageTitle}</h2>
            </div>
          </div>

          <div className="topbar__right">
            <div className="topbar__profile">
              <button
                className="user-chip user-chip--button"
                type="button"
                onClick={() => setProfileMenuOpen((estadoAtual) => !estadoAtual)}
              >
                <span className="user-chip__avatar">
                  {(userData?.nome || user?.email || "L").charAt(0).toUpperCase()}
                </span>

                <div className="user-chip__content">
                  <strong>{userData?.nome || "Usuário"}</strong>
                  <p>{user?.email || "Likizoa"}</p>
                </div>

                <span className="user-chip__chevron">▾</span>
              </button>

              {profileMenuOpen ? (
                <div className="profile-menu">
                  <button
                    type="button"
                    className="profile-menu__item"
                    onClick={abrirPerfil}
                  >
                    Meu perfil
                  </button>

                  <button
                    type="button"
                    className="profile-menu__item profile-menu__item--danger"
                    onClick={handleLogout}
                  >
                    Sair
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>

      {profileModalOpen ? (
        <div className="profile-modal-backdrop" onClick={fecharPerfil}>
          <div
            className="profile-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="profile-modal__header">
              <div>
                <p className="page-header__eyebrow">Meu perfil</p>
                <h3>Dados do usuário</h3>
              </div>

              <button
                className="ghost-button"
                type="button"
                onClick={fecharPerfil}
                disabled={savingPassword || savingEmail}
              >
                Fechar
              </button>
            </div>

            <div className="profile-modal__info-grid">
              <div className="profile-info-card">
                <span>Nome</span>
                <strong>{userData?.nome || "Usuário"}</strong>
              </div>

              <div className="profile-info-card">
                <span>E-mail atual</span>
                <strong>{user?.email || "-"}</strong>
              </div>

              <div className="profile-info-card">
                <span>Perfil</span>
                <strong>{formatarRole(userData?.roles)}</strong>
              </div>
            </div>

            <div className="profile-modal__divider" />

            <div className="profile-modal__password-block">
              <div className="profile-modal__section-title">
                <h4>Alterar e-mail</h4>
                <p>
                  Você receberá um link de confirmação no novo e-mail antes da troca ser concluída.
                </p>
              </div>

              <form className="profile-password-form" onSubmit={handleSubmitEmail}>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="newEmail">Novo e-mail</label>
                    <input
                      id="newEmail"
                      name="newEmail"
                      type="email"
                      value={emailForm.newEmail}
                      onChange={handleEmailChange}
                      placeholder="Digite o novo e-mail"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="emailCurrentPassword">Senha atual</label>
                    <input
                      id="emailCurrentPassword"
                      name="currentPassword"
                      type="password"
                      value={emailForm.currentPassword}
                      onChange={handleEmailChange}
                      placeholder="Digite sua senha atual"
                    />
                  </div>
                </div>

                {emailError ? (
                  <div className="profile-feedback profile-feedback--erro">
                    <p>{emailError}</p>
                  </div>
                ) : null}

                {emailSuccess ? (
                  <div className="profile-feedback profile-feedback--sucesso">
                    <p>{emailSuccess}</p>
                  </div>
                ) : null}

                <div className="profile-modal__actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={fecharPerfil}
                    disabled={savingEmail}
                  >
                    Cancelar
                  </button>

                  <button
                    className="primary-button"
                    type="submit"
                    disabled={savingEmail}
                  >
                    {savingEmail ? "Enviando..." : "Alterar e-mail"}
                  </button>
                </div>
              </form>
            </div>

            <div className="profile-modal__divider" />

            <div className="profile-modal__password-block">
              <div className="profile-modal__section-title">
                <h4>Alterar senha</h4>
                <p>Somente a sua senha pode ser alterada por aqui.</p>
              </div>

              <form className="profile-password-form" onSubmit={handleSubmitPassword}>
                <div className="form-grid">
                  <div className="field field--full">
                    <label htmlFor="currentPassword">Senha atual</label>
                    <input
                      id="currentPassword"
                      name="currentPassword"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={handlePasswordChange}
                      placeholder="Digite sua senha atual"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="newPassword">Nova senha</label>
                    <input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={handlePasswordChange}
                      placeholder="Mínimo de 6 caracteres"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="confirmPassword">Confirmar nova senha</label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={handlePasswordChange}
                      placeholder="Repita a nova senha"
                    />
                  </div>
                </div>

                {passwordError ? (
                  <div className="profile-feedback profile-feedback--erro">
                    <p>{passwordError}</p>
                  </div>
                ) : null}

                {passwordSuccess ? (
                  <div className="profile-feedback profile-feedback--sucesso">
                    <p>{passwordSuccess}</p>
                  </div>
                ) : null}

                <div className="profile-modal__actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={fecharPerfil}
                    disabled={savingPassword}
                  >
                    Cancelar
                  </button>

                  <button
                    className="primary-button"
                    type="submit"
                    disabled={savingPassword}
                  >
                    {savingPassword ? "Salvando..." : "Alterar senha"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default MainLayout;