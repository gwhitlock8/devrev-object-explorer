import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { DevRevLogo } from './DevRevLogo.jsx';

export default function Layout({ showNav = true }) {
  const location = useLocation();
  const isPresentation = location.pathname === '/';

  if (!showNav || isPresentation) {
    return <Outlet />;
  }

  return (
    <>
      <nav className="site-nav">
        <DevRevLogo />
        <div className="site-nav-links">
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
            Presentation
          </NavLink>
          <NavLink to="/objects" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Object Model
          </NavLink>
          <NavLink to="/admin" className={({ isActive }) => `nav-link customer ${isActive ? 'active' : ''}`}>
            Admin
          </NavLink>
        </div>
      </nav>
      <main className="page-full">
        <Outlet />
      </main>
    </>
  );
}
