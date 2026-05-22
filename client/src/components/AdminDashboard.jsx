import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ pat: '', password: '', slug: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    fetchOrgs();
  }, []);

  async function fetchOrgs() {
    try {
      const res = await fetch('/api/orgs', { credentials: 'include', cache: 'no-store' });
      if (res.status === 401) {
        navigate('/admin');
        return;
      }
      const data = await res.json();
      setOrgs(data.orgs || []);
    } catch {
      navigate('/admin');
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
      await fetchOrgs();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
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
        {orgs.map((org) => (
          <div key={org.slug} className="admin-org-card-wrapper">
            <Link to={`/customer/${org.slug}`} className="admin-org-card">
              <div className="org-card-left">
                <div className="org-card-name">{org.orgName}</div>
                <div className="org-card-slug">/customer/{org.slug}</div>
              </div>
              <div className="org-card-right">
                <div className="org-card-date">
                  <span className="org-card-label">Last refreshed</span>
                  <span>{formatDate(org.lastRefreshed)}</span>
                </div>
                <div className="org-card-date">
                  <span className="org-card-label">Created</span>
                  <span>{formatDate(org.discoveredAt)}</span>
                </div>
              </div>
            </Link>
            <button
              type="button"
              className="org-delete-btn"
              onClick={(e) => { e.preventDefault(); handleDelete(org.slug, org.orgName); }}
              title="Delete org"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
