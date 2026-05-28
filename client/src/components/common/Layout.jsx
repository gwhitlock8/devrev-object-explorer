import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { DevRevLogo } from './DevRevLogo.jsx';
import { useSession } from '../SessionProvider.jsx';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, logout } = useSession();
  const isPresentation = location.pathname === '/';
  const isCustomerView = location.pathname.startsWith('/customer/');
  const isAdminArea = location.pathname.startsWith('/admin');

  async function handleLogout() {
    await logout();
    navigate('/');
  }

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
            to="/admin"
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
