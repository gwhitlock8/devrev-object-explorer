import { useEffect, useState } from 'react';
import CustomerLogin from './CustomerLogin.jsx';
import CustomerView from './CustomerView.jsx';

export default function CustomerGate() {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    fetch('/api/session', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setAuthenticated(!!d.authenticated))
      .catch(() => setAuthenticated(false))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="loading-page" style={{ minHeight: '100vh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!authenticated) return <CustomerLogin />;
  return <CustomerView />;
}
