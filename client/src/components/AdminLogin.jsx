import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Check if already authenticated
  useEffect(() => {
    fetch('/api/session', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated) navigate('/admin/dashboard', { replace: true });
      })
      .catch(() => {});
  }, [navigate]);

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
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
