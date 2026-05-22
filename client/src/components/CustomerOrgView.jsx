import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import CustomerGraph from './CustomerGraph.jsx';
import AdminPanel from './AdminPanel.jsx';
import DiffView from './DiffView.jsx';
import { useToast } from './Toast.jsx';

export default function CustomerOrgView() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const shareToken = searchParams.get('token');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (slug) fetchOrg();
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchOrg() {
    setLoading(true);
    setFetchError('');
    setNotFound(false);

    try {
      let url = `/api/customer/${slug}`;
      if (shareToken) url += `?token=${shareToken}`;

      console.log('[CustomerOrgView] Fetching:', url);
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
      console.log('[CustomerOrgView] Response status:', res.status);

      if (res.status === 401) {
        let body = {};
        try { body = await res.json(); } catch { /* non-JSON 401 */ }
        if (body.needsOrgAuth) {
          setNeedsAuth(true);
        } else {
          setNeedsAuth(true); // Default to showing password gate for any 401
        }
        setLoading(false);
        return;
      }

      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        console.error('[CustomerOrgView] Unexpected response:', res.status, text);
        setFetchError(`Server returned ${res.status}`);
        setLoading(false);
        return;
      }

      const json = await res.json();
      console.log('[CustomerOrgView] Data loaded:', json.orgName);
      setData(json);
      setNeedsAuth(false);
    } catch (err) {
      console.error('[CustomerOrgView] Fetch error:', err);
      setFetchError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleOrgAuth(e) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      const res = await fetch('/api/org-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug, password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Authentication failed');

      setPassword('');
      setNeedsAuth(false);
      await fetchOrg();
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ refresh: true, slug }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Refresh failed');
      toast.success('Model refreshed successfully');
      await fetchOrg();
    } catch (err) {
      toast.error(`Refresh failed: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-page">
        <div className="loading-spinner" />
        <div className="loading-text">Loading object model...</div>
      </div>
    );
  }

  // Fetch error
  if (fetchError) {
    return (
      <div className="auth-page">
        <div className="auth-box">
          <h1>
            <span>Error</span>
          </h1>
          <p>{fetchError}</p>
          <button type="button" className="auth-btn" onClick={fetchOrg}>
            Retry
          </button>
          <Link to="/admin/dashboard" className="auth-link">
            &larr; Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Org password gate
  if (needsAuth) {
    return (
      <div className="auth-page">
        <div className="auth-box">
          <h1>
            Object <span>Model</span>
          </h1>
          <p>Enter the password to view this organization&apos;s object model</p>
          <form onSubmit={handleOrgAuth}>
            <input
              type="password"
              className="auth-input"
              placeholder="Org password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button type="submit" className="auth-btn" disabled={authLoading || !password}>
              {authLoading ? 'Verifying...' : 'View Model'}
            </button>
          </form>
          {authError && <div className="auth-error visible">{authError}</div>}
          <Link to="/" className="auth-link">
            &larr; Back to home
          </Link>
        </div>
      </div>
    );
  }

  // Not found
  if (notFound || !data) {
    return (
      <div className="auth-page">
        <div className="auth-box">
          <h1>Not <span>Found</span></h1>
          <p>No object model found for &quot;{slug}&quot;.</p>
          <Link to="/admin/dashboard" className="auth-link">
            &larr; Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const stats = data.model?.stats || {};
  const isAdmin = data.isAdmin;

  return (
    <div className="customer-results">
      <div className="results-header">
        <div className="results-header-left">
          <div className="results-org">
            <span>{data.orgName}</span> Object Model
          </div>
          <span className="results-badge">
            {data.lastRefreshed
              ? `Last updated ${new Date(data.lastRefreshed).toLocaleDateString()}`
              : 'Live Discovery'}
          </span>
        </div>
        <div className="results-header-right">
          {isAdmin && (
            <>
              <button
                type="button"
                className="results-action-btn"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? 'Refreshing...' : '↻ Refresh'}
              </button>
              {data.snapshots?.length > 0 && (
                <button
                  type="button"
                  className={`results-action-btn ${showDiff ? 'active' : ''}`}
                  onClick={() => { setShowDiff(!showDiff); setShowAdmin(false); }}
                >
                  ⇔ Diff
                </button>
              )}
              <button
                type="button"
                className={`results-action-btn ${showAdmin ? 'active' : ''}`}
                onClick={() => { setShowAdmin(!showAdmin); setShowDiff(false); }}
              >
                ⚙ Manage
              </button>
              <Link to="/admin/dashboard" className="results-action-btn">
                ← Dashboard
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Admin panel (share links, annotations, export) */}
      {isAdmin && showAdmin && (
        <AdminPanel slug={slug} data={data} onAnnotationAdded={fetchOrg} />
      )}

      {/* Diff view */}
      {isAdmin && showDiff && data.snapshots?.length > 0 && (
        <DiffView current={data.model} snapshots={data.snapshots} />
      )}

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
              annotations={data.annotations}
            />
          </div>
        )}

        {/* Annotations display */}
        {data.annotations?.length > 0 && (
          <div className="annotations-section">
            <div className="annotations-title">Notes</div>
            <div className="annotations-list">
              {data.annotations.map((a) => (
                <div key={a.id} className="annotation-card">
                  <div className="annotation-text">{a.text}</div>
                  <div className="annotation-meta">
                    <span className="annotation-author">{a.author}</span>
                    {a.nodeType && <span className="annotation-target">on {a.nodeType}</span>}
                    {a.edgeKey && <span className="annotation-target">on {a.edgeKey}</span>}
                  </div>
                </div>
              ))}
            </div>
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
