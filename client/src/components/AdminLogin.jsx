import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from './SessionProvider.jsx';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { loading: sessionLoading, isAdmin, refresh } = useSession();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (sessionLoading) return;
    if (isAdmin) navigate('/admin/dashboard', { replace: true });
  }, [sessionLoading, isAdmin, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      await refresh();
      if (mountedRef.current) navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      if (mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  if (sessionLoading) {
    return (
      <div className="loading-page">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <h1>
          DevRev <span>Admin</span>
        </h1>
        <p>Enter the master password to manage customer object models</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            className="auth-input"
            name="admin-password"
            id="admin-password"
            placeholder="Master password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button type="submit" className="auth-btn" disabled={loading || !password}>
            {loading ? 'Signing in...' : 'Continue'}
          </button>
        </form>
        {error && <div className="auth-error visible">{error}</div>}
      </div>
    </div>
  );
}
