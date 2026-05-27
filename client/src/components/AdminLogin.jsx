import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const checkedRef = useRef(false);

  // Check if already authenticated - only once
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    fetch('/api/session', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated && d.role === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
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
