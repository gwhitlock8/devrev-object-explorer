import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from './Toast.jsx';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ pat: '', password: '', slug: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [copied, setCopied] = useState(null);
  const [search, setSearch] = useState('');
  const toast = useToast();
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    // Check auth first before trying to fetch orgs
    fetch('/api/session', { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (!d.authenticated || d.role !== 'admin') {
          navigate('/admin', { replace: true });
        } else {
          fetchOrgs();
        }
      })
      .catch(() => navigate('/admin', { replace: true }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchOrgs() {
    try {
      const res = await fetch('/api/orgs', { credentials: 'include', cache: 'no-store' });
      if (res.status === 401) {
        navigate('/admin', { replace: true });
        return;
      }
      const data = await res.json();
      setOrgs(data.orgs || []);
    } catch {
      navigate('/admin', { replace: true });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setCreateError('');

    try {
      const body = {
        pat: createForm.pat.trim(),
        password: createForm.password,
      };
      if (createForm.slug.trim()) {
        body.slug = createForm.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      }

      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Discovery failed');

      setShowCreate(false);
      setCreateForm({ pat: '', password: '', slug: '' });
      await fetchOrgs();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(slug, orgName) {
    if (!confirm(`Delete "${orgName}" and all its data? This cannot be undone.`)) return;
    try {
      const res = await fetch('/api/org-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }
      toast.success('Org deleted successfully');
      await fetchOrgs();
    } catch (err) {
      toast.error(`Delete failed: ${err.message}`);
    }
  }

  function copyUrl(slug) {
    const url = `${window.location.origin}/customer/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(slug);
    toast.success('URL copied to clipboard');
    setTimeout(() => setCopied(null), 2000);
  }

  function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function daysSince(d) {
    if (!d) return null;
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  if (loading) {
    return (
      <div className="loading-page">
        <div className="loading-spinner" />
        <div className="loading-text">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div className="admin-header-left">
          <h1>Customer <span>Orgs</span></h1>
          <span className="admin-badge">{orgs.length} org{orgs.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="admin-header-right">
          <button
            type="button"
            className="admin-create-btn"
            onClick={() => setShowCreate(!showCreate)}
          >
            {showCreate ? 'Cancel' : '+ New Org'}
          </button>
        </div>
      </div>

      {/* Create new org form */}
      {showCreate && (
        <div className="admin-create-panel">
          <form onSubmit={handleCreate}>
            <div className="create-form-title">Create new customer org</div>
            <div className="create-form-fields">
              <div className="create-field">
                <label>DevRev PAT <span className="required">*</span></label>
                <input
                  type="password"
                  className="auth-input"
                  placeholder="don:secret:... or eyJ..."
                  value={createForm.pat}
                  onChange={(e) => setCreateForm((f) => ({ ...f, pat: e.target.value }))}
                  required
                />
              </div>
              <div className="create-field">
                <label>Org password <span className="required">*</span></label>
                <input
                  type="password"
                  className="auth-input"
                  placeholder="Password customers will use to view"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                  required
                />
              </div>
              <div className="create-field">
                <label>URL slug <span className="optional">(optional)</span></label>
                <input
                  type="text"
                  className="auth-input"
                  placeholder="e.g. acme-corp (defaults to org name)"
                  value={createForm.slug}
                  onChange={(e) => setCreateForm((f) => ({ ...f, slug: e.target.value }))}
                />
                <span className="create-field-hint">
                  {createForm.slug
                    ? `URL: /customer/${createForm.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`
                    : 'Will use the org name from DevRev'}
                </span>
              </div>
            </div>
            <button type="submit" className="auth-btn" disabled={creating || !createForm.pat || !createForm.password}>
              {creating ? 'Discovering...' : 'Run Discovery & Create'}
            </button>
            {createError && <div className="auth-error visible">{createError}</div>}
          </form>
        </div>
      )}

      {/* Search */}
      {orgs.length > 3 && (
        <div className="admin-search">
          <input
            type="text"
            className="admin-search-input"
            placeholder="Search orgs by name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* Org list */}
      <div className="admin-org-list">
        {orgs.length === 0 && !showCreate && (
          <div className="admin-empty">
            <p>No orgs discovered yet.</p>
            <button type="button" className="admin-create-btn" onClick={() => setShowCreate(true)}>
              + Create your first org
            </button>
          </div>
        )}
        {orgs
          .filter((org) => {
            if (!search) return true;
            const q = search.toLowerCase();
            return org.orgName?.toLowerCase().includes(q) || org.slug?.toLowerCase().includes(q);
          })
          .map((org) => {
          const stale = daysSince(org.lastRefreshed);
          return (
            <div key={org.slug} className="admin-org-card-wrapper">
              <Link to={`/customer/${org.slug}`} className="admin-org-card">
                <div className="org-card-left">
                  <div className="org-card-name">
                    {org.orgName}
                    {stale > 30 && <span className="org-stale-badge">Stale</span>}
                  </div>
                  <div className="org-card-slug">/customer/{org.slug}</div>
                </div>
                <div className="org-card-right">
                  <div className="org-card-date">
                    <span className="org-card-label">Last refreshed</span>
                    <span>{formatDate(org.lastRefreshed)}</span>
                  </div>
                  <div className="org-card-date">
                    <span className="org-card-label">Customer views</span>
                    <span>{org.viewCount || 0}{org.lastViewedAt ? ` · ${formatDate(org.lastViewedAt)}` : ''}</span>
                  </div>
                </div>
              </Link>
              <div className="org-card-actions">
                <button
                  type="button"
                  className="org-copy-btn"
                  onClick={(e) => { e.preventDefault(); copyUrl(org.slug); }}
                  title="Copy customer URL"
                >
                  {copied === org.slug ? '✓' : '🔗'}
                </button>
                <button
                  type="button"
                  className="org-delete-btn"
                  onClick={(e) => { e.preventDefault(); handleDelete(org.slug, org.orgName); }}
                  title="Delete org"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
