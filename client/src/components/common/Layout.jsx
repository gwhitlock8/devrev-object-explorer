import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { DevRevLogo } from './DevRevLogo.jsx';

export default function Layout() {
  const location = useLocation();
  const isPresentation = location.pathname === '/';
  const isCustomerView = location.pathname.startsWith('/customer/');

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
            className={({ isActive }) => `nav-link customer ${isActive || location.pathname.startsWith('/admin') ? 'active' : ''}`}
          >
            Manage
          </NavLink>
        </div>
      </nav>
      <main className={isPresentation ? 'page-full page-no-pad' : 'page-full'}>
        <Outlet />
      </main>
    </>
  );
}
