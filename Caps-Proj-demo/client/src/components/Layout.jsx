import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <header className="top-header">
        <div className="top-header-left">
          <img src="/sait-aris-logo.png" alt="SAIT ARIS" className="header-logo" />
          <div className="header-title">
            <span className="header-title-main">ARIS LIMS</span>
            <span className="header-title-sub">Laboratory Information Management System</span>
          </div>
        </div>
        <div className="top-header-right">
          <div className="user-info-header">
            <span className="user-name">{user?.name}</span>
            <span className="user-role">{user?.role}</span>
          </div>
          <button className="btn btn-outline btn-sm" onClick={handleLogout}>Logout</button>
        </div>
      </header>
      <aside className="sidebar">
        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Dashboard
          </NavLink>
          <NavLink to="/coc" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            COC Vault
          </NavLink>
          <NavLink to="/favourites" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Favourites
          </NavLink>
          {isAdmin && <div className="nav-divider" />}
          {isAdmin && (
            <NavLink to="/upload" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Upload
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin/users" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Manage Users
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/export" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Export
            </NavLink>
          )}

        </nav>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
