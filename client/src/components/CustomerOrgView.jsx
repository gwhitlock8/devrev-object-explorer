import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [shareLinkInvalid, setShareLinkInvalid] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchOrg = useCallback(async (signal) => {
    setLoading(true);
    setFetchError('');
    setNotFound(false);
    setShareLinkInvalid(false);

    try {
      let url = `/api/customer/${slug}`;
      if (shareToken) url += `?token=${encodeURIComponent(shareToken)}`;

      const res = await fetch(url, { credentials: 'include', cache: 'no-store', signal });

      if (res.status === 401) {
        if (signal?.aborted) return;
        setNeedsAuth(true);
        if (shareToken) setShareLinkInvalid(true);
        setLoading(false);
        return;
      }

      if (res.status === 404) {
        if (signal?.aborted) return;
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        if (signal?.aborted) return;
        setFetchError(`Server returned ${res.status}`);
        setLoading(false);
        return;
      }

      const json = await res.json();
      if (signal?.aborted) return;
      setData(json);
      setNeedsAuth(false);
      setShareLinkInvalid(false);
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (!mountedRef.current) return;
      setFetchError(err.message || 'Network error');
    } finally {
      if (!signal?.aborted && mountedRef.current) setLoading(false);
    }
  }, [slug, shareToken]);

  useEffect(() => {
    if (!slug) return undefined;

    const controller = new AbortController();
    fetchOrg(controller.signal);

    return () => controller.abort();
  }, [slug, shareToken, fetchOrg]);

  const handleAnnotationChange = useCallback((change) => {
    if (change.type === 'add' && change.annotation) {
      setData((prev) => (
        prev ? { ...prev, annotations: [change.annotation, ...(prev.annotations || [])] } : prev
      ));
      return;
    }
    if (change.type === 'delete' && change.id) {
      setData((prev) => (
        prev
          ? { ...prev, annotations: (prev.annotations || []).filter((a) => a.id !== change.id) }
          : prev
      ));
    }
  }, []);

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

      if (!mountedRef.current) return;
      setPassword('');
      setNeedsAuth(false);
      setShareLinkInvalid(false);
      await fetchOrg();
    } catch (err) {
      if (mountedRef.current) setAuthError(err.message);
    } finally {
      if (mountedRef.current) setAuthLoading(false);
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
      if (!mountedRef.current) return;
      toast.success('Model refreshed successfully');
      await fetchOrg();
    } catch (err) {
      if (mountedRef.current) toast.error(`Refresh failed: ${err.message}`);
    } finally {
      if (mountedRef.current) setRefreshing(false);
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

  if (fetchError) {
    return (
      <div className="auth-page">
        <div className="auth-box">
          <h1>
            <span>Error</span>
          </h1>
          <p>{fetchError}</p>
          <button type="button" className="auth-btn" onClick={() => fetchOrg()}>
            Retry
          </button>
          <Link to="/admin/dashboard" className="auth-link">
            &larr; Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="auth-page">
        <div className="auth-box">
          <h1>
            Object <span>Model</span>
          </h1>
          {shareLinkInvalid ? (
            <p>This share link is invalid or has expired. Enter the org password to continue.</p>
          ) : (
            <p>Enter the password to view this organization&apos;s object model</p>
          )}
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

  const model = data.model ?? { categories: [], relationships: [], stats: {} };
  const categories = model.categories ?? [];
  const relationships = model.relationships ?? [];
  const stats = model.stats ?? {};
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

      {isAdmin && showAdmin && (
        <AdminPanel slug={slug} data={data} onAnnotationChange={handleAnnotationChange} />
      )}

      {isAdmin && showDiff && data.snapshots?.length > 0 && (
        <DiffView current={model} snapshots={data.snapshots} />
      )}

      <div className="results-body">
        <div className="results-stats">
          {[
            { num: categories.length, label: 'Categories' },
            {
              num: categories.reduce((s, c) => s + (c.objects?.length ?? 0), 0),
              label: 'Objects',
            },
            { num: relationships.length, label: 'Relationships' },
            { num: stats.totalSyncUnits, label: 'Sync Units' },
            { num: stats.totalAccounts, label: 'Accounts' },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div className="stat-num">{s.num}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {relationships.length > 0 && (
          <div className="graph-section">
            <div className="graph-section-header">
              <div className="graph-section-title">Relationship Graph</div>
              <div className="graph-section-hint">Click edges to see real examples &middot; Click nodes to highlight connections</div>
            </div>
            <CustomerGraph
              relationships={relationships}
              annotations={data.annotations}
            />
          </div>
        )}

        {data.annotations?.filter((a) => !a.nodeType && !a.edgeKey).length > 0 && (
          <div className="annotations-section">
            <div className="annotations-title">General notes</div>
            <div className="annotations-list">
              {data.annotations.filter((a) => !a.nodeType && !a.edgeKey).map((a) => (
                <div key={a.id} className="annotation-card" style={{ borderLeftColor: a.annotationType === 'recommendation' ? '#7ADB12' : a.annotationType === 'question' ? '#FFE600' : a.annotationType === 'highlight' ? '#F35106' : '#5996FF' }}>
                  <div className="annotation-text">{a.text}</div>
                  <div className="annotation-meta">
                    <span className="annotation-author">{a.author}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="cat-grid">
          {categories.map((cat) => (
            <div key={cat.id} className="cat-card">
              <div className="cat-card-header">
                <div className="cat-card-dot" style={{ background: cat.color }} />
                <span className="cat-card-title">{cat.label}</span>
                <span className="cat-card-count">{cat.objects?.length ?? 0}</span>
              </div>
              <div className="cat-objects">
                {(cat.objects ?? []).slice(0, 12).map((obj) => (
                  <div key={obj.id} className="cat-obj">
                    <span className="cat-obj-type">{obj.type}</span>
                    <span className="cat-obj-name">{obj.name}</span>
                    {obj.desc && <span className="cat-obj-desc">{obj.desc}</span>}
                  </div>
                ))}
                {(cat.objects?.length ?? 0) > 12 && (
                  <div className="cat-more">+{(cat.objects?.length ?? 0) - 12} more</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
