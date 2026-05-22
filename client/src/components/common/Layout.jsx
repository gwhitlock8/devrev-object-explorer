import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { DevRevLogo } from './DevRevLogo.jsx';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isPresentation = location.pathname === '/';
  const isCustomerView = location.pathname.startsWith('/customer/');
  const isAdminArea = location.pathname.startsWith('/admin');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch('/api/session', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.authenticated && d.role === 'admin'))
      .catch(() => setIsAdmin(false));
  }, [location.pathname]);

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE', credentials: 'include' });
    setIsAdmin(false);
    navigate('/');
  }

  // On customer-facing pages, show a minimal nav (no admin link visible)
  if (isCustomerView) {
    return (
      <>
        <nav className="site-nav">
          <DevRevLogo />
          <div className="site-nav-links">
            <NavLink to="/" className="nav-link" end>
              Home
            </NavLink>
            <NavLink to="/objects" className="nav-link">
              Object Model
            </NavLink>
          </div>
        </nav>
        <main className="page-full">
          <Outlet />
        </main>
      </>
    );
  }

  return (
    <>
      <nav className={`site-nav ${isPresentation ? 'site-nav-overlay' : ''}`}>
        <DevRevLogo />
        <div className="site-nav-links">
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
            Presentation
          </NavLink>
          <NavLink to="/objects" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Object Model
          </NavLink>
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) => `nav-link customer ${isActive || isAdminArea ? 'active' : ''}`}
          >
            Manage
          </NavLink>
          {isAdmin && (
            <button type="button" className="nav-logout" onClick={handleLogout}>
              Logout
            </button>
          )}
        </div>
      </nav>
      <main className={isPresentation ? 'page-full page-no-pad' : 'page-full'}>
        <Outlet />
      </main>
    </>
  );
}
