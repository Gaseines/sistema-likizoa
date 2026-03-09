import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const menuItems = [
  { label: "Dashboard", path: "/", moduleKey: "dashboard" },
  { label: "Clientes", path: "/clientes", moduleKey: "clientes" },
  { label: "E-mails", path: "/emails", moduleKey: "emails" },
  { label: "Rastreadores", path: "/rastreadores", moduleKey: "rastreadores" },
];

function MainLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { user, userData, hasPermission, signOutUser } = useAuth();

  const visibleMenuItems = useMemo(() => {
    return menuItems.filter((item) => hasPermission(item.moduleKey));
  }, [hasPermission]);

  const currentPageTitle = useMemo(() => {
    const currentItem = menuItems.find((item) => item.path === location.pathname);
    return currentItem?.label || "Likizoa";
  }, [location.pathname]);

  const handleCloseMenu = () => setMenuOpen(false);

  async function handleLogout() {
    try {
      await signOutUser();
      handleCloseMenu();
    } catch (error) {
      console.error("ERRO ao sair:", error);
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar--open" : ""}`}>
        <div className="sidebar__header">
          <div>
            <p className="sidebar__eyebrow">Likizoa</p>
            <h1 className="sidebar__title">Sistema Interno</h1>
          </div>

          <button
            className="sidebar__close"
            onClick={handleCloseMenu}
            aria-label="Fechar menu"
          >
            ✕
          </button>
        </div>

        <nav className="sidebar__nav">
          {visibleMenuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
              }
              onClick={handleCloseMenu}
            >
              {item.label}
            </NavLink>
          ))}

          <button
            type="button"
            className="sidebar__link"
            onClick={handleLogout}
            style={{
              width: "100%",
              textAlign: "left",
              border: "none",
              background: "transparent",
            }}
          >
            Sair
          </button>
        </nav>

        <div className="sidebar__footer">
          <span className="status-badge">
            {userData?.role || "usuário"}
          </span>
        </div>
      </aside>

      {menuOpen && <div className="sidebar-backdrop" onClick={handleCloseMenu} />}

      <div className="content-area">
        <header className="topbar">
          <div className="topbar__left">
            <button
              className="menu-button"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
            >
              ☰
            </button>

            <div>
              <p className="topbar__label">Área interna</p>
              <h2 className="topbar__title">{currentPageTitle}</h2>
            </div>
          </div>

          <div className="topbar__right">
            <div className="user-chip">
              <span className="user-chip__avatar">
                {(userData?.nome || user?.email || "L").charAt(0).toUpperCase()}
              </span>

              <div>
                <strong>{userData?.nome || "Usuário"}</strong>
                <p>{user?.email || "Likizoa"}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;