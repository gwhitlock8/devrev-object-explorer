import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function CustomerLogin({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/customer';

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

      const target = redirect.startsWith('/customer') ? redirect : '/customer';
      const stayingOnGate = target === '/customer' || target === '/customer/';

      if (stayingOnGate) {
        onSuccess?.();
      } else {
        navigate(target);
      }
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
          Customer <span>Explorer</span>
        </h1>
        <p>Enter the password to access customer-specific object model discovery</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            className="auth-input"
            placeholder="Password"
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
