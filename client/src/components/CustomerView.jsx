import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import CustomerGraph from './CustomerGraph.jsx';

function truncate(str, len = 24) {
  if (!str) return '';
  return str.length > len ? `${str.slice(0, len)}...` : str;
}

export default function CustomerView() {
  const { name: slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [pat, setPat] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(() => location.state?.discovery || null);
  const [loadingCached, setLoadingCached] = useState(!!slug && !location.state?.discovery);

  useEffect(() => {
    // If we already have data whose slug matches, skip the fetch
    if (data?.slug === slug) {
      setLoadingCached(false);
      return;
    }
    if (!slug) {
      setLoadingCached(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/customer/${slug}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (res.status === 401) {
          navigate(`/customer?redirect=/customer/${slug}`);
          return;
        }
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setData(json);
        }
      } catch {
        /* no cached model */
      } finally {
        if (!cancelled) setLoadingCached(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, navigate, data?.slug]);

  async function discover() {
    const token = pat.trim();
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ pat: token }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Discovery failed');
      setData(json);
      setPat('');
      if (json.slug) {
        navigate(`/customer/${json.slug}`, {
          replace: true,
          state: { discovery: json },
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setData(null);
    setPat('');
    setError('');
    navigate('/customer');
  }

  if (loadingCached) {
    return (
      <div className="loading-page">
        <div className="loading-spinner" />
        <div className="loading-text">Loading customer model...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="auth-page">
        <div className="auth-box">
          <h1>
            Customer <span>Explorer</span>
          </h1>
          <p>Enter a DevRev PAT to discover and visualize the customer&apos;s object model</p>
          <input
            type="password"
            className="auth-input"
            placeholder="Paste DevRev PAT here (don:secret:...)"
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && discover()}
          />
          <button type="button" className="auth-btn" onClick={discover} disabled={loading || !pat.trim()}>
            {loading ? 'Discovering...' : 'Discover Object Model'}
          </button>
          {error && <div className="auth-error visible">{error}</div>}
          <Link to="/" className="auth-link">
            &larr; Back to public explorer
          </Link>
        </div>
        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner" />
            <div className="loading-text">Discovering object model...</div>
          </div>
        )}
      </div>
    );
  }

  const stats = data.model?.stats || {};

  return (
    <div className="customer-results">
      <div className="results-header">
        <div className="results-header-left">
          <div className="results-org">
            <span>{data.orgName}</span> Object Model
          </div>
          <span className="results-badge">Live Discovery</span>
        </div>
        <button type="button" className="results-back" onClick={reset}>
          New Discovery
        </button>
      </div>
      <div className="results-body">
        <div className="results-stats">
          {[
            { num: data.model.categories.length, label: 'Categories' },
            {
              num: data.model.categories.reduce((s, c) => s + c.objects.length, 0),
              label: 'Objects',
            },
            { num: data.model.relationships.length, label: 'Relationships' },
            { num: stats.totalSyncUnits, label: 'Sync Units' },
            { num: stats.totalAccounts, label: 'Accounts' },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div className="stat-num">{s.num}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Interactive relationship graph */}
        {data.model.relationships.length > 0 && (
          <div className="graph-section">
            <div className="graph-section-header">
              <div className="graph-section-title">Relationship Graph</div>
              <div className="graph-section-hint">Click edges to see real examples &middot; Click nodes to highlight connections</div>
            </div>
            <CustomerGraph
              relationships={data.model.relationships}
              orgName={data.orgName}
            />
          </div>
        )}

        {/* Category inventory cards */}
        <div className="cat-grid">
          {data.model.categories.map((cat) => (
            <div key={cat.id} className="cat-card">
              <div className="cat-card-header">
                <div className="cat-card-dot" style={{ background: cat.color }} />
                <span className="cat-card-title">{cat.label}</span>
                <span className="cat-card-count">{cat.objects.length}</span>
              </div>
              <div className="cat-objects">
                {cat.objects.slice(0, 12).map((obj) => (
                  <div key={obj.id} className="cat-obj">
                    <span className="cat-obj-type">{obj.type}</span>
                    <span className="cat-obj-name">{obj.name}</span>
                    {obj.desc && <span className="cat-obj-desc">{obj.desc}</span>}
                  </div>
                ))}
                {cat.objects.length > 12 && (
                  <div className="cat-more">+{cat.objects.length - 12} more</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
